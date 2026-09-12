import type { ReactNode } from 'react';
import { cn } from '../cn';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-10 text-center',
        className,
      )}
    >
      <p className="text-balance text-15 font-medium text-ink-primary">{title}</p>
      {description ? (
        <p className="mt-1.25 max-w-sm text-pretty text-17 font-normal text-ink-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
