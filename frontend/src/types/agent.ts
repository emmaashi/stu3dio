export type AgentRunKind =
  | "create-film"
  | "regenerate"
  | "enhance"
  | "create-character"
  | "create-object"
  | "plan-scenes"
  | "generate-frames"
  | "generate-videos"
  | "assemble-film";

export type AgentRunStatus =
  | "queued"
  | "thinking"
  | "awaiting_approval"
  | "running"
  | "blocked"
  | "failed"
  | "cancelled"
  | "completed";

export type AgentRunPhase =
  | "concept"
  | "production_plan"
  | "assets"
  | "scenes"
  | "frames"
  | "videos"
  | "assembly";

export type AgentApprovalField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "single-select" | "multi-select" | "number" | "summary-list" | "scene-plan";
  required?: boolean;
  options?: Array<string | number>;
};

export type AgentApproval = {
  id: string;
  kind: "concept" | "production_plan" | "assembly";
  title: string;
  description: string;
  status: "pending" | "approved" | "revision_requested" | "cancelled";
  fields: AgentApprovalField[];
  values: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
};

export type AgentTask = {
  id: string;
  label: string;
  phase: AgentRunPhase;
  job_type?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
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
    aspect_ratio: "16:9" | "9:16" | "1:1";
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

export type AgentAttachment = {
  id: string;
  name: string;
  url: string;
  mime_type: string;
  size: number;
};

export type AgentActivity = {
  id: string;
  label: string;
  phase?: AgentRunPhase;
  status: "running" | "completed" | "failed";
};

export type AgentBlock =
  | { id: string; type: "loading"; label: string; startedAt: string }
  | { id: string; type: "thinking"; label: string; activities: AgentActivity[]; active: boolean }
  | { id: string; type: "streaming-message"; role: "user" | "assistant"; content: string; status: "streaming" | "completed" | "interrupted" }
  | { id: string; type: "approval"; approval: AgentApproval }
  | { id: string; type: "tool-group"; tools: AgentTask[] }
  | { id: string; type: "task-group"; tasks: AgentTask[] }
  | { id: string; type: "recommendation"; data: Record<string, unknown> }
  | { id: string; type: "context"; data: Record<string, unknown> }
  | { id: string; type: "diff"; data: Record<string, unknown> }
  | { id: string; type: "insight"; data: Record<string, unknown> }
  | { id: string; type: "artifact"; data: Record<string, unknown> }
  | { id: string; type: "error"; message: string; retryable: boolean };
