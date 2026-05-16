import { forwardRef } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Text-style input that already includes the design tokens. Use as a drop-in
 * replacement for <input> + className="input".
 */
export const Input = forwardRef(function Input(
  { className, type = 'text', leadingIcon: Leading, trailingIcon: Trailing, variant, ...props },
  ref
) {
  const monoCls = variant === 'mono' ? 'font-mono tracking-wide' : '';
  if (Leading || Trailing) {
    return (
      <div className={cn('relative', className)}>
        {Leading ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted-fg">
            <Leading className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn('input', monoCls, Leading && 'pl-9', Trailing && 'pr-9')}
          {...props}
        />
        {Trailing ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-fg">
            <Trailing className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    );
  }

  return <input ref={ref} type={type} className={cn('input', monoCls, className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn('input min-h-[88px]', className)}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn('input pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function FormField({ label, hint, error, htmlFor, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="font-mono text-xs text-muted-fg">{hint}</p> : null}
      {error ? <p className="font-mono text-xs text-danger">{error}</p> : null}
    </div>
  );
}
