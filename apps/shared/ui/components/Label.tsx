import type { LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  hint?: ReactNode;
}

export function Label({ className, children, hint, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-13 font-medium text-ink-secondary', className)}
      {...props}
    >
      {children}
      {hint ? (
        <span className="mt-1 block text-12 font-normal text-ink-tertiary">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
