export type WorkerData = {
  id: 'director' | 'writer' | 'casting';
  name: string;
  role: string;
  icon: string;
  accent: string;
  glow: string;
  hex: string;
  glowHex: string;
  room: string;
  roomImg: string;
  pageId: string;
  slate: string;
  title: string;
  intro: string;
  placeholder: string;
  cta: string;
  ctaIcon: string;
  meta: string;
  map: { top: number; left: number };
};

export const CREW: WorkerData[] = [
  {
    id: 'writer',
    name: 'Otto',
    role: 'Script Writer',
    icon: 'headphones',
    accent: 'var(--writer)',
    glow: 'var(--writer-glow)',
    hex: '#27cbe0',
    glowHex: '#7ce4f1',
    room: 'Writers\' Room',
    roomImg: '/background/background1.png',
    pageId: 'character_2',
    slate: 'STAGE 02 · STORY DEPT',
    title: 'Script Enhancement',
    intro: 'Hand me a rough plot and I\'ll shape it — pacing, character beats, and a clean three-act spine ready to shoot.',
    placeholder: 'Drop your plot outline. I\'ll enhance pacing, character development, and cinematic structure…',
    cta: 'Enhance Script',
    ctaIcon: 'wand',
    meta: 'Target · 3 scenes (3-2-3 frame structure)',
    map: { top: 52, left: 21 },
  },
  {
    id: 'casting',
    name: 'Remy',
    role: 'Visual Designer',
    icon: 'image',
    accent: 'var(--casting)',
    glow: 'var(--casting-glow)',
    hex: '#ff4d8d',
    glowHex: '#ff8fb6',
    room: 'Edit Bay',
    roomImg: '/background/background2.png',
    pageId: 'character_3',
    slate: 'STAGE 03 · VISUAL',
    title: 'Visual Designer',
    intro: 'Hand me a character or a scene and I\'ll design the look — wardrobe, palette, and consistent art rendered frame to frame.',
    placeholder: 'e.g. A weathered lighthouse keeper, late 60s, wool coat, salt-and-pepper beard, kind eyes…',
    cta: 'Generate',
    ctaIcon: 'sparkles',
    meta: 'Renders characters & scene art',
    map: { top: 34, left: 49 },
  },
  {
    id: 'director',
    name: 'Vera',
    role: 'Director',
    icon: 'megaphone',
    accent: 'var(--director)',
    glow: 'var(--director-glow)',
    hex: '#ffb23e',
    glowHex: '#ffce7a',
    room: 'Soundstage A',
    roomImg: '/background/background3.png',
    pageId: 'character_4',
    slate: 'STAGE 01 · DIRECTION',
    title: 'AI Director',
    intro: 'Tell me your film idea and I\'ll run the floor — breaking story into scenes and characters, then calling the shots.',
    placeholder: 'e.g. A sci-fi thriller about a deep-space salvage crew that wakes something in the cargo hold…',
    cta: 'Call Action',
    ctaIcon: 'clap',
    meta: 'Orchestrates writer, casting & shots',
    map: { top: 47, left: 77 },
  },
];

export const CREW_BY_PAGE: Record<string, WorkerData> = {
  character_2: CREW[0],
  character_3: CREW[1],
  character_4: CREW[2],
};
