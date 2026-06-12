"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectData } from "@/hooks/useBackendIntegration";
import { getCurrentProjectId, getCurrentProject } from "@/data/projectData";
import { DEMO_FINAL_FILM_SRC } from "@/data/demoFilm";
import FilmPlayer from "@/components/FilmPlayer";

const PATHS: Record<string, string> = {
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  clapper: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h4M3 16.5h4M17 7.5h4M17 12h4M17 16.5h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 0-1-1h-4"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  scene: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 4v5M16 4v5"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

// Hardcoded stitched film for the Final Film node (swap for the real output later).
const FINAL_FILM_SRC = DEMO_FINAL_FILM_SRC;

/* ---- graph data model (built from one read-only getCompleteStatus call) ---- */
type ClipStatus = 'pending' | 'generating' | 'completed';
type Clip = { id: string; status: ClipStatus; video_url?: string; image_url?: string; label: string };
type SceneN = { id: string; order: number; plot: string; media?: string; clips: Clip[] };
type CharN = { id: string; name: string; role: string; media?: string };
type Graph = {
  overview: { title: string; summary: string } | null;
  characters: CharN[];
  scenes: SceneN[];
  complete: boolean;
  hasProject: boolean;
};
const EMPTY_GRAPH: Graph = { overview: null, characters: [], scenes: [], complete: false, hasProject: false };

/* ---- node graph layout (pure, deterministic) ---- */
const SPINE_X0 = 80, COL_GAP = 240, TOP_PAD = 56;
const SPINE_W = 188, SPINE_H = 116, BR_W = 134, BR_H = 86;
const BRANCH_UP = 150, BRANCH_DOWN = 150, ROW_GAP = 16, CHAR_GAP = 24;
const SCALE_MIN = 0.4, SCALE_MAX = 2.2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type GNode = {
  key: string; kind: 'overview' | 'character' | 'scene' | 'clip' | 'film'; spine: boolean;
  x: number; y: number; w: number; h: number;
  title: string; label?: string; media?: string; video?: string;
  status?: ClipStatus; ready?: boolean; data?: any;
};
type GEdge = { key: string; d: string; on: boolean };

function buildLayout(graph: Graph) {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  // spine baseline: leave room above for characters + below for clips
  const maxClips = graph.scenes.reduce((m, s) => Math.max(m, s.clips.length), 0);
  const spineY = TOP_PAD + BRANCH_UP + BR_H + 40;

  // center helper for edges (right port -> left port)
  const edge = (a: GNode, b: GNode, on: boolean) => {
    const ax = a.x + a.w, ay = a.y + a.h / 2, bx = b.x, by = b.y + b.h / 2, cx = (ax + bx) / 2;
    edges.push({ key: `${a.key}->${b.key}`, d: `M ${ax} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${bx} ${by}`, on });
  };
  // downward branch edge: a.bottom -> b.top (b sits below a)
  const branch = (a: GNode, b: GNode, on: boolean) => {
    const ax = a.x + a.w / 2, ay = a.y + a.h, bx = b.x + b.w / 2, by = b.y;
    const my = (ay + by) / 2;
    edges.push({ key: `${a.key}~${b.key}`, d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`, on });
  };
  // upward branch edge: a.top -> b.bottom (b sits above a)
  const branchUp = (a: GNode, b: GNode, on: boolean) => {
    const ax = a.x + a.w / 2, ay = a.y, bx = b.x + b.w / 2, by = b.y + b.h;
    const my = (ay + by) / 2;
    edges.push({ key: `${a.key}^${b.key}`, d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`, on });
  };

  // Overview (spine start)
  const overview: GNode = {
    key: 'overview', kind: 'overview', spine: true, x: SPINE_X0, y: spineY,
    w: SPINE_W, h: SPINE_H, title: graph.overview?.title || 'Untitled', label: graph.overview?.summary,
    ready: !!graph.overview,
  };
  nodes.push(overview);

  // Scenes along the spine
  const sceneNodes: GNode[] = graph.scenes.map((s, i) => ({
    key: `scene-${s.id}`, kind: 'scene', spine: true,
    x: SPINE_X0 + (i + 1) * COL_GAP, y: spineY, w: SPINE_W, h: SPINE_H,
    title: `Scene ${s.order}`, label: s.plot, media: s.media, ready: !!s.media, data: s,
  }));
  nodes.push(...sceneNodes);

  // spine edges: overview -> scene1 -> ... -> sceneN (film is NOT on the spine)
  const spineChain = [overview, ...sceneNodes];
  for (let i = 1; i < spineChain.length; i++) {
    const a = spineChain[i - 1], b = spineChain[i];
    edge(a, b, !!a.ready && !!b.ready);
  }

  // Characters branch above the overview
  graph.characters.forEach((c, j) => {
    const n: GNode = {
      key: `char-${c.id}`, kind: 'character', spine: false,
      x: SPINE_X0 + j * (BR_W + CHAR_GAP), y: spineY - BRANCH_UP - BR_H,
      w: BR_W, h: BR_H, title: c.name || 'Character', label: c.role, media: c.media, ready: !!c.media,
    };
    nodes.push(n);
    branchUp(overview, n, !!c.media); // overview.top -> character.bottom
  });

  // Clips branch below each scene; remember the lowest clip in each column
  const lastClipByScene: Record<number, GNode> = {};
  sceneNodes.forEach((sn, si) => {
    const s = graph.scenes[si];
    s.clips.forEach((clip, k) => {
      const n: GNode = {
        key: `clip-${clip.id}`, kind: 'clip', spine: false,
        x: sn.x + (sn.w - BR_W) / 2, y: spineY + BRANCH_DOWN + k * (BR_H + ROW_GAP),
        w: BR_W, h: BR_H, title: String(k + 1).padStart(2, '0'), label: clip.label,
        media: clip.image_url, video: clip.video_url, status: clip.status,
      };
      nodes.push(n);
      branch(sn, n, clip.status === 'completed');
      lastClipByScene[si] = n;
    });
  });

  // Final film — its OWN level at the bottom, centered; every scene column fans into it.
  const FILM_W = 248, FILM_H = 152;
  const clipDepth = Math.max(1, maxClips) * (BR_H + ROW_GAP);
  const spineRight = sceneNodes.length ? sceneNodes[sceneNodes.length - 1].x + SPINE_W : overview.x + SPINE_W;
  const centerX = (overview.x + spineRight) / 2;
  const film: GNode = {
    key: 'film', kind: 'film', spine: true,
    x: centerX - FILM_W / 2,
    y: spineY + BRANCH_DOWN + clipDepth + 72,
    w: FILM_W, h: FILM_H,
    title: 'Final film', ready: graph.complete,
  };
  nodes.push(film);
  if (sceneNodes.length === 0) {
    branch(overview, film, graph.complete);
  } else {
    sceneNodes.forEach((sn, si) => branch(lastClipByScene[si] || sn, film, graph.complete));
  }

  const right = Math.max(spineRight, film.x + FILM_W);
  const bottom = film.y + FILM_H;
  const width = right + SPINE_X0;
  const height = bottom + TOP_PAD;
  return { nodes, edges, width, height };
}

export default function CanvasModal({
  proj,
  onClose,
  onPick,
}: {
  proj: string;
  onClose: () => void;
  onPick: (title: string) => void;
}) {
  const projectData = useProjectData();

  const [playing, setPlaying] = useState<{ src: string; title: string } | null>(null);
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH);

  // ---- pan / zoom of the board ----
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-noplan]')) return; // don't pan on nodes/controls
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  };
  const onPointerUp = () => { dragRef.current = null; setDragging(false); };

  // wheel zoom toward cursor (native non-passive listener so preventDefault works)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setScale((prev) => {
        const next = clamp(prev * factor, SCALE_MIN, SCALE_MAX);
        const k = next / prev;
        setPan((p) => ({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
        return next;
      });
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const zoomCenter = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0, cy = rect ? rect.height / 2 : 0;
    setScale((prev) => {
      const next = clamp(prev * factor, SCALE_MIN, SCALE_MAX);
      const k = next / prev;
      setPan((p) => ({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
      return next;
    });
  };
  const fit = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  // ---- poll the active project's pipeline (READ-ONLY) ----
  const pollLive = useCallback(async () => {
    const projectId = getCurrentProjectId();
    if (!projectId) { setGraph(EMPTY_GRAPH); return; }
    const cur = getCurrentProject();
    const overview = cur ? { title: cur.title || proj, summary: cur.summary || cur.plot || '' } : { title: proj, summary: '' };
    try {
      const status = await projectData.getCompleteStatus();
      const rawScenes = (status?.scenes || []) as any[];
      const rawChars = (status?.characters || []) as any[];
      const rawFrames = (status?.frames || []) as any[];

      const characters: CharN[] = rawChars.map((c, i) => ({
        id: c.id || `char-${i}`,
        name: c.metadata?.name || `Character ${i + 1}`,
        role: c.metadata?.role || '',
        media: c.media_url,
      }));

      // group frames by scene_id
      const byScene = new Map<string, Clip[]>();
      rawFrames.forEach((f, i) => {
        let s: ClipStatus = 'pending';
        if (f.video_url) s = 'completed';
        else if (f.media_url) s = 'generating';
        const clip: Clip = {
          id: f.id || `clip-${i}`,
          status: s,
          video_url: f.video_url,
          image_url: f.media_url,
          label: f.metadata?.concise_plot || f.metadata?.summary || `Clip ${i + 1}`,
        };
        const sid = f.scene_id || 'unknown';
        if (!byScene.has(sid)) byScene.set(sid, []);
        byScene.get(sid)!.push(clip);
        (clip as any)._order = f.metadata?.frame_order ?? f.metadata?.scene_order ?? i;
      });
      byScene.forEach((arr) => arr.sort((a, b) => ((a as any)._order ?? 0) - ((b as any)._order ?? 0)));

      const scenes: SceneN[] = rawScenes
        .map((s, i) => ({
          id: s.id || `scene-${i}`,
          order: s.metadata?.scene_order ?? i + 1,
          plot: s.metadata?.concise_plot || s.metadata?.detailed_plot || '',
          media: s.media_url,
          clips: byScene.get(s.id) || [],
        }))
        .sort((a, b) => a.order - b.order);

      const allClips = scenes.flatMap((s) => s.clips);
      const complete =
        status?.completion_status === 'complete' ||
        (allClips.length > 0 && allClips.every((c) => c.status === 'completed'));

      setGraph({ overview, characters, scenes, complete, hasProject: true });
    } catch (err) {
      console.error('Canvas: poll failed', err);
      setGraph({ overview, characters: [], scenes: [], complete: false, hasProject: true });
    }
    // NOTE: deps intentionally empty — `projectData` is a fresh object every render
    // (would re-run the polling effect forever) and `getCompleteStatus` is already a
    // stable useCallback. `proj` is only a fallback title and not worth re-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pollLive();
    const id = setInterval(pollLive, 5000);
    return () => clearInterval(id);
  }, [pollLive]);

  const { nodes, edges, width, height } = buildLayout(graph);

  return (
    <div className="canvas-overlay">
      {/* Top bar */}
      <div className="canvas-top">
        <div className="canvas-titlewrap" data-noplan>
          <span className="brand-mark sm"><Icon name="film" size={18} /></span>
          <div>
            <div className="slate">Studio canvas</div>
            <div className="canvas-title">{proj}</div>
          </div>
        </div>
        <div className="canvas-top-actions" data-noplan>
          <div className="canvas-zoom">
            <button onClick={() => zoomCenter(1 / 1.1)} title="Zoom out"><Icon name="minus" size={16} /></button>
            <button onClick={fit} title="Fit"><Icon name="fit" size={15} /></button>
            <button onClick={() => zoomCenter(1.1)} title="Zoom in"><Icon name="plus" size={16} /></button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={16} /><span>Close</span>
          </button>
        </div>
      </div>

      {/* Pannable + zoomable viewport */}
      <div
        ref={viewportRef}
        className={`canvas-viewport${dragging ? ' grabbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="canvas-dots" />
        <div
          className="canvas-board"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            minWidth: width, minHeight: height,
          }}
        >
          {/* wires */}
          <svg className="cv-edges" width={width} height={height}>
            {edges.map((e) => (
              <path key={e.key} className={`cv-edge${e.on ? ' on' : ''}`} d={e.d} />
            ))}
          </svg>

          {/* nodes */}
          {nodes.map((n) => (
            <NodeView key={n.key} n={n} onPlayFilm={() => { setPlaying({ src: FINAL_FILM_SRC, title: graph.overview?.title || proj }); onPick(graph.overview?.title || proj); }} />
          ))}
        </div>
      </div>

      {/* Film player overlay */}
      {playing && (
        <div className="cv-player">
          <button className="cv-player-close" onClick={() => setPlaying(null)} aria-label="Close player">
            <Icon name="x" size={20} />
          </button>
          <div className="cv-player-title">{playing.title}</div>
          <FilmPlayer src={playing.src} autoplay />
        </div>
      )}
    </div>
  );
}

const KIND_ICON: Record<GNode['kind'], string> = {
  overview: 'doc', character: 'user', scene: 'scene', clip: 'clapper', film: 'play',
};

function NodeView({ n, onPlayFilm }: { n: GNode; onPlayFilm: () => void }) {
  const statusClass = n.kind === 'clip' && n.status ? ` ${n.status}` : '';
  const cls = `cv-node kind-${n.kind}${n.spine ? ' spine' : ''}${statusClass}`
    + (n.kind === 'film' ? (n.ready ? ' lit' : ' locked') : '');
  const style = { left: n.x, top: n.y, width: n.w, height: n.h } as React.CSSProperties;
  const clickable = n.kind === 'film';

  const media = (
    <div className="cv-node-media">
      {n.video ? (
        <video src={n.video} muted loop playsInline
          onMouseEnter={(ev) => ev.currentTarget.play().catch(() => {})}
          onMouseLeave={(ev) => { ev.currentTarget.pause(); ev.currentTarget.currentTime = 0; }} />
      ) : n.media ? (
        <img src={n.media} alt={n.title} draggable={false} />
      ) : (
        <div className="cv-node-blank"><Icon name={KIND_ICON[n.kind]} size={n.spine ? 26 : 20} /></div>
      )}
    </div>
  );

  const inner = (
    <>
      {media}
      {n.kind === 'clip' && <div className="cv-node-ring" />}
      {n.kind === 'film' && <div className="cv-node-play"><Icon name="play" size={20} /></div>}
      <div className="cv-node-ic"><Icon name={KIND_ICON[n.kind]} size={12} /></div>
      <div className="cv-node-title">{n.title}</div>
      {n.label && <div className="cv-node-label">{n.label}</div>}
    </>
  );

  if (clickable) {
    return (
      <button className={cls} style={style} data-noplan title={n.title} onClick={onPlayFilm}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style} data-noplan title={n.label || n.title}>
      {inner}
    </div>
  );
}
