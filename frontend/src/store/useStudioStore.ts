import { create } from "zustand";

// UI state for the Studio canvas workspace: which node is selected, the bottom
// dock's image/video sub-mode, and the fullscreen film-player request.
type StudioUIState = {
  selectedKey: string | null;
  selectedKeys: string[];
  // A focus request: select a node AND pan/zoom the canvas to it. The nonce lets
  // the canvas react even when the same node is clicked twice.
  focusKey: string | null;
  focusNonce: number;
  frameMode: "image" | "video";
  player: { src: string; title: string } | null;
  finalizeOpen: boolean;
  select: (key: string | null, options?: { additive?: boolean }) => void;
  setSelection: (keys: string[]) => void;
  focus: (key: string, options?: { additive?: boolean }) => void;
  setFrameMode: (m: "image" | "video") => void;
  openPlayer: (src: string, title: string) => void;
  closePlayer: () => void;
  openFinalize: () => void;
  closeFinalize: () => void;
};

export const useStudioStore = create<StudioUIState>((set) => ({
  selectedKey: null,
  selectedKeys: [],
  focusKey: null,
  focusNonce: 0,
  frameMode: "image",
  player: null,
  finalizeOpen: false,
  select: (key, options) =>
    set((state) => {
      if (!key) return { selectedKey: null, selectedKeys: [] };
      if (!options?.additive) return { selectedKey: key, selectedKeys: [key] };
      const alreadySelected = state.selectedKeys.includes(key);
      const selectedKeys = alreadySelected
        ? state.selectedKeys.filter((selected) => selected !== key)
        : [...state.selectedKeys, key];
      return {
        selectedKey: alreadySelected
          ? selectedKeys[selectedKeys.length - 1] || null
          : key,
        selectedKeys,
      };
    }),
  setSelection: (keys) => {
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    set({
      selectedKey: uniqueKeys[uniqueKeys.length - 1] || null,
      selectedKeys: uniqueKeys,
    });
  },
  focus: (key, options) =>
    set((state) => {
      const alreadySelected = state.selectedKeys.includes(key);
      const selectedKeys = options?.additive
        ? alreadySelected
          ? state.selectedKeys.filter((selected) => selected !== key)
          : [...state.selectedKeys, key]
        : [key];
      return {
        selectedKey: options?.additive && alreadySelected
          ? selectedKeys[selectedKeys.length - 1] || null
          : key,
        selectedKeys,
        focusKey: key,
        focusNonce: state.focusNonce + 1,
      };
    }),
  setFrameMode: (m) => set({ frameMode: m }),
  openPlayer: (src, title) => set({ player: { src, title } }),
  closePlayer: () => set({ player: null }),
  openFinalize: () => set({ finalizeOpen: true }),
  closeFinalize: () => set({ finalizeOpen: false }),
}));
