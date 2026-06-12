"use client";

import { DEMO_PROJECT, DEMO_POSTER } from "@/data/demoFilm";

const PATHS: Record<string, string> = {
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h4M3 16.5h4M17 7.5h4M17 12h4M17 16.5h4"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

// A project as shown in the library. For now there's one hardcoded film (Emberveil);
// real projects can be appended to this list once the backend is connected.
const LIBRARY = [
  {
    id: DEMO_PROJECT.id,
    title: DEMO_PROJECT.title,
    summary: DEMO_PROJECT.summary,
    poster: DEMO_POSTER,
    meta: "8 scenes · 6 characters · ~15 min",
  },
];

export default function LibraryModal({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="lib-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lib-modal glass">
        <div className="lib-head">
          <div className="lib-titlewrap">
            <span className="brand-mark sm"><Icon name="film" size={18} /></span>
            <div>
              <div className="slate">Your projects</div>
              <div className="lib-title">Library</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={16} /><span>Close</span>
          </button>
        </div>

        <div className="lib-grid scroll">
          {LIBRARY.map((p) => (
            <button key={p.id} className="lib-card" onClick={() => onOpen(p.id)}>
              <div className="lib-poster">
                <img src={p.poster} alt={p.title} draggable={false} />
                <div className="lib-poster-grade" />
                <div className="lib-play"><Icon name="play" size={22} /></div>
              </div>
              <div className="lib-meta">
                <div className="lib-card-title">{p.title}</div>
                <div className="lib-card-sum">{p.summary}</div>
                <div className="slate lib-card-meta">{p.meta}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
