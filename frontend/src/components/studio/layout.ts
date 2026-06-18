// Pure, deterministic node-graph layout for the Studio canvas.
// Lays the pipeline out as labeled horizontal lanes so the flow reads clearly:
//
//   CAST    -> character cards (top), feeding the story
//   STORY   -> scene spine, left to right
//   SHOTS   -> each scene fans down into its shots
//   FILM    -> every scene's shots converge into one Final Film node
//
// Inheritance is shown with edges: cast -> each scene the character appears in,
// scene -> scene (spine), scene -> its shots, last shot of each scene -> film.

import type { StudioGraph, GNode, GEdge } from "./types";

const LABEL_X = 28; // lane label gutter
const LEFT_PAD = 168; // where node content starts (room for labels)
const TOP_PAD = 64;
const BAND_GAP = 84;

const CW = 160,
  CH = 96; // cast card
const SPINE_W = 196,
  SPINE_H = 112; // concept + scene cards
const BR_W = 156,
  BR_H = 90, // shot card
  ROW_GAP = 14;
const CHAR_GAP = 22;
const COL_GAP = 248;
const FILM_W = 256,
  FILM_H = 150;

export const SCALE_MIN = 0.35,
  SCALE_MAX = 2.2;
export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export type Lane = { key: string; label: string; top: number; height: number };

