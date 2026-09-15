"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  Eraser,
  Highlighter,
  LoaderCircle,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import type Konva from "konva";
import { Stage, Layer, Image as KImage, Line } from "react-konva";
import styles from "./ScribbleEditor.module.css";

export type ScribbleLine = {
  points: number[];
  color: string;
  size: number;
  erase?: boolean;
  tool?: "pencil" | "highlighter" | "eraser";
};
export type ScribbleExport = { toDataURL: () => string | null };
type Drawing = {
  lines: ScribbleLine[];
  past: ScribbleLine[][];
  future: ScribbleLine[][];
};
type Action =
  | { type: "start"; line: ScribbleLine }
  | { type: "extend"; point: number[] }
  | { type: "undo" | "redo" | "clear" };
function drawingReducer(state: Drawing, action: Action): Drawing {
  if (action.type === "start")
    return {
      lines: [...state.lines, action.line],
      past: [...state.past, state.lines],
      future: [],
    };
  if (action.type === "extend") {
    const last = state.lines[state.lines.length - 1];
    return last
      ? {
          ...state,
          lines: [
            ...state.lines.slice(0, -1),
            { ...last, points: [...last.points, ...action.point] },
          ],
        }
      : state;
  }
  if (action.type === "undo" && state.past.length)
    return {
      lines: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.lines, ...state.future],
    };
  if (action.type === "redo" && state.future.length)
    return {
      lines: state.future[0],
      past: [...state.past, state.lines],
      future: state.future.slice(1),
    };
  if (action.type === "clear" && state.lines.length)
    return { lines: [], past: [...state.past, state.lines], future: [] };
  return state;
}

type Props = {
  src: string;
  width?: number;
  brushSize?: number;
  brushColor?: string;
  lines?: ScribbleLine[];
  onChangeLines?: (lines: ScribbleLine[]) => void;
  exportRef?: { current: ScribbleExport | null };
  disabled?: boolean;
};

export default function ScribbleEditor(props: Props) {
  return <DrawingEditor key={props.src} {...props} />;
}

