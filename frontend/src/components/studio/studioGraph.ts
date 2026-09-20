import type { CharN, Clip, ObjectN, SceneN, StudioGraph } from "./types";

// Only fields consumed by the canvas adapter are specified here. Additional
// backend metadata passes through intact for asset details and inherited context.
type PipelineMetadata = Record<string, unknown> & {
  name?: string;
  type?: string;
  role?: string;
  frame_order?: number;
  scene_order?: number;
  concise_plot?: string;
  detailed_plot?: string;
  summary?: string;
  castIds?: string[];
};

type PipelineAsset = {
  id?: string;
  scene_id?: string;
  media_url?: string;
  video_url?: string;
  loading?: boolean;
  castIds?: string[];
  metadata?: PipelineMetadata;
};

export type StudioPipelineStatus = {
  characters?: PipelineAsset[];
  objects?: PipelineAsset[];
  scenes?: PipelineAsset[];
  frames?: PipelineAsset[];
  completion_status?: string;
};

/**
 * What an approved plan says is coming. Anything here that the pipeline has not
 * created yet is added to the graph as a skeleton card, so the board takes its
 * final shape the moment production starts and fills in as jobs land.
 */
export type ExpectedProduction = {
  /** The final film is being assembled from the finished shots. */
  assembling?: boolean;
  characters?: Array<{ name?: unknown; role?: unknown }>;
  scenes?: Array<{
    id?: unknown;
    title?: unknown;
    concise_plot?: unknown;
    scene_order?: unknown;
    target_frames?: unknown;
  }>;
};

export function buildStudioGraph(
  status: StudioPipelineStatus | null | undefined,
  overview: StudioGraph["overview"],
  expected?: ExpectedProduction | null,
): StudioGraph {
  const characters: CharN[] = (status?.characters || []).map(
    (character, index) => ({
      id: character.id || `char-${index}`,
      name: character.metadata?.name || `Character ${index + 1}`,
      role: character.metadata?.role || "",
      media: character.media_url,
      loading: character.loading === true,
      meta: character.metadata,
    }),
  );

  const knownNames = new Set(
    characters.map((character) => character.name.trim().toLowerCase()),
  );
  (expected?.characters || []).forEach((planned, index) => {
    const name = String(planned.name || "").trim();
    if (!name || knownNames.has(name.toLowerCase())) return;
    knownNames.add(name.toLowerCase());
    characters.push({
      id: `planned-char-${index}`,
      name,
      role: String(planned.role || ""),
      loading: true,
      skeleton: true,
    });
  });

  const objects: ObjectN[] = (status?.objects || []).map((object, index) => ({
    id: object.id || `object-${index}`,
    name:
      object.metadata?.type || object.metadata?.name || `Object ${index + 1}`,
    media: object.media_url,
    meta: object.metadata,
  }));

  const clipsByScene = new Map<string | undefined, Clip[]>();
  (status?.frames || []).forEach((frame, index) => {
    const sceneId = frame.scene_id || "unknown";
    const clip: Clip = {
      id: frame.id || `clip-${index}`,
      sceneId,
      order:
        frame.metadata?.frame_order ?? frame.metadata?.scene_order ?? index,
      status: frame.video_url
        ? "completed"
        : frame.media_url
          ? "generating"
          : "pending",
      video_url: frame.video_url,
      image_url: frame.media_url,
      label:
        frame.metadata?.concise_plot ||
        frame.metadata?.summary ||
        `Clip ${index + 1}`,
      meta: frame.metadata,
    };
    const sceneClips = clipsByScene.get(sceneId) || [];
    sceneClips.push(clip);
    clipsByScene.set(sceneId, sceneClips);
  });
  clipsByScene.forEach((clips) => clips.sort((a, b) => a.order - b.order));

  const scenes: SceneN[] = (status?.scenes || []).map((scene, index) => ({
    id: scene.id || `scene-${index}`,
    order: scene.metadata?.scene_order ?? index + 1,
    plot: scene.metadata?.concise_plot || scene.metadata?.detailed_plot || "",
    media: scene.media_url,
    loading: scene.loading === true,
    clips: clipsByScene.get(scene.id) || [],
    castIds: scene.castIds ?? scene.metadata?.castIds,
    meta: scene.metadata,
  }));

  const knownOrders = new Set(scenes.map((scene) => scene.order));
  (expected?.scenes || []).forEach((planned, index) => {
    const order = Number(planned.scene_order ?? index + 1);
    if (knownOrders.has(order)) return;
    knownOrders.add(order);
    const id = `planned-scene-${String(planned.id || index)}`;
    const shots = Math.max(1, Number(planned.target_frames || 1) || 1);
    scenes.push({
      id,
      order,
      plot: String(planned.title || planned.concise_plot || ""),
      loading: true,
      skeleton: true,
      clips: Array.from({ length: shots }, (_, shot) => ({
        id: `${id}-shot-${shot}`,
        sceneId: id,
        order: shot,
        status: "pending" as const,
        label: "",
        skeleton: true,
      })),
    });
  });
  scenes.sort((a, b) => a.order - b.order);

  const allClips = scenes
    .flatMap((scene) => scene.clips)
    .filter((clip) => !clip.skeleton);
  const complete =
    status?.completion_status === "complete" ||
    (allClips.length > 0 &&
      !scenes.some((scene) => scene.skeleton) &&
      allClips.every((clip) => clip.status === "completed"));

  return {
    overview,
    characters,
    objects,
    scenes,
    complete,
    hasProject: true,
    assembling: !!expected?.assembling && !overview?.finalVideoUrl,
  };
}
