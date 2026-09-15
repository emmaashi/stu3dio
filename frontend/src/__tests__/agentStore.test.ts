import { beforeEach, describe, expect, it } from "vitest";
import { useAgentRunStore } from "@/store/useAgentRunStore";
import { agentRunFixture, eventFixture } from "@/test/agentFixtures";

describe("agent run store", () => {
  beforeEach(() => useAgentRunStore.getState().reset());

  it("deduplicates replayed SSE events", () => {
    useAgentRunStore.getState().hydrate({ ...agentRunFixture, assistant_text: "" });
    const delta = eventFixture(1, "message.delta", { id: "message", role: "assistant", delta: "Hello" });
    useAgentRunStore.getState().applyEvent(delta);
    useAgentRunStore.getState().applyEvent(delta);
    expect(useAgentRunStore.getState().events).toHaveLength(1);
    expect(useAgentRunStore.getState().run?.assistant_text).toBe("Hello");
  });

  it("reconciles task progress and terminal run state", () => {
    useAgentRunStore.getState().hydrate(agentRunFixture);
    useAgentRunStore.getState().applyEvent(eventFixture(1, "task.progress", {
      id: "video-batch", label: "Render clips", phase: "videos", status: "running", progress: 50
    }));
    useAgentRunStore.getState().applyEvent(eventFixture(2, "run.completed", { video_url: "film.mp4" }));
    expect(useAgentRunStore.getState().run?.tasks[0]?.progress).toBe(50);
    expect(useAgentRunStore.getState().run?.status).toBe("completed");
  });
});
