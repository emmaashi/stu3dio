// ============================================================================
// Hardcoded demo film — "Tears of Steel"
// A real, live-action short film (Blender Foundation, 2012, CC-BY 3.0) used so
// the canvas shows a full pipeline (overview -> characters -> scenes -> shots ->
// final film) with NO backend AND with real people in every node.
//
// All media is hotlinked from Wikimedia Commons: the full film (webm), the
// poster, and real frame stills from the film. Each character is an actual
// person in the footage, each scene still and shot still is a real frame from
// that beat, and `castIds` records which characters appear in each scene so the
// canvas can draw cast -> scene edges to every scene a character is in.
// These shapes mirror what getCompleteProjectStatus() returns.
// ============================================================================

import type { Project } from "../types/backend";
import type { BackendCharacter, BackendScene } from "./characterData";

export const DEMO_PROJECT_ID = "demo-emberveil-001";

// Full film (webm) and poster, hotlink-verified on Wikimedia Commons.
const TOS_VIDEO =
  "https://upload.wikimedia.org/wikipedia/commons/c/cb/Tears_of_Steel_1080p.webm";
export const DEMO_FINAL_FILM_SRC = TOS_VIDEO;
export const DEMO_POSTER =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Tos-poster.png/960px-Tos-poster.png";

// Real frame stills from the film (Wikimedia Commons), keyed by what they show.
const WM = "https://upload.wikimedia.org/wikipedia/commons/thumb";
const F = {
  city: `${WM}/9/9b/Tears_of_Steel_frame_00_1c.jpg/960px-Tears_of_Steel_frame_00_1c.jpg`,
  bridge: `${WM}/1/18/Tears_of_Steel_frame_01_2a.jpg/960px-Tears_of_Steel_frame_01_2a.jpg`,
  brainLab: `${WM}/3/3a/Tears_of_Steel_frame_02_4a.jpg/960px-Tears_of_Steel_frame_02_4a.jpg`,
  machineCity: `${WM}/c/cb/Tears_of_Steel_frame_03_1a.jpg/960px-Tears_of_Steel_frame_03_1a.jpg`,
  newspaper: `${WM}/a/a8/Tears_of_Steel_frame_03_2e.jpg/960px-Tears_of_Steel_frame_03_2e.jpg`,
  robotRoof: `${WM}/b/bc/Tears_of_Steel_frame_03_3c.jpg/960px-Tears_of_Steel_frame_03_3c.jpg`,
  hideout: `${WM}/9/9a/Tears_of_Steel_frame_04_2b.jpg/960px-Tears_of_Steel_frame_04_2b.jpg`,
  team: `${WM}/4/44/Tears_of_Steel_frame_04_3e.jpg/960px-Tears_of_Steel_frame_04_3e.jpg`,
  tech: `${WM}/f/fe/Tears_of_Steel_frame_04_5h.jpg/960px-Tears_of_Steel_frame_04_5h.jpg`,
  thomRobot: `${WM}/0/06/Tears_of_Steel_frame_05_6a.jpg/960px-Tears_of_Steel_frame_05_6a.jpg`,
  soldier: `${WM}/7/7b/Tears_of_Steel_frame_07_3f.jpg/960px-Tears_of_Steel_frame_07_3f.jpg`,
  oldCelia: `${WM}/4/4b/Tears_of_Steel_frame_08_4a.jpg/960px-Tears_of_Steel_frame_08_4a.jpg`,
  junkyard: `${WM}/1/12/Tears_of_Steel_frame_09_1a.jpg/960px-Tears_of_Steel_frame_09_1a.jpg`,
};

