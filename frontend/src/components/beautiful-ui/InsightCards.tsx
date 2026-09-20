import { Check } from "lucide-react";
import { formatDuration } from "@/lib/productionProgress";

/**
 * A run milestone without media (e.g. "Production ready"): one quiet line with
 * the numbers, styled like a completed activity rather than a dashboard.
 */
export function InsightCards({ data }: { data: Record<string, unknown> }) {
  const metrics = Array.isArray(data.metrics)
    ? (data.metrics as Array<Record<string, unknown>>)
    : [];
  const summary = metrics
    .filter((metric) => metric.value !== undefined && metric.value !== "")
    .map((metric) => {
      const label = String(metric.label || "").toLowerCase();
      const raw = String(metric.value);
      const seconds = Number(raw.replace(/[^\d.]/g, ""));
      const value =
        /runtime|duration/.test(label) &&
        /^\d+(\.\d+)?s?$/.test(raw) &&
        seconds > 0
          ? formatDuration(seconds)
          : raw;
      return `${value} ${label}`.trim();
    })
    .join(" · ");
  return (
    <div className="agent-insight-line" aria-label="Production insight">
      <Check size={13} />
      <span>{String(data.title || "Production insight")}</span>
      {summary && <small>{summary}</small>}
    </div>
  );
}
