import type { FineTuneValues } from "@/components/beautiful-ui";
import type { AssetSelection } from "./types";

/** The composer is the one place to type; its hint names what is selected. */
export function assetComposerPlaceholder(
  assets: AssetSelection[],
  fallback: string,
): string {
  if (!assets.length) return fallback;
  if (assets.length > 1) return `One change for these ${assets.length} assets…`;
  const [asset] = assets;
  switch (asset.kind) {
    case "character":
      return `Describe a change to ${shorten(asset.label)}…`;
    case "scene":
      return `Describe a change to ${shorten(asset.label)}…`;
    case "clip":
      return "Ask for changes to this shot…";
    case "film":
      return "Ask about the finished cut…";
    default:
      return fallback;
  }
}

/** Keeps a placeholder on one line in the 320px rail. */
function shorten(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

export function fineTunePrompt(label: string, values: FineTuneValues): string {
  return `Adjust ${label}: ${values.framing}, ${values.camera}, style intensity ${values.style}, prompt emphasis ${values.emphasis}.`;
}
