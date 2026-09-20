import type { AgentActivity, AgentBlock, AgentEvent, AgentRun, AgentTask } from "@/types/agent";
import { groupProductionTasks } from "./productionProgress";

export function buildAgentBlocks(run: AgentRun | null, events: AgentEvent[]): AgentBlock[] {
  if (!run) return [];
  const blocks: AgentBlock[] = [];
  const messages = new Map<string, { role: "user" | "assistant"; content: string; completed: boolean }>();
  const activities = new Map<string, AgentActivity>();
  const special: AgentBlock[] = [];
  const syntheticTasks = new Map<string, AgentTask>();
  const resolvedApprovalIds = new Set<string>();
  let firstTaskAt: string | undefined;
  let lastTaskAt: string | undefined;

  for (const event of events) {
    if (event.type.startsWith("task.")) {
      firstTaskAt ??= event.timestamp;
      lastTaskAt = event.timestamp;
    }
    if (event.type === "message.started") {
      messages.set(String(event.data.id), { role: (event.data.role as "user" | "assistant") || "assistant", content: "", completed: false });
    } else if (event.type === "message.delta") {
      const id = String(event.data.id);
      const current = messages.get(id) || { role: "assistant" as const, content: "", completed: false };
      messages.set(id, { ...current, content: current.content + String(event.data.delta || "") });
    } else if (event.type === "message.completed") {
      const id = String(event.data.id);
      const current = messages.get(id);
      messages.set(id, {
        role: (event.data.role as "user" | "assistant") || current?.role || "assistant",
        content: String(event.data.content || current?.content || ""),
        completed: true
      });
    } else if (event.type.startsWith("activity.")) {
      const status = event.type.endsWith("completed") ? "completed" : event.type.endsWith("failed") ? "failed" : "running";
      activities.set(String(event.data.id), {
        id: String(event.data.id),
        label: String(event.data.label || "Working"),
        phase: event.data.phase as AgentActivity["phase"],
        status
      });
    } else if (event.type === "context.updated") {
      special.push({ id: `context-${event.id}`, type: "context", data: event.data });
    } else if (event.type === "diff.created") {
      special.push({ id: `diff-${event.id}`, type: "diff", data: event.data });
    } else if (event.type === "recommendation.created") {
      const actions = Array.isArray(event.data.actions) ? event.data.actions as Array<Record<string, unknown>> : [];
      const visibleActions = actions.filter((action) => String(action.id) !== "play-film");
      const isPlaybackOnly = actions.length > 0 && visibleActions.length === 0;
      if (!isPlaybackOnly) {
        special.push({
          id: `recommendation-${event.id}`,
          type: "recommendation",
          data: { ...event.data, actions: visibleActions }
        });
      }
    } else if (event.type === "insight.created") {
      // One milestone slot: a later insight replaces the earlier one, and an
      // insight that carries the finished film becomes the film card.
      const previousInsight = special.findIndex((block) => block.type === "insight" || block.type === "film-ready");
      if (previousInsight >= 0) special.splice(previousInsight, 1);
      const hasFilm = typeof event.data.artifact_url === "string" && event.data.artifact_url.trim().length > 0;
      special.push({ id: `insight-${event.id}`, type: hasFilm ? "film-ready" : "insight", data: event.data });
    } else if (event.type === "task.progress" && event.data.id === "video-batch") {
      syntheticTasks.set("video-batch", event.data as AgentTask);
    } else if (event.type === "approval.resolved") {
      resolvedApprovalIds.add(String(event.data.id));
    }
  }

  for (const [id, message] of messages) {
    if (!message.content) continue;
    blocks.push({
      id: `message-${id}`,
      type: "streaming-message",
      role: message.role,
      content: message.content,
      status: message.completed ? "completed" : "streaming"
    });
  }
  if (![...messages.values()].some((message) => message.role === "user") && run.prompt) {
    blocks.unshift({ id: "message-run-prompt", type: "streaming-message", role: "user", content: run.prompt, status: "completed" });
  }

  if (run.status === "queued" && !run.assistant_text) {
    blocks.push({ id: "run-loading", type: "loading", label: phaseLabel(run.phase), startedAt: run.updated_at || run.created_at });
  }
  if (activities.size) {
    blocks.push({
      id: "run-thinking",
      type: "thinking",
      label: run.status === "awaiting_approval" ? "Plan prepared" : phaseLabel(run.phase),
      activities: [...activities.values()],
      active: ["queued", "thinking", "running"].includes(run.status)
    });
  }

  const tasks = mergeTasks(run.tasks, [...syntheticTasks.values()]);
  const groups = groupProductionTasks(tasks);
  if (groups.length) {
    const active = ["queued", "thinking", "running"].includes(run.status);
    blocks.push({
      id: "run-progress",
      type: "progress",
      groups,
      active,
      startedAt: firstTaskAt,
      finishedAt: active ? undefined : lastTaskAt
    });
  }
  blocks.push(...special);
  // The film card already offers playback; don't list the same video again.
  const filmReady = special.find((block) => block.type === "film-ready");
  const filmUrl = filmReady?.type === "film-ready" ? String(filmReady.data.artifact_url) : null;
  for (const artifact of run.artifacts) {
    const artifactUrl = String(artifact.url || artifact.video_url || "");
    if (filmUrl && artifactUrl && artifactUrl === filmUrl) continue;
    blocks.push({ id: `artifact-${String(artifact.id)}`, type: "artifact", data: artifact });
  }
  if (run.approval?.status === "pending" && !resolvedApprovalIds.has(run.approval.id)) {
    blocks.push({ id: `approval-${run.approval.id}`, type: "approval", approval: run.approval });
  }
  if (run.error) blocks.push({ id: "run-error", type: "error", message: run.error, retryable: true });
  return blocks;
}

function mergeTasks(tasks: AgentTask[], synthetic: AgentTask[]) {
  const map = new Map(tasks.map((task) => [task.id, task]));
  for (const task of synthetic) map.set(task.id, { ...map.get(task.id), ...task } as AgentTask);
  return [...map.values()];
}

function phaseLabel(phase: AgentRun["phase"]) {
  return ({
    concept: "Shaping the concept",
    production_plan: "Planning scenes and shots",
    assets: "Creating character references",
    scenes: "Building scenes",
    frames: "Rendering key frames",
    videos: "Generating video clips",
    assembly: "Assembling the final film"
  } as const)[phase];
}
