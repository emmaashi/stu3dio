import { create } from "zustand";
import type { AgentEvent, AgentRun } from "@/types/agent";

type AgentRunState = {
  run: AgentRun | null;
  events: AgentEvent[];
  seenEventIds: Record<number, true>;
  connected: boolean;
  connectionError: string | null;
  hydrate: (run: AgentRun, events?: AgentEvent[]) => void;
  applyEvent: (event: AgentEvent) => void;
  setConnected: (connected: boolean, error?: string | null) => void;
  reset: () => void;
};

export const useAgentRunStore = create<AgentRunState>((set) => ({
  run: null,
  events: [],
  seenEventIds: {},
  connected: false,
  connectionError: null,
  hydrate: (run, events = []) => set({
    run,
    events: [...events].sort((a, b) => a.id - b.id),
    seenEventIds: Object.fromEntries(events.map((event) => [event.id, true])) as Record<number, true>,
    connectionError: null
  }),
  applyEvent: (event) => set((state) => {
    if (state.seenEventIds[event.id]) return state;
    const nextRun = reduceSnapshot(state.run, event);
    return {
      ...state,
      run: nextRun,
      events: [...state.events, event].sort((a, b) => a.id - b.id),
      seenEventIds: { ...state.seenEventIds, [event.id]: true }
    };
  }),
  setConnected: (connected, error = null) => set({ connected, connectionError: error }),
  reset: () => set({ run: null, events: [], seenEventIds: {}, connected: false, connectionError: null })
}));

function reduceSnapshot(run: AgentRun | null, event: AgentEvent): AgentRun | null {
  if (!run) return run;
  const next: AgentRun = { ...run, last_event_id: Math.max(run.last_event_id, event.id), updated_at: event.timestamp };
  if (event.type === "run.status") {
    if (event.data.status) next.status = event.data.status as AgentRun["status"];
    if (event.data.phase) next.phase = event.data.phase as AgentRun["phase"];
  }
  if (event.type === "message.delta" && event.data.role === "assistant") {
    next.assistant_text = `${next.assistant_text || ""}${String(event.data.delta || "")}`;
  }
  if (event.type === "approval.requested") {
    next.approval = event.data as unknown as AgentRun["approval"];
    next.status = "awaiting_approval";
  }
  if (event.type === "approval.resolved" && next.approval && next.approval.id === event.data.id) {
    const approval = next.approval;
    next.approval = { ...approval, status: event.data.decision === "approve" ? "approved" : event.data.decision === "revise" ? "revision_requested" : "cancelled" };
  }
  if (event.type.startsWith("task.")) {
    const task = event.data as unknown as AgentRun["tasks"][number];
    if (task.id) {
      const tasks = [...next.tasks];
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index >= 0) tasks[index] = { ...tasks[index], ...task };
      else tasks.push(task);
      next.tasks = tasks;
    }
  }
  if (event.type === "artifact.created") {
    next.artifacts = [...next.artifacts.filter((item) => item.id !== event.data.id), event.data];
  }
  if (event.type === "run.failed") {
    next.status = "failed";
    next.error = String(event.data.message || "The run failed");
  }
  if (event.type === "run.cancelled") next.status = "cancelled";
  if (event.type === "run.completed") next.status = "completed";
  return next;
}
