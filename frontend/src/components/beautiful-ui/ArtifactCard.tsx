/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { Film, Image as ImageIcon } from "lucide-react";

export function ArtifactCard({
  data,
  onOpen,
}: {
  data: Record<string, unknown>;
  onOpen?: (data: Record<string, unknown>) => void;
}) {
  const url = String(data.url || data.video_url || data.image_url || "");
  const video = String(data.kind || "").includes("video");
  return (
    <button
      className="agent-card agent-artifact"
      onClick={() => onOpen?.(data)}
      disabled={!url}
    >
      <span className="agent-artifact__preview">
        {url ? (
          video ? (
            <video src={url} muted preload="metadata" />
          ) : (
            <img src={url} alt="" />
          )
        ) : (
          <span>{video ? <Film size={19} /> : <ImageIcon size={19} />}</span>
        )}
      </span>
      <span className="agent-artifact__copy">
        <small>New artifact</small>
        <strong>
          {String(data.title || (video ? "Generated clip" : "Generated image"))}
        </strong>
      </span>
    </button>
  );
}
