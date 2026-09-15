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

export function buildStudioGraph(
  status: StudioPipelineStatus | null | undefined,
  overview: StudioGraph["overview"],
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

  const scenes: SceneN[] = (status?.scenes || [])
    .map((scene, index) => ({
      id: scene.id || `scene-${index}`,
      order: scene.metadata?.scene_order ?? index + 1,
      plot: scene.metadata?.concise_plot || scene.metadata?.detailed_plot || "",
      media: scene.media_url,
      loading: scene.loading === true,
      clips: clipsByScene.get(scene.id) || [],
      castIds: scene.castIds ?? scene.metadata?.castIds,
      meta: scene.metadata,
    }))
    .sort((a, b) => a.order - b.order);

  const allClips = scenes.flatMap((scene) => scene.clips);
  const complete =
    status?.completion_status === "complete" ||
    (allClips.length > 0 &&
      allClips.every((clip) => clip.status === "completed"));

  return { overview, characters, objects, scenes, complete, hasProject: true };
}
