"use client";

import { useState } from "react";
import { FileText, PencilLine, Play, SlidersHorizontal } from "lucide-react";
import { FineTuneCard, type FineTuneValues } from "@/components/beautiful-ui";
import { useStudioStore } from "@/store/useStudioStore";
import { bust } from "./useStudioPipeline";
import {
  isImageEditable,
  type AssetSelection,
  type SelectedDetail,
  type StudioGraph,
} from "./types";

type Detail = NonNullable<SelectedDetail>;

type Props = {
  graph: StudioGraph;
  detail: Exclude<Detail, { kind: "overview" }>;
  asset: AssetSelection;
  version: number;
  busy: boolean;
  disabled?: boolean;
  onAnnotate?: (asset: AssetSelection) => void;
  onFineTune?: (asset: AssetSelection, values: FineTuneValues) => void;
};

const KIND_LABEL: Record<Detail["kind"], string> = {
  overview: "Overview",
  character: "Character",
  scene: "Scene",
  clip: "Shot",
  film: "Final film",
};

/**
 * One selected card, read top to bottom: what it is, what it looks like, what
 * the story knows about it, and where it sits. Nothing folds away. Editing is
 * drawing on the image or typing in the composer below.
 */
export default function AssetDetail({
  graph,
  detail,
  asset,
  version,
  busy,
  disabled,
  onAnnotate,
  onFineTune,
}: Props) {
  const select = useStudioStore((s) => s.select);
  const focus = useStudioStore((s) => s.focus);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const [cameraOpen, setCameraOpen] = useState(false);

  const scene =
    detail.kind === "scene"
      ? detail.scene
      : detail.kind === "clip"
        ? detail.scene
        : undefined;
  const video =
    detail.kind === "clip"
      ? detail.clip.video_url
      : detail.kind === "film"
        ? detail.overview?.finalVideoUrl
        : undefined;
  const drawable = isImageEditable(asset) && !!onAnnotate;
  const showCamera = detail.kind === "scene" && !!onFineTune;

  const status =
    detail.kind === "clip"
      ? `${scene ? `Scene ${scene.order}` : "Film shot"} · ${detail.clip.status}`
      : asset.usage;

  const summary =
    detail.kind === "clip"
      ? null
      : detail.kind === "scene"
        ? String(asset.context.concise_plot || asset.description)
        : asset.description;

  const fields: Array<[string, unknown]> =
    detail.kind === "character"
      ? [
          ["Role", detail.character.role],
          ["Personality", detail.character.meta?.personality],
          ["Backstory", detail.character.meta?.backstory],
        ]
      : detail.kind === "scene"
        ? [["Dialogue", detail.scene.meta?.dialogue]]
        : detail.kind === "clip"
          ? [
              [
                "Shot direction",
                detail.clip.meta?.veo3_prompt || asset.description,
              ],
              ["Dialogue", detail.clip.meta?.dialogue],
            ]
          : [];

  const cast = scene?.castIds?.length
    ? graph.characters.filter((c) => scene.castIds!.includes(c.id))
    : [];
  const appearsIn =
    detail.kind === "character"
      ? graph.scenes.filter((s) =>
          (asset.context.scene_ids as string[] | undefined)?.includes(s.id),
        )
      : [];

  return (
    <section className="studio-asset" aria-label={`${asset.label} reference`}>
      <header className="studio-asset-header">
        <div>
          <span className="studio-asset-tag">{KIND_LABEL[detail.kind]}</span>
          <h2>{asset.label}</h2>
          <p
            className="studio-asset-status"
            data-status={
              detail.kind === "clip" ? detail.clip.status : undefined
            }
          >
            {status}
          </p>
        </div>
        {showCamera && (
          <button
            type="button"
            className="studio-asset-camera-toggle"
            aria-label="Camera & visual direction"
            aria-pressed={cameraOpen}
            title="Camera & visual direction"
            onClick={() => setCameraOpen((open) => !open)}
          >
            <SlidersHorizontal size={14} />
          </button>
        )}
      </header>

      <div className="studio-asset-hero">
        {asset.media ? (
          <img src={bust(asset.media, version)} alt={asset.label} />
        ) : video ? (
          <video src={video} muted playsInline preload="metadata" />
        ) : (
          <span className="studio-asset-hero-empty">Not rendered yet</span>
        )}
        {video && (
          <button
            type="button"
            className="studio-reference-play"
            aria-label={`Play ${asset.label}`}
            onClick={() => openPlayer(video, asset.label)}
          >
            <Play size={16} />
          </button>
        )}
        {drawable && (
          <button
            type="button"
            className="studio-asset-draw"
            aria-label={`Draw on ${asset.label}`}
            disabled={busy || disabled}
            onClick={() => onAnnotate?.(asset)}
          >
            <PencilLine size={14} />
          </button>
        )}
        {busy && (
          <span className="studio-reference-busy" role="status">
            Updating reference…
          </span>
        )}
      </div>

      {summary && <p className="studio-asset-summary">{summary}</p>}

      {fields
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div className="studio-asset-field" key={label}>
            <span>{label}</span>
            <p>{String(value)}</p>
          </div>
        ))}

      {showCamera && cameraOpen && (
        <div className="studio-asset-camera">
          <FineTuneCard
            disabled={disabled || busy}
            onApply={(values) => onFineTune?.(asset, values)}
          />
        </div>
      )}

      <div className="studio-asset-field">
        <span>Context</span>
        <div className="studio-asset-chips">
          {appearsIn.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => focus(`scene-${s.id}`)}
            >
              {s.media && <img src={s.media} alt="" />}
              Scene {s.order}
            </button>
          ))}
          {detail.kind === "clip" && scene && (
            <button type="button" onClick={() => focus(`scene-${scene.id}`)}>
              {scene.media && <img src={scene.media} alt="" />}
              Scene {scene.order}
            </button>
          )}
          {cast.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => focus(`char-${c.id}`)}
            >
              {c.media && <img src={c.media} alt="" />}
              {c.name}
            </button>
          ))}
          <button
            type="button"
            className="studio-asset-chip--quiet"
            onClick={() => select("overview")}
          >
            <FileText size={12} />
            Overview
          </button>
        </div>
      </div>
    </section>
  );
}
