import type { AgentEvent, AgentRun } from "@/types/agent";

export const agentRunFixture: AgentRun = {
  id: "11111111-1111-4111-8111-111111111111",
  project_id: "22222222-2222-4222-8222-222222222222",
  kind: "create-film",
  prompt: "A quiet science-fiction mystery",
  status: "awaiting_approval",
  phase: "concept",
  settings: { runtime_seconds: 64, aspect_ratio: "16:9", shot_seconds: 8 },
  context: {},
  concept: { title: "Signal", story_direction: "A scientist hears a message from her future self." },
  approval: {
    id: "33333333-3333-4333-8333-333333333333",
    kind: "concept",
    title: "Approve the concept and cast",
    description: "Confirm the creative direction.",
    status: "pending",
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "runtime_seconds", label: "Runtime", type: "single-select", options: [24, 64, 96] },
    ],
    values: { title: "Signal", runtime_seconds: 64 },
    created_at: "2026-08-28T12:00:00.000Z",
  },
  tasks: [],
  artifacts: [],
  assistant_text: "I shaped the idea into a focused short.",
  created_at: "2026-08-28T12:00:00.000Z",
  updated_at: "2026-08-28T12:00:02.000Z",
  last_event_id: 0,
};

export function eventFixture(id: number, type: string, data: Record<string, unknown>): AgentEvent {
  return { id, run_id: agentRunFixture.id, type, data, timestamp: `2026-08-28T12:00:0${id}.000Z` };
}
