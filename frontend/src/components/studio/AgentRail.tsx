"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle, PanelLeft, Square, X } from "lucide-react";
import { agentApi } from "@/lib/agentApi";
import { buildAgentBlocks } from "@/lib/agentBlocks";
import { useAgentRunStore } from "@/store/useAgentRunStore";
import type { AgentAttachment, AgentBlock, AgentRun, AgentRunKind } from "@/types/agent";
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
  inspector: React.ReactNode;
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
  submitPrompt: (text: string, attachments?: AgentAttachment[]) => void;
  uploadAttachment: (file: File) => Promise<AgentAttachment>;
  openAgent: (options?: { history?: boolean; inspector?: boolean }) => void;
};

const ACTIVE_STATUSES = new Set<AgentRun["status"]>(["queued", "thinking", "running", "awaiting_approval"]);

type ConversationMessage = { role: "user" | "assistant"; content: string };
type AssetConversation = ConversationSummary & {
  selection: Array<{ key: string; label: string; kind: AssetSelection["kind"] }>;
  messages: ConversationMessage[];
  updatedAt: string;
};

const MOCK_CONVERSATIONS: Array<ConversationSummary & { messages: ConversationMessage[] }> = [
  {
    id: "mock-opening",
    title: "Explore the opening",
    updatedLabel: "Yesterday",
    messages: [
      { role: "user", content: "Give the opening a slower, more cinematic build." },
      { role: "assistant", content: "I’d begin with the environment, let the lead enter on the second shot, and hold the first reveal until the soundscape has established the mood." },
    ],
  },
  {
    id: "mock-character",
    title: "Refine the lead character",
    updatedLabel: "2 days ago",
    messages: [
      { role: "user", content: "Make the lead feel more restrained and less heroic." },
      { role: "assistant", content: "I’d reduce the confident poses, keep the wardrobe practical, and favor closer framing that lets hesitation carry the performance." },
    ],
  },
  {
    id: "mock-ending",
    title: "Try a quieter ending",
    updatedLabel: "Last week",
    messages: [
      { role: "user", content: "Can the ending land without a big final reveal?" },
      { role: "assistant", content: "Yes. The final shot can resolve on a small visual choice, leaving the larger implication in the background rather than explaining it." },
    ],
  },
];

function conversationTitle(prompt: string) {
  const clean = prompt.replace(/^\/[\w-]+\s*/, "").trim();
  if (!clean) return "Current conversation";
  return clean.length > 34 ? `${clean.slice(0, 34).trimEnd()}…` : clean;
}

function readAssetConversations(projectId: string): AssetConversation[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`stu3dio:asset-conversations:${projectId}`) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((conversation) =>
      conversation &&
      typeof conversation.id === "string" &&
      Array.isArray(conversation.selection) &&
      Array.isArray(conversation.messages)
    );
  } catch {
    return [];
  }
}

