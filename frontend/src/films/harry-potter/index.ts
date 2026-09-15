// Hardcoded "prompt -> film" Harry Potter data for new films. All media is
// real and hotlink-verified: Wikimedia Commons portraits/locations + archive.org
// Sorcerer's Stone trailer mp4s. The mock backend serves this so the existing
// generation pipeline plays the full flow with no API keys.

const WIKI = "https://upload.wikimedia.org/wikipedia/commons";

// The canonical demo prompt. The new-film screen offers this as its first
// example, and the mock director shapes any prompt into this film.
export const HP_PROMPT = "Harry Potter learns quidditch for the first time";

// archive.org HP trailers (verified 206 video/mp4, range-seekable). The 720p
// trailer carries the first-match flying footage, so it stands in as the
// finished film.
export const HP_CLIP_VIDEO =
  "https://archive.org/download/HarryPotterTheSorcerersStoneTrailer1/HarryPotterTheSorcerersStoneTrailer1.mp4";
export const HP_FINAL_VIDEO =
  "https://archive.org/download/harry-potter-and-the-sorcerers-stone-2001-720p-trailer/Harry%20Potter%20and%20the%20Sorcerers%20Stone_2001_720p_trailer.mp4";

// A quidditch pitch fronts the finished film instead of the castle model, so
// the final-film card reads as the match rather than the wider school story.
export const HP_POSTER = `${WIKI}/thumb/d/d9/Quidditch_pitch.jpg/960px-Quidditch_pitch.jpg`;

export const HP_TITLE = "Harry Potter and the First Flight";

export const HP_PLOT_POINTS = [
  "At his first flying lesson, an eleven-year-old Harry Potter steps onto a broom for the very first time and discovers he can fly better than anyone in his year.",
  "Professor McGonagall names him the youngest Gryffindor Seeker in a century, and Hermione drills him on the rules while Snape watches the new favourite a little too closely.",
  "In his first real quidditch match Harry outflies a bucking broom and the older players to close his hand around the Golden Snitch.",
];

export const HP_SCENES_OVERVIEW =
  "Three acts across eight shots: a first flying lesson, a Seeker's selection, and the match itself.";

