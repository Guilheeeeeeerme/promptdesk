import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-5 sm:mb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-display text-ink-primary">{title}</h1>
        {description ? (
          <p className="mt-1.25 text-pretty text-17 font-normal text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.25">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
