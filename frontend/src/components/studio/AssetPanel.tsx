"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Icon } from "./Icon";
import { Button, ButtonLink } from "./Button";
import { bust } from "./useStudioPipeline";
import { resolveSelected, type StudioGraph, type Overview } from "./types";
import { cn } from "@/lib/utils";

type OverviewValues = { title: string; summary: string; plot: string };

type Props = {
  graph: StudioGraph;
  version: number;
  busy: Record<string, boolean>;
  onRegenerate: () => void;
  onSaveOverview: (v: OverviewValues) => Promise<void> | void;
  onCollapse: () => void;
};

const REGEN_BTN =
  "inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-btn text-[13px] font-semibold text-ink bg-glass-2 border border-hair cursor-pointer transition-colors hover:bg-glass hover:border-white/20 disabled:opacity-60 disabled:cursor-default";

// Primary "Save" button sized identically to REGEN_BTN (full width, same
// height/padding) so the overview action matches the Regenerate action.
const SAVE_BTN =
  "inline-flex items-center justify-center gap-2 w-full px-3.5 py-1.5 rounded-btn text-[13px] font-semibold text-accent-ink border border-transparent cursor-pointer bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_92%,#fff_8%),var(--accent))] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-default";

// Compact override of the shared .field style for the dense overview editor.
const OV_FIELD = "field !text-[13px] !leading-snug !px-3 !py-2 !rounded-[10px]";

function PanelHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex gap-[14px] px-4 pt-[14px] pb-2.5">
      <span className="text-[13px] font-semibold text-ink cursor-default">Asset</span>
      <button
        className="ml-auto grid place-items-center w-[26px] h-[26px] rounded-btn text-ink-3 transition-colors hover:text-ink hover:bg-glass"
        onClick={onCollapse}
        title="Hide panel"
        aria-label="Hide panel"
      >
        <Icon name="caretRight" size={14} />
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="slate shrink-0 w-24">{label}</span>
      <span className="flex-1 text-ink leading-snug">{value}</span>
    </div>
  );
}

