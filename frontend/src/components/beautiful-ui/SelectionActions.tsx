"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { WandSparkles } from "lucide-react";

export function SelectionActions({ disabled, onSelect }: { disabled?: boolean; onSelect: (action: "improve" | "shorten" | "tone" | "explain") => void }) {
  return <div className="agent-selection-actions" role="toolbar" aria-label="Rewrite selected text"><WandSparkles size={13} />{(["improve", "shorten", "tone", "explain"] as const).map((action) => <button key={action} disabled={disabled} onClick={() => onSelect(action)}>{action[0].toUpperCase() + action.slice(1)}</button>)}</div>;
}
