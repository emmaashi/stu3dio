import { create } from "zustand";

// UI state for the Studio canvas workspace: which node is selected, the bottom
// dock's image/video sub-mode, and the fullscreen film-player request.
type StudioUIState = {
  selectedKey: string | null;
  // A focus request: select a node AND pan/zoom the canvas to it. The nonce lets
  // the canvas react even when the same node is clicked twice.
  focusKey: string | null;
  focusNonce: number;
  frameMode: "image" | "video";
  player: { src: string; title: string } | null;
  finalizeOpen: boolean;
  select: (key: string | null) => void;
  focus: (key: string) => void;
  setFrameMode: (m: "image" | "video") => void;
  openPlayer: (src: string, title: string) => void;
  closePlayer: () => void;
  openFinalize: () => void;
  closeFinalize: () => void;
};

export const useStudioStore = create<StudioUIState>((set) => ({
  selectedKey: null,
  focusKey: null,
  focusNonce: 0,
  frameMode: "image",
  player: null,
  finalizeOpen: false,
  select: (key) => set({ selectedKey: key }),
  focus: (key) =>
    set((s) => ({ selectedKey: key, focusKey: key, focusNonce: s.focusNonce + 1 })),
  setFrameMode: (m) => set({ frameMode: m }),
  openPlayer: (src, title) => set({ player: { src, title } }),
  closePlayer: () => set({ player: null }),
  openFinalize: () => set({ finalizeOpen: true }),
  closeFinalize: () => set({ finalizeOpen: false }),
}));
