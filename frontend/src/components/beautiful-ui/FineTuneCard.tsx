"use client";

/** Adapted from Beautiful UI (MIT): github.com/slev12397/beautiful-ui */
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

export type FineTuneValues = {
  framing: string;
  camera: string;
  style: number;
  emphasis: number;
};

export function FineTuneCard({
  initial,
  disabled,
  onApply,
}: {
  initial?: Partial<FineTuneValues>;
  disabled?: boolean;
  onApply: (values: FineTuneValues) => void;
}) {
  const [values, setValues] = useState<FineTuneValues>({
    framing: "Cinematic wide",
    camera: "Subtle dolly",
    style: 65,
    emphasis: 50,
    ...initial,
  });
  return (
    <section className="agent-card agent-fine-tune">
      <header className="agent-card__header">
        <span>
          <SlidersHorizontal size={14} />
          Fine tune
        </span>
        <span>Selected asset</span>
      </header>
      <label>
        Framing
        <select
          value={values.framing}
          onChange={(event) =>
            setValues({ ...values, framing: event.target.value })
          }
        >
          <option>Cinematic wide</option>
          <option>Medium portrait</option>
          <option>Close-up</option>
          <option>Overhead</option>
        </select>
      </label>
      <label>
        Camera
        <select
          value={values.camera}
          onChange={(event) =>
            setValues({ ...values, camera: event.target.value })
          }
        >
          <option>Subtle dolly</option>
          <option>Locked frame</option>
          <option>Handheld</option>
          <option>Crane movement</option>
        </select>
      </label>
      <label>
        Style intensity <span className="agent-mono">{values.style}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={values.style}
          onChange={(event) =>
            setValues({ ...values, style: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Prompt emphasis <span className="agent-mono">{values.emphasis}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={values.emphasis}
          onChange={(event) =>
            setValues({ ...values, emphasis: Number(event.target.value) })
          }
        />
      </label>
      <button
        className="agent-button agent-button--secondary"
        disabled={disabled}
        onClick={() => onApply(values)}
      >
        Propose adjustment
      </button>
    </section>
  );
}