const AgentRail = forwardRef<AgentRailHandle, Props>(function AgentRail({
  projectId,
  graph,
  isNewVideo,
  selectedLabel,
  selectedAssets,
  inspector,
  externalComposer = false,
  onEditSelection,
  onSelectAssets,
  onComposerStateChange,
  onRefresh,
  onPlay,
}, ref) {
  const run = useAgentRunStore((state) => state.run);
  const events = useAgentRunStore((state) => state.events);
  const connected = useAgentRunStore((state) => state.connected);
  const connectionError = useAgentRunStore((state) => state.connectionError);
  const hydrate = useAgentRunStore((state) => state.hydrate);
  const applyEvent = useAgentRunStore((state) => state.applyEvent);
  const setConnected = useAgentRunStore((state) => state.setConnected);
  const reset = useAgentRunStore((state) => state.reset);
  const [tab, setTab] = useState<"agent" | "inspector">("agent");
  const [railOpen, setRailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingSelected, setEditingSelected] = useState(false);
  const [editStartedAt, setEditStartedAt] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [assetConversations, setAssetConversations] = useState<AssetConversation[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const previousRunId = useRef<string | null>(null);
  const previousSelection = useRef("");
  const forceNewConversation = useRef(false);

  const blocks = useMemo(() => buildAgentBlocks(run, events), [run, events]);
  const disabled = !!run && ACTIVE_STATUSES.has(run.status);
  const selectedAssetConversation = assetConversations.find((conversation) => conversation.id === selectedConversationId) || null;
  const selectedMockConversation = !run && isNewVideo
    ? MOCK_CONVERSATIONS.find((conversation) => conversation.id === selectedConversationId) || null
    : null;
  const selectedConversation = selectedAssetConversation || selectedMockConversation;
  const conversations = useMemo<ConversationSummary[]>(() => [
    ...(run ? [{ id: "current", title: conversationTitle(run.prompt), updatedLabel: ACTIVE_STATUSES.has(run.status) ? "In progress" : "Current" }] : []),
    ...assetConversations.map(({ id, title, updatedLabel }) => ({ id, title, updatedLabel })),
    ...(isNewVideo && !run ? MOCK_CONVERSATIONS.map(({ id, title, updatedLabel }) => ({ id, title, updatedLabel })) : []),
  ], [assetConversations, isNewVideo, run]);
  const emptyHero = !run && isNewVideo && !selectedConversation;
  const selectionSignature = selectedAssets.map((asset) => asset.key).sort().join("|");
  const activeAssetSelection = selectedAssetConversation?.selection || selectedAssets.map((asset) => ({
    key: asset.key,
    label: asset.label,
    kind: asset.kind,
  }));
  const contextOptions = useMemo(() => [
    ...graph.characters.map((character) => ({ id: character.id, label: character.name, kind: "character" as const })),
    ...graph.objects.map((object) => ({ id: object.id, label: object.name, kind: "object" as const })),
    ...graph.scenes.map((scene) => ({ id: scene.id, label: `Scene ${scene.order}`, kind: "scene" as const })),
  ], [graph.characters, graph.objects, graph.scenes]);

  useEffect(() => {
    reset();
    previousRunId.current = null;
    previousSelection.current = "";
    forceNewConversation.current = false;
    setRailOpen(false);
    setHistoryOpen(false);
    setSelectedConversationId(null);
    setAssetConversations(readAssetConversations(projectId));
    setTab(window.localStorage.getItem(`stu3dio:rail-tab:${projectId}`) === "inspector" ? "inspector" : "agent");
    const stored = window.localStorage.getItem(`stu3dio:agent-run:${projectId}`);
    if (!stored) return;
    let cancelled = false;
    void agentApi.get(stored).then((snapshot) => {
      if (!cancelled) {
        hydrate(snapshot);
        setSelectedConversationId("current");
        if (ACTIVE_STATUSES.has(snapshot.status)) setRailOpen(true);
      }
    }).catch(() => {
      window.localStorage.removeItem(`stu3dio:agent-run:${projectId}`);
    });
    return () => { cancelled = true; };
  }, [projectId, hydrate, reset]);

  useEffect(() => {
    if (!selectionSignature) {
      previousSelection.current = "";
      return;
    }
    if (previousSelection.current !== selectionSignature) {
      previousSelection.current = selectionSignature;
      setTab("inspector");
      setRailOpen(true);
      setHistoryOpen(false);
    }
  }, [selectionSignature]);

  useEffect(() => {
    if (!run?.id) return;
    const existingEvents = useAgentRunStore.getState().events;
    const afterId = existingEvents.length ? existingEvents[existingEvents.length - 1]?.id || 0 : 0;
    return agentApi.subscribe(run.id, afterId, {
      onEvent: (event) => {
        applyEvent(event);
        if (event.type === "artifact.created" || event.type === "run.completed") void onRefresh();
      },
      onOpen: () => setConnected(true),
      onError: (message) => setConnected(false, message),
    });
  }, [run?.id, applyEvent, onRefresh, setConnected]);

  useEffect(() => {
    if (run?.id && run.project_id === projectId && previousRunId.current !== run.id) {
      previousRunId.current = run.id;
      setSelectedConversationId("current");
      setTab("agent");
      setRailOpen(true);
    }
  }, [projectId, run?.id, run?.project_id]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [assetConversations, blocks.length, run?.assistant_text, run?.status]);

  const start = async (
    text: string,
    forcedKind?: AgentRunKind,
    attachments: AgentAttachment[] = [],
    showHistory = false
  ) => {
    if (submitting || disabled) return;
    const commandKind: AgentRunKind = forcedKind || (text.startsWith("/assemble") ? "assemble-film" : text.startsWith("/plan") ? "plan-scenes" : selectedLabel || !isNewVideo ? "enhance" : "create-film");
    setSubmitting(true);
    setSelectedConversationId("current");
    setHistoryOpen(showHistory);
    setTab("agent");
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
          visible_characters: graph.characters.map((character) => ({ id: character.id, name: character.name })),
          visible_objects: graph.objects.map((object) => ({ id: object.id, name: object.name })),
          visible_scenes: graph.scenes.map((scene) => ({ id: scene.id, order: scene.order })),
          attachments,
        },
      });
      window.localStorage.setItem(`stu3dio:agent-run:${projectId}`, snapshot.id);
      hydrate(snapshot);
    } catch (error) {
      setConnected(false, error instanceof Error ? error.message : "Could not start the agent run");
    } finally {
      setSubmitting(false);
    }
  };

  const resolveApproval = async (decision: "approve" | "revise" | "cancel", values: Record<string, unknown>, feedback?: string) => {
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
      setConnected(false, error instanceof Error ? error.message : "Could not resolve approval");
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
    update: (current: AssetConversation[]) => AssetConversation[]
  ) => {
    setAssetConversations((current) => {
      const next = update(current);
      window.localStorage.setItem(`stu3dio:asset-conversations:${projectId}`, JSON.stringify(next));
      return next;
    });
  };

  const submitAssetPrompt = async (
    text: string,
    selection: AssetConversation["selection"],
    showHistory = false
  ) => {
    if (!selection.length || editingSelected || disabled) return;
    const signature = selection.map((asset) => asset.key).sort().join("|");
    const reusable = !forceNewConversation.current
      ? assetConversations.find((conversation) =>
          conversation.selection.map((asset) => asset.key).sort().join("|") === signature
        )
      : null;
    const conversationId = reusable?.id || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const title = selection.length === 1
      ? `Edit ${selection[0].label}`
      : `Edit ${selection.length} selected assets`;
    forceNewConversation.current = false;

    commitAssetConversations((current) => {
      const existing = current.find((conversation) => conversation.id === conversationId);
      const conversation: AssetConversation = {
        id: conversationId,
        title: existing?.title || title,
        updatedLabel: "Just now",
        updatedAt: timestamp,
        selection,
        messages: [...(existing?.messages || []), { role: "user", content: text }],
      };
      return [conversation, ...current.filter((item) => item.id !== conversationId)];
    });
    setSelectedConversationId(conversationId);
    setHistoryOpen(showHistory);
    setTab("agent");
    setRailOpen(true);
    setEditingSelected(true);
    setEditStartedAt(timestamp);
    setSubmitting(true);
    setEditError(null);
    try {
      const updated = await onEditSelection(text, selection.map((asset) => asset.key));
      const response = updated > 0
        ? `Applied this visual direction to ${updated === 1 ? selection[0].label : `${updated} selected assets`}. Their project and scene context stayed attached while unrelated assets were left unchanged.`
        : `Saved this direction with ${selection.length === 1 ? selection[0].label : `${selection.length} selected assets`} as explicit context. This asset type does not yet have a direct regeneration job, so the conversation is ready for the backend revision workflow.`;
      commitAssetConversations((current) => current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, updatedLabel: "Just now", updatedAt: new Date().toISOString(), messages: [...conversation.messages, { role: "assistant", content: response }] }
          : conversation
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply those changes";
      setEditError(message);
      commitAssetConversations((current) => current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, messages: [...conversation.messages, { role: "assistant", content: `I couldn't apply that revision: ${message}` }] }
          : conversation
      ));
    } finally {
      setEditingSelected(false);
      setEditStartedAt(null);
      setSubmitting(false);
    }
  };

  const editSelected = (text: string) => submitAssetPrompt(
    text,
    selectedAssets.map((asset) => ({ key: asset.key, label: asset.label, kind: asset.kind }))
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
      void start("Revise the pacing while preserving the approved story and cast.", "enhance");
    }
  };

  const selectTab = (next: "agent" | "inspector") => {
    setTab(next);
    if (next === "inspector") setHistoryOpen(false);
    window.localStorage.setItem(`stu3dio:rail-tab:${projectId}`, next);
  };

  useEffect(() => {
    onComposerStateChange?.({
      disabled: disabled || submitting || editingSelected,
      awaitingApproval: run?.status === "awaiting_approval",
      editingSelection: editingSelected,
    });
  }, [disabled, editingSelected, onComposerStateChange, run?.status, submitting]);

  useImperativeHandle(ref, () => ({
    submitPrompt: (text, attachments = []) => {
      const selection = selectedAssets.map((asset) => ({
        key: asset.key,
        label: asset.label,
        kind: asset.kind,
      }));
      setTab("agent");
      setRailOpen(true);
      if (selection.length) void submitAssetPrompt(text, selection, true);
      else void start(text, undefined, attachments, true);
    },
    uploadAttachment: (file) => agentApi.uploadAttachment(projectId, file),
    openAgent: (options) => {
      setRailOpen(true);
      setTab(options?.inspector ? "inspector" : "agent");
      setHistoryOpen(!!options?.history && !options?.inspector);
    },
  }));

  return <>
    <aside className={`agent-ui agent-rail ${railOpen ? "is-open" : "is-closed"}`} aria-label="Stu3dio agent" aria-hidden={!railOpen}>
      <header className="agent-rail__header">
        <button
          className="agent-icon-button agent-history-toggle"
          onClick={() => { setTab("agent"); setHistoryOpen((open) => !open); }}
          aria-label="Conversation history"
          aria-expanded={historyOpen}
        >
          <PanelLeft size={16} />
        </button>
        <div className="agent-rail__tabs" data-active={tab} role="tablist" aria-label="Rail view">
          <span className="agent-rail__tab-indicator" aria-hidden="true" />
          <button role="tab" aria-selected={tab === "agent"} className={tab === "agent" ? "is-active" : ""} onClick={() => selectTab("agent")}>Agent</button>
          <button role="tab" aria-selected={tab === "inspector"} className={tab === "inspector" ? "is-active" : ""} onClick={() => selectTab("inspector")}>Inspector</button>
        </div>
        <button className="agent-icon-button agent-mobile-close" onClick={() => setRailOpen(false)} aria-label="Close agent"><X size={16} /></button>
      </header>

      <div className="agent-rail__panes">
        <motion.div
          className="agent-rail__view"
          initial={false}
          animate={{ opacity: tab === "agent" ? 1 : 0, x: tab === "agent" ? 0 : -4 }}
          transition={{ duration: .16, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ pointerEvents: tab === "agent" ? "auto" : "none" }}
          aria-hidden={tab !== "agent"}
          inert={tab !== "agent" ? true : undefined}
        >
          <div className={`agent-thread ${emptyHero ? "agent-thread--empty" : ""}`} ref={threadRef}>
            {emptyHero && (externalComposer ? <AgentEmptyThreadState /> : <AgentEmptyState
              disabled={submitting}
              contextOptions={contextOptions}
              onUploadAttachment={(file) => agentApi.uploadAttachment(projectId, file)}
              onSend={(text, attachments) => void start(text, undefined, attachments)}
            />)}
            {selectedConversation && <MockConversation conversation={selectedConversation} />}
            {!selectedConversation && blocks.map((block) => <BlockRenderer key={block.id} block={block} busy={submitting} onApproval={resolveApproval} onPlay={onPlay} onRecommendation={handleRecommendation} />)}
            {editingSelected && selectedAssetConversation && editStartedAt && <LoadingState label="Applying selected-asset changes" startedAt={editStartedAt} variant="orbit" />}
            {!selectedConversation && connectionError && <div className="agent-connection-note"><LoaderCircle size={12} className="animate-spin" /><span>{connectionError}</span></div>}
          </div>
          {(!emptyHero || externalComposer) && <footer className={`agent-rail__composer ${externalComposer ? "agent-rail__composer--mobile-only" : ""}`}>
            {run?.status === "awaiting_approval" && !selectedAssetConversation ? <div className="agent-approval-lock"><span>Review in progress</span><small>Approve, request changes, or cancel above.</small></div> : <PromptBar
              disabled={disabled || submitting || editingSelected}
              placeholder={activeAssetSelection.length ? `Continue with ${activeAssetSelection.length === 1 ? activeAssetSelection[0].label : `${activeAssetSelection.length} selected assets`}…` : isNewVideo ? "Describe the film you want to create…" : "Ask the agent to revise this film…"}
              contextOptions={activeAssetSelection.length ? [] : contextOptions}
              allowExtras={!activeAssetSelection.length}
              onUploadAttachment={activeAssetSelection.length ? undefined : (file) => agentApi.uploadAttachment(projectId, file)}
              onSend={(text, attachments) => activeAssetSelection.length
                ? void submitAssetPrompt(text, activeAssetSelection)
                : void start(text, undefined, attachments)}
            />}
            {run && <div className="agent-connection-status">
              {run && ACTIVE_STATUSES.has(run.status) && run.status !== "awaiting_approval" && <button type="button" onClick={cancel} disabled={submitting}><Square size={9} />Stop</button>}
              <span className={connected ? "is-connected" : ""} />{connected ? "Live orchestration" : run ? "Reconnecting" : "Ready"}
            </div>}
          </footer>}
          <ConversationNav
            open={historyOpen}
            activeId={selectedConversationId || (run ? "current" : undefined)}
            conversations={conversations}
            mocked={isNewVideo && !run}
            newConversationDisabled={!!run && ACTIVE_STATUSES.has(run.status)}
            onClose={() => setHistoryOpen(false)}
            onNewConversation={() => {
              forceNewConversation.current = true;
              setSelectedConversationId(null);
              setHistoryOpen(false);
            }}
            onSelect={(id) => {
              forceNewConversation.current = false;
              const conversation = assetConversations.find((item) => item.id === id);
              if (conversation) onSelectAssets?.(conversation.selection.map((asset) => asset.key));
              setSelectedConversationId(id);
              setHistoryOpen(false);
              setTab("agent");
            }}
          />
        </motion.div>
        <motion.div
          className="agent-rail__view agent-inspector-view"
          initial={false}
          animate={{ opacity: tab === "inspector" ? 1 : 0, x: tab === "inspector" ? 0 : 4 }}
          transition={{ duration: .16, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ pointerEvents: tab === "inspector" ? "auto" : "none" }}
          aria-hidden={tab !== "inspector"}
          inert={tab !== "inspector" ? true : undefined}
        >
          <div className="agent-inspector-scroll">
            {inspector}
            {selectedAssets.length === 1 && selectedAssets[0].editable && <>
              <FineTuneCard disabled={disabled} onApply={fineTune} />
            </>}
          </div>
          {selectedAssets.length > 0 && <footer className={`agent-inspector-composer ${externalComposer ? "agent-inspector-composer--mobile-only" : ""}`}>
            {editError && <p className="agent-inspector-composer__error" role="alert">{editError}</p>}
            <PromptBar
              disabled={disabled || editingSelected}
              placeholder={selectedAssets.length === 1 ? `Describe changes to ${selectedAssets[0].label}…` : `Describe one change for ${selectedAssets.length} selected assets…`}
              allowExtras={false}
              onSend={(text) => void editSelected(text)}
            />
            {editingSelected && <div className="agent-inspector-composer__status"><LoaderCircle size={11} className="animate-spin" />Applying changes…</div>}
          </footer>}
        </motion.div>
      </div>
    </aside>
  </>;
});

