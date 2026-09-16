import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetPanel from "@/components/studio/AssetPanel";
import StoryBrief from "@/components/studio/StoryBrief";
import LayersPanel from "@/components/studio/LayersPanel";
import {
  resolveAssetSelection,
  type StudioGraph,
} from "@/components/studio/types";
import { useStudioStore } from "@/store/useStudioStore";

const graph: StudioGraph = {
  hasProject: true,
  complete: true,
  objects: [],
  overview: {
    title: "Signal",
    summary: "A mystery",
    plot: "The lead follows a signal.",
  },
  characters: [
    {
      id: "lead",
      name: "The Lead",
      role: "Protagonist",
      media: "https://cdn.test/lead.png",
      meta: {
        description: "A restrained investigator.",
        personality: "Observant",
      },
    },
  ],
  scenes: [
    {
      id: "scene-one",
      order: 1,
      plot: "The signal appears.",
      media: "https://cdn.test/scene.png",
      castIds: ["lead"],
      meta: { detailed_plot: "The Lead finds the signal in an empty station." },
      clips: [
        {
          id: "shot-one",
          sceneId: "scene-one",
          order: 0,
          status: "completed",
          label: "The signal appears",
          image_url: "https://cdn.test/shot.png",
          meta: { veo3_prompt: "Slow dolly toward the signal." },
        },
      ],
    },
  ],
};

