import type { ReactNode } from 'react';
import { cn } from '../cn';

export type BannerTone = 'info' | 'success' | 'error' | 'warning';

export interface BannerProps {
  tone?: BannerTone;
  children: ReactNode;
  className?: string;
}

const tones: Record<BannerTone, string> = {
  info: 'bg-info-muted border-line text-info-foreground',
  success: 'bg-success-muted border-line text-success-foreground',
  error: 'bg-danger-muted border-line text-danger-foreground',
  warning: 'bg-warning-muted border-line text-warning-foreground',
};

export function Banner({ tone = 'info', children, className }: BannerProps) {
  return (
    <div
      className={cn(
        'rounded-sm border px-4 py-3 text-17 font-normal text-pretty',
        tones[tone],
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {children}
    </div>
  );
}