export default AgentRail;

function AgentEmptyThreadState() {
  return <div className="agent-empty-thread">
    <span>Agent</span>
    <h2>No conversation yet</h2>
    <p>Use the project prompt bar to start a conversation. Linked assets will travel with the prompt as structured context.</p>
  </div>;
}

function AgentEmptyState({
  disabled,
  contextOptions,
  onUploadAttachment,
  onSend,
}: {
  disabled: boolean;
  contextOptions: Array<{ id: string; label: string; kind: "character" | "object" | "scene" }>;
  onUploadAttachment: (file: File) => Promise<AgentAttachment>;
  onSend: (text: string, attachments: AgentAttachment[]) => void;
}) {
  return <div className="agent-empty-state"><h2>What should we make?</h2><PromptBar
    hero
    disabled={disabled}
    placeholder="Describe your film…"
    suggestions={["A tense one-location thriller", "A surreal sci-fi memory", "A quiet character drama"]}
    contextOptions={contextOptions}
    onUploadAttachment={onUploadAttachment}
    onSend={onSend}
  /></div>;
}

function MockConversation({
  conversation,
}: {
  conversation: {
    title: string;
    messages: ConversationMessage[];
    selection?: AssetConversation["selection"];
  };
}) {
  return <div className="agent-conversation-preview">
    <div>
      <span>Conversation</span>
      <h2>{conversation.title}</h2>
      {conversation.selection && <div className="agent-conversation-context" aria-label="Assets in this conversation">
        {conversation.selection.map((asset) => <span key={asset.key}>{asset.label}</span>)}
      </div>}
    </div>
    {conversation.messages.map((message, index) => message.role === "user"
      ? <div key={index} className="agent-user-message">{message.content}</div>
      : <div key={index} className="agent-stream"><p>{message.content}</p></div>)}
  </div>;
}

