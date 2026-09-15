import { API_BASE_URL, fetchApi } from "@/utils/api";
import { isMockEnabled, subscribeMockAgentRun } from "@/films/mockBackend";
import type { AgentAttachment, AgentEvent, AgentRun, AgentRunKind } from "@/types/agent";

const EVENT_TYPES = [
  "run.status",
  "message.started",
  "message.delta",
  "message.completed",
  "activity.started",
  "activity.updated",
  "activity.completed",
  "activity.failed",
  "approval.requested",
  "approval.resolved",
  "task.created",
  "task.progress",
  "task.completed",
  "task.failed",
  "artifact.created",
  "artifact.updated",
  "context.updated",
  "recommendation.created",
  "diff.created",
  "insight.created",
  "run.failed",
  "run.cancelled",
  "run.completed"
] as const;

export const agentApi = {
  uploadAttachment(projectId: string, file: File): Promise<AgentAttachment> {
    const form = new FormData();
    form.append("file", file);
    return fetchApi(`/api/projects/${projectId}/agent-attachments`, { method: "POST", body: form });
  },

  create(projectId: string, data: {
    prompt: string;
    kind?: AgentRunKind;
    context?: Record<string, unknown>;
    settings?: { runtime_seconds?: number; aspect_ratio?: "16:9" | "9:16" | "1:1"; shot_seconds?: 8 };
  }): Promise<AgentRun> {
    return fetchApi(`/api/projects/${projectId}/agent-runs`, {
      method: "POST",
      body: JSON.stringify({ kind: "create-film", ...data })
    });
  },

  get(runId: string): Promise<AgentRun> {
    return fetchApi(`/api/agent-runs/${runId}`);
  },

  resolveApproval(
    runId: string,
    approvalId: string,
    data: {
      decision: "approve" | "revise" | "cancel";
      values?: Record<string, unknown>;
      feedback?: string;
      idempotency_key?: string;
    }
  ): Promise<AgentRun> {
    return fetchApi(`/api/agent-runs/${runId}/approvals/${approvalId}`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  cancel(runId: string): Promise<AgentRun> {
    return fetchApi(`/api/agent-runs/${runId}/cancel`, { method: "POST", body: "{}" });
  },

  subscribe(
    runId: string,
    afterId: number,
    callbacks: {
      onEvent: (event: AgentEvent) => void;
      onOpen?: () => void;
      onError?: (message: string) => void;
    }
  ): () => void {
    if (isMockEnabled()) return subscribeMockAgentRun(runId, afterId, callbacks);
    const source = new EventSource(`${API_BASE_URL}/api/agent-runs/${runId}/events?after=${afterId}`);
    const receive = (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data) as AgentEvent;
        if (event?.id) callbacks.onEvent(event);
      } catch {
        callbacks.onError?.("Received an invalid orchestration event");
      }
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, receive as EventListener);
    source.addEventListener("connected", () => callbacks.onOpen?.());
    source.onerror = () => callbacks.onError?.("Reconnecting to the production run…");
    return () => source.close();
  }
};
