"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import StepRail from "@/components/studio/StepRail";
import AgentRail, {
  type AgentRailComposerState,
  type AgentRailHandle,
} from "@/components/studio/AgentRail";
import { PromptBar } from "@/components/beautiful-ui";
import { Icon } from "@/components/studio/Icon";
import {
  resolveAssetSelection,
  resolveSelected,
  type AssetSelection,
} from "@/components/studio/types";
import { isDemoId } from "@/films";
import { recordRecent } from "@/lib/recents";
import FilmPlayer from "@/components/FilmPlayer";
import { Button } from "@/components/studio/Button";
import { Link2, MessagesSquare } from "lucide-react";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

function StudioWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project") || "";
  const isDemo = isDemoId(projectId);

  const canvasRef = useRef<StudioCanvasHandle>(null);
  const agentRailRef = useRef<AgentRailHandle>(null);
  const { graph, ready, initError, busy, mediaVersion, actions } =
    useStudioPipeline(projectId, isDemo);

  // A brand-new film (no cast or scenes yet) shows the centered "start your
  // film" composer instead of the empty pipeline board.
  const boardEmpty =
    !isDemo && graph.characters.length === 0 && graph.scenes.length === 0;
  const isNewVideo =
    !isDemo &&
    graph.hasProject &&
    graph.characters.length === 0 &&
    graph.objects.length === 0 &&
    graph.scenes.length === 0 &&
    !graph.overview?.summary?.trim() &&
    !graph.overview?.plot?.trim() &&
    !graph.overview?.finalVideoUrl;

  const player = useStudioStore((s) => s.player);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const closePlayer = useStudioStore((s) => s.closePlayer);
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const select = useStudioStore((s) => s.select);
  const setSelection = useStudioStore((s) => s.setSelection);
  const addCard = useCustomGraphStore((s) => s.addNode);
  const loadCustomGraph = useCustomGraphStore((s) => s.load);

  const [editingTitle, setEditingTitle] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [agentComposerState, setAgentComposerState] = useState<AgentRailComposerState>({
    disabled: false,
    awaitingApproval: false,
    editingSelection: false,
  });

  // Load this project's user-drawn cards/connections from localStorage.
  useEffect(() => {
    if (projectId) loadCustomGraph(projectId);
  }, [projectId, loadCustomGraph]);

  useEffect(() => {
    select(null);
  }, [projectId, select]);

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

  const selectedDetail = resolveSelected(graph, selectedKey);
  const selectedAssets = useMemo(
    () => selectedKeys
      .map((key) => resolveAssetSelection(graph, key))
      .filter((selection): selection is AssetSelection => !!selection),
    [graph, selectedKeys]
  );
  const selectedLabel = selectedAssets.length > 1
    ? `${selectedAssets.length} assets selected`
    : selectedAssets[0]?.label || (selectedDetail?.kind === "character"
    ? selectedDetail.character.name
    : selectedDetail?.kind === "scene"
      ? `Scene ${selectedDetail.scene.order}`
      : selectedDetail?.kind === "clip"
        ? selectedDetail.clip.label
        : selectedDetail?.kind === "overview"
          ? "Project overview"
          : selectedDetail?.kind === "film"
            ? "Final film"
          : undefined);
  const contextOptions = useMemo(() => [
    ...graph.characters.map((character) => ({ id: character.id, label: character.name, kind: "character" as const })),
    ...graph.objects.map((object) => ({ id: object.id, label: object.name, kind: "object" as const })),
    ...graph.scenes.map((scene) => ({ id: scene.id, label: `Scene ${scene.order}`, kind: "scene" as const })),
  ], [graph.characters, graph.objects, graph.scenes]);

  async function onEditSelection(prompt: string, keys: string[]) {
    const editable = keys
      .map((key) => resolveAssetSelection(graph, key))
      .filter((selection) => selection?.editable && selection.media);
    await Promise.all(editable.map((selection) => actions.editAsset(
      { key: selection!.key, refId: selection!.id, media: selection!.media },
      prompt
    )));
    return editable.length;
  }

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
        {/* Left column: collapsible layers + nav */}
        <AnimatePresence initial={false}>
          {layersOpen && (
            <motion.div
              key="layers"
              className="shrink-0 overflow-hidden flex flex-col border-r border-hair bg-surface-1"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 248, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_CINE }}
            >
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

          <LayersPanel graph={graph} onCollapse={() => setLayersOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-surface-0 flex flex-col">
          <StepRail
            graph={graph}
            heroActive={boardEmpty}
          />
          <StudioCanvas
            ref={canvasRef}
            graph={graph}
            mediaVersion={mediaVersion}
            busy={busy}
            onPlayFilm={openPlayer}
          />
          <div className="project-prompt-dock agent-ui" aria-label="Project agent composer">
            <div className="project-prompt-dock__topline">
              <button
                type="button"
                className="project-prompt-dock__history"
                onClick={() => agentRailRef.current?.openAgent({ history: true })}
                aria-label="Open conversation history"
              >
                <MessagesSquare size={14} />
                <span>Conversations</span>
              </button>
              <span className="project-prompt-dock__context-help">
                <Link2 size={12} />
                {selectedAssets.length
                  ? `${selectedAssets.length} ${selectedAssets.length === 1 ? "asset" : "assets"} linked to this prompt`
                  : "Shift-click cards to link assets"}
              </span>
            </div>
            <PromptBar
              disabled={agentComposerState.disabled}
              placeholder={agentComposerState.awaitingApproval
                ? "Review the pending approval in Agent…"
                : selectedAssets.length === 1
                  ? `Ask about or revise ${selectedAssets[0].label}…`
                  : selectedAssets.length > 1
                    ? `Describe one change for ${selectedAssets.length} linked assets…`
                    : isNewVideo
                      ? "Describe the film you want to make…"
                      : "Ask the agent to revise this film…"}
              suggestions={isNewVideo ? [
                "A tense one-location thriller",
                "A surreal sci-fi memory",
                "A quiet character drama",
              ] : []}
              contexts={selectedAssets.map((asset) => ({
                id: asset.key,
                label: asset.label,
                onClear: () => select(asset.key, { additive: true }),
              }))}
              contextOptions={contextOptions}
              onUploadAttachment={(file) => {
                const rail = agentRailRef.current;
                if (!rail) return Promise.reject(new Error("Agent is still loading"));
                return rail.uploadAttachment(file);
              }}
              onSend={(text, attachments) => agentRailRef.current?.submitPrompt(text, attachments)}
            />
          </div>
          {/* Edge tab to reopen the layers panel when collapsed. */}
          <AnimatePresence>
            {!layersOpen && (
              <motion.button
                className="absolute top-1/2 left-0 -translate-y-1/2 z-[9] grid place-items-center w-[22px] h-[60px] rounded-r-[10px] text-ink-2 border border-l-0 border-hair bg-glass-2 backdrop-blur-md transition-colors hover:text-ink hover:bg-glass"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: EASE_CINE }}
                onClick={() => setLayersOpen(true)}
                title="Show layers panel"
                aria-label="Show layers panel"
              >
                <Icon name="caretRight" size={16} />
              </motion.button>
            )}
          </AnimatePresence>

        </main>
        <AgentRail
          ref={agentRailRef}
          projectId={projectId}
          graph={graph}
          isNewVideo={isNewVideo}
          selectedLabel={selectedLabel}
          selectedAssets={selectedAssets}
          externalComposer
          onEditSelection={onEditSelection}
          onSelectAssets={setSelection}
          onComposerStateChange={setAgentComposerState}
          onRefresh={actions.refresh}
          onPlay={(url) => openPlayer(url, graph.overview?.title || "Film")}
          inspector={
            <AssetPanel
              graph={graph}
              version={mediaVersion}
              busy={busy}
              onSaveOverview={onSaveOverview}
            />
          }
        />
      </div>

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
