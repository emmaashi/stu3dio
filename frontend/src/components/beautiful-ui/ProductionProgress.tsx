"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  elapsedBetween,
  summarizeProgress,
  type TaskGroup,
} from "@/lib/productionProgress";
import { Collapse } from "./Collapse";

type Props = {
  groups: TaskGroup[];
  active: boolean;
  startedAt?: string;
  finishedAt?: string;
};

/**
 * One block for all production work. Open while jobs run, one quiet line once
 * they finish; failures stay visible either way.
 */
export function ProductionProgress({
  groups,
  active,
  startedAt,
  finishedAt,
}: Props) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    setExpanded(active);
  }, [active]);

  const failed = groups.flatMap((group) => group.failed);
  const summary = summarizeProgress(groups, active);
  const elapsed = active ? null : elapsedBetween(startedAt, finishedAt);

  return (
    <section className="agent-progress" aria-label="Production progress">
      <button
        className="agent-thinking__toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {active ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : failed.length ? (
          <TriangleAlert size={14} className="agent-progress__warn" />
        ) : (
          <Check size={14} className="agent-progress__done" />
        )}
        <span>{summary}</span>
        {elapsed && <small className="agent-mono agent-muted">{elapsed}</small>}
        <ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
      </button>
      <Collapse open={expanded}>
        <div className="agent-progress__groups">
          {groups.map((group) => (
            <div
              className={`agent-progress__group agent-progress__group--${group.status}`}
              key={group.id}
            >
              <span>{group.label}</span>
              <span className="agent-mono agent-muted">
                {group.completed}/{group.total}
              </span>
              <span
                className="agent-progress__bar"
                role="progressbar"
                aria-label={`${group.label} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={group.progress}
              >
                <i style={{ width: `${group.progress}%` }} />
              </span>
              {active && group.running && group.status !== "completed" && (
                <small>{group.running.label}</small>
              )}
            </div>
          ))}
        </div>
      </Collapse>
      {failed.length > 0 && (
        <ul className="agent-progress__failed">
          {failed.map((task) => (
            <li key={task.id}>
              <X size={12} />
              <span>{task.label}</span>
              {task.detail && <small>{task.detail}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
