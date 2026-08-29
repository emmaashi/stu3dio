/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { ArrowRight } from "lucide-react";

export function RecommendationCard({ data, onAction }: { data: Record<string, unknown>; onAction?: (id: string) => void }) {
  const actions = Array.isArray(data.actions) ? data.actions as Array<Record<string, unknown>> : [];
  return <section className="agent-card agent-recommendation"><div className="agent-recommendation__copy"><small>Suggested next step</small><h3>{String(data.title || "Recommendation")}</h3><p>{String(data.description || "")}</p>{typeof data.confidence === "number" && <div className="agent-confidence"><span><i style={{ width: `${Math.round(Number(data.confidence) * 100)}%` }} /></span><small>{Math.round(Number(data.confidence) * 100)}% confidence</small></div>}<div className="agent-recommendation__actions">{actions.map((action) => <button className={action.kind === "primary" ? "agent-button agent-button--primary" : "agent-button agent-button--secondary"} key={String(action.id)} onClick={() => onAction?.(String(action.id))}>{String(action.label)}<ArrowRight size={13} /></button>)}</div></div></section>;
}
