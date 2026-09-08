import type { InputHTMLAttributes } from 'react';
import { cn } from '../cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'block w-full rounded-sm border border-line bg-surface-raised px-3 py-2 text-14 text-ink-primary placeholder:text-ink-tertiary',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}
