import { describe, expect, it } from "vitest";
import { buildAgentBlocks } from "@/lib/agentBlocks";
import { agentRunFixture, eventFixture } from "@/test/agentFixtures";

describe("agent block selector", () => {
  it("maps transport events to Beautiful UI presentation blocks", () => {
    const blocks = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "message.completed", { id: "user", role: "user", content: agentRunFixture.prompt }),
      eventFixture(2, "activity.started", { id: "plan", label: "Planning shots", phase: "production_plan" }),
      eventFixture(3, "context.updated", { project: { title: "Signal" }, inheritance: ["project summary"] }),
      eventFixture(4, "diff.created", { title: "Plan", rows: [] }),
    ]);
    expect(blocks.some((block) => block.type === "streaming-message")).toBe(true);
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
    expect(playbackOnly.some((block) => block.type === "recommendation")).toBe(false);

    const mixed = buildAgentBlocks(agentRunFixture, [
      eventFixture(1, "recommendation.created", {
        title: "Refine the finished cut",
        actions: [
          { id: "play-film", label: "Play film", kind: "primary" },
          { id: "revise-pacing", label: "Revise pacing", kind: "secondary" },
        ],
      }),
    ]);
    const recommendation = mixed.find((block) => block.type === "recommendation");
    expect(recommendation?.type === "recommendation" ? recommendation.data.actions : []).toEqual([
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
    expect(insights[0]?.type === "insight" ? insights[0].data.title : "").toBe("Your film is ready");
  });
});
