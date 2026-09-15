import { describe, expect, it } from "vitest";
import {
  NEW_FILM_CHARACTERS,
  NEW_FILM_FINAL_VIDEO,
  NEW_FILM_PROMPT,
  NEW_FILM_SCENES,
  NEW_FILM_TITLE,
} from "@/films/tears-of-steel/newFilm";
import { DEMO_FINAL_FILM_SRC } from "@/films/tears-of-steel";
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

  it("casts the demo film's characters with real portraits", () => {
    expect(NEW_FILM_CHARACTERS.map((c) => c.name)).toEqual([
      "Thom",
      "Celia",
      "The Engineer",
      "The Soldier",
      "The Sentinel",
    ]);
    // Regression: the canvas used to show i.pravatar.cc stock faces here.
    for (const character of NEW_FILM_CHARACTERS) {
      expect(character.media).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(character.media).not.toMatch(/pravatar|unsplash/);
    }
  });

  it("gives each of the three scenes three distinct stills", () => {
    expect(NEW_FILM_SCENES).toHaveLength(3);
    for (const scene of NEW_FILM_SCENES) {
      expect(scene.shots).toHaveLength(3);
      expect(new Set(scene.shots).size).toBe(3);
      expect(scene.shots).not.toContain(scene.media);
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

  it("serves the same cast on the orchestration path, with no aspect-ratio row", async () => {
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
    expect(approval.values.aspect_ratio).toBe("16:9");
  });
});
