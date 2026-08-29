"use client";

/** Adapted from Beautiful UI's Prompt Bar (MIT): github.com/slev12397/beautiful-ui */
import { useMemo, useRef, useState } from "react";
import { ArrowUp, AtSign, ImagePlus, Link2, LoaderCircle, Plus, Slash, X } from "lucide-react";
import type { AgentAttachment } from "@/types/agent";

type ContextOption = { id: string; label: string; kind: "character" | "object" | "scene" };
type Menu = "sources" | "mentions" | "commands" | null;
type Suggestion = {
  id: string;
  label: string;
  detail: string;
  action: "upload" | "mention" | "command";
};

const COMMANDS: Suggestion[] = [
  { id: "plan", label: "/plan scenes", detail: "Build or revise the shot plan", action: "command" },
  { id: "assemble", label: "/assemble film", detail: "Prepare the approved clips for assembly", action: "command" },
];

export function PromptBar({
  disabled,
  hero,
  placeholder = "Message the agent…",
  suggestions: starterSuggestions = [],
  context,
  contexts = [],
  contextOptions = [],
  allowExtras = true,
  onUploadAttachment,
  onSend,
}: {
  disabled?: boolean;
  hero?: boolean;
  placeholder?: string;
  suggestions?: string[];
  context?: { label: string; onClear?: () => void };
  contexts?: Array<{ id: string; label: string; onClear?: () => void }>;
  contextOptions?: ContextOption[];
  allowExtras?: boolean;
  onUploadAttachment?: (file: File) => Promise<AgentAttachment>;
  onSend: (text: string, attachments: AgentAttachment[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Array<AgentAttachment & { uploading?: boolean; error?: string }>>([]);
  const [menu, setMenu] = useState<Menu>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    const contextRows = contextOptions.slice(0, 6).map((option) => ({
      id: option.id,
      label: option.label,
      detail: option.kind,
      action: "mention" as const,
    }));
    if (menu === "commands") return COMMANDS;
    if (menu === "sources") {
      return [
        { id: "upload", label: "Add reference image", detail: "PNG, JPEG, or WebP", action: "upload" as const },
        ...contextRows,
      ];
    }
    return contextRows;
  }, [contextOptions, menu]);

  const uploading = attachments.some((attachment) => attachment.uploading);
  const canSend = !!draft.trim() && !disabled && !uploading;

  const submit = () => {
    const value = draft.trim();
    if (!value || disabled || uploading) return;
    const readyAttachments = attachments.filter((attachment) => !attachment.error && attachment.url);
    setDraft("");
    setAttachments([]);
    setMenu(null);
    onSend(value, readyAttachments);
  };

  const attach = async (files: FileList | null) => {
    if (!files || !onUploadAttachment) return;
    for (const file of Array.from(files).slice(0, Math.max(0, 4 - attachments.length))) {
      const id = crypto.randomUUID();
      setAttachments((items) => [...items, { id, name: file.name, url: "", mime_type: file.type, size: file.size, uploading: true }]);
      try {
        const uploaded = await onUploadAttachment(file);
        setAttachments((items) => items.map((item) => item.id === id ? uploaded : item));
      } catch (error) {
        setAttachments((items) => items.map((item) => item.id === id ? { ...item, uploading: false, error: error instanceof Error ? error.message : "Upload failed" } : item));
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const choose = (suggestion: Suggestion) => {
    if (suggestion.action === "upload") {
      fileInput.current?.click();
    } else if (suggestion.action === "mention") {
      setDraft((value) => `${value.replace(/@[^\s]*$/, "")}@${suggestion.label} `);
    } else {
      setDraft(`${suggestion.label} `);
    }
    setMenu(null);
    input.current?.focus();
  };

  return (
    <div className={`agent-prompt-shell ${hero ? "agent-prompt-shell--hero" : ""}`}>
      {starterSuggestions.length > 0 && (
        <div className="agent-prompt-suggestions" aria-label="Prompt suggestions">
          {starterSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => { setDraft(suggestion); setMenu(null); input.current?.focus(); }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {menu && (
        <div className="agent-prompt-menu" role="listbox" aria-label={menu === "commands" ? "Commands" : "Project sources"}>
          {suggestions.length ? suggestions.map((option) => (
            <button type="button" key={option.id} role="option" aria-selected={false} onClick={() => choose(option)}>
              <span>
                {option.action === "upload" ? <ImagePlus size={13} /> : option.action === "mention" ? <AtSign size={13} /> : <Slash size={13} />}
              </span>
              <div><strong>{option.label}</strong><small>{option.detail}</small></div>
            </button>
          )) : <p>No project context yet</p>}
        </div>
      )}

      <div className="agent-prompt-bar">
        {(context || contexts.length > 0 || attachments.length > 0) && (
          <div className="agent-prompt-meta">
            {context && <div className="agent-prompt-context"><span>{context.label}</span>{context.onClear && <button type="button" onClick={context.onClear} aria-label="Remove context"><X size={11} /></button>}</div>}
            {contexts.map((item) => (
              <div key={item.id} className="agent-prompt-context agent-prompt-context--linked">
                <Link2 size={11} aria-hidden="true" />
                <span>{item.label}</span>
                {item.onClear && <button type="button" onClick={item.onClear} aria-label={`Unlink ${item.label}`}><X size={11} /></button>}
              </div>
            ))}
            {attachments.map((attachment) => (
              <div key={attachment.id} className={`agent-prompt-attachment ${attachment.error ? "has-error" : ""}`}>
                {attachment.uploading ? <LoaderCircle size={11} className="animate-spin" /> : <ImagePlus size={11} />}
                <span title={attachment.error || attachment.name}>{attachment.name}</span>
                <button type="button" onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))} aria-label={`Remove ${attachment.name}`}><X size={10} /></button>
              </div>
            ))}
          </div>
        )}

        <div className={`agent-prompt-row ${allowExtras ? "" : "agent-prompt-row--plain"}`}>
          {allowExtras && <button
              type="button"
              className={`agent-prompt-plus ${menu === "sources" ? "is-active" : ""}`}
              disabled={disabled}
              aria-label="Add attachments and project context"
              aria-expanded={menu === "sources"}
              onClick={() => setMenu((current) => current === "sources" ? null : "sources")}
            >
              <Plus size={17} />
            </button>}
          <textarea
            ref={input}
            rows={1}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-label="Prompt"
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              setMenu(allowExtras && /@[^\s]*$/.test(value) ? "mentions" : allowExtras && /\/[^\s]*$/.test(value) ? "commands" : null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenu(null);
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" className="agent-prompt-send" disabled={!canSend} onClick={submit} aria-label="Send prompt">
            <ArrowUp size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => void attach(event.target.files)} />
    </div>
  );
}
