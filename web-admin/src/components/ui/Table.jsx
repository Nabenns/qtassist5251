import { cn } from '../../lib/cn.js';
import { SkeletonRow } from './Skeleton.jsx';
import { EmptyState } from './EmptyState.jsx';

/**
 * Lightweight table primitives. They are not headless data-tables; they
 * just style native <table> elements consistently with the design tokens.
 *
 * Usage:
 *   <DataTable>
 *     <THead>
 *       <TR>
 *         <TH>Name</TH>
 *         ...
 *       </TR>
 *     </THead>
 *     <TBody>
 *       {items.map(...)}
 *     </TBody>
 *   </DataTable>
 */

export function DataTable({ className, children, scrollable = true }) {
  const inner = (
    <table className={cn('min-w-full divide-y divide-border text-sm', className)}>
      {children}
    </table>
  );
  if (scrollable) {
    return <div className="overflow-x-auto">{inner}</div>;
  }
  return inner;
}

export function THead({ className, children }) {
  return (
    <thead className={cn('bg-surface-2 border-b-2 border-border', className)}>
      {children}
    </thead>
  );
}

export function TBody({ className, children }) {
  return <tbody className={cn('divide-y divide-border', className)}>{children}</tbody>;
}

export function TR({ className, children, ...props }) {
  return (
    <tr
      className={cn('hover:bg-surface-2 transition-colors duration-75', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, align = 'left', ...props }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({ className, children, align = 'left', ...props }) {
  return (
    <td
      className={cn(
        'px-4 py-2.5 align-middle text-fg text-sm',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableLoading({ columns = 5, rows = 6 }) {
  return (
    <TBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TR key={i}>
          <TD colSpan={columns} className="py-2.5">
            <SkeletonRow columns={columns} />
          </TD>
        </TR>
      ))}
    </TBody>
  );
}

export function TableEmpty({ columns = 5, icon, title, description, action }) {
  return (
    <TBody>
      <TR>
        <TD colSpan={columns}>
          <EmptyState icon={icon} title={title} description={description} action={action} />
        </TD>
      </TR>
    </TBody>
  );
}
