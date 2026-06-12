"use client";

import { type ReactNode } from "react";
import type { WorkerData } from "@/data/crewData";
import CinematicChar3D from "./CinematicChar3D";

const PATHS: Record<string, string> = {
  pin: '<path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.6"/>',
  megaphone: '<path d="m3 11 14-7v15L3 13z"/><path d="M3 11v3a1 1 0 0 0 1 1h2"/><path d="M8 14v3a2 2 0 0 0 4 0v-1"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="5" height="8" rx="1.5"/><rect x="17" y="13" width="5" height="8" rx="1.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 16-5-5L5 21"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }} />
  );
}

export default function CinematicWorkerPanel({
  worker,
  children,
  onClose,
}: {
  worker: WorkerData;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="wp wp-drawer"
      style={{
        '--ax': worker.accent,
        '--gw': worker.glow,
        '--accent': worker.accent,
        '--glow': worker.glow,
      } as React.CSSProperties}
    >
      {/* Left: stage side with room image + 3D character */}
      <div className="wp-stageside">
        <img
          className="wp-room"
          src={worker.roomImg}
          alt={worker.room}
          draggable={false}
        />
        <div className="wp-room-grade" />
        <div className="cstage cstage--bare" style={{ position: 'absolute', inset: 0 }}>
          <CinematicChar3D worker={worker} interactive={true} />
        </div>
        <div className="wp-roomtag glass">
          <Icon name="pin" size={14} />
          <div>
            <div className="slate">Location</div>
            <div className="wp-roomname">{worker.room}</div>
          </div>
        </div>
      </div>

      {/* Right: side panel */}
      <div className="wp-side glass">
        {/* Header */}
        <div className="wh">
          <div className="wh-left">
            <div className="wh-icon">
              <Icon name={worker.icon} size={20} />
            </div>
            <div>
              <div
                className="slate"
                style={{ color: `color-mix(in oklab, var(--ax) 80%, var(--ink-3))` }}
              >
                {worker.slate}
              </div>
              <div className="wh-title">{worker.title}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <Icon name="x" size={16} /><span>Close</span>
          </button>
        </div>

        {/* What this worker does — 2 sentences before the divider */}
        <p className="wp-intro">{worker.intro}</p>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
