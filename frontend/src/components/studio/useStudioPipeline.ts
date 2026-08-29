"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  setActiveProject,
  getCurrentProject,
  updateCurrentProject,
  getCompleteProjectStatus,
  loadDemoProject,
} from "@/data/projectData";
import {
  sendToDirector,
  getConversationHistory,
  generateCharactersFromDirector,
  type DirectorMessage,
} from "@/data/directorData";
import { enhanceScript } from "@/data/scriptData";
import {
  loadCharacters,
  generateAllScenes,
  getCurrentCharacters,
} from "@/data/characterData";
import { projectApi, jobApi } from "@/utils/api";
import { useBackendStore } from "@/store/backendStore";
import { getDemo } from "@/films";
import {
  EMPTY_GRAPH,
  type StudioGraph,
  type Clip,
  type ClipStatus,
  type CharN,
  type ObjectN,
  type SceneN,
  type GNode,
} from "./types";

// Poll fairly briskly so the mock's staggered generation (cast -> scenes ->
// shots) reveals smoothly rather than jumping in coarse batches.
const POLL_MS = 1200;

// Builds the studio graph from a getCompleteProjectStatus() payload.
function toGraph(
  status: any,
  overview: StudioGraph["overview"]
): StudioGraph {
  const rawScenes = (status?.scenes || []) as any[];
  const rawChars = (status?.characters || []) as any[];
  const rawObjects = (status?.objects || []) as any[];
  const rawFrames = (status?.frames || []) as any[];

  const characters: CharN[] = rawChars.map((c, i) => ({
    id: c.id || `char-${i}`,
    name: c.metadata?.name || `Character ${i + 1}`,
    role: c.metadata?.role || "",
    media: c.media_url,
    loading: c.loading === true,
    meta: c.metadata,
  }));

  const objects: ObjectN[] = rawObjects.map((object, index) => ({
    id: object.id || `object-${index}`,
    name: object.metadata?.type || object.metadata?.name || `Object ${index + 1}`,
    media: object.media_url,
    meta: object.metadata,
  }));

  const byScene = new Map<string, Clip[]>();
  rawFrames.forEach((f, i) => {
    let s: ClipStatus = "pending";
    if (f.video_url) s = "completed";
    else if (f.media_url) s = "generating";
    const sid = f.scene_id || "unknown";
    const clip: Clip = {
      id: f.id || `clip-${i}`,
      sceneId: sid,
      order: f.metadata?.frame_order ?? f.metadata?.scene_order ?? i,
      status: s,
      video_url: f.video_url,
      image_url: f.media_url,
      label: f.metadata?.concise_plot || f.metadata?.summary || `Clip ${i + 1}`,
      meta: f.metadata,
    };
    if (!byScene.has(sid)) byScene.set(sid, []);
    byScene.get(sid)!.push(clip);
  });
  byScene.forEach((arr) => arr.sort((a, b) => a.order - b.order));

  const scenes: SceneN[] = rawScenes
    .map((s, i) => ({
      id: s.id || `scene-${i}`,
      order: s.metadata?.scene_order ?? i + 1,
      plot: s.metadata?.concise_plot || s.metadata?.detailed_plot || "",
      media: s.media_url,
      loading: s.loading === true,
      clips: byScene.get(s.id) || [],
      castIds: s.castIds ?? s.metadata?.castIds,
      meta: s.metadata,
    }))
    .sort((a, b) => a.order - b.order);

  const allClips = scenes.flatMap((s) => s.clips);
  const complete =
    status?.completion_status === "complete" ||
    (allClips.length > 0 && allClips.every((c) => c.status === "completed"));

  return { overview, characters, objects, scenes, complete, hasProject: true };
}

