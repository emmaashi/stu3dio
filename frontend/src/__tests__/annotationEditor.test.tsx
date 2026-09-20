import React, { createRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScribbleEditor, {
  type ScribbleExport,
} from "@/components/ScribbleEditor";
import AnnotateModal from "@/components/studio/AnnotateModal";

const canvas = vi.hoisted(() => ({
  export: vi.fn(),
  stage: {} as Record<string, number>,
}));
vi.mock("react-konva", async () => {
  const React = await import("react");
  return {
    Stage: React.forwardRef(function Stage(
      props: {
        children: React.ReactNode;
        width: number;
        height: number;
        scaleX: number;
      },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({ toDataURL: canvas.export }));
      canvas.stage = {
        width: props.width,
        height: props.height,
        scale: props.scaleX,
      };
      return <div>{props.children}</div>;
    }),
    Layer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Image: () => null,
    Line: () => null,
  };
});

let resize: (
  entries: { contentRect: { width: number; height: number } }[],
) => void;
const imageLoads: {
  onload: null | (() => void);
  onerror: null | (() => void);
}[] = [];
beforeEach(() => {
  canvas.export.mockReset().mockReturnValue("data:image/png;base64,drawing");
  imageLoads.length = 0;
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 1200;
      naturalHeight = 800;
      onload = null;
      onerror = null;
      constructor() {
        imageLoads.push(this);
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: typeof resize) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      constructor(
        type: string,
        options: MouseEventInit & { pointerId?: number },
      ) {
        super(type, options);
        this.pointerId = options.pointerId ?? 1;
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function loadImage(width = 600, height = 400) {
  act(() => {
    resize([{ contentRect: { width, height } }]);
    imageLoads.at(-1)!.onload?.();
  });
}
function draw() {
  const surface = screen.getByRole("img", { name: "Image to annotate" });
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
  } as DOMRect);
  fireEvent.pointerDown(surface, {
    button: 0,
    pointerId: 1,
    clientX: 250,
    clientY: 150,
  });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 400, clientY: 250 });
  fireEvent.pointerUp(surface, { pointerId: 1 });
}

describe("Drawing editor", () => {
  it("fits the original proportions and preserves drawing coordinates and export resolution after resizing", () => {
    const onChange = vi.fn();
    const exportRef = createRef<ScribbleExport>();
    render(
      <ScribbleEditor
        src="/landscape.jpg"
        exportRef={exportRef}
        onChangeLines={onChange}
      />,
    );
    loadImage();
    expect(canvas.stage).toEqual({ width: 600, height: 400, scale: 0.5 });
    draw();
    const drawing = onChange.mock.lastCall![0];
    expect(drawing[0].points).toEqual([300, 200, 300, 200, 600, 400]);
    expect(drawing[0].size).toBe(6);
    act(() => resize([{ contentRect: { width: 300, height: 400 } }]));
    expect(canvas.stage).toEqual({ width: 300, height: 200, scale: 0.25 });
    expect(onChange.mock.lastCall![0]).toEqual(drawing);
    expect(exportRef.current!.toDataURL()).toBe(
      "data:image/png;base64,drawing",
    );
    expect(canvas.export).toHaveBeenCalledWith({
      pixelRatio: 4,
      mimeType: "image/png",
    });
  });

  it("undoes complete gestures, restores a cleared drawing, and drops redo after a new gesture", () => {
    const onChange = vi.fn();
    render(<ScribbleEditor src="/image.jpg" onChangeLines={onChange} />);
    loadImage();
    draw();
    const drawing = onChange.mock.lastCall![0];
    fireEvent.click(screen.getByRole("button", { name: "Undo drawing" }));
    expect(onChange.mock.lastCall![0]).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Redo drawing" }));
    expect(onChange.mock.lastCall![0]).toEqual(drawing);
    fireEvent.click(screen.getByRole("button", { name: "Clear drawing" }));
    expect(onChange.mock.lastCall![0]).toEqual([]);
    fireEvent.keyDown(screen.getByRole("img"), { key: "z", metaKey: true });
    expect(onChange.mock.lastCall![0]).toEqual(drawing);
    draw();
    expect(screen.getByRole("button", { name: "Redo drawing" })).toBeDisabled();
    expect(onChange.mock.lastCall![0]).toHaveLength(2);
  });

  it("recovers from an image loading failure", () => {
    render(<ScribbleEditor src="/image.jpg" />);
    act(() => imageLoads[0].onerror?.());
    expect(screen.getByRole("alert")).toHaveTextContent("couldn’t load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    loadImage();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the prompt and drawing when applying fails, and allows retry", async () => {
    const onApply = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    render(
      <AnnotateModal
        src="/image.jpg"
        title="The Echo"
        busy={false}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );
    loadImage();
    draw();
    const prompt = screen.getByRole("textbox", {
      name: "Describe your drawing",
    });
    fireEvent.change(prompt, {
      target: { value: "Weather the mask.\nKeep the silhouette." },
    });
    fireEvent.keyDown(prompt, { key: "Enter" });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.keyDown(prompt, { key: "Enter", metaKey: true });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your drawing and instructions are still here",
      ),
    );
    expect(onApply).toHaveBeenLastCalledWith(
      "Weather the mask.\nKeep the silhouette.",
      "data:image/png;base64,drawing",
    );
    expect(prompt).toHaveValue("Weather the mask.\nKeep the silhouette.");
    expect(screen.getByRole("button", { name: "Undo drawing" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not silently discard annotations if exporting fails", () => {
    const onApply = vi.fn();
    canvas.export.mockImplementation(() => {
      throw new Error("tainted canvas");
    });
    render(
      <AnnotateModal
        src="/image.jpg"
        busy={false}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );
    loadImage();
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t include your drawing",
    );
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo drawing" })).toBeEnabled();
  });
});
