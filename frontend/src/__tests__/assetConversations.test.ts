import { beforeEach, describe, expect, it } from "vitest";
import {
  conversationTitle,
  findAssetConversation,
  getSelectionSignature,
  readAssetConversations,
  toConversationSelection,
  writeAssetConversations,
  type AssetConversation,
} from "@/components/studio/assetConversations";
import { EMPTY_GRAPH, resolveAssetSelection } from "@/components/studio/types";

const selection: AssetConversation["selection"] = [
  { key: "char-mara", label: "Mara", kind: "character" },
  { key: "scene-station", label: "Scene 1", kind: "scene" },
];
const conversations: AssetConversation[] = ["newer", "older"].map((id) => ({
  id,
  title: `${id} direction`,
  selection,
  messages: [{ role: "user", content: `${id} prompt` }],
  updatedLabel: "Yesterday",
  updatedAt: "2026-09-01",
}));

describe("Asset conversation history", () => {
  beforeEach(() => window.localStorage.clear());

  it("prefers the chosen historical thread regardless of selection order", () => {
    const reversed = [...selection].reverse();
    expect(findAssetConversation(conversations, reversed, "older")?.id).toBe(
      "older",
    );
    expect(getSelectionSignature(reversed)).toBe(
      getSelectionSignature(selection),
    );
    expect(reversed[0].key).toBe("scene-station");
  });

  it("reuses the first matching thread when the selected thread is absent or unrelated", () => {
    const unrelated = { ...conversations[0], id: "unrelated", selection: [] };
    expect(findAssetConversation(conversations, selection, null)?.id).toBe(
      "newer",
    );
    expect(
      findAssetConversation(
        [unrelated, ...conversations],
        selection,
        "unrelated",
      )?.id,
    ).toBe("newer");
    expect(findAssetConversation(conversations, [], "older")).toBeUndefined();
  });

  it("stores history under the existing project-specific key and preserves all fields", () => {
    writeAssetConversations("signal", conversations);
    expect(
      JSON.parse(
        window.localStorage.getItem("stu3dio:asset-conversations:signal")!,
      ),
    ).toEqual(conversations);
    expect(readAssetConversations("signal")).toEqual(conversations);
    expect(readAssetConversations("another-film")).toEqual([]);
  });

  it.each(["not json", "{}", "null", '[null, {}, {"id": 1}]'])(
    "tolerates invalid stored history: %s",
    (raw) => {
      window.localStorage.setItem("stu3dio:asset-conversations:signal", raw);
      expect(readAssetConversations("signal")).toEqual([]);
    },
  );

  it("keeps valid history entries alongside invalid ones", () => {
    window.localStorage.setItem(
      "stu3dio:asset-conversations:signal",
      JSON.stringify([null, ...conversations, {}]),
    );
    expect(readAssetConversations("signal")).toEqual(conversations);
  });

  it("stores only asset identity and labels in conversation references", () => {
    const asset = resolveAssetSelection(
      {
        ...EMPTY_GRAPH,
        characters: [
          { id: "mara", name: "Mara", role: "Lead", media: "/mara.png" },
        ],
      },
      "char-mara",
    )!;
    expect(toConversationSelection([asset])).toEqual([
      { key: "char-mara", label: "Mara", kind: "character" },
    ]);
  });

  it.each([
    ["/plan scenes", "scenes"],
    ["/assemble", "Current conversation"],
    ["  A quieter ending  ", "A quieter ending"],
    [
      "An unusually long conversation about the story",
      "An unusually long conversation abo…",
    ],
  ])("preserves title formatting for %s", (prompt, title) => {
    expect(conversationTitle(prompt)).toBe(title);
  });
});
