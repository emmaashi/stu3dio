"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  NodeResizer,
  useReactFlow,
  useNodesInitialized,
  useViewport,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Hand, MousePointer2, Plus, StickyNote } from "lucide-react";
import { useReducedMotion } from "framer-motion";

import { useStudioStore } from "@/store/useStudioStore";
import { useCustomGraphStore } from "@/store/useCustomGraphStore";
import type { CustomNodeKind } from "@/lib/customGraph";
import { buildLayout, SCALE_MIN, SCALE_MAX } from "./layout";
import { bust } from "./useStudioPipeline";
import { Icon, KIND_ICON } from "./Icon";
import type { StudioGraph, GNode } from "./types";

const ACCENT = "#aa98de";
const ZOOM_BTN =
  "w-[30px] h-[30px] grid place-items-center rounded-[6px] text-ink-2 transition-colors hover:text-ink hover:bg-glass-2";
const HANDLE_CLS = "!w-2 !h-2 !rounded-full !bg-glass-2 !border !border-hair";

export type StudioCanvasHandle = { fit: () => void };

type Props = {
  graph: StudioGraph;
  mediaVersion: number;
  busy: Record<string, boolean>;
  onPlayFilm: (src: string, title: string) => void;
  onDraft: (text: string) => void;
};

// ---- node data + custom node components ----

type PipelineData = { gnode: GNode; busy: boolean; version: number };
type PipelineRFNode = Node<PipelineData, "pipeline">;
type CustomData = {
  kind: CustomNodeKind;
  label: string;
  onDraft: (text: string) => void;
};
type CustomRFNode = Node<CustomData, "custom">;
type LaneRFNode = Node<{ label: string }, "lane">;
type DividerRFNode = Node<{ width: number }, "divider">;

function NodeHandles() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className={HANDLE_CLS}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="l"
        className={HANDLE_CLS}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r"
        className={HANDLE_CLS}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        className={HANDLE_CLS}
      />
    </>
  );
}

function PipelineNode({ id, data }: NodeProps<PipelineRFNode>) {
  const { gnode: n, busy, version } = data;
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const selectedIndex = selectedKeys.indexOf(id);
  const selected = selectedIndex !== -1;

  const statusClass = n.kind === "clip" && n.status ? ` ${n.status}` : "";
  const cls =
    `cv-node kind-${n.kind}${n.spine ? " spine" : ""}${statusClass}` +
    (n.kind === "film" ? (n.ready ? " lit" : " locked") : "") +
    (selected ? " selected" : "") +
    (n.loading ? " loading" : "") +
    (busy ? " busy" : "");

  const mediaSrc = bust(n.media, version);
  const select = useStudioStore((state) => state.select);
  const openPlayer = useStudioStore((state) => state.openPlayer);
  const typeLabel =
    n.kind === "clip" ? "Shot" : n.kind === "overview" ? "Overview" : n.kind;

  if (n.skeleton) {
    return (
      <div
        className={`cv-node kind-${n.kind}${n.spine ? " spine" : ""} skeleton`}
        style={{ position: "relative", width: n.w, height: n.h }}
        aria-hidden
      >
        <NodeHandles />
        <div className="cv-node-media">
          <div className="cv-skeleton-media" />
        </div>
        <div className="cv-card-kind">
          <Icon name={KIND_ICON[n.kind]} size={11} />
          <span>{typeLabel}</span>
        </div>
        <div className="cv-card-caption">
          <div className="cv-card-title-row">
            <span className="cv-node-title">{n.title}</span>
            <span className="cv-card-status">
              {n.kind === "film" ? "Assembling" : "Queued"}
            </span>
          </div>
          {n.label ? <p>{n.label}</p> : <span className="cv-skeleton-line" />}
        </div>
      </div>
    );
  }
  const status =
    busy || n.loading
      ? "Working"
      : n.kind === "clip"
        ? n.status === "completed"
          ? "Ready"
          : n.status === "generating"
            ? "Generating"
            : "Planned"
        : "";

  return (
    <div
      className={cls}
      style={{ position: "relative", width: n.w, height: n.h }}
      role="button"
      tabIndex={0}
      aria-label={`${n.title}${n.label ? `: ${n.label}` : ""}`}
      aria-pressed={selected}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          select(id, { additive: event.shiftKey });
        }
      }}
    >
      <NodeHandles />
      <div className="cv-node-media">
        {mediaSrc ? (
          <img
            src={mediaSrc}
            alt={n.title}
            draggable={false}
            onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
          />
        ) : n.video ? (
          <video
            src={n.video}
            muted
            loop
            playsInline
            onMouseEnter={(ev) => ev.currentTarget.play().catch(() => {})}
            onMouseLeave={(ev) => {
              ev.currentTarget.pause();
              ev.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          <div className="cv-node-blank">
            <Icon name={KIND_ICON[n.kind]} size={n.spine ? 26 : 20} />
          </div>
        )}
      </div>

      {n.video && (
        <button
          className="cv-card-preview nodrag nopan"
          aria-label={`Play ${n.title}`}
          onClick={(event) => {
            event.stopPropagation();
            openPlayer(n.video!, n.label || n.title);
          }}
        >
          <Icon name="play" size={17} />
        </button>
      )}
      <div className="cv-card-kind">
        <Icon name={KIND_ICON[n.kind]} size={11} />
        <span>{typeLabel}</span>
      </div>
      {selected && (
        <div
          className="cv-node-link-badge"
          aria-label={`Linked context ${selectedIndex + 1}`}
        >
          <Check size={12} />
          {selectedKeys.length > 1 && <span>{selectedIndex + 1}</span>}
        </div>
      )}
      <div className="cv-card-caption">
        <div className="cv-card-title-row">
          <span className="cv-node-title">{n.title}</span>
          {status && (
            <span
              className={`cv-card-status ${status === "Ready" ? "is-ready" : ""}`}
            >
              {status}
            </span>
          )}
        </div>
        <p>
          {n.label ||
            (n.kind === "film"
              ? "Your story, brought together"
              : n.kind === "character"
                ? "Character reference"
                : "Explore and refine")}
        </p>
      </div>
      {(busy || n.loading) && <div className="cv-node-busy" />}
      {n.loading && (
        <div className="cv-node-spinner" aria-hidden>
          <span className="cv-spin" />
        </div>
      )}
    </div>
  );
}

