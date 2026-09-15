import { describe, expect, it } from "vitest";
import {
  buildAgentRunContext,
  resolveAgentRunKind,
} from "@/components/studio/agentRunRequest";
import { buildContextOptions } from "@/components/studio/studioContext";
import {
  EMPTY_GRAPH,
  resolveAssetSelection,
  type StudioGraph,
} from "@/components/studio/types";
import type { AgentAttachment } from "@/types/agent";

const graph: StudioGraph = {
  ...EMPTY_GRAPH,
  hasProject: true,
  overview: {
    title: "Signal",
    summary: "A mystery",
    plot: "Follow the signal.",
  },
  characters: [
    {
      id: "lead",
      name: "Mara",
      role: "Lead",
      media: "/mara.png",
      meta: { personality: "Observant" },
    },
  ],
  objects: [{ id: "receiver", name: "Radio" }],
  scenes: [
    {
      id: "station",
      order: 2,
      plot: "A signal appears",
      clips: [],
      castIds: ["lead"],
    },
  ],
};

describe("Studio prompt context", () => {
  it("lists cast, objects, and scenes in the same order for both composers", () => {
    expect(buildContextOptions(graph)).toEqual([
      { id: "lead", label: "Mara", kind: "character" },
      { id: "receiver", label: "Radio", kind: "object" },
      { id: "station", label: "Scene 2", kind: "scene" },
    ]);
    expect(buildContextOptions(EMPTY_GRAPH)).toEqual([]);
  });

  it("preserves the agent request payload and inherited asset context", () => {
    const asset = resolveAssetSelection(graph, "char-lead")!;
    const attachments: AgentAttachment[] = [
      {
        id: "reference",
        name: "Look.png",
        url: "/look.png",
        mime_type: "image/png",
        size: 100,
      },
    ];
    expect(
      buildAgentRunContext({
        graph,
        selectedAssets: [asset],
        selectedLabel: "Mara",
        attachments,
      }),
    ).toEqual({
      selected_artifact: "Mara",
      selected_assets: [
        {
          id: "lead",
          key: "char-lead",
          kind: "character",
          label: "Mara",
          description: "Mara is part of the film's cast.",
          context: {
            role: "Lead",
            age: undefined,
            personality: "Observant",
            backstory: undefined,
            scene_ids: ["station"],
          },
        },
      ],
      project: graph.overview,
      visible_characters: [{ id: "lead", name: "Mara" }],
      visible_objects: [{ id: "receiver", name: "Radio" }],
      visible_scenes: [{ id: "station", order: 2 }],
      attachments,
    });
  });

  it("keeps an empty film's context explicit", () => {
    expect(
      buildAgentRunContext({
        graph: EMPTY_GRAPH,
        selectedAssets: [],
        attachments: [],
      }),
    ).toEqual({
      selected_artifact: null,
      selected_assets: [],
      project: null,
      visible_characters: [],
      visible_objects: [],
      visible_scenes: [],
      attachments: [],
    });
  });

  it.each([
    ["A new story", true, undefined, "create-film"],
    ["A new story", false, undefined, "enhance"],
    ["A new look", true, "Mara", "enhance"],
    ["/assemble film", true, "Mara", "assemble-film"],
    ["/plan scenes", false, undefined, "plan-scenes"],
    ["/planning", true, undefined, "plan-scenes"],
    [" /plan", true, undefined, "create-film"],
    ["/PLAN", true, undefined, "create-film"],
  ] as const)(
    "preserves command routing for %s",
    (text, isNewVideo, selectedLabel, kind) => {
      expect(resolveAgentRunKind(text, isNewVideo, selectedLabel)).toBe(kind);
    },
  );

  it("lets an explicit run kind override a prompt command", () => {
    expect(
      resolveAgentRunKind("/assemble film", true, undefined, "enhance"),
    ).toBe("enhance");
  });
});
