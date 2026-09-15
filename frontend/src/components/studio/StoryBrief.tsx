"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileText, Link2, X } from "lucide-react";
import type { Overview } from "./types";

export type BriefValues = Pick<Overview, "title" | "summary" | "plot">;
export default function StoryBrief({
  overview,
  visible,
  onSave,
  onClose,
}: {
  overview: Overview;
  visible: boolean;
  onSave: (values: BriefValues) => Promise<void> | void;
  onClose: () => void;
}) {
  const source = {
    title: overview.title,
    summary: overview.summary,
    plot: overview.plot,
  };
  const [values, setValues] = useState<BriefValues>(source);
  const [saved, setSaved] = useState<BriefValues>(source);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conceptField = useRef<HTMLTextAreaElement>(null);
  const plotField = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const lastSource = useRef(JSON.stringify(source));
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useEffect(() => {
    if (dirty || saving) return;
    const next = {
      title: overview.title,
      summary: overview.summary,
      plot: overview.plot,
    };
    if (lastSource.current === JSON.stringify(next)) return;
    lastSource.current = JSON.stringify(next);
    setValues(next);
    setSaved(next);
  }, [overview.title, overview.summary, overview.plot, dirty, saving]);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    for (const field of [conceptField.current, plotField.current]) {
      if (!field) continue;
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + 2}px`;
    }
  }, [visible, values.summary, values.plot]);
  async function save() {
    if (!dirty || saving) return;
    const next = { ...values, title: values.title.trim() || "Untitled film" };
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setSaved(next);
      setValues(next);
    } catch {
      setError("Your changes could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="studio-brief-backdrop"
      hidden={!visible}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="studio-brief-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-brief-heading"
        tabIndex={-1}
        data-story-brief
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "s"
          ) {
            event.preventDefault();
            void save();
          }
          if (event.key === "Tab") {
            const elements = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
              ) || [],
            );
            const first = elements[0],
              last = elements[elements.length - 1];
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
        <header className="studio-brief-toolbar">
          <FileText size={15} />
          <h2 id="story-brief-heading">Story brief</h2>
          <button
            className="studio-brief-close"
            onClick={onClose}
            aria-label="Close story brief"
            title="Close · Esc"
          >
            <X size={17} />
          </button>
        </header>
        <div className="studio-brief-scroll">
          <article className="studio-brief-document">
            <input
              aria-label="Title"
              className="studio-brief-title"
              disabled={saving}
              value={values.title}
              placeholder="Give your story a name"
              onChange={(e) => setValues({ ...values, title: e.target.value })}
            />
            <p className="studio-brief-intro">
              The thread that holds your film together.
            </p>
            <label htmlFor="story-concept">
              The idea<span>What is this story really about?</span>
            </label>
            <textarea
              ref={conceptField}
              id="story-concept"
              aria-label="Concept"
              rows={3}
              disabled={saving}
              value={values.summary}
              placeholder="A world, a character, a question worth exploring…"
              onChange={(e) =>
                setValues({ ...values, summary: e.target.value })
              }
            />
            <label htmlFor="story-plot">
              The story
              <span>Your characters, their world, and what happens next.</span>
            </label>
            <textarea
              ref={plotField}
              id="story-plot"
              aria-label="Plot"
              rows={7}
              disabled={saving}
              value={values.plot}
              placeholder="Follow the story from its first moment. Leave room for what comes next…"
              onChange={(e) => setValues({ ...values, plot: e.target.value })}
            />
            <footer>
              <Link2 size={13} />
              <span>Your cast, scenes, and shots build on this brief.</span>
            </footer>
            {error && (
              <p className="studio-save-error" role="alert">
                {error}
              </p>
            )}
          </article>
        </div>
        <footer className="studio-brief-actions">
          <span role="status">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
          </span>
          <button
            className="studio-brief-save"
            disabled={!dirty || saving}
            onClick={() => void save()}
            title="Save brief · ⌘S"
          >
            <Check size={13} />
            Save brief
          </button>
        </footer>
      </section>
    </div>
  );
}
