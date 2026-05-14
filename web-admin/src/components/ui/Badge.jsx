import { cn } from '../../lib/cn.js';

const tones = {
  neutral: 'bg-surface-3 text-fg-muted ring-1 ring-inset ring-border',
  primary: 'bg-primary-soft text-primary ring-1 ring-inset ring-primary/20',
  success: 'bg-success-soft text-success ring-1 ring-inset ring-success/20',
  warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/20',
  danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/20',
  info: 'bg-info-soft text-info ring-1 ring-inset ring-info/20'
};

export function Badge({ tone = 'neutral', className, children, dot = false }) {
  return (
    <span className={cn('badge', tones[tone] || tones.neutral, className)}>
      {dot ? (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-current',
            'opacity-80'
          )}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  pending: { tone: 'warning', label: 'Menunggu' },
  pending_review: { tone: 'info', label: 'Menunggu Review' },
  approved: { tone: 'success', label: 'Disetujui' },
  rejected: { tone: 'danger', label: 'Ditolak' },
  cancelled: { tone: 'neutral', label: 'Dibatalkan' },
  expired: { tone: 'neutral', label: 'Kadaluarsa' }
};

export function StatusBadge({ status, className }) {
  const meta = STATUS_TONES[status] || { tone: 'neutral', label: status || 'unknown' };
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}