const CUSTOM_KINDS: { id: CustomNodeKind; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "character", label: "Character" },
  { id: "scene", label: "Scene" },
];

function CustomNode({ id, data, selected }: NodeProps<CustomRFNode>) {
  const setLabel = useCustomGraphStore((s) => s.setLabel);
  const setKind = useCustomGraphStore((s) => s.setKind);
  const removeNode = useCustomGraphStore((s) => s.removeNode);
  const updateNodeSize = useCustomGraphStore((s) => s.updateNodeSize);
  return (
    <div className="studio-note">
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={190}
        onResizeEnd={(_, p) => updateNodeSize(id, p.width, p.height, p.x, p.y)}
      />
      <NodeHandles />
      <div className="studio-note-header">
        <StickyNote size={14} />
        <select
          aria-label="Card type"
          className="nodrag nopan"
          value={data.kind}
          onChange={(e) => setKind(id, e.target.value as CustomNodeKind)}
        >
          {CUSTOM_KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </select>
        <button
          className="nodrag nopan"
          aria-label="Delete note"
          onClick={() => removeNode(id)}
        >
          <Icon name="x" size={13} />
        </button>
      </div>
      <textarea
        className="nodrag nopan nowheel"
        aria-label="Creative note"
        value={data.label}
        placeholder="A detail, a reference, a possibility…"
        onChange={(e) => setLabel(id, e.target.value)}
      />
      <button
        className="studio-note-use nodrag nopan"
        disabled={!data.label.trim()}
        onClick={() => data.onDraft(`Explore this ${data.kind}: ${data.label}`)}
      >
        Use in prompt <Icon name="arrowUpRight" size={13} />
      </button>
    </div>
  );
}

function LaneNode({ data }: NodeProps<LaneRFNode>) {
  return <div className="cv-lane-label">{data.label}</div>;
}

function DividerNode({ data }: NodeProps<DividerRFNode>) {
  return <div className="bg-hair-2" style={{ width: data.width, height: 1 }} />;
}

const nodeTypes = {
  pipeline: PipelineNode,
  custom: CustomNode,
  lane: LaneNode,
  divider: DividerNode,
};

// ---- canvas ----

const StudioCanvas = forwardRef<StudioCanvasHandle, Props>(
  function StudioCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <CanvasInner {...props} innerRef={ref} />
      </ReactFlowProvider>
    );
  },
);

