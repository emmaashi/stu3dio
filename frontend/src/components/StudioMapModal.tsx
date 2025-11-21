"use client";

import { useState } from "react";
import { CREW } from "@/data/crewData";

const PATHS: Record<string, string> = {
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  megaphone: '<path d="m3 11 14-7v15L3 13z"/><path d="M3 11v3a1 1 0 0 0 1 1h2"/><path d="M8 14v3a2 2 0 0 0 4 0v-1"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="5" height="8" rx="1.5"/><rect x="17" y="13" width="5" height="8" rx="1.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 16-5-5L5 21"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

export default function StudioMapModal({
  onPick,
  onClose,
}: {
  onPick: (i: number) => void;
  onClose: () => void;
}) {
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  return (
    <div className="map-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="map-modal glass">
        <div className="map-head">
          <div>
            <div className="slate">Studio Floorplan</div>
            <div className="map-title">Choose a Room</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={16} /><span>Close</span>
          </button>
        </div>

        <div className="map-scene">
          <div className="floorplan-wrap">
            <img className="floorplan" src="/background/map.png" alt="Studio floorplan" />
            {CREW.map((worker, i) => (
              <button
                key={worker.id}
                className="map-pin"
                style={{
                  top: `${worker.map.top}%`,
                  left: `${worker.map.left}%`,
                  '--ax': worker.accent,
                  '--gw': worker.glow,
                  transform: hoveredPin === i
                    ? 'translate(-50%, -106%)'
                    : 'translate(-50%, -100%)',
                } as React.CSSProperties}
                onClick={() => onPick(i)}
                onMouseEnter={() => setHoveredPin(i)}
                onMouseLeave={() => setHoveredPin(null)}
              >
                <div
                  className="pin-beam"
                  style={{
                    opacity: hoveredPin === i ? 1 : 0.8,
                    boxShadow: hoveredPin === i
                      ? `0 0 22px 4px color-mix(in oklab, ${worker.glowHex} 80%, transparent)`
                      : `0 0 16px 2px color-mix(in oklab, ${worker.glowHex} 60%, transparent)`,
                  }}
                />
                <div
                  className="pin-head"
                  style={{
                    boxShadow: hoveredPin === i
                      ? `0 16px 34px -6px color-mix(in oklab, ${worker.hex} 80%, transparent), 0 0 44px color-mix(in oklab, ${worker.glowHex} 70%, transparent)`
                      : `0 12px 28px -6px color-mix(in oklab, ${worker.hex} 70%, transparent), 0 0 30px color-mix(in oklab, ${worker.glowHex} 50%, transparent)`,
                  }}
                >
                  <Icon name={worker.icon} size={18} />
                </div>
                <div className="pin-label">
                  <b>{worker.role}</b>
                  <em>{worker.room}</em>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="map-foot">
          {CREW.map((worker) => (
            <div key={worker.id} className="legend">
              <span
                className="legend-dot"
                style={{ background: worker.hex, color: worker.hex }}
              />
              {worker.role}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
