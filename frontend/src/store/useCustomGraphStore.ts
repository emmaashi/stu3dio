import { create } from "zustand";
import {
  loadCustomGraph,
  saveCustomGraph,
  type CustomEdge,
  type CustomNode,
  type CustomNodeKind,
} from "@/lib/customGraph";

const uid = (p: string) =>
  `${p}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const DEFAULT_LABEL: Record<CustomNodeKind, string> = {
  character: "New character",
  scene: "New scene",
  idea: "New idea",
};

type CustomGraphState = {
  projectId: string;
  nodes: CustomNode[];
  edges: CustomEdge[];
  load: (projectId: string) => void;
  addNode: (kind: CustomNodeKind, pos?: { x: number; y: number }) => string;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number
  ) => void;
  setLabel: (id: string, label: string) => void;
  setKind: (id: string, kind: CustomNodeKind) => void;
  connect: (
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
};

export const useCustomGraphStore = create<CustomGraphState>((set, get) => {
  const persist = (nodes: CustomNode[], edges: CustomEdge[]) => {
    const { projectId } = get();
    if (projectId) saveCustomGraph(projectId, { nodes, edges });
  };

  return {
    projectId: "",
    nodes: [],
    edges: [],

    load: (projectId) => {
      const g = loadCustomGraph(projectId);
      set({ projectId, nodes: g.nodes, edges: g.edges });
    },

    addNode: (kind, pos) => {
      const count = get().nodes.length;
      const node: CustomNode = {
        id: uid("cn"),
        kind,
        label: DEFAULT_LABEL[kind],
        // Cascade new cards in a row above the pipeline so they land in view.
        x: pos?.x ?? 168 + (count % 5) * 210,
        y: pos?.y ?? -200 - Math.floor(count / 5) * 150,
      };
      const nodes = [...get().nodes, node];
      set({ nodes });
      persist(nodes, get().edges);
      return node.id;
    },

    updateNodePosition: (id, x, y) => {
      const nodes = get().nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
      set({ nodes });
      persist(nodes, get().edges);
    },

    updateNodeSize: (id, width, height, x, y) => {
      const nodes = get().nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              width,
              height,
              ...(x != null ? { x } : {}),
              ...(y != null ? { y } : {}),
            }
          : n
      );
      set({ nodes });
      persist(nodes, get().edges);
    },

    setLabel: (id, label) => {
      const nodes = get().nodes.map((n) => (n.id === id ? { ...n, label } : n));
      set({ nodes });
      persist(nodes, get().edges);
    },

    setKind: (id, kind) => {
      const nodes = get().nodes.map((n) => (n.id === id ? { ...n, kind } : n));
      set({ nodes });
      persist(nodes, get().edges);
    },

    connect: (source, target, sourceHandle, targetHandle) => {
      if (!source || !target || source === target) return;
      const exists = get().edges.some(
        (e) => e.source === source && e.target === target
      );
      if (exists) return;
      const edge: CustomEdge = {
        id: uid("ce"),
        source,
        target,
        sourceHandle,
        targetHandle,
      };
      const edges = [...get().edges, edge];
      set({ edges });
      persist(get().nodes, edges);
    },

    removeNode: (id) => {
      const nodes = get().nodes.filter((n) => n.id !== id);
      const edges = get().edges.filter(
        (e) => e.source !== id && e.target !== id
      );
      set({ nodes, edges });
      persist(nodes, edges);
    },

    removeEdge: (id) => {
      const edges = get().edges.filter((e) => e.id !== id);
      set({ edges });
      persist(get().nodes, edges);
    },
  };
});
