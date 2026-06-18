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
  // raw frame metadata (veo3_prompt, dialogue, summary, ...) for the Asset panel
  meta?: Record<string, any>;
};

export type SceneN = {
  id: string;
  order: number;
  plot: string;
  media?: string;
  loading?: boolean;
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
  scenes: SceneN[];
  complete: boolean;
  hasProject: boolean;
};

export const EMPTY_GRAPH: StudioGraph = {
  overview: null,
  characters: [],
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
};

// Resolve the source entity for a selected node key.
export type SelectedDetail =
  | { kind: "overview"; overview: Overview }
  | { kind: "character"; character: CharN }
  | { kind: "scene"; scene: SceneN }
  | { kind: "clip"; clip: Clip; scene?: SceneN }
  | { kind: "film"; overview: Overview | null }
  | null;

export function resolveSelected(
  graph: StudioGraph,
  key: string | null
): SelectedDetail {
  if (!key) return null;
  if (key === "overview") {
    return graph.overview ? { kind: "overview", overview: graph.overview } : null;
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
