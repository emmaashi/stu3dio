import { describe, expect, it } from "vitest";
import {
  elapsedBetween,
  formatDuration,
  groupProductionTasks,
  summarizeProgress,
} from "@/lib/productionProgress";
import type { AgentTask } from "@/types/agent";

const task = (overrides: Partial<AgentTask> & { id: string }): AgentTask => ({
  label: overrides.id,
  phase: "assets",
  status: "completed",
  progress: 100,
  ...overrides,
});

describe("production progress grouping", () => {
  it("groups jobs by job_type, falling back to phase, and drops orchestration", () => {
    const groups = groupProductionTasks([
      task({ id: "a", job_type: "character-generation" }),
      task({
        id: "b",
        job_type: "character-generation",
        status: "running",
        progress: 50,
      }),
      task({ id: "c", phase: "videos" }),
      task({ id: "d", job_type: "agent-orchestration", phase: "concept" }),
    ]);
    expect(
      groups.map((group) => [
        group.id,
        group.completed,
        group.total,
        group.status,
      ]),
    ).toEqual([
      ["cast", 1, 2, "running"],
      ["clips", 1, 1, "completed"],
    ]);
    expect(groups[0].progress).toBe(75);
    expect(groups[0].running?.id).toBe("b");
  });

  it("lets a batch task supply the counts for its group", () => {
    const [clips] = groupProductionTasks([
      task({
        id: "video-batch",
        job_type: "video-generation",
        phase: "videos",
        status: "running",
        progress: 16,
        completed: 3,
        total: 19,
      }),
    ]);
    expect(clips).toMatchObject({
      id: "clips",
      completed: 3,
      total: 19,
      status: "running",
      progress: 16,
    });
  });

  it("keeps failed tasks with their detail and marks the group failed", () => {
    const [cast] = groupProductionTasks([
      task({ id: "ok", job_type: "character-generation" }),
      task({
        id: "bad",
        job_type: "character-generation",
        status: "failed",
        progress: 0,
        detail: "Provider timeout",
      }),
    ]);
    expect(cast.status).toBe("failed");
    expect(cast.failed.map((t) => t.detail)).toEqual(["Provider timeout"]);
  });

  it("summarises the first unfinished group while active and the last group when done", () => {
    const groups = groupProductionTasks([
      task({ id: "a", job_type: "character-generation" }),
      task({
        id: "video-batch",
        job_type: "video-generation",
        phase: "videos",
        status: "running",
        progress: 16,
        completed: 3,
        total: 19,
      }),
    ]);
    expect(summarizeProgress(groups, true)).toBe("Clips 3/19");
    const done = groupProductionTasks([
      task({ id: "a", job_type: "character-generation" }),
      task({
        id: "video-batch",
        job_type: "video-generation",
        phase: "videos",
        completed: 19,
        total: 19,
      }),
    ]);
    expect(summarizeProgress(done, false)).toBe("19 clips rendered");
    const cut = groupProductionTasks([
      task({ id: "stitch", job_type: "video-stitching", phase: "assembly" }),
    ]);
    expect(summarizeProgress(cut, false)).toBe("Final cut assembled");
  });

  it("formats durations and elapsed time", () => {
    expect(formatDuration(152)).toBe("2:32");
    expect(formatDuration(45)).toBe("45s");
    expect(
      elapsedBetween("2026-08-28T12:00:00.000Z", "2026-08-28T12:00:04.000Z"),
    ).toBe("4s");
    expect(elapsedBetween(undefined, "2026-08-28T12:00:04.000Z")).toBeNull();
  });
});
