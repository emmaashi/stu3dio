import type { AgentRunPhase } from "@/types/agent";
import type { StudioGraph } from "./types";

/**
 * What the header's film control should be: a quiet note that a run is in
 * flight, or nothing. Playback lives on the film card in the rail and on the
 * canvas film node; reviews and assembly live in the conversation rail.
 */
export type FilmAction = { kind: "running"; label: string } | { kind: "none" };

export type FilmRunState = {
  runActive: boolean;
  awaitingApproval: boolean;
  runPhase: AgentRunPhase | null;
};

export function resolveFilmAction(
  _graph: Pick<StudioGraph, "overview">,
  state: FilmRunState,
): FilmAction {
  if (state.runActive) {
    return {
      kind: "running",
      label: state.runPhase === "assembly" ? "Assembling…" : "Producing…",
    };
  }
  return { kind: "none" };
}
