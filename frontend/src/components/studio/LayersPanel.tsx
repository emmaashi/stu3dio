"use client";

import { useState } from "react";
import { ChevronDown, FileText, Film, Search, Users, X } from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import type { StudioGraph } from "./types";

export default function LayersPanel({
  graph,
}: {
  graph: StudioGraph;
  onCollapse: () => void;
}) {
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const focus = useStudioStore((s) => s.focus);
  const select = useStudioStore((s) => s.select);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const matches = (text: string) =>
    text.toLowerCase().includes(query.toLowerCase());
  const chars = graph.characters.filter((c) => matches(`${c.name} ${c.role}`));
  return (
    <div className="studio-layers">
      <label className="studio-asset-search">
        <Search size={14} />
        <input
          aria-label="Search assets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find in your film…"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search">
            <X size={12} />
          </button>
        )}
      </label>
      <div className="studio-layer-scroll">
        {(!query || matches("story brief")) && (
          <button
            className={`studio-layer-brief ${selectedKeys.includes("overview") ? "is-selected" : ""}`}
            onClick={() => select("overview")}
          >
            <FileText size={15} />
            <span>
              Story brief<small>The foundation of your film</small>
            </span>
          </button>
        )}
        {!!chars.length && (
          <section>
            <button
              className="studio-layer-section"
              aria-expanded={!collapsed.has("cast") || !!query}
              onClick={() => toggle("cast")}
            >
              <ChevronDown
                size={13}
                className={
                  collapsed.has("cast") && !query ? "is-collapsed" : ""
                }
              />
              <Users size={13} />
              <span>Cast</span>
              <small>{chars.length}</small>
            </button>
            {(!collapsed.has("cast") || query) &&
              chars.map((c) => (
                <button
                  key={c.id}
                  className={`studio-layer-row ${selectedKeys.includes(`char-${c.id}`) ? "is-selected" : ""}`}
                  aria-label={`${c.name}. Shift-click to select multiple`}
                  aria-pressed={selectedKeys.includes(`char-${c.id}`)}
                  onClick={(event) =>
                    focus(`char-${c.id}`, { additive: event.shiftKey })
                  }
                >
                  {c.media ? <img src={c.media} alt="" /> : <Users size={16} />}
                  <span>
                    {c.name}
                    <small>{c.role || "Character"}</small>
                  </span>
                </button>
              ))}
          </section>
        )}
        {graph.scenes.some(
          (s) =>
            matches(`${s.plot} Scene ${s.order}`) ||
            s.clips.some((c) => matches(c.label)),
        ) && (
          <div className="studio-layer-section studio-layer-section--label">
            <Film size={13} />
            <span>Scenes</span>
            <small>{graph.scenes.length}</small>
          </div>
        )}
        {graph.scenes.map((scene) => {
          const sceneMatch = matches(`${scene.plot} Scene ${scene.order}`);
          const clips = scene.clips.filter(
            (clip) => !query || sceneMatch || matches(clip.label),
          );
          if (query && !sceneMatch && !clips.length) return null;
          const open = !!query || collapsed.has(scene.id);
          const key = `scene-${scene.id}`;
          return (
            <section key={scene.id} className="studio-layer-scene">
              <div
                className={`studio-layer-scene-heading ${selectedKeys.includes(key) ? "is-selected" : ""}`}
              >
                <button
                  className="studio-layer-disclosure"
                  aria-label={`${open ? "Collapse" : "Expand"} Scene ${scene.order} shots`}
                  aria-expanded={open}
                  onClick={() => toggle(scene.id)}
                >
                  <ChevronDown
                    size={13}
                    className={!open ? "is-collapsed" : ""}
                  />
                </button>
                <button
                  className="studio-layer-row"
                  onClick={(event) => focus(key, { additive: event.shiftKey })}
                  aria-pressed={selectedKeys.includes(key)}
                  aria-label={`Scene ${scene.order}. ${scene.plot}`}
                >
                  <span className="studio-scene-number">
                    {String(scene.order).padStart(2, "0")}
                  </span>
                  <span>
                    Scene {scene.order}
                    <small>{scene.plot || "Untitled scene"}</small>
                  </span>
                  <small className="studio-layer-count">
                    {scene.clips.length}
                  </small>
                </button>
              </div>
              {open &&
                clips.map((clip) => (
                  <button
                    key={clip.id}
                    className={`studio-layer-shot ${selectedKeys.includes(`clip-${clip.id}`) ? "is-selected" : ""}`}
                    aria-label={`Shot ${String(clip.order + 1).padStart(2, "0")} · ${clip.label}. Shift-click to select multiple`}
                    aria-pressed={selectedKeys.includes(`clip-${clip.id}`)}
                    onClick={(event) =>
                      focus(`clip-${clip.id}`, { additive: event.shiftKey })
                    }
                  >
                    <span className={`studio-shot-dot ${clip.status}`} />
                    <span>
                      Shot {String(clip.order + 1).padStart(2, "0")}
                      <small>{clip.label}</small>
                    </span>
                  </button>
                ))}
            </section>
          );
        })}
        {!!graph.overview?.finalVideoUrl &&
          (!query || matches("final film")) && (
            <button
              className={`studio-layer-brief ${selectedKeys.includes("film") ? "is-selected" : ""}`}
              onClick={() => focus("film")}
            >
              <Film size={15} />
              <span>
                Final film<small>Preview your assembled story</small>
              </span>
            </button>
          )}
        {query &&
          !chars.length &&
          !graph.scenes.some(
            (s) =>
              matches(`${s.plot} Scene ${s.order}`) ||
              s.clips.some((c) => matches(c.label)),
          ) && (
            <p className="studio-search-empty">
              No cast or scenes match “{query}”.
            </p>
          )}
      </div>
    </div>
  );
}