export function buildLayout(graph: StudioGraph) {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];

  const hasChars = graph.characters.length > 0;
  const hasScenes = graph.scenes.length > 0;
  const hasClips = graph.scenes.some((s) => s.clips.length > 0);
  // The Final film node appears only once the film has actually been generated
  // (the user runs it from the final-film popup), not just because scenes exist.
  const showFilm = !!graph.overview?.finalVideoUrl;

  const maxClips = graph.scenes.reduce((m, s) => Math.max(m, s.clips.length), 0);
  const clipDepth = Math.max(1, maxClips) * (BR_H + ROW_GAP);

  // Vertical bands stack top-to-bottom; only stages that have content take up
  // space, so an empty film shows nothing and each lane appears as it is built.
  const lanes: Lane[] = [];
  let y = TOP_PAD;
  let castY = 0;
  let spineY = 0;
  let shotsTop = 0;
  let filmY = 0;
  if (hasChars) {
    castY = y;
    lanes.push({ key: "cast", label: "Cast", top: castY - 28, height: CH + 56 });
    y += CH + BAND_GAP;
  }
  if (hasScenes) {
    spineY = y;
    lanes.push({ key: "story", label: "Story", top: spineY - 28, height: SPINE_H + 56 });
    y += SPINE_H + BAND_GAP;
  }
  if (hasClips) {
    shotsTop = y;
    lanes.push({ key: "shots", label: "Shots", top: shotsTop - 28, height: clipDepth + 36 });
    y += clipDepth + BAND_GAP;
  }
  if (showFilm) {
    filmY = y;
    lanes.push({ key: "film", label: "Final film", top: filmY - 28, height: FILM_H + 56 });
    y += FILM_H + BAND_GAP;
  }

  // edge helpers (right->left, and vertical fans)
  const flow = (a: GNode, b: GNode, on: boolean) => {
    const ax = a.x + a.w,
      ay = a.y + a.h / 2,
      bx = b.x,
      by = b.y + b.h / 2,
      cx = (ax + bx) / 2;
    edges.push({
      key: `${a.key}->${b.key}`,
      d: `M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}`,
      on,
      source: a.key,
      target: b.key,
      dir: "h",
    });
  };
  const down = (a: GNode, b: GNode, on: boolean) => {
    const ax = a.x + a.w / 2,
      ay = a.y + a.h,
      bx = b.x + b.w / 2,
      by = b.y;
    const my = (ay + by) / 2;
    edges.push({
      key: `${a.key}v${b.key}`,
      d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
      on,
      source: a.key,
      target: b.key,
      dir: "v",
    });
  };

  // ---- STORY: scene spine (the concept lives in the side panel, not on the board) ----
  const sceneNodes: GNode[] = graph.scenes.map((s, i) => ({
    key: `scene-${s.id}`,
    kind: "scene",
    spine: true,
    x: LEFT_PAD + i * COL_GAP,
    y: spineY,
    w: SPINE_W,
    h: SPINE_H,
    title: `Scene ${s.order}`,
    label: s.plot,
    media: s.media,
    ready: !!s.media,
    loading: s.loading,
    refId: s.id,
  }));
  nodes.push(...sceneNodes);

  for (let i = 1; i < sceneNodes.length; i++) {
    flow(sceneNodes[i - 1], sceneNodes[i], !!sceneNodes[i - 1].ready && !!sceneNodes[i].ready);
  }

  // ---- CAST: characters above, each feeding every scene they appear in ----
  // Map char id -> scene nodes from each scene's castIds. Falls back to the
  // first scene when there is no mapping (e.g. the live backend / HP mock).
  const scenesForChar = new Map<string, GNode[]>();
  graph.scenes.forEach((s, i) => {
    (s.castIds ?? []).forEach((cid) => {
      const arr = scenesForChar.get(cid) ?? [];
      arr.push(sceneNodes[i]);
      scenesForChar.set(cid, arr);
    });
  });
  const storyHead = sceneNodes[0];
  graph.characters.forEach((c, j) => {
    const n: GNode = {
      key: `char-${c.id}`,
      kind: "character",
      spine: false,
      x: LEFT_PAD + j * (CW + CHAR_GAP),
      y: castY,
      w: CW,
      h: CH,
      title: c.name || "Character",
      label: c.role,
      media: c.media,
      ready: !!c.media,
      loading: c.loading,
      refId: c.id,
    };
    nodes.push(n);
    const targets = scenesForChar.get(c.id);
    if (targets && targets.length) {
      targets.forEach((sn) => down(n, sn, !!c.media && !!sn.ready));
    } else if (storyHead) {
      down(n, storyHead, !!c.media);
    }
  });

  // ---- SHOTS: fan down from each scene; remember the lowest per column ----
  const lastShotByScene: Record<number, GNode> = {};
  sceneNodes.forEach((sn, si) => {
    const s = graph.scenes[si];
    s.clips.forEach((clip, k) => {
      const n: GNode = {
        key: `clip-${clip.id}`,
        kind: "clip",
        spine: false,
        x: sn.x + (SPINE_W - BR_W) / 2,
        y: shotsTop + k * (BR_H + ROW_GAP),
        w: BR_W,
        h: BR_H,
        title: `Shot ${String(k + 1).padStart(2, "0")}`,
        label: clip.label,
        media: clip.image_url,
        video: clip.video_url,
        status: clip.status,
        refId: clip.id,
      };
      nodes.push(n);
      down(sn, n, clip.status === "completed");
      lastShotByScene[si] = n;
    });
  });

  // ---- FINAL FILM: centered, everything converges (only once a spine exists) ----
  const spineRight = sceneNodes.length
    ? sceneNodes[sceneNodes.length - 1].x + SPINE_W
    : LEFT_PAD + SPINE_W;
  let film: GNode | null = null;
  if (showFilm) {
    const centerX = (LEFT_PAD + spineRight) / 2;
    // Use a representative scene/shot still while in progress; only show the
    // explicit poster once the film is actually complete, so a brand-new film
    // never inherits a stale/seeded poster.
    const firstStill =
      graph.scenes.find((s) => s.media)?.media ||
      graph.scenes.flatMap((s) => s.clips).find((c) => c.image_url)?.image_url;
    const filmPoster = graph.complete
      ? graph.overview?.poster || firstStill
      : firstStill;
    film = {
      key: "film",
      kind: "film",
      spine: true,
      x: centerX - FILM_W / 2,
      y: filmY,
      w: FILM_W,
      h: FILM_H,
      title: "Final film",
      media: filmPoster,
      video: graph.overview?.finalVideoUrl,
      ready: graph.complete,
    };
    nodes.push(film);
    sceneNodes.forEach((sn, si) =>
      down(lastShotByScene[si] || sn, film!, graph.complete)
    );
  }

  // ---- bounds ----
  const charsRight = hasChars
    ? LEFT_PAD + graph.characters.length * (CW + CHAR_GAP)
    : LEFT_PAD;
  const right = Math.max(spineRight, charsRight, film ? film.x + FILM_W : 0);
  const width = right + LEFT_PAD;
  const height = y + TOP_PAD;

  return { nodes, edges, width, height, lanes, labelX: LABEL_X };
}
