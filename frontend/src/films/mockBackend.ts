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
import type { AgentApproval, AgentEvent, AgentRun } from "@/types/agent";

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
const agentRuns = new Map<string, AgentRun>();
const agentEvents = new Map<string, AgentEvent[]>();
const agentListeners = new Map<string, Set<(event: AgentEvent) => void>>();

function emitAgent(runId: string, type: string, data: Record<string, unknown>) {
  const events = agentEvents.get(runId) || [];
  const event: AgentEvent = {
    id: events.length + 1,
    run_id: runId,
    type,
    timestamp: nowISO(),
    data,
  };
  events.push(event);
  agentEvents.set(runId, events);
  const run = agentRuns.get(runId);
  if (run) {
    run.last_event_id = event.id;
    run.updated_at = event.timestamp;
    if (type === "run.status") {
      if (data.status) run.status = data.status as AgentRun["status"];
      if (data.phase) run.phase = data.phase as AgentRun["phase"];
    }
    if (type === "message.delta") run.assistant_text += String(data.delta || "");
    if (type === "approval.requested") run.approval = data as unknown as AgentRun["approval"];
    if (type === "run.completed") run.status = "completed";
    if (type === "run.cancelled") run.status = "cancelled";
  }
  agentListeners.get(runId)?.forEach((listener) => listener(event));
}

export function subscribeMockAgentRun(
  runId: string,
  afterId: number,
  callbacks: {
    onEvent: (event: AgentEvent) => void;
    onOpen?: () => void;
    onError?: (message: string) => void;
  }
) {
  const listeners = agentListeners.get(runId) || new Set();
  const listener = (event: AgentEvent) => callbacks.onEvent(event);
  listeners.add(listener);
  agentListeners.set(runId, listeners);
  queueMicrotask(() => {
    callbacks.onOpen?.();
    for (const event of agentEvents.get(runId) || []) {
      if (event.id > afterId) callbacks.onEvent(event);
    }
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) agentListeners.delete(runId);
  };
}

