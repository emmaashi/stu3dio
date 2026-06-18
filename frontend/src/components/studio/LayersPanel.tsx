"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStudioStore } from "@/store/useStudioStore";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { StudioGraph } from "./types";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

const ROW_BASE =
  "flex items-center gap-[9px] w-full px-[9px] py-[3px] rounded-[10px] text-[13px] text-left border border-transparent transition-colors";
const ROW_ON = "bg-glass-2 text-ink border-white/[.18]";
const ROW_OFF = "text-ink-2 hover:bg-glass hover:text-ink";

type Leaf = {
  key: string;
  label: string;
  icon: string;
  status?: "pending" | "generating" | "completed";
};
type Group = {
  groupKey: string; // collapse key
  focusKey?: string; // canvas node to pan to (groups without a node, e.g. Cast, omit this)
  label: string;
  icon: string;
  count: number;
  children: Leaf[];
};
type Item =
  | { type: "leaf"; leaf: Leaf }
  | { type: "group"; group: Group };

export default function LayersPanel({ graph }: { graph: StudioGraph }) {
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const focus = useStudioStore((s) => s.focus);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (groupKey: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (graph.overview)
      out.push({
        type: "leaf",
        leaf: {
          key: "overview",
          label: graph.overview.title || "Concept",
          icon: "doc",
        },
      });

    if (graph.characters.length > 0) {
      out.push({
        type: "group",
        group: {
          groupKey: "cast",
          // Cast has no canvas node — clicking it should only collapse/expand.
          label: "Cast",
          icon: "user",
          count: graph.characters.length,
          children: graph.characters.map((c) => ({
            key: `char-${c.id}`,
            label: c.name || "Character",
            icon: "user",
          })),
        },
      });
    }

    graph.scenes.forEach((s) => {
      out.push({
        type: "group",
        group: {
          groupKey: `scene-${s.id}`,
          focusKey: `scene-${s.id}`,
          label: `Scene ${s.order}${s.plot ? ` · ${s.plot}` : ""}`,
          icon: "scene",
          count: s.clips.length,
          children: s.clips.map((clip, i) => ({
            key: `clip-${clip.id}`,
            label: `Shot ${String(i + 1).padStart(2, "0")} · ${clip.label}`,
            icon: "clapper",
            status: clip.status,
          })),
        },
      });
    });

    out.push({
      type: "leaf",
      leaf: { key: "film", label: "Final film", icon: "play" },
    });
    return out;
  }, [graph]);

  const q = query.trim().toLowerCase();
  const matches = (s: string) => s.toLowerCase().includes(q);

  return (
    <aside className="flex flex-col min-h-0 flex-1 w-full bg-surface-1 overflow-y-auto">
      <div className="flex gap-[14px] px-4 pt-[14px] pb-2.5">
        <span className="text-[13px] font-semibold text-ink cursor-default">Assets</span>
      </div>
      <div className="px-3 pb-2.5">
        <input
          className="w-full px-[11px] py-[7px] rounded-[10px] text-[13px] text-ink bg-glass border border-hair outline-none focus:border-white/[.22]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets…"
        />
      </div>
      <div className="scroll flex-1 min-h-0 px-2 py-0.5 overflow-y-auto">
        {items.map((item) => {
          if (item.type === "leaf") {
            const r = item.leaf;
            if (q && !matches(r.label)) return null;
            return <LeafRow key={r.key} r={r} lead selectedKey={selectedKey} focus={focus} />;
          }

          const g = item.group;
          // While searching, only show groups with a matching label or child.
          const childMatches = g.children.filter((c) => !q || matches(c.label));
          if (q && !matches(g.label) && childMatches.length === 0) return null;
          // Auto-expand on search; otherwise honor collapsed state.
          const isCollapsed = !q && collapsed.has(g.groupKey);
          const shown = q ? childMatches : g.children;
          const groupOn = !!g.focusKey && selectedKey === g.focusKey;

          return (
            <div key={g.groupKey} className="flex flex-col">
              <button
                className={cn("group", ROW_BASE, groupOn ? ROW_ON : ROW_OFF)}
                onClick={() => {
                  toggle(g.groupKey);
                  if (g.focusKey) focus(g.focusKey);
                }}
                title={g.label}
              >
                <motion.span
                  className="grid place-items-center w-4 shrink-0 text-ink-3 group-hover:text-ink"
                  animate={{ rotate: isCollapsed ? 0 : 90 }}
                  transition={{ duration: 0.2, ease: EASE_CINE }}
                >
                  <Icon name="caretRight" size={12} />
                </motion.span>
                <span
                  className={cn(
                    "grid place-items-center shrink-0",
                    groupOn ? "text-ink" : "text-ink-3"
                  )}
                >
                  <Icon name={g.icon} size={14} />
                </span>
                <span className="flex-1 truncate">{g.label}</span>
                <span className="shrink-0 min-w-[18px] h-[18px] px-[5px] rounded-pill grid place-items-center text-[11px] font-semibold text-ink-3 bg-hair-2">
                  {g.count}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    key="children"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: EASE_CINE }}
                  >
                    {shown.map((c) => (
                      <LeafRow
                        key={c.key}
                        r={c}
                        indent
                        selectedKey={selectedKey}
                        focus={focus}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {items.length === 0 && <div className="p-4 text-[13px] slate">No layers yet</div>}
      </div>
    </aside>
  );
}

function LeafRow({
  r,
  indent,
  lead,
  selectedKey,
  focus,
}: {
  r: Leaf;
  indent?: boolean;
  lead?: boolean;
  selectedKey: string | null;
  focus: (key: string) => void;
}) {
  const on = selectedKey === r.key;
  return (
    <button
      className={cn(ROW_BASE, on ? ROW_ON : ROW_OFF, indent && "pl-[50px]")}
      onClick={() => focus(r.key)}
      title={r.label}
    >
      {lead && <span className="w-4 shrink-0" aria-hidden />}
      <span className={cn("grid place-items-center shrink-0", on ? "text-ink" : "text-ink-3")}>
        <Icon name={r.icon} size={14} />
      </span>
      <span className="flex-1 truncate">{r.label}</span>
      {r.status && (
        <span
          className={cn(
            "w-[7px] h-[7px] rounded-full shrink-0",
            r.status === "pending" && "bg-ink-4",
            r.status === "generating" && "bg-writer animate-soft-pulse",
            r.status === "completed" && "bg-ok"
          )}
          aria-hidden
        />
      )}
    </button>
  );
}
