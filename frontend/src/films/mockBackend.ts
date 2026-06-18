// In-memory mock of the AI Film Studio API (see utils/api.ts). Enabled when the
// real backend is unreachable or NEXT_PUBLIC_MOCK=1. State evolves over short
// timers: a new film becomes a concept, cast, scenes, shots, then a final film.

import {
  HP_PLOT_POINTS,
  HP_DIRECTOR_REPLY,
  HP_CHARACTERS,
  HP_SCENES,
  HP_SHOT_STILLS,
  HP_CLIP_VIDEO,
  HP_FINAL_VIDEO,
  HP_POSTER,
  hpCharacterByName,
} from "./harry-potter";

let enabled = false;
export function setMockEnabled(v: boolean) {
  enabled = v;
  if (v && typeof console !== "undefined") {
    console.info("[mock] offline mock backend enabled");
  }
}
export function isMockEnabled() {
  return enabled;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const nowISO = () => new Date().toISOString();

const unsplash = (id: string, w = 800, h = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

const PORTRAITS = [11, 12, 13, 15, 32, 48, 5, 60, 68, 24, 51, 33];
const portraitFor = (i: number) =>
  `https://i.pravatar.cc/512?img=${PORTRAITS[i % PORTRAITS.length]}`;

const SCENE_STILLS = [
  "1598105014233-04a936265c46",
  "1618325508550-951512a1e82d",
  "1465929639680-64ee080eb3ed",
  "1586810147108-a23b62f9b396",
  "1518709268805-4e9042af9f23",
  "1470071459604-3b5ec3a7fe05",
  "1441974231531-c6227db76b6e",
  "1505228395891-9a51e7e86bf6",
];
const sceneStill = (i: number, w = 960, h = 600) =>
  unsplash(SCENE_STILLS[i % SCENE_STILLS.length], w, h);

class MockError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.status = status;
  }
}

type Character = {
  id: string;
  project_id: string;
  media_url?: string;
  loading?: boolean;
  metadata: {
    name: string;
    role: string;
    age: number;
    description: string;
    personality: string;
    backstory: string;
  };
  created_at: string;
  updated_at: string;
};
type Scene = {
  id: string;
  project_id: string;
  media_url?: string;
  loading?: boolean;
  metadata: {
    scene_order: number;
    concise_plot: string;
    detailed_plot: string;
    dialogue: string;
  };
  created_at: string;
  updated_at: string;
};
type Frame = {
  id: string;
  project_id: string;
  scene_id: string;
  media_url?: string;
  video_url?: string;
  metadata: {
    frame_order: number;
    scene_order: number;
    concise_plot: string;
    summary: string;
    veo3_prompt: string;
    dialogue: string;
    duration: number;
  };
  created_at: string;
  updated_at: string;
};
type Project = {
  id: string;
  title: string;
  summary: string;
  plot: string;
  final_video_url?: string;
  poster_url?: string;
  created_at: string;
  updated_at: string;
};
type ConvMessage = {
  id: string;
  user_query: string;
  director_response: string;
  timestamp: string;
};
type Store = {
  project: Project;
  characters: Character[];
  scenes: Scene[];
  frames: Frame[];
  messages: ConvMessage[];
  sceneCount: number;
  shotSeq: number;
};
type Job = {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  output_data?: Record<string, unknown>;
  error_message?: string;
  updated_at: string;
};

const projects = new Map<string, Store>();
const jobs = new Map<string, Job>();

function ensureStore(id: string): Store {
  let s = projects.get(id);
  if (!s) {
    s = {
      project: {
        id,
        title: "Untitled film",
        summary: "",
        plot: "",
        created_at: nowISO(),
        updated_at: nowISO(),
      },
      characters: [],
      scenes: [],
      frames: [],
      messages: [],
      sceneCount: 0,
      shotSeq: 0,
    };
    projects.set(id, s);
  }
  return s;
}

