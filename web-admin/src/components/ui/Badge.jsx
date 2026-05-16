import { cn } from '../../lib/cn.js';

/**
 * Badge — sharp-corner pill for tags, counts, secondary status.
 *
 * For canonical state machine status (transaction.status, ibAccount.status,
 * etc.) prefer `<StatusPill>` from `components/ui/brutalist` which uses
 * uppercase mono and the standard tone mapping.
 */
const tones = {
  neutral: 'bg-surface-2 text-fg-muted border border-border',
  primary: 'bg-primary-soft text-primary border border-primary/30',
  success: 'bg-success-soft text-success border border-success/30',
  warning: 'bg-warning-soft text-warning border border-warning/30',
  danger: 'bg-danger-soft text-danger border border-danger/30',
  info: 'bg-info-soft text-info border border-info/30'
};

export function Badge({ tone = 'neutral', className, children, dot = false }) {
  return (
    <span className={cn('badge', tones[tone] || tones.neutral, className)}>
      {dot ? (
        <span
          className={cn('h-1.5 w-1.5 rounded-full bg-current opacity-90')}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  pending: { tone: 'warning', label: 'Menunggu' },
  pending_review: { tone: 'warning', label: 'Menunggu Review' },
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
