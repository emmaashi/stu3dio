// Per-browser generation settings: your own model keys and the defaults a new
// film starts from. Keys never leave this browser; they are not synced.

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type GenerationSettings = {
  geminiKey: string;
  falKey: string;
  runtimeSeconds: number;
  aspectRatio: AspectRatio;
};

export const RUNTIME_OPTIONS = [24, 64, 96, 152] as const;
export const ASPECT_OPTIONS: AspectRatio[] = ["16:9", "9:16", "1:1"];
export const DEFAULT_SETTINGS: GenerationSettings = {
  geminiKey: "",
  falKey: "",
  runtimeSeconds: 64,
  aspectRatio: "16:9",
};

const KEY = "stu3dio.settings.v1";
const isBrowser = () => typeof window !== "undefined";

export function getGenerationSettings(): GenerationSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(KEY) || "{}",
    ) as Partial<GenerationSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveGenerationSettings(next: GenerationSettings) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

/** The subset a new agent run is created with. */
export function runSettings(settings = getGenerationSettings()) {
  return {
    runtime_seconds: settings.runtimeSeconds,
    aspect_ratio: settings.aspectRatio,
    shot_seconds: 8 as const,
  };
}
