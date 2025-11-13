import * as React from "react";

export interface DuoTextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  containerClassName?: string;
}

export const DuoTextArea = React.forwardRef<HTMLTextAreaElement, DuoTextAreaProps>(
  ({ className, containerClassName, label, ...props }, ref) => {
    return (
      <label className={`flex w-full flex-col gap-2 ${containerClassName || ''}`}>
        {label && (
          <span className="wc-label slate">{label}</span>
        )}
        <textarea
          ref={ref}
          className={`field ${className || ''}`}
          {...props}
        />
      </label>
    );
  }
);

DuoTextArea.displayName = "DuoTextArea";

export default DuoTextArea;
