"use client";

import { Play } from "lucide-react";
import { formatDuration } from "@/lib/productionProgress";

type Metric = { label?: unknown; value?: unknown };

type Props = {
  data: Record<string, unknown>;
  title?: string;
  poster?: string;
  onPlay?: (url: string) => void;
};

/** The finished film: a poster you can click, one line of facts, one Play. */
export function FilmReadyCard({ data, title, poster, onPlay }: Props) {
  const url = String(data.artifact_url || "");
  const metrics = Array.isArray(data.metrics) ? (data.metrics as Metric[]) : [];
  const caption = describeFilm(metrics);
  const play = () => {
    if (url) onPlay?.(url);
  };
  const filmTitle = title?.trim() || String(data.title || "Your film");

  return (
    <section
      className="agent-card agent-film-ready"
      aria-label="Your film is ready"
    >
      <div className="agent-film-ready__copy">
        <small>Your film is ready</small>
        <strong>{filmTitle}</strong>
        {caption && <span className="agent-mono">{caption}</span>}
      </div>
      <button
        type="button"
        className="agent-film-ready__poster"
        onClick={play}
        disabled={!url}
        aria-label={`Play ${filmTitle}`}
      >
        {poster ? (
          <img src={poster} alt="" />
        ) : url ? (
          <video src={url} muted playsInline preload="metadata" />
        ) : null}
        <span className="agent-film-ready__glyph" aria-hidden="true">
          <Play size={18} fill="currentColor" />
        </span>
      </button>
    </section>
  );
}

/** [{Clips,19},{Runtime,"152s"},{Format,"16:9"}] → "19 clips · 2:32 · 16:9". */
export function describeFilm(metrics: Metric[]): string {
  const find = (pattern: RegExp) =>
    metrics.find((metric) => pattern.test(String(metric.label || "")))?.value;
  const parts: string[] = [];
  const clips = Number(find(/clip/i));
  if (Number.isFinite(clips) && clips > 0)
    parts.push(`${clips} ${clips === 1 ? "clip" : "clips"}`);
  const runtimeRaw = String(find(/runtime|duration/i) ?? "");
  const seconds = Number(runtimeRaw.replace(/[^\d.]/g, ""));
  if (runtimeRaw && Number.isFinite(seconds) && seconds > 0)
    parts.push(formatDuration(seconds));
  const format = find(/format|aspect/i);
  if (format) parts.push(String(format));
  return parts.join(" · ");
}
