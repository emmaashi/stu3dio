import { Queue, QueueEvents, Job } from 'bullmq';
import { createClient } from 'redis';
import type { JobType, Job as JobData } from '../models/schemas';

let redisClient: ReturnType<typeof createClient>;
const queues: Map<JobType, Queue> = new Map();
const queueEvents: Map<JobType, QueueEvents> = new Map();

export async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
    }
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis error:', err);
  });

  redisClient.on('connect', () => {
    console.log('📡 Redis connected');
  });

  await redisClient.connect();
  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redisClient;
}

export const queueConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '0')
};

export function createQueues() {
  const connection = queueConnection;

  const jobTypes: JobType[] = [
    'agent-orchestration',
    'character-generation',
    'object-generation',
    'scene-generation',
    'frame-generation',
    'video-generation',
    'video-stitching',
    'script-generation',
    'image-editing'
  ];

  for (const jobType of jobTypes) {
    const queue = new Queue(jobType, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    const events = new QueueEvents(jobType, { connection });

    queues.set(jobType, queue);
    queueEvents.set(jobType, events);

    console.log(`🏭 Queue created: ${jobType}`);
  }

  return { queues, queueEvents };
}

export function getQueue(jobType: JobType): Queue {
  const queue = queues.get(jobType);
  if (!queue) {
    throw new Error(`Queue not found for job type: ${jobType}`);
  }
  return queue;
}

export function getQueueEvents(jobType: JobType): QueueEvents {
  const events = queueEvents.get(jobType);
  if (!events) {
    throw new Error(`Queue events not found for job type: ${jobType}`);
  }
  return events;
}

export async function addJob(jobType: JobType, jobData: JobData): Promise<Job> {
  const queue = getQueue(jobType);

  const job = await queue.add(jobType, jobData, {
    jobId: jobData.id,
    priority: getJobPriority(jobType),
  });

  console.log(`➕ Added job: ${jobType} (${job.id})`);
  if (jobData.run_id) {
    const { linkJobToAgentRun, publishAgentEvent, upsertAgentTask } = await import('./agentRuns.js');
    const phase = jobData.phase || 'assets';
    const label = friendlyJobLabel(jobType, jobData.input_data);
    await linkJobToAgentRun(jobData.id, {
      run_id: jobData.run_id,
      phase,
      job_type: jobType,
      label
    });
    await upsertAgentTask(jobData.run_id, {
      id: jobData.id,
      label,
      phase: phase as any,
      job_type: jobType,
      status: 'queued',
      progress: 0
    });
    await publishAgentEvent(jobData.run_id, 'task.created', {
      id: jobData.id,
      label,
      phase,
      job_type: jobType,
      status: 'queued',
      progress: 0
    });
  }
  await updateJobStatus(jobData.id, 'pending', 0);

  return job;
}

export async function updateJobStatus(
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  progress: number,
  outputData?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  const redis = getRedisClient();
  const key = `job:${jobId}:status`;

  console.log(`Updating job ${jobId} status to ${status} with outputData keys:`, outputData ? Object.keys(outputData) : 'none');

  const statusData = {
    status,
    progress,
    updated_at: new Date().toISOString(),
    ...(outputData && { output_data: JSON.stringify(outputData) }),
    ...(errorMessage && { error_message: errorMessage })
  };

  console.log(`Status data keys being written to Redis:`, Object.keys(statusData));

  await redis.hSet(key, statusData);
  console.log(`Job ${jobId}: ${status} (${progress}%)`);

  const { getLinkedAgentJob, publishAgentEvent, upsertAgentTask, appendAgentArtifact } = await import('./agentRuns.js');
  const linked = await getLinkedAgentJob(jobId);
  if (linked) {
    const taskStatus = status === 'pending'
      ? 'queued'
      : status === 'processing'
        ? 'running'
        : status;
    await upsertAgentTask(linked.run_id, {
      id: jobId,
      label: linked.label,
      phase: linked.phase as any,
      job_type: linked.job_type,
      status: taskStatus as any,
      progress,
      ...(errorMessage ? { detail: errorMessage } : {}),
      ...(outputData ? { output: outputData } : {})
    });
    await publishAgentEvent(linked.run_id, status === 'failed' ? 'task.failed' : status === 'completed' ? 'task.completed' : 'task.progress', {
      id: jobId,
      label: linked.label,
      phase: linked.phase,
      job_type: linked.job_type,
      status: taskStatus,
      progress,
      ...(errorMessage ? { detail: errorMessage } : {})
    });

    if (status === 'completed' && outputData) {
      const artifact = artifactFromOutput(jobId, linked.job_type, outputData);
      if (artifact) {
        await appendAgentArtifact(linked.run_id, artifact);
        await publishAgentEvent(linked.run_id, 'artifact.created', artifact);
      }
    }
  }
}

export async function getJobStatus(jobId: string) {
  const redis = getRedisClient();
  const key = `job:${jobId}:status`;

  console.log(`🔍 [DEBUG] Getting job status for: ${jobId}`);
  const status = await redis.hGetAll(key);
  console.log(`🔍 [DEBUG] Raw Redis data keys for ${jobId}:`, Object.keys(status));

  if (!status.status) {
    console.log(`🔍 [DEBUG] No status found for job: ${jobId}`);
    return null;
  }

  let output_data = undefined;
  if (status.output_data) {
    console.log(`🔍 [DEBUG] Raw output_data string length:`, status.output_data.length);
    try {
      output_data = JSON.parse(status.output_data);
      console.log('✅ Successfully parsed output_data, keys:', Object.keys(output_data));
    } catch (error) {
      console.error('❌ Failed to parse output_data:', error);
      console.error('Raw output_data length:', status.output_data.length);
    }
  } else {
    console.log(`🔍 [DEBUG] No output_data field found in Redis for job ${jobId}`);
  }

  const result = {
    status: status.status,
    progress: parseInt(status.progress || '0'),
    updated_at: status.updated_at,
    output_data,
    error_message: status.error_message || undefined
  };

  console.log('🔍 [DEBUG] Final result keys:', result ? Object.keys(result) : 'none');
  return result;
}

export async function cancelJob(jobType: JobType, jobId: string): Promise<void> {
  const queue = getQueue(jobType);
  const job = await queue.getJob(jobId);

  if (job) {
    await job.remove();
    await updateJobStatus(jobId, 'failed', 0, undefined, 'Job cancelled');
    console.log(`❌ Cancelled job: ${jobId}`);
  }
}

export async function getQueueInfo(jobType: JobType) {
  const queue = getQueue(jobType);
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed()
  ]);

  return {
    jobType,
    counts: {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    }
  };
}

