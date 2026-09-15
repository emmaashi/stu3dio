import type { AgentAttachment, AgentRunKind } from "@/types/agent";
import type { AssetSelection, StudioGraph } from "./types";

export function resolveAgentRunKind(
  text: string,
  isNewVideo: boolean,
  selectedLabel?: string,
  forcedKind?: AgentRunKind,
): AgentRunKind {
  if (forcedKind) return forcedKind;
  if (text.startsWith("/assemble")) return "assemble-film";
  if (text.startsWith("/plan")) return "plan-scenes";
  return selectedLabel || !isNewVideo ? "enhance" : "create-film";
}

export function buildAgentRunContext({
  graph,
  selectedAssets,
  selectedLabel,
  attachments,
}: {
  graph: StudioGraph;
  selectedAssets: AssetSelection[];
  selectedLabel?: string;
  attachments: AgentAttachment[];
}) {
  return {
    selected_artifact: selectedLabel || null,
    selected_assets: selectedAssets.map((asset) => ({
      id: asset.id,
      key: asset.key,
      kind: asset.kind,
      label: asset.label,
      description: asset.description,
      context: asset.context,
    })),
    project: graph.overview,
    visible_characters: graph.characters.map((character) => ({
      id: character.id,
      name: character.name,
    })),
    visible_objects: graph.objects.map((object) => ({
      id: object.id,
      name: object.name,
    })),
    visible_scenes: graph.scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
    })),
    attachments,
  };
}
