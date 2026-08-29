import type { FastifyInstance } from 'fastify';
import {
  CreateAgentRunSchema,
  ResolveAgentApprovalSchema,
  type AgentRun,
  type AgentRunPhase
} from '../models/agent.js';
import type { Job as JobData, JobType } from '../models/schemas.js';
import {
  agentRunChannel,
  createAgentRun,
  getAgentEvents,
  getAgentRun,
  publishAgentEvent,
  updateAgentRun
} from '../utils/agentRuns.js';
import { addJob, cancelJob, getRedisClient } from '../utils/queue.js';
import { getProject, updateProject } from '../utils/database.js';
import { generateFileName, uploadFile } from '../utils/storage.js';

export async function agentRunRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-attachments', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ message: `Project ${projectId} not found` });

    const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    if (!data) return reply.code(400).send({ message: 'Choose an image to attach' });
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(data.mimetype)) {
      return reply.code(415).send({ message: 'References must be PNG, JPEG, or WebP images' });
    }

    const buffer = await data.toBuffer();
    const uploaded = await uploadFile(
      buffer,
      generateFileName(data.filename || 'reference.png', `agent_${projectId}`),
      data.mimetype,
      { bucket: 'htn2025', folder: `agent-references/${projectId}` }
    );
    return reply.code(201).send({
      id: crypto.randomUUID(),
      name: data.filename,
      url: uploaded.url,
      mime_type: data.mimetype,
      size: uploaded.size
    });
  });

  fastify.post('/api/projects/:projectId/agent-runs', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = CreateAgentRunSchema.parse(request.body);
    const project = await getProject(projectId);
    if (!project) return reply.code(404).send({ message: `Project ${projectId} not found` });

    const timestamp = new Date().toISOString();
    const run: AgentRun = {
      id: crypto.randomUUID(),
      project_id: projectId,
      kind: body.kind,
      prompt: body.prompt,
      status: 'queued',
      phase: initialPhase(body.kind),
      settings: body.settings,
      context: body.context,
      tasks: [],
      artifacts: [],
      assistant_text: '',
      created_at: timestamp,
      updated_at: timestamp,
      last_event_id: 0
    };
    await createAgentRun(run);
    await publishAgentEvent(run.id, 'message.completed', {
      id: crypto.randomUUID(),
      role: 'user',
      content: body.prompt
    });
    await publishAgentEvent(run.id, 'run.status', { status: 'queued', phase: run.phase });
    await enqueueAgentStep(run, phaseToJobStep(run.phase));
    return reply.code(201).send(await getAgentRun(run.id));
  });

  fastify.get('/api/agent-runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await getAgentRun(runId);
    if (!run) return reply.code(404).send({ message: `Agent run ${runId} not found` });
    return reply.send(run);
  });

  fastify.get('/api/agent-runs/:runId/events', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await getAgentRun(runId);
    if (!run) return reply.code(404).send({ message: `Agent run ${runId} not found` });

    const headerId = Number(request.headers['last-event-id'] || 0);
    const queryId = Number((request.query as { after?: string })?.after || 0);
    const afterId = Math.max(Number.isFinite(headerId) ? headerId : 0, Number.isFinite(queryId) ? queryId : 0);
    const subscriber = getRedisClient().duplicate();
    await subscriber.connect();

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    const writeEvent = (event: { id: number; type: string; data: Record<string, unknown> }) => {
      if (reply.raw.destroyed) return;
      reply.raw.write(`id: ${event.id}\n`);
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const channel = agentRunChannel(runId);
    await subscriber.subscribe(channel, (message) => {
      try {
        const event = JSON.parse(message);
        if (event.id > afterId) writeEvent(event);
      } catch (error) {
        fastify.log.warn({ error }, 'Could not parse agent event');
      }
    });

    for (const event of await getAgentEvents(runId, afterId)) writeEvent(event);
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ run_id: runId, after: afterId })}\n\n`);

    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    }, 15_000);

    request.raw.on('close', async () => {
      clearInterval(heartbeat);
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch {
        subscriber.destroy();
      }
    });
  });

  fastify.post('/api/agent-runs/:runId/approvals/:approvalId', async (request, reply) => {
    const { runId, approvalId } = request.params as { runId: string; approvalId: string };
    const body = ResolveAgentApprovalSchema.parse(request.body);
    const run = await getAgentRun(runId);
    if (!run) return reply.code(404).send({ message: `Agent run ${runId} not found` });
    const approval = run.approval;
    if (!approval || approval.id !== approvalId) {
      return reply.code(409).send({ message: 'This approval is no longer active' });
    }
    if (approval.status !== 'pending') {
      if (body.idempotency_key && approval.idempotency_key === body.idempotency_key) return reply.send(run);
      return reply.code(409).send({ message: 'This approval has already been resolved' });
    }

    const resolvedAt = new Date().toISOString();
    const resolvedStatus = body.decision === 'approve'
      ? 'approved'
      : body.decision === 'revise'
        ? 'revision_requested'
        : 'cancelled';
    const resolvedApproval = {
      ...approval,
      status: resolvedStatus as typeof approval.status,
      resolved_at: resolvedAt,
      idempotency_key: body.idempotency_key
    };

    await publishAgentEvent(runId, 'approval.resolved', {
      id: approval.id,
      kind: approval.kind,
      decision: body.decision,
      values: body.values,
      feedback: body.feedback
    });

    if (body.decision === 'cancel') {
      const cancelled = await updateAgentRun(runId, { status: 'cancelled', approval: resolvedApproval });
      await publishAgentEvent(runId, 'run.cancelled', { reason: 'Cancelled at approval checkpoint' });
      return reply.send(cancelled);
    }

    if (approval.kind === 'concept') {
      const concept = { ...(run.concept || {}), ...body.values };
      const runtime = Number(concept.runtime_seconds || run.settings.runtime_seconds);
      const aspect = String(concept.aspect_ratio || run.settings.aspect_ratio) as AgentRun['settings']['aspect_ratio'];
      await updateAgentRun(runId, {
        concept,
        settings: { ...run.settings, runtime_seconds: runtime, aspect_ratio: aspect },
        approval: resolvedApproval,
        status: 'queued'
      });
      if (body.decision === 'approve') {
        await updateProject(run.project_id, {
          title: String(concept.title || 'Untitled film'),
          summary: String(concept.summary || concept.logline || ''),
          plot: String(concept.story_direction || concept.summary || '')
        });
        await enqueueAgentStep({ ...run, concept } as AgentRun, 'production_plan');
      } else {
        await enqueueAgentStep({ ...run, concept } as AgentRun, 'concept', body.feedback || 'Revise the concept with the supplied field edits.');
      }
    } else if (approval.kind === 'production_plan') {
      const productionPlan = { ...(run.production_plan || {}), ...body.values };
      await updateAgentRun(runId, {
        production_plan: productionPlan,
        approval: resolvedApproval,
        status: 'queued'
      });
      await enqueueAgentStep(
        { ...run, production_plan: productionPlan } as AgentRun,
        body.decision === 'approve' ? 'production' : 'production_plan',
        body.feedback
      );
    } else {
      await updateAgentRun(runId, { approval: resolvedApproval, status: 'queued' });
      if (body.decision === 'revise') {
        const revised = await updateAgentRun(runId, { status: 'awaiting_approval', approval: { ...approval, status: 'pending' } });
        await publishAgentEvent(runId, 'recommendation.created', {
          id: crypto.randomUUID(),
          title: 'Revise individual clips first',
          description: body.feedback || 'Select a clip on the canvas, apply the revision, then return to assembly.'
        });
        return reply.send(revised);
      }
      await enqueueAgentStep(run, 'assembly');
    }

    await publishAgentEvent(runId, 'run.status', { status: 'queued', phase: run.phase });
    return reply.send(await getAgentRun(runId));
  });

  fastify.post('/api/agent-runs/:runId/cancel', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await getAgentRun(runId);
    if (!run) return reply.code(404).send({ message: `Agent run ${runId} not found` });

    await updateAgentRun(runId, { status: 'cancelled', error: undefined });
    await publishAgentEvent(runId, 'run.cancelled', { reason: 'Cancelled by user' });
    await Promise.all(run.tasks.map(async (task) => {
      if (!task.job_type || ['completed', 'failed', 'cancelled'].includes(task.status)) return;
      try {
        await cancelJob(task.job_type as JobType, task.id);
      } catch {
        // Active provider work may not be removable; workers still see the run as cancelled.
      }
    }));
    return reply.send(await getAgentRun(runId));
  });
}

async function enqueueAgentStep(run: AgentRun, phase: 'concept' | 'production_plan' | 'production' | 'assembly', feedback?: string) {
  const timestamp = new Date().toISOString();
  const job: JobData = {
    id: crypto.randomUUID(),
    project_id: run.project_id,
    type: 'agent-orchestration',
    status: 'pending',
    progress: 0,
    input_data: { phase, ...(feedback ? { feedback } : {}) },
    output_data: {},
    created_at: timestamp,
    updated_at: timestamp,
    run_id: run.id,
    phase: jobStepToPhase(phase)
  };
  await addJob('agent-orchestration', job);
}

function initialPhase(kind: AgentRun['kind']): AgentRunPhase {
  if (kind === 'assemble-film') return 'assembly';
  if (kind === 'plan-scenes' || kind === 'generate-frames' || kind === 'generate-videos') return 'production_plan';
  return 'concept';
}

function phaseToJobStep(phase: AgentRunPhase): 'concept' | 'production_plan' | 'production' | 'assembly' {
  if (phase === 'assembly') return 'assembly';
  if (phase === 'production_plan') return 'production_plan';
  if (['assets', 'scenes', 'frames', 'videos'].includes(phase)) return 'production';
  return 'concept';
}

function jobStepToPhase(step: 'concept' | 'production_plan' | 'production' | 'assembly'): AgentRunPhase {
  if (step === 'production') return 'assets';
  return step;
}
