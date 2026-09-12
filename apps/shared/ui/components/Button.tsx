import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-foreground hover:bg-accent-hover border border-transparent',
  secondary:
    'bg-surface-raised text-ink-primary border border-line hover:bg-surface-hover',
  ghost:
    'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-hover hover:text-ink-primary',
  danger:
    'bg-danger text-white border border-transparent hover:brightness-110',
  'danger-soft':
    'bg-danger-muted text-danger-foreground border border-transparent hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-13',
  md: 'h-9 px-4 text-14',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      className,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-1.25 rounded-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
