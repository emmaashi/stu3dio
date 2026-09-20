"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowUpRight,
  Layers2,
  MessagesSquare,
  PanelLeftClose,
  Pencil,
} from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { useCustomGraphStore } from "@/store/useCustomGraphStore";
import { updateCurrentProject } from "@/data/projectData";
import { useStudioPipeline } from "@/components/studio/useStudioPipeline";
import StudioCanvas, {
  type StudioCanvasHandle,
} from "@/components/studio/StudioCanvas";
import LayersPanel from "@/components/studio/LayersPanel";
import AssetPanel from "@/components/studio/AssetPanel";
import StoryBrief from "@/components/studio/StoryBrief";
import AnnotateModal from "@/components/studio/AnnotateModal";
import AgentRail, {
  type AgentRailComposerState,
  type AgentRailHandle,
} from "@/components/studio/AgentRail";
import { resolveFilmAction } from "@/components/studio/filmAction";
import {
  assetComposerPlaceholder,
  fineTunePrompt,
} from "@/components/studio/assetPrompts";
import {
  PromptBar,
  type PromptBarHandle,
} from "@/components/beautiful-ui/PromptBar";
import {
  isImageEditable,
  resolveAssetSelection,
  type AssetSelection,
} from "@/components/studio/types";
import { isDemoId } from "@/films";
import { recordRecent } from "@/lib/recents";
import FilmPlayer from "@/components/FilmPlayer";
import WorkspaceBrand from "@/components/studio/WorkspaceBrand";
import { buildContextOptions } from "@/components/studio/studioContext";
import "./workspace.css";

function StudioWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project") || "";
  const isDemo = isDemoId(projectId);
  const canvasRef = useRef<StudioCanvasHandle>(null);
  const promptRef = useRef<PromptBarHandle>(null);
  const agentRailRef = useRef<AgentRailHandle>(null);
  const { graph, ready, initError, busy, mediaVersion, actions } =
    useStudioPipeline(projectId, isDemo);
  const isNewVideo =
    !isDemo &&
    graph.hasProject &&
    !graph.characters.length &&
    !graph.scenes.length &&
    !graph.overview?.plot?.trim();
  const boardEmpty = !graph.characters.length && !graph.scenes.length;
  const player = useStudioStore((s) => s.player);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const closePlayer = useStudioStore((s) => s.closePlayer);
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const briefOpen = selectedKeys.length === 1 && selectedKeys[0] === "overview";
  const select = useStudioStore((s) => s.select);
  const setSelection = useStudioStore((s) => s.setSelection);
  const loadCustomGraph = useCustomGraphStore((s) => s.load);
  const [editingTitle, setEditingTitle] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const revealPrompt = useCallback(() => {
    requestAnimationFrame(() => promptRef.current?.focus());
  }, []);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState<AssetSelection | null>(null);
  const [agentComposerState, setAgentComposerState] =
    useState<AgentRailComposerState>({
      disabled: false,
      awaitingApproval: false,
      runActive: false,
      runPhase: null,
      threadHasMessages: false,
      editingSelection: false,
      conversationsOpen: false,
    });
  const filmAction = resolveFilmAction(graph, agentComposerState);
  // One composer, not two: it sits in the centre dock until the conversation
  // panel opens, then moves into the panel so a thread is a back-and-forth.
  const composerInRail = agentComposerState.conversationsOpen;

  useEffect(() => {
    if (projectId) loadCustomGraph(projectId);
    select(null);
  }, [projectId, loadCustomGraph, select]);
  // /studio is meaningless without a film, so fall back to the library instead
  // of rendering a screen whose only action is to go there.
  useEffect(() => {
    if (!projectId) router.replace("/");
  }, [projectId, router]);
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 900px)");
    const update = () => {
      if (compact.matches) setLayersOpen(false);
    };
    update();
    compact.addEventListener("change", update);
    return () => compact.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (briefOpen && window.innerWidth <= 900) setLayersOpen(false);
  }, [briefOpen, selectedKeys]);
  useEffect(() => {
    if (!isDemo && projectId && graph.overview?.poster)
      recordRecent({
        id: projectId,
        title: graph.overview.title,
        poster: graph.overview.poster,
      });
  }, [projectId, isDemo, graph.overview?.poster, graph.overview?.title]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, [contenteditable=true], [data-film-player], [data-annotation-editor], [data-story-brief]",
        )
      )
        return;
      if (event.key === "Escape") {
        closePlayer();
        setAnnotation(null);
        select(null);
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        revealPrompt();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePlayer, select, revealPrompt]);

  const title = graph.overview?.title || "Untitled film";
  const selectedAssets = useMemo(
    () =>
      selectedKeys
        .map((key) => resolveAssetSelection(graph, key))
        .filter((asset): asset is AssetSelection => !!asset),
    [graph, selectedKeys],
  );
  const contextOptions = useMemo(
    () =>
      buildContextOptions({
        characters: graph.characters,
        objects: graph.objects,
        scenes: graph.scenes,
      }),
    [graph.characters, graph.objects, graph.scenes],
  );

  async function onSaveOverview(values: {
    title: string;
    summary: string;
    plot: string;
  }) {
    setSaveError(null);
    await updateCurrentProject(values);
    if (!isDemo) recordRecent({ id: projectId, title: values.title });
    await actions.refresh();
  }
  async function commitTitle(next: string) {
    setEditingTitle(false);
    if (!next.trim() || next.trim() === title) return;
    try {
      await updateCurrentProject({ title: next.trim() });
      if (!isDemo) recordRecent({ id: projectId, title: next.trim() });
      await actions.refresh();
    } catch {
      setSaveError("The title could not be saved. Please try again.");
    }
  }
  async function onEditSelection(prompt: string, keys: string[]) {
    const editable = keys
      .map((key) => resolveAssetSelection(graph, key))
      .filter(
        (asset): asset is AssetSelection =>
          !!asset && isImageEditable(asset) && !!asset.media,
      );
    await Promise.all(
      editable.map((asset) =>
        actions.editAsset(
          { key: asset.key, refId: asset.id, media: asset.media },
          prompt,
        ),
      ),
    );
    return editable.length;
  }
  const draft = useCallback(
    (text: string, wholeFilm = false) => {
      if (wholeFilm) select(null);
      revealPrompt();
      promptRef.current?.setDraft(
        text,
        wholeFilm ? `${projectId}:film` : undefined,
      );
    },
    [projectId, select, revealPrompt],
  );
  const draftForFilm = useCallback(
    (text: string) => draft(text, true),
    [draft],
  );

  if (!projectId) return null;

  const composer = (
    <div className="studio-composer">
      {ready && boardEmpty && !isDemo && (
        <label className="studio-composer-title">
          <span>Title</span>
          <input
            defaultValue={title === "Untitled film" ? "" : title}
            placeholder="Name your film"
            maxLength={80}
            aria-label="Film title"
            onBlur={(event) => void commitTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
                promptRef.current?.focus();
              }
            }}
          />
        </label>
      )}
      <PromptBar
        draftKey={`${projectId}:${selectedKeys.length ? [...selectedKeys].sort().join("|") : "film"}`}
        ref={promptRef}
        disabled={agentComposerState.disabled || !ready}
        tone={agentComposerState.awaitingApproval ? "revision" : "default"}
        placeholder={
          agentComposerState.awaitingApproval
            ? "Describe what should change…"
            : assetComposerPlaceholder(
                selectedAssets,
                isNewVideo
                  ? "A film about…"
                  : "Where should the story go next?",
              )
        }
        suggestions={[]}
        contexts={(selectedAssets.length > 1 &&
        !agentComposerState.threadHasMessages
          ? []
          : selectedAssets
        ).map((asset) => ({
          id: asset.key,
          label: asset.label,
          media: asset.media,
          onClear: () => select(asset.key, { additive: true }),
        }))}
        contextOptions={contextOptions}
        allowExtras={
          !agentComposerState.awaitingApproval &&
          !selectedAssets.some(isImageEditable)
        }
        onUploadAttachment={(file) =>
          agentRailRef.current!.uploadAttachment(file)
        }
        onSend={(text, attachments) =>
          agentRailRef.current?.submitPrompt(text, attachments)
        }
      />
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="studio-workspace">
        <header
          className="studio-header"
          inert={briefOpen ? true : undefined}
          aria-hidden={briefOpen || undefined}
        >
          <WorkspaceBrand onClick={() => router.push("/")} />
          <span className="studio-header-divider" />
          {editingTitle ? (
            <input
              className="studio-title-input"
              autoFocus
              defaultValue={title}
              aria-label="Film title"
              onBlur={(e) => void commitTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <button
              className="studio-project-title"
              onClick={() => setEditingTitle(true)}
              title="Rename film"
            >
              {title}
              <Pencil size={12} />
            </button>
          )}
          <span className="studio-project-state">
            {isDemo ? "Sample film" : "Workspace"}
          </span>
          <div className="studio-header-actions">
            <button
              className="studio-icon-button studio-history-toggle"
              aria-label="Conversations"
              title="Conversations"
              onClick={() =>
                agentRailRef.current?.openConversations({ history: true })
              }
            >
              <MessagesSquare size={17} />
            </button>
            {filmAction.kind === "running" && (
              <span className="studio-run-pill" role="status">
                <span className="cv-spin" aria-hidden="true" />
                {filmAction.label}
              </span>
            )}
          </div>
        </header>
        {(initError || saveError) && (
          <div className="studio-notice" role="alert">
            {saveError || initError}
            <button
              aria-label="Retry loading project"
              onClick={() => void actions.refresh()}
            >
              Retry
            </button>
          </div>
        )}
        <div
          className="studio-body"
          inert={briefOpen ? true : undefined}
          aria-hidden={briefOpen || undefined}
        >
          {layersOpen && (
            <aside className="studio-outline">
              <div className="studio-outline-top">
                <span>Your film</span>
                <button
                  className="studio-icon-button"
                  onClick={() => setLayersOpen(false)}
                  aria-label="Hide assets"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
              <LayersPanel
                graph={graph}
                onCollapse={() => setLayersOpen(false)}
              />
            </aside>
          )}
          <main className="studio-main">
            <div className="studio-work-surface">
              {!layersOpen && (
                <button
                  className="studio-show-assets"
                  onClick={() => {
                    if (window.innerWidth <= 900)
                      agentRailRef.current?.closeConversations();
                    setLayersOpen(true);
                  }}
                  aria-label="Show assets"
                  title="Show assets"
                >
                  <Layers2 size={16} />
                </button>
              )}
              <div className="studio-canvas-surface">
                <StudioCanvas
                  ref={canvasRef}
                  graph={graph}
                  mediaVersion={mediaVersion}
                  busy={busy}
                  onPlayFilm={openPlayer}
                  onDraft={draftForFilm}
                />
              </div>
            </div>
            {ready && boardEmpty && !briefOpen && (
              <div className="studio-empty">
                <h1>
                  A world waiting
                  <br />
                  for your first idea.
                </h1>
                <p>
                  Start with a character, a scene, or a feeling.
                  <br />
                  We’ll help you find the story that comes next.
                </p>
                <button onClick={revealPrompt}>
                  Let’s make a film <ArrowUpRight size={16} />
                </button>
              </div>
            )}
            {!ready && (
              <div className="studio-loading" role="status">
                <span className="cv-spin" />
                Opening your studio…
              </div>
            )}
            {!composerInRail && (
              <div
                id="studio-prompt-dock"
                className="project-prompt-dock agent-ui"
                aria-label="Creative conversation composer"
              >
                {composer}
              </div>
            )}
          </main>
          <AgentRail
            ref={agentRailRef}
            projectId={projectId}
            graph={graph}
            isNewVideo={isNewVideo}
            selectedLabel={selectedAssets[0]?.label}
            selectedAssets={selectedAssets}
            externalComposer
            onEditSelection={onEditSelection}
            onSelectAssets={setSelection}
            onComposerStateChange={setAgentComposerState}
            onRefresh={actions.refresh}
            onPlay={(url) => openPlayer(url, title)}
            composer={composerInRail ? composer : null}
            selectionContent={
              <AssetPanel
                key={selectedKeys.join("|")}
                graph={graph}
                version={mediaVersion}
                busy={busy}
                disabled={agentComposerState.disabled}
                onAnnotate={setAnnotation}
                onFineTune={(asset, values) =>
                  agentRailRef.current?.submitPrompt(
                    fineTunePrompt(asset.label, values),
                  )
                }
              />
            }
          />
        </div>
        {graph.overview && (
          <StoryBrief
            key={projectId}
            overview={graph.overview}
            visible={briefOpen}
            onSave={onSaveOverview}
            onClose={() => select(null)}
          />
        )}
        <AnimatePresence>
          {annotation?.media && (
            <AnnotateModal
              key={annotation.key}
              title={annotation.label}
              src={annotation.media}
              busy={!!busy[annotation.key]}
              onClose={() => setAnnotation(null)}
              onApply={async (prompt, composite) => {
                await actions.editAsset(
                  {
                    key: annotation.key,
                    refId: annotation.id,
                    media: annotation.media,
                  },
                  prompt,
                  composite,
                );
                setAnnotation(null);
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {player && (
            <motion.div
              className="studio-player"
              role="dialog"
              aria-modal="true"
              aria-label={player.title}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <FilmPlayer
                src={player.src}
                title={player.title}
                onClose={closePlayer}
                autoplay
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={<div className="studio-loading">Opening your studio…</div>}
    >
      <StudioWorkspace />
    </Suspense>
  );
}
