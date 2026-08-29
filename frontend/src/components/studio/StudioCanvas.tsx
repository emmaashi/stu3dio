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
import { createPortal } from "react-dom";
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
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link2 } from "lucide-react";

import { useStudioStore } from "@/store/useStudioStore";
import { useCustomGraphStore } from "@/store/useCustomGraphStore";
import type { CustomNodeKind } from "@/lib/customGraph";
import { buildLayout, SCALE_MIN, SCALE_MAX } from "./layout";
import { bust } from "./useStudioPipeline";
import { Icon, KIND_ICON } from "./Icon";
import { cn } from "@/lib/utils";
import type { StudioGraph, GNode } from "./types";

const ACCENT = "#e2e5ea";
const ZOOM_BTN =
  "w-[30px] h-[30px] grid place-items-center rounded-[6px] text-ink-2 transition-colors hover:text-ink hover:bg-glass-2";
const HANDLE_CLS = "!w-2 !h-2 !rounded-full !bg-glass-2 !border !border-hair";

export type StudioCanvasHandle = { fit: () => void };

type Props = {
  graph: StudioGraph;
  mediaVersion: number;
  busy: Record<string, boolean>;
  onPlayFilm: (src: string, title: string) => void;
};

// ---- node data + custom node components ----

type PipelineData = { gnode: GNode; busy: boolean; version: number };
type PipelineRFNode = Node<PipelineData, "pipeline">;
type CustomData = { kind: CustomNodeKind; label: string };
type CustomRFNode = Node<CustomData, "custom">;
type LaneRFNode = Node<{ label: string }, "lane">;
type DividerRFNode = Node<{ width: number }, "divider">;

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} id="l" className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} id="r" className={HANDLE_CLS} />
      <Handle type="source" position={Position.Bottom} id="b" className={HANDLE_CLS} />
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

  return (
    <div
      className={cls}
      style={{ position: "relative", width: n.w, height: n.h }}
      title={n.label || n.title}
    >
      <NodeHandles />
      <div className="cv-node-media">
        {mediaSrc ? (
          <img src={mediaSrc} alt={n.title} draggable={false} />
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
      {n.kind === "clip" && <div className="cv-node-ring" />}
      {n.kind === "film" && (
        <div className="cv-node-play">
          <Icon name="play" size={20} />
        </div>
      )}
      <div className="cv-node-ic">
        <Icon name={KIND_ICON[n.kind]} size={12} />
      </div>
      {selected && (
        <div className="cv-node-link-badge" aria-label={`Linked context ${selectedIndex + 1}`}>
          <Link2 size={10} strokeWidth={2.2} />
          {selectedKeys.length > 1 && <span>{selectedIndex + 1}</span>}
        </div>
      )}
      <div className="cv-node-title">{n.title}</div>
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

type CardStatus = "idle" | "generating" | "done";

function CustomNode({ id, data, selected }: NodeProps<CustomRFNode>) {
  const setLabel = useCustomGraphStore((s) => s.setLabel);
  const setKind = useCustomGraphStore((s) => s.setKind);
  const removeNode = useCustomGraphStore((s) => s.removeNode);
  const updateNodeSize = useCustomGraphStore((s) => s.updateNodeSize);

  const [status, setStatus] = useState<CardStatus>("idle");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const kindLabel =
    CUSTOM_KINDS.find((k) => k.id === data.kind)?.label ?? "Idea";
  const canGenerate = !!data.label.trim() && status !== "generating";

  // No backend is wired for user-authored cards yet. This simulates the
  // generation round-trip so the interaction reads the way it will once the
  // character/scene generation APIs are connected to these cards.
  const generate = () => {
    if (!canGenerate) return;
    setStatus("generating");
    window.setTimeout(() => setStatus("done"), 1300);
  };

  return (
    <div
      className={cn(
        "relative w-full h-full flex flex-col rounded-[12px] bg-surface-1 border transition-colors shadow-[0_14px_30px_-16px_rgba(0,0,0,.8)]",
        status === "done"
          ? "border-accent/60 shadow-[0_0_30px_-10px_color-mix(in_oklab,var(--glow)_60%,transparent)]"
          : "border-hair"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={188}
        minHeight={150}
        handleClassName="!h-2 !w-2 !rounded-[2px] !border !border-accent !bg-accent"
        lineClassName="!border-accent/40"
        onResizeEnd={(_, p) =>
          updateNodeSize(id, p.width, p.height, p.x, p.y)
        }
      />
      <NodeHandles />

      {/* header: kind selector + delete */}
      <div className="flex items-center gap-2 px-2.5 h-9 shrink-0 border-b border-hair-2">
        <span className="grid place-items-center w-[22px] h-[22px] rounded-[6px] bg-accent/15 text-accent shrink-0">
          <Icon name={KIND_ICON[data.kind] || "doc"} size={13} />
        </span>
        <div className="relative flex-1 min-w-0">
          <select
            className="nodrag nopan peer w-full appearance-none bg-transparent pr-4 text-[12.5px] font-semibold text-ink outline-none cursor-pointer"
            value={data.kind}
            onChange={(e) => {
              setKind(id, e.target.value as CustomNodeKind);
              setStatus("idle");
            }}
            aria-label="Card type"
          >
            {CUSTOM_KINDS.map((k) => (
              <option key={k.id} value={k.id} className="bg-surface-2 text-ink">
                {k.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-4 peer-hover:text-ink-2">
            <Icon name="caretDown" size={12} />
          </span>
        </div>
        <button
          className="nodrag nopan grid place-items-center w-[22px] h-[22px] rounded-[6px] text-ink-4 transition-colors hover:text-danger hover:bg-glass"
          onClick={() => removeNode(id)}
          title="Delete card"
          aria-label="Delete card"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* body: prompt-bar-style input + generate action */}
      <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-2">
        <textarea
          className="nodrag nopan nowheel flex-1 min-h-0 w-full resize-none bg-surface-2 border border-hair rounded-[8px] px-2.5 py-2 text-[13px] leading-snug text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--hair))]"
          value={data.label}
          placeholder={`Describe this ${kindLabel.toLowerCase()}…`}
          onChange={(e) => {
            setLabel(id, e.target.value);
            if (status === "done") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generate();
            }
          }}
        />
        <button
          className="nodrag nopan shrink-0 flex items-center justify-center gap-2 h-8 rounded-[8px] text-[12.5px] font-semibold bg-accent text-accent-ink transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={generate}
          disabled={!canGenerate}
          title={`Generate ${kindLabel.toLowerCase()}`}
        >
          {status === "generating" ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-accent-ink/30 border-t-accent-ink animate-spin" />
              <span>Generating…</span>
            </>
          ) : status === "done" ? (
            <>
              <Icon name="check" size={14} />
              <span>Generated</span>
            </>
          ) : (
            <>
              <Icon name="sparkle" size={14} />
              <span>Generate</span>
            </>
          )}
        </button>
      </div>

      {menu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <div
              className="fixed z-[201] min-w-[160px] p-[5px] rounded-[10px] bg-glass-2 border border-hair shadow-[0_18px_44px_rgba(0,0,0,.5)] backdrop-blur-xl"
              style={{ left: menu.x, top: menu.y }}
            >
              <button
                className="flex w-full items-center gap-[9px] px-[11px] py-2 rounded-[6px] text-[13px] text-left text-ink transition-colors hover:bg-glass disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canGenerate}
                onClick={() => {
                  generate();
                  setMenu(null);
                }}
              >
                <Icon name="sparkle" size={14} />
                <span>Generate {kindLabel.toLowerCase()}</span>
              </button>
              <button
                className="flex w-full items-center gap-[9px] px-[11px] py-2 rounded-[6px] text-[13px] text-left text-[#ff7a7a] transition-colors hover:bg-[rgba(255,90,90,.1)]"
                onClick={() => {
                  removeNode(id);
                  setMenu(null);
                }}
              >
                <Icon name="trash" size={14} />
                <span>Delete card</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function LaneNode({ data }: NodeProps<LaneRFNode>) {
  return (
    <div className="px-2.5 py-[3px] rounded-pill text-[11px] font-semibold tracking-[.01em] text-ink-3 bg-glass border border-hair-2 backdrop-blur-sm whitespace-nowrap">
      {data.label}
    </div>
  );
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

const StudioCanvas = forwardRef<StudioCanvasHandle, Props>(function StudioCanvas(
  props,
  ref
) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} innerRef={ref} />
    </ReactFlowProvider>
  );
});

export default StudioCanvas;

function CanvasInner({
  graph,
  mediaVersion,
  busy,
  onPlayFilm,
  innerRef,
}: Props & { innerRef: React.Ref<StudioCanvasHandle> }) {
  const select = useStudioStore((s) => s.select);
  const openFinalize = useStudioStore((s) => s.openFinalize);
  const focusKey = useStudioStore((s) => s.focusKey);
  const focusNonce = useStudioStore((s) => s.focusNonce);

  const customNodes = useCustomGraphStore((s) => s.nodes);
  const customEdges = useCustomGraphStore((s) => s.edges);
  const connect = useCustomGraphStore((s) => s.connect);
  const updateNodePosition = useCustomGraphStore((s) => s.updateNodePosition);

  const rf = useReactFlow();
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
          zIndex: -1,
        });
      }
      out.push({
        id: `lane-${ln.key}`,
        type: "lane",
        position: { x: layout.labelX, y: ln.top + 8 },
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
        position: { x: n.x, y: n.y },
        data: { gnode: n, busy: !!busy[n.key], version: mediaVersion },
        draggable: false,
        deletable: false,
        style: { width: n.w, height: n.h },
      });
    });

    customNodes.forEach((c) => {
      out.push({
        id: c.id,
        type: "custom",
        position: { x: c.x, y: c.y },
        data: { kind: c.kind, label: c.label },
        draggable: true,
        style: { width: c.width ?? 212, height: c.height ?? 172 },
      });
    });

    return out;
  }, [layout, busy, mediaVersion, customNodes]);

  const rfEdges = useMemo<Edge[]>(() => {
    const out: Edge[] = layout.edges.map((e) => ({
      id: e.key,
      source: e.source,
      target: e.target,
      sourceHandle: e.dir === "h" ? "r" : "b",
      targetHandle: e.dir === "h" ? "l" : "t",
      animated: !e.on,
      selectable: false,
      deletable: false,
      style: {
        stroke: e.on ? ACCENT : "var(--hair)",
        strokeWidth: e.on ? 2.5 : 1.5,
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
        markerEnd: { type: MarkerType.ArrowClosed, color: ACCENT, width: 18, height: 18 },
        deletable: true,
      });
    });

    return out;
  }, [layout, customEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  // Auto-frame the timeline: a smooth entrance once the nodes are measured, then
  // reframes as new nodes stream in — until the user takes manual control.
  const nodesInitialized = useNodesInitialized();
  const [revealed, setRevealed] = useState(false);
  const interacted = useRef(false);
  const programmatic = useRef(false);
  const entered = useRef(false);
  const prevCount = useRef(-1);

  const fit = useCallback(
    (duration = 520) => {
      programmatic.current = true;
      rf.fitView({ padding: 0.18, duration, maxZoom: 1 });
    },
    [rf]
  );

  const onMoveStart = useCallback(() => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    interacted.current = true;
  }, []);

  useEffect(() => {
    if (!nodesInitialized) return;
    const count = layout.nodes.length;
    if (!entered.current) {
      // Center the whole timeline first (instant, while still hidden), then fade
      // the canvas in — so the unframed top-left state is never shown on entry.
      entered.current = true;
      prevCount.current = count;
      fit(0);
      const id = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(id);
    }
    if (count !== prevCount.current) {
      prevCount.current = count;
      if (!interacted.current) fit(440);
    }
  }, [nodesInitialized, layout.nodes.length, fit]);

  // Safety net: if initialization never reports, still frame + reveal the canvas.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!entered.current) {
        entered.current = true;
        fit(0);
      }
      setRevealed(true);
    }, 700);
    return () => window.clearTimeout(t);
  }, [fit]);

  useImperativeHandle(
    innerRef,
    () => ({
      fit: () => {
        interacted.current = false;
        fit();
      },
    }),
    [fit]
  );

  // Pan/zoom to a node focused from the Layers panel.
  useEffect(() => {
    if (!focusKey) return;
    if (!rf.getNode(focusKey)) return;
    interacted.current = true;
    rf.fitView({ nodes: [{ id: focusKey }], duration: 400, padding: 0.6, maxZoom: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      connect(c.source, c.target, c.sourceHandle ?? undefined, c.targetHandle ?? undefined);
    },
    [connect]
  );

  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: Node) => {
      if (node.type === "custom") {
        updateNodePosition(node.id, node.position.x, node.position.y);
      }
    },
    [updateNodePosition]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== "pipeline") return;
      const n = (node.data as PipelineData).gnode;
      select(n.key, { additive: event.shiftKey });
    },
    [select]
  );

  const onNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      if (node.type !== "pipeline") return;
      const n = (node.data as PipelineData).gnode;
      if (n.kind === "clip" && n.video) onPlayFilm(n.video, n.label || n.title);
      if (n.kind === "film") {
        if (n.video) onPlayFilm(n.video, n.title);
        else openFinalize();
      }
    },
    [onPlayFilm, openFinalize]
  );

  const onPaneClick = useCallback(() => select(null), [select]);

  return (
    <div
      className="relative flex-1 min-h-0"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? "scale(1)" : "scale(0.975)",
        transformOrigin: "center",
        transition: "opacity 650ms ease-out, transform 650ms ease-out",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        panOnScroll={false}
        zoomOnScroll
        selectionOnDrag={false}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(242,238,230,0.13)"
        />
      </ReactFlow>

      <div
        className="nopan absolute top-3.5 right-3.5 z-[8] flex gap-0.5 p-1 rounded-btn bg-glass border border-hair backdrop-blur-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button className={ZOOM_BTN} onClick={() => rf.zoomOut({ duration: 200 })} title="Zoom out">
          <Icon name="minus" size={16} />
        </button>
        <button
          className={ZOOM_BTN}
          onClick={() => {
            interacted.current = false;
            fit();
          }}
          title="Fit"
        >
          <Icon name="fit" size={15} />
        </button>
        <button className={ZOOM_BTN} onClick={() => rf.zoomIn({ duration: 200 })} title="Zoom in">
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}
