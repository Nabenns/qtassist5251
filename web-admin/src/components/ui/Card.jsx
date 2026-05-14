import { cn } from '../../lib/cn.js';

/**
 * Card primitive: visual container with consistent radius, border and shadow.
 * Use Card + CardHeader + CardBody + CardFooter for structured panels.
 */
export function Card({ className, children, ...props }) {
  return (
    <div className={cn('surface', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, title, description, action, children }) {
  if (children) {
    return (
      <div className={cn('flex items-center justify-between gap-3 border-b border-border px-5 py-3', className)}>
        {children}
      </div>
    );
  }
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-border px-5 py-3', className)}>
      <div className="space-y-0.5">
        {title ? <h2 className="text-sm font-semibold text-fg">{title}</h2> : null}
        {description ? <p className="text-xs text-muted-fg">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-3 rounded-b-xl', className)}>
      {children}
    </div>
  );
}
