"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useState } from "react";
import { ChevronDown, FileText, Image as ImageIcon, Users } from "lucide-react";

export function ContextCards({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const project = (data.project || {}) as Record<string, unknown>;
  const characters = Array.isArray(data.characters)
    ? (data.characters as Array<Record<string, unknown>>)
    : [];
  const objects = Array.isArray(data.objects)
    ? (data.objects as Array<Record<string, unknown>>)
    : [];
  const scenes = Array.isArray(data.scenes)
    ? (data.scenes as Array<Record<string, unknown>>)
    : [];
  const references = Array.isArray(data.references)
    ? (data.references as Array<Record<string, unknown>>)
    : [];
  const inheritance = Array.isArray(data.inheritance) ? data.inheritance : [];
  const count =
    characters.length + objects.length + scenes.length + references.length + 1;
  if (count === 1) {
    return (
      <div className="agent-context-summary">
        <span>Context used</span>
        <small>{String(project.title || "Project brief")}</small>
      </div>
    );
  }
  return (
    <section className="agent-context">
      <button
        className="agent-context__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>Context used</span>
        <span>
          {count} sources{" "}
          <ChevronDown size={13} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && (
        <div className="agent-context__body">
          <ContextRow
            icon={<FileText size={13} />}
            title={String(project.title || "Project brief")}
            detail={String(
              project.summary || project.plot || "Project summary and plot",
            )}
          />
          {characters.length > 0 && (
            <ContextRow
              icon={<Users size={13} />}
              title={`${characters.length} referenced character${characters.length === 1 ? "" : "s"}`}
              detail={characters
                .map((item) => item.name)
                .filter(Boolean)
                .join(", ")}
            />
          )}
          {objects.length > 0 && (
            <ContextRow
              icon={<ImageIcon size={13} />}
              title={`${objects.length} story object${objects.length === 1 ? "" : "s"}`}
              detail={objects
                .map((item) => item.type)
                .filter(Boolean)
                .join(", ")}
            />
          )}
          {scenes.length > 0 && (
            <ContextRow
              icon={<FileText size={13} />}
              title={`${scenes.length} current scene${scenes.length === 1 ? "" : "s"}`}
              detail={scenes
                .map((item) => item.title || item.concise_plot)
                .filter(Boolean)
                .join(", ")}
            />
          )}
          {references.length > 0 && (
            <ContextRow
              icon={<ImageIcon size={13} />}
              title={`${references.length} visual reference${references.length === 1 ? "" : "s"}`}
              detail={references
                .map((item) => item.name)
                .filter(Boolean)
                .join(", ")}
            />
          )}
          {inheritance.length > 0 && (
            <p className="agent-context__note">
              Inherited: {inheritance.join(" → ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ContextRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="agent-context-row">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}
