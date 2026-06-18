// ============================================================================
// Hardcoded demo film #2 — "Echo Hunter"
// An AI-generated noir short film (by Kavan the Kid). The canvas shows a full
// pipeline (overview -> 2 characters -> scenes -> shots -> final film) with NO
// backend.
//
// Stills are REAL frames captured from the film, cropped to strip the letterbox
// black bars + burned-in captions, and served locally from /public/echo-hunter.
// Playback uses the YouTube embed (the film streams from YouTube), so no large
// video file is bundled. Shot video_urls carry a ?start= so a shot opens near
// its moment. These shapes mirror getCompleteProjectStatus().
// ============================================================================

import type { Project } from "../types/backend";
import type { BackendCharacter, BackendScene } from "./characterData";

export const ECHO_PROJECT_ID = "demo-echo-hunter-001";
export const ECHO_VIDEO_ID = "B-lfTmZp1DE";
export const ECHO_EMBED = `https://www.youtube.com/embed/${ECHO_VIDEO_ID}`;
// The official film disables YouTube embedding, so playback uses locally
// cropped video: a short clip per shot + the full film for the final node.
// ECHO_EMBED is kept only as a "watch on YouTube" reference.
export const ECHO_FINAL_FILM_SRC = "/echo-hunter/echo-hunter.mp4";
export const ECHO_POSTER = "/echo-hunter/poster.jpg";

const IMG = (f: string) => `/echo-hunter/${f}`;
// Each shot is a short clip cut from the film, named to match its still.
const SHOT_VIDEO = (still: string) =>
  `/echo-hunter/clips/${still.replace(".jpg", ".mp4")}`;
const ISO = "2026-06-01T00:00:00.000Z";

export const ECHO_PROJECT: Project = {
  id: ECHO_PROJECT_ID,
  title: "Echo Hunter",
  summary:
    "In a rain-drowned megacity, a masked tracker hunts the Echoes \u2014 synthetic doubles of the dead \u2014 and is drawn toward the one quarry he was never meant to find.",
  plot:
    "ECHO HUNTER \u2014 an AI-generated noir short film.\n\n" +
    "Out past the dust where the old city ends, the Hunter drives a black, knife-edged car toward the neon sprawl, a single white pod riding behind him like a coffin. The pod holds an Echo: a synthetic double grown from a dead person's memories, and the Hunter is paid to bring them back \u2014 or put them down.\n\n" +
    "Beneath the streets, in a vault called Echo Haven, rows of Echoes wait in glass. A grey contact trades the Hunter a glowing key and a name. But this Echo is different: she remembers being loved. Through flooded corridors and a final standoff at gunpoint, the Hunter has to decide whether an Echo of a person is still just an echo \u2014 or someone worth saving.",
  created_at: ISO,
  updated_at: ISO,
};

const ch = (
  id: string,
  name: string,
  role: string,
  age: number,
  media: string,
  description: string,
  personality: string,
  backstory: string
): BackendCharacter => ({
  id,
  project_id: ECHO_PROJECT_ID,
  media_url: media,
  metadata: { name, role, age, description, personality, backstory },
  created_at: ISO,
  updated_at: ISO,
});

const HUNTER = "echo-char-hunter";
const ECHO = "echo-char-echo";

export const ECHO_CHARACTERS: BackendCharacter[] = [
  ch(
    HUNTER,
    "The Hunter",
    "Protagonist \u2014 masked tracker",
    38,
    IMG("char-hunter.jpg"),
    "A faceless operative behind a smooth white mask and a grey coat, a silver pistol always level and steady. He drives a black, angular machine through the rain and never raises his voice.",
    "Cold, exact, and quietly unravelling; a professional who has started to flinch at his own work.",
    "Contracted to retrieve or retire Echoes across the megacity. He has done it a hundred times without a second thought \u2014 until this one.",
  ),
  ch(
    ECHO,
    "The Echo",
    "The hunted \u2014 a synthetic double",
    3,
    IMG("char-echo.jpg"),
    "A figure sealed behind a seamless black mirror-mask, moving through sunlit ruins and flooded vaults. Grown, not born; a perfect copy carrying a dead stranger's memories.",
    "Serene, searching, achingly human under the lacquer; certain it is more than a copy.",
    "Pulled from the glass of Echo Haven, it remembers a life it never lived \u2014 and a person who once loved the original.",
  ),
];

type DemoScene = BackendScene & { castIds: string[] };

const sc = (
  id: string,
  order: number,
  media: string,
  castIds: string[],
  concise: string,
  detailed: string,
  dialogue: string
): DemoScene => ({
  id,
  project_id: ECHO_PROJECT_ID,
  media_url: media,
  metadata: {
    scene_order: order,
    concise_plot: concise,
    detailed_plot: detailed,
    dialogue,
  },
  castIds,
  created_at: ISO,
  updated_at: ISO,
});

