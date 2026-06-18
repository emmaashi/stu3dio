"use client";

import { motion } from "framer-motion";
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
  // While the new-film hero composer is up it drives the cast step, so the rail
  // is non-interactive.
  heroActive?: boolean;
  onOpenScenes: () => void;
  onOpenFinal: () => void;
};

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
  heroActive,
  onOpenScenes,
  onOpenFinal,
}: Props) {
  const active = activeStage(graph);
  const activeIdx = Math.max(0, STEPS.findIndex((s) => s.id === active));
  const filmDone = !!graph.overview?.finalVideoUrl;

  // Progress fraction across the pipeline (0..1).
  const pct = filmDone ? 1 : activeIdx / (STEPS.length - 1);

  // The active stage's popup, if any. Cast is driven by the hero; shots fill in
  // automatically, so neither opens a popup from the rail.
  const open =
    !heroActive && active === "scenes"
      ? onOpenScenes
      : !heroActive && active === "film"
      ? onOpenFinal
      : null;

  const stepLabel = `Step ${activeIdx + 1} of ${STEPS.length} · ${STEPS[activeIdx]?.label}`;
  const hint = filmDone
    ? "Your film is ready - open to regenerate."
    : STEPS[activeIdx]?.hint;

  const Header = (
    <>
      <div className="text-[13px] font-semibold text-ink tracking-[-.005em] whitespace-nowrap">
        {stepLabel}
      </div>
      <div className="text-[12.5px] text-ink-3 tracking-[-.005em] truncate group-hover:text-ink-2">
        {hint}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-[7px] px-4 py-2.5 border-b border-hair bg-surface-1 shrink-0 z-[6]">
      <div className="flex items-center justify-between gap-4">
        {open ? (
          <button
            className="group min-w-0 -mx-1.5 px-1.5 py-0.5 text-left rounded-btn transition-colors hover:bg-glass"
            onClick={open}
            title={active === "film" ? "Open final film" : "Open scenes"}
          >
            {Header}
          </button>
        ) : (
          <div className="group min-w-0">{Header}</div>
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
