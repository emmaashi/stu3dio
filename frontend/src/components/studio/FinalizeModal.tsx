"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./Button";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

// Final step of the pipeline: name the film, then generate (stitch) it. Once a
// film exists this same popup re-runs the cut so the user can iterate.
export default function FinalizeModal({
  defaultName,
  busy,
  alreadyGenerated,
  onGenerate,
  onClose,
}: {
  defaultName: string;
  busy: boolean;
  alreadyGenerated?: boolean;
  onGenerate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName || "");

  const submit = () => onGenerate(name.trim() || defaultName || "Untitled film");

  const title = alreadyGenerated ? "Regenerate your film" : "Generate your film";
  const blurb = alreadyGenerated
    ? "Re-stitch the latest shots into a fresh cut. Rename it if you like."
    : "All shots are ready. Name your film and stitch it into the final cut.";
  const cta = busy
    ? alreadyGenerated
      ? "Regenerating…"
      : "Generating…"
    : alreadyGenerated
    ? "Regenerate film"
    : "Generate film";

  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center p-10 bg-[rgba(6,5,9,.66)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_CINE }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <motion.div
        className="glass w-[min(440px,94vw)] max-h-[88vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: EASE_CINE }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-hair">
          <div className="font-bold text-[15px]">{title}</div>
          {!busy && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <span>Cancel</span>
            </Button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-2">
          <p className="m-0 mb-1.5 text-[13.5px] leading-normal text-ink-2">
            {blurb}
          </p>
          <label className="text-xs font-semibold text-ink-3">Film name</label>
          <input
            className="field"
            autoFocus
            value={name}
            placeholder="Untitled film"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div className="flex gap-2.5 px-4 py-3.5 border-t border-hair justify-end">
          <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
            <span>{cta}</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