export default function AssetPanel({
  graph,
  version,
  busy,
  onRegenerate,
  onSaveOverview,
  onCollapse,
}: Props) {
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const detail = resolveSelected(graph, selectedKey);

  if (!detail) {
    return (
      <aside className="scroll flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-y-auto border-l border-hair pb-6">
        <PanelHeader onCollapse={onCollapse} />
        <div className="px-4 py-6 text-[13px] leading-normal text-ink-2">
          Select a node on the canvas to see its details.
        </div>
      </aside>
    );
  }

  // The concept node is the editable starting point of the film — write the
  // overview here before generating any characters.
  if (detail.kind === "overview") {
    return (
      <OverviewEditor
        overview={detail.overview}
        onSave={onSaveOverview}
        onCollapse={onCollapse}
      />
    );
  }

  // Resolve the visual + textual content for the selected node.
  let title = "";
  let typeLabel = "";
  let media: string | undefined;
  let video: string | undefined;
  let prompt: string | undefined;
  const fields: { label: string; value?: string }[] = [];

  if (detail.kind === "character") {
    const c = detail.character;
    title = c.name;
    typeLabel = "Character";
    media = c.media;
    prompt = c.meta?.description;
    fields.push(
      { label: "Role", value: c.role || c.meta?.role },
      { label: "Age", value: c.meta?.age ? String(c.meta.age) : undefined },
      { label: "Personality", value: c.meta?.personality },
      { label: "Backstory", value: c.meta?.backstory }
    );
  } else if (detail.kind === "scene") {
    const s = detail.scene;
    title = `Scene ${s.order}`;
    typeLabel = "Scene";
    media = s.media;
    prompt = s.meta?.detailed_plot || s.plot;
    fields.push(
      { label: "Summary", value: s.meta?.concise_plot || s.plot },
      { label: "Dialogue", value: s.meta?.dialogue }
    );
  } else if (detail.kind === "clip") {
    const c = detail.clip;
    title = c.label || "Shot";
    typeLabel = "Frame";
    media = c.image_url;
    video = c.video_url;
    prompt = c.meta?.veo3_prompt || c.label;
    fields.push(
      { label: "Status", value: c.status },
      { label: "Dialogue", value: c.meta?.dialogue },
      { label: "Summary", value: c.meta?.summary }
    );
  } else if (detail.kind === "film") {
    title = "Final film";
    typeLabel = "Film";
    video = detail.overview?.finalVideoUrl;
  }

  const previewSrc = bust(media, version);
  const isBusy = !!busy[selectedKey || ""];

  return (
    <aside className="scroll flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-y-auto border-l border-hair pb-6">
      <PanelHeader onCollapse={onCollapse} />

      <div
        className={cn(
          "relative shrink-0 mx-4 mt-1 mb-3.5 rounded-[14px] overflow-hidden bg-surface-2 border border-hair grid place-items-center",
          detail.kind === "character" ? "aspect-square" : "aspect-[16/9]"
        )}
      >
        {video ? (
          <video src={video} controls playsInline className="w-full h-full object-cover" />
        ) : previewSrc ? (
          <img
            src={previewSrc}
            alt={title}
            draggable={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-ink-4">
            <Icon name="image" size={26} />
          </div>
        )}
        {isBusy && (
          <div className="slate absolute inset-x-0 bottom-0 p-1.5 text-center text-xs bg-black/50">
            Working…
          </div>
        )}
      </div>

      <div className="px-4 font-bold text-base tracking-[-.01em]">{title}</div>

      {prompt && (
        <div className="px-4 pt-3 pb-1">
          <span className="slate">Prompt</span>
          <p className="mt-[5px] text-[13px] leading-normal text-ink-2 line-clamp-6">
            {prompt}
          </p>
        </div>
      )}

      <div className="px-4 pt-2 pb-1 flex flex-col gap-[9px]">
        <Field label="Type" value={typeLabel} />
        {(detail.kind === "character" ||
          detail.kind === "scene" ||
          detail.kind === "clip") && (
          <>
            <Field label="Format" value="1:1" />
            <Field label="Dimensions" value="1024 × 1024" />
            <Field label="Style" value="Cinematic" />
          </>
        )}
        {fields.map((f) => (
          <Field key={f.label} label={f.label} value={f.value} />
        ))}
      </div>

      {/* Regenerate / Export are functional against the offline mock. */}
      {(detail.kind === "character" ||
        detail.kind === "scene" ||
        detail.kind === "clip") && (
        <div className="px-4 pt-3.5 pb-1">
          <button
            className={cn(REGEN_BTN, "w-full")}
            onClick={onRegenerate}
            disabled={isBusy}
          >
            <Icon name="refresh" size={15} />
            <span>{isBusy ? "Working…" : "Regenerate"}</span>
          </button>
        </div>
      )}

      {detail.kind === "film" && video && (
        <div className="flex gap-2 px-4 pt-3.5 pb-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPlayer(video!, "Final film")}
          >
            <Icon name="play" size={15} />
            <span>Play film</span>
          </Button>
          <ButtonLink
            variant="ghost"
            size="sm"
            href={video}
            target="_blank"
            rel="noreferrer"
            download
          >
            <Icon name="download" size={15} />
            <span>Export</span>
          </ButtonLink>
        </div>
      )}
    </aside>
  );
}

function OverviewEditor({
  overview,
  onSave,
  onCollapse,
}: {
  overview: Overview;
  onSave: (v: OverviewValues) => Promise<void> | void;
  onCollapse: () => void;
}) {
  const [title, setTitle] = useState(overview.title || "");
  const [summary, setSummary] = useState(overview.summary || "");
  const [plot, setPlot] = useState(overview.plot || "");
  const [saving, setSaving] = useState(false);

  // Re-seed when the underlying overview changes (e.g. after a refresh or when
  // switching projects) so external updates aren't masked by stale local state.
  useEffect(() => {
    setTitle(overview.title || "");
    setSummary(overview.summary || "");
    setPlot(overview.plot || "");
  }, [overview.title, overview.summary, overview.plot]);

  const dirty =
    title.trim() !== (overview.title || "").trim() ||
    summary !== (overview.summary || "") ||
    plot !== (overview.plot || "");

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), summary, plot });
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-hidden border-l border-hair">
      <PanelHeader onCollapse={onCollapse} />

      <div className="flex-1 min-h-0 px-4 pt-1 pb-4 flex flex-col gap-2.5">
        <p className="shrink-0 text-[12px] leading-snug text-ink-3">
          Describe the film you want to make — this concept guides the cast and
          scenes generated next.
        </p>

        <div className="shrink-0 flex flex-col gap-1">
          <label className="slate">Title</label>
          <input
            className={OV_FIELD}
            value={title}
            placeholder="Untitled film"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="shrink-0 flex flex-col gap-1">
          <label className="slate">Concept</label>
          <textarea
            className={cn(OV_FIELD, "min-h-[72px]")}
            value={summary}
            placeholder="Genre, tone, premise…"
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        {/* Plot grows to fill the remaining vertical space. */}
        <div className="flex-1 min-h-0 flex flex-col gap-1">
          <label className="slate shrink-0">Plot</label>
          <textarea
            className={cn(OV_FIELD, "flex-1 min-h-[120px]")}
            value={plot}
            placeholder="Outline the story — characters, beats, the arc…"
            onChange={(e) => setPlot(e.target.value)}
          />
        </div>

        <button
          className={cn(SAVE_BTN, "shrink-0")}
          onClick={save}
          disabled={!dirty || saving}
        >
          <Icon name="check" size={15} />
          <span>{saving ? "Saving…" : "Save overview"}</span>
        </button>
      </div>
    </aside>
  );
}
