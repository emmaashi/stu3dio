"use client";

import * as React from "react";

const PATHS: Record<string, string> = {
  play: '<path d="M7 4v16l13-8z"/>',
  wand: '<path d="m15 4 1 2.5L18.5 8 16 9l-1 2.5L14 9l-2.5-1L14 6.5Z"/><path d="M13 11 4 20"/>',
  sparkles: '<path d="m12 3 1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6Z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  clap: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/><path d="m8 6.5 1.5 3M12 5.8l1.5 3"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  megaphone: '<path d="m3 11 14-7v15L3 13z"/><path d="M3 11v3a1 1 0 0 0 1 1h2"/><path d="M8 14v3a2 2 0 0 0 4 0v-1"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="5" height="8" rx="1.5"/><rect x="17" y="13" width="5" height="8" rx="1.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 16-5-5L5 21"/>',
  clapper: '<path d="m4 11 16-3"/><path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8Z"/><path d="m4.5 7.5 15-3 .8 3.5-15 3Z"/>',
};

function IconSvg({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }}
    />
  );
}

export interface DuoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'primary' | 'ghost';
  size?: 'sm' | 'lg' | 'md';
  icon?: string;
  // Legacy props for backward compatibility
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  shadow?: boolean;
}

export const DuoButton = React.forwardRef<HTMLButtonElement, DuoButtonProps>(
  ({ className, kind, variant, size, icon, children, ...rest }, ref) => {
    // Map legacy variant to kind
    const resolvedKind = kind ?? (variant === 'secondary' || variant === 'danger' ? 'ghost' : variant === 'ghost' ? 'ghost' : 'primary');
    // Map 'md' to nothing (default), 'sm' => btn-sm, 'lg' => btn-lg
    const sizeClass = size === 'sm' ? ' btn-sm' : size === 'lg' ? ' btn-lg' : '';
    const cls = `btn btn-${resolvedKind}${sizeClass}${className ? ' ' + className : ''}`;
    return (
      <button ref={ref} className={cls} {...rest}>
        {icon && <IconSvg name={icon} size={size === 'sm' ? 16 : 18} />}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

DuoButton.displayName = "DuoButton";

export default DuoButton;
