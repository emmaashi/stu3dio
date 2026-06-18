"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStudioStore } from "@/store/useStudioStore";
import { Icon } from "./Icon";
import AnnotateModal from "./AnnotateModal";
import { bust, type StudioActions } from "./useStudioPipeline";
import { resolveSelected, type StudioGraph, type Clip } from "./types";
import type { DirectorMessage } from "@/data/directorData";
import { cn } from "@/lib/utils";

const DOCK_ICON =
  "w-[30px] h-[30px] grid place-items-center rounded-[10px] text-ink-3 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";

type Props = {
  graph: StudioGraph;
  version: number;
  busy: Record<string, boolean>;
  directorLog: DirectorMessage[];
  actions: StudioActions;
};

export default function PromptDock({
  graph,
  version,
  busy,
  directorLog,
  actions,
}: Props) {
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const frameMode = useStudioStore((s) => s.frameMode);
  const setFrameMode = useStudioStore((s) => s.setFrameMode);
  const detail = resolveSelected(graph, selectedKey);
  const [text, setText] = useState("");
  const [annotate, setAnnotate] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // mode: director (concept / nothing selected) vs asset edit
  const isDirector = !detail || detail.kind === "overview";
  const isClip = detail?.kind === "clip";
  const editableMedia =
    detail?.kind === "character"
      ? detail.character.media
      : detail?.kind === "scene"
      ? detail.scene.media
      : detail?.kind === "clip"
      ? detail.clip.image_url
      : undefined;

  const directorBusy = !!busy["director"];
  const nodeBusy = !!busy[selectedKey || ""];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [directorLog, logOpen]);

  async function submit() {
    const value = text.trim();
    if (isDirector) {
      if (!value || directorBusy) return;
      setText("");
      await actions.sendDirector(value);
      return;
    }
    if (isClip && frameMode === "video") {
      if (nodeBusy) return;
      await actions.generateFrameVideo((detail as any).clip as Clip);
      return;
    }
    // image edit on the selected asset (text-only edit)
    if (!detail || !selectedKey) return;
    if (!value || nodeBusy) return;
    setText("");
    await actions.editAsset(
      { key: selectedKey, refId: (detail as any).refId, media: editableMedia },
      value
    );
  }

  const placeholder = isDirector
    ? "Describe your film idea: story, tone, characters…"
    : isClip && frameMode === "video"
    ? "Generate the 8s video clip from this frame"
    : "Describe an edit, e.g. make it nighttime or add rain…"

  const sendDisabled =
    (isDirector && (directorBusy || !text.trim())) ||
    (!isDirector && !isClip && (nodeBusy || !text.trim())) ||
    (isClip && frameMode === "image" && (nodeBusy || !text.trim())) ||
    (isClip && frameMode === "video" && nodeBusy);

  return (
    <>
      <motion.div
        className="absolute left-1/2 bottom-5 -translate-x-1/2 z-[9] w-[min(560px,78%)] flex flex-col gap-2 items-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {/* Director transcript (concept mode), collapsible */}
        <AnimatePresence initial={false}>
          {isDirector && directorLog.length > 0 && (
            <motion.div
              className="w-full overflow-hidden rounded-[14px] bg-glass border border-hair backdrop-blur-md"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <button
                className="w-full flex items-center justify-between px-[13px] py-2 text-[11px] uppercase tracking-[.08em] text-ink-3 transition-colors hover:text-ink-2"
                onClick={() => setLogOpen((o) => !o)}
                title={logOpen ? "Hide conversation" : "Show conversation"}
              >
                <span>Conversation</span>
                <Icon name={logOpen ? "caretDown" : "caretLeft"} size={13} />
              </button>
              <AnimatePresence initial={false}>
                {logOpen && (
                  <motion.div
                    key="log-body"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                  >
                    <div
                      className="scroll max-h-[150px] overflow-y-auto flex flex-col gap-2 px-[13px] pb-[11px]"
                      ref={logRef}
                    >
                      {directorLog.slice(-6).map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col gap-0.5 text-[13px] leading-snug"
                        >
                          <span className="slate text-[11px] uppercase tracking-[.08em]">
                            {m.type === "user" ? "You" : "Director"}
                          </span>
                          <span className={m.type === "user" ? "text-ink" : "text-ink-2"}>
                            {m.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Krea-style prompt dock */}
        <div className="flex items-center gap-[5px] w-full pl-2.5 pr-[5px] py-[5px] rounded-[14px] bg-glass-2 border border-hair shadow-[0_16px_40px_rgba(0,0,0,.42)] backdrop-blur-md">
          {/* Image / Video toggle (frames only) */}
          {isClip && (
            <div className="flex gap-0.5 p-0.5 rounded-btn bg-surface-2 border border-hair shrink-0">
              <button
                className={cn(
                  "flex items-center gap-[5px] px-[9px] py-1 rounded-[6px] text-xs",
                  frameMode === "image" ? "text-ink bg-glass-2" : "text-ink-3"
                )}
                onClick={() => setFrameMode("image")}
              >
                <Icon name="image" size={14} />
                <span>Image</span>
              </button>
              <button
                className={cn(
                  "flex items-center gap-[5px] px-[9px] py-1 rounded-[6px] text-xs",
                  frameMode === "video" ? "text-ink bg-glass-2" : "text-ink-3"
                )}
                onClick={() => setFrameMode("video")}
              >
                <Icon name="video" size={14} />
                <span>Video</span>
              </button>
            </div>
          )}

          {editableMedia ? (
            <button
              className={DOCK_ICON}
              onClick={() => setAnnotate(true)}
              disabled={nodeBusy}
              title="Annotate &amp; edit"
            >
              <Icon name="wand" size={17} />
            </button>
          ) : (
            <button className={DOCK_ICON} disabled title="Attach (coming soon)">
              <Icon name="attach" size={17} />
            </button>
          )}

          <input
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-ink text-[13.5px] px-1 py-1.5 placeholder:text-ink-3 disabled:text-ink-3"
            value={text}
            placeholder={placeholder}
            disabled={isClip && frameMode === "video"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />

          <button
            className="w-[30px] h-[30px] grid place-items-center rounded-btn bg-accent text-accent-ink shrink-0 transition-[filter] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={submit}
            disabled={sendDisabled}
            title="Send"
          >
            <Icon name={isClip && frameMode === "video" ? "video" : "send"} size={16} />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {annotate && editableMedia && (
          <AnnotateModal
            src={bust(editableMedia, version) || editableMedia}
            busy={nodeBusy}
            onApply={async (p, composite) => {
              if (!selectedKey) return;
              await actions.editAsset(
                { key: selectedKey, refId: (detail as any).refId, media: editableMedia },
                p,
                composite
              );
              setAnnotate(false);
            }}
            onClose={() => setAnnotate(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
