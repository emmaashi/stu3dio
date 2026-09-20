"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import { MessagesSquare, X, SquarePen } from "lucide-react";
import { agentApi } from "@/lib/agentApi";
import { buildAgentBlocks } from "@/lib/agentBlocks";
import { useAgentRunStore } from "@/store/useAgentRunStore";
import type {
  AgentAttachment,
  AgentRun,
  AgentRunKind,
  AgentRunPhase,
} from "@/types/agent";
import {
  isImageEditable,
  type AssetSelection,
  type StudioGraph,
} from "./types";
import { filmPoster } from "./layout";
import AgentBlockRenderer from "./AgentBlockRenderer";
import ConversationTranscript from "./ConversationTranscript";
import { assetComposerPlaceholder } from "./assetPrompts";
import { runSettings } from "@/lib/settings";
import { buildContextOptions } from "./studioContext";
import { buildAgentRunContext, resolveAgentRunKind } from "./agentRunRequest";
import {
  conversationTitle,
  findAssetConversation,
  getSelectionSignature,
  readAssetConversations,
  toConversationSelection,
  writeAssetConversations,
  type AssetConversation,
} from "./assetConversations";
import {
  ConversationNav,
  LoadingState,
  PromptBar,
  type ConversationSummary,
} from "@/components/beautiful-ui";

type Props = {
  projectId: string;
  graph: StudioGraph;
  isNewVideo: boolean;
  selectedLabel?: string;
  selectedAssets: AssetSelection[];
  selectionContent: React.ReactNode;
  // The workspace's main composer, handed over while the panel is open so a
  // conversation is typed into the thread rather than out on the canvas.
  composer?: React.ReactNode;
  externalComposer?: boolean;
  onEditSelection: (prompt: string, selectionKeys: string[]) => Promise<number>;
  onSelectAssets?: (selectionKeys: string[]) => void;
  onComposerStateChange?: (state: AgentRailComposerState) => void;
  onRefresh: () => Promise<void>;
  onPlay: (url: string) => void;
};

export type AgentRailComposerState = {
  disabled: boolean;
  awaitingApproval: boolean;
  /** A run is queued, thinking or running (not paused at an approval). */
  runActive: boolean;
  runPhase: AgentRunPhase | null;
  /** The thread for the current selection already has messages. */
  threadHasMessages: boolean;
  editingSelection: boolean;
  conversationsOpen: boolean;
};

export type AgentRailHandle = {
  closeConversations: () => void;
  submitPrompt: (text: string, attachments?: AgentAttachment[]) => void;
  uploadAttachment: (file: File) => Promise<AgentAttachment>;
  openConversations: (options?: {
    history?: boolean;
    current?: boolean;
  }) => void;
};

const RAIL_WIDTH_KEY = "stu3dio.rail.width.v1";
const RAIL_MIN_WIDTH = 300;
const RAIL_MAX_WIDTH = 720;

const ACTIVE_STATUSES = new Set<AgentRun["status"]>([
  "queued",
  "thinking",
  "running",
  "awaiting_approval",
]);