export const HP_DIRECTOR_REPLY =
  "Love it, a first-time-on-a-broom story. I've shaped it into Harry Potter and the First Flight: three acts that run from the flying lesson to his first match as Seeker, with a warm, iconic cast. The plot and cast are sketched below. Hit “Generate the cast” when you're ready and we'll build it stage by stage.";

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
  // Portraits use free-licensed Wikimedia Commons images of each actor (Daniel
  // in-costume on the 2009 Deathly Hallows shoot; Emma at the 2005 Goblet of
  // Fire premiere; Gambon in Dumbledore costume on the Half-Blood Prince set).
  // True 2001 child-era photos aren't freely licensed, so the leads read
  // film-era rather than book-age 11.
  {
    name: "Harry Potter",
    role: "Protagonist, the first-time flyer",
    age: 11,
    description:
      "A small, bespectacled first-year with a lightning-bolt scar, gripping a school broom he has never been allowed to touch.",
    personality: "Earnest, loyal, quietly fearless once he is off the ground.",
    backstory:
      "Raised unloved by the Dursleys and forbidden anything like a toy, Harry has never played a sport in his life - and turns out to be a natural in the air.",
    media: `${WIKI}/thumb/9/99/Daniel_Radcliffe_as_Harry_Potter.jpg/960px-Daniel_Radcliffe_as_Harry_Potter.jpg`,
  },
  {
    name: "Hermione Granger",
    role: "Deuteragonist, the one who read the rulebook",
    age: 11,
    description:
      "Bushy-haired and book-armed, quoting Quidditch Through the Ages from the stands before Harry has finished his first lap.",
    personality: "Brilliant, principled, anxious on anyone else's behalf.",
    backstory:
      "Muggle-born and determined to out-study any doubt, she learns the game on paper so Harry can survive it in the air.",
    media: `${WIKI}/thumb/4/48/Emma_Watson_GoF_Premiere_Crop.jpg/960px-Emma_Watson_GoF_Premiere_Crop.jpg`,
  },
  {
    name: "Minerva McGonagall",
    role: "Transfiguration mistress, Head of Gryffindor",
    age: 65,
    description:
      "Stern in emerald robes and square spectacles, she spots raw talent from a courtyard window and acts on it within the hour.",
    personality: "Exacting, fair, secretly thrilled about her new Seeker.",
    backstory:
      "Dumbledore's trusted deputy and a Gryffindor partisan who has waited a century for a Seeker worth breaking the first-year rule for.",
    media: `${WIKI}/thumb/2/28/Maggie_Smith_-_Vintage_%28trim%29.jpg/960px-Maggie_Smith_-_Vintage_%28trim%29.jpg`,
  },
  {
    name: "Severus Snape",
    role: "Potions master, the suspected one",
    age: 41,
    description:
      "Sallow, black-robed, voice like cold silk; he referees the first match with his eyes locked on Harry rather than the ball.",
    personality: "Cutting, guarded, motives forever in shadow.",
    backstory:
      "A brilliant, bitter master whose muttering in the stands makes Harry certain he is the one jinxing the broom, until the truth turns out stranger.",
    media: `${WIKI}/thumb/f/fe/Alan_Rickman_after_Seminar_%283%29.jpg/960px-Alan_Rickman_after_Seminar_%283%29.jpg`,
  },
  {
    name: "Albus Dumbledore",
    role: "Headmaster, the quiet approver",
    age: 110,
    description:
      "Half-moon spectacles and a sweeping silver beard, applauding from the top box as if he had expected this all along.",
    personality: "Twinkling, unhurried, several moves ahead of everyone.",
    backstory:
      "The greatest wizard of the age, who signs off on an eleven-year-old Seeker with nothing more than a nod and a smile.",
    media: `${WIKI}/thumb/d/d1/Michael_Gambon_on_the_set_of_Harry_Potter_and_the_Half_Blood_Prince.png/960px-Michael_Gambon_on_the_set_of_Harry_Potter_and_the_Half_Blood_Prince.png`,
  },
];

export type HpScene = {
  title: string;
  concise_plot: string;
  detailed_plot: string;
  dialogue: string;
  media: string;
  // Per-scene shot stills, curated so each shot reflects THIS scene's content
  // (courtyard and brooms for the lesson, castle interiors for the selection,
  // pitch imagery for the match) instead of a shared rotating pool.
  shots: string[];
};

