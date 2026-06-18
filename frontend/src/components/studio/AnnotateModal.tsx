"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import ScribbleEditor, { type ScribbleExport } from "@/components/ScribbleEditor";
import { Icon } from "./Icon";
import { Button } from "./Button";

const EASE_CINE = [0.22, 0.61, 0.36, 1] as const;

// Lightweight overlay that lets the user draw on an asset image and submit an
// edit. The composited PNG (image + strokes) is passed back so the backend
// image-editing job actually "sees" the annotation.
export default function AnnotateModal({
  src,
  busy,
  onApply,
  onClose,
}: {
  src: string;
  busy: boolean;
  onApply: (prompt: string, compositeDataUrl: string | null) => void;
  onClose: () => void;
}) {
  const exportRef = useRef<ScribbleExport | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");

  const apply = () => {
    const composite = lines.length > 0 ? exportRef.current?.toDataURL() ?? null : null;
    onApply(
      prompt.trim() ||
        "Incorporate the drawn annotations into the image, blending them naturally.",
      composite
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center p-10 bg-[rgba(6,5,9,.66)] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_CINE }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="glass w-[min(640px,94vw)] max-h-[88vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: EASE_CINE }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-hair">
          <div className="font-bold text-[15px]">Annotate &amp; edit</div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="x" size={16} />
            <span>Close</span>
          </Button>
        </div>
        <div className="p-4 overflow-y-auto">
          <ScribbleEditor
            src={src}
            exportRef={exportRef}
            lines={lines}
            onChangeLines={setLines}
          />
        </div>
        <div className="flex gap-2.5 px-4 py-3.5 border-t border-hair">
          <input
            className="field flex-1"
            value={prompt}
            placeholder="Describe the edit (optional if you drew something)…"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
          <Button variant="primary" onClick={apply} disabled={busy}>
            <Icon name="sparkle" size={16} />
            <span>{busy ? "Editing…" : "Apply edit"}</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
