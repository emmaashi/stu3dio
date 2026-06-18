"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useStudioStore } from "@/store/useStudioStore";
import { useCustomGraphStore } from "@/store/useCustomGraphStore";
import { updateCurrentProject } from "@/data/projectData";
import { useStudioPipeline } from "@/components/studio/useStudioPipeline";
import StudioCanvas, {
  type StudioCanvasHandle,
} from "@/components/studio/StudioCanvas";
import LayersPanel from "@/components/studio/LayersPanel";
import AssetPanel from "@/components/studio/AssetPanel";
import PromptDock from "@/components/studio/PromptDock";
import StepRail from "@/components/studio/StepRail";
import FinalizeModal from "@/components/studio/FinalizeModal";
import { Icon } from "@/components/studio/Icon";
import { resolveSelected } from "@/components/studio/types";
import { isDemoId } from "@/data/demos";
import { recordRecent } from "@/lib/recents";
import FilmPlayer from "@/components/FilmPlayer";
import { Button } from "@/components/studio/Button";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

function StudioWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project") || "";
  const isDemo = isDemoId(projectId);

  const canvasRef = useRef<StudioCanvasHandle>(null);
  const { graph, ready, initError, directorLog, busy, mediaVersion, actions } =
    useStudioPipeline(projectId, isDemo);

  const player = useStudioStore((s) => s.player);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const closePlayer = useStudioStore((s) => s.closePlayer);
  const finalizeOpen = useStudioStore((s) => s.finalizeOpen);
  const openFinalize = useStudioStore((s) => s.openFinalize);
  const closeFinalize = useStudioStore((s) => s.closeFinalize);
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const addCard = useCustomGraphStore((s) => s.addNode);
  const loadCustomGraph = useCustomGraphStore((s) => s.load);

  const [editingTitle, setEditingTitle] = useState(false);
  const [assetOpen, setAssetOpen] = useState(true);

  // Selecting any node should reveal the asset drawer, even if it was collapsed.
  useEffect(() => {
    if (selectedKey) setAssetOpen(true);
  }, [selectedKey]);

  // Load this project's user-drawn cards/connections from localStorage.
  useEffect(() => {
    if (projectId) loadCustomGraph(projectId);
  }, [projectId, loadCustomGraph]);

  // Persist the project's poster into recents so its library card shows a
  // thumbnail (e.g. the Harry Potter project) instead of a blank placeholder.
  useEffect(() => {
    const poster = graph.overview?.poster;
    if (isDemo || !projectId || !poster) return;
    recordRecent({
      id: projectId,
      title: graph.overview?.title || "Untitled",
      poster,
    });
  }, [projectId, isDemo, graph.overview?.poster, graph.overview?.title]);

  async function onGenerateFilm(name: string) {
    try {
      await updateCurrentProject({ title: name });
      if (!isDemo) recordRecent({ id: projectId, title: name });
      await actions.refresh();
      await actions.assembleFilm();
    } catch {
      /* ignore */
    } finally {
      closeFinalize();
    }
  }

  const title = graph.overview?.title || "Untitled";
  async function commitTitle(next: string) {
    const v = next.trim();
    setEditingTitle(false);
    if (!v || v === title) return;
    try {
      await updateCurrentProject({ title: v });
      if (!isDemo) recordRecent({ id: projectId, title: v });
      await actions.refresh();
    } catch {
      /* ignore rename errors */
    }
  }

  async function onSaveOverview(v: {
    title: string;
    summary: string;
    plot: string;
  }) {
    try {
      await updateCurrentProject(v);
      if (!isDemo && v.title.trim())
        recordRecent({ id: projectId, title: v.title.trim() });
      await actions.refresh();
    } catch {
      /* ignore save errors */
    }
  }

  const onRegenerate = () => {
    const key = useStudioStore.getState().selectedKey;
    const detail = resolveSelected(graph, key);
    if (!detail || !key) return;
    if (detail.kind === "character") {
      actions.editAsset(
        { key, refId: detail.character.id, media: detail.character.media },
        "Regenerate this character portrait, keeping the same subject, wardrobe and style."
      );
    } else if (detail.kind === "scene") {
      actions.editAsset(
        { key, refId: detail.scene.id, media: detail.scene.media },
        "Regenerate this establishing shot, keeping the same setting and composition."
      );
    } else if (detail.kind === "clip") {
      actions.editAsset(
        { key, refId: detail.clip.id, media: detail.clip.image_url },
        "Regenerate this frame, keeping the same action, framing and characters."
      );
    }
  };

  if (!projectId) {
    return (
      <div className="fixed inset-0 flex flex-col bg-surface-0 text-ink">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="slate">No project selected.</p>
          <Button variant="primary" onClick={() => router.push("/")}>
            <Icon name="back" size={16} />
            <span>Back to library</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-0 text-ink">
      {/* Body: [back + title + layers] | canvas | asset */}
      <div className="flex-1 min-h-0 flex">
        {/* Left column: navigation + project title sit above the layer tree,
            so there is no separate full-width top bar. */}
        <div className="w-[248px] shrink-0 flex flex-col border-r border-hair bg-surface-1">
          <div className="flex items-center gap-1.5 px-2.5 h-12 border-b border-hair">
            <button
              className="grid place-items-center w-7 h-7 shrink-0 text-ink-3 transition-colors hover:text-ink"
              onClick={() => router.push("/")}
              title="Library"
              aria-label="Back to library"
            >
              <Icon name="back" size={18} />
            </button>
            <button
              className="grid place-items-center w-7 h-7 shrink-0 rounded-btn text-ink-2 border border-hair transition-colors hover:text-ink hover:bg-glass"
              onClick={() => addCard("idea")}
              title="Add a card"
              aria-label="Add a card"
            >
              <Icon name="plus" size={16} />
            </button>
            {editingTitle ? (
              <input
                className="[font-family:var(--font-display)] min-w-0 flex-1 font-bold text-[14px] tracking-[-.01em] text-ink bg-surface-2 border border-white/[.22] rounded-btn px-2 py-1 outline-none"
                autoFocus
                defaultValue={title}
                onBlur={(e) => commitTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
            ) : (
              <button
                className="group min-w-0 flex-1 flex items-center gap-1 px-2 py-1 rounded-btn border border-transparent cursor-text transition-colors hover:bg-glass hover:border-hair"
                onClick={() => setEditingTitle(true)}
                title="Rename project"
              >
                <span className="shrink-0 text-[13px] font-semibold text-ink-4">
                  Project
                </span>
                <span className="shrink-0 text-ink-4">/</span>
                <span className="min-w-0 truncate text-[13px] font-bold tracking-[-.01em] text-ink">
                  {title}
                </span>
                <span className="shrink-0 text-ink-4 transition-colors group-hover:text-ink-2">
                  <Icon name="caretDown" size={13} />
                </span>
              </button>
            )}
          </div>

          {(!ready || initError) && (
            <div className="px-3 py-1.5 border-b border-hair">
              {!ready && <span className="slate">Loading…</span>}
              {initError && (
                <span
                  className="block text-[#ffb45e] text-xs font-medium truncate"
                  title={initError}
                >
                  Offline · {initError}
                </span>
              )}
            </div>
          )}

          <LayersPanel graph={graph} />
        </div>

        <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-surface-0 flex flex-col">
          <StepRail
            graph={graph}
            busy={busy}
            onGenerateCast={actions.generateCast}
            onGenerateScenes={actions.enhanceAndGenerateScenes}
            onGenerateFilm={openFinalize}
          />
          <StudioCanvas
            ref={canvasRef}
            graph={graph}
            mediaVersion={mediaVersion}
            busy={busy}
            onPlayFilm={openPlayer}
          />
          <PromptDock
            graph={graph}
            version={mediaVersion}
            busy={busy}
            directorLog={directorLog}
            actions={actions}
          />

          {/* Edge tab to reopen the asset drawer when it's collapsed. */}
          <AnimatePresence>
            {!assetOpen && (
              <motion.button
                className="absolute top-1/2 right-0 -translate-y-1/2 z-[9] grid place-items-center w-[22px] h-[60px] rounded-l-[10px] text-ink-2 border border-r-0 border-hair bg-glass-2 backdrop-blur-md transition-colors hover:text-ink hover:bg-glass"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2, ease: EASE_CINE }}
                onClick={() => setAssetOpen(true)}
                title="Show asset panel"
                aria-label="Show asset panel"
              >
                <Icon name="caretLeft" size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence initial={false}>
          {assetOpen && (
            <motion.div
              key="asset"
              className="shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_CINE }}
            >
              <AssetPanel
                graph={graph}
                version={mediaVersion}
                busy={busy}
                onRegenerate={onRegenerate}
                onSaveOverview={onSaveOverview}
                onCollapse={() => setAssetOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Finalize: name + generate the film */}
      <AnimatePresence>
        {finalizeOpen && (
          <FinalizeModal
            defaultName={title}
            busy={!!busy["film"]}
            onGenerate={onGenerateFilm}
            onClose={closeFinalize}
          />
        )}
      </AnimatePresence>

      {/* Fullscreen film player */}
      <AnimatePresence>
        {player && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.38, ease: EASE_CINE }}
          >
            <button
              className="absolute top-[18px] right-[18px] z-[90] w-[42px] h-[42px] rounded-full grid place-items-center text-white bg-white/[.12] border border-white/20 backdrop-blur-md transition-colors hover:bg-white/[.22]"
              onClick={closePlayer}
              aria-label="Close player"
            >
              <Icon name="x" size={20} />
            </button>
            <div className="absolute top-[22px] left-6 z-[90] text-white font-bold text-base tracking-[-.01em] [text-shadow:0_2px_12px_rgba(0,0,0,.6)]">
              {player.title}
            </div>
            <FilmPlayer src={player.src} autoplay />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex flex-col bg-surface-0 text-ink">
          <div className="flex-1 flex flex-col items-center justify-center gap-4 slate">
            Loading studio…
          </div>
        </div>
      }
    >
      <StudioWorkspace />
    </Suspense>
  );
}
