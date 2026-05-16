import { cn } from '../../lib/cn.js';

/**
 * Card primitive: brutalist visual container.
 *
 * Default: sharp corners, 1px border, no shadow. Pass `shadow="step"`
 * to render the dropped-offset shadow.
 *
 * Use Card + CardHeader + CardBody + CardFooter for structured panels.
 */
export function Card({ className, children, shadow, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface border border-border',
        shadow === 'step' && 'shadow-step',
        shadow === 'step-lg' && 'shadow-step-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, title, description, action, children }) {
  if (children) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-border px-4 py-3',
          className
        )}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border px-4 py-3',
        className
      )}
    >
      <div className="space-y-0.5">
        {title ? (
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-fg">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="text-xs text-muted-fg">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3',
        className
      )}
    >
      {children}
    </div>
  );
}
