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
        'mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-[28px] font-bold leading-8 text-ink-primary sm:text-[32px] sm:leading-9">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.25 text-pretty text-14 text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
