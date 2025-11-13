import * as React from "react";

export interface DuoInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const DuoInput = React.forwardRef<HTMLInputElement, DuoInputProps>(
  ({ className, label, hint, ...props }, ref) => {
    return (
      <label className="flex w-full flex-col gap-2">
        {label && (
          <span className="wc-label slate">{label}</span>
        )}
        <input
          ref={ref}
          className={`field ${className || ''}`}
          {...props}
        />
        {hint && (
          <span className="slate" style={{ color: 'var(--ink-3)' }}>{hint}</span>
        )}
      </label>
    );
  }
);

DuoInput.displayName = "DuoInput";

export default DuoInput;
