import type { AgentBlock } from "@/types/agent";
import {
  ApprovalCard,
  ArtifactCard,
  ContextCards,
  DiffTable,
  InsightCards,
  LoadingState,
  RecommendationCard,
  StreamingText,
  TaskRows,
  ThinkingState,
  ToolChips,
} from "@/components/beautiful-ui";

export default function AgentBlockRenderer({
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
