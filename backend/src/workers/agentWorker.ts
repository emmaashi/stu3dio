import { Worker, type Job as BullJob } from 'bullmq';
import { SchemaType, type Schema } from '@google/generative-ai';
import { generateJSON, generateTextStream } from '../ai/gemini.js';
import {
  getCharactersByProject,
  getFramesByProject,
  getProject,
  getScenesByProject,
} from '../utils/database.js';
import { buildSceneContext, formatCanvasSelectionForPrompt, formatContextForPrompt } from '../utils/context.js';
import { addJob, getJobStatus, queueConnection } from '../utils/queue.js';
import {
  getAgentRun,
  publishAgentEvent,
  updateAgentRun
} from '../utils/agentRuns.js';
import type { AgentApproval, AgentRun, AgentRunPhase } from '../models/agent.js';
import type { Job as JobData } from '../models/schemas.js';

const conceptSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    logline: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    story_direction: { type: SchemaType.STRING },
    visual_style: { type: SchemaType.STRING },
    audio_direction: { type: SchemaType.STRING },
    characters: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING },
          age: { type: SchemaType.NUMBER },
          description: { type: SchemaType.STRING },
          personality: { type: SchemaType.STRING },
          backstory: { type: SchemaType.STRING }
        },
        required: ['name', 'role', 'age', 'description', 'personality', 'backstory']
      }
    }
  },
  required: ['title', 'logline', 'summary', 'story_direction', 'visual_style', 'audio_direction', 'characters']
};

const productionPlanSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    overview: { type: SchemaType.STRING },
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          scene_order: { type: SchemaType.NUMBER },
          title: { type: SchemaType.STRING },
          detailed_plot: { type: SchemaType.STRING },
          concise_plot: { type: SchemaType.STRING },
          dialogue: { type: SchemaType.STRING },
          target_frames: { type: SchemaType.NUMBER },
          duration: { type: SchemaType.NUMBER }
        },
        required: ['id', 'scene_order', 'title', 'detailed_plot', 'concise_plot', 'dialogue', 'target_frames', 'duration']
      }
    }
  },
  required: ['overview', 'scenes']
};

type AgentJobInput = {
  phase: 'concept' | 'production_plan' | 'production' | 'assembly';
  feedback?: string;
};

export function createAgentWorker() {
  const worker = new Worker(
    'agent-orchestration',
    async (job: BullJob) => processAgentJob(job),
    { connection: queueConnection, concurrency: 2 }
  );
  console.log('🎛️  Agent orchestration worker created');
  return worker;
}

async function processAgentJob(job: BullJob) {
  const runId = String(job.data.run_id || '');
  const input = job.data.input_data as AgentJobInput;
  if (!runId) throw new Error('Agent run ID is required');

  switch (input.phase) {
    case 'concept':
      return generateConcept(runId, input.feedback);
    case 'production_plan':
      return generateProductionPlan(runId, input.feedback);
    case 'production':
      return runProduction(runId);
    case 'assembly':
      return assembleFilm(runId);
    default:
      throw new Error(`Unsupported orchestration phase: ${String(input.phase)}`);
  }
}

