import { cn } from '../../../lib/cn.js';

/**
 * StatusPill — terminal-style enum status display.
 *
 * Maps known status values to color tone + uppercase label. Unknown
 * status values fall through to a neutral pill with the raw value
 * uppercased.
 *
 * Props:
 *   status: string (e.g. "pending", "approved", "ib_verified")
 *   className: extra classes
 */

const STATUS_MAP = {
  pending: { tone: 'warning', label: 'PENDING' },
  pending_review: { tone: 'warning', label: 'PENDING_REVIEW' },
  approved: { tone: 'success', label: 'APPROVED' },
  rejected: { tone: 'danger', label: 'REJECTED' },
  cancelled: { tone: 'muted', label: 'CANCELLED' },
  expired: { tone: 'muted', label: 'EXPIRED' },
  verified: { tone: 'success', label: 'VERIFIED' },
  failed: { tone: 'danger', label: 'FAILED' },
  removed: { tone: 'muted', label: 'REMOVED' },
  active: { tone: 'success', label: 'ACTIVE' },
  inactive: { tone: 'muted', label: 'INACTIVE' },
  ok: { tone: 'success', label: 'OK' },
  error: { tone: 'danger', label: 'ERROR' }
};

const TONE_STYLES = {
  warning: 'bg-warning text-warning-fg',
  success: 'bg-success text-success-fg',
  danger: 'bg-danger text-danger-fg',
  muted: 'bg-surface-2 text-muted-fg ring-1 ring-inset ring-border',
  primary: 'bg-primary text-primary-fg'
};

export function StatusPill({ status, className }) {
  const meta = STATUS_MAP[status] || {
    tone: 'muted',
    label: String(status || 'UNKNOWN').toUpperCase()
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase leading-tight',
        TONE_STYLES[meta.tone] || TONE_STYLES.muted,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
