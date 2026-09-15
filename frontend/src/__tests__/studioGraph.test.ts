import { describe, expect, it } from "vitest";
import {
  buildStudioGraph,
  type StudioPipelineStatus,
} from "@/components/studio/studioGraph";

const overview = {
  title: "Signal",
  summary: "A mystery",
  plot: "Follow the signal.",
};

describe("Studio graph adapter", () => {
  it.each([undefined, null, {}])(
    "handles an empty pipeline payload (%s)",
    (status) => {
      expect(buildStudioGraph(status, overview)).toEqual({
        overview,
        characters: [],
        objects: [],
        scenes: [],
        complete: false,
        hasProject: true,
      });
    },
  );

  it("keeps scenes and shots in story order, including zero-valued orders", () => {
    const status: StudioPipelineStatus = {
      scenes: [
        { id: "late", metadata: { scene_order: 2 } },
        { id: "early", metadata: { scene_order: 0 } },
      ],
      frames: [
        { id: "last", scene_id: "early", metadata: { frame_order: 2 } },
        {
          id: "first",
          scene_id: "early",
          metadata: { frame_order: 0, scene_order: 9 },
        },
        { id: "middle", scene_id: "early", metadata: { scene_order: 1 } },
        { id: "late-shot", scene_id: "late" },
        { id: "orphan", scene_id: "missing" },
      ],
    };
    const original = structuredClone(status);
    const graph = buildStudioGraph(status, overview);
    expect(graph.scenes.map((scene) => scene.id)).toEqual(["early", "late"]);
    expect(graph.scenes[0].clips.map((clip) => [clip.id, clip.order])).toEqual([
      ["first", 0],
      ["middle", 1],
      ["last", 2],
    ]);
    expect(graph.scenes[1].clips.map((clip) => clip.id)).toEqual(["late-shot"]);
    expect(status).toEqual(original);
  });

  it("preserves metadata, cast references, and media for inherited context", () => {
    const character = { name: "Mara", role: "Lead", personality: "Observant" };
    const object = { type: "Receiver", name: "Old radio", origin: "Station" };
    const scene = {
      concise_plot: "A signal",
      detailed_plot: "Mara hears it.",
      castIds: ["fallback"],
    };
    const frame = {
      concise_plot: "The receiver",
      summary: "A close-up",
      veo3_prompt: "Slow dolly",
    };
    const graph = buildStudioGraph(
      {
        characters: [
          {
            id: "mara",
            media_url: "/mara.png",
            loading: true,
            metadata: character,
          },
        ],
        objects: [{ id: "radio", media_url: "/radio.png", metadata: object }],
        scenes: [
          {
            id: "station",
            media_url: "/station.png",
            castIds: ["mara"],
            loading: true,
            metadata: scene,
          },
        ],
        frames: [
          {
            id: "close-up",
            scene_id: "station",
            media_url: "/frame.png",
            video_url: "/clip.mp4",
            metadata: frame,
          },
        ],
      },
      overview,
    );
    expect(graph.overview).toBe(overview);
    expect(graph.characters[0]).toMatchObject({
      id: "mara",
      name: "Mara",
      role: "Lead",
      media: "/mara.png",
      loading: true,
    });
    expect(graph.characters[0].meta).toBe(character);
    expect(graph.objects[0]).toMatchObject({
      name: "Receiver",
      media: "/radio.png",
    });
    expect(graph.objects[0].meta).toBe(object);
    expect(graph.scenes[0]).toMatchObject({
      plot: "A signal",
      castIds: ["mara"],
      loading: true,
    });
    expect(graph.scenes[0].meta).toBe(scene);
    expect(graph.scenes[0].clips[0]).toMatchObject({
      label: "The receiver",
      image_url: "/frame.png",
      video_url: "/clip.mp4",
      status: "completed",
    });
    expect(graph.scenes[0].clips[0].meta).toBe(frame);
  });

  it("retains fallback names, identifiers, plots, and legacy frame ordering", () => {
    const graph = buildStudioGraph(
      {
        characters: [{}],
        objects: [{}, { metadata: { name: "Radio" } }],
        scenes: [
          {},
          {
            id: "scene",
            metadata: { detailed_plot: "At the station", castIds: ["lead"] },
          },
        ],
        frames: [
          {
            scene_id: "scene",
            metadata: { summary: "A close-up", scene_order: 4 },
          },
          { scene_id: "scene" },
          {},
        ],
      },
      null,
    );
    expect(graph.characters[0]).toMatchObject({
      id: "char-0",
      name: "Character 1",
      role: "",
      loading: false,
    });
    expect(graph.objects.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "object-0", name: "Object 1" },
      { id: "object-1", name: "Radio" },
    ]);
    expect(graph.scenes[0]).toMatchObject({
      id: "scene-0",
      order: 1,
      plot: "",
      clips: [],
    });
    expect(graph.scenes[1]).toMatchObject({
      order: 2,
      plot: "At the station",
      castIds: ["lead"],
    });
    expect(
      graph.scenes[1].clips.map(({ id, label, order }) => ({
        id,
        label,
        order,
      })),
    ).toEqual([
      { id: "clip-1", label: "Clip 2", order: 1 },
      { id: "clip-0", label: "A close-up", order: 4 },
    ]);
  });

  it("derives generation progress and completion without counting orphan frames", () => {
    const status: StudioPipelineStatus = {
      scenes: [{ id: "scene" }],
      frames: [
        { scene_id: "scene" },
        { scene_id: "scene", media_url: "/frame.png" },
        { scene_id: "scene", video_url: "/clip.mp4" },
      ],
    };
    const graph = buildStudioGraph(status, overview);
    expect(graph.scenes[0].clips.map((clip) => clip.status)).toEqual([
      "pending",
      "generating",
      "completed",
    ]);
    expect(graph.complete).toBe(false);
    expect(
      buildStudioGraph({ ...status, completion_status: "complete" }, overview)
        .complete,
    ).toBe(true);
    expect(
      buildStudioGraph(
        { ...status, frames: [status.frames![2], { scene_id: "orphan" }] },
        overview,
      ).complete,
    ).toBe(true);
    expect(
      buildStudioGraph({ frames: [{ video_url: "/orphan.mp4" }] }, overview)
        .complete,
    ).toBe(false);
  });
});
