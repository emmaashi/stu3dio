"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle, PencilLine, Sparkles, X } from "lucide-react";
import ScribbleEditor, {
  type ScribbleExport,
  type ScribbleLine,
} from "@/components/ScribbleEditor";
import styles from "./AnnotateModal.module.css";

export default function AnnotateModal({
  src,
  title,
  busy,
  onApply,
  onClose,
}: {
  src: string;
  title?: string;
  busy: boolean;
  onApply: (
    prompt: string,
    compositeDataUrl: string | null,
  ) => Promise<void> | void;
  onClose: () => void;
}) {
  const exportRef = useRef<ScribbleExport | null>(null);
  const [lines, setLines] = useState<ScribbleLine[]>([]);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const locked = busy || submitting;
  const hasDrawing = lines.some(
    (line) => !line.erase && line.tool !== "eraser",
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const apply = async () => {
    if (locked || (!prompt.trim() && !hasDrawing)) return;
    setError(null);
    const composite = hasDrawing ? exportRef.current?.toDataURL() : null;
    if (hasDrawing && !composite) {
      setError(
        "Couldn’t include your drawing. Please reload the image and try again.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await onApply(
        prompt.trim() ||
          "Incorporate the drawn annotations into the image, blending them naturally.",
        composite || null,
      );
    } catch {
      setError(
        "Couldn’t apply this edit. Your drawing and instructions are still here—try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Draw an edit"
        tabIndex={-1}
        data-annotation-editor
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        exit={{ y: 4 }}
        transition={{ duration: 0.18 }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === "Enter" &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void apply();
          }
          if (event.key === "Tab") {
            const nodes = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ) || [],
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialogRef.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className={styles.header}>
          <PencilLine size={15} />
          <h2>Draw an edit</h2>
          {title && (
            <>
              <span className={styles.divider} />
              <span className={styles.assetTitle}>{title}</span>
            </>
          )}
          <button
            className={styles.close}
            aria-label="Close drawing editor"
            title="Close · Esc"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <ScribbleEditor
          src={src}
          exportRef={exportRef}
          lines={lines}
          onChangeLines={setLines}
          disabled={locked}
        />
        <footer className={styles.footer}>
          <label className={styles.promptLabel} htmlFor="annotation-prompt">
            Describe the change
            <span>
              {hasDrawing
                ? "Your drawing will be included"
                : "Draw on the image, describe a change, or use both"}
            </span>
          </label>
          <div className={styles.composer}>
            <textarea
              id="annotation-prompt"
              aria-label="Describe your drawing"
              value={prompt}
              disabled={locked}
              rows={2}
              placeholder="Describe what should change…"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              className={styles.apply}
              onClick={() => void apply()}
              disabled={locked || (!prompt.trim() && !hasDrawing)}
            >
              {locked ? (
                <LoaderCircle className={styles.spinner} size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              <span>{locked ? "Applying…" : "Apply edit"}</span>
            </button>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
