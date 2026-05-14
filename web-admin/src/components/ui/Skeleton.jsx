import { cn } from '../../lib/cn.js';

export function Skeleton({ className, ...props }) {
  return <div className={cn('skeleton', className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${85 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({ columns = 5, className }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('surface p-5 space-y-3', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
