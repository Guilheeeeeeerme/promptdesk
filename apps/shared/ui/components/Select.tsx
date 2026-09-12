import type { SelectHTMLAttributes } from 'react';
import { cn } from '../cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

/** Inline SVG chevron so native selects match the rest of the chrome. */
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%238a8b8c' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m4.5 6.5 3.5 3.5 3.5-3.5'/%3E%3C/svg%3E\")";

export function Select({ className, style, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'block w-full appearance-none rounded-sm border border-line bg-surface-raised bg-[length:var(--icon-size)_var(--icon-size)] bg-[position:right_0.625rem_center] bg-no-repeat py-2 pe-9 ps-3 text-17 font-normal text-ink-primary',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{ backgroundImage: CHEVRON, ...style }}
      {...props}
    >
      {children}
    </select>
  );
}
