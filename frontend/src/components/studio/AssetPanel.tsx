"use client";

import { FileText, X } from "lucide-react";
import type { FineTuneValues } from "@/components/beautiful-ui";
import { useStudioStore } from "@/store/useStudioStore";
import { bust } from "./useStudioPipeline";
import AssetDetail from "./AssetDetail";
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
  disabled?: boolean;
  onAnnotate?: (asset: AssetSelection) => void;
  onFineTune?: (asset: AssetSelection, values: FineTuneValues) => void;
};

/** Routes the current selection to the right reference view. */
export default function AssetPanel({
  graph,
  version,
  busy,
  disabled,
  onAnnotate,
  onFineTune,
}: Props) {
  const keys = useStudioStore((s) => s.selectedKeys);
  const selectedKey = useStudioStore((s) => s.selectedKey);
  const select = useStudioStore((s) => s.select);
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
          Working from your overview<small>{graph.overview?.title}</small>
        </span>
      </div>
    );
  return (
    <AssetDetail
      graph={graph}
      detail={detail}
      asset={asset}
      version={version}
      busy={!!busy[asset.key]}
      disabled={disabled}
      onAnnotate={onAnnotate}
      onFineTune={onFineTune}
    />
  );
}