async function generateConcept(runId: string, feedback?: string) {
  const run = await requireActiveRun(runId);
  const project = await getProject(run.project_id);
  const references = getAttachedReferences(run);
  const inheritedContext = await buildSceneContext(run.project_id);
  const canvasFocus = formatCanvasSelectionForPrompt(run.context);
  const messageId = crypto.randomUUID();

  await updateAgentRun(runId, {
    status: 'thinking',
    phase: 'concept',
    assistant_text: '',
    error: undefined,
    approval: undefined
  });
  await publishAgentEvent(runId, 'run.status', { status: 'thinking', phase: 'concept' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'concept-structure',
    label: feedback ? 'Revising the creative brief' : 'Structuring the story',
    phase: 'concept'
  });
  await publishAgentEvent(runId, 'message.started', { id: messageId, role: 'assistant' });

  const systemPrompt = `You are Stu3dio's film director. Give a concise, production-focused response about how you will shape the user's idea into a 64-second short film. Do not reveal chain-of-thought. Describe only the creative result and next checkpoint.`;
  const streamPrompt = [
    `Project title: ${project?.title || 'Untitled film'}`,
    `Existing summary: ${project?.summary || ''}`,
    `Existing plot: ${project?.plot || ''}`,
    formatContextForPrompt(inheritedContext),
    canvasFocus,
    `User direction: ${run.prompt}`,
    references.length ? `Attached visual references: ${references.map(reference => `${reference.name} (${reference.url})`).join(', ')}` : '',
    feedback ? `Requested revision: ${feedback}` : ''
  ].filter(Boolean).join('\n\n');

  let assistantText = '';
  for await (const chunk of generateTextStream(streamPrompt, systemPrompt)) {
    assistantText += chunk;
    await updateAgentRun(runId, { assistant_text: assistantText });
    await publishAgentEvent(runId, 'message.delta', { id: messageId, role: 'assistant', delta: chunk });
  }
  await publishAgentEvent(runId, 'message.completed', { id: messageId, role: 'assistant', content: assistantText });
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'concept-structure',
    label: 'Creative direction prepared',
    phase: 'concept'
  });

  await publishAgentEvent(runId, 'activity.started', {
    id: 'concept-cast',
    label: 'Resolving the cast and visual language',
    phase: 'concept'
  });
  const concept = await generateJSON<Record<string, unknown>>(
    streamPrompt,
    conceptSchema,
    `Create a production-ready concept for a short AI-generated film. Return 3-5 complete characters. Keep the story achievable in ${run.settings.runtime_seconds} seconds, ${run.settings.aspect_ratio}. The user's latest direction is authoritative.`
  );
  const values = {
    ...concept,
    runtime_seconds: run.settings.runtime_seconds,
    aspect_ratio: run.settings.aspect_ratio,
    shot_seconds: 8
  };
  const approval = makeConceptApproval(values);

  await updateAgentRun(runId, {
    status: 'awaiting_approval',
    concept: values,
    approval
  });
  await publishAgentEvent(runId, 'context.updated', {
    project: {
      id: run.project_id,
      title: project?.title,
      summary: project?.summary,
      plot: project?.plot
    },
    inheritance: ['project summary', 'project plot'],
    references: references.map(reference => ({
      id: reference.id,
      name: reference.name,
      url: reference.url,
      mime_type: reference.mime_type
    }))
  });
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'concept-cast',
    label: 'Concept and cast brief ready',
    phase: 'concept'
  });
  await publishAgentEvent(runId, 'approval.requested', approval as unknown as Record<string, unknown>);
  await publishAgentEvent(runId, 'run.status', { status: 'awaiting_approval', phase: 'concept' });
  return { approval_id: approval.id, concept: values };
}

async function generateProductionPlan(runId: string, feedback?: string) {
  const run = await requireActiveRun(runId);
  const concept = run.concept || {};
  const inheritedContext = await buildSceneContext(run.project_id);
  const canvasFocus = formatCanvasSelectionForPrompt(run.context);

  await updateAgentRun(runId, {
    status: 'thinking',
    phase: 'production_plan',
    approval: undefined,
    error: undefined
  });
  await publishAgentEvent(runId, 'run.status', { status: 'thinking', phase: 'production_plan' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'shot-plan',
    label: feedback ? 'Revising the scene and shot plan' : 'Planning eight cinematic shots',
    phase: 'production_plan'
  });

  const prompt = [
    `User direction: ${run.prompt}`,
    `Approved concept:\n${JSON.stringify(concept, null, 2)}`,
    formatContextForPrompt(inheritedContext),
    canvasFocus,
    feedback ? `Revision request: ${feedback}` : ''
  ].filter(Boolean).join('\n\n');
  const plan = await generateJSON<Record<string, unknown>>(
    prompt,
    productionPlanSchema,
    `Create exactly three scenes for a ${run.settings.runtime_seconds}-second film. Scene frame counts must be 3, 2, and 3 respectively. Every frame is exactly 8 seconds. Use stable IDs scene-1, scene-2, scene-3. Make each detailed_plot explicit about character names, action, camera, environment, and continuity.`
  );
  const normalizedPlan = normalizeProductionPlan(plan);
  const approval = makeProductionPlanApproval(normalizedPlan);

  await updateAgentRun(runId, {
    status: 'awaiting_approval',
    production_plan: normalizedPlan,
    approval
  });
  await publishAgentEvent(runId, 'diff.created', {
    id: crypto.randomUUID(),
    title: feedback ? 'Revised production plan' : 'Proposed production plan',
    rows: (normalizedPlan.scenes as Array<Record<string, unknown>>).map((scene) => ({
      id: scene.id,
      label: scene.title,
      before: '',
      after: scene.concise_plot,
      change: 'added'
    }))
  });
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'shot-plan',
    label: 'Scene and shot plan ready',
    phase: 'production_plan'
  });
  await publishAgentEvent(runId, 'approval.requested', approval as unknown as Record<string, unknown>);
  await publishAgentEvent(runId, 'run.status', { status: 'awaiting_approval', phase: 'production_plan' });
  return { approval_id: approval.id, production_plan: normalizedPlan };
}

