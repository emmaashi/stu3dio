// Adapts the Tears of Steel demo fixture into the shape the mock backend's
// new-film flow consumes, so creating a film plays the full staged pipeline
// (concept -> cast -> scenes -> shots -> final film) against a film that is
// already complete and whose media is all real.
//
// Everything here is derived from the exported fixture data rather than
// re-listing URLs, so the demo project and the new-film flow cannot drift.

import {
  DEMO_CHARACTERS,
  DEMO_FINAL_FILM_SRC,
  DEMO_FRAMES,
  DEMO_POSTER,
  DEMO_PROJECT,
  DEMO_SCENES,
} from "./index";

// The pipeline generates three scenes with a [3, 2, 3] shot structure, so each
// scene needs three distinct stills to draw from.
const SHOTS_PER_SCENE = 3;

export const NEW_FILM_PROMPT =
  "A man is rebuilt from a memory to face the robots his rejection created";

export const NEW_FILM_TITLE = DEMO_PROJECT.title;

export const NEW_FILM_POSTER = DEMO_POSTER;
export const NEW_FILM_FINAL_VIDEO = DEMO_FINAL_FILM_SRC;
// Shot previews play the same source; the mock has no per-shot renders.
export const NEW_FILM_CLIP_VIDEO = DEMO_FINAL_FILM_SRC;

// The leads, the plan, and the threat - enough to read as a cast without
// crowding the canvas with all nine fixture characters.
const CAST_IDS = [
  "tos-char-thom",
  "tos-char-celia",
  "tos-char-engineer",
  "tos-char-soldier",
  "tos-char-sentinel",
];

// A three-act read of the fixture: the moment that breaks, the plan to undo
// it, and the confrontation it leads to.
const SCENE_IDS = ["tos-scene-1", "tos-scene-5", "tos-scene-10"];

export type NewFilmCharacter = {
  name: string;
  role: string;
  age: number;
  description: string;
  personality: string;
  backstory: string;
  media: string;
};

export const NEW_FILM_CHARACTERS: NewFilmCharacter[] = CAST_IDS.map((id) => {
  const source = DEMO_CHARACTERS.find((c) => c.id === id);
  if (!source?.media_url) throw new Error(`Demo character ${id} has no portrait`);
  return {
    name: source.metadata.name,
    role: source.metadata.role,
    age: source.metadata.age,
    description: source.metadata.description,
    personality: source.metadata.personality,
    backstory: source.metadata.backstory,
    media: source.media_url,
  };
});

// Every still in the film, ordered, used to top up scenes that have fewer
// frames in the fixture than the pipeline asks for.
const ALL_STILLS: string[] = DEMO_FRAMES.map((frame) => frame.media_url).filter(
  (url): url is string => !!url
);

export type NewFilmScene = {
  title: string;
  concise_plot: string;
  detailed_plot: string;
  dialogue: string;
  media: string;
  shots: string[];
};

export const NEW_FILM_SCENES: NewFilmScene[] = SCENE_IDS.map((id) => {
  const source = DEMO_SCENES.find((s) => s.id === id);
  if (!source?.media_url) throw new Error(`Demo scene ${id} has no still`);

  // Prefer this scene's own frames, then top up from the wider pool, so a
  // scene never shows the same still twice.
  const own = DEMO_FRAMES.filter((f) => f.scene_id === id).map((f) => f.media_url);
  const shots = [...own];
  for (const still of ALL_STILLS) {
    if (shots.length >= SHOTS_PER_SCENE) break;
    if (!shots.includes(still) && still !== source.media_url) shots.push(still);
  }

  return {
    title: source.metadata.concise_plot,
    concise_plot: source.metadata.concise_plot,
    detailed_plot: source.metadata.detailed_plot,
    dialogue: source.metadata.dialogue,
    media: source.media_url,
    shots: shots.slice(0, SHOTS_PER_SCENE),
  };
});

export const NEW_FILM_PLOT_POINTS = NEW_FILM_SCENES.map(
  (scene) => scene.detailed_plot
);

export const NEW_FILM_SCENES_OVERVIEW =
  "Three acts across eight shots: the moment on the bridge, the resistance's impossible plan, and the confrontation among the fallen machines.";

export const NEW_FILM_DIRECTOR_REPLY =
  "Love it, a machine-age tragedy built on one human flinch. I've shaped it into Tears of Steel: three acts running from the bridge in Amsterdam to a last confrontation among the wreckage, with a cast of leads, engineers, and the machines themselves. The plot and cast are sketched below. Hit “Generate the cast” when you're ready and we'll build it stage by stage.";

// Shared pool for any shot the scene-level lists don't cover.
export const NEW_FILM_SHOT_STILLS: string[] = ALL_STILLS;

export function newFilmCharacterByName(
  name?: string
): NewFilmCharacter | undefined {
  if (!name) return undefined;
  const q = name.trim().toLowerCase();
  return (
    NEW_FILM_CHARACTERS.find((c) => c.name.toLowerCase() === q) ||
    NEW_FILM_CHARACTERS.find(
      (c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
    )
  );
}
