"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./Button";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

// Gate between the cast and the scene spine: the user adds optional direction
// for how the scenes should look, then breaks the story into scenes.
export default function ScenesModal({
  busy,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  onSubmit: (direction: string) => void;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState("");

  const submit = () => onSubmit(direction.trim());

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
        className="glass w-[min(460px,94vw)] max-h-[88vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: EASE_CINE }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-hair">
          <div className="font-bold text-[15px]">Break the story into scenes</div>
          {!busy && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <span>Cancel</span>
            </Button>
          )}
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-2">
          <p className="m-0 mb-1.5 text-[13.5px] leading-normal text-ink-2">
            The director will turn your concept into scenes. Add any direction for
            how they should look: tone, locations, or key beats.
          </p>
          <label className="text-xs font-semibold text-ink-3">
            Scene direction{" "}
            <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <textarea
            className="field min-h-[110px] resize-none"
            autoFocus
            value={direction}
            placeholder="e.g. rain-soaked neon streets at night; open on a wide establishing shot; end on a tight close-up."
            disabled={busy}
            onChange={(e) => setDirection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
        </div>
        <div className="flex gap-2.5 px-4 py-3.5 border-t border-hair justify-end">
          <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
            <span>{busy ? "Working…" : "Break into scenes"}</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
