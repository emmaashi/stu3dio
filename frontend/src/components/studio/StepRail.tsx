"use client";

import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { StudioGraph } from "./types";

// The five pipeline stages, in order.
const STEPS = [
  { id: "overview", label: "Overview", hint: "Describe your film idea to the director below." },
  { id: "characters", label: "Characters", hint: "Generate the cast from your concept." },
  { id: "scenes", label: "Scenes", hint: "Break the story into scenes." },
  { id: "shots", label: "Shots", hint: "Each scene becomes a set of shots." },
  { id: "film", label: "Final film", hint: "Stitch the shots into the finished film." },
] as const;

type StepId = (typeof STEPS)[number]["id"];

type Props = {
  graph: StudioGraph;
  busy: Record<string, boolean>;
  onGenerateCast: () => void;
  onGenerateScenes: () => void;
  onGenerateFilm: () => void;
};

const CTA_BTN =
  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12.5px] font-semibold text-accent-ink bg-accent transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-default";

// Derive how far the pipeline has progressed from the current graph.
function activeStage(graph: StudioGraph): StepId {
  const hasPlot = !!graph.overview?.plot?.trim();
  const hasChars = graph.characters.length > 0;
  const hasScenes = graph.scenes.length > 0;
  const allShots =
    graph.scenes.flatMap((s) => s.clips).length > 0 &&
    graph.scenes.flatMap((s) => s.clips).every((c) => c.status === "completed");
  if (graph.complete || (hasScenes && allShots)) return "film";
  if (!hasPlot) return "overview";
  if (!hasChars) return "characters";
  if (!hasScenes) return "scenes";
  return "shots";
}

export default function StepRail({
  graph,
  busy,
  onGenerateCast,
  onGenerateScenes,
  onGenerateFilm,
}: Props) {
  const active = activeStage(graph);
  const activeIdx = Math.max(0, STEPS.findIndex((s) => s.id === active));
  const filmDone = !!graph.overview?.finalVideoUrl;

  // Progress fraction across the pipeline (0..1).
  const pct = filmDone ? 1 : activeIdx / (STEPS.length - 1);

  // The action that advances the current stage. Shots fill in automatically
  // once scenes exist, so that stage has no button.
  let cta: { label: string; onClick: () => void; busy: boolean } | null = null;
  if (active === "characters") {
    cta = {
      label: "Generate the cast",
      onClick: onGenerateCast,
      busy: !!busy.characters || !!busy.director,
    };
  } else if (active === "scenes") {
    cta = {
      label: "Break into scenes",
      onClick: onGenerateScenes,
      busy: !!busy.scenes,
    };
  } else if (active === "film" && !filmDone) {
    cta = {
      label: "Generate final film",
      onClick: onGenerateFilm,
      busy: !!busy.film,
    };
  }

  return (
    <div className="flex flex-col gap-[7px] px-4 py-2.5 border-b border-hair bg-surface-1 shrink-0 z-[6]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink tracking-[-.005em] whitespace-nowrap">
            Step {activeIdx + 1} of {STEPS.length} · {STEPS[activeIdx]?.label}
          </div>
          <div className="text-[12.5px] text-ink-3 tracking-[-.005em] truncate">
            {filmDone ? "Your film is ready." : STEPS[activeIdx]?.hint}
          </div>
        </div>
        {cta && (
          <button
            className={cn(CTA_BTN)}
            onClick={cta.onClick}
            disabled={cta.busy}
          >
            <Icon name="wand" size={14} />
            <span>{cta.busy ? "Working…" : cta.label}</span>
          </button>
        )}
      </div>
      <div
        className="h-[5px] rounded-pill bg-hair-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
      >
        <motion.div
          className="h-full rounded-[inherit] bg-[linear-gradient(90deg,color-mix(in_oklab,var(--accent)_80%,#fff_20%),var(--accent))]"
          initial={false}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