async function runProduction(runId: string) {
  let run = await requireActiveRun(runId);
  const concept = run.concept || {};
  const plan = run.production_plan || {};
  const plannedScenes = Array.isArray(plan.scenes) ? plan.scenes as Array<Record<string, unknown>> : [];
  if (!plannedScenes.length) throw new Error('Approved production plan is missing scenes');

  await updateAgentRun(runId, { status: 'running', phase: 'assets', approval: undefined, error: undefined });
  await publishAgentEvent(runId, 'run.status', { status: 'running', phase: 'assets' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'production-assets',
    label: 'Creating consistent character references',
    phase: 'assets'
  });

  let characters = await getCharactersByProject(run.project_id);
  const characterJobs: string[] = [];
  if (!characters.length) {
    const plannedCharacters = Array.isArray(concept.characters)
      ? concept.characters as Array<Record<string, unknown>>
      : [];
    for (const character of plannedCharacters) {
      const prompt = `${String(character.name || 'Character')}: ${String(character.description || '')}. Personality: ${String(character.personality || '')}. Backstory: ${String(character.backstory || '')}. Role: ${String(character.role || '')}.`;
      const child = makeChildJob(run, 'character-generation', 'assets', {
        prompt,
        type: 'characters',
        width: 1024,
        height: 1024,
        metadata: character
      });
      await addJob('character-generation', child);
      characterJobs.push(child.id);
    }
    await waitForJobs(runId, characterJobs, 20 * 60_000);
    characters = await getCharactersByProject(run.project_id);
  }
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'production-assets',
    label: `${characters.length} character references ready`,
    phase: 'assets'
  });

  run = await requireActiveRun(runId);
  await updateAgentRun(runId, { phase: 'scenes' });
  await publishAgentEvent(runId, 'run.status', { status: 'running', phase: 'scenes' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'production-scenes',
    label: 'Building approved scenes',
    phase: 'scenes'
  });
  const inheritedContext = await buildSceneContext(run.project_id);
  const attachedReferences = getAttachedReferences(run);
  const generationContext = { ...inheritedContext, references: attachedReferences };
  await updateAgentRun(runId, {
    context_summary: {
      project: {
        summary: inheritedContext.project_summary,
        plot: inheritedContext.plot
      },
      characters: inheritedContext.characters.map((character: any) => ({ id: character.id, name: character.name })),
      objects: inheritedContext.objects.map((object: any) => ({ id: object.id, type: object.type })),
      references: attachedReferences.map(reference => ({ id: reference.id, name: reference.name, mime_type: reference.mime_type }))
    }
  });
  await publishAgentEvent(runId, 'context.updated', {
    project: {
      summary: inheritedContext.project_summary,
      plot: inheritedContext.plot
    },
    characters: inheritedContext.characters.map((character: any) => ({ id: character.id, name: character.name, media_url: character.media_url })),
    objects: inheritedContext.objects.map((object: any) => ({ id: object.id, type: object.type, media_url: object.media_url })),
    references: attachedReferences.map(reference => ({ id: reference.id, name: reference.name, url: reference.url, mime_type: reference.mime_type })),
    inheritance: ['project summary', 'project plot', 'all characters', 'all objects']
  });

  const sceneJobs: string[] = [];
  for (const scene of plannedScenes) {
    const metadata = attachCharacterTokens(scene, inheritedContext.characters);
    const child = makeChildJob(run, 'scene-generation', 'scenes', {
      scene_description: String(scene.title || scene.concise_plot || 'Scene'),
      characters_context: '',
      plot_context: String((concept as any).story_direction || ''),
      scene_metadata: metadata,
      contextData: generationContext,
      target_frames: Number(scene.target_frames || 1),
      scene_order: Number(scene.scene_order || 0)
    });
    await addJob('scene-generation', child);
    sceneJobs.push(child.id);
  }
  await waitForJobs(runId, sceneJobs, 25 * 60_000);
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'production-scenes',
    label: `${plannedScenes.length} scenes created`,
    phase: 'scenes'
  });

  const expectedFrames = plannedScenes.reduce((sum, scene) => sum + Number(scene.target_frames || 0), 0);
  await updateAgentRun(runId, { phase: 'videos' });
  await publishAgentEvent(runId, 'run.status', { status: 'running', phase: 'videos' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'production-videos',
    label: `Rendering ${expectedFrames} eight-second clips`,
    phase: 'videos'
  });
  const frames = await waitForVideos(runId, run.project_id, expectedFrames, 45 * 60_000);
  await publishAgentEvent(runId, 'activity.completed', {
    id: 'production-videos',
    label: `${frames.length} clips ready for assembly`,
    phase: 'videos'
  });

  const approval = makeAssemblyApproval(run, frames.length);
  await updateAgentRun(runId, { status: 'awaiting_approval', phase: 'assembly', approval });
  await publishAgentEvent(runId, 'insight.created', {
    id: crypto.randomUUID(),
    title: 'Production ready',
    metrics: [
      { label: 'Scenes', value: plannedScenes.length },
      { label: 'Clips', value: frames.length },
      { label: 'Runtime', value: `${frames.length * 8}s` },
      { label: 'Audio', value: 'Generated' }
    ]
  });
  await publishAgentEvent(runId, 'approval.requested', approval as unknown as Record<string, unknown>);
  await publishAgentEvent(runId, 'run.status', { status: 'awaiting_approval', phase: 'assembly' });
  return { approval_id: approval.id, clips: frames.length };
}

