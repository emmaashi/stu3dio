"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import type { StudioActions } from "./useStudioPipeline";
import type { StudioGraph } from "./types";
import type { DirectorMessage } from "@/data/directorData";
import { HP_PROMPT } from "@/films/harry-potter";

const EASE = [0.22, 0.61, 0.36, 1] as const;

// A few short concepts to give a brand-new film instant momentum. The first is
// the demo prompt the mock backend has a full hand-authored film for.
const EXAMPLES = [
  HP_PROMPT,
  "A neon-noir detective mystery",
  "A lonely colonist on Mars",
];

type Props = {
  graph: StudioGraph;
  busy: Record<string, boolean>;
  actions: StudioActions;
  directorLog: DirectorMessage[];
};

export default function NewFilmHero({ graph, busy, actions, directorLog }: Props) {
  const hasPlot = !!graph.overview?.plot?.trim();
  const directorBusy = !!busy.director;
  const castBusy = !!busy.characters;
  const [text, setText] = useState("");
  const [refining, setRefining] = useState(false);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || directorBusy) return;
    setText("");
    setRefining(false);
    void actions.sendDirector(v);
  };

  const lastDirector = [...directorLog].reverse().find((m) => m.type !== "user");
  const composing = !hasPlot || refining;

  return (
    <motion.div
      className="absolute inset-0 z-[7] grid place-items-center px-6 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(58%_58%_at_50%_42%,transparent_0%,color-mix(in_oklab,var(--surface-0)_58%,transparent)_100%)]" />

      <motion.div
        key={composing ? "compose" : "review"}
        className="pointer-events-auto relative w-[min(620px,92%)] flex flex-col items-center text-center"
        initial={{ y: 14, scale: 0.985, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {composing ? (
          <>
            <h1 className="[font-family:var(--font-display)] text-[28px] leading-tight font-bold tracking-[-.02em] text-ink">
              Let&rsquo;s make a film
            </h1>
            <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-ink-3">
              Describe your idea: the story, the tone, the characters. The director
              shapes it into a concept you can turn into a cast, scenes, and a film.
            </p>

            <div className="mt-6 w-full flex flex-col gap-1.5 p-2 rounded-[16px] bg-glass-2 border border-hair shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-md">
              <textarea
                autoFocus
                rows={3}
                className="w-full resize-none bg-transparent px-3 pt-2.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-4"
                placeholder={`${HP_PROMPT}\u2026`}
                value={text}
                disabled={directorBusy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(text);
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2 pl-2">
                <span className="text-[11.5px] text-ink-4">
                  Enter to send &middot; Shift+Enter for a new line
                </span>
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-btn text-[13px] font-semibold text-accent-ink bg-accent transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-default"
                  onClick={() => send(text)}
                  disabled={directorBusy || !text.trim()}
                >
                  {directorBusy ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-accent-ink/30 border-t-accent-ink animate-spin" />
                      <span>Shaping&hellip;</span>
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={15} />
                      <span>Start</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {!directorBusy && (
              <div className="mt-5 flex flex-col items-center gap-2.5">
                <span className="text-[11px] font-medium uppercase tracking-[.12em] text-ink-4">
                  Try one of these
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      className="px-3.5 py-1.5 rounded-pill text-[12.5px] text-ink-2 bg-glass border border-hair transition-colors hover:text-ink hover:border-white/20 hover:bg-glass-2"
                      onClick={() => send(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {refining && hasPlot && (
              <button
                className="mt-3 text-[12.5px] text-ink-4 transition-colors hover:text-ink-2"
                onClick={() => setRefining(false)}
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-accent mb-3">
              Concept ready
            </span>
            {graph.overview?.summary && (
              <p className="mt-2.5 max-w-[480px] text-[14px] leading-relaxed text-ink-2">
                {graph.overview.summary}
              </p>
            )}
            {lastDirector?.content && (
              <p className="mt-3 max-w-[480px] text-[13px] leading-relaxed text-ink-3 line-clamp-4">
                {lastDirector.content}
              </p>
            )}

            <div className="mt-6 flex items-center gap-2.5">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-btn text-[13.5px] font-semibold text-accent-ink bg-accent transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-default"
                onClick={() => !castBusy && actions.generateCast()}
                disabled={castBusy}
              >
                {castBusy ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-accent-ink/30 border-t-accent-ink animate-spin" />
                    <span>Assembling the cast&hellip;</span>
                  </>
                ) : (
                  <>
                    <Icon name="wand" size={16} />
                    <span>Generate the cast</span>
                  </>
                )}
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-btn text-[13.5px] font-semibold text-ink-2 bg-glass border border-hair transition-colors hover:text-ink hover:bg-glass-2 disabled:opacity-50"
                onClick={() => setRefining(true)}
                disabled={castBusy}
              >
                <Icon name="refresh" size={15} />
                <span>Refine idea</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
