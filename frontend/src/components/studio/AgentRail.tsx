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
import { MessagesSquare, PanelLeft, Square, X } from "lucide-react";
import type { PromptBarHandle } from "@/components/beautiful-ui/PromptBar";
import { agentApi } from "@/lib/agentApi";
import { buildAgentBlocks } from "@/lib/agentBlocks";
import { useAgentRunStore } from "@/store/useAgentRunStore";
import type { AgentAttachment, AgentRun, AgentRunKind } from "@/types/agent";
import type { AssetSelection, StudioGraph } from "./types";
import AgentBlockRenderer from "./AgentBlockRenderer";
import ConversationTranscript from "./ConversationTranscript";
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
  FineTuneCard,
  LoadingState,
  PromptBar,
  type ConversationSummary,
  type FineTuneValues,
} from "@/components/beautiful-ui";

type Props = {
  projectId: string;
  graph: StudioGraph;
  isNewVideo: boolean;
  selectedLabel?: string;
  selectedAssets: AssetSelection[];
  selectionContent: React.ReactNode;
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
  editingSelection: boolean;
};

export type AgentRailHandle = {
  closeConversations: () => void;
  submitPrompt: (text: string, attachments?: AgentAttachment[]) => void;
  draftSelection: (text: string) => void;
  uploadAttachment: (file: File) => Promise<AgentAttachment>;
  openConversations: (options?: {
    history?: boolean;
    current?: boolean;
  }) => void;
};

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
  const connected = useAgentRunStore((state) => state.connected);
  const connectionError = useAgentRunStore((state) => state.connectionError);
  const hydrate = useAgentRunStore((state) => state.hydrate);
  const applyEvent = useAgentRunStore((state) => state.applyEvent);
  const setConnected = useAgentRunStore((state) => state.setConnected);
  const reset = useAgentRunStore((state) => state.reset);
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
  const conversationPromptRef = useRef<PromptBarHandle>(null);
  const previousRunId = useRef<string | null>(null);
  const previousSelection = useRef("");
  const forceNewConversation = useRef(false);

  const blocks = useMemo(() => buildAgentBlocks(run, events), [run, events]);
  const disabled = !!run && ACTIVE_STATUSES.has(run.status);
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

  const cancel = async () => {
    if (!run || submitting) return;
    setSubmitting(true);
    try {
      const snapshot = await agentApi.cancel(run.id);
      hydrate(snapshot, useAgentRunStore.getState().events);
    } finally {
      setSubmitting(false);
    }
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

  const editSelected = (text: string) =>
    submitAssetPrompt(text, toConversationSelection(selectedAssets));

  const fineTune = (values: FineTuneValues) => {
    const prompt = `Adjust ${selectedLabel || "the selected asset"}: ${values.framing}, ${values.camera}, style intensity ${values.style}, prompt emphasis ${values.emphasis}.`;
    if (selectedAssets.length) void editSelected(prompt);
    else void start(prompt, "enhance");
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
      disabled: disabled || submitting || editingSelected,
      awaitingApproval: run?.status === "awaiting_approval",
      editingSelection: editingSelected,
    });
  }, [
    disabled,
    editingSelected,
    onComposerStateChange,
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
      const selection = toConversationSelection(selectedAssets);
      setRailOpen(true);
      if (selectedAssets.some((asset) => asset.editable))
        void submitAssetPrompt(text, selection, false);
      else void start(text, undefined, attachments, false);
    },
    draftSelection: (text) => {
      conversationPromptRef.current?.setDraft(text);
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
      className={`agent-ui agent-rail studio-conversations ${railOpen ? "is-open" : "is-closed"}`}
      aria-label="Conversations"
      aria-hidden={!railOpen}
      inert={!railOpen ? true : undefined}
    >
      <header className="agent-rail__header studio-conversation-header">
        <MessagesSquare size={15} />
        <span>Conversations</span>
        <button
          className="agent-icon-button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-label="Conversation history"
          aria-expanded={historyOpen}
          title={historyOpen ? "Back to conversation" : "View history"}
        >
          <PanelLeft size={15} />
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
          {!!selectedAssets.length && selectionContent}
          {selectedAssets.length === 1 && selectedAssets[0].editable && (
            <details className="studio-fine-tune">
              <summary>Camera &amp; visual direction</summary>
              <FineTuneCard
                disabled={disabled || editingSelected}
                onApply={fineTune}
              />
            </details>
          )}
          <div
            className="studio-conversation-messages"
            aria-label="Conversation messages"
          >
            {selectedAssetConversation && (
              <ConversationTranscript
                conversation={selectedAssetConversation}
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
                  onPlay={onPlay}
                  onRecommendation={handleRecommendation}
                />
              ))}
            {!selectedAssetConversation && !showRun && (
              <div className="studio-conversation-empty">
                <MessagesSquare size={18} />
                <h2>
                  {selectedAssets.length
                    ? "What would you like to explore?"
                    : "Let’s find your next idea."}
                </h2>
                <p>
                  {selectedAssets.length
                    ? "Try a new look, refine a detail, or describe what should change. Your reference and revisions live here together."
                    : "Talk through your story, shape your characters, or plan what happens next."}
                </p>
              </div>
            )}
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
          className={`agent-rail__composer ${externalComposer ? "agent-rail__composer--mobile-only" : ""}`}
          inert={historyOpen ? true : undefined}
          aria-hidden={historyOpen || undefined}
        >
          {run?.status === "awaiting_approval" ? (
            <div className="agent-approval-lock">
              <button onClick={showCurrentRun}>Review the proposal</button>
              <small>Approve, request changes, or cancel above.</small>
            </div>
          ) : (
            <PromptBar
              ref={conversationPromptRef}
              draftKey={selectionSignature || "film"}
              disabled={disabled || submitting || editingSelected}
              placeholder={
                selectedAssets.length
                  ? `Continue with ${selectedAssets.length === 1 ? selectedAssets[0].label : `${selectedAssets.length} assets`}…`
                  : "Where should the story go next?"
              }
              contextOptions={selectedAssets.length ? [] : contextOptions}
              allowExtras={!selectedAssets.length}
              onUploadAttachment={(file) =>
                agentApi.uploadAttachment(projectId, file)
              }
              onSend={(text, attachments) =>
                selectedAssets.some((asset) => asset.editable)
                  ? void submitAssetPrompt(text, activeAssetSelection)
                  : void start(text, undefined, attachments)
              }
            />
          )}
        </footer>
        {run && ACTIVE_STATUSES.has(run.status) && (
          <div
            className="studio-conversation-status"
            inert={historyOpen ? true : undefined}
            aria-hidden={historyOpen || undefined}
          >
            <span>
              {run.status === "awaiting_approval"
                ? "Waiting for your review"
                : connected
                  ? "Working on your film…"
                  : "Connecting…"}
            </span>
            {run.status !== "awaiting_approval" && (
              <button onClick={cancel} disabled={submitting}>
                <Square size={9} />
                Stop
              </button>
            )}
          </div>
        )}
        <ConversationNav
          embedded
          open={historyOpen}
          activeId={selectedConversationId || undefined}
          conversations={conversations}
          newConversationDisabled={disabled || submitting || editingSelected}
          onClose={() => setHistoryOpen(false)}
          onNewConversation={() => {
            forceNewConversation.current = true;
            setSelectedConversationId(null);
            setHistoryOpen(false);
          }}
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
