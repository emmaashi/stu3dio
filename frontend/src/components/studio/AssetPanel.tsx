"use client";

import {
  ArrowRight,
  FileText,
  Link2,
  PencilLine,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { bust } from "./useStudioPipeline";
import {
  resolveAssetSelection,
  resolveSelected,
  type AssetSelection,
  type StudioGraph,
} from "./types";

type Props = {
  graph: StudioGraph;
  version: number;
  busy: Record<string, boolean>;
  onRefine?: (text: string) => void;
  onAnnotate?: (asset: AssetSelection) => void;
};

export default function AssetPanel({
  graph,
  version,
  busy,
  onRefine,
  onAnnotate,
}: Props) {
  const keys = useStudioStore((s) => s.selectedKeys);
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const select = useStudioStore((s) => s.select);
  const focus = useStudioStore((s) => s.focus);
  const openPlayer = useStudioStore((s) => s.openPlayer);
  const assets = keys
    .map((key) => resolveAssetSelection(graph, key))
    .filter((asset): asset is AssetSelection => !!asset);
  const detail = resolveSelected(graph, selectedKey);
  if (!assets.length || !detail) return null;
  if (assets.length > 1)
    return (
      <section className="studio-conversation-reference">
        <div className="studio-reference-heading">
          <span>Shared reference</span>
          <strong>{assets.length} assets selected</strong>
        </div>
        <div className="studio-reference-list">
          {assets.map((asset) => (
            <div key={asset.key}>
              {asset.media && <img src={bust(asset.media, version)} alt="" />}
              <span>{asset.label}</span>
              <button
                aria-label={`Remove ${asset.label} from selection`}
                onClick={() => select(asset.key, { additive: true })}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <p className="studio-reference-description">
          Describe one visual direction to apply to these selected images.
        </p>
      </section>
    );
  const asset = assets[0];
  if (detail.kind === "overview")
    return (
      <div className="studio-brief-reference">
        <FileText size={15} />
        <span>
          Working from your story brief<small>{graph.overview?.title}</small>
        </span>
      </div>
    );
  const video =
    detail.kind === "clip"
      ? detail.clip.video_url
      : detail.kind === "film"
        ? detail.overview?.finalVideoUrl
        : undefined;
  const scene =
    detail.kind === "scene"
      ? detail.scene
      : detail.kind === "clip"
        ? detail.scene
        : undefined;
  const fields =
    detail.kind === "character"
      ? [
          ["Role", detail.character.role],
          ["Personality", detail.character.meta?.personality],
          ["Backstory", detail.character.meta?.backstory],
        ]
      : detail.kind === "clip"
        ? [
            ["Dialogue", detail.clip.meta?.dialogue],
            ["Shot direction", detail.clip.meta?.veo3_prompt],
          ]
        : detail.kind === "scene"
          ? [["Dialogue", detail.scene.meta?.dialogue]]
          : [];
  return (
    <section
      className="studio-conversation-reference"
      aria-label={`${asset.label} reference`}
    >
      <div className="studio-reference-heading">
        <span>{asset.kind === "clip" ? "Shot" : asset.kind} reference</span>
        <strong>{asset.label}</strong>
      </div>
      <div className="studio-reference-preview">
        {asset.media ? (
          <img src={bust(asset.media, version)} alt={asset.label} />
        ) : video ? (
          <video src={video} controls playsInline />
        ) : null}
        {video && (
          <button
            className="studio-reference-play"
            aria-label={`Play ${asset.label}`}
            onClick={() => openPlayer(video, asset.label)}
          >
            <Play size={16} />
          </button>
        )}
        {busy[asset.key] && (
          <span className="studio-reference-busy" role="status">
            Updating reference…
          </span>
        )}
      </div>
      <p className="studio-reference-description">{asset.description}</p>
      {asset.editable && (
        <div className="studio-reference-actions">
          <button
            disabled={!!busy[asset.key]}
            onClick={() => onRefine?.(`Refine ${asset.label}: `)}
          >
            <Sparkles size={13} />
            Refine image
          </button>
          <button
            disabled={!!busy[asset.key]}
            onClick={() => onAnnotate?.(asset)}
          >
            <PencilLine size={13} />
            Draw an edit
          </button>
        </div>
      )}
      <details className="studio-reference-details">
        <summary>Details &amp; story context</summary>
        <p>{asset.description}</p>
        {fields
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div className="studio-reference-field" key={label}>
              <span>{label}</span>
              <p>{value}</p>
            </div>
          ))}
        <div className="studio-context-panel">
          <button onClick={() => select("overview")}>
            <FileText size={14} />
            <span>
              Story brief<small>{graph.overview?.title}</small>
            </span>
            <ArrowRight size={13} />
          </button>
          {detail.kind === "clip" && scene && (
            <button onClick={() => focus(`scene-${scene.id}`)}>
              <Link2 size={14} />
              <span>
                Scene {scene.order}
                <small>{scene.plot}</small>
              </span>
              <ArrowRight size={13} />
            </button>
          )}
          {graph.characters
            .filter((c) => scene?.castIds?.includes(c.id))
            .map((c) => (
              <button key={c.id} onClick={() => focus(`char-${c.id}`)}>
                {c.media && <img src={c.media} alt="" />}
                <span>
                  {c.name}
                  <small>Character reference</small>
                </span>
                <ArrowRight size={13} />
              </button>
            ))}
          <p className="studio-reference-usage">{asset.usage}</p>
        </div>
      </details>
    </section>
  );
}