// Hardcoded "prompt -> film" demo: whatever the user types, the director shapes
// it into Harry Potter and the Philosopher's Stone so the full flow can play
// without any API keys. (Swap this fixture out once real generation is wired.)
function makeConverseResponse(store: Store, _message: string) {
  const plot_points = HP_PLOT_POINTS;
  const characters = HP_CHARACTERS.map((c) => ({
    name: c.name,
    role: c.role,
    age: c.age,
    description: c.description,
    personality: c.personality,
    backstory: c.backstory,
  }));
  const response = HP_DIRECTOR_REPLY;
  store.project.plot =
    `Plot:\n${plot_points.join("\n\n")}\n\nCharacters:\n` +
    characters.map((c) => `${c.name} (${c.role}): ${c.description}`).join("\n");
  store.project.summary = plot_points[0];
  store.project.updated_at = nowISO();
  return { response, plot_points, characters };
}

// `completeInMs` lets callers stagger when a job finishes so the canvas reveals
// content as a gentle cascade (cast, then scenes, then shots) instead of all at
// once. Defaults to a short randomized delay.
function startJob(
  type: string,
  onComplete: () => void,
  completeInMs?: number
): string {
  const id = uid();
  const job: Job = {
    id,
    type,
    status: "pending",
    progress: 0,
    updated_at: nowISO(),
  };
  jobs.set(id, job);
  setTimeout(() => {
    job.status = "processing";
    job.progress = 45;
    job.updated_at = nowISO();
  }, 400);
  setTimeout(() => {
    try {
      onComplete();
    } catch (e) {
      console.error("[mock] job side-effect failed", e);
    }
    job.status = "completed";
    job.progress = 100;
    job.updated_at = nowISO();
  }, completeInMs ?? 1500 + Math.random() * 1200);
  return id;
}

