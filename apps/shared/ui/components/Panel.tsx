import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Panel({
  children,
  padded = true,
  className,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface-raised',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
