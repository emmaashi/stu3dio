"use client";

import { useState, useEffect } from "react";
import { useSceneStore } from "@/store/useSceneStore";
import { CREW } from "@/data/crewData";
import CinematicChar3D from "@/components/CinematicChar3D";
import PagesOverlay from "@/components/pages/PagesOverlay";
import StudioMapModal from "@/components/StudioMapModal";
import LibraryModal from "@/components/LibraryModal";

/* ---- inline icon set ---- */
const PATHS: Record<string, string> = {
  aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l7.5 4.3M21 12h-9L4.5 7.7M12 21v-9L4.5 16.3"/>',
  pencil: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  clapper: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>',
  arrowL: '<path d="m14 6-6 6 6 6"/>',
  arrowR: '<path d="m10 6 6 6-6 6"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  megaphone: '<path d="m3 11 14-7v15L3 13z"/><path d="M3 11v3a1 1 0 0 0 1 1h2"/><path d="M8 14v3a2 2 0 0 0 4 0v-1"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="5" height="8" rx="1.5"/><rect x="17" y="13" width="5" height="8" rx="1.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 16-5-5L5 21"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

/* Peek placeholder (clay silhouette, no extra GL context) */
function PeekFigure({ worker }: { worker: typeof CREW[0] }) {
  return (
    <div
      className="cstage cstage--bare"
      style={{ '--gw': worker.glow, '--ax': worker.accent } as React.CSSProperties}
    >
      <div className="cstage-gel" />
      <div
        className="cstage-fig placeholder"
        style={{ '--ax': worker.accent, '--gw': worker.glow } as React.CSSProperties}
      >
        <div className="clay-fig">
          <span className="clay-head" />
          <span className="clay-body" />
        </div>
      </div>
      <div className="cstage-floor" />
    </div>
  );
}

export default function Home() {
  const [index, setIndex] = useState(2); // default director
  const [mapOpen, setMapOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [proj, setProj] = useState("Untitled — Reel 01");
  const [clock, setClock] = useState("00:00:00:00");
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);

  const selectedPageId = useSceneStore((s) => s.selectedPageId);
  const openPage = useSceneStore((s) => s.openPage);
  const resetSelectionAndCamera = useSceneStore((s) => s.resetSelectionAndCamera);

  const workerOpen = selectedPageId !== null;
  const worker = CREW[index];
  const prev = CREW[(index - 1 + 3) % 3];
  const next = CREW[(index + 1) % 3];

  // Clock effect
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      const ff = Math.floor((s * 24) % 24);
      const ss = Math.floor(s % 60);
      const mm = Math.floor((s / 60) % 60);
      const hh = Math.floor(s / 3600);
      const p = (n: number) => String(n).padStart(2, '0');
      setClock(`${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`);
    }, 80);
    return () => clearInterval(id);
  }, []);

  function enter(i: number) {
    setIndex(i);
    setClosing(false);
    openPage(CREW[i].pageId);
  }

  function closeWorker() {
    setClosing(true);
    setTimeout(() => {
      resetSelectionAndCamera();
      setClosing(false);
    }, 280);
  }

  function pickFromMap(i: number) {
    setMapOpen(false);
    enter(i);
  }

  const go = (d: number) => setIndex((index + d + 3) % 3);

  return (
    <div className="app">
      <div className="grain animate" />
      <div className="vignette" />

      {/* Home layer */}
      <div
        className={`layer-home${workerOpen ? ' dimmed' : ''}`}
        style={{ '--ax': worker.accent, '--gw': worker.glow } as React.CSSProperties}
      >
        <div className="home">
          <div className="home-glow" />
          <div className="home-grid" />

          {/* Studio set dressing */}
          <div className="studio-set">
            <div className="set-stand left"><span className="stand-head" /></div>
            <div className="set-stand right"><span className="stand-head" /></div>
            <div className="set-cam">
              <span className="cam-body">
                <span className="cam-reel" />
                <span className="cam-reel b" />
              </span>
              <span className="cam-lens" />
            </div>
            <div className="set-boom"><span className="boom-mic" /></div>
            <div className="set-filmstrip" />
          </div>

          {/* Top bar */}
          <header className="home-top">
            <div className="brand">
              <span className="brand-mark">
                <Icon name="aperture" size={22} />
              </span>
              <span className="brand-word">
                STU<em>3</em>DIO
              </span>
            </div>

            <div className="proj">
              <div className="slate">Production</div>
              {editing ? (
                <input
                  className="proj-input"
                  defaultValue={proj}
                  autoFocus
                  onBlur={(e) => { setProj(e.target.value.trim() || proj); setEditing(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
              ) : (
                <button className="proj-name" onClick={() => setEditing(true)} title="Rename">
                  {proj}
                  <Icon name="pencil" size={13} />
                </button>
              )}
            </div>

            <div className="home-top-right">
              <div className="tc tnum">
                <span className="rec" />
                {clock}
              </div>
              <div className="slate-board">
                <span><em>SCENE</em>12</span>
                <span><em>TAKE</em>03</span>
                <span><em>ROLL</em>A</span>
              </div>
              <button className="mapbtn" onClick={() => setLibOpen(true)} title="Library">
                <Icon name="clapper" size={18} />
                <span>Library</span>
              </button>
              <button className="mapbtn" onClick={() => setMapOpen(true)} title="Studio map">
                <Icon name="map" size={20} />
                <span>Studio Map</span>
              </button>
            </div>
          </header>

          {/* Stage */}
          <div className="home-stage">
            <button className="navarrow left" onClick={() => go(-1)} aria-label="Previous">
              <Icon name="arrowL" size={26} />
            </button>

            {/* Peek left */}
            <div className="peek peek-l" onClick={() => go(-1)} key={'pl-' + prev.id}>
              <PeekFigure worker={prev} />
            </div>

            {/* Hero */}
            <div className="hero-slot" key={worker.id}>
              <div
                className="cstage letterbox"
                style={{ '--gw': worker.glow, '--ax': worker.accent } as React.CSSProperties}
              >
                <div className="cstage-gel" />
                <div className="cstage-spot" />
                <div className="cstage-3d">
                  <CinematicChar3D worker={worker} interactive={true} />
                </div>
                <div className="cstage-floor" />
                <div className="cstage-grade" />
                <div className="cstage-vig" />
              </div>
            </div>

            {/* Peek right */}
            <div className="peek peek-r" onClick={() => go(1)} key={'pr-' + next.id}>
              <PeekFigure worker={next} />
            </div>

            <button className="navarrow right" onClick={() => go(1)} aria-label="Next">
              <Icon name="arrowR" size={26} />
            </button>
          </div>

          {/* Call sheet */}
          <div
            className="callsheet glass"
            key={'cs-' + worker.id}
            style={{ '--accent': worker.accent, '--glow': worker.glow, '--ax': worker.accent } as React.CSSProperties}
          >
            <div className="cs-head">
              <div className="cs-icon">
                <Icon name={worker.icon} size={22} />
              </div>
              <div>
                <div
                  className="slate"
                  style={{ color: 'color-mix(in oklab, var(--ax) 80%, var(--ink-3))' }}
                >
                  {worker.slate}
                </div>
                <div className="cs-name">
                  {worker.role}
                  <span className="cs-sub">{worker.name}</span>
                </div>
              </div>
              <div className="cs-room slate">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: '<path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.6"/>' }} />
                {worker.room}
              </div>
            </div>
            <p className="cs-intro">{worker.intro}</p>
            <div className="cs-foot">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 99, background: worker.hex,
                  boxShadow: `0 0 0 3px color-mix(in oklab, ${worker.hex} 22%, transparent)`,
                  animation: 'pulse 2.4s var(--ease) infinite', display: 'inline-block',
                }} />
                <span className="slate" style={{ color: 'var(--ink-2)' }}>On set · ready</span>
              </div>
              <button
                className="btn btn-primary"
                style={{ '--accent': worker.accent } as React.CSSProperties}
                onClick={() => enter(index)}
              >
                <Icon name="play" size={18} />
                <span>Step onto set</span>
              </button>
            </div>
          </div>

          {/* Crew rail */}
          <div className="crew-rail">
            {CREW.map((c, i) => (
              <button
                key={c.id}
                className={`rail-dot${i === index ? ' on' : ''}`}
                style={{ '--ax': c.accent } as React.CSSProperties}
                onClick={() => setIndex(i)}
                title={c.role}
              >
                <Icon name={c.icon} size={16} />
                <span>{c.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Worker layer */}
      {(workerOpen || closing) && (
        <div className={`layer-worker${closing ? ' closing' : ''}`}>
          <PagesOverlay onClose={closeWorker} />
        </div>
      )}

      {/* Map modal */}
      {mapOpen && (
        <StudioMapModal onPick={pickFromMap} onClose={() => setMapOpen(false)} />
      )}

      {/* Library modal */}
      {libOpen && (
        <LibraryModal
          proj={proj}
          onClose={() => setLibOpen(false)}
          onPick={(title) => { setProj(title); setLibOpen(false); }}
          onNew={() => { setProj('Untitled — Reel 01'); setLibOpen(false); }}
        />
      )}
    </div>
  );
}
