"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { Check, Circle, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { AgentTask } from "@/types/agent";

export function TaskRows({ tasks, onRetry }: { tasks: AgentTask[]; onRetry?: (task: AgentTask) => void }) {
  return (
    <section className="agent-card agent-task-card">
      <header className="agent-card__header">
        <span>Production tasks</span>
        <span className="agent-mono agent-muted">{tasks.filter((task) => task.status === "completed").length}/{tasks.length}</span>
      </header>
      <div className="agent-task-list">
        {tasks.map((task) => (
          <div className="agent-task-row" key={task.id}>
            <span className={`agent-task-status agent-task-status--${task.status}`}>
              {task.status === "completed" ? <Check size={12} /> : task.status === "failed" ? <X size={12} /> : task.status === "running" ? <LoaderCircle size={12} className="animate-spin" /> : <Circle size={9} />}
            </span>
            <div className="agent-task-copy">
              <span>{task.label}</span>
              {task.detail && <small>{task.detail}</small>}
            </div>
            <span className="agent-mono agent-muted">{Math.round(task.progress || 0)}%</span>
            {task.status === "failed" && onRetry && <button className="agent-icon-button" onClick={() => onRetry(task)} aria-label={`Retry ${task.label}`}><RotateCcw size={13} /></button>}
            <span className="agent-task-progress" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}
