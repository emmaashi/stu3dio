import { describe, expect, it } from "vitest";
import {
  NEW_FILM_CHARACTERS,
  NEW_FILM_FINAL_VIDEO,
  NEW_FILM_PROMPT,
  NEW_FILM_SCENES,
  NEW_FILM_SHOT_COUNTS,
  NEW_FILM_TITLE,
  NEW_FILM_TOTAL_SHOTS,
} from "@/films/tears-of-steel/newFilm";
import {
  DEMO_CHARACTERS,
  DEMO_FINAL_FILM_SRC,
  DEMO_FRAMES,
  DEMO_SCENES,
} from "@/films/tears-of-steel";
import { handleMock, setMockEnabled } from "@/films/mockBackend";

async function newProject() {
  setMockEnabled(true);
  return handleMock("POST", "/api/projects", {
    title: "demo",
    summary: "",
    plot: "",
  });
}

describe("new-film demo fixture", () => {
  it("is Tears of Steel, sourced from the demo film", () => {
    expect(NEW_FILM_TITLE).toBe("Tears of Steel");
    expect(NEW_FILM_FINAL_VIDEO).toBe(DEMO_FINAL_FILM_SRC);
  });

  it("carries the whole cast, with real portraits", () => {
    expect(NEW_FILM_CHARACTERS).toHaveLength(DEMO_CHARACTERS.length);
    expect(NEW_FILM_CHARACTERS.map((c) => c.name)).toEqual(
      DEMO_CHARACTERS.map((c) => c.metadata.name)
    );
    // Regression: the canvas used to show i.pravatar.cc stock faces here.
    for (const character of NEW_FILM_CHARACTERS) {
      expect(character.media).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(character.media).not.toMatch(/pravatar|unsplash/);
    }
  });

  it("carries every scene with its own real shots and captions", () => {
    expect(NEW_FILM_SCENES).toHaveLength(DEMO_SCENES.length);
    expect(NEW_FILM_TOTAL_SHOTS).toBe(DEMO_FRAMES.length);
    // Shot counts vary per scene exactly as they do in the film.
    expect(NEW_FILM_SHOT_COUNTS).toEqual([1, 1, 3, 2, 3, 2, 1, 2, 1, 3]);
    for (const scene of NEW_FILM_SCENES) {
      expect(scene.shots.length).toBeGreaterThan(0);
      for (const shot of scene.shots) {
        expect(shot.still).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
        expect(shot.caption).toBeTruthy();
      }
    }
  });

  it("serves the named cast on the director path", async () => {
    const project = await newProject();
    const res = await handleMock("POST", "/api/director/converse", {
      project_id: project.id,
      message: NEW_FILM_PROMPT,
    });
    const names = res.characters.map((c: { name: string }) => c.name);
    expect(names).toContain("Thom");
    expect(names).toContain("Celia");
    for (const archetype of ["The Lead", "The Counterpart", "The Witness"]) {
      expect(names).not.toContain(archetype);
    }
  });

  it("serves the same cast on the orchestration path, with no fixed-setting rows", async () => {
    const project = await newProject();
    const run = await handleMock(
      "POST",
      `/api/projects/${project.id}/agent-runs`,
      { kind: "create-film", prompt: NEW_FILM_PROMPT }
    );

    let approval = null;
    for (let i = 0; i < 80 && !approval; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const current = await handleMock("GET", `/api/agent-runs/${run.id}`, null);
      approval = current.approval ?? null;
    }
    expect(approval, "concept approval never arrived").toBeTruthy();

    const names = (approval.values.characters as Array<{ name: string }>).map(
      (c) => c.name
    );
    expect(names).toContain("Thom");
    expect(approval.values.title).toBe(NEW_FILM_TITLE);

    // The row was dropped from the approval form, but the value still rides
    // along in `values` for the assembly summary and the video worker.
    const fieldIds = (approval.fields as Array<{ id: string }>).map((f) => f.id);
    expect(fieldIds).not.toContain("aspect_ratio");
    expect(fieldIds).not.toContain("runtime_seconds");
    expect(approval.values.aspect_ratio).toBe("16:9");
    expect(approval.values.runtime_seconds).toBe(64);
  });

  it("generates the whole film, not a three-scene cut", async () => {
    const project = await newProject();

    // The gated flow loops three times with its own target_frames; the mock
    // should still build all ten scenes with the film's real shot counts.
    for (let i = 1; i <= 3; i++) {
      await handleMock("POST", "/api/jobs/scene-generation", {
        project_id: project.id,
        scene_order: i,
        target_frames: [3, 2, 3][i - 1],
      });
    }

    let status = null;
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 50));
      status = await handleMock("GET", `/api/projects/${project.id}/complete`, null);
      if (status.frames.length >= NEW_FILM_TOTAL_SHOTS) break;
    }

    expect(status.scenes).toHaveLength(NEW_FILM_SCENES.length);
    expect(status.frames).toHaveLength(NEW_FILM_TOTAL_SHOTS);

    // Shots land under the right scene, with the film's own captions.
    const bySceneOrder = NEW_FILM_SCENES.map(
      (_, i) => status.frames.filter((f: { metadata: { scene_order: number } }) =>
        f.metadata.scene_order === i + 1).length
    );
    expect(bySceneOrder).toEqual(NEW_FILM_SHOT_COUNTS);
    expect(
      status.frames.map((f: { metadata: { concise_plot: string } }) => f.metadata.concise_plot)
    ).toContain("Celia and her fallen steel");
  }, 20000);
});
