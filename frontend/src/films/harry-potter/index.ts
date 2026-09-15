// Hardcoded "prompt -> film" Harry Potter data for new films. All media is
// real and hotlink-verified: Wikimedia Commons portraits/locations + archive.org
// Sorcerer's Stone trailer mp4s. The mock backend serves this so the existing
// generation pipeline plays the full flow with no API keys.

const WIKI = "https://upload.wikimedia.org/wikipedia/commons";

// archive.org HP trailers (verified 206 video/mp4, range-seekable).
export const HP_CLIP_VIDEO =
  "https://archive.org/download/HarryPotterTheSorcerersStoneTrailer1/HarryPotterTheSorcerersStoneTrailer1.mp4";
export const HP_FINAL_VIDEO =
  "https://archive.org/download/harry-potter-and-the-sorcerers-stone-2001-720p-trailer/Harry%20Potter%20and%20the%20Sorcerers%20Stone_2001_720p_trailer.mp4";

// Real HP filming locations (Hogwarts studio model) for the final-film poster.
export const HP_POSTER = `${WIKI}/thumb/4/4d/Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg/960px-Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg`;

export const HP_TITLE = "Harry Potter and the Philosopher's Stone";

export const HP_PLOT_POINTS = [
  "An orphaned boy learns he is a wizard and is summoned to Hogwarts School of Witchcraft and Wizardry.",
  "Harry and his new friends Ron and Hermione uncover a plot to steal a stone that grants immortality.",
  "They descend past the school's defenses for a final confrontation that decides the fate of the wizarding world.",
];

export const HP_DIRECTOR_REPLY =
  "Love it, a wizarding coming-of-age. I've shaped it into Harry Potter and the Philosopher's Stone: a three-act arc with a warm, iconic cast. The plot and cast are sketched below. Hit \u201cGenerate the cast\u201d when you're ready and we'll build it stage by stage.";

export type HpCharacter = {
  name: string;
  role: string;
  age: number;
  description: string;
  personality: string;
  backstory: string;
  media: string;
};