describe("Studio asset selection", () => {
  beforeEach(() => {
    useStudioStore.setState({
      selectedKey: null,
      selectedKeys: [],
      focusKey: null,
      focusNonce: 0,
    });
  });

  it("supports additive selection and toggling through the shared store", () => {
    useStudioStore.getState().focus("char-lead");
    useStudioStore.getState().focus("clip-shot-one", { additive: true });
    expect(useStudioStore.getState().selectedKeys).toEqual([
      "char-lead",
      "clip-shot-one",
    ]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");

    useStudioStore.getState().focus("char-lead", { additive: true });
    expect(useStudioStore.getState().selectedKeys).toEqual(["clip-shot-one"]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");
  });

  it("restores a conversation's linked asset selection without duplicates", () => {
    useStudioStore
      .getState()
      .setSelection(["char-lead", "clip-shot-one", "char-lead"]);
    expect(useStudioStore.getState().selectedKeys).toEqual([
      "char-lead",
      "clip-shot-one",
    ]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");
  });

  it("derives useful inherited-context summaries for selected assets", () => {
    const character = resolveAssetSelection(graph, "char-lead");
    const shot = resolveAssetSelection(graph, "clip-shot-one");
    expect(character).toMatchObject({
      label: "The Lead",
      description: "A restrained investigator.",
    });
    expect(character?.usage).toContain("Scene 1");
    expect(shot?.usage).toContain("8-second generation unit");
  });

  it("keeps multi-asset references together after Shift-selecting layers", () => {
    render(
      <>
        <LayersPanel graph={graph} onCollapse={vi.fn()} />
        <AssetPanel graph={graph} version={0} busy={{}} />
      </>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /The Lead\. Shift-click/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand Scene 1 shots" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Shot 01 .* Shift-click/i }),
      { shiftKey: true },
    );
    expect(screen.getByText("2 assets selected")).toBeInTheDocument();
    expect(screen.getByText("Shared reference")).toBeInTheDocument();
    expect(
      screen.getByText(/visual direction to apply to these selected images/i),
    ).toBeInTheDocument();
  });

  it("expands shots without changing the current selection or camera target", () => {
    useStudioStore.getState().select("char-lead");
    render(<LayersPanel graph={graph} onCollapse={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Expand Scene 1 shots" }),
    );
    expect(useStudioStore.getState().selectedKeys).toEqual(["char-lead"]);
    expect(useStudioStore.getState().focusNonce).toBe(0);
    expect(screen.getByRole("button", { name: /Shot 01/ })).toBeInTheDocument();
  });

  it("finds shots in collapsed scenes and restores the outline when search is cleared", () => {
    render(<LayersPanel graph={graph} onCollapse={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search assets"), {
      target: { value: "signal" },
    });
    expect(screen.getByRole("button", { name: /Shot 01/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /The Lead. Shift-click/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(
      screen.getByRole("button", { name: /The Lead. Shift-click/ }),
    ).toBeInTheDocument();
  });

  it("follows a shot's inherited scene and character context", () => {
    useStudioStore.getState().select("clip-shot-one");
    render(<AssetPanel graph={graph} version={0} busy={{}} />);
    fireEvent.click(screen.getByText("Details & story context"));
    fireEvent.click(
      screen.getByRole("button", { name: /The Lead Character reference/ }),
    );
    expect(useStudioStore.getState().selectedKey).toBe("char-lead");
    expect(useStudioStore.getState().focusKey).toBe("char-lead");
  });

  it("prepares an asset revision and opens annotation for the exact selected asset", () => {
    const refine = vi.fn(),
      annotate = vi.fn();
    useStudioStore.getState().select("char-lead");
    render(
      <AssetPanel
        graph={graph}
        version={0}
        busy={{}}
        onRefine={refine}
        onAnnotate={annotate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Refine image" }));
    expect(refine).toHaveBeenCalledWith("Refine The Lead: ");
    fireEvent.click(screen.getByRole("button", { name: "Draw an edit" }));
    expect(annotate).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "char-lead",
        media: "https://cdn.test/lead.png",
      }),
    );
    expect(screen.queryByText("1024 × 1024")).not.toBeInTheDocument();
  });

  it("offers a shot a conversation instead of the still-image tools", () => {
    const discuss = vi.fn(),
      refine = vi.fn();
    useStudioStore.getState().select("clip-shot-one");
    render(
      <AssetPanel
        graph={graph}
        version={0}
        busy={{}}
        onRefine={refine}
        onAnnotate={vi.fn()}
        onDiscuss={discuss}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Refine image" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draw an edit" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "New conversation about this shot" }),
    );
    expect(discuss).toHaveBeenCalledWith(
      expect.objectContaining({ key: "clip-shot-one" }),
    );
    expect(refine).not.toHaveBeenCalled();
  });

  it("preserves the story brief draft and reports failed saves", async () => {
    useStudioStore.getState().select("overview");
    render(
      <StoryBrief
        overview={graph.overview!}
        visible
        onClose={vi.fn()}
        onSave={vi.fn().mockRejectedValue(new Error("Offline"))}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Signal, continued" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brief" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be saved",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Signal, continued");
  });
  it("keeps unsaved brief changes when returning to the canvas and reopening", () => {
    const props = {
      overview: graph.overview!,
      onSave: vi.fn(),
      onClose: vi.fn(),
    };
    const view = render(<StoryBrief {...props} visible />);
    fireEvent.change(screen.getByLabelText("Plot"), {
      target: { value: "A new ending." },
    });
    view.rerender(<StoryBrief {...props} visible={false} />);
    expect(
      screen.queryByRole("dialog", { name: "Story brief" }),
    ).not.toBeInTheDocument();
    view.rerender(<StoryBrief {...props} visible />);
    expect(screen.getByLabelText("Plot")).toHaveValue("A new ending.");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("keeps keyboard focus in the brief dialog and restores it when dismissed", () => {
    function Editor() {
      const [visible, setVisible] = useState(false);
      return (
        <>
          <button onClick={() => setVisible(true)}>Open brief</button>
          <StoryBrief
            overview={graph.overview!}
            visible={visible}
            onSave={vi.fn()}
            onClose={() => setVisible(false)}
          />
        </>
      );
    }
    render(<Editor />);
    const opener = screen.getByRole("button", { name: "Open brief" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Story brief" });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const concept = screen.getByRole("textbox", { name: "Concept" });
    fireEvent.change(concept, {
      target: { value: "A story worth continuing." },
    });
    const close = screen.getByRole("button", { name: "Close story brief" });
    const save = screen.getByRole("button", { name: "Save brief" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(concept, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    fireEvent.click(opener);
    expect(screen.getByRole("textbox", { name: "Concept" })).toHaveValue(
      "A story worth continuing.",
    );
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps a successfully saved brief without reverting to an older server snapshot", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <StoryBrief
        overview={graph.overview!}
        visible
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Signal II" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brief" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(save).toHaveBeenCalledWith({
      ...graph.overview,
      title: "Signal II",
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Signal II");
  });

  it("shows only a brief reference in the conversation", () => {
    useStudioStore.getState().select("overview");
    render(<AssetPanel graph={graph} version={0} busy={{}} />);
    expect(
      screen.getByText("Working from your story brief"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