function BlockRenderer({ block, busy, onApproval, onPlay, onRecommendation }: {
  block: AgentBlock;
  busy: boolean;
  onApproval: (decision: "approve" | "revise" | "cancel", values: Record<string, unknown>, feedback?: string) => void;
  onPlay: (url: string) => void;
  onRecommendation: (id: string) => void;
}) {
  switch (block.type) {
    case "loading": return <LoadingState label={block.label} startedAt={block.startedAt} variant="orbit" />;
    case "thinking": return <ThinkingState label={block.label} activities={block.activities} active={block.active} />;
    case "streaming-message": return <StreamingText role={block.role} content={block.content} status={block.status} />;
    case "approval": return <ApprovalCard approval={block.approval} busy={busy} onApprove={(values) => onApproval("approve", values)} onRevise={(values, feedback) => onApproval("revise", values, feedback)} onCancel={() => onApproval("cancel", block.approval.values)} />;
    case "tool-group": return <ToolChips tools={block.tools} />;
    case "task-group": return <TaskRows tasks={block.tasks} />;
    case "context": return <ContextCards data={block.data} />;
    case "diff": return <DiffTable data={block.data} />;
    case "recommendation": return <RecommendationCard data={block.data} onAction={onRecommendation} />;
    case "insight": return <InsightCards data={block.data} />;
    case "artifact": return <ArtifactCard data={block.data} onOpen={(data) => { const url = String(data.url || ""); if (url && String(data.kind || "").includes("video")) onPlay(url); }} />;
    case "error": return <div className="agent-error-card"><strong>Production stopped</strong><p>{block.message}</p></div>;
  }
}
