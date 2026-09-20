import { describe, expect, it } from "vitest";
import {
  buildStudioGraph,
  type StudioPipelineStatus,
} from "@/components/studio/studioGraph";
import { buildLayout } from "@/components/studio/layout";

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
        assembling: false,
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

  it("draws planned cast and scenes as skeletons until the pipeline creates them", () => {
    const status: StudioPipelineStatus = {
      characters: [
        { id: "thom", media_url: "thom.jpg", metadata: { name: "Thom" } },
      ],
      scenes: [{ id: "s1", media_url: "s1.jpg", metadata: { scene_order: 1 } }],
      frames: [{ id: "f1", scene_id: "s1", video_url: "f1.mp4" }],
    };
    const graph = buildStudioGraph(status, overview, {
      characters: [
        { name: "thom", role: "Lead" },
        { name: "Celia", role: "Roboticist" },
      ],
      scenes: [
        { scene_order: 1, title: "The bridge", target_frames: 1 },
        { scene_order: 2, title: "The hand", target_frames: 3 },
      ],
    });
    expect(graph.characters.map((c) => [c.name, !!c.skeleton])).toEqual([
      ["Thom", false],
      ["Celia", true],
    ]);
    expect(
      graph.scenes.map((s) => [s.order, !!s.skeleton, s.clips.length]),
    ).toEqual([
      [1, false, 1],
      [2, true, 3],
    ]);
    expect(graph.scenes[1].clips.every((clip) => clip.skeleton)).toBe(true);
    expect(graph.complete).toBe(false);
  });

  it("ignores the plan once nothing is expected", () => {
    const status: StudioPipelineStatus = {
      scenes: [{ id: "s1", metadata: { scene_order: 1 } }],
      frames: [{ id: "f1", scene_id: "s1", video_url: "f1.mp4" }],
    };
    expect(buildStudioGraph(status, overview, null).complete).toBe(true);
  });

  it("draws a skeleton film node with glowing edges while the cut is assembled", () => {
    const status: StudioPipelineStatus = {
      scenes: [{ id: "s1", media_url: "s1.jpg", metadata: { scene_order: 1 } }],
      frames: [
        { id: "f1", scene_id: "s1", media_url: "f1.jpg", video_url: "f1.mp4" },
      ],
    };
    const graph = buildStudioGraph(status, overview, { assembling: true });
    expect(graph.assembling).toBe(true);
    const layout = buildLayout(graph);
    expect(layout.nodes.find((node) => node.kind === "film")?.skeleton).toBe(
      true,
    );
    const intoFilm = layout.edges.filter((edge) => edge.target === "film");
    expect(intoFilm).toHaveLength(1);
    expect(intoFilm.every((edge) => edge.flow && edge.on)).toBe(true);

    const done = buildStudioGraph(
      status,
      { ...overview, finalVideoUrl: "final.mp4" },
      { assembling: true },
    );
    expect(done.assembling).toBe(false);
    expect(
      buildLayout(done).nodes.find((node) => node.kind === "film")?.skeleton,
    ).toBe(false);
    expect(buildLayout(done).edges.some((edge) => edge.flow)).toBe(false);
  });
});
