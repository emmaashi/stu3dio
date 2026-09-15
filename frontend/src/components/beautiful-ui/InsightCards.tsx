/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
export function InsightCards({ data }: { data: Record<string, unknown> }) {
  const metrics = Array.isArray(data.metrics) ? data.metrics as Array<Record<string, unknown>> : [];
  return <section className="agent-card agent-insight"><header className="agent-card__header"><span>{String(data.title || "Production insight")}</span><span>Insight</span></header><div className="agent-insight__metrics" style={{ gridTemplateColumns: `repeat(${Math.max(metrics.length, 1)}, minmax(0, 1fr))` }}>{metrics.map((metric, index) => <div key={`${String(metric.label)}-${index}`}><strong>{String(metric.value)}</strong><span>{String(metric.label)}</span></div>)}</div></section>;
}