export const ECHO_SCENES: DemoScene[] = [
  sc(
    "echo-scene-1",
    1,
    IMG("scene-1.jpg"),
    [HUNTER],
    "The Long Road",
    "The Hunter drives his black, knife-edged car across the dead flats toward the hazy towers of the city, a job and a passenger waiting at the end of the road.",
    "RADIO (V.O.): \"One Echo, intact. Bring it in breathing, or don't bring it in at all.\"",
  ),
  sc(
    "echo-scene-2",
    2,
    IMG("scene-2.jpg"),
    [HUNTER, ECHO],
    "The Cargo",
    "In a rubble lot he unseals the white pod beside the car; in a sun-shafted ruined church the masked Echo stands waiting, calm as glass.",
    "THE HUNTER: \"You're not a person. You just have someone's memories.\"\nTHE ECHO: \"Then why do they hurt?\"",
  ),
  sc(
    "echo-scene-3",
    3,
    IMG("scene-3.jpg"),
    [ECHO],
    "Echo Haven",
    "Under the rain-soaked sign of Echo Haven, rows of Echoes sleep in lit glass \u2014 a vault of the city's doubled dead, waiting to be claimed.",
    "ATTENDANT (V.O.): \"Every face in here belonged to someone. None of them do anymore.\"",
  ),
  sc(
    "echo-scene-4",
    4,
    IMG("scene-4.jpg"),
    [HUNTER],
    "The Contact",
    "In the neon glow of the Echo Return strip, a grey-haired contact passes the Hunter a glowing key and a warning he should have heeded.",
    "THE CONTACT: \"This one's flagged. Whatever it tells you on the way \u2014 don't listen.\"",
  ),
  sc(
    "echo-scene-5",
    5,
    IMG("scene-5.jpg"),
    [HUNTER, ECHO],
    "The Handoff",
    "Down humming corridors the Hunter walks among other masks, the glowing device in hand, the Echo always a few steps behind him.",
    "THE ECHO: \"You keep your face hidden too. Maybe you're more like me than you'll say.\"",
  ),
  sc(
    "echo-scene-6",
    6,
    IMG("scene-6.jpg"),
    [HUNTER, ECHO],
    "The Hunt",
    "A bridge at speed, a flooded room, a pistol raised \u2014 and a face the Hunter recognizes. The last hunt forces the question of what an Echo is really worth.",
    "THE HUNTER: \"...I know you.\"\nTHE ECHO: \"You knew her. I'm what's left.\"",
  ),
];

// Shots per scene: real frame stills + the film at a YouTube start time.
type DemoFrame = {
  id: string;
  scene_id: string;
  video_url: string;
  media_url: string;
  status: string;
  metadata: {
    frame_order: number;
    scene_order: number;
    concise_plot: string;
    summary: string;
    duration: number;
    dialogue: string;
  };
};

const SHOTS: Array<{ scene: number; still: string; t: number; caption: string }> = [
  { scene: 1, still: "shot-1-1.jpg", t: 22, caption: "The black car crosses the dead flats" },
  { scene: 1, still: "shot-1-2.jpg", t: 48, caption: "The city haze on the horizon" },
  { scene: 2, still: "shot-2-1.jpg", t: 95, caption: "The car and the white pod in the lot" },
  { scene: 2, still: "shot-2-2.jpg", t: 130, caption: "The Echo waits in the ruined church" },
  { scene: 2, still: "shot-2-3.jpg", t: 150, caption: "The pod, sealed and waiting" },
  { scene: 3, still: "shot-3-1.jpg", t: 205, caption: "Into the vault of Echo Haven" },
  { scene: 3, still: "shot-3-2.jpg", t: 228, caption: "Doubles asleep in lit glass" },
  { scene: 4, still: "shot-4-1.jpg", t: 245, caption: "The Echo Return strip in the rain" },
  { scene: 4, still: "shot-4-2.jpg", t: 278, caption: "A key changes hands" },
  { scene: 5, still: "shot-5-1.jpg", t: 322, caption: "The contact's warning" },
  { scene: 5, still: "shot-5-2.jpg", t: 372, caption: "The glowing key" },
  { scene: 5, still: "shot-5-3.jpg", t: 420, caption: "Among the masks in the corridor" },
  { scene: 6, still: "shot-6-1.jpg", t: 575, caption: "Two figures carry the pod" },
  { scene: 6, still: "shot-6-2.jpg", t: 718, caption: "The pistol, level and steady" },
  { scene: 6, still: "shot-6-3.jpg", t: 760, caption: "A face the Hunter knows" },
];

export const ECHO_FRAMES: DemoFrame[] = (() => {
  const perScene: Record<number, number> = {};
  return SHOTS.map((shot) => {
    const order = perScene[shot.scene] ?? 0;
    perScene[shot.scene] = order + 1;
    return {
      id: `echo-frame-${shot.scene}-${order + 1}`,
      scene_id: `echo-scene-${shot.scene}`,
      video_url: SHOT_VIDEO(shot.still),
      media_url: IMG(shot.still),
      status: "completed",
      metadata: {
        frame_order: order,
        scene_order: shot.scene,
        concise_plot: shot.caption,
        summary: shot.caption,
        duration: 8,
        dialogue: "",
      },
    };
  });
})();

export const ECHO_COMPLETE_STATUS = {
  scenes: ECHO_SCENES as any[],
  characters: ECHO_CHARACTERS as any[],
  objects: [] as any[],
  frames: ECHO_FRAMES as any[],
  completion_status: "complete",
};
