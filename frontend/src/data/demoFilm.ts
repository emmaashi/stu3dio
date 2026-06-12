// ============================================================================
// Hardcoded demo film — "Emberveil"
// A magic / sorcery-academy battling story, baked in so the canvas shows a full
// pipeline (overview → characters → scenes → clips → final film) with NO backend.
//
// I can't generate video/images here, so this pairs richly-written themed data
// with real, freely-hosted open-movie footage (Sintel — a fantasy short with a
// dragon and sword/spell combat). Character/scene `media_url` are left as empty
// slots so generated stills can be pasted in later; nodes show clean placeholders
// until then. These shapes mirror what getCompleteProjectStatus() returns and what
// CanvasModal.pollLive() consumes.
// ============================================================================

import type { Project } from "../types/backend";
import type { BackendCharacter, BackendScene } from "./characterData";

export const DEMO_PROJECT_ID = "demo-emberveil-001";

// Verified-working, freely-hosted footage (the old gtv-videos-bucket URLs are now 403).
export const DEMO_FINAL_FILM_SRC =
  "https://archive.org/download/Sintel/sintel-2048-surround.mp4"; // Sintel, ~15 min fantasy

// Library card poster (castle on a sea cliff).
export const DEMO_POSTER =
  "https://images.unsplash.com/photo-1598105014233-04a936265c46?auto=format&fit=crop&w=900&q=72";

// Themed short clips for the per-scene "clip" nodes (loop/hover-play previews).
const CLIP_FANTASY = "https://media.w3.org/2010/05/sintel/trailer.mp4";
const CLIP_B = "https://media.w3.org/2010/05/bunny/trailer.mp4";
const CLIP_C = "https://media.w3.org/2010/05/video/movie_300.mp4";
const CLIPS = [CLIP_FANTASY, CLIP_C, CLIP_FANTASY, CLIP_B, CLIP_FANTASY, CLIP_C];

const ISO = "2026-06-01T00:00:00.000Z";

// Themed, verified-hotlinkable stills (Unsplash CDN). `img(id)` builds a sized URL.
const IMG_PARAMS = "?auto=format&fit=crop&w=640&q=72";
const img = (id: string) => `https://images.unsplash.com/photo-${id}${IMG_PARAMS}`;

export const DEMO_PROJECT: Project = {
  id: DEMO_PROJECT_ID,
  title: "Emberveil",
  summary:
    "A young mage at the storm-wracked academy of Hollowmere discovers a forbidden ember-spell — and must master it before a fallen sorcerer drowns the school in ash.",
  plot:
    "EMBERVEIL — a magic-academy fantasy.\n\n" +
    "When orphan Ren Calloway is admitted to Hollowmere, an academy of sorcery perched on black sea-cliffs, he can barely light a candle. But beneath the academy sleeps the Emberveil: a banned spell of living fire bound there centuries ago to keep it from the world. As Ren and his friends are drawn toward its vault, the Ashen — Mordrane, a master expelled for the same hunger — returns at the head of a tide of shadow.\n\n" +
    "Guided by the stern Magister Elowen Vane and shadowed by his prickly rival Seraphine Dusk, Ren learns that the ember answers not to power but to grief. Betrayal cracks the school open from within; the cloisters burn. In a final wand-duel on the storm-lashed ramparts, Ren must choose between wielding the Emberveil as a weapon or letting it go — and in letting go, finally command it.",
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
  backstory: string,
): BackendCharacter => ({
  id,
  project_id: DEMO_PROJECT_ID,
  media_url: media,
  metadata: { name, role, age, description, personality, backstory },
  created_at: ISO,
  updated_at: ISO,
});

