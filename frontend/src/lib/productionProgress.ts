import type { AgentTask } from "@/types/agent";

/**
 * Production work arrives as one task per queued job. The rail shows it as a
 * handful of groups (cast, scenes, clips…) with a count and a bar each, rather
 * than a row per job, so progress reads at a glance and never as "100%" ×10.
 */

export type TaskGroupStatus = "queued" | "running" | "completed" | "failed";

export type TaskGroup = {
  id: string;
  label: string;
  unit: string;
  completed: number;
  total: number;
  /** 0–100, includes the fractional progress of running tasks. */
  progress: number;
  status: TaskGroupStatus;
  running?: AgentTask;
  failed: AgentTask[];
};

type GroupSpec = {
  id: string;
  label: string;
  unit: string;
  jobTypes: string[];
  phases: string[];
  doneVerb: string;
};

const GROUPS: GroupSpec[] = [
  {
    id: "cast",
    label: "Cast",
    unit: "references",
    jobTypes: ["character-generation"],
    phases: ["assets"],
    doneVerb: "ready",
  },
  {
    id: "objects",
    label: "Props",
    unit: "props",
    jobTypes: ["object-generation"],
    phases: [],
    doneVerb: "ready",
  },
  {
    id: "scenes",
    label: "Scenes",
    unit: "scenes",
    jobTypes: ["scene-generation"],
    phases: ["scenes"],
    doneVerb: "ready",
  },
  {
    id: "frames",
    label: "Key frames",
    unit: "frames",
    jobTypes: ["frame-generation"],
    phases: ["frames"],
    doneVerb: "rendered",
  },
  {
    id: "clips",
    label: "Clips",
    unit: "clips",
    jobTypes: ["video-generation"],
    phases: ["videos"],
    doneVerb: "rendered",
  },
  {
    id: "cut",
    label: "Final cut",
    unit: "cut",
    jobTypes: ["video-stitching"],
    phases: ["assembly"],
    doneVerb: "assembled",
  },
  {
    id: "revisions",
    label: "Revisions",
    unit: "revisions",
    jobTypes: ["image-editing"],
    phases: [],
    doneVerb: "applied",
  },
];

function specFor(task: AgentTask): GroupSpec | undefined {
  if (task.job_type) {
    const byJob = GROUPS.find((group) =>
      group.jobTypes.includes(task.job_type!),
    );
    if (byJob) return byJob;
  }
  return GROUPS.find((group) => group.phases.includes(task.phase));
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function groupProductionTasks(tasks: AgentTask[]): TaskGroup[] {
  const buckets = new Map<string, AgentTask[]>();
  for (const task of tasks) {
    const spec = specFor(task);
    if (!spec) continue;
    const bucket = buckets.get(spec.id) || [];
    bucket.push(task);
    buckets.set(spec.id, bucket);
  }

  return GROUPS.flatMap((spec) => {
    const bucket = buckets.get(spec.id);
    if (!bucket?.length) return [];
    // A batch task (e.g. the mock's "Render video clips") carries its own
    // completed/total; when present it is the count source, not one job of N.
    const batches = bucket.filter(
      (task) => typeof task.total === "number" && task.total > 0,
    );
    const jobs = bucket.filter((task) => !batches.includes(task));
    let completed: number;
    let total: number;
    let progress: number;
    if (batches.length) {
      total = Math.max(...batches.map((task) => task.total || 0));
      completed = Math.max(...batches.map((task) => task.completed || 0));
      const batchProgress = Math.max(
        ...batches.map((task) => task.progress || 0),
      );
      progress = clamp(Math.max((completed / total) * 100, batchProgress));
    } else {
      total = jobs.length;
      completed = jobs.filter((task) => task.status === "completed").length;
      const partial = jobs
        .filter((task) => task.status === "running")
        .reduce((sum, task) => sum + (task.progress || 0) / 100, 0);
      progress = total ? clamp(((completed + partial) / total) * 100) : 0;
    }
    if (total <= 0) return [];
    const failed = bucket.filter((task) => task.status === "failed");
    const running =
      jobs.find((task) => task.status === "running") ??
      batches.find((task) => task.status === "running");
    const status: TaskGroupStatus = failed.length
      ? "failed"
      : completed >= total
        ? "completed"
        : running || completed > 0
          ? "running"
          : "queued";
    return [
      {
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        completed,
        total,
        progress,
        status,
        running,
        failed,
      },
    ];
  });
}

export function summarizeProgress(
  groups: TaskGroup[],
  active: boolean,
): string {
  if (!groups.length) return active ? "Producing…" : "Production complete";
  const failedCount = groups.reduce(
    (sum, group) => sum + group.failed.length,
    0,
  );
  const suffix = failedCount ? ` · ${failedCount} failed` : "";
  if (active) {
    const current =
      groups.find((group) => group.status !== "completed") ??
      groups[groups.length - 1];
    return `${current.label} ${current.completed}/${current.total}${suffix}`;
  }
  const last = groups[groups.length - 1];
  const spec = GROUPS.find((group) => group.id === last.id)!;
  if (last.id === "cut") return `Final cut assembled${suffix}`;
  return `${last.completed} ${last.unit} ${spec.doneVerb}${suffix}`;
}

/** 152 → "2:32", 45 → "45s". */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function elapsedBetween(
  startedAt?: string,
  finishedAt?: string,
): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return formatDuration(ms / 1000);
}
