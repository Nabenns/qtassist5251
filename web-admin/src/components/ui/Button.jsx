import { forwardRef } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Button with variant + size props. Wraps the native <button> so it stays
 * fully accessible (keyboard, focus ring, disabled state).
 *
 * Variants: primary, secondary, ghost, danger, success, outline
 * Sizes: sm, md, lg, icon
 */

const variantStyles = {
  primary:
    'bg-primary text-primary-fg hover:bg-success hover:text-success-fg active:bg-primary/80 border border-primary',
  secondary:
    'bg-surface-2 text-fg border border-border hover:bg-surface-3 active:bg-surface-3',
  ghost:
    'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
  outline:
    'bg-transparent text-fg border border-border hover:bg-surface-2',
  danger:
    'bg-danger text-danger-fg hover:bg-danger/85 active:bg-danger/70 border border-danger',
  success:
    'bg-success text-success-fg hover:bg-success/85 active:bg-success/70 border border-success'
};

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0 gap-0'
};

export const Button = forwardRef(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled,
    leadingIcon: Leading,
    trailingIcon: Trailing,
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-display font-semibold transition-colors duration-75 select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant] || variantStyles.primary,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : Leading ? (
        <Leading className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children ? <span>{children}</span> : null}
      {Trailing ? <Trailing className="h-4 w-4" aria-hidden="true" /> : null}
    </button>
  );
});

function Spinner({ className }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
