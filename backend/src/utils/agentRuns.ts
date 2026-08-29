import type { AgentEvent, AgentRun, AgentTask } from '../models/agent.js';
import { getRedisClient } from './queue.js';

const TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_EVENTS = 2_000;

const snapshotKey = (runId: string) => `agent-run:${runId}:snapshot`;
const eventsKey = (runId: string) => `agent-run:${runId}:events`;
const sequenceKey = (runId: string) => `agent-run:${runId}:sequence`;
export const agentRunChannel = (runId: string) => `agent-run:${runId}:events:live`;

export async function createAgentRun(run: AgentRun): Promise<AgentRun> {
  const redis = getRedisClient();
  await redis.set(snapshotKey(run.id), JSON.stringify(run), { EX: TTL_SECONDS });
  await redis.set(sequenceKey(run.id), '0', { EX: TTL_SECONDS });
  return run;
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  const raw = await getRedisClient().get(snapshotKey(runId));
  return raw ? JSON.parse(raw) as AgentRun : null;
}

export async function updateAgentRun(
  runId: string,
  patch: Partial<AgentRun> | ((current: AgentRun) => Partial<AgentRun>)
): Promise<AgentRun> {
  const redis = getRedisClient();
  const current = await getAgentRun(runId);
  if (!current) throw new Error(`Agent run ${runId} not found`);
  const resolved = typeof patch === 'function' ? patch(current) : patch;
  const next: AgentRun = {
    ...current,
    ...resolved,
    updated_at: new Date().toISOString()
  };
  await redis.set(snapshotKey(runId), JSON.stringify(next), { EX: TTL_SECONDS });
  return next;
}

export async function publishAgentEvent(
  runId: string,
  type: string,
  data: Record<string, unknown> = {}
): Promise<AgentEvent> {
  const redis = getRedisClient();
  const id = await redis.incr(sequenceKey(runId));
  const event: AgentEvent = {
    id,
    run_id: runId,
    type,
    timestamp: new Date().toISOString(),
    data
  };
  const serialized = JSON.stringify(event);

  await redis.multi()
    .rPush(eventsKey(runId), serialized)
    .lTrim(eventsKey(runId), -MAX_EVENTS, -1)
    .expire(eventsKey(runId), TTL_SECONDS)
    .expire(sequenceKey(runId), TTL_SECONDS)
    .publish(agentRunChannel(runId), serialized)
    .exec();

  const run = await getAgentRun(runId);
  if (run) {
    await redis.set(
      snapshotKey(runId),
      JSON.stringify({ ...run, last_event_id: id, updated_at: event.timestamp }),
      { EX: TTL_SECONDS }
    );
  }
  return event;
}

export async function getAgentEvents(runId: string, afterId = 0): Promise<AgentEvent[]> {
  const rows = await getRedisClient().lRange(eventsKey(runId), 0, -1);
  return rows
    .map((row) => JSON.parse(row) as AgentEvent)
    .filter((event) => event.id > afterId);
}

export async function upsertAgentTask(runId: string, task: AgentTask): Promise<AgentRun> {
  return updateAgentRun(runId, (run) => {
    const tasks = [...run.tasks];
    const index = tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) tasks[index] = { ...tasks[index], ...task };
    else tasks.push(task);
    return { tasks };
  });
}

export async function appendAgentArtifact(
  runId: string,
  artifact: Record<string, unknown>
): Promise<AgentRun> {
  return updateAgentRun(runId, (run) => ({
    artifacts: [...run.artifacts.filter((item) => item.id !== artifact.id), artifact]
  }));
}

export async function linkJobToAgentRun(
  jobId: string,
  metadata: { run_id: string; phase: string; job_type: string; label: string }
): Promise<void> {
  await getRedisClient().set(`agent-job:${jobId}`, JSON.stringify(metadata), { EX: TTL_SECONDS });
}

export async function getLinkedAgentJob(jobId: string): Promise<{
  run_id: string;
  phase: string;
  job_type: string;
  label: string;
} | null> {
  const value = await getRedisClient().get(`agent-job:${jobId}`);
  return value ? JSON.parse(value) : null;
}
