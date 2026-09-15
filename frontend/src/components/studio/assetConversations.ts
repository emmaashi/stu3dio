import type { ConversationSummary } from "@/components/beautiful-ui/ConversationNav";
import type { AssetSelection } from "./types";

const storageKey = (projectId: string) =>
  `stu3dio:asset-conversations:${projectId}`;

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};
export type AssetConversation = ConversationSummary & {
  selection: Array<{
    key: string;
    label: string;
    kind: AssetSelection["kind"];
  }>;
  messages: ConversationMessage[];
  updatedAt: string;
};

export function conversationTitle(prompt: string) {
  const clean = prompt.replace(/^\/[\w-]+\s*/, "").trim();
  if (!clean) return "Current conversation";
  return clean.length > 34 ? `${clean.slice(0, 34).trimEnd()}…` : clean;
}

export function readAssetConversations(projectId: string): AssetConversation[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey(projectId)) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (conversation) =>
        conversation &&
        typeof conversation.id === "string" &&
        Array.isArray(conversation.selection) &&
        Array.isArray(conversation.messages),
    );
  } catch {
    return [];
  }
}

export function writeAssetConversations(
  projectId: string,
  conversations: AssetConversation[],
) {
  window.localStorage.setItem(
    storageKey(projectId),
    JSON.stringify(conversations),
  );
}

export function toConversationSelection(
  assets: AssetSelection[],
): AssetConversation["selection"] {
  return assets.map(({ key, label, kind }) => ({ key, label, kind }));
}

// Selection order does not change which history or composer draft it belongs to.
export function getSelectionSignature(
  selection: ReadonlyArray<{ key: string }>,
): string {
  return selection
    .map((asset) => asset.key)
    .sort()
    .join("|");
}

export function findAssetConversation(
  conversations: AssetConversation[],
  selection: AssetConversation["selection"],
  selectedId: string | null,
): AssetConversation | undefined {
  const signature = getSelectionSignature(selection);
  const matchesSelection = (conversation: AssetConversation) =>
    getSelectionSignature(conversation.selection) === signature;
  return (
    conversations.find(
      (conversation) =>
        conversation.id === selectedId && matchesSelection(conversation),
    ) || conversations.find(matchesSelection)
  );
}