export default StudioCanvas;

function CanvasInner({
  graph,
  mediaVersion,
  busy,
  onPlayFilm,
  onDraft,
  innerRef,
}: Props & { innerRef: React.Ref<StudioCanvasHandle> }) {
  const select = useStudioStore((s) => s.select);
  const focusKey = useStudioStore((s) => s.focusKey);
  const focusNonce = useStudioStore((s) => s.focusNonce);

  const customNodes = useCustomGraphStore((s) => s.nodes);
  const customEdges = useCustomGraphStore((s) => s.edges);
  const connect = useCustomGraphStore((s) => s.connect);
  const updateNodePosition = useCustomGraphStore((s) => s.updateNodePosition);

  const rf = useReactFlow();
  const { zoom } = useViewport();
  const reducedMotion = useReducedMotion();
  const wrapper = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"select" | "hand">("select");
  const selectedKeys = useStudioStore((state) => state.selectedKeys);
  const addNote = useCustomGraphStore((state) => state.addNode);
  const removeNode = useCustomGraphStore((state) => state.removeNode);
  const removeEdge = useCustomGraphStore((state) => state.removeEdge);
  const layout = useMemo(() => buildLayout(graph), [graph]);

  const rfNodes = useMemo<Node[]>(() => {
    const out: Node[] = [];

    layout.lanes.forEach((ln, i) => {
      if (i > 0) {
        out.push({
          id: `divider-${ln.key}`,
          type: "divider",
          position: { x: 0, y: ln.top },
          data: { width: layout.width },
          draggable: false,
          selectable: false,
          connectable: false,
          deletable: false,
          focusable: false,
          zIndex: -1,
        });
      }
      out.push({
        id: `lane-${ln.key}`,
        type: "lane",
        position: { x: 64, y: ln.top - 6 },
        data: { label: ln.label },
        draggable: false,
        selectable: false,
        connectable: false,
        deletable: false,
        zIndex: -1,
      });
    });

    layout.nodes.forEach((n) => {
      out.push({
        id: n.key,
        type: "pipeline",
        selected: selectedKeys.includes(n.key),
        position: { x: n.x, y: n.y },
        data: { gnode: n, busy: !!busy[n.key], version: mediaVersion },
        draggable: false,
        deletable: false,
        focusable: false,
        selectable: !n.skeleton,
        style: { width: n.w, height: n.h },
      });
    });

    customNodes.forEach((c) => {
      out.push({
        id: c.id,
        type: "custom",
        position: { x: c.x, y: c.y },
        data: { kind: c.kind, label: c.label, onDraft },
        draggable: true,
        style: { width: c.width ?? 260, height: c.height ?? 210 },
      });
    });

    return out;
  }, [layout, busy, mediaVersion, customNodes, onDraft, selectedKeys]);

  const rfEdges = useMemo<Edge[]>(() => {
    const out: Edge[] = layout.edges.map((e) => ({
      id: e.key,
      source: e.source,
      target: e.target,
      sourceHandle: e.dir === "h" ? "r" : "b",
      targetHandle: e.dir === "h" ? "l" : "t",
      animated: false,
      selectable: false,
      deletable: false,
      className: e.flow ? "is-flowing" : undefined,
      style: {
        stroke:
          selectedKeys.includes(e.source) || selectedKeys.includes(e.target)
            ? ACCENT
            : "#42404c",
        strokeWidth:
          selectedKeys.includes(e.source) || selectedKeys.includes(e.target)
            ? 1.8
            : 1,
        opacity:
          selectedKeys.length &&
          !selectedKeys.includes(e.source) &&
          !selectedKeys.includes(e.target)
            ? 0.25
            : 0.65,
      },
    }));

    customEdges.forEach((ce) => {
      out.push({
        id: ce.id,
        source: ce.source,
        target: ce.target,
        sourceHandle: ce.sourceHandle,
        targetHandle: ce.targetHandle,
        style: { stroke: ACCENT, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: ACCENT,
          width: 18,
          height: 18,
        },
        deletable: true,
      });
    });

    return out;
  }, [layout, customEdges, selectedKeys]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Carry measured sizes across re-syncs: React Flow hides an edge until both
  // ends are measured, so fresh node objects every poll would blink the edges.
  useEffect(
    () =>
      setNodes((previous) => {
        const measured = new Map(previous.map((n) => [n.id, n.measured]));
        return rfNodes.map((n) => {
          const size = measured.get(n.id);
          return size ? { ...n, measured: size } : n;
        });
      }),
    [rfNodes, setNodes],
  );
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  // Auto-frame the timeline: a smooth entrance once the nodes are measured, then
  // reframes as new nodes stream in so the whole board stays in view while it
  // generates. A manual pan or zoom only pauses that briefly, so someone who
  // leaned in to inspect a card is not yanked back out, but the next burst of
  // cards still gets framed once they have settled.
  const AUTO_FIT_IDLE_MS = 2500;
  const nodesInitialized = useNodesInitialized();
  const [revealed, setRevealed] = useState(false);
  const lastInteraction = useRef(0);
  const programmatic = useRef(false);
  const entered = useRef(false);
  const prevCount = useRef(-1);

  const fit = useCallback(
    (duration = 220) => {
      programmatic.current = true;
      rf.fitView({
        nodes: rf
          .getNodes()
          .filter((n) => n.type === "pipeline" || n.type === "custom"),
        padding: 0.16,
        duration: reducedMotion ? 0 : duration,
        maxZoom: 1,
      });
    },
    [rf, reducedMotion],
  );

  const onMoveStart = useCallback(() => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    lastInteraction.current = Date.now();
  }, []);

  useEffect(() => {
    if (!nodesInitialized || !layout.nodes.length) return;
    const count = layout.nodes.length;
    if (!entered.current) {
      // Center the whole timeline first (instant, while still hidden), then fade
      // the canvas in — so the unframed top-left state is never shown on entry.
      entered.current = true;
      prevCount.current = count;
      const openingCount = (wrapper.current?.clientWidth || 1000) < 600 ? 1 : 3;
      const opening = [
        ...layout.nodes
          .filter((n) => n.kind === "character")
          .slice(0, openingCount),
        ...layout.nodes
          .filter((n) => n.kind === "scene")
          .slice(0, openingCount),
      ];
      programmatic.current = true;
      rf.fitView({
        nodes: opening.map((n) => ({ id: n.key })),
        padding: 0.16,
        duration: 0,
        minZoom: 0.55,
        maxZoom: 1,
      });
      const id = requestAnimationFrame(() => setRevealed(true));
      // A board that is still generating (skeleton cards present) arrives at its
      // full size at once, so ease out to frame all of it right after the reveal.
      const generating = layout.nodes.some((n) => n.skeleton);
      const zoomOut = generating
        ? window.setTimeout(() => {
            if (Date.now() - lastInteraction.current > AUTO_FIT_IDLE_MS)
              fit(650);
          }, 450)
        : 0;
      return () => {
        cancelAnimationFrame(id);
        if (zoomOut) window.clearTimeout(zoomOut);
      };
    }
    if (count !== prevCount.current) {
      prevCount.current = count;
      if (Date.now() - lastInteraction.current > AUTO_FIT_IDLE_MS) fit(440);
    }
  }, [nodesInitialized, layout.nodes, fit, rf]);

  // Safety net: if initialization never reports, still frame + reveal the canvas.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRevealed(true);
    }, 700);
    return () => window.clearTimeout(t);
  }, [fit]);

  useImperativeHandle(
    innerRef,
    () => ({
      fit: () => {
        lastInteraction.current = 0;
        fit();
      },
    }),
    [fit],
  );

  // Pan/zoom to a node focused from the Layers panel.
  useEffect(() => {
    if (!focusKey) return;
    if (!rf.getNode(focusKey)) return;
    lastInteraction.current = Date.now();
    // Let the conversation panel and React Flow's ResizeObserver settle first.
    // Otherwise fitting uses the previous canvas width and shifts the card aside.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        programmatic.current = true;
        rf.fitView({
          nodes: [{ id: focusKey }],
          duration: reducedMotion ? 0 : 220,
          padding: 1,
          maxZoom: 1,
        });
      });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      connect(
        c.source,
        c.target,
        c.sourceHandle ?? undefined,
        c.targetHandle ?? undefined,
      );
    },
    [connect],
  );

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      if (node.type === "custom") {
        updateNodePosition(node.id, node.position.x, node.position.y);
      }
    },
    [updateNodePosition],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== "pipeline") return;
      const n = (node.data as PipelineData).gnode;
      if (n.skeleton) return;
      select(n.key, { additive: event.shiftKey });
    },
    [select],
  );

  const onNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (node.type !== "pipeline") return;
      const n = (node.data as PipelineData).gnode;
      if ((n.kind === "clip" || n.kind === "film") && n.video)
        onPlayFilm(n.video, n.kind === "film" ? n.title : n.label || n.title);
    },
    [onPlayFilm],
  );

  const onPaneClick = useCallback(() => select(null), [select]);

  const createNote = () => {
    const bounds = wrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = rf.screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
    addNote("idea", { x: position.x - 130, y: position.y - 105 });
    lastInteraction.current = Date.now();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable=true], [data-film-player], [data-annotation-editor], [data-story-brief]",
        ) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key.toLowerCase() === "f") fit();
      if (event.key.toLowerCase() === "v") setTool("select");
      if (event.key.toLowerCase() === "h") setTool("hand");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fit]);

  return (
    <div
      ref={wrapper}
      className="studio-canvas"
      style={{ opacity: revealed ? 1 : 0 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={(deleted) =>
          deleted
            .filter((n) => n.type === "custom")
            .forEach((n) => removeNode(n.id))
        }
        onEdgesDelete={(deleted) => deleted.forEach((e) => removeEdge(e.id))}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onMoveStart={onMoveStart}
        minZoom={SCALE_MIN}
        maxZoom={SCALE_MAX}
        connectionLineStyle={{ stroke: ACCENT, strokeWidth: 2 }}
        defaultEdgeOptions={{ type: "default" }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        panOnScroll
        panOnDrag={tool === "hand" ? true : [1, 2]}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        selectionOnDrag={tool === "select"}
        // Shift adds to the selection (matching onNodeClick) instead of being
        // React Flow's rubber-band key, so a shift-click can never turn into a
        // one-node box selection that wipes what was already picked.
        multiSelectionKeyCode="Shift"
        selectionKeyCode={null}
        onSelectionEnd={(event) => {
          const boxed = rf
            .getNodes()
            .filter((node) => node.type === "pipeline" && node.selected)
            .map((node) => node.id);
          if (!boxed.length) return;
          const store = useStudioStore.getState();
          store.setSelection(
            event.shiftKey ? [...store.selectedKeys, ...boxed] : boxed,
          );
        }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.3}
          color="rgba(214,207,228,0.16)"
        />
      </ReactFlow>

      <div
        className="studio-canvas-toolbar"
        role="toolbar"
        aria-label="Canvas tools"
      >
        <button
          className={tool === "select" ? "is-active" : ""}
          onClick={() => setTool("select")}
          aria-label="Select tool"
          aria-pressed={tool === "select"}
          title="Select · V"
        >
          <MousePointer2 size={17} />
        </button>
        <button
          className={tool === "hand" ? "is-active" : ""}
          onClick={() => setTool("hand")}
          aria-label="Pan tool"
          aria-pressed={tool === "hand"}
          title="Pan · H"
        >
          <Hand size={17} />
        </button>
        <span />
        <button
          onClick={createNote}
          aria-label="Add creative note"
          title="Add a creative note"
        >
          <StickyNote size={17} />
        </button>
      </div>
      <div className="studio-zoom-controls" aria-label="Canvas zoom">
        <button
          className={ZOOM_BTN}
          onClick={() => rf.zoomOut({ duration: reducedMotion ? 0 : 150 })}
          aria-label="Zoom out"
        >
          <Icon name="minus" size={14} />
        </button>
        <button
          className="studio-zoom-value"
          onClick={() => rf.zoomTo(1, { duration: reducedMotion ? 0 : 150 })}
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className={ZOOM_BTN}
          onClick={() => rf.zoomIn({ duration: reducedMotion ? 0 : 150 })}
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </button>
        <span />
        <button
          className={ZOOM_BTN}
          onClick={() => fit()}
          aria-label="Fit canvas"
          title="Fit canvas · F"
        >
          <Icon name="fit" size={15} />
        </button>
      </div>
    </div>
  );
}