export const HP_CHARACTERS: HpCharacter[] = [
  // Portraits use the youngest free-licensed Wikimedia Commons images of each
  // lead (Daniel in-costume on the 2009 Deathly Hallows shoot; Emma at the 2005
  // Goblet of Fire premiere; Rupert in 2009). True 2001 child-era photos aren't
  // freely licensed, so the trio reads film-era rather than book-age 11.
  {
    name: "Harry Potter",
    role: "Protagonist, the boy who lived",
    age: 11,
    description:
      "A small, bespectacled first-year with a lightning-bolt scar and a too-big hand-me-down cloak. Brave without realizing it.",
    personality: "Earnest, loyal, quietly defiant of unfairness.",
    backstory:
      "Orphaned as a baby when the dark wizard Voldemort killed his parents, Harry was raised unloved by the Dursleys until Hogwarts called him home.",
    media: `${WIKI}/thumb/9/99/Daniel_Radcliffe_as_Harry_Potter.jpg/960px-Daniel_Radcliffe_as_Harry_Potter.jpg`,
  },
  {
    name: "Hermione Granger",
    role: "Deuteragonist, brightest witch of her age",
    age: 11,
    description:
      "Bushy-haired and book-armed, hand always first in the air. Reads ahead, then saves everyone with it.",
    personality: "Brilliant, principled, fiercely loyal once won over.",
    backstory:
      "Muggle-born and determined to out-study any doubt, she becomes the mind that ties the trio together.",
    media: `${WIKI}/thumb/4/48/Emma_Watson_GoF_Premiere_Crop.jpg/960px-Emma_Watson_GoF_Premiere_Crop.jpg`,
  },
  {
    name: "Ron Weasley",
    role: "Best friend, heart of the trio",
    age: 12,
    description:
      "Freckled, red-haired, sixth of seven Weasleys, in well-worn robes and clutching a chipped wand.",
    personality: "Warm, funny, braver than he believes.",
    backstory:
      "From a loving but penniless wizarding family, Ron offers Harry the first real friendship he has ever had.",
    media: `${WIKI}/thumb/4/47/Rupert_Grint_2009.jpg/960px-Rupert_Grint_2009.jpg`,
  },
  {
    name: "Rubeus Hagrid",
    role: "Keeper of Keys and Grounds",
    age: 63,
    description:
      "A giant of a man with a wild beard and a soft heart, always with some impossible creature in his coat.",
    personality: "Gentle, fiercely loyal, hopeless at keeping secrets.",
    backstory:
      "Expelled as a student but kept on by Dumbledore, Hagrid is the one who tells Harry the truth and brings him to Hogwarts.",
    media: `${WIKI}/3/3a/Robbiecoltrane_%28cropped%29.jpg`,
  },
  {
    name: "Minerva McGonagall",
    role: "Transfiguration mistress, Head of Gryffindor",
    age: 65,
    description:
      "Stern in emerald robes and square spectacles, she can become a tabby cat and miss nothing as either.",
    personality: "Exacting, fair, secretly proud of her lions.",
    backstory:
      "Dumbledore's trusted deputy, she has guarded Hogwarts' rules (and its students) for decades.",
    media: `${WIKI}/thumb/2/28/Maggie_Smith_-_Vintage_%28trim%29.jpg/960px-Maggie_Smith_-_Vintage_%28trim%29.jpg`,
  },
  {
    name: "Severus Snape",
    role: "Potions master, the suspected one",
    age: 41,
    description:
      "Sallow, black-robed, voice like cold silk; he glides through the dungeons and seems to loathe Harry on sight.",
    personality: "Cutting, guarded, motives forever in shadow.",
    backstory:
      "A brilliant, bitter master whose every move makes Harry sure he is the thief, until the truth turns out stranger.",
    media: `${WIKI}/thumb/f/fe/Alan_Rickman_after_Seminar_%283%29.jpg/960px-Alan_Rickman_after_Seminar_%283%29.jpg`,
  },
];

export type HpScene = {
  title: string;
  concise_plot: string;
  detailed_plot: string;
  dialogue: string;
  media: string;
  // Per-scene shot stills, curated so each shot reflects THIS scene's content
  // (train shots for the Express, castle shots for the arrival, cloister/corridor
  // shots for the forbidden corridor) instead of a shared rotating pool.
  shots: string[];
};

