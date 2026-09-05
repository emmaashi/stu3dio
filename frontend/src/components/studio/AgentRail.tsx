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
import type {
  AgentAttachment,
  AgentBlock,
  AgentRun,
  AgentRunKind,
} from "@/types/agent";
import type { AssetSelection, StudioGraph } from "./types";
import {
  ApprovalCard,
  ArtifactCard,
  ConversationNav,
  ContextCards,
  DiffTable,
  FineTuneCard,
  InsightCards,
  LoadingState,
  PromptBar,
  RecommendationCard,
  StreamingText,
  TaskRows,
  ThinkingState,
  ToolChips,
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

type ConversationMessage = { role: "user" | "assistant"; content: string };
type AssetConversation = ConversationSummary & {
  selection: Array<{
    key: string;
    label: string;
    kind: AssetSelection["kind"];
  }>;
  messages: ConversationMessage[];
  updatedAt: string;
};

function conversationTitle(prompt: string) {
  const clean = prompt.replace(/^\/[\w-]+\s*/, "").trim();
  if (!clean) return "Current conversation";
  return clean.length > 34 ? `${clean.slice(0, 34).trimEnd()}…` : clean;
}

function readAssetConversations(projectId: string): AssetConversation[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(`stu3dio:asset-conversations:${projectId}`) ||
        "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (conversation) =>
        conversation &&
        typeof conversation.id === "string" &&
        Array.isArray(conversation.selection) &&
        Array.isArray(conversation.messages),
    );
  } catch {
    return [];
  }
}

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
  const selectedConversation = selectedAssetConversation;
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
  const selectionSignature = selectedAssets
    .map((asset) => asset.key)
    .sort()
    .join("|");
  const activeAssetSelection =
    selectedAssetConversation?.selection ||
    selectedAssets.map((asset) => ({
      key: asset.key,
      label: asset.label,
      kind: asset.kind,
    }));
  const contextOptions = useMemo(
    () => [
      ...graph.characters.map((character) => ({
        id: character.id,
        label: character.name,
        kind: "character" as const,
      })),
      ...graph.objects.map((object) => ({
        id: object.id,
        label: object.name,
        kind: "object" as const,
      })),
      ...graph.scenes.map((scene) => ({
        id: scene.id,
        label: `Scene ${scene.order}`,
        kind: "scene" as const,
      })),
    ],
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
      (item) =>
        item.selection
          .map((asset) => asset.key)
          .sort()
          .join("|") === selectionSignature,
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
    const commandKind: AgentRunKind =
      forcedKind ||
      (text.startsWith("/assemble")
        ? "assemble-film"
        : text.startsWith("/plan")
          ? "plan-scenes"
          : selectedLabel || !isNewVideo
            ? "enhance"
            : "create-film");
    setSubmitting(true);
    setSelectedConversationId("current");
    setHistoryOpen(showHistory);
    setRailOpen(true);
    try {
      const snapshot = await agentApi.create(projectId, {
        prompt: text,
        kind: commandKind,
        context: {
          selected_artifact: selectedLabel || null,
          selected_assets: selectedAssets.map((asset) => ({
            id: asset.id,
            key: asset.key,
            kind: asset.kind,
            label: asset.label,
            description: asset.description,
            context: asset.context,
          })),
          project: graph.overview,
          visible_characters: graph.characters.map((character) => ({
            id: character.id,
            name: character.name,
          })),
          visible_objects: graph.objects.map((object) => ({
            id: object.id,
            name: object.name,
          })),
          visible_scenes: graph.scenes.map((scene) => ({
            id: scene.id,
            order: scene.order,
          })),
          attachments,
        },
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
      window.localStorage.setItem(
        `stu3dio:asset-conversations:${projectId}`,
        JSON.stringify(next),
      );
      return next;
    });
  };

  const submitAssetPrompt = async (
    text: string,
    selection: AssetConversation["selection"],
    showHistory = false,
  ) => {
    if (!selection.length || editingSelected || disabled) return;
    const signature = selection
      .map((asset) => asset.key)
      .sort()
      .join("|");
    const activeConversation = assetConversations.find(
      (conversation) =>
        conversation.id === selectedConversationId &&
        conversation.selection
          .map((asset) => asset.key)
          .sort()
          .join("|") === signature,
    );
    const reusable = !forceNewConversation.current
      ? activeConversation ||
        assetConversations.find(
          (conversation) =>
            conversation.selection
              .map((asset) => asset.key)
              .sort()
              .join("|") === signature,
        )
      : null;
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
    submitAssetPrompt(
      text,
      selectedAssets.map((asset) => ({
        key: asset.key,
        label: asset.label,
        kind: asset.kind,
      })),
    );

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
      const selection = selectedAssets.map((asset) => ({
        key: asset.key,
        label: asset.label,
        kind: asset.kind,
      }));
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
            {selectedConversation && (
              <ConversationTranscript conversation={selectedConversation} />
            )}
            {!selectedConversation &&
              showRun &&
              blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  busy={submitting}
                  onApproval={resolveApproval}
                  onPlay={onPlay}
                  onRecommendation={handleRecommendation}
                />
              ))}
            {!selectedConversation && !showRun && (
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
            {!selectedConversation && connectionError && (
              <div className="agent-connection-note" role="alert">
                {connectionError}
              </div>
            )}
            {editError && !selectedConversation && (
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
              ? conversation.selection
                  .map((asset) => asset.key)
                  .sort()
                  .join("|")
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

function ConversationTranscript({
  conversation,
}: {
  conversation: {
    title: string;
    messages: ConversationMessage[];
    selection?: AssetConversation["selection"];
  };
}) {
  return (
    <div className="agent-conversation-preview">
      <div>
        <span>Conversation</span>
        <h2>{conversation.title}</h2>
        {conversation.selection && (
          <div
            className="agent-conversation-context"
            aria-label="Assets in this conversation"
          >
            {conversation.selection.map((asset) => (
              <span key={asset.key}>{asset.label}</span>
            ))}
          </div>
        )}
      </div>
      {conversation.messages.map((message, index) =>
        message.role === "user" ? (
          <div key={index} className="agent-user-message">
            {message.content}
          </div>
        ) : (
          <div key={index} className="agent-stream">
            <p>{message.content}</p>
          </div>
        ),
      )}
    </div>
  );
}

function BlockRenderer({
  block,
  busy,
  onApproval,
  onPlay,
  onRecommendation,
}: {
  block: AgentBlock;
  busy: boolean;
  onApproval: (
    decision: "approve" | "revise" | "cancel",
    values: Record<string, unknown>,
    feedback?: string,
  ) => void;
  onPlay: (url: string) => void;
  onRecommendation: (id: string) => void;
}) {
  switch (block.type) {
    case "loading":
      return (
        <LoadingState
          label={block.label}
          startedAt={block.startedAt}
          variant="orbit"
        />
      );
    case "thinking":
      return (
        <ThinkingState
          label={block.label}
          activities={block.activities}
          active={block.active}
        />
      );
    case "streaming-message":
      return (
        <StreamingText
          role={block.role}
          content={block.content}
          status={block.status}
        />
      );
    case "approval":
      return (
        <ApprovalCard
          approval={block.approval}
          busy={busy}
          onApprove={(values) => onApproval("approve", values)}
          onRevise={(values, feedback) =>
            onApproval("revise", values, feedback)
          }
          onCancel={() => onApproval("cancel", block.approval.values)}
        />
      );
    case "tool-group":
      return <ToolChips tools={block.tools} />;
    case "task-group":
      return <TaskRows tasks={block.tasks} />;
    case "context":
      return <ContextCards data={block.data} />;
    case "diff":
      return <DiffTable data={block.data} />;
    case "recommendation":
      return (
        <RecommendationCard data={block.data} onAction={onRecommendation} />
      );
    case "insight":
      return <InsightCards data={block.data} />;
    case "artifact":
      return (
        <ArtifactCard
          data={block.data}
          onOpen={(data) => {
            const url = String(data.url || "");
            if (url && String(data.kind || "").includes("video")) onPlay(url);
          }}
        />
      );
    case "error":
      return (
        <div className="agent-error-card">
          <strong>Production stopped</strong>
          <p>{block.message}</p>
        </div>
      );
  }
}
