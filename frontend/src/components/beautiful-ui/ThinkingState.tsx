"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useEffect, useState } from "react";
import { Check, ChevronDown, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import type { AgentActivity } from "@/types/agent";

export function ThinkingState({ label, activities, active }: { label: string; activities: AgentActivity[]; active: boolean }) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);

  if (!active && activities.length === 1 && activities[0]?.status === "completed") {
    return <div className="agent-thinking-summary" aria-label="Agent activity complete"><Check size={13} /><span>{label}</span><small>{activities[0].label}</small></div>;
  }

  return (
    <section className="agent-thinking" aria-label="Agent activity">
      <button className="agent-thinking__toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        {active ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
        <span>{label}</span>
        <ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
      </button>
      {expanded && (
        <div className="agent-thinking__trace">
          {activities.map((activity) => (
            <div className="agent-thinking__row" key={activity.id}>
              <span className="agent-thinking__icon" aria-hidden="true">
                {activity.status === "completed" ? <Check size={12} /> : activity.status === "failed" ? <TriangleAlert size={12} /> : active ? <LoaderCircle size={12} className="animate-spin" /> : <Circle size={9} />}
              </span>
              <span>{activity.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
