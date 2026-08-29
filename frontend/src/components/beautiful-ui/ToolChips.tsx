"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useState } from "react";
import { Check, ChevronDown, LoaderCircle, Wrench, X } from "lucide-react";
import type { AgentTask } from "@/types/agent";

export function ToolChips({ tools }: { tools: AgentTask[] }) {
  const [open, setOpen] = useState(false);
  const visible = tools.slice(-8);
  return (
    <section className="agent-tools">
      <button className="agent-tools__summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Wrench size={13} />
        <span>{tools.length} production operation{tools.length === 1 ? "" : "s"}</span>
        <ChevronDown size={13} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="agent-tool-chips">
          {visible.map((tool) => (
            <span className={`agent-tool-chip agent-tool-chip--${tool.status}`} key={tool.id} title={tool.detail}>
              {tool.status === "completed" ? <Check size={11} /> : tool.status === "failed" ? <X size={11} /> : <LoaderCircle size={11} className={tool.status === "running" ? "animate-spin" : ""} />}
              {tool.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