export function setupJobEventListeners() {
  console.log('🔧 [QUEUE] Setting up event listeners for queues:', Array.from(queueEvents.keys()));
  
  for (const [jobType, events] of queueEvents.entries()) {
    console.log(`🔧 [QUEUE] Setting up listener for: ${jobType}`);
    
    events.on('completed', async ({ jobId, returnvalue }) => {
      console.log(`🚨 [QUEUE EVENT] ========================================`);
      console.log(`🎉 [QUEUE EVENT] Job completed: ${jobType} (${jobId})`);
      console.log('🔍 [QUEUE EVENT] Return value type:', typeof returnvalue);
      if (returnvalue && typeof returnvalue === 'object') {
        console.log('🔍 [QUEUE EVENT] Return value keys:', Object.keys(returnvalue));
      } else {
        console.log('🔍 [QUEUE EVENT] Return value (non-object):', typeof returnvalue === 'string' ? `string(${returnvalue.length} chars)` : typeof returnvalue);
      }

      let outputData: Record<string, unknown>;
      if (typeof returnvalue === 'string') {
        outputData = { result: returnvalue };
        console.log('🔍 [QUEUE] Processed as string result');
      } else if (returnvalue && typeof returnvalue === 'object') {
        outputData = returnvalue as Record<string, unknown>;
        console.log('🔍 [QUEUE] Processed as object, keys:', Object.keys(outputData));
      } else {
        console.log('⚠️  [QUEUE] Warning: returnvalue is null, undefined, or unexpected type');
        console.log('🔍 [QUEUE] Returnvalue type:', typeof returnvalue, 'is null:', returnvalue === null, 'is undefined:', returnvalue === undefined);
        outputData = { raw_return: returnvalue, debug_info: 'returnvalue_was_falsy_or_unexpected' };
      }

      console.log('🔍 [QUEUE EVENT] Final processed output data keys:', Object.keys(outputData));
      await updateJobStatus(jobId, 'completed', 100, outputData);
      console.log(`🚨 [QUEUE EVENT] Event handler completed for ${jobType} (${jobId})`);
      console.log(`🚨 [QUEUE EVENT] ========================================`);
    });

    events.on('failed', ({ jobId, failedReason }) => {
      console.log(`❌ Job failed: ${jobType} (${jobId}) - ${failedReason}`);
      updateJobStatus(jobId, 'failed', 0, undefined, failedReason);
    });

    events.on('progress', ({ jobId, data }) => {
      const progress = typeof data === 'number' ? data : (data && typeof data === 'object' && 'progress' in data) ? Number(data.progress) || 0 : 0;
      console.log(`⏳ Job progress: ${jobType} (${jobId}) - ${progress}%`);
      updateJobStatus(jobId, 'processing', progress);
    });
  }
}

function getJobPriority(jobType: JobType): number {
  const priorities: Record<JobType, number> = {
    'agent-orchestration': 1,
    'character-generation': 1,
    'object-analysis': 2,
    'object-generation': 3,
    'scene-generation': 4,
    'frame-analysis': 5,
    'frame-generation': 6,
    'image-editing': 7,
    'video-generation': 8,
    'video-stitching': 9,
    'script-generation': 10
  };

  return priorities[jobType];
}

function friendlyJobLabel(jobType: JobType, input: Record<string, unknown>): string {
  const labels: Record<JobType, string> = {
    'agent-orchestration': 'Coordinate production',
    'character-generation': `Design ${String(input?.prompt || 'character').split(':')[0]}`,
    'object-analysis': 'Identify story objects',
    'object-generation': 'Create object reference',
    'scene-generation': `Build ${String(input?.scene_description || 'scene')}`,
    'frame-analysis': 'Plan cinematic shots',
    'frame-generation': 'Render key frame',
    'image-editing': 'Apply visual revision',
    'video-generation': 'Generate 8-second clip',
    'video-stitching': 'Assemble final film',
    'script-generation': 'Develop production script'
  };
  return labels[jobType];
}

function artifactFromOutput(
  jobId: string,
  jobType: string,
  output: Record<string, unknown>
): Record<string, unknown> | null {
  const url = output.video_url || output.image_url;
  const entityId = output.character_id || output.scene_id || output.frame_id || jobId;
  if (!url && !output.character_id && !output.scene_id && !output.frame_id) return null;
  return {
    id: String(entityId),
    job_id: jobId,
    kind: jobType,
    title: friendlyJobLabel(jobType as JobType, {}),
    ...(url ? { url } : {}),
    created_at: new Date().toISOString()
  };
}