function mockTitle(prompt: string) {
  const subject = prompt
    .replace(/^(create|make|develop|produce)\s+(a\s+)?(cinematic\s+)?(\d+-second\s+)?/i, "")
    .replace(/^film\s+(about|where)\s+/i, "")
    .replace(/^.*?\babout\s+/i, "")
    .split(/[.!?]/)[0]
    .trim();
  const words = (subject || "an original short film").split(/\s+/).slice(0, 7);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function mockCharacters(prompt: string) {
  const premise = prompt || "an original cinematic story";
  return [
    { name: "The Lead", role: "Protagonist", age: 32, description: `The emotional point of view for ${premise}`, personality: "Observant, driven, and quietly vulnerable", backstory: "Carries a personal stake in the central mystery." },
    { name: "The Counterpart", role: "Catalyst", age: 38, description: "The figure who challenges the protagonist's understanding of events.", personality: "Precise, guarded, and persuasive", backstory: "Knows more about the inciting event than they initially reveal." },
    { name: "The Witness", role: "Supporting", age: 55, description: "A grounded witness who connects the present conflict to its hidden history.", personality: "Patient, perceptive, and morally conflicted", backstory: "Preserved one crucial detail everyone else overlooked." },
  ];
}

function createMockConceptApproval(prompt: string): AgentApproval {
  const premise = prompt || "Create an original cinematic short film.";
  const values = {
    title: mockTitle(premise),
    logline: premise,
    summary: premise,
    story_direction: `${premise}\n\nBuild a clear discovery, confrontation, and decisive final image across eight shots.`,
    visual_style: "Cinematic realism with expressive contrast and deliberate camera movement",
    audio_direction: "Atmospheric score, focused dialogue, and tactile environmental sound",
    runtime_seconds: 64,
    aspect_ratio: "16:9",
    shot_seconds: 8,
    characters: mockCharacters(premise),
  };
  return {
    id: uid(),
    kind: "concept" as const,
    title: "Approve the concept and cast",
    description: "Confirm the creative direction before Stu3dio plans the shots.",
    status: "pending" as const,
    fields: [
      { id: "title", label: "Title", type: "text" },
      { id: "story_direction", label: "Story direction", type: "textarea" },
      { id: "visual_style", label: "Visual style", type: "text" },
      { id: "runtime_seconds", label: "Runtime", type: "single-select", options: [24, 64, 96] },
      { id: "aspect_ratio", label: "Aspect ratio", type: "single-select", options: ["16:9", "9:16", "1:1"] },
      { id: "characters", label: "Cast", type: "summary-list" },
    ],
    values,
    created_at: nowISO(),
  };
}

function createMockProductionApproval(prompt: string): AgentApproval {
  const counts = [3, 2, 3];
  const beats = [
    { title: "The Inciting Discovery", detail: `Establish the world and the protagonist's immediate stake in this premise: ${prompt}` },
    { title: "The Truth Surfaces", detail: "Escalate the central contradiction, reveal the hidden connection, and force the protagonist to act." },
    { title: "The Final Choice", detail: "Resolve the confrontation through a visual decision, then land on a memorable cinematic final image." },
  ];
  const scenes = beats.map((scene, index) => ({
    id: `scene-${index + 1}`,
    scene_order: index + 1,
    title: scene.title,
    concise_plot: scene.title,
    detailed_plot: scene.detail,
    dialogue: "",
    target_frames: counts[index],
    duration: (counts[index] || 1) * 8,
  }));
  const values = { overview: "A three-act progression told across eight cinematic shots.", scenes };
  return {
    id: uid(),
    kind: "production_plan" as const,
    title: "Approve the scene and shot plan",
    description: "Media generation starts only after this plan is approved.",
    status: "pending" as const,
    fields: [{ id: "scenes", label: "Scenes", type: "scene-plan" }],
    values,
    created_at: nowISO(),
  };
}

function materializeMockProduction(run: AgentRun) {
  const store = ensureStore(run.project_id);
  const conceptCharacters = Array.isArray(run.concept?.characters)
    ? run.concept.characters as Array<Record<string, unknown>>
    : mockCharacters(run.prompt);
  const plannedScenes = Array.isArray(run.production_plan?.scenes)
    ? run.production_plan.scenes as Array<Record<string, unknown>>
    : createMockProductionApproval(run.prompt).values.scenes as Array<Record<string, unknown>>;
  emitAgent(run.id, "run.status", { status: "running", phase: "assets" });
  emitAgent(run.id, "activity.started", { id: "mock-assets", label: "Creating consistent character references", phase: "assets" });
  conceptCharacters.forEach((character, index) => {
    const name = String(character.name || `Character ${index + 1}`);
    const taskId = uid();
    const task = { id: taskId, label: `Design ${name}`, phase: "assets", job_type: "character-generation", status: "completed", progress: 100 };
    run.tasks.push(task as any);
    emitAgent(run.id, "task.completed", task);
    if (!store.characters.some((item) => item.metadata.name === name)) {
      store.characters.push({
        id: uid(), project_id: store.project.id, media_url: portraitFor(index),
        metadata: {
          name,
          role: String(character.role || "Supporting"),
          age: Number(character.age || 30),
          description: String(character.description || "A key character in the approved story."),
          personality: String(character.personality || "Distinct and memorable"),
          backstory: String(character.backstory || "Their history informs the current conflict."),
        },
        created_at: nowISO(), updated_at: nowISO()
      });
    }
  });
  emitAgent(run.id, "activity.completed", { id: "mock-assets", label: `${store.characters.length} character references ready`, phase: "assets" });

  setTimeout(() => {
    emitAgent(run.id, "run.status", { status: "running", phase: "videos" });
    emitAgent(run.id, "activity.started", { id: "mock-video", label: "Rendering eight cinematic clips", phase: "videos" });
    if (!store.scenes.length) {
      plannedScenes.slice(0, 3).forEach((source, index) => {
        const scene: Scene = {
          id: uid(), project_id: store.project.id, media_url: sceneStill(index),
          metadata: {
            scene_order: Number(source.scene_order || index + 1),
            concise_plot: String(source.title || source.concise_plot || `Scene ${index + 1}`),
            detailed_plot: String(source.detailed_plot || source.concise_plot || run.prompt),
            dialogue: String(source.dialogue || ""),
          },
          created_at: nowISO(), updated_at: nowISO()
        };
        store.scenes.push(scene);
        spawnFramesForScene(store, scene, Number(source.target_frames || [3, 2, 3][index] || 1));
      });
    }
    const task = { id: "video-batch", label: "Render video clips", phase: "videos", job_type: "video-generation", status: "running", progress: 62, completed: 5, total: 8 };
    emitAgent(run.id, "task.progress", task);
  }, 550);

  setTimeout(() => {
    for (const frame of store.frames) frame.video_url = HP_CLIP_VIDEO;
    emitAgent(run.id, "task.progress", { id: "video-batch", label: "Render video clips", phase: "videos", job_type: "video-generation", status: "completed", progress: 100, completed: 8, total: 8 });
    emitAgent(run.id, "activity.completed", { id: "mock-video", label: "8 clips ready for assembly", phase: "videos" });
    emitAgent(run.id, "insight.created", { id: uid(), title: "Production ready", metrics: [{ label: "Scenes", value: 3 }, { label: "Clips", value: 8 }, { label: "Runtime", value: "64s" }, { label: "Audio", value: "Generated" }] });
    const approval = {
      id: uid(), kind: "assembly" as const, title: "Assemble the final film?",
      description: "8 clips are ready. Stu3dio will join them into a 64-second cut.",
      status: "pending" as const, fields: [], values: { clips: 8, runtime_seconds: 64, aspect_ratio: "16:9", audio: "generated" }, created_at: nowISO()
    };
    run.approval = approval;
    run.status = "awaiting_approval";
    run.phase = "assembly";
    emitAgent(run.id, "approval.requested", approval as unknown as Record<string, unknown>);
    emitAgent(run.id, "run.status", { status: "awaiting_approval", phase: "assembly" });
  }, 2_300);
}

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

  if (method === "POST" && (m = path.match(/^\/api\/projects\/([^/]+)\/agent-attachments$/))) {
    const file = body?.file as File | undefined;
    if (!file) throw new MockError("Choose an image to attach", 400);
    return {
      id: uid(),
      name: file.name,
      url: typeof URL !== "undefined" ? URL.createObjectURL(file) : `mock://agent-reference/${encodeURIComponent(file.name)}`,
      mime_type: file.type,
      size: file.size,
    };
  }

  if (method === "POST" && (m = path.match(/^\/api\/projects\/([^/]+)\/agent-runs$/))) {
    const projectId = m[1];
    const runId = uid();
    const timestamp = nowISO();
    const run: AgentRun = {
      id: runId,
      project_id: projectId,
      kind: body?.kind || "create-film",
      prompt: body?.prompt || "",
      status: "queued",
      phase: "concept",
      settings: { runtime_seconds: 64, aspect_ratio: "16:9", shot_seconds: 8, ...(body?.settings || {}) },
      context: body?.context || {},
      tasks: [],
      artifacts: [],
      assistant_text: "",
      created_at: timestamp,
      updated_at: timestamp,
      last_event_id: 0,
    };
    agentRuns.set(runId, run);
    agentEvents.set(runId, []);
    emitAgent(runId, "message.completed", { id: uid(), role: "user", content: run.prompt });
    emitAgent(runId, "run.status", { status: "queued", phase: "concept" });
    setTimeout(() => {
      emitAgent(runId, "run.status", { status: "thinking", phase: "concept" });
      emitAgent(runId, "activity.started", { id: "mock-concept", label: "Structuring the story", phase: "concept" });
      emitAgent(runId, "message.started", { id: "mock-director", role: "assistant" });
      const chunks = [
        "I’m shaping this into a focused 64-second short with a clear visual arc. ",
        "The cast, tone, and production constraints are ready for your review before any media is generated."
      ];
      chunks.forEach((chunk, index) => setTimeout(() => emitAgent(runId, "message.delta", { id: "mock-director", role: "assistant", delta: chunk }), 180 * (index + 1)));
      setTimeout(() => {
        emitAgent(runId, "message.completed", { id: "mock-director", role: "assistant", content: chunks.join("") });
        emitAgent(runId, "activity.completed", { id: "mock-concept", label: "Concept and cast brief ready", phase: "concept" });
        const approval = createMockConceptApproval(run.prompt);
        run.concept = approval.values;
        run.approval = approval;
        run.status = "awaiting_approval";
        emitAgent(runId, "context.updated", { project: { id: projectId, title: ensureStore(projectId).project.title }, inheritance: ["project summary", "project plot"] });
        emitAgent(runId, "approval.requested", approval as unknown as Record<string, unknown>);
        emitAgent(runId, "run.status", { status: "awaiting_approval", phase: "concept" });
      }, 650);
    }, 120);
    return run;
  }
  if (method === "GET" && (m = path.match(/^\/api\/agent-runs\/([^/]+)$/))) {
    const run = agentRuns.get(m[1]);
    if (!run) throw new MockError("Agent run not found");
    return { ...run };
  }
  if (method === "POST" && (m = path.match(/^\/api\/agent-runs\/([^/]+)\/approvals\/([^/]+)$/))) {
    const run = agentRuns.get(m[1]);
    if (!run || !run.approval || run.approval.id !== m[2]) throw new MockError("Approval is no longer active", 409);
    const approval = run.approval;
    emitAgent(run.id, "approval.resolved", { id: approval.id, kind: approval.kind, decision: body?.decision, values: body?.values || {}, feedback: body?.feedback });
    run.approval = {
      ...approval,
      status: body?.decision === "approve" ? "approved" : body?.decision === "revise" ? "revision_requested" : "cancelled",
      resolved_at: nowISO(),
    };
    if (body?.decision === "cancel") {
      run.status = "cancelled";
      emitAgent(run.id, "run.cancelled", { reason: "Cancelled at approval checkpoint" });
      return run;
    }
    if (approval.kind === "concept") {
      run.concept = { ...(run.concept || {}), ...(body?.values || {}) };
      run.status = "thinking";
      run.phase = "production_plan";
      emitAgent(run.id, "run.status", { status: "thinking", phase: "production_plan" });
      emitAgent(run.id, "activity.started", { id: "mock-plan", label: body?.decision === "revise" ? "Revising the creative brief" : "Planning eight cinematic shots", phase: "production_plan" });
      setTimeout(() => {
        const next = body?.decision === "revise" ? createMockConceptApproval(run.prompt) : createMockProductionApproval(run.prompt);
        run.approval = next as any;
        if (next.kind === "production_plan") run.production_plan = next.values;
        run.status = "awaiting_approval";
        run.phase = next.kind === "concept" ? "concept" : "production_plan";
        emitAgent(run.id, "activity.completed", { id: "mock-plan", label: next.kind === "concept" ? "Revised concept ready" : "Scene and shot plan ready", phase: run.phase });
        if (next.kind === "production_plan") emitAgent(run.id, "diff.created", { id: uid(), title: "Proposed production plan", rows: (next.values.scenes as any[]).map((scene) => ({ id: scene.id, label: scene.title, before: "", after: scene.concise_plot, change: "added" })) });
        emitAgent(run.id, "approval.requested", next as unknown as Record<string, unknown>);
        emitAgent(run.id, "run.status", { status: "awaiting_approval", phase: run.phase });
      }, 650);
    } else if (approval.kind === "production_plan") {
      if (body?.decision === "revise") {
        const next = createMockProductionApproval(run.prompt);
        run.approval = next;
        emitAgent(run.id, "diff.created", { id: uid(), title: "Revised production plan", rows: (next.values.scenes as any[]).map((scene) => ({ id: scene.id, label: scene.title, before: "Previous beat", after: scene.concise_plot, change: "modified" })) });
        emitAgent(run.id, "approval.requested", next as unknown as Record<string, unknown>);
      } else {
        materializeMockProduction(run);
      }
    } else {
      const store = ensureStore(run.project_id);
      run.status = "running";
      emitAgent(run.id, "run.status", { status: "running", phase: "assembly" });
      emitAgent(run.id, "activity.started", { id: "mock-assembly", label: "Assembling the final film", phase: "assembly" });
      setTimeout(() => {
        store.project.final_video_url = HP_FINAL_VIDEO;
        store.project.poster_url = HP_POSTER;
        run.status = "completed";
        emitAgent(run.id, "activity.completed", { id: "mock-assembly", label: "Final film assembled", phase: "assembly" });
        emitAgent(run.id, "insight.created", { id: uid(), title: "Your film is ready", metrics: [{ label: "Clips", value: 8 }, { label: "Runtime", value: "64s" }, { label: "Format", value: "16:9" }], artifact_url: HP_FINAL_VIDEO });
        emitAgent(run.id, "run.completed", { video_url: HP_FINAL_VIDEO });
        emitAgent(run.id, "run.status", { status: "completed", phase: "assembly" });
      }, 850);
    }
    return run;
  }
  if (method === "POST" && (m = path.match(/^\/api\/agent-runs\/([^/]+)\/cancel$/))) {
    const run = agentRuns.get(m[1]);
    if (!run) throw new MockError("Agent run not found");
    run.status = "cancelled";
    emitAgent(run.id, "run.cancelled", { reason: "Cancelled by user" });
    return run;
  }

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
