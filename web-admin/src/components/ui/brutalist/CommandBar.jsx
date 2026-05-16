import { cn } from '../../../lib/cn.js';

/**
 * CommandBar — slash-prompt action bar.
 *
 * Renders a mono prompt label and inline children (typically Buttons).
 * Used as bottom action bar in detail pages and modal footers when we
 * want a "terminal command" feel rather than a regular toolbar.
 *
 * Props:
 *   prompt: leading prompt label, e.g. "ops $", "ib $"
 *   children: action elements
 *   className: extra classes
 */
export function CommandBar({ prompt = 'ops $', children, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-y border-border bg-surface-2 px-4 py-2.5',
        className
      )}
    >
      <span
        className="font-mono text-xs tracking-wider text-primary"
        aria-hidden="true"
      >
        {prompt}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
