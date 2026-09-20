import { createRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AgentRail, { type AgentRailHandle } from "@/components/studio/AgentRail";
import {
  resolveAssetSelection,
  type StudioGraph,
} from "@/components/studio/types";
import { useAgentRunStore } from "@/store/useAgentRunStore";
import { agentRunFixture } from "@/test/agentFixtures";

vi.mock("@/lib/agentApi", () => ({
  agentApi: { subscribe: vi.fn(() => () => {}) },
}));

const graph: StudioGraph = {
  hasProject: true,
  complete: true,
  overview: {
    title: "Signal",
    summary: "A mystery",
    plot: "Follow the signal.",
  },
  characters: [
    { id: "lead", name: "The Lead", role: "Protagonist", media: "/lead.png" },
  ],
  objects: [],
  scenes: [],
};
const character = resolveAssetSelection(graph, "char-lead")!;
const props = () => ({
  projectId: agentRunFixture.project_id,
  graph,
  isNewVideo: false,
  selectedAssets: [character],
  selectionContent: <p>The Lead reference</p>,
  onEditSelection: vi.fn().mockResolvedValue(1),
  onRefresh: vi.fn(),
  onPlay: vi.fn(),
  onSelectAssets: vi.fn(),
});

describe("Unified studio conversations", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAgentRunStore.getState().reset();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens references with the conversation and reveals the story document on mobile", () => {
    const base = props();
    const view = render(<AgentRail {...base} />);
    expect(
      screen.getByRole("complementary", { name: "Conversations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The Lead reference")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    vi.stubGlobal("innerWidth", 390);
    view.rerender(
      <AgentRail
        {...base}
        selectedAssets={[resolveAssetSelection(graph, "overview")!]}
      />,
    );
    expect(
      screen.queryByRole("complementary", { name: "Conversations" }),
    ).not.toBeInTheDocument();
  });

  it("hosts the workspace composer once the panel is open", () => {
    const base = props();
    const onComposerStateChange = vi.fn();
    const ref = createRef<AgentRailHandle>();
    render(
      <AgentRail
        {...base}
        ref={ref}
        externalComposer
        composer={<p>The one composer</p>}
        onComposerStateChange={onComposerStateChange}
      />,
    );
    // Selecting an asset opens the panel, so the composer belongs to it.
    expect(onComposerStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationsOpen: true }),
    );
    const footer = document.querySelector(".agent-rail__composer")!;
    expect(footer).toHaveTextContent("The one composer");
    expect(footer.className).toContain("agent-rail__composer--hosted");
    expect(footer.className).not.toContain("--mobile-only");
    act(() => ref.current?.closeConversations());
    expect(onComposerStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversationsOpen: false }),
    );
  });

  it("can return to a pending proposal after inspecting another asset", () => {
    const base = props();
    const ref = createRef<AgentRailHandle>();
    const view = render(<AgentRail {...base} ref={ref} selectedAssets={[]} />);
    act(() => useAgentRunStore.getState().hydrate(agentRunFixture));
    view.rerender(<AgentRail {...base} ref={ref} />);
    expect(
      screen.queryByText("Approve the concept and cast"),
    ).not.toBeInTheDocument();
    act(() => ref.current?.openConversations({ current: true }));
    expect(
      screen.getByText("Approve the concept and cast"),
    ).toBeInTheDocument();
    expect(base.onSelectAssets).toHaveBeenCalledWith([]);
  });

  it("continues the chosen historical conversation when two share the same reference", async () => {
    const base = props();
    const key = `stu3dio:asset-conversations:${base.projectId}`;
    window.localStorage.setItem(
      key,
      JSON.stringify(
        ["newer", "older"].map((id) => ({
          id,
          title: `${id} direction`,
          selection: [
            {
              key: character.key,
              label: character.label,
              kind: character.kind,
            },
          ],
          messages: [{ role: "user", content: `${id} original prompt` }],
          updatedLabel: "Yesterday",
          updatedAt: "2026-09-01",
        })),
      ),
    );
    const ref = createRef<AgentRailHandle>();
    render(<AgentRail {...base} ref={ref} />);
    act(() => ref.current?.openConversations({ history: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "older direction Yesterday" }),
    );
    act(() => ref.current?.submitPrompt("Keep the earlier silhouette."));
    await waitFor(() =>
      expect(base.onEditSelection).toHaveBeenCalledWith(
        "Keep the earlier silhouette.",
        [character.key],
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Applied this visual direction/),
      ).toBeInTheDocument(),
    );
    const saved = JSON.parse(window.localStorage.getItem(key)!);
    expect(
      saved.find((item: { id: string }) => item.id === "older").messages,
    ).toHaveLength(3);
    expect(
      saved.find((item: { id: string }) => item.id === "newer").messages,
    ).toHaveLength(1);
  });

  it("tells the workspace whether a run is active and which phase it is in", async () => {
    const onComposerStateChange = vi.fn();
    render(
      <AgentRail {...props()} onComposerStateChange={onComposerStateChange} />,
    );
    act(() => useAgentRunStore.getState().hydrate(agentRunFixture));
    await waitFor(() =>
      expect(onComposerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          awaitingApproval: true,
          runActive: false,
          runPhase: "concept",
        }),
      ),
    );
    act(() =>
      useAgentRunStore.getState().hydrate({
        ...agentRunFixture,
        status: "running",
        phase: "assembly",
        approval: undefined,
      }),
    );
    await waitFor(() =>
      expect(onComposerStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          awaitingApproval: false,
          runActive: true,
          runPhase: "assembly",
        }),
      ),
    );
  });
});
