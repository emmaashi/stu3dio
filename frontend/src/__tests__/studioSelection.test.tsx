import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetPanel from "@/components/studio/AssetPanel";
import LayersPanel from "@/components/studio/LayersPanel";
import { resolveAssetSelection, type StudioGraph } from "@/components/studio/types";
import { useStudioStore } from "@/store/useStudioStore";

const graph: StudioGraph = {
  hasProject: true,
  complete: true,
  objects: [],
  overview: { title: "Signal", summary: "A mystery", plot: "The lead follows a signal." },
  characters: [{
    id: "lead",
    name: "The Lead",
    role: "Protagonist",
    media: "https://cdn.test/lead.png",
    meta: { description: "A restrained investigator.", personality: "Observant" },
  }],
  scenes: [{
    id: "scene-one",
    order: 1,
    plot: "The signal appears.",
    media: "https://cdn.test/scene.png",
    castIds: ["lead"],
    meta: { detailed_plot: "The Lead finds the signal in an empty station." },
    clips: [{
      id: "shot-one",
      sceneId: "scene-one",
      order: 0,
      status: "completed",
      label: "The signal appears",
      image_url: "https://cdn.test/shot.png",
      meta: { veo3_prompt: "Slow dolly toward the signal." },
    }],
  }],
};

describe("Studio asset selection", () => {
  beforeEach(() => {
    useStudioStore.setState({ selectedKey: null, selectedKeys: [], focusKey: null, focusNonce: 0 });
  });

  it("supports additive selection and toggling through the shared store", () => {
    useStudioStore.getState().focus("char-lead");
    useStudioStore.getState().focus("clip-shot-one", { additive: true });
    expect(useStudioStore.getState().selectedKeys).toEqual(["char-lead", "clip-shot-one"]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");

    useStudioStore.getState().focus("char-lead", { additive: true });
    expect(useStudioStore.getState().selectedKeys).toEqual(["clip-shot-one"]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");
  });

  it("restores a conversation's linked asset selection without duplicates", () => {
    useStudioStore.getState().setSelection(["char-lead", "clip-shot-one", "char-lead"]);
    expect(useStudioStore.getState().selectedKeys).toEqual(["char-lead", "clip-shot-one"]);
    expect(useStudioStore.getState().selectedKey).toBe("clip-shot-one");
  });

  it("derives useful inherited-context summaries for selected assets", () => {
    const character = resolveAssetSelection(graph, "char-lead");
    const shot = resolveAssetSelection(graph, "clip-shot-one");
    expect(character).toMatchObject({ label: "The Lead", description: "A restrained investigator." });
    expect(character?.usage).toContain("Scene 1");
    expect(shot?.usage).toContain("8-second generation unit");
  });

  it("shows a multi-asset Inspector page after Shift-selecting layers", () => {
    render(<>
      <LayersPanel graph={graph} onCollapse={vi.fn()} />
      <AssetPanel graph={graph} version={0} busy={{}} onSaveOverview={vi.fn()} />
    </>);
    fireEvent.click(screen.getByRole("button", { name: /The Lead\. Shift-click/i }));
    fireEvent.click(screen.getByRole("button", { name: /Shot 01 .* Shift-click/i }), { shiftKey: true });
    expect(screen.getByText("2 assets selected")).toBeInTheDocument();
    expect(screen.getByText("Shared edit")).toBeInTheDocument();
    expect(screen.getByText(/stable ID and current metadata/i)).toBeInTheDocument();
  });
});