export const HP_SCENES: HpScene[] = [
  {
    title: "The First Flying Lesson",
    concise_plot: "Harry mounts a school broom for the first time and simply lifts off.",
    detailed_plot:
      "Two rows of battered school brooms lie in a windy courtyard. On the whistle most first-years wobble a foot off the flagstones - Harry rises clean, steady and grinning, then pulls into a dive to catch a classmate's dropped Remembrall inches from the ground.",
    dialogue:
      'HOOCH: "On my whistle. Three, two-"\nHARRY: "I’ve never even been on one."\nHERMIONE: "Then how are you doing that?"',
    media: `${WIKI}/thumb/b/b8/Tom_Quad%2C_Christ_Church%2C_Oxford.jpg/960px-Tom_Quad%2C_Christ_Church%2C_Oxford.jpg`,
    shots: [
      `${WIKI}/thumb/b/b8/Tom_Quad%2C_Christ_Church%2C_Oxford.jpg/960px-Tom_Quad%2C_Christ_Church%2C_Oxford.jpg`,
      `${WIKI}/thumb/c/c3/The_Making_of_Harry_Potter_29-05-2012_%28Broomsticks%29.jpg/960px-The_Making_of_Harry_Potter_29-05-2012_%28Broomsticks%29.jpg`,
      `${WIKI}/thumb/2/29/Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg/960px-Lacock_Abbey_from_south%2C_Wiltshire%2C_UK_-_Diliff.jpg`,
    ],
  },
  {
    title: "The Youngest Seeker",
    concise_plot: "McGonagall names Harry Seeker; Hermione teaches him the game.",
    detailed_plot:
      "Expecting expulsion, Harry is marched instead to the Gryffindor team and handed a Nimbus. In the Great Hall Hermione reads him the rules aloud - four balls, seven players, one Snitch worth everything - while Snape watches the new favourite from the staff table and Dumbledore says nothing at all.",
    dialogue:
      'McGONAGALL: "Potter, you will be our Seeker. Youngest in a century."\nHERMIONE: "The Snitch is worth a hundred and fifty points. Catch it and the match ends."\nSNAPE: "How fortunate. A first-year."',
    media: `${WIKI}/thumb/b/bb/Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg/960px-Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg`,
    shots: [
      `${WIKI}/thumb/b/bb/Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg/960px-Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg`,
      `${WIKI}/thumb/a/a1/Alnwick_Castle_in_uk.jpg/960px-Alnwick_Castle_in_uk.jpg`,
      `${WIKI}/thumb/d/d6/Durham_MMB_02_Cathedral.jpg/960px-Durham_MMB_02_Cathedral.jpg`,
    ],
  },
  {
    title: "His First Match",
    concise_plot: "Harry plays quidditch for the first time and catches the Snitch.",
    detailed_plot:
      "Scarlet and green streak around the hoops as the whole school roars. Harry's broom bucks and tries to throw him; he hangs on one-handed, remounts, then drops into a dive through the middle of the match and pulls up with the Golden Snitch shut inside his fist.",
    dialogue:
      'HERMIONE: "Someone’s jinxing that broom!"\nMcGONAGALL: "He’s going to- he’s got it. He’s got the Snitch!"\nDUMBLEDORE: "Well flown, Mr Potter."',
    media: `${WIKI}/thumb/d/d9/Quidditch_pitch.jpg/960px-Quidditch_pitch.jpg`,
    shots: [
      `${WIKI}/thumb/d/d9/Quidditch_pitch.jpg/960px-Quidditch_pitch.jpg`,
      `${WIKI}/thumb/7/71/Muggle_Quidditch_Game_in_Vancouver.jpg/960px-Muggle_Quidditch_Game_in_Vancouver.jpg`,
      `${WIKI}/thumb/8/87/Quidditch_team_cosplay_at_Hynes_Convention_Center%2C_Boston%2C_2010.jpg/960px-Quidditch_team_cosplay_at_Hynes_Convention_Center%2C_Boston%2C_2010.jpg`,
    ],
  },
];

// Pool of real quidditch/location stills assigned across the generated shots.
export const HP_SHOT_STILLS: string[] = [
  `${WIKI}/thumb/d/d9/Quidditch_pitch.jpg/960px-Quidditch_pitch.jpg`,
  `${WIKI}/thumb/7/71/Muggle_Quidditch_Game_in_Vancouver.jpg/960px-Muggle_Quidditch_Game_in_Vancouver.jpg`,
  `${WIKI}/thumb/8/87/Quidditch_team_cosplay_at_Hynes_Convention_Center%2C_Boston%2C_2010.jpg/960px-Quidditch_team_cosplay_at_Hynes_Convention_Center%2C_Boston%2C_2010.jpg`,
  `${WIKI}/thumb/c/c3/The_Making_of_Harry_Potter_29-05-2012_%28Broomsticks%29.jpg/960px-The_Making_of_Harry_Potter_29-05-2012_%28Broomsticks%29.jpg`,
  `${WIKI}/thumb/b/b8/Tom_Quad%2C_Christ_Church%2C_Oxford.jpg/960px-Tom_Quad%2C_Christ_Church%2C_Oxford.jpg`,
  `${WIKI}/thumb/a/a1/Alnwick_Castle_in_uk.jpg/960px-Alnwick_Castle_in_uk.jpg`,
  `${WIKI}/thumb/b/bb/Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg/960px-Hogwart%E2%80%98s_Great_Hall%2C_Warner_Bros_Harry_Potter_Studio%2C_London_03.jpg`,
];

export function hpCharacterByName(name?: string): HpCharacter | undefined {
  if (!name) return undefined;
  const q = name.trim().toLowerCase();
  return (
    HP_CHARACTERS.find((c) => c.name.toLowerCase() === q) ||
    HP_CHARACTERS.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
  );
}