export type StudioActions = {
  sendDirector: (text: string) => Promise<void>;
  generateCast: () => Promise<void>;
  enhanceAndGenerateScenes: (direction?: string) => Promise<void>;
  editAsset: (
    node: { key: string; refId?: string; media?: string },
    prompt: string,
    compositeDataUrl?: string | null
  ) => Promise<void>;
  generateFrameVideo: (clip: Clip) => Promise<void>;
  assembleFilm: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useStudioPipeline(projectId: string, isDemo: boolean) {
  const [graph, setGraph] = useState<StudioGraph>(EMPTY_GRAPH);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [directorLog, setDirectorLog] = useState<DirectorMessage[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [mediaVersion, setMediaVersion] = useState(0);
  const setStoreProjectId = useBackendStore((s) => s.setProjectId);
  const pollingRef = useRef(false);

  const mark = (k: string, v: boolean) =>
    setBusy((b) => ({ ...b, [k]: v }));

  // --- project init ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      setInitError(null);
      try {
        if (isDemo) {
          loadDemoProject(projectId);
        } else {
          await setActiveProject(projectId);
          setStoreProjectId(projectId);
          setDirectorLog(getConversationHistory());
        }
      } catch (e) {
        if (!cancelled)
          setInitError(
            e instanceof Error ? e.message : "Failed to load project"
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, isDemo, setStoreProjectId]);

  // --- poll the pipeline (read-only) ---
  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    const cur = getCurrentProject();
    const baseOverview = cur
      ? { title: cur.title || "Untitled", summary: cur.summary || "", plot: cur.plot || "" }
      : null;
    try {
      const status = await getCompleteProjectStatus();
      let finalVideoUrl: string | undefined;
      let poster: string | undefined;
      if (isDemo) {
        const demo = getDemo(projectId);
        finalVideoUrl = demo?.finalVideo;
        poster = demo?.poster;
      } else {
        try {
          const p: any = await projectApi.getById(projectId);
          finalVideoUrl = p?.final_video_url || undefined;
          poster = p?.poster_url || p?.thumbnail_url || undefined;
        } catch {
          /* ignore */
        }
      }
      setGraph(
        toGraph(
          status,
          baseOverview ? { ...baseOverview, finalVideoUrl, poster } : null
        )
      );
    } catch (err) {
      // Keep a usable overview node even if the pipeline call fails.
      setGraph({
        overview: baseOverview,
        characters: [],
        objects: [],
        scenes: [],
        complete: false,
        hasProject: !!cur,
      });
    } finally {
      pollingRef.current = false;
    }
  }, [projectId, isDemo]);

  useEffect(() => {
    if (!ready) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [ready, poll]);

  // --- helpers ---
  const pollJobUntilDone = useCallback(
    async (jobId: string, timeoutMs = 180000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const s = await jobApi.getStatus(jobId);
          if (s.status === "completed" || s.status === "failed") return s;
        } catch {
          /* keep waiting */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return null;
    },
    []
  );

  // --- actions ---
  const sendDirector = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt) return;
      mark("director", true);
      try {
        const resp = await sendToDirector(prompt);
        setDirectorLog(getConversationHistory());

        if (resp.plot_points.length > 0 && getCurrentProject()) {
          const plotSummary = resp.plot_points.join("\n\n");
          const characterSummary =
            resp.characters.length > 0
              ? resp.characters
                  .map(
                    (c: any) => `${c.name} (${c.role}): ${c.description}`
                  )
                  .join("\n")
              : "";
          const fullPlot = characterSummary
            ? `Plot:\n${plotSummary}\n\nCharacters:\n${characterSummary}`
            : plotSummary;
          try {
            await updateCurrentProject({
              plot: fullPlot,
              summary: resp.plot_points[0] || "Film project in development",
            });
          } catch {
            /* ignore save errors */
          }
        }

        // Gated flow: the director only shapes the concept here. The user then
        // advances each stage explicitly (Generate the cast -> Break into
        // scenes -> Generate final film) rather than auto-running everything.
        await poll();
      } finally {
        mark("director", false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [poll]
  );

  const enhanceAndGenerateScenes = useCallback(async (direction?: string) => {
    mark("scenes", true);
    try {
      const cur = getCurrentProject();
      if (!cur) throw new Error("No project");
      let chars = getCurrentCharacters();
      if (!chars.length) {
        try {
          chars = await loadCharacters();
        } catch {
          /* ignore */
        }
      }
      const basePlot = cur.plot || cur.summary || "";
      // The user's scene direction rides along in base_plot, which the backend's
      // script enhancement feeds into the scene-breakdown prompt (and on into
      // each scene's plot_context).
      const dir = direction?.trim();
      const plotForScenes = dir
        ? `${basePlot}\n\nDirector's notes for the scenes:\n${dir}`
        : basePlot;
      try {
        await enhanceScript(plotForScenes, chars);
      } catch (e) {
        console.error("script enhancement failed", e);
      }
      await generateAllScenes();
      await poll();
    } finally {
      mark("scenes", false);
    }
  }, [poll]);

  // Cast generation, split out of sendDirector so the user triggers it from the
  // step rail once they're happy with the concept.
  const generateCast = useCallback(async () => {
    mark("characters", true);
    try {
      await generateCharactersFromDirector();
      await poll();
    } catch (e) {
      console.error("character generation failed", e);
    } finally {
      mark("characters", false);
    }
  }, [poll]);

  const editAsset = useCallback(
    async (
      node: { key: string; refId?: string; media?: string },
      prompt: string,
      compositeDataUrl?: string | null
    ) => {
      const cur = getCurrentProject();
      if (!cur) return;
      const source = compositeDataUrl || node.media;
      if (!source) return;
      mark(node.key, true);
      try {
        const { job_id } = await jobApi.createImageEditing({
          project_id: cur.id,
          source_url: source,
          edit_prompt: prompt,
          metadata: { source: "studio_canvas", node: node.key, refId: node.refId },
        });
        await pollJobUntilDone(job_id);
        // The edit worker replaces the file at the same storage path, so the URL
        // is unchanged — bump a version token to bust the image cache.
        setMediaVersion((v) => v + 1);
        await poll();
      } finally {
        mark(node.key, false);
      }
    },
    [poll, pollJobUntilDone]
  );

  const generateFrameVideo = useCallback(
    async (clip: Clip) => {
      const cur = getCurrentProject();
      if (!cur) return;
      mark(`clip-${clip.id}`, true);
      try {
        const { job_id } = await jobApi.createVideoGeneration({
          project_id: cur.id,
          prompt: clip.meta?.veo3_prompt || clip.label,
          image_url: clip.image_url,
          duration: 8,
          metadata: { frame_id: clip.id },
        });
        await pollJobUntilDone(job_id);
        await poll();
      } finally {
        mark(`clip-${clip.id}`, false);
      }
    },
    [poll, pollJobUntilDone]
  );

  const assembleFilm = useCallback(async () => {
    const cur = getCurrentProject();
    if (!cur) return;
    mark("film", true);
    try {
      const videoUrls = graph.scenes
        .flatMap((s) => s.clips)
        .filter((c) => c.status === "completed" && c.video_url)
        .map((c) => c.video_url!) as string[];
      if (videoUrls.length === 0) return;
      const { job_id } = await jobApi.createVideoStitching({
        project_id: cur.id,
        video_urls: videoUrls,
        output_name: (cur.title || "final").replace(/\s+/g, "_").toLowerCase(),
      });
      await pollJobUntilDone(job_id, 300000);
      await poll();
    } finally {
      mark("film", false);
    }
  }, [graph, poll, pollJobUntilDone]);

  const actions: StudioActions = {
    sendDirector,
    generateCast,
    enhanceAndGenerateScenes,
    editAsset,
    generateFrameVideo,
    assembleFilm,
    refresh: poll,
  };

  return { graph, ready, initError, directorLog, busy, mediaVersion, actions };
}

// Append a cache-busting token to a media URL (skips data: URLs and blanks).
export function bust(url: string | undefined, version: number): string | undefined {
  if (!url) return url;
  if (url.startsWith("data:")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${version}`;
}

export type { GNode };