async function assembleFilm(runId: string) {
  const run = await requireActiveRun(runId);
  const frames = await getFramesByProject(run.project_id);
  const scenes = await getScenesByProject(run.project_id);
  const sceneOrder = new Map(scenes.map((scene: any) => [scene.id, Number(scene.metadata?.scene_order || 0)]));
  const readyFrames = frames
    .filter((frame: any) => frame.video_url)
    .sort((a: any, b: any) => {
      const sceneDiff = (sceneOrder.get(a.scene_id || '') || 0) - (sceneOrder.get(b.scene_id || '') || 0);
      return sceneDiff || Number(a.metadata?.frame_order || 0) - Number(b.metadata?.frame_order || 0);
    });
  if (!readyFrames.length) throw new Error('No completed clips are available for assembly');

  await updateAgentRun(runId, { status: 'running', phase: 'assembly', approval: undefined, error: undefined });
  await publishAgentEvent(runId, 'run.status', { status: 'running', phase: 'assembly' });
  await publishAgentEvent(runId, 'activity.started', {
    id: 'final-assembly',
    label: 'Assembling the final film',
    phase: 'assembly'
  });

  const child = makeChildJob(run, 'video-stitching', 'assembly', {
    video_urls: readyFrames.map((frame: any) => frame.video_url),
    output_name: String((run.concept as any)?.title || 'final-film').replace(/\s+/g, '_').toLowerCase(),
    options: {}
  });
  await addJob('video-stitching', child);
  const [result] = await waitForJobs(runId, [child.id], 20 * 60_000);
  const videoUrl = String(result?.output_data?.video_url || '');

  await publishAgentEvent(runId, 'activity.completed', {
    id: 'final-assembly',
    label: 'Final film assembled',
    phase: 'assembly'
  });
  await publishAgentEvent(runId, 'insight.created', {
    id: crypto.randomUUID(),
    title: 'Your film is ready',
    metrics: [
      { label: 'Clips', value: readyFrames.length },
      { label: 'Runtime', value: `${readyFrames.length * 8}s` },
      { label: 'Format', value: run.settings.aspect_ratio }
    ],
    artifact_url: videoUrl
  });
  await publishAgentEvent(runId, 'recommendation.created', {
    id: crypto.randomUUID(),
    title: 'Refine the finished cut',
    description: 'Adjust the pacing while preserving the approved story and generated shots.',
    actions: [
      { id: 'revise-pacing', label: 'Revise pacing', kind: 'secondary' }
    ]
  });
  await updateAgentRun(runId, { status: 'completed', phase: 'assembly' });
  await publishAgentEvent(runId, 'run.completed', { video_url: videoUrl });
  await publishAgentEvent(runId, 'run.status', { status: 'completed', phase: 'assembly' });
  return { video_url: videoUrl };
}

