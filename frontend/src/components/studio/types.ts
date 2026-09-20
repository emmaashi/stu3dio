// Shared types for the Studio canvas pipeline.
// These mirror what getCompleteProjectStatus() returns from the backend and are
// consumed by the layout builder, the canvas, and the side panels.

export type NodeKind = "overview" | "character" | "scene" | "clip" | "film";
export type ClipStatus = "pending" | "generating" | "completed";

export type Clip = {
  id: string;
  sceneId: string;
  order: number;
  status: ClipStatus;
  video_url?: string;
  image_url?: string;
  label: string;
  // Planned but not yet created by the backend; drawn as a skeleton card.
  skeleton?: boolean;
  // raw frame metadata (veo3_prompt, dialogue, summary, ...) for the Asset panel
  meta?: Record<string, any>;
};

export type SceneN = {
  id: string;
  order: number;
  plot: string;
  media?: string;
  loading?: boolean;
  skeleton?: boolean;
  clips: Clip[];
  // Character ids that appear in this scene, used to draw cast -> scene edges.
  castIds?: string[];
  meta?: Record<string, any>;
};

export type CharN = {
  id: string;
  name: string;
  role: string;
  media?: string;
  loading?: boolean;
  skeleton?: boolean;
  meta?: Record<string, any>;
};

export type ObjectN = {
  id: string;
  name: string;
  media?: string;
  meta?: Record<string, any>;
};

export type Overview = {
  title: string;
  summary: string;
  plot: string;
  finalVideoUrl?: string;
  poster?: string;
};

export type StudioGraph = {
  overview: Overview | null;
  characters: CharN[];
  objects: ObjectN[];
  scenes: SceneN[];
  complete: boolean;
  hasProject: boolean;
  // The final cut is being stitched right now: the film node is drawn as a
  // skeleton and every shot's edge into it glows.
  assembling?: boolean;
};

export const EMPTY_GRAPH: StudioGraph = {
  overview: null,
  characters: [],
  objects: [],
  scenes: [],
  complete: false,
  hasProject: false,
};

// A single laid-out node on the board.
export type GNode = {
  key: string;
  kind: NodeKind;
  spine: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  label?: string;
  media?: string;
  video?: string;
  status?: ClipStatus;
  ready?: boolean;
  loading?: boolean;
  skeleton?: boolean;
  // pointer back to the source entity so panels can resolve full detail
  refId?: string;
};

export type GEdge = {
  key: string;
  d: string;
  on: boolean;
  source: string;
  target: string;
  dir: "h" | "v";
  // Animated glow: work is flowing along this edge right now.
  flow?: boolean;
};

// Resolve the source entity for a selected node key.
export type SelectedDetail =
  | { kind: "overview"; overview: Overview }
  | { kind: "character"; character: CharN }
  | { kind: "scene"; scene: SceneN }
  | { kind: "clip"; clip: Clip; scene?: SceneN }
  | { kind: "film"; overview: Overview | null }
  | null;

export type AssetSelection = {
  key: string;
  id: string;
  kind: NodeKind;
  label: string;
  description: string;
  usage: string;
  media?: string;
  editable: boolean;
  context: Record<string, unknown>;
};

export function resolveSelected(
  graph: StudioGraph,
  key: string | null,
): SelectedDetail {
  if (!key) return null;
  if (key === "overview") {
    return graph.overview
      ? { kind: "overview", overview: graph.overview }
      : null;
  }
  if (key === "film") {
    return { kind: "film", overview: graph.overview };
  }
  if (key.startsWith("char-")) {
    const id = key.slice("char-".length);
    const character = graph.characters.find((c) => c.id === id);
    return character ? { kind: "character", character } : null;
  }
  if (key.startsWith("scene-")) {
    const id = key.slice("scene-".length);
    const scene = graph.scenes.find((s) => s.id === id);
    return scene ? { kind: "scene", scene } : null;
  }
  if (key.startsWith("clip-")) {
    const id = key.slice("clip-".length);
    for (const scene of graph.scenes) {
      const clip = scene.clips.find((c) => c.id === id);
      if (clip) return { kind: "clip", clip, scene };
    }
  }
  return null;
}