export const DEMO_CHARACTERS: BackendCharacter[] = [
  ch(
    "demo-char-ren",
    "Ren Calloway",
    "Protagonist — first-year mage",
    16,
    img("1518043949520-c265d989161e"),
    "A wiry orphan with ink-stained fingers and a candle that never quite stays lit. Wears a too-big grey cloak and carries a cracked ash-wood wand inherited from no one he can name.",
    "Earnest, stubborn, quietly grieving; underestimates himself until the moment it counts.",
    "Found on the Hollowmere shore as an infant beside a guttered fire that wouldn't die. Raised in the academy's almshouse, he was admitted by special dispensation when the ember-vault flared the night he arrived.",
  ),
  ch(
    "demo-char-elowen",
    "Magister Elowen Vane",
    "Mentor — Mistress of Living Flame",
    54,
    img("1566616213894-2d4e1baee5d8"),
    "Silver-haired and straight-backed, robes the colour of banked coals. Speaks in few words; her gaze is said to read the temperature of a soul.",
    "Severe, principled, secretly tender. Believes restraint is the highest magic.",
    "The last warden of the Emberveil. She sealed the vault herself after the duel that scarred her hand — and that exiled the man who was once her brightest student, Mordrane.",
  ),
  ch(
    "demo-char-mordrane",
    "Mordrane the Ashen",
    "Antagonist — fallen sorcerer",
    49,
    img("1580829040120-aee1b4618a86"),
    "Tall, gaunt, wrapped in smoke that never clears. Where he walks, colour drains and frost-grey ash settles like snow.",
    "Charismatic, wounded, absolute. Convinced that mercy is the lie that kept him small.",
    "Once Hollowmere's prodigy, expelled for trying to wake the Emberveil to resurrect a drowned sister. He has spent twenty years hollowing himself into shadow to finally claim it.",
  ),
  ch(
    "demo-char-pip",
    "Pip Thornwood",
    "Loyal friend — herbalist apprentice",
    15,
    img("1499996860823-5214fcc65f8f"),
    "Round-faced, perpetually crumb-dusted, pockets full of seeds and snail-shells. Better with growing things than with spells.",
    "Warm, brave in small loud ways, the heart that keeps everyone honest.",
    "A baker's son from the mainland who talked his way into the academy on a scholarship for greenwork. Would walk into fire for a friend — and, by the third act, does.",
  ),
  ch(
    "demo-char-seraphine",
    "Seraphine Dusk",
    "Rival turned ally — duelling prodigy",
    17,
    img("1604073788733-f01b27fe34cd"),
    "Sharp-eyed, immaculate, a wand of polished thorn she spins between her fingers. Top of every class and furious about the boy who isn't.",
    "Proud, exacting, loyal once won. Hides fear behind precision.",
    "Heir to a fading duelling house desperate for a champion. She sees in the Emberveil the glory her name has lost — until she sees what it costs.",
  ),
  ch(
    "demo-char-nyx",
    "Nyx",
    "Familiar — shadow-fox",
    3,
    img("1560809451-9e77c2e8214a"),
    "A fox stitched from dusk and embers, eyes like two coals. Slips between shadows and steals exactly one small bright thing from every room.",
    "Mischievous, fiercely bonded, an early warning system with teeth.",
    "Drawn out of the ember-vault the night Ren arrived and has never left his side; no one, including Ren, is entirely sure what it is.",
  ),
];

const sc = (
  id: string,
  order: number,
  media: string,
  concise: string,
  detailed: string,
  dialogue: string,
): BackendScene => ({
  id,
  project_id: DEMO_PROJECT_ID,
  media_url: media,
  metadata: {
    scene_order: order,
    concise_plot: concise,
    detailed_plot: detailed,
    dialogue,
  },
  created_at: ISO,
  updated_at: ISO,
});

