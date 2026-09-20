"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useEffect, useMemo, useState } from "react";

type Props = {
  label: string;
  startedAt: string | number | Date;
  status?: "active" | "paused";
  variant?: "drive" | "orbit";
};

export function LoadingState({
  label,
  startedAt,
  status = "active",
  variant = "drive",
}: Props) {
  const start = useMemo(
    () => new Date(startedAt).getTime() || Date.now(),
    [startedAt],
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [status]);

  const elapsed = Math.max(0, now - start) / 1000;
  return (
    <div className="agent-inline-state" role="status" aria-live="polite">
      <span
        className={`agent-pixel-loader agent-pixel-loader--${variant}`}
        aria-hidden="true"
      >
        {Array.from({ length: 9 }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      <span className="agent-shimmer-text">{label}</span>
      <span className="agent-mono agent-muted">
        {elapsed < 60
          ? `${elapsed.toFixed(1)}s`
          : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`}
      </span>
    </div>
  );
}