export const HP_SCENES: HpScene[] = [
  {
    title: "The Hogwarts Express",
    concise_plot: "Harry boards the scarlet train at Platform Nine and Three-Quarters.",
    detailed_plot:
      "A scarlet steam engine thunders across a soaring stone viaduct through the Highlands. In a carriage, Harry meets Ron over a trolley of magical sweets, and a frantic Hermione looking for a lost toad. The trio, first met.",
    dialogue:
      'RON: "I\'m Ron, by the way. Ron Weasley."\nHARRY: "I\'m Harry. Harry Potter."\nRON: "So it\'s true?!"',
    media: `${WIKI}/thumb/1/10/Glenfinnan_Viaduct_-_2022.jpg/960px-Glenfinnan_Viaduct_-_2022.jpg`,
    shots: [
      `${WIKI}/thumb/1/10/Glenfinnan_Viaduct_-_2022.jpg/960px-Glenfinnan_Viaduct_-_2022.jpg`,
      `${WIKI}/thumb/1/10/Hogwarts_Express_%2823041906913%29.jpg/960px-Hogwarts_Express_%2823041906913%29.jpg`,
      `${WIKI}/thumb/1/19/GWR_4900_Class_5972_Olton_Hall%2C_The_Hogwarts_Express%2C_at_Spean_Bridge_railway_station.jpg/960px-GWR_4900_Class_5972_Olton_Hall%2C_The_Hogwarts_Express%2C_at_Spean_Bridge_railway_station.jpg`,
    ],
  },
  {
    title: "Arrival at Hogwarts",
    concise_plot: "First-years cross the lake to the floodlit castle for the Sorting.",
    detailed_plot:
      "Boats glide across black water toward a castle blazing with a thousand windows. In the candle-lit hall the Sorting Hat calls the houses, and a nervous Harry is roared into Gryffindor.",
    dialogue:
      'McGONAGALL: "Welcome to Hogwarts. The Sorting is about to begin."\nHAT: "Better be... GRYFFINDOR!"',
    media: `${WIKI}/thumb/a/a1/Alnwick_Castle_in_uk.jpg/960px-Alnwick_Castle_in_uk.jpg`,
    shots: [
      `${WIKI}/thumb/a/a1/Alnwick_Castle_in_uk.jpg/960px-Alnwick_Castle_in_uk.jpg`,
      `${WIKI}/thumb/4/4d/Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg/960px-Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg`,
      `${WIKI}/thumb/b/b8/Tom_Quad%2C_Christ_Church%2C_Oxford.jpg/960px-Tom_Quad%2C_Christ_Church%2C_Oxford.jpg`,
    ],
  },
  {
    title: "The Forbidden Corridor",
    concise_plot: "The trio descend past the school's defenses toward the Stone.",
    detailed_plot:
      "Down through a trapdoor and a tangle of enchantments (Devil's Snare, a storm of flying keys, a giant chessboard), Harry presses on alone toward the mirror where the Stone, and the truth about his enemy, waits.",
    dialogue:
      'HERMIONE: "Books! And cleverness! There are more important things. Friendship and bravery."\nHARRY: "Whatever\'s down there, I\'m going through."',
    media: `${WIKI}/thumb/d/d6/Durham_MMB_02_Cathedral.jpg/960px-Durham_MMB_02_Cathedral.jpg`,
    shots: [
      `${WIKI}/thumb/d/d6/Durham_MMB_02_Cathedral.jpg/960px-Durham_MMB_02_Cathedral.jpg`,
      `${WIKI}/thumb/2/26/Gloucester_Cathedral_exterior_2019.JPG/960px-Gloucester_Cathedral_exterior_2019.JPG`,
      `${WIKI}/thumb/2/29/Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg/960px-Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg`,
    ],
  },
];

// Pool of real HP-location stills assigned across the generated shots.
export const HP_SHOT_STILLS: string[] = [
  `${WIKI}/thumb/1/10/Glenfinnan_Viaduct_-_2022.jpg/960px-Glenfinnan_Viaduct_-_2022.jpg`,
  `${WIKI}/thumb/a/a1/Alnwick_Castle_in_uk.jpg/960px-Alnwick_Castle_in_uk.jpg`,
  `${WIKI}/thumb/b/b8/Tom_Quad%2C_Christ_Church%2C_Oxford.jpg/960px-Tom_Quad%2C_Christ_Church%2C_Oxford.jpg`,
  `${WIKI}/thumb/d/d6/Durham_MMB_02_Cathedral.jpg/960px-Durham_MMB_02_Cathedral.jpg`,
  `${WIKI}/thumb/2/26/Gloucester_Cathedral_exterior_2019.JPG/960px-Gloucester_Cathedral_exterior_2019.JPG`,
  `${WIKI}/thumb/2/29/Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg/960px-Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg`,
  `${WIKI}/thumb/4/4d/Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg/960px-Studio_model_of_Hogwarts_at_Leavesden_Studios.jpg`,
];

export function hpCharacterByName(name?: string): HpCharacter | undefined {
  if (!name) return undefined;
  const q = name.trim().toLowerCase();
  return (
    HP_CHARACTERS.find((c) => c.name.toLowerCase() === q) ||
    HP_CHARACTERS.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
  );
}