function DrawingEditor({
  src,
  width,
  brushSize = 3,
  brushColor = "#c4a9ff",
  lines = [],
  onChangeLines,
  exportRef,
  disabled = false,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [bounds, setBounds] = useState({ width: width || 640, height: 400 });
  const [drawing, dispatch] = useReducer(drawingReducer, {
    lines,
    past: [],
    future: [],
  });
  const [tool, setTool] = useState<"pencil" | "highlighter" | "eraser">(
    "pencil",
  );
  const [color, setColor] = useState(brushColor);
  const [size, setSize] = useState(brushSize);
  const locked = disabled || !image;
  const changeRef = useRef(onChangeLines);
  changeRef.current = onChangeLines;

  useEffect(() => {
    changeRef.current?.(drawing.lines);
  }, [drawing.lines]);
  useEffect(() => {
    const next = new window.Image();
    next.crossOrigin = "anonymous";
    let cancelled = false;
    setLoadError(false);
    setImage(null);
    next.onload = () => {
      if (!cancelled) setImage(next);
    };
    next.onerror = () => {
      if (!cancelled) setLoadError(true);
    };
    next.src = src;
    return () => {
      cancelled = true;
      next.onload = null;
      next.onerror = null;
    };
  }, [src, loadAttempt]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setBounds({
        width: Math.max(
          1,
          Math.min(width || Infinity, entry.contentRect.width),
        ),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  const imageWidth = image?.naturalWidth || 1;
  const imageHeight = image?.naturalHeight || 1;
  const scale = Math.min(
    bounds.width / imageWidth,
    bounds.height / imageHeight,
    1,
  );
  const displayWidth = Math.max(1, imageWidth * scale);
  const displayHeight = Math.max(1, imageHeight * scale);

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = {
      toDataURL: () => {
        if (!stageRef.current || !image) return null;
        try {
          // Preserve the full image and its proportions, independent of preview size.
          const exportScale = Math.min(
            1,
            2048 / Math.max(imageWidth, imageHeight),
          );
          return stageRef.current.toDataURL({
            pixelRatio: exportScale / scale,
            mimeType: "image/png",
          });
        } catch {
          return null;
        }
      },
    };
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, image, imageWidth, imageHeight, scale]);

  const imagePoint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(imageWidth, (event.clientX - rect.left) / scale)),
      Math.max(0, Math.min(imageHeight, (event.clientY - rect.top) / scale)),
    ];
  };
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (
      locked ||
      pointer.current !== null ||
      event.button !== 0 ||
      (tool === "eraser" && !drawing.lines.length)
    )
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = event.pointerId;
    const point = imagePoint(event);
    dispatch({
      type: "start",
      line: {
        points: [...point, ...point],
        color,
        size:
          (tool === "highlighter"
            ? size * 4
            : tool === "eraser"
              ? size * 5
              : size) / scale,
        erase: tool === "eraser",
        tool,
      },
    });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId || locked) return;
    dispatch({ type: "extend", point: imagePoint(event) });
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const historyAction = (type: "undo" | "redo" | "clear") => {
    if (!disabled) {
      pointer.current = null;
      dispatch({ type });
    }
  };

  return (
    <div
      className={styles.editor}
      onKeyDown={(event) => {
        if (
          disabled ||
          (event.target as HTMLElement).closest("input, textarea, select")
        )
          return;
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault();
          historyAction(event.shiftKey ? "redo" : "undo");
        } else if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "y"
        ) {
          event.preventDefault();
          historyAction("redo");
        } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          const tools = { p: "pencil", h: "highlighter", e: "eraser" } as const;
          const next = tools[event.key.toLowerCase() as keyof typeof tools];
          if (next) {
            event.preventDefault();
            setTool(next);
          }
        }
      }}
    >
      <div className={styles.toolbar} role="toolbar" aria-label="Drawing tools">
        <div className={styles.tools}>
          {(
            [
              { id: "pencil", label: "Pen", key: "P", icon: Pencil },
              {
                id: "highlighter",
                label: "Highlighter",
                key: "H",
                icon: Highlighter,
              },
              { id: "eraser", label: "Eraser", key: "E", icon: Eraser },
            ] as const
          ).map(({ id, label, key, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              title={`${label} · ${key}`}
              aria-pressed={tool === id}
              disabled={locked}
              onClick={() => setTool(id)}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <div className={styles.colors} role="group" aria-label="Drawing color">
          {[
            { value: "#c4a9ff", name: "Lavender" },
            { value: "#ffb68c", name: "Peach" },
            { value: "#f1f0f5", name: "White" },
          ].map((swatch) => (
            <button
              key={swatch.value}
              className={styles.swatch}
              style={{ background: swatch.value }}
              aria-label={swatch.name}
              aria-pressed={color === swatch.value}
              title={swatch.name}
              disabled={locked || tool === "eraser"}
              onClick={() => setColor(swatch.value)}
            />
          ))}
          <input
            aria-label="Custom drawing color"
            title="Custom color"
            type="color"
            value={color}
            disabled={locked || tool === "eraser"}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
        <label className={styles.brush}>
          <span>Size</span>
          <input
            type="range"
            aria-label="Stroke width"
            min={1}
            max={12}
            step={1}
            value={size}
            disabled={locked}
            onChange={(event) => setSize(Number(event.target.value))}
          />
          <span>{size}</span>
        </label>
        <div className={styles.history}>
          <button
            aria-label="Undo drawing"
            title="Undo · ⌘Z"
            disabled={disabled || !drawing.past.length}
            onClick={() => historyAction("undo")}
          >
            <Undo2 size={15} />
          </button>
          <button
            aria-label="Redo drawing"
            title="Redo · ⇧⌘Z"
            disabled={disabled || !drawing.future.length}
            onClick={() => historyAction("redo")}
          >
            <Redo2 size={15} />
          </button>
          <span />
          <button
            aria-label="Clear drawing"
            title="Clear drawing"
            disabled={disabled || !drawing.lines.length}
            onClick={() => historyAction("clear")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className={styles.workArea}>
        <div className={styles.viewport} ref={viewportRef}>
          {image ? (
            <div
              className={styles.surface}
              style={{
                width: displayWidth,
                height: displayHeight,
                cursor: disabled ? "wait" : "crosshair",
              }}
              role="img"
              aria-label="Image to annotate"
              tabIndex={0}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={finish}
              onLostPointerCapture={() => {
                pointer.current = null;
              }}
            >
              <Stage
                ref={stageRef}
                width={displayWidth}
                height={displayHeight}
                scaleX={scale}
                scaleY={scale}
                listening={false}
              >
                <Layer listening={false}>
                  <KImage
                    image={image}
                    x={0}
                    y={0}
                    width={imageWidth}
                    height={imageHeight}
                  />
                </Layer>
                <Layer listening={false}>
                  {drawing.lines.map((line, i) => (
                    <Line
                      key={i}
                      points={line.points}
                      stroke={line.color}
                      strokeWidth={line.size}
                      opacity={line.tool === "highlighter" ? 0.45 : 1}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        line.erase || line.tool === "eraser"
                          ? "destination-out"
                          : "source-over"
                      }
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
          ) : (
            <div className={styles.state} role={loadError ? "alert" : "status"}>
              {loadError ? (
                <>
                  <span>We couldn’t load this image.</span>
                  <button
                    onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                  >
                    <RotateCcw size={13} />
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle size={18} />
                  <span>Loading image…</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
