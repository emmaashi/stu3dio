"use client";

import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { formatDuration } from "@/lib/productionProgress";
import { Collapse } from "./Collapse";

type PlanScene = Record<string, unknown>;

type Props = {
  id: string;
  scenes: PlanScene[];
  onChange: (scenes: PlanScene[]) => void;
};

const DEFAULT_SHOT_SECONDS = 8;
const MIN_SHOTS = 1;
const MAX_SHOTS = 6;

/**
 * The production plan as a scannable list: a proportional strip of scenes up
 * top, one collapsed row per scene with a shot-count stepper, and the full
 * direction only when a row is opened. Shot counts are the one thing worth
 * adjusting before spend, so they are always one tap away.
 */
export function ScenePlanField({ id, scenes, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shotSeconds = scenes.reduce((unit, scene) => {
    const frames = Number(scene.target_frames || 0);
    const duration = Number(scene.duration || 0);
    return frames > 0 && duration > 0 ? duration / frames : unit;
  }, DEFAULT_SHOT_SECONDS);
  const totalShots = scenes.reduce((sum, scene) => sum + shotsOf(scene), 0);
  const totalSeconds = totalShots * shotSeconds;

  const setShots = (index: number, shots: number) => {
    const next = Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, shots));
    onChange(
      scenes.map((scene, sceneIndex) =>
        sceneIndex === index
          ? { ...scene, target_frames: next, duration: next * shotSeconds }
          : scene,
      ),
    );
  };
  const setText = (index: number, key: string, value: string) =>
    onChange(
      scenes.map((scene, sceneIndex) =>
        sceneIndex === index ? { ...scene, [key]: value } : scene,
      ),
    );

  return (
    <div id={id} className="agent-plan">
      <div className="agent-plan__summary">
        <strong>
          {scenes.length} {scenes.length === 1 ? "scene" : "scenes"} ·{" "}
          {totalShots} {totalShots === 1 ? "shot" : "shots"} ·{" "}
          {formatDuration(totalSeconds)}
        </strong>
        <div
          className="agent-plan__strip"
          role="list"
          aria-label="Scene lengths"
        >
          {scenes.map((scene, index) => {
            const key = keyOf(scene, index);
            return (
              <button
                key={key}
                type="button"
                role="listitem"
                className={`agent-plan__segment ${openId === key ? "is-active" : ""}`}
                style={{ flexGrow: shotsOf(scene) }}
                title={`${index + 1}. ${titleOf(scene, index)} · ${shotsOf(scene)} ${shotsOf(scene) === 1 ? "shot" : "shots"}`}
                aria-label={`Scene ${index + 1}, ${shotsOf(scene)} ${shotsOf(scene) === 1 ? "shot" : "shots"}`}
                onClick={() => setOpenId(openId === key ? null : key)}
              />
            );
          })}
        </div>
      </div>
      <ol className="agent-plan__list">
        {scenes.map((scene, index) => {
          const key = keyOf(scene, index);
          const open = openId === key;
          const shots = shotsOf(scene);
          const title = titleOf(scene, index);
          const detail = String(scene.detailed_plot || "");
          const dialogue = String(scene.dialogue || "");
          return (
            <li
              key={key}
              className={`agent-plan__scene ${open ? "is-open" : ""}`}
            >
              <div className="agent-plan__row">
                <button
                  type="button"
                  className="agent-plan__toggle"
                  aria-expanded={open}
                  aria-controls={`${id}-scene-${index}`}
                  onClick={() => setOpenId(open ? null : key)}
                >
                  <span className="agent-plan__number">{index + 1}</span>
                  <span className="agent-plan__text">
                    <strong>{title}</strong>
                    {!open && (
                      <small>{String(scene.concise_plot || detail)}</small>
                    )}
                  </span>
                  <ChevronDown size={14} className="agent-plan__chevron" />
                </button>
                <div
                  className="agent-plan__shots"
                  role="group"
                  aria-label={`Shots in scene ${index + 1}`}
                >
                  <button
                    type="button"
                    aria-label="Fewer shots"
                    disabled={shots <= MIN_SHOTS}
                    onClick={() => setShots(index, shots - 1)}
                  >
                    <Minus size={12} />
                  </button>
                  <span aria-live="polite">
                    {shots}
                    <small> · {formatDuration(shots * shotSeconds)}</small>
                  </span>
                  <button
                    type="button"
                    aria-label="More shots"
                    disabled={shots >= MAX_SHOTS}
                    onClick={() => setShots(index, shots + 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <Collapse open={open}>
                <div className="agent-plan__detail" id={`${id}-scene-${index}`}>
                  <label>
                    <span>Direction</span>
                    <textarea
                      rows={Math.min(
                        10,
                        Math.max(3, Math.ceil(detail.length / 48)),
                      )}
                      value={detail}
                      onChange={(event) =>
                        setText(index, "detailed_plot", event.target.value)
                      }
                    />
                  </label>
                  {(dialogue || "dialogue" in scene) && (
                    <label>
                      <span>Dialogue</span>
                      <textarea
                        rows={Math.min(
                          6,
                          Math.max(2, Math.ceil(dialogue.length / 48)),
                        )}
                        value={dialogue}
                        placeholder="No dialogue in this scene"
                        onChange={(event) =>
                          setText(index, "dialogue", event.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
              </Collapse>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function shotsOf(scene: PlanScene) {
  return Math.max(MIN_SHOTS, Number(scene.target_frames || 0) || MIN_SHOTS);
}

function titleOf(scene: PlanScene, index: number) {
  return String(scene.title || scene.concise_plot || `Scene ${index + 1}`);
}

function keyOf(scene: PlanScene, index: number) {
  return String(scene.id || index);
}