function getAttachedReferences(run: AgentRun) {
  const attachments = Array.isArray(run.context?.attachments)
    ? run.context.attachments as Array<Record<string, unknown>>
    : [];
  return attachments
    .filter(attachment => typeof attachment.url === 'string' && attachment.url)
    .map(attachment => ({
      id: String(attachment.id || crypto.randomUUID()),
      name: String(attachment.name || 'Reference image'),
      url: String(attachment.url),
      mime_type: String(attachment.mime_type || 'image/*')
    }));
}

function makeConceptApproval(values: Record<string, unknown>): AgentApproval {
  return {
    id: crypto.randomUUID(),
    kind: 'concept',
    title: 'Approve the concept and cast',
    description: 'Confirm the creative direction before Stu3dio plans the shots.',
    status: 'pending',
    values,
    fields: [
      { id: 'title', label: 'Title', type: 'text', required: true },
      { id: 'story_direction', label: 'Story direction', type: 'textarea', required: true },
      { id: 'visual_style', label: 'Visual style', type: 'text', required: true },
      { id: 'audio_direction', label: 'Audio direction', type: 'text', required: true },
      { id: 'runtime_seconds', label: 'Runtime', type: 'single-select', options: [24, 64, 96] },
      { id: 'characters', label: 'Cast', type: 'summary-list' }
    ],
    created_at: new Date().toISOString()
  };
}

function makeProductionPlanApproval(plan: Record<string, unknown>): AgentApproval {
  return {
    id: crypto.randomUUID(),
    kind: 'production_plan',
    title: 'Approve the scene and shot plan',
    description: 'Media generation starts only after this plan is approved.',
    status: 'pending',
    values: plan,
    fields: [{ id: 'scenes', label: 'Scenes', type: 'scene-plan', required: true }],
    created_at: new Date().toISOString()
  };
}

function makeAssemblyApproval(run: AgentRun, clips: number): AgentApproval {
  return {
    id: crypto.randomUUID(),
    kind: 'assembly',
    title: 'Assemble the final film?',
    description: `${clips} clips are ready. Stu3dio will join them into a ${clips * 8}-second cut.`,
    status: 'pending',
    values: {
      clips,
      runtime_seconds: clips * 8,
      aspect_ratio: run.settings.aspect_ratio,
      audio: 'generated'
    },
    fields: [],
    created_at: new Date().toISOString()
  };
}

function normalizeProductionPlan(plan: Record<string, unknown>): Record<string, unknown> {
  const counts = [3, 2, 3];
  const raw = Array.isArray(plan.scenes) ? plan.scenes as Array<Record<string, unknown>> : [];
  const scenes = [0, 1, 2].map((index) => {
    const scene = raw[index] || {};
    const frameCount = counts[index] ?? 1;
    return {
      ...scene,
      id: `scene-${index + 1}`,
      scene_order: index + 1,
      title: String(scene.title || `Scene ${index + 1}`),
      detailed_plot: String(scene.detailed_plot || scene.concise_plot || `Scene ${index + 1}`),
      concise_plot: String(scene.concise_plot || scene.title || `Scene ${index + 1}`),
      dialogue: String(scene.dialogue || ''),
      target_frames: frameCount,
      duration: frameCount * 8
    };
  });
  return { overview: String(plan.overview || ''), scenes };
}

