import { cn } from '../../lib/cn.js';

/**
 * Empty / no-data placeholder. Render inside cards/tables when there is
 * nothing to show. Optionally pass a title, description, leading icon,
 * and an action button.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12',
        className
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted-fg">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : null}
      {title ? <div className="text-sm font-semibold text-fg">{title}</div> : null}
      {description ? (
        <div className="mt-1 max-w-sm text-xs text-muted-fg">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