export function resolveAssetSelection(
  graph: StudioGraph,
  key: string,
): AssetSelection | null {
  const detail = resolveSelected(graph, key);
  if (!detail) return null;

  if (detail.kind === "character") {
    const character = detail.character;
    const usedIn = graph.scenes.filter((scene) => {
      if (scene.castIds?.includes(character.id)) return true;
      const searchable = [
        scene.plot,
        scene.meta?.detailed_plot,
        scene.meta?.concise_plot,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(character.name.toLowerCase());
    });
    return {
      key,
      id: character.id,
      kind: "character",
      label: character.name,
      description:
        character.meta?.description ||
        `${character.name} is part of the film's cast.`,
      usage: usedIn.length
        ? `Used in ${usedIn.length} ${usedIn.length === 1 ? "scene" : "scenes"}: ${usedIn.map((scene) => `Scene ${scene.order}`).join(", ")}.`
        : "Available to every scene through the project’s inherited cast context.",
      media: character.media,
      editable: !!character.media,
      context: {
        role: character.role || character.meta?.role,
        age: character.meta?.age,
        personality: character.meta?.personality,
        backstory: character.meta?.backstory,
        scene_ids: usedIn.map((scene) => scene.id),
      },
    };
  }

  if (detail.kind === "scene") {
    const scene = detail.scene;
    const cast = graph.characters.filter((character) =>
      scene.castIds?.includes(character.id),
    );
    return {
      key,
      id: scene.id,
      kind: "scene",
      label: `Scene ${scene.order}`,
      description:
        scene.meta?.detailed_plot ||
        scene.plot ||
        `Scene ${scene.order} of the film.`,
      usage: `${scene.clips.length} ${scene.clips.length === 1 ? "shot" : "shots"}${cast.length ? ` · Cast: ${cast.map((character) => character.name).join(", ")}` : ""}.`,
      media: scene.media,
      editable: !!scene.media,
      context: {
        order: scene.order,
        concise_plot: scene.meta?.concise_plot || scene.plot,
        detailed_plot: scene.meta?.detailed_plot,
        dialogue: scene.meta?.dialogue,
        cast_ids: scene.castIds || [],
        shot_ids: scene.clips.map((clip) => clip.id),
      },
    };
  }

  if (detail.kind === "clip") {
    const clip = detail.clip;
    const scene = detail.scene;
    return {
      key,
      id: clip.id,
      kind: "clip",
      label: clip.label || `Shot ${clip.order + 1}`,
      description: clip.meta?.veo3_prompt || clip.meta?.summary || clip.label,
      usage: `${scene ? `Scene ${scene.order}` : "Film shot"} · ${clip.status} · 8-second generation unit.`,
      media: clip.image_url,
      editable: !!clip.image_url,
      context: {
        scene_id: clip.sceneId,
        scene_order: scene?.order,
        frame_order: clip.order,
        summary: clip.meta?.summary,
        dialogue: clip.meta?.dialogue,
        veo3_prompt: clip.meta?.veo3_prompt,
        status: clip.status,
        video_url: clip.video_url,
      },
    };
  }

  if (detail.kind === "film") {
    const clips = graph.scenes.flatMap((scene) => scene.clips);
    return {
      key,
      id: "film",
      kind: "film",
      label: "Final film",
      description:
        detail.overview?.summary ||
        detail.overview?.plot ||
        "The assembled film.",
      usage: `${graph.scenes.length} scenes · ${clips.length} clips${detail.overview?.finalVideoUrl ? " · Final cut available." : " · Awaiting assembly."}`,
      media: detail.overview?.poster,
      editable: false,
      context: {
        title: detail.overview?.title,
        summary: detail.overview?.summary,
        plot: detail.overview?.plot,
        scene_ids: graph.scenes.map((scene) => scene.id),
        clip_ids: clips.map((clip) => clip.id),
        final_video_url: detail.overview?.finalVideoUrl,
      },
    };
  }

  return {
    key,
    id: "overview",
    kind: "overview",
    label: detail.overview.title || "Project overview",
    description:
      detail.overview.summary ||
      detail.overview.plot ||
      "The film’s creative foundation.",
    usage: "Inherited by cast, scenes, shots, and final assembly.",
    media: detail.overview.poster,
    editable: false,
    context: {
      title: detail.overview.title,
      summary: detail.overview.summary,
      plot: detail.overview.plot,
    },
  };
}

// Characters, scenes and other stills are revised by regenerating their image.
// Shots render to video, so the image tools (refine / annotate) don't apply to
// them; they are revised by prompting the agent about the shot instead.
export const isImageEditable = (asset: AssetSelection): boolean =>
  asset.editable && asset.kind !== "clip";
