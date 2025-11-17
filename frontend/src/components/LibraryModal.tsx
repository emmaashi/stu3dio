"use client";

import { useProject } from "@/hooks/useBackendIntegration";

const PATHS: Record<string, string> = {
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  clapper: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

const REELS = [
  { id: 'r1', title: 'The Salvage', date: 'Jun 6, 2026', dur: '0:48', scenes: 3, status: 'Final cut', accent: 'var(--director)', glow: 'var(--director-glow)', hex: '#ffb23e', poster: null },
  { id: 'r2', title: 'Static on the Coast', date: 'Jun 2, 2026', dur: '1:12', scenes: 4, status: 'Rendered', accent: 'var(--writer)', glow: 'var(--writer-glow)', hex: '#27cbe0', poster: null },
  { id: 'r3', title: 'The Keeper', date: 'May 28, 2026', dur: '0:36', scenes: 3, status: 'Rendered', accent: 'var(--casting)', glow: 'var(--casting-glow)', hex: '#ff4d8d', poster: null },
  { id: 'r4', title: 'Night Shift', date: 'May 21, 2026', dur: '0:54', scenes: 3, status: 'Draft', accent: '#8b6cff', glow: '#a890ff', hex: '#8b6cff', poster: null },
];

export default function LibraryModal({
  proj,
  onClose,
  onPick,
  onNew,
}: {
  proj: string;
  onClose: () => void;
  onPick: (title: string) => void;
  onNew: () => void;
}) {
  const project = useProject();

  const handleNew = async () => {
    try {
      await project.createProject();
    } catch (e) {
      console.error('Failed to create project:', e);
    }
    onNew();
  };

  return (
    <div className="map-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lib-modal glass">
        <div className="map-head">
          <div>
            <div className="slate">Your Reels</div>
            <div className="map-title">Library</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              <Icon name="plus" size={16} /><span>New video</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <Icon name="x" size={16} /><span>Close</span>
            </button>
          </div>
        </div>

        <div className="lib-grid scroll">
          {REELS.map((reel) => (
            <button
              key={reel.id}
              className="reel-card"
              style={{ '--ax': reel.accent, '--gw': reel.glow } as React.CSSProperties}
              onClick={() => onPick(reel.title)}
            >
              <div className="reel-poster">
                <div className="reel-blank">
                  <Icon name="clapper" size={36} />
                </div>
                <div className="reel-grade" />
                <div className="reel-play">
                  <Icon name="play" size={20} />
                </div>
                <div className="reel-dur">{reel.dur}</div>
              </div>
              <div className="reel-meta">
                <div className="reel-title">{reel.title}</div>
                <div className="reel-sub">
                  <div className="reel-status">
                    <span className="reel-statdot" style={{ background: reel.hex }} />
                    {reel.status}
                  </div>
                  <div className="reel-date">{reel.date}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
