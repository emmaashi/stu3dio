"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { Copy, RotateCcw } from "lucide-react";

export function StreamingText({
  role,
  content,
  status,
  onRetry,
}: {
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "completed" | "interrupted";
  onRetry?: () => void;
}) {
  const copy = () => void navigator.clipboard?.writeText(content);
  if (role === "user") return <div className="agent-user-message">{content}</div>;
  return (
    <article className="agent-stream" aria-live={status === "streaming" ? "polite" : "off"}>
      <p>{content}<span className={status === "streaming" ? "agent-stream-caret" : "hidden"} aria-hidden="true" /></p>
      {status !== "streaming" && (
        <div className="agent-stream__actions">
          <button onClick={copy} aria-label="Copy response"><Copy size={13} /></button>
          {status === "interrupted" && onRetry && <button onClick={onRetry}><RotateCcw size={13} /><span>Retry</span></button>}
        </div>
      )}
    </article>
  );
}
