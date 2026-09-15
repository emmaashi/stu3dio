import { describe, expect, it } from "vitest";
import {
  HP_CHARACTERS,
  HP_PROMPT,
  HP_SCENES,
  HP_TITLE,
  hpCharacterByName,
} from "@/films/harry-potter";
import { handleMock, setMockEnabled } from "@/films/mockBackend";

// The demo cast used to come out as "The Lead" / "The Counterpart" / "The
// Witness" on the orchestration path, because it had its own placeholder cast
// separate from the director path's fixture. These tests pin the named cast to
// both paths so that can't regress.
const ARCHETYPES = ["The Lead", "The Counterpart", "The Witness"];

describe("harry potter demo fixture", () => {
  it("casts the named wizarding characters", () => {
    expect(HP_CHARACTERS.map((c) => c.name)).toEqual([
      "Harry Potter",
      "Hermione Granger",
      "Minerva McGonagall",
      "Severus Snape",
      "Albus Dumbledore",
    ]);
  });

  it("uses the quidditch premise as the demo prompt", () => {
    expect(HP_PROMPT).toBe("Harry Potter learns quidditch for the first time");
    expect(HP_TITLE).toBe("Harry Potter and the First Flight");
  });

  it("ends on Harry playing quidditch", () => {
    const last = HP_SCENES[HP_SCENES.length - 1];
    expect(last.title).toBe("His First Match");
    expect(last.concise_plot).toMatch(/quidditch for the first time/i);
  });

  it("resolves characters by partial name", () => {
    expect(hpCharacterByName("Snape")?.name).toBe("Severus Snape");
    expect(hpCharacterByName("dumbledore")?.name).toBe("Albus Dumbledore");
    expect(hpCharacterByName("Voldemort")).toBeUndefined();
  });

  it("gives the director path the named cast", async () => {
    setMockEnabled(true);
    const project = await handleMock("POST", "/api/projects", {
      title: "demo",
      summary: "",
      plot: "",
    });
    const res = await handleMock("POST", "/api/director/converse", {
      project_id: project.id,
      message: HP_PROMPT,
    });
    const names = res.characters.map((c: { name: string }) => c.name);
    expect(names).toContain("Harry Potter");
    expect(names).toContain("Albus Dumbledore");
    for (const archetype of ARCHETYPES) expect(names).not.toContain(archetype);
  });

  it("gives the orchestration path the same named cast", async () => {
    setMockEnabled(true);
    const project = await handleMock("POST", "/api/projects", {
      title: "demo",
      summary: "",
      plot: "",
    });
    const run = await handleMock(
      "POST",
      `/api/projects/${project.id}/agent-runs`,
      { kind: "create-film", prompt: HP_PROMPT }
    );

    // The concept approval is produced a tick after the run is queued.
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
    expect(names).toContain("Harry Potter");
    expect(names).toContain("Severus Snape");
    for (const archetype of ARCHETYPES) expect(names).not.toContain(archetype);
    expect(approval.values.title).toBe(HP_TITLE);
  });
});