function attachCharacterTokens(
  scene: Record<string, unknown>,
  characters: Array<any>
): Record<string, unknown> {
  let detailed = String(scene.detailed_plot || scene.concise_plot || '');
  const referenced: string[] = [];
  for (const character of characters) {
    const token = `<|character_${character.id}|>`;
    const name = String(character.name || character.metadata?.name || '');
    if (name && detailed.toLowerCase().includes(name.toLowerCase())) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      detailed = detailed.replace(new RegExp(escaped, 'gi'), `${token} ${name}`);
      referenced.push(`${token} ${name}`);
    }
  }
  if (!referenced.length && characters.length) {
    referenced.push(...characters.map((character) => `<|character_${character.id}|> ${character.name || character.metadata?.name}`));
  }
  return {
    detailed_plot: `${detailed}\n\nReferenced cast: ${referenced.join(', ')}`,
    concise_plot: String(scene.concise_plot || scene.title || ''),
    dialogue: String(scene.dialogue || ''),
    scene_order: Number(scene.scene_order || 0),
    duration: Number(scene.duration || Number(scene.target_frames || 1) * 8)
  };
}

function makeChildJob(
  run: AgentRun,
  type: JobData['type'],
  phase: AgentRunPhase,
  inputData: Record<string, unknown>
): JobData {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    project_id: run.project_id,
    type,
    status: 'pending',
    progress: 0,
    input_data: inputData,
    output_data: {},
    created_at: timestamp,
    updated_at: timestamp,
    run_id: run.id,
    phase
  };
}

async function waitForJobs(runId: string, jobIds: string[], timeoutMs: number) {
  const started = Date.now();
  const results = new Map<string, any>();
  while (results.size < jobIds.length) {
    await requireActiveRun(runId);
    for (const jobId of jobIds) {
      if (results.has(jobId)) continue;
      const status = await getJobStatus(jobId);
      if (status?.status === 'failed') throw new Error(status.error_message || `Job ${jobId} failed`);
      if (status?.status === 'completed') results.set(jobId, status);
    }
    if (results.size === jobIds.length) break;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for production jobs');
    await delay(1_500);
  }
  return jobIds.map((id) => results.get(id));
}

async function waitForVideos(runId: string, projectId: string, expected: number, timeoutMs: number) {
  const started = Date.now();
  while (true) {
    const run = await requireActiveRun(runId);
    const failed = run.tasks.find((task) => task.status === 'failed' && ['frame-generation', 'video-generation'].includes(task.job_type || ''));
    if (failed) throw new Error(failed.detail || `${failed.label} failed`);
    const frames = await getFramesByProject(projectId);
    const completed = frames.filter((frame: any) => frame.video_url).length;
    await publishAgentEvent(runId, 'task.progress', {
      id: 'video-batch',
      label: 'Render video clips',
      phase: 'videos',
      status: completed >= expected ? 'completed' : 'running',
      progress: expected ? Math.min(100, Math.round((completed / expected) * 100)) : 0,
      completed,
      total: expected
    });
    if (frames.length >= expected && completed >= expected) return frames.filter((frame: any) => frame.video_url);
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for video generation');
    await delay(2_500);
  }
}

async function requireActiveRun(runId: string): Promise<AgentRun> {
  const run = await getAgentRun(runId);
  if (!run) throw new Error(`Agent run ${runId} not found`);
  if (run.status === 'cancelled') throw new Error('Agent run cancelled');
  return run;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleAgentWorkerFailure(job: BullJob | undefined, error: Error) {
  const runId = job?.data?.run_id;
  if (!runId) return;
  const run = await getAgentRun(runId);
  if (!run || run.status === 'cancelled') return;
  await updateAgentRun(runId, { status: 'failed', error: error.message });
  await publishAgentEvent(runId, 'run.failed', { message: error.message, retryable: true });
  await publishAgentEvent(runId, 'recommendation.created', {
    id: crypto.randomUUID(),
    title: 'Production needs attention',
    description: error.message,
    actions: [{ id: 'retry-run', label: 'Retry failed step', kind: 'primary' }]
  });
}
