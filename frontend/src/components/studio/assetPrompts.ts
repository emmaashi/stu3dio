import type { FineTuneValues } from "@/components/beautiful-ui";
import type { AssetSelection } from "./types";

/** The composer is the one place to type; its hint names what is selected. */
export function assetComposerPlaceholder(
  assets: AssetSelection[],
  fallback: string,
): string {
  if (!assets.length) return fallback;
  if (assets.length > 1)
    return `Describe one change for these ${assets.length} assets…`;
  const [asset] = assets;
  switch (asset.kind) {
    case "character":
      return `Describe what to change about ${asset.label}…`;
    case "scene":
      return `Describe what to change in ${asset.label}…`;
    case "clip":
      return "Ask for changes to this shot…";
    case "film":
      return "Ask about the finished cut…";
    default:
      return fallback;
  }
}

export function fineTunePrompt(label: string, values: FineTuneValues): string {
  return `Adjust ${label}: ${values.framing}, ${values.camera}, style intensity ${values.style}, prompt emphasis ${values.emphasis}.`;
}
