import { z } from 'zod';

export const AgentRunKindSchema = z.enum([
  'create-film',
  'regenerate',
  'enhance',
  'create-character',
  'create-object',
  'plan-scenes',
  'generate-frames',
  'generate-videos',
  'assemble-film'
]);

export const AgentRunStatusSchema = z.enum([
  'queued',
  'thinking',
  'awaiting_approval',
  'running',
  'blocked',
  'failed',
  'cancelled',
  'completed'
]);

export const AgentRunPhaseSchema = z.enum([
  'concept',
  'production_plan',
  'assets',
  'scenes',
  'frames',
  'videos',
  'assembly'
]);

export const AgentApprovalDecisionSchema = z.enum(['approve', 'revise', 'cancel']);

export const CreateAgentRunSchema = z.object({
  kind: AgentRunKindSchema.default('create-film'),
  prompt: z.string().min(1).max(20_000),
  context: z.record(z.string(), z.unknown()).optional().default({}),
  settings: z.object({
    runtime_seconds: z.number().int().min(24).max(96).default(64),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
    shot_seconds: z.literal(8).default(8)
  }).optional().default({
    runtime_seconds: 64,
    aspect_ratio: '16:9',
    shot_seconds: 8
  })
});

export const ResolveAgentApprovalSchema = z.object({
  decision: AgentApprovalDecisionSchema,
  values: z.record(z.string(), z.unknown()).optional().default({}),
  feedback: z.string().max(10_000).optional(),
  idempotency_key: z.string().min(1).max(200).optional()
});

export type AgentRunKind = z.infer<typeof AgentRunKindSchema>;
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type AgentRunPhase = z.infer<typeof AgentRunPhaseSchema>;
export type AgentApprovalDecision = z.infer<typeof AgentApprovalDecisionSchema>;

export type AgentApproval = {
  id: string;
  kind: 'concept' | 'production_plan' | 'assembly';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'revision_requested' | 'cancelled';
  fields: Array<Record<string, unknown>>;
  values: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
  idempotency_key?: string;
};

export type AgentTask = {
  id: string;
  label: string;
  phase: AgentRunPhase;
  job_type?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  detail?: string;
  output?: Record<string, unknown>;
};

export type AgentRun = {
  id: string;
  project_id: string;
  kind: AgentRunKind;
  prompt: string;
  status: AgentRunStatus;
  phase: AgentRunPhase;
  settings: {
    runtime_seconds: number;
    aspect_ratio: '16:9' | '9:16' | '1:1';
    shot_seconds: 8;
  };
  context: Record<string, unknown>;
  context_summary?: Record<string, unknown>;
  concept?: Record<string, unknown>;
  production_plan?: Record<string, unknown>;
  approval?: AgentApproval;
  tasks: AgentTask[];
  artifacts: Array<Record<string, unknown>>;
  assistant_text: string;
  error?: string;
  created_at: string;
  updated_at: string;
  last_event_id: number;
};

export type AgentEvent = {
  id: number;
  run_id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};
