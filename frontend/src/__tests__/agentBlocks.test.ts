import { describe, expect, it } from "vitest";
import { buildAgentBlocks } from "@/lib/agentBlocks";
import { agentRunFixture, eventFixture } from "@/test/agentFixtures";

describe("agent block selector", () => {
  it("maps transport events to Beautiful UI presentation blocks", () => {
    const blocks = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "message.completed", {
        id: "user",
        role: "user",
        content: agentRunFixture.prompt,
      }),
      eventFixture(2, "activity.started", {
        id: "plan",
        label: "Planning shots",
        phase: "production_plan",
      }),
      eventFixture(3, "context.updated", {
        project: { title: "Signal" },
        inheritance: ["project summary"],
      }),
      eventFixture(4, "diff.created", { title: "Plan", rows: [] }),
    ]);
    expect(blocks.some((block) => block.type === "streaming-message")).toBe(
      true,
    );
    expect(blocks.some((block) => block.type === "thinking")).toBe(true);
    expect(blocks.some((block) => block.type === "context")).toBe(true);
    expect(blocks.some((block) => block.type === "diff")).toBe(true);
    expect(blocks.some((block) => block.type === "approval")).toBe(true);
  });

  it("does not render an approval after its resolution event", () => {
    const blocks = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "approval.resolved", {
        id: agentRunFixture.approval?.id,
        kind: "concept",
        decision: "approve",
      }),
    ]);

    expect(blocks.some((block) => block.type === "approval")).toBe(false);
  });

  it("suppresses playback-only recommendations and removes playback actions", () => {
    const playbackOnly = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "recommendation.created", {
        title: "Review the finished cut",
        actions: [{ id: "play-film", label: "Play film", kind: "primary" }],
      }),
    ]);
    expect(playbackOnly.some((block) => block.type === "recommendation")).toBe(
      false,
    );

    const mixed = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "recommendation.created", {
        title: "Refine the finished cut",
        actions: [
          { id: "play-film", label: "Play film", kind: "primary" },
          { id: "revise-pacing", label: "Revise pacing", kind: "secondary" },
        ],
      }),
    ]);
    const recommendation = mixed.find(
      (block) => block.type === "recommendation",
    );
    expect(
      recommendation?.type === "recommendation"
        ? recommendation.data.actions
        : [],
    ).toEqual([
      { id: "revise-pacing", label: "Revise pacing", kind: "secondary" },
    ]);
  });

  it("replaces an earlier insight with the latest run summary", () => {
    const blocks = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "insight.created", {
        title: "Production ready",
        metrics: [{ label: "Clips", value: 8 }],
      }),
      eventFixture(2, "insight.created", {
        title: "Your film is ready",
        metrics: [{ label: "Runtime", value: "64s" }],
      }),
    ]);
    const insights = blocks.filter((block) => block.type === "insight");
    expect(insights).toHaveLength(1);
    expect(insights[0]?.type === "insight" ? insights[0].data.title : "").toBe(
      "Your film is ready",
    );
  });

  it("emits exactly one grouped progress block for production tasks", () => {
    const run = {
      ...agentRunFixture,
      status: "running" as const,
      phase: "videos" as const,
      tasks: [
        {
          id: "c1",
          label: "Design Thom",
          phase: "assets" as const,
          job_type: "character-generation",
          status: "completed" as const,
          progress: 100,
        },
        {
          id: "c2",
          label: "Design Celia",
          phase: "assets" as const,
          job_type: "character-generation",
          status: "completed" as const,
          progress: 100,
        },
      ],
    };
    const blocks = buildAgentBlocks(run, [
      eventFixture(1, "task.completed", { id: "c1" }),
      eventFixture(2, "task.progress", {
        id: "video-batch",
        label: "Render video clips",
        phase: "videos",
        job_type: "video-generation",
        status: "running",
        progress: 16,
        completed: 3,
        total: 19,
      }),
    ]);
    const progress = blocks.filter((block) => block.type === "progress");
    expect(progress).toHaveLength(1);
    expect(
      blocks.some(
        (block) =>
          (block.type as string) === "task-group" ||
          (block.type as string) === "tool-group",
      ),
    ).toBe(false);
    const block = progress[0];
    if (block.type !== "progress") throw new Error("expected progress block");
    expect(block.active).toBe(true);
    expect(block.startedAt).toBe("2026-08-28T12:00:01.000Z");
    expect(block.finishedAt).toBeUndefined();
    expect(
      block.groups.map((group) => [group.id, group.completed, group.total]),
    ).toEqual([
      ["cast", 2, 2],
      ["clips", 3, 19],
    ]);
  });

  it("turns an insight that carries the film into a film card and drops the duplicate artifact", () => {
    const run = {
      ...agentRunFixture,
      artifacts: [
        {
          id: "final",
          kind: "video-stitching",
          title: "Final film",
          url: "https://cdn/final.mp4",
        },
        {
          id: "still",
          kind: "scene-generation",
          title: "Scene still",
          url: "https://cdn/scene.jpg",
        },
      ],
    };
    const blocks = buildAgentBlocks(run, [
      eventFixture(1, "insight.created", {
        title: "Production ready",
        metrics: [{ label: "Clips", value: 8 }],
      }),
      eventFixture(2, "insight.created", {
        title: "Your film is ready",
        metrics: [{ label: "Clips", value: 8 }],
        artifact_url: "https://cdn/final.mp4",
      }),
    ]);
    expect(blocks.filter((block) => block.type === "insight")).toHaveLength(0);
    expect(blocks.filter((block) => block.type === "film-ready")).toHaveLength(
      1,
    );
    expect(
      blocks
        .filter((block) => block.type === "artifact")
        .map((block) => block.id),
    ).toEqual(["artifact-still"]);
  });
});