export const DEMO_SCENES: BackendScene[] = [
  sc(
    "demo-scene-1",
    1,
    img("1598105014233-04a936265c46"),
    "Arrival at Hollowmere",
    "A ferry climbs a black swell toward an academy carved into sea-cliffs. Lanterns float up the stair like sparks. Ren grips his cracked wand; far below the waterline, something orange pulses once.",
    'ELOWEN (V.O.): "Hollowmere keeps two kinds of students — those who came to learn, and those the school sent for. Pray you never learn which you are."',
  ),
  sc(
    "demo-scene-2",
    2,
    img("1618325508550-951512a1e82d"),
    "The first spark",
    "In the candle-hall, students coax flame from wicks. Ren's won't catch — until grief flickers behind his eyes and the whole row of candles erupts in column-high fire. The masters go very still.",
    'PIP: "Mate. Mate. The whole row." \nREN: "I didn\'t— I only thought about home." \nELOWEN: "That is precisely the problem."',
  ),
  sc(
    "demo-scene-3",
    3,
    img("1465929639680-64ee080eb3ed"),
    "The forbidden library",
    "By Nyx's stolen candle, Ren and Pip find the sealed stacks. A door of fused glass hums with heat. Behind it, the word EMBERVEIL is burned into stone — and a second set of footprints in the ash, fresh.",
    'PIP: "Those aren\'t ours." \nREN: "No. Someone\'s been here. Recently."',
  ),
  sc(
    "demo-scene-4",
    4,
    img("1641414972497-23d5aa329497"),
    "The courtyard duel",
    "Seraphine challenges Ren before a ring of students. Thorn-wand against ash-wand; her precision against his accidents. He loses — spectacularly — but the ember answers his fall, and for one breath the courtyard blooms with harmless fire that hurts no one.",
    'SERAPHINE: "You don\'t duel. You detonate." \nREN: "And yet you\'re the one who stepped back."',
  ),
  sc(
    "demo-scene-5",
    5,
    img("1670142379088-4487fc8038a8"),
    "The Ashen betrayal",
    "Mordrane reveals himself within the walls — and a trusted face opens the vault from the inside. Shadow pours through the cloisters; the sea itself recoils. Elowen's sealed hand blazes as she holds a corridor alone.",
    'MORDRANE: "Elowen. You buried the only mercy this school ever had." \nELOWEN: "I buried you, Mordrane. There is a difference. Run, Ren!"',
  ),
  sc(
    "demo-scene-6",
    6,
    img("1586810147108-a23b62f9b396"),
    "Mastering the ember",
    "Hidden in the flooded undercroft, Seraphine drilling him, Pip's seeds glowing in the dark, Ren learns the ember answers not to anger but to letting go. The flame finally curls to his open hand, calm as a held breath.",
    'SERAPHINE: "Stop forcing it." \nREN: "I\'m not forcing. I\'m... letting it leave." \nSERAPHINE: "Then it stays. Of course it stays."',
  ),
  sc(
    "demo-scene-7",
    7,
    img("1765294021016-f98fa390a506"),
    "The wand-duel finale",
    "On the storm-lashed ramparts, Ren faces Mordrane as the Emberveil rises between them — a living wall of fire begging to be made a weapon. Wands scream. Ren chooses to release the spell rather than wield it, and in releasing it, finally commands it; the fire turns on the shadow, not the school.",
    'MORDRANE: "Use it! Make them pay for what they took!" \nREN: "No. I\'m letting her go." \nMORDRANE: "...what?"',
  ),
  sc(
    "demo-scene-8",
    8,
    img("1518709268805-4e9042af9f23"),
    "Dawn over Hollowmere",
    "Smoke thins to gold. The vault stands open and quiet, the Emberveil gentled into a single ward-flame Ren now tends. Elowen offers her scarred hand. Nyx steals one last bright thing and trots off into a clean morning.",
    'ELOWEN: "It never wanted a master. It wanted someone who could let go." \nREN: "Then I suppose it found one."',
  ),
];

// Frames/clips per scene (1–3 each). All carry video_url ⇒ every clip reads as
// "completed", so the canvas spine fully stitches and the Final Film node lights up.
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

const FRAME_PLAN: Array<{ scene: number; beats: string[] }> = [
  { scene: 1, beats: ["Ferry climbs the black swell", "Lanterns float up the cliff stair", "The waterline pulses orange"] },
  { scene: 2, beats: ["Wicks refuse to catch", "The candle-row erupts in fire"] },
  { scene: 3, beats: ["Nyx's stolen candlelight", "The fused-glass door hums", "Fresh footprints in the ash"] },
  { scene: 4, beats: ["Thorn-wand vs ash-wand", "Ren falls — the courtyard blooms with fire"] },
  { scene: 5, beats: ["Shadow pours through the cloisters", "Elowen holds the corridor alone"] },
  { scene: 6, beats: ["Drilling in the flooded undercroft", "The flame curls to an open hand"] },
  { scene: 7, beats: ["The Emberveil rises between them", "Ren releases the spell", "Fire turns on the shadow"] },
  { scene: 8, beats: ["Smoke thins to gold", "A single ward-flame, tended"] },
];

export const DEMO_FRAMES: DemoFrame[] = (() => {
  const frames: DemoFrame[] = [];
  let order = 0;
  FRAME_PLAN.forEach(({ scene, beats }) => {
    beats.forEach((beat, i) => {
      order += 1;
      frames.push({
        id: `demo-frame-${scene}-${i + 1}`,
        scene_id: `demo-scene-${scene}`,
        video_url: CLIPS[(order - 1) % CLIPS.length],
        media_url: "",
        status: "completed",
        metadata: {
          frame_order: order,
          scene_order: scene,
          concise_plot: beat,
          summary: beat,
          duration: 8,
          dialogue: "",
        },
      });
    });
  });
  return frames;
})();

// Exactly what getCompleteProjectStatus() returns for the demo project id.
export const DEMO_COMPLETE_STATUS = {
  scenes: DEMO_SCENES as any[],
  characters: DEMO_CHARACTERS as any[],
  objects: [] as any[],
  frames: DEMO_FRAMES as any[],
  completion_status: "complete",
};
