// Adapts the Tears of Steel demo fixture into the shape the mock backend's
// new-film flow consumes, so creating a film plays the full staged pipeline
// (concept -> cast -> scenes -> shots -> final film) and lands on the same
// complete film the demo project shows: nine characters, ten scenes, and
// every shot, all with real media.
//
// Everything here is derived from the exported fixture data rather than
// re-listing URLs or counts, so the demo project and the new-film flow cannot
// drift apart.

import {
  DEMO_CHARACTERS,
  DEMO_FINAL_FILM_SRC,
  DEMO_FRAMES,
  DEMO_POSTER,
  DEMO_PROJECT,
  DEMO_SCENES,
} from "./index";

export const NEW_FILM_PROMPT =
  "A man is rebuilt from a memory to face the robots his rejection created";

export const NEW_FILM_TITLE = DEMO_PROJECT.title;

export const NEW_FILM_POSTER = DEMO_POSTER;
export const NEW_FILM_FINAL_VIDEO = DEMO_FINAL_FILM_SRC;
// Shot previews play the same source; the mock has no per-shot renders.
export const NEW_FILM_CLIP_VIDEO = DEMO_FINAL_FILM_SRC;

export type NewFilmCharacter = {
  name: string;
  role: string;
  age: number;
  description: string;
  personality: string;
  backstory: string;
  media: string;
};

// The whole cast, in fixture order.
export const NEW_FILM_CHARACTERS: NewFilmCharacter[] = DEMO_CHARACTERS.map(
  (source) => {
    if (!source.media_url) {
      throw new Error(`Demo character ${source.id} has no portrait`);
    }
    return {
      name: source.metadata.name,
      role: source.metadata.role,
      age: source.metadata.age,
      description: source.metadata.description,
      personality: source.metadata.personality,
      backstory: source.metadata.backstory,
      media: source.media_url,
    };
  }
);

export type NewFilmShot = {
  still: string;
  caption: string;
};

export type NewFilmScene = {
  title: string;
  concise_plot: string;
  detailed_plot: string;
  dialogue: string;
  media: string;
  shots: NewFilmShot[];
};

// Every scene, each carrying its own real shots. Shot counts vary per scene
// exactly as they do in the film (1, 1, 3, 2, 3, 2, 1, 2, 1, 3).
export const NEW_FILM_SCENES: NewFilmScene[] = DEMO_SCENES.map((source) => {
  if (!source.media_url) {
    throw new Error(`Demo scene ${source.id} has no still`);
  }
  const shots: NewFilmShot[] = DEMO_FRAMES.filter(
    (frame) => frame.scene_id === source.id
  )
    .sort((a, b) => a.metadata.frame_order - b.metadata.frame_order)
    .flatMap((frame) =>
      frame.media_url
        ? [{ still: frame.media_url, caption: frame.metadata.concise_plot }]
        : []
    );

  return {
    title: source.metadata.concise_plot,
    concise_plot: source.metadata.concise_plot,
    detailed_plot: source.metadata.detailed_plot,
    dialogue: source.metadata.dialogue,
    media: source.media_url,
    shots,
  };
});

// Shot counts per scene, in scene order — the shape the production plan and
// the scene-generation jobs both need.
export const NEW_FILM_SHOT_COUNTS: number[] = NEW_FILM_SCENES.map(
  (scene) => scene.shots.length
);

export const NEW_FILM_TOTAL_SHOTS = NEW_FILM_SHOT_COUNTS.reduce(
  (total, count) => total + count,
  0
);

export const NEW_FILM_PLOT_POINTS = [
  DEMO_PROJECT.summary,
  ...NEW_FILM_SCENES.map((scene) => scene.detailed_plot),
];

export const NEW_FILM_SCENES_OVERVIEW = `${NEW_FILM_SCENES.length} scenes across ${NEW_FILM_TOTAL_SHOTS} shots: from a spring afternoon on an Amsterdam bridge to a last confrontation among the fallen machines.`;

export const NEW_FILM_DIRECTOR_REPLY =
  "Love it, a machine-age tragedy built on one human flinch. I've shaped it into Tears of Steel: a full arc running from the bridge in Amsterdam, through the rise of the machines and the resistance's impossible plan, to a last confrontation among the wreckage. The plot and cast are sketched below. Hit “Generate the cast” when you're ready and we'll build it stage by stage.";

// Shared pool for any shot a scene-level list doesn't cover.
export const NEW_FILM_SHOT_STILLS: string[] = DEMO_FRAMES.flatMap((frame) =>
  frame.media_url ? [frame.media_url] : []
);

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
