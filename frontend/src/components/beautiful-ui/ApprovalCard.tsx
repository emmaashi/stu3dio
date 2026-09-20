"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useEffect, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type { AgentApproval, AgentApprovalField } from "@/types/agent";
import { ScenePlanField } from "./ScenePlanField";

type Props = {
  approval: AgentApproval;
  busy?: boolean;
  onApprove: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  /** Fires on every edit so the host can send edited values with a revision typed elsewhere. */
  onValuesChange?: (values: Record<string, unknown>) => void;
};

export function ApprovalCard({
  approval,
  busy = false,
  onApprove,
  onCancel,
  onValuesChange,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(
    approval.values,
  );
  const fields = approval.fields || [];

  useEffect(() => {
    setValues(approval.values);
  }, [approval.id, approval.values]);

  const complete = fields.every(
    (field) => !field.required || hasValue(values[field.id]),
  );
  const update = (id: string, value: unknown) =>
    setValues((state) => {
      const next = { ...state, [id]: value };
      onValuesChange?.(next);
      return next;
    });
  const approveLabel =
    approval.kind === "concept"
      ? "Approve concept"
      : approval.kind === "production_plan"
        ? "Approve plan"
        : "Start assembly";

  return (
    <section className="agent-card agent-approval" aria-label={approval.title}>
      <header className="agent-approval__intro">
        <div className="agent-approval__eyebrow">
          <span aria-hidden="true" />
          Review required <small>{approval.kind.replace("_", " ")}</small>
        </div>
        <h3>{approval.title}</h3>
        <p>{approval.description}</p>
      </header>
      <div
        className={`agent-approval__body ${fields.length === 0 ? "agent-approval__body--assembly" : ""}`}
      >
        {fields.length > 0 ? (
          <div className="agent-approval__fields">
            {fields.map((field) => (
              <div
                className={`agent-approval__field agent-approval__field--${field.type}`}
                key={field.id}
              >
                <label htmlFor={`approval-${approval.id}-${field.id}`}>
                  {field.label}
                  {field.required && (
                    <span aria-label="required">Required</span>
                  )}
                </label>
                <ApprovalField
                  id={`approval-${approval.id}-${field.id}`}
                  field={field}
                  value={values[field.id]}
                  onChange={(value) => update(field.id, value)}
                />
              </div>
            ))}
          </div>
        ) : (
          <AssemblySummary values={values} />
        )}
      </div>
      <footer className="agent-approval__actions">
        <button
          className="agent-button agent-button--ghost"
          onClick={onCancel}
          disabled={busy}
        >
          <X size={14} />
          Cancel
        </button>
        <button
          className="agent-button agent-button--primary"
          onClick={() => onApprove(values)}
          disabled={busy || !complete}
        >
          {busy ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {approveLabel}
        </button>
      </footer>
    </section>
  );
}

function ApprovalField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: AgentApprovalField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "textarea") {
    const text = String(value || "");
    return (
      <textarea
        id={id}
        className="agent-field"
        rows={Math.min(18, Math.max(6, Math.ceil(text.length / 44)))}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === "text")
    return (
      <input
        id={id}
        className="agent-field"
        value={String(value || "")}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  if (field.type === "number")
    return (
      <input
        id={id}
        className="agent-field"
        type="number"
        value={Number(value || 0)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  if (field.type === "single-select") {
    return (
      <div
        id={id}
        className="agent-choice-grid"
        role="group"
        aria-label={field.label}
      >
        {field.options?.map((option) => (
          <button
            key={String(option)}
            className={String(value) === String(option) ? "is-selected" : ""}
            onClick={() => onChange(option)}
          >
            {String(option)}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === "multi-select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <div
        id={id}
        className="agent-choice-grid"
        role="group"
        aria-label={field.label}
      >
        {field.options?.map((option) => {
          const optionValue = String(option);
          const active = selected.includes(optionValue);
          return (
            <button
              key={optionValue}
              className={active ? "is-selected" : ""}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((item) => item !== optionValue)
                    : [...selected, optionValue],
                )
              }
            >
              {optionValue}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === "summary-list") {
    const items = Array.isArray(value)
      ? (value as Array<Record<string, unknown>>)
      : [];
    return (
      <div id={id} className="agent-summary-list">
        {items.map((item, index) => (
          <div
            className="agent-summary-row"
            key={`${String(item.name)}-${index}`}
          >
            <span>{String(item.name || `Character ${index + 1}`)}</span>
            <small>{String(item.role || item.description || "")}</small>
          </div>
        ))}
      </div>
    );
  }
  if (field.type === "scene-plan") {
    const scenes = Array.isArray(value)
      ? (value as Array<Record<string, unknown>>)
      : [];
    return <ScenePlanField id={id} scenes={scenes} onChange={onChange} />;
  }
  return (
    <pre className="agent-json-preview">{JSON.stringify(value, null, 2)}</pre>
  );
}

function AssemblySummary({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="agent-assembly-summary">
      <strong>
        {String(values.clips || 0)} clips ·{" "}
        {String(values.runtime_seconds || 0)} seconds
      </strong>
      <span>
        {String(values.aspect_ratio || "16:9")} · Audio{" "}
        {String(values.audio || "generated")}
      </span>
    </div>
  );
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}