// Distinct scene thumbnails: a real frame grabbed from the film at a given
// second (Wikimedia on-demand video thumbnail), chosen so a scene node never
// duplicates one of its own shot stills.
const TOS_SEEK = (s: number) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Tears_of_Steel_1080p.webm/960px-seek%3D${s}-Tears_of_Steel_1080p.webm.jpg`;

const ISO = "2026-06-01T00:00:00.000Z";

export const DEMO_PROJECT: Project = {
  id: DEMO_PROJECT_ID,
  title: "Tears of Steel",
  summary:
    "On a bridge in near-future Amsterdam, one moment of fear between Thom and the roboticist Celia spirals \u2014 decades later \u2014 into a war against the machines she built, and a last attempt to set the memory right.",
  plot:
    "TEARS OF STEEL \u2014 a live-action sci-fi short (Blender Foundation, CC-BY).\n\n" +
    "Forty years ago, on a canal bridge in Amsterdam, Thom flinched from Celia's prosthetic hand \u2014 and lost her. Celia became the most gifted roboticist of her generation, but her creations eventually turned on the city, and the machines rose.\n\n" +
    "Now, in the ruins, a small resistance \u2014 a wild-eyed engineer, a frantic technician, and a battle-worn soldier \u2014 rebuild Thom from memory and send him back to that bridge. If the recreation can relive the moment and reach Celia where the real Thom could not, her machines may finally stand down. Among a mountain of fallen steel, the old roboticist watches her greatest regret get one more chance.",
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
  project_id: DEMO_PROJECT_ID,
  media_url: media,
  metadata: { name, role, age, description, personality, backstory },
  created_at: ISO,
  updated_at: ISO,
});

// Character ids reused by scene.castIds below.
const THOM = "tos-char-thom";
const CELIA = "tos-char-celia";
const ENGINEER = "tos-char-engineer";
const SOLDIER = "tos-char-soldier";
const TECH = "tos-char-tech";
const SENTINEL = "tos-char-sentinel";
const CAPTAIN = "tos-char-captain";
const OPERATOR = "tos-char-operator";
const EFFIGY = "tos-char-effigy";

export const DEMO_CHARACTERS: BackendCharacter[] = [
  ch(
    THOM,
    "Thom",
    "Lead \u2014 the man who flinched",
    32,
    F.thomRobot,
    "Dark-haired and easy-going in a worn leather jacket; the kind of man whose worst mistake was a single instinctive recoil. Decades later he exists only as a rebuilt memory.",
    "Warm, self-deprecating, haunted by one moment he can never take back.",
    "On a spring afternoon he pulled away from Celia's new prosthetic hand. He never stopped regretting it; the resistance rebuilds him to try again.",
  ),
  ch(
    CELIA,
    "Celia",
    "Lead \u2014 the roboticist",
    71,
    F.oldCelia,
    "Once a red-haired young woman with a gleaming prosthetic arm; now silver-haired and weathered, ruling a throne of dead machines she once gave life to.",
    "Brilliant, proud, grieving; convinced love is a fault line she engineered around.",
    "Rejected on the bridge, she poured herself into robotics and changed the world \u2014 until her machines turned on it. She has spent forty years among their wreckage.",
  ),
  ch(
    ENGINEER,
    "The Engineer",
    "Resistance \u2014 memory-maker",
    49,
    F.brainLab,
    "A wild-eyed tinkerer with a head-mounted magnifier, forever bent over salvaged tech and a living, wired brain on the workbench.",
    "Manic, gleeful, certain his impossible idea is the only one left.",
    "The mind behind rebuilding Thom from a recorded memory \u2014 the team's one desperate plan to reach Celia's machines.",
  ),
  ch(
    SOLDIER,
    "The Soldier",
    "Resistance \u2014 the shield",
    34,
    F.soldier,
    "Battle-worn and fearless, swinging through the burning understructure of the city with a heavy gun and a grin in the teeth of the machines.",
    "Loyal, reckless, the one who always volunteers to be the distraction.",
    "Has survived more of this war than anyone should. Buys the team the minutes they need, whatever it costs him.",
  ),
  ch(
    TECH,
    "The Technician",
    "Resistance \u2014 the nerves",
    27,
    F.tech,
    "Curly-haired and bespectacled, wired into a wall of flickering screens, narrating the recreation in real time at the top of his lungs.",
    "Anxious, brilliant, runs on panic and caffeine.",
    "Keeps the rebuilt memory stable from the safehouse \u2014 the first to know the moment Thom wakes thinking it is forty years ago.",
  ),
  ch(
    SENTINEL,
    "The Sentinel",
    "Antagonist \u2014 the machines",
    40,
    F.robotRoof,
    "A towering scrap-built war machine, one of the countless robots that rose over Amsterdam \u2014 graffiti-tagged steel tearing through the rooftops.",
    "Implacable, swarming, the inheritance of a single broken heart.",
    "Born of Celia's genius and turned against the city; forty years of machines stand between the resistance and the bridge.",
  ),
  ch(
    CAPTAIN,
    "The Captain",
    "Resistance \u2014 the old guard",
    61,
    TOS_SEEK(176),
    "Grey-bearded and granite-calm in battered flannel and a field harness, he has led what's left of the resistance since before most of them were born.",
    "Weary, principled, unwilling to spend a life he doesn't have to.",
    "Holds the safehouse together and signs off on the impossible plan \u2014 then walks point when the team finally goes into the open.",
  ),
  ch(
    OPERATOR,
    "The Operator",
    "Resistance \u2014 the simulation",
    36,
    TOS_SEEK(55),
    "Dreadlocked and bandana-wrapped in a stained lab suit, hunched over a glowing console where the words SIMULATION READY hang in the air.",
    "Methodical, superstitious about his rig, quietly brilliant.",
    "Runs the recreation simulation so the team can rehearse the memory before they ever set foot on the bridge.",
  ),
  ch(
    EFFIGY,
    "The Effigy",
    "The recreation \u2014 Thom rebuilt",
    0,
    TOS_SEEK(460),
    "A pale, half-finished android wearing Thom's face, assembled piece by piece in the workshop to walk back into the past.",
    "Blank until the memory loads \u2014 then heartbreakingly him.",
    "The vessel for the rebuilt mind: the body that will stand on the bridge in Thom's place.",
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
  project_id: DEMO_PROJECT_ID,
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

export const DEMO_SCENES: DemoScene[] = [
  sc(
    "tos-scene-1",
    1,
    TOS_SEEK(30),
    [THOM, CELIA],
    "The bridge, forty years ago",
    "Thom and Celia meet on an Amsterdam canal bridge in spring. When she reaches for him with her new prosthetic hand, he flinches \u2014 and something between them breaks for good.",
    "CELIA: \"It's still me, Thom.\"\nTHOM: \"...I know. I just \u2014 I can't.\"",
  ),
  sc(
    "tos-scene-2",
    2,
    TOS_SEEK(360),
    [THOM, CELIA],
    "The robotic hand",
    "The moment that started everything: Celia offers the cool gleam of her new prosthetic hand, and Thom cannot bring himself to take it. He turns away, and a future of machines is set in motion.",
    "CELIA: \"It's just a hand.\"\nTHOM: \"It's not the hand. It's that you became this without me.\"",
  ),
  sc(
    "tos-scene-3",
    3,
    TOS_SEEK(80),
    [CELIA, SOLDIER, SENTINEL],
    "Roboticist creates killer robots",
    "Celia pours her grief into her work and becomes the most brilliant roboticist of her age. Decades later the headlines turn dark, and Amsterdam wakes to machines in its skies.",
    "NEWS (V.O.): \"...the same doctor who revolutionized prosthetics now stands accused as her own machines turn on the city.\"",
  ),
  sc(
    "tos-scene-4",
    4,
    TOS_SEEK(155),
    [SENTINEL],
    "The cathedral of machines",
    "Inside a ruined cathedral the machines have made their nest, scrap-built sentinels roosting among the organ pipes while drones prowl the drowned streets outside.",
    "THE CAPTAIN (V.O.): \"They don't sleep. They wait. And they remember every one of us.\"",
  ),
  sc(
    "tos-scene-5",
    5,
    TOS_SEEK(290),
    [ENGINEER, TECH, SOLDIER, CAPTAIN],
    "The resistance",
    "In an overgrown safehouse on the canals, the last fighters gather: a grizzled captain, a wild-eyed engineer, a frantic technician, and a soldier who has survived too much.",
    "THE ENGINEER: \"We don't fight the machines. We give them back the one memory that started all this.\"",
  ),
  sc(
    "tos-scene-6",
    6,
    TOS_SEEK(55),
    [OPERATOR, ENGINEER, EFFIGY],
    "The simulation",
    "Before they risk the open city, the operator runs the recreation in simulation \u2014 the recovered mind firing across a glowing rig as the effigy takes shape on the bench.",
    "THE OPERATOR: \"Simulation ready. Loading him in... and he's dreaming.\"",
  ),
  sc(
    "tos-scene-7",
    7,
    TOS_SEEK(430),
    [THOM, CELIA, ENGINEER, TECH, OPERATOR, EFFIGY],
    "Rebuilding the mind",
    "The team pours Thom's recorded memory into the waiting effigy \u2014 a living recreation meant to stand again on that bridge, so Celia's machines can finally be told the truth.",
    "THE TECHNICIAN: \"He's... awake. He thinks it's forty years ago.\"",
  ),
  sc(
    "tos-scene-8",
    8,
    TOS_SEEK(255),
    [CAPTAIN, ENGINEER, THOM],
    "The field test",
    "Out in the open, under the dead eye of a fallen machine, the captain and engineer wheel the recreation rig into the street for one last test before the bridge.",
    "THE CAPTAIN: \"If it doesn't hold out here, none of us walk back.\"",
  ),
  sc(
    "tos-scene-9",
    9,
    TOS_SEEK(200),
    [SOLDIER, SENTINEL],
    "Into the fire",
    "As the machines close in, the soldier draws their fire through the burning understructure of the city so the recreation can reach the bridge in time.",
    "THE SOLDIER: \"Go! I've got their attention \u2014 now MOVE!\"",
  ),
  sc(
    "tos-scene-10",
    10,
    TOS_SEEK(385),
    [THOM, CELIA, SOLDIER, SENTINEL, CAPTAIN],
    "Tears of steel",
    "The recreated Thom faces the towering machine as old Celia watches her life's regret play out. Amid a mountain of fallen steel, a single moment of acceptance decides everything.",
    "CELIA: \"This time... let me reach you.\"",
  ),
];

// Frames/shots per scene: each carries a real frame still (media_url) and the
// film with a time fragment (video_url) for that beat, so every shot shows real
// people from the film. All are "completed" so the spine fully stitches.
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
  { scene: 1, still: F.bridge, t: 72, caption: "The bridge, forty years ago" },
  { scene: 2, still: TOS_SEEK(520), t: 520, caption: "He pulls away" },
  { scene: 3, still: F.newspaper, t: 150, caption: "Roboticist creates killer robots" },
  { scene: 3, still: F.machineCity, t: 165, caption: "Machines fill the Amsterdam sky" },
  { scene: 3, still: F.robotRoof, t: 180, caption: "A sentinel tears through the rooftops" },
  { scene: 4, still: TOS_SEEK(490), t: 490, caption: "Inside the cathedral lair" },
  { scene: 4, still: TOS_SEEK(105), t: 105, caption: "A drone prowls the rooftops" },
  { scene: 5, still: F.hideout, t: 210, caption: "The safehouse on the canal" },
  { scene: 5, still: F.team, t: 225, caption: "The resistance makes its plan" },
  { scene: 5, still: F.tech, t: 300, caption: "Wiring the impossible" },
  { scene: 6, still: TOS_SEEK(62), t: 62, caption: "Reading the recovered mind" },
  { scene: 6, still: TOS_SEEK(460), t: 460, caption: "Assembling the effigy" },
  { scene: 7, still: F.brainLab, t: 320, caption: "Rebuilding Thom from memory" },
  { scene: 8, still: TOS_SEEK(252), t: 252, caption: "The team and the rig" },
  { scene: 8, still: TOS_SEEK(192), t: 192, caption: "Under a fallen machine" },
  { scene: 9, still: F.soldier, t: 380, caption: "Drawing the machines' fire" },
  { scene: 10, still: F.thomRobot, t: 560, caption: "The past meets the machine" },
  { scene: 10, still: F.oldCelia, t: 600, caption: "Celia and her fallen steel" },
  { scene: 10, still: F.junkyard, t: 640, caption: "Among the ruins of the war" },
];

export const DEMO_FRAMES: DemoFrame[] = (() => {
  const perScene: Record<number, number> = {};
  return SHOTS.map((shot) => {
    const order = perScene[shot.scene] ?? 0;
    perScene[shot.scene] = order + 1;
    return {
      id: `tos-frame-${shot.scene}-${order + 1}`,
      scene_id: `tos-scene-${shot.scene}`,
      video_url: `${TOS_VIDEO}#t=${shot.t}`,
      media_url: shot.still,
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

// Exactly what getCompleteProjectStatus() returns for the demo project id.
export const DEMO_COMPLETE_STATUS = {
  scenes: DEMO_SCENES as any[],
  characters: DEMO_CHARACTERS as any[],
  objects: [] as any[],
  frames: DEMO_FRAMES as any[],
  completion_status: "complete",
};
