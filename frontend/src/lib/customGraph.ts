// localStorage-backed user-drawn cards + connections layered onto the studio
// canvas. Frontend-only: these don't feed the real generation pipeline yet.

export type CustomNodeKind = "character" | "scene" | "idea";

export type CustomNode = {
  id: string;
  kind: CustomNodeKind;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type CustomEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type CustomGraph = { nodes: CustomNode[]; edges: CustomEdge[] };

const EMPTY: CustomGraph = { nodes: [], edges: [] };
const isBrowser = () => typeof window !== "undefined";
const keyFor = (projectId: string) => `stu3dio.customGraph.v1.${projectId}`;

export function loadCustomGraph(projectId: string): CustomGraph {
  if (!isBrowser() || !projectId) return EMPTY;
  try {
    const raw = window.localStorage.getItem(keyFor(projectId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveCustomGraph(projectId: string, graph: CustomGraph) {
  if (!isBrowser() || !projectId) return;
  try {
    window.localStorage.setItem(keyFor(projectId), JSON.stringify(graph));
  } catch {
    /* ignore quota / serialization errors */
  }
}