const AgentRail = forwardRef<AgentRailHandle, Props>(function AgentRail(
  {
    projectId,
    graph,
    isNewVideo,
    selectedLabel,
    selectedAssets,
    selectionContent,
    composer,
    externalComposer = false,
    onEditSelection,
    onSelectAssets,
    onComposerStateChange,
    onRefresh,
    onPlay,
  },
  ref,
) {
  const run = useAgentRunStore((state) => state.run);
  const events = useAgentRunStore((state) => state.events);
  const connectionError = useAgentRunStore((state) => state.connectionError);
  const hydrate = useAgentRunStore((state) => state.hydrate);
  const applyEvent = useAgentRunStore((state) => state.applyEvent);
  const setConnected = useAgentRunStore((state) => state.setConnected);
  const reset = useAgentRunStore((state) => state.reset);
  // Drag the rail's left edge to resize it; the width survives reloads.
  const [railWidth, setRailWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RAIL_WIDTH_KEY));
    if (stored >= RAIL_MIN_WIDTH && stored <= RAIL_MAX_WIDTH)
      setRailWidth(stored);
  }, []);
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth <= 900) return;
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth =
      handle.parentElement?.getBoundingClientRect().width ?? RAIL_MIN_WIDTH;
    let next = startWidth;
    handle.setPointerCapture(event.pointerId);
    setResizing(true);
    const move = (moveEvent: PointerEvent) => {
      next = Math.round(
        Math.min(
          RAIL_MAX_WIDTH,
          Math.max(RAIL_MIN_WIDTH, startWidth + (startX - moveEvent.clientX)),
        ),
      );
      setRailWidth(next);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setResizing(false);
      window.localStorage.setItem(RAIL_WIDTH_KEY, String(next));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };
  const [railOpen, setRailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingSelected, setEditingSelected] = useState(false);
  const [editStartedAt, setEditStartedAt] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [assetConversations, setAssetConversations] = useState<
    AssetConversation[]
  >([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const previousRunId = useRef<string | null>(null);
  const previousSelection = useRef("");
  const forceNewConversation = useRef(false);

  const blocks = useMemo(() => buildAgentBlocks(run, events), [run, events]);
  const disabled = !!run && ACTIVE_STATUSES.has(run.status);
  const awaitingApproval =
    run?.status === "awaiting_approval" && !!run.approval;
  // Edits made inside the approval card, so a revision typed in the composer carries them.
  const approvalDraft = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    approvalDraft.current = null;
  }, [run?.approval?.id]);
  const selectedAssetConversation =
    assetConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) || null;
  const conversations = useMemo<ConversationSummary[]>(
    () => [
      ...(run
        ? [
            {
              id: "current",
              title: conversationTitle(run.prompt),
              updatedLabel: ACTIVE_STATUSES.has(run.status)
                ? "In progress"
                : "Current",
            },
          ]
        : []),
      ...assetConversations.map(({ id, title, updatedLabel }) => ({
        id,
        title,
        updatedLabel,
      })),
    ],
    [assetConversations, run],
  );
  const showRun = !!run && selectedConversationId === "current";
  const reducedMotion = useReducedMotion();
  const selectionSignature = getSelectionSignature(selectedAssets);
  const activeAssetSelection =
    selectedAssetConversation?.selection ||
    toConversationSelection(selectedAssets);
  const contextOptions = useMemo(
    () =>
      buildContextOptions({
        characters: graph.characters,
        objects: graph.objects,
        scenes: graph.scenes,
      }),
    [graph.characters, graph.objects, graph.scenes],
  );

  useEffect(() => {
    reset();
    previousRunId.current = null;
    previousSelection.current = "";
    forceNewConversation.current = false;
    setRailOpen(false);
    setHistoryOpen(false);
    setSelectedConversationId(null);
    setAssetConversations(readAssetConversations(projectId));
    const stored = window.localStorage.getItem(
      `stu3dio:agent-run:${projectId}`,
    );
    if (!stored) return;
    let cancelled = false;
    void agentApi
      .get(stored)
      .then((snapshot) => {
        if (!cancelled) {
          hydrate(snapshot);
          setSelectedConversationId("current");
          if (ACTIVE_STATUSES.has(snapshot.status)) setRailOpen(true);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(`stu3dio:agent-run:${projectId}`);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, hydrate, reset]);

  useEffect(() => {
    if (previousSelection.current === selectionSignature) return;
    previousSelection.current = selectionSignature;
    if (!selectionSignature) {
      setSelectedConversationId(run ? "current" : null);
      return;
    }
    const conversation = assetConversations.find(
      (item) => getSelectionSignature(item.selection) === selectionSignature,
    );
    setSelectedConversationId(conversation?.id || null);
    if (selectionSignature === "overview") {
      if (window.innerWidth <= 900) setRailOpen(false);
    } else {
      setRailOpen(true);
    }
    threadRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setHistoryOpen(false);
  }, [selectionSignature, assetConversations, run]);

  useEffect(() => {
    if (!run?.id) return;
    const existingEvents = useAgentRunStore.getState().events;
    const afterId = existingEvents.length
      ? existingEvents[existingEvents.length - 1]?.id || 0
      : 0;
    return agentApi.subscribe(run.id, afterId, {
      onEvent: (event) => {
        applyEvent(event);
        if (event.type === "artifact.created" || event.type === "run.completed")
          void onRefresh();
      },
      onOpen: () => setConnected(true),
      onError: (message) => setConnected(false, message),
    });
  }, [run?.id, applyEvent, onRefresh, setConnected]);

  useEffect(() => {
    if (
      run?.id &&
      run.project_id === projectId &&
      previousRunId.current !== run.id
    ) {
      previousRunId.current = run.id;
      setSelectedConversationId("current");
      setRailOpen(true);
    }
  }, [projectId, run?.id, run?.project_id]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }, [
    assetConversations,
    blocks.length,
    run?.assistant_text,
    run?.status,
    reducedMotion,
  ]);

  const start = async (
    text: string,
    forcedKind?: AgentRunKind,
    attachments: AgentAttachment[] = [],
    showHistory = false,
  ) => {
    if (submitting || disabled) return;
    const commandKind = resolveAgentRunKind(
      text,
      isNewVideo,
      selectedLabel,
      forcedKind,
    );
    setSubmitting(true);
    setSelectedConversationId("current");
    setHistoryOpen(showHistory);
    setRailOpen(true);
    try {
      const snapshot = await agentApi.create(projectId, {
        prompt: text,
        kind: commandKind,
        settings: runSettings(),
        context: buildAgentRunContext({
          graph,
          selectedAssets,
          selectedLabel,
          attachments,
        }),
      });
      window.localStorage.setItem(
        `stu3dio:agent-run:${projectId}`,
        snapshot.id,
      );
      hydrate(snapshot);
    } catch (error) {
      setConnected(
        false,
        error instanceof Error
          ? error.message
          : "Could not start the agent run",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resolveApproval = async (
    decision: "approve" | "revise" | "cancel",
    values: Record<string, unknown>,
    feedback?: string,
  ) => {
    if (!run?.approval || submitting) return;
    setSubmitting(true);
    try {
      const snapshot = await agentApi.resolveApproval(run.id, run.approval.id, {
        decision,
        values,
        feedback,
        idempotency_key: crypto.randomUUID(),
      });
      hydrate(snapshot, useAgentRunStore.getState().events);
      await onRefresh();
    } catch (error) {
      setConnected(
        false,
        error instanceof Error ? error.message : "Could not resolve approval",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestChanges = (feedback: string) => {
    if (!run?.approval) return;
    setSelectedConversationId("current");
    setHistoryOpen(false);
    setRailOpen(true);
    void resolveApproval(
      "revise",
      approvalDraft.current ?? run.approval.values,
      feedback,
    );
  };

  const commitAssetConversations = (
    update: (current: AssetConversation[]) => AssetConversation[],
  ) => {
    setAssetConversations((current) => {
      const next = update(current);
      writeAssetConversations(projectId, next);
      return next;
    });
  };

  const submitAssetPrompt = async (
    text: string,
    selection: AssetConversation["selection"],
    showHistory = false,
  ) => {
    if (!selection.length || editingSelected || disabled) return;
    const reusable = forceNewConversation.current
      ? undefined
      : findAssetConversation(
          assetConversations,
          selection,
          selectedConversationId,
        );
    const conversationId = reusable?.id || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const title =
      selection.length === 1
        ? `Edit ${selection[0].label}`
        : `Edit ${selection.length} selected assets`;
    forceNewConversation.current = false;

    commitAssetConversations((current) => {
      const existing = current.find(
        (conversation) => conversation.id === conversationId,
      );
      const conversation: AssetConversation = {
        id: conversationId,
        title: existing?.title || title,
        updatedLabel: "Just now",
        updatedAt: timestamp,
        selection,
        messages: [
          ...(existing?.messages || []),
          { role: "user", content: text },
        ],
      };
      return [
        conversation,
        ...current.filter((item) => item.id !== conversationId),
      ];
    });
    setSelectedConversationId(conversationId);
    setHistoryOpen(showHistory);
    setRailOpen(true);
    setEditingSelected(true);
    setEditStartedAt(timestamp);
    setSubmitting(true);
    setEditError(null);
    try {
      const updated = await onEditSelection(
        text,
        selection.map((asset) => asset.key),
      );
      const response =
        updated > 0
          ? `Applied this visual direction to ${updated === 1 ? selection[0].label : `${updated} selected assets`}. The selected images have been refreshed. Review them on the canvas before continuing.`
          : `Saved this direction with ${selection.length === 1 ? selection[0].label : `${selection.length} selected assets`} as explicit context. This asset type does not yet have a direct regeneration job, so the conversation is ready for the backend revision workflow.`;
      commitAssetConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedLabel: "Just now",
                updatedAt: new Date().toISOString(),
                messages: [
                  ...conversation.messages,
                  { role: "assistant", content: response },
                ],
              }
            : conversation,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not apply those changes";
      setEditError(message);
      commitAssetConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [
                  ...conversation.messages,
                  {
                    role: "assistant",
                    content: `I couldn't apply that revision: ${message}`,
                  },
                ],
              }
            : conversation,
        ),
      );
    } finally {
      setEditingSelected(false);
      setEditStartedAt(null);
      setSubmitting(false);
    }
  };

  const handleRecommendation = (id: string) => {
    if (id === "retry-run" && run) {
      void start(run.prompt, run.kind);
    } else if (id === "revise-pacing") {
      void start(
        "Revise the pacing while preserving the approved story and cast.",
        "enhance",
      );
    }
  };

  useEffect(() => {
    onComposerStateChange?.({
      disabled:
        (disabled && !awaitingApproval) || submitting || editingSelected,
      awaitingApproval,
      runActive:
        !!run && ["queued", "thinking", "running"].includes(run.status),
      runPhase: run?.phase ?? null,
      threadHasMessages: (selectedAssetConversation?.messages.length ?? 0) > 0,
      editingSelection: editingSelected,
      conversationsOpen: railOpen,
    });
  }, [
    awaitingApproval,
    disabled,
    run,
    selectedAssetConversation,
    editingSelected,
    onComposerStateChange,
    railOpen,
    run?.status,
    submitting,
  ]);

  const showCurrentRun = () => {
    previousSelection.current = "";
    onSelectAssets?.([]);
    setSelectedConversationId("current");
    setHistoryOpen(false);
  };

  useImperativeHandle(ref, () => ({
    closeConversations: () => setRailOpen(false),
    submitPrompt: (text, attachments = []) => {
      if (awaitingApproval) return requestChanges(text);
      const selection = toConversationSelection(selectedAssets);
      setRailOpen(true);
      if (selectedAssets.some(isImageEditable))
        void submitAssetPrompt(text, selection, false);
      else void start(text, undefined, attachments, false);
    },
    uploadAttachment: (file) => agentApi.uploadAttachment(projectId, file),
    openConversations: (options) => {
      setRailOpen(true);
      setHistoryOpen(!!options?.history);
      if (options?.current) showCurrentRun();
    },
  }));

  return (
    <aside
      className={`agent-ui agent-rail studio-conversations ${railOpen ? "is-open" : "is-closed"} ${resizing ? "is-resizing" : ""}`}
      aria-label="Conversations"
      aria-hidden={!railOpen}
      inert={!railOpen ? true : undefined}
      style={
        railWidth
          ? ({ "--rail-width": `${railWidth}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className="agent-rail__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize conversations"
        title="Drag to resize"
        onPointerDown={startResize}
        onDoubleClick={() => {
          setRailWidth(null);
          window.localStorage.removeItem(RAIL_WIDTH_KEY);
        }}
      />
      <header className="agent-rail__header studio-conversation-header">
        <MessagesSquare size={15} />
        <span>Conversations</span>
        <button
          className="agent-icon-button"
          aria-label="New conversation"
          title="New conversation"
          disabled={disabled || submitting || editingSelected}
          onClick={() => {
            forceNewConversation.current = true;
            setSelectedConversationId(null);
            setHistoryOpen(false);
            onSelectAssets?.([]);
          }}
        >
          <SquarePen size={15} />
        </button>
        <button
          className="agent-icon-button"
          onClick={() => setRailOpen(false)}
          aria-label="Close conversations"
        >
          <X size={16} />
        </button>
      </header>
      <div className="studio-conversation-body">
        <div
          className="studio-conversation-scroll"
          ref={threadRef}
          inert={historyOpen ? true : undefined}
          aria-hidden={historyOpen || undefined}
        >
          {/* Once a multi-asset thread has messages the composer pills carry
              the references, so the "N assets selected" list steps aside. */}
          {!!selectedAssets.length &&
            !(
              selectedAssets.length > 1 &&
              (selectedAssetConversation?.messages.length ?? 0) > 0
            ) &&
            selectionContent}
          <div
            className="studio-conversation-messages"
            aria-label="Conversation messages"
          >
            {selectedAssetConversation && (
              <ConversationTranscript
                conversation={selectedAssetConversation}
                showHeader={!selectedAssets.length}
              />
            )}
            {!selectedAssetConversation &&
              showRun &&
              blocks.map((block) => (
                <AgentBlockRenderer
                  key={block.id}
                  block={block}
                  busy={submitting}
                  onApproval={resolveApproval}
                  onApprovalValuesChange={(values) => {
                    approvalDraft.current = values;
                  }}
                  onPlay={onPlay}
                  filmTitle={graph.overview?.title}
                  filmPoster={filmPoster(graph)}
                  onRecommendation={handleRecommendation}
                />
              ))}
            {editingSelected && editStartedAt && (
              <LoadingState
                label="Applying your revision"
                startedAt={editStartedAt}
                variant="orbit"
              />
            )}
            {!selectedAssetConversation && connectionError && (
              <div className="agent-connection-note" role="alert">
                {connectionError}
              </div>
            )}
            {editError && !selectedAssetConversation && (
              <p className="studio-save-error" role="alert">
                {editError}
              </p>
            )}
          </div>
        </div>
        <footer
          className={`agent-rail__composer ${composer ? "agent-rail__composer--hosted" : externalComposer ? "agent-rail__composer--mobile-only" : ""}`}
          inert={historyOpen ? true : undefined}
          aria-hidden={historyOpen || undefined}
        >
          {composer ? (
            composer
          ) : (
            <PromptBar
              draftKey={selectionSignature || "film"}
              disabled={
                (disabled && !awaitingApproval) || submitting || editingSelected
              }
              tone={awaitingApproval ? "revision" : "default"}
              placeholder={
                awaitingApproval
                  ? "Describe what should change…"
                  : assetComposerPlaceholder(
                      selectedAssets,
                      "Where should the story go next?",
                    )
              }
              contextOptions={selectedAssets.length ? [] : contextOptions}
              allowExtras={
                !awaitingApproval && !selectedAssets.some(isImageEditable)
              }
              onUploadAttachment={(file) =>
                agentApi.uploadAttachment(projectId, file)
              }
              onSend={(text, attachments) =>
                awaitingApproval
                  ? requestChanges(text)
                  : selectedAssets.some(isImageEditable)
                    ? void submitAssetPrompt(text, activeAssetSelection)
                    : void start(text, undefined, attachments)
              }
            />
          )}
        </footer>
        <ConversationNav
          embedded
          open={historyOpen}
          activeId={selectedConversationId || undefined}
          conversations={conversations}
          onClose={() => setHistoryOpen(false)}
          onSelect={(id) => {
            forceNewConversation.current = false;
            const conversation = assetConversations.find(
              (item) => item.id === id,
            );
            previousSelection.current = conversation
              ? getSelectionSignature(conversation.selection)
              : "";
            onSelectAssets?.(
              conversation
                ? conversation.selection.map((asset) => asset.key)
                : [],
            );
            setSelectedConversationId(id);
            setHistoryOpen(false);
          }}
        />
      </div>
    </aside>
  );
});

export default AgentRail;
