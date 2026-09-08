import type { SelectHTMLAttributes } from 'react';
import { cn } from '../cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'block w-full rounded-sm border border-line bg-surface-raised px-3 py-2 text-14 text-ink-primary',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