function spawnFramesForScene(store: Store, scene: Scene, count: number) {
  // Pull shot stills from THIS scene's curated pool so each shot matches the
  // scene (train shots under the Express, cloister shots under the corridor),
  // rather than a global rotating pool that mixed unrelated locations.
  const hp = HP_SCENES[(scene.metadata.scene_order - 1) % HP_SCENES.length];
  const pool = hp?.shots?.length ? hp.shots : HP_SHOT_STILLS;
  for (let i = 0; i < count; i++) {
    const id = uid();
    store.shotSeq += 1;
    const shot = pool[i % pool.length];
    const frame: Frame = {
      id,
      project_id: store.project.id,
      scene_id: scene.id,
      media_url: shot,
      video_url: "",
      metadata: {
        frame_order: i,
        scene_order: scene.metadata.scene_order,
        concise_plot: `Shot ${i + 1} · ${scene.metadata.concise_plot}`,
        summary: `${scene.metadata.concise_plot} (beat ${i + 1})`,
        veo3_prompt: `Cinematic 8s shot: ${scene.metadata.detailed_plot}. Beat ${i + 1}.`,
        dialogue: "",
        duration: 8,
      },
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    store.frames.push(frame);
    // Auto-generate the clip shortly after so the pipeline reaches completion
    // without manual triggering — staggered per shot so they fill in one by one.
    setTimeout(() => {
      frame.video_url = HP_CLIP_VIDEO;
      frame.updated_at = nowISO();
    }, 1400 + i * 600 + Math.random() * 400);
  }
}

function getComplete(id: string) {
  const s = ensureStore(id);
  const hasChars = s.characters.length > 0;
  const hasScenes = s.scenes.length > 0;
  const allVideos =
    s.frames.length > 0 && s.frames.every((f) => !!f.video_url);
  let completion_status = "initializing";
  if (hasChars && !hasScenes) completion_status = "scripting";
  else if (hasScenes && !allVideos) completion_status = "generating";
  else if (allVideos && hasScenes) completion_status = "complete";
  return {
    scenes: s.scenes,
    characters: s.characters,
    objects: [],
    frames: s.frames,
    completion_status,
  };
}

function projectIdFromConversation(convId: string) {
  return convId.startsWith("project_") ? convId.slice("project_".length) : convId;
}

export async function handleMock(
  method: string,
  endpoint: string,
  body: any
): Promise<any> {
  const path = endpoint.split("?")[0];
  let m: RegExpMatchArray | null;

  if (method === "POST" && path === "/api/projects") {
    const id = uid();
    const s = ensureStore(id);
    s.project = {
      id,
      title: body?.title || "Untitled film",
      summary: body?.summary || "",
      plot: body?.plot || "",
      // No poster until the film is actually finished (set on stitching) so a
      // brand-new film never shows a stale/seeded thumbnail.
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    return { ...s.project };
  }
  if (method === "GET" && (m = path.match(/^\/api\/projects\/([^/]+)\/complete$/))) {
    return getComplete(m[1]);
  }
  if (method === "GET" && (m = path.match(/^\/api\/projects\/([^/]+)\/characters$/))) {
    return ensureStore(m[1]).characters;
  }
  if (method === "GET" && (m = path.match(/^\/api\/projects\/([^/]+)\/scenes$/))) {
    return ensureStore(m[1]).scenes;
  }
  if (method === "POST" && (m = path.match(/^\/api\/projects\/([^/]+)\/confirm-video$/))) {
    const s = ensureStore(m[1]);
    const job_id = startJob("video-stitching", () => {
      s.project.final_video_url = HP_FINAL_VIDEO;
      s.project.poster_url = HP_POSTER;
      s.project.updated_at = nowISO();
    });
    return { message: "Video assembly started", job_id };
  }
  if (method === "GET" && (m = path.match(/^\/api\/projects\/([^/]+)$/))) {
    const s = ensureStore(m[1]);
    return { ...s.project };
  }
  if (method === "PATCH" && (m = path.match(/^\/api\/projects\/([^/]+)$/))) {
    const s = ensureStore(m[1]);
    s.project = { ...s.project, ...(body || {}), updated_at: nowISO() };
    return { ...s.project };
  }
  if (
    method === "PUT" &&
    (m = path.match(/^\/api\/projects\/([^/]+)\/(characters|scenes|frames|objects)\/([^/]+)$/))
  ) {
    const s = ensureStore(m[1]);
    const kind = m[2];
    const entId = m[3];
    const list: any[] =
      kind === "characters" ? s.characters : kind === "scenes" ? s.scenes : s.frames;
    const ent = list.find((e) => e.id === entId);
    if (ent) ent.metadata = { ...ent.metadata, ...(body || {}) };
    return { success: true };
  }

  if (method === "POST" && path === "/api/director/converse") {
    const s = ensureStore(body.project_id);
    const { response, plot_points, characters } = makeConverseResponse(
      s,
      body.message || ""
    );
    s.messages.push({
      id: uid(),
      user_query: body.message || "",
      director_response: "",
      timestamp: nowISO(),
    });
    s.messages.push({
      id: uid(),
      user_query: "",
      director_response: response,
      timestamp: nowISO(),
    });
    return {
      response,
      plot_points,
      characters,
      is_complete: true,
      next_step: "Generate the cast",
      context_id: `project_${body.project_id}`,
    };
  }
  if (
    method === "GET" &&
    (m = path.match(/^\/api\/director\/conversations\/([^/]+)\/messages$/))
  ) {
    const s = ensureStore(projectIdFromConversation(m[1]));
    return { conversation_id: m[1], messages: s.messages };
  }
  if (method === "GET" && (m = path.match(/^\/api\/director\/conversations\/([^/]+)$/))) {
    const s = ensureStore(projectIdFromConversation(m[1]));
    return {
      conversation_id: m[1],
      user_concept: "",
      director_response: "",
      suggested_questions: [],
      character_suggestions: [],
      plot_outline: s.project.plot,
      next_step: "Continue",
      session_state: "active",
      created_at: nowISO(),
      updated_at: nowISO(),
      project_id: s.project.id,
    };
  }

  if (method === "POST" && path === "/api/jobs/character-generation") {
    const s = ensureStore(body.project_id);
    const ctx = body.context || {};
    const name = ctx.name || body.name || "Character";
    // The director only forwards name/role/description, so the mock owns the
    // rich HP metadata + the real portrait (matched by name).
    const hp = hpCharacterByName(name);
    const id = uid();
    const portraitIndex = s.characters.length;
    s.characters.push({
      id,
      project_id: s.project.id,
      media_url: "",
      loading: true,
      metadata: {
        name,
        role: hp?.role || ctx.role || "Supporting",
        age: hp?.age ?? (typeof ctx.age === "number" && ctx.age > 0 ? ctx.age : 30),
        description: hp?.description || ctx.description || body.prompt || "A key character.",
        personality: hp?.personality || ctx.personality || "Distinct and memorable.",
        backstory: hp?.backstory || ctx.backstory || "Has a history that informs their choices.",
      },
      created_at: nowISO(),
      updated_at: nowISO(),
    });
    const portrait = hp?.media || portraitFor(portraitIndex);
    // Stagger the cast so portraits resolve one after another.
    const job_id = startJob(
      "character-generation",
      () => {
        const c = s.characters.find((x) => x.id === id);
        if (c) {
          c.media_url = portrait;
          c.loading = false;
          c.updated_at = nowISO();
        }
      },
      1100 + portraitIndex * 450 + Math.random() * 250
    );
    return { job_id };
  }
  if (method === "POST" && path === "/api/jobs/scene-generation") {
    const s = ensureStore(body.project_id);
    const order = body.scene_order || s.sceneCount + 1;
    s.sceneCount = Math.max(s.sceneCount, order);
    const frames = body.target_frames || 2;
    const hp = HP_SCENES[(order - 1) % HP_SCENES.length];
    const id = uid();
    const scene: Scene = {
      id,
      project_id: s.project.id,
      media_url: "",
      loading: true,
      metadata: {
        scene_order: order,
        concise_plot: hp?.title || body.scene_description || `Scene ${order}`,
        detailed_plot:
          hp?.detailed_plot || body.plot_context || `Scene ${order} unfolds.`,
        dialogue: hp?.dialogue || "",
      },
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    s.scenes.push(scene);
    // Scenes resolve after the cast has come in, then fan out into their shots.
    const job_id = startJob(
      "scene-generation",
      () => {
        scene.media_url = hp?.media || sceneStill(order - 1);
        scene.loading = false;
        scene.updated_at = nowISO();
        spawnFramesForScene(s, scene, frames);
      },
      2800 + (order - 1) * 850 + Math.random() * 300
    );
    return { job_id };
  }
  if (method === "POST" && path === "/api/jobs/script-enhancement") {
    const s = ensureStore(body.project_id);
    const enhanced_plot =
      (body.base_plot || s.project.plot || "A film in development.") +
      "\n\n(Enhanced: tighter pacing, clearer character motivation, three-act structure.)";
    const enhanced_summary =
      s.project.summary || "An enhanced short film ready for production.";
    s.project.plot = enhanced_plot;
    s.project.summary = enhanced_summary;
    s.project.updated_at = nowISO();
    return { success: true, enhanced_plot, enhanced_summary };
  }
  if (method === "POST" && path === "/api/jobs/video-generation") {
    const s = ensureStore(body.project_id);
    const frameId = body?.metadata?.frame_id;
    const job_id = startJob("video-generation", () => {
      const frame = s.frames.find((f) => f.id === frameId);
      if (frame) {
        frame.video_url = HP_CLIP_VIDEO;
        frame.updated_at = nowISO();
      }
    });
    return { job_id };
  }
  if (method === "POST" && path === "/api/jobs/image-editing") {
    const s = ensureStore(body.project_id);
    const src = body.source_url;
    const job_id = startJob("image-editing", () => {
      const rnd = Math.floor(Math.random() * 1000);
      const char = s.characters.find((c) => c.media_url === src);
      if (char) {
        char.media_url = portraitFor(rnd);
        return;
      }
      const scene = s.scenes.find((sc) => sc.media_url === src);
      if (scene) {
        scene.media_url = sceneStill(rnd);
        return;
      }
      const frame = s.frames.find((f) => f.media_url === src);
      if (frame) frame.media_url = sceneStill(rnd);
    });
    return { job_id };
  }
  if (method === "POST" && path === "/api/jobs/video-stitching") {
    const s = ensureStore(body.project_id);
    const job_id = startJob("video-stitching", () => {
      s.project.final_video_url = HP_FINAL_VIDEO;
      s.project.poster_url = HP_POSTER;
      s.project.updated_at = nowISO();
    });
    return { job_id };
  }
  if (method === "GET" && (m = path.match(/^\/api\/jobs\/([^/]+)\/status$/))) {
    const job = jobs.get(m[1]);
    if (!job) return { status: "completed", progress: 100, updated_at: nowISO() };
    return {
      status: job.status,
      progress: job.progress,
      updated_at: job.updated_at,
      output_data: job.output_data,
      error_message: job.error_message,
    };
  }
  if (method === "DELETE" && path.match(/^\/api\/jobs\/[^/]+$/)) {
    return { message: "Job cancelled" };
  }
  if (method === "GET" && path === "/api/queues/status") {
    return [];
  }

  throw new MockError(`Mock: no handler for ${method} ${path}`, 404);
}
