"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Icon } from "./Icon";
import { Button, ButtonLink } from "./Button";
import { bust } from "./useStudioPipeline";
import {
  resolveAssetSelection,
  resolveSelected,
  type AssetSelection,
  type StudioGraph,
  type Overview,
} from "./types";
import { cn } from "@/lib/utils";

type OverviewValues = { title: string; summary: string; plot: string };

type Props = {
  graph: StudioGraph;
  version: number;
  busy: Record<string, boolean>;
  onSaveOverview: (v: OverviewValues) => Promise<void> | void;
  onCollapse?: () => void;
};

// Primary overview action.
const SAVE_BTN =
  "inline-flex items-center justify-center gap-2 w-full px-3.5 py-1.5 rounded-btn text-[13px] font-semibold text-accent-ink border border-transparent cursor-pointer bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_92%,#fff_8%),var(--accent))] transition-[filter] hover:brightness-110 disabled:opacity-60 disabled:cursor-default";

// Compact override of the shared .field style for the dense overview editor.
const OV_FIELD = "field !text-[13px] !leading-snug !px-3 !py-2 !rounded-[10px]";

function PanelHeader({ onCollapse }: { onCollapse?: () => void }) {
  if (!onCollapse) return null;
  return (
    <div className="flex justify-end px-3 pt-3 pb-1">
      <button
        className="grid place-items-center w-[26px] h-[26px] rounded-btn text-ink-3 transition-colors hover:text-ink hover:bg-glass"
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
  onSaveOverview,
  onCollapse,
}: Props) {
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const selections = selectedKeys
    .map((key) => resolveAssetSelection(graph, key))
    .filter((selection): selection is AssetSelection => !!selection);
  const detail = resolveSelected(graph, selectedKey);

  if (selections.length > 1) {
    return <MultiAssetPanel selections={selections} version={version} />;
  }

  if (!detail) {
    return (
      <aside className="scroll flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-x-hidden overflow-y-auto border-l border-hair pb-6">
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
        onCollapse={onCollapse || (() => undefined)}
      />
    );
  }

  // Resolve the visual + textual content for the selected node.
  let title = "";
  let typeLabel = "";
  let media: string | undefined;
  let video: string | undefined;
  let prompt: string | undefined;
  let promptLabel = "Description";
  const fields: { label: string; value?: string }[] = [];
  const selection = selectedKey ? resolveAssetSelection(graph, selectedKey) : null;

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
      { label: "Backstory", value: c.meta?.backstory },
      { label: "Used in", value: selection?.usage }
    );
  } else if (detail.kind === "scene") {
    const s = detail.scene;
    title = `Scene ${s.order}`;
    typeLabel = "Scene";
    media = s.media;
    prompt = s.meta?.detailed_plot || s.plot;
    promptLabel = "Story direction";
    fields.push(
      { label: "Summary", value: s.meta?.concise_plot || s.plot },
      { label: "Dialogue", value: s.meta?.dialogue },
      { label: "Used for", value: selection?.usage }
    );
  } else if (detail.kind === "clip") {
    const c = detail.clip;
    title = c.label || "Shot";
    typeLabel = "Frame";
    media = c.image_url;
    video = c.video_url;
    prompt = c.meta?.veo3_prompt || c.label;
    promptLabel = "Generation prompt";
    fields.push(
      { label: "Status", value: c.status },
      { label: "Dialogue", value: c.meta?.dialogue },
      { label: "Summary", value: c.meta?.summary },
      { label: "Used for", value: selection?.usage }
    );
  } else if (detail.kind === "film") {
    title = "Final film";
    typeLabel = "Film";
    video = detail.overview?.finalVideoUrl;
    prompt = detail.overview?.summary || detail.overview?.plot;
    promptLabel = "Film summary";
    const clips = graph.scenes.flatMap((scene) => scene.clips);
    fields.push(
      { label: "Scenes", value: String(graph.scenes.length) },
      { label: "Clips", value: String(clips.length) },
      { label: "Runtime", value: clips.length ? `${clips.length * 8} seconds` : undefined }
    );
  }

  const previewSrc = bust(media, version);
  const isBusy = !!busy[selectedKey || ""];

  return (
    <aside className="scroll flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-x-hidden overflow-y-auto border-l border-hair pb-6">
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
          <span className="slate">{promptLabel}</span>
          <p className="mt-[5px] text-[13px] leading-normal text-ink-2 whitespace-pre-wrap">
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

function MultiAssetPanel({
  selections,
  version,
}: {
  selections: AssetSelection[];
  version: number;
}) {
  const select = useStudioStore((state) => state.select);
  const counts = selections.reduce<Record<string, number>>((result, selection) => {
    const label = selection.kind === "clip" ? "shot" : selection.kind;
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});
  const summary = Object.entries(counts)
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <aside className="scroll flex flex-col min-h-0 h-full w-[300px] bg-surface-1 overflow-x-hidden overflow-y-auto border-l border-hair pb-6">
      <div className="px-4 pt-5 pb-3 border-b border-hair-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[16px] font-bold tracking-[-.01em]">{selections.length} assets selected</div>
            <div className="mt-1 text-[11px] text-ink-3">{summary}</div>
          </div>
          <span className="shrink-0 px-2 py-1 rounded-pill text-[10px] font-semibold text-[var(--motion-accent-bright)] bg-[var(--motion-accent-tint)]">
            Shared edit
          </span>
        </div>
        <p className="mt-3 text-[12px] leading-normal text-ink-2">
          The prompt below will carry every selected asset’s stable ID and current metadata as context.
        </p>
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        {selections.map((selection) => (
          <article key={selection.key} className="grid grid-cols-[48px_minmax(0,1fr)_24px] gap-2.5 items-start p-2 rounded-[10px] border border-hair bg-surface-2">
            <div className="w-12 h-12 overflow-hidden rounded-[8px] grid place-items-center text-ink-3 bg-surface-3">
              {selection.media ? (
                <img src={bust(selection.media, version)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name={selection.kind === "character" ? "user" : selection.kind === "scene" ? "scene" : selection.kind === "film" ? "play" : "clapper"} size={16} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-ink truncate">{selection.label}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[.04em] text-ink-3">{selection.kind === "clip" ? "Shot" : selection.kind}</div>
              <p className="mt-1 text-[11px] leading-snug text-ink-2 line-clamp-3">{selection.description}</p>
            </div>
            <button
              type="button"
              className="w-6 h-6 grid place-items-center rounded-[6px] text-ink-3 hover:text-ink hover:bg-glass"
              onClick={() => select(selection.key, { additive: true })}
              aria-label={`Remove ${selection.label} from selection`}
            >
              <Icon name="x" size={12} />
            </button>
          </article>
        ))}
      </div>

      <div className="mx-4 mt-1 pt-3 border-t border-hair-2">
        <div className="text-[11px] font-semibold text-ink-2">How this edit is scoped</div>
        <p className="mt-1.5 text-[11px] leading-normal text-ink-3">
          Project context stays inherited. Only the selected asset prompts are revised, so unrelated cast members and shots remain unchanged.
        </p>
      </div>
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
          Describe the film you want to make. This concept guides the cast and
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
            placeholder="Outline the story: characters, beats, the arc…"
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
