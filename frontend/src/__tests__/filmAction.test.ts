import { describe, expect, it } from "vitest";
import { resolveFilmAction } from "@/components/studio/filmAction";

const idle = {
  runActive: false,
  awaitingApproval: false,
  runPhase: null,
} as const;
const overview = { title: "Signal", summary: "", plot: "" };

describe("header film action", () => {
  it("never offers playback from the header, even once the cut exists", () => {
    const graph = {
      overview: { ...overview, finalVideoUrl: "https://cdn/final.mp4" },
    };
    expect(resolveFilmAction(graph, idle)).toEqual({ kind: "none" });
    expect(
      resolveFilmAction(graph, {
        ...idle,
        runActive: true,
        runPhase: "videos",
      }),
    ).toEqual({
      kind: "running",
      label: "Producing…",
    });
  });

  it("reports a running run by phase and beats a pending review", () => {
    const graph = { overview };
    expect(
      resolveFilmAction(graph, {
        runActive: true,
        awaitingApproval: true,
        runPhase: "assembly",
      }),
    ).toEqual({
      kind: "running",
      label: "Assembling…",
    });
    expect(
      resolveFilmAction(graph, {
        ...idle,
        runActive: true,
        runPhase: "assets",
      }),
    ).toEqual({
      kind: "running",
      label: "Producing…",
    });
  });

  it("offers nothing while a review is pending or when idle", () => {
    const graph = { overview };
    expect(
      resolveFilmAction(graph, { ...idle, awaitingApproval: true }),
    ).toEqual({ kind: "none" });
    expect(resolveFilmAction(graph, idle)).toEqual({ kind: "none" });
    expect(resolveFilmAction({ overview: null }, idle)).toEqual({
      kind: "none",
    });
  });
});
