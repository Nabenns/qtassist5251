import { cn } from '../../lib/cn.js';

/**
 * Page heading with optional subtitle and right-aligned actions.
 */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="text-sm text-muted-fg">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
