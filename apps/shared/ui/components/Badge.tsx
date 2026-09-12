import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-hover text-ink-secondary',
  accent: 'bg-accent-muted text-info-foreground',
  success: 'bg-success-muted text-success-foreground',
  warning: 'bg-warning-muted text-warning-foreground',
  danger: 'bg-danger-muted text-danger-foreground',
  info: 'bg-info-muted text-info-foreground',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-1.25 text-12 font-medium tabular-nums',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
