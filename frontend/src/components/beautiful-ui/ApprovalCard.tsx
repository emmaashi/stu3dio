"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useEffect, useState } from "react";
import { Check, LoaderCircle, PencilLine, X } from "lucide-react";
import type { AgentApproval, AgentApprovalField } from "@/types/agent";

type Props = {
  approval: AgentApproval;
  busy?: boolean;
  onApprove: (values: Record<string, unknown>) => void;
  onRevise: (values: Record<string, unknown>, feedback: string) => void;
  onCancel: () => void;
};

export function ApprovalCard({ approval, busy = false, onApprove, onRevise, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(approval.values);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const fields = approval.fields || [];

  useEffect(() => {
    setValues(approval.values);
    setRevisionOpen(false);
    setFeedback("");
  }, [approval.id, approval.values]);

  const complete = fields.every((field) => !field.required || hasValue(values[field.id]));
  const update = (id: string, value: unknown) => setValues((state) => ({ ...state, [id]: value }));
  const approveLabel = approval.kind === "concept" ? "Approve concept" : approval.kind === "production_plan" ? "Approve plan" : "Start assembly";

  return (
    <section className="agent-card agent-approval" aria-label={approval.title}>
      <header className="agent-approval__intro">
        <div className="agent-approval__eyebrow"><span aria-hidden="true" />Review required <small>{approval.kind.replace("_", " ")}</small></div>
        <h3>{approval.title}</h3>
        <p>{approval.description}</p>
      </header>
      <div className={`agent-approval__body ${fields.length === 0 ? "agent-approval__body--assembly" : ""}`}>
        {fields.length > 0 ? (
          <div className="agent-approval__fields">
            {fields.map((field) => <div className={`agent-approval__field agent-approval__field--${field.type}`} key={field.id}>
              <label htmlFor={`approval-${approval.id}-${field.id}`}>{field.label}{field.required && <span aria-label="required">Required</span>}</label>
              <ApprovalField id={`approval-${approval.id}-${field.id}`} field={field} value={values[field.id]} onChange={(value) => update(field.id, value)} />
            </div>)}
          </div>
        ) : (
          <AssemblySummary values={values} />
        )}
        {revisionOpen && (
          <div className="agent-revision-box">
            <label htmlFor={`revision-${approval.id}`}>What should change?</label>
            <textarea id={`revision-${approval.id}`} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Adjust the tone, pacing, cast, or a specific shot…" autoFocus />
          </div>
        )}
      </div>
      <footer className="agent-approval__actions">
        <button className="agent-button agent-button--ghost" onClick={onCancel} disabled={busy}><X size={14} />Cancel</button>
        {revisionOpen ? (
          <button className="agent-button agent-button--secondary" onClick={() => onRevise(values, feedback)} disabled={busy || !feedback.trim()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <PencilLine size={14} />}Send revision</button>
        ) : (
          <button className="agent-button agent-button--secondary" onClick={() => setRevisionOpen(true)} disabled={busy}><PencilLine size={14} />Request changes</button>
        )}
        <button className="agent-button agent-button--primary" onClick={() => onApprove(values)} disabled={busy || !complete}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{approveLabel}</button>
      </footer>
    </section>
  );
}

function ApprovalField({ id, field, value, onChange }: { id: string; field: AgentApprovalField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "textarea") {
    const text = String(value || "");
    return <textarea id={id} className="agent-field" rows={Math.min(18, Math.max(6, Math.ceil(text.length / 44)))} value={text} onChange={(event) => onChange(event.target.value)} />;
  }
  if (field.type === "text") return <input id={id} className="agent-field" value={String(value || "")} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === "number") return <input id={id} className="agent-field" type="number" value={Number(value || 0)} onChange={(event) => onChange(Number(event.target.value))} />;
  if (field.type === "single-select") {
    return <div id={id} className="agent-choice-grid" role="group" aria-label={field.label}>{field.options?.map((option) => <button key={String(option)} className={String(value) === String(option) ? "is-selected" : ""} onClick={() => onChange(option)}>{String(option)}</button>)}</div>;
  }
  if (field.type === "multi-select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <div id={id} className="agent-choice-grid" role="group" aria-label={field.label}>{field.options?.map((option) => {
      const optionValue = String(option);
      const active = selected.includes(optionValue);
      return <button key={optionValue} className={active ? "is-selected" : ""} aria-pressed={active} onClick={() => onChange(active ? selected.filter((item) => item !== optionValue) : [...selected, optionValue])}>{optionValue}</button>;
    })}</div>;
  }
  if (field.type === "summary-list") {
    const items = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
    return <div id={id} className="agent-summary-list">{items.map((item, index) => <div className="agent-summary-row" key={`${String(item.name)}-${index}`}><span>{String(item.name || `Character ${index + 1}`)}</span><small>{String(item.role || item.description || "")}</small></div>)}</div>;
  }
  if (field.type === "scene-plan") {
    const scenes = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
    return <div id={id} className="agent-scene-plan">{scenes.map((scene, index) => <div className="agent-scene-plan__row" key={String(scene.id || index)}><span className="agent-scene-number">{index + 1}</span><div><strong>{String(scene.title || `Scene ${index + 1}`)}</strong><textarea aria-label={`${String(scene.title || `Scene ${index + 1}`)} direction`} rows={Math.min(12, Math.max(4, Math.ceil(String(scene.detailed_plot || "").length / 48)))} value={String(scene.detailed_plot || "")} onChange={(event) => onChange(scenes.map((item, itemIndex) => itemIndex === index ? { ...item, detailed_plot: event.target.value } : item))} /><small>{String(scene.target_frames || 0)} shots · {String(scene.duration || 0)}s</small></div></div>)}</div>;
  }
  return <pre className="agent-json-preview">{JSON.stringify(value, null, 2)}</pre>;
}

function AssemblySummary({ values }: { values: Record<string, unknown> }) {
  return <div className="agent-assembly-summary"><strong>{String(values.clips || 0)} clips · {String(values.runtime_seconds || 0)} seconds</strong><span>{String(values.aspect_ratio || "16:9")} · Audio {String(values.audio || "generated")}</span></div>;
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}
