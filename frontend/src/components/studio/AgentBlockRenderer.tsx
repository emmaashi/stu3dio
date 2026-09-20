import type { AgentBlock } from "@/types/agent";
import {
  ApprovalCard,
  ArtifactCard,
  ContextCards,
  DiffTable,
  FilmReadyCard,
  InsightCards,
  LoadingState,
  ProductionProgress,
  RecommendationCard,
  StreamingText,
  ThinkingState,
} from "@/components/beautiful-ui";

export default function AgentBlockRenderer({
  block,
  busy,
  onApproval,
  onApprovalValuesChange,
  onPlay,
  onRecommendation,
  filmTitle,
  filmPoster,
}: {
  block: AgentBlock;
  busy: boolean;
  onApproval: (
    decision: "approve" | "revise" | "cancel",
    values: Record<string, unknown>,
    feedback?: string,
  ) => void;
  onApprovalValuesChange?: (values: Record<string, unknown>) => void;
  onPlay: (url: string) => void;
  onRecommendation: (id: string) => void;
  filmTitle?: string;
  filmPoster?: string;
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
          onCancel={() => onApproval("cancel", block.approval.values)}
          onValuesChange={onApprovalValuesChange}
        />
      );
    case "progress":
      return (
        <ProductionProgress
          groups={block.groups}
          active={block.active}
          startedAt={block.startedAt}
          finishedAt={block.finishedAt}
        />
      );
    case "context":
      return <ContextCards data={block.data} />;
    case "diff":
      return <DiffTable data={block.data} />;
    case "recommendation":
      return (
        <RecommendationCard data={block.data} onAction={onRecommendation} />
      );
    case "film-ready":
      return (
        <FilmReadyCard
          data={block.data}
          title={filmTitle}
          poster={filmPoster}
          onPlay={onPlay}
        />
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
