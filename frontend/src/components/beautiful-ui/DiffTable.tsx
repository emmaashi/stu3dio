/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { ArrowRight, Minus, Plus } from "lucide-react";

export function DiffTable({ data }: { data: Record<string, unknown> }) {
  const rows = Array.isArray(data.rows) ? data.rows as Array<Record<string, unknown>> : [];
  return <section className="agent-card agent-diff"><header className="agent-card__header"><span>{String(data.title || "Proposed changes")}</span><span>{rows.length} edits</span></header><div className="agent-diff__rows">{rows.map((row, index) => <div className="agent-diff-row" key={String(row.id || index)}><span className={`agent-diff-mark agent-diff-mark--${String(row.change || "modified")}`}>{row.change === "added" ? <Plus size={11} /> : row.change === "removed" ? <Minus size={11} /> : <ArrowRight size={11} />}</span><div><strong>{String(row.label || `Change ${index + 1}`)}</strong>{row.before ? <del>{String(row.before)}</del> : null}<ins>{String(row.after || "")}</ins></div></div>)}</div></section>;
}
