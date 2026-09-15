import type { ContextOption } from "@/components/beautiful-ui/PromptBar";
import type { StudioGraph } from "./types";

export function buildContextOptions({
  characters,
  objects,
  scenes,
}: Pick<StudioGraph, "characters" | "objects" | "scenes">): ContextOption[] {
  return [
    ...characters.map((character) => ({
      id: character.id,
      label: character.name,
      kind: "character" as const,
    })),
    ...objects.map((object) => ({
      id: object.id,
      label: object.name,
      kind: "object" as const,
    })),
    ...scenes.map((scene) => ({
      id: scene.id,
      label: `Scene ${scene.order}`,
      kind: "scene" as const,
    })),
  ];
}
