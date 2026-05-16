import { cn } from '../../../lib/cn.js';

/**
 * KPIBlock — block-heavy metric display.
 *
 * Renders a label, dominant value, and optional delta. Tone determines
 * background + text colors. Used on dashboard pages where we want a
 * single number to dominate visual hierarchy.
 *
 * Props:
 *   label:  small uppercase mono label, e.g. "PENDING REVIEW"
 *   value:  the dominant number/string, e.g. "03" or "IDR 2.4M"
 *   delta:  optional secondary line, e.g. "+1 LAST 1H"
 *   tone:   "primary" | "muted" | "success" | "warning" | "danger" (default "muted")
 *   size:   "md" | "lg" (default "md")
 *   className: extra classes
 */

const TONE_STYLES = {
  primary: {
    container: 'bg-primary text-primary-fg',
    label: 'text-primary-fg/65',
    delta: 'text-primary-fg/70'
  },
  muted: {
    container: 'bg-surface text-fg ring-1 ring-inset ring-border',
    label: 'text-muted-fg',
    delta: 'text-fg-muted'
  },
  success: {
    container: 'bg-success text-success-fg',
    label: 'text-success-fg/65',
    delta: 'text-success-fg/75'
  },
  warning: {
    container: 'bg-warning text-warning-fg',
    label: 'text-warning-fg/65',
    delta: 'text-warning-fg/75'
  },
  danger: {
    container: 'bg-danger text-danger-fg',
    label: 'text-danger-fg/65',
    delta: 'text-danger-fg/75'
  }
};

const SIZE_STYLES = {
  md: { value: 'text-4xl', wrapper: 'p-3' },
  lg: { value: 'text-5xl', wrapper: 'p-4' }
};

export function KPIBlock({
  label,
  value,
  delta,
  tone = 'muted',
  size = 'md',
  className
}) {
  const t = TONE_STYLES[tone] || TONE_STYLES.muted;
  const s = SIZE_STYLES[size] || SIZE_STYLES.md;
  return (
    <div className={cn(s.wrapper, t.container, className)}>
      {label ? (
        <div className={cn('font-mono text-[9px] font-bold uppercase tracking-[0.15em]', t.label)}>
          {label}
        </div>
      ) : null}
      <div className={cn('font-display font-black leading-none tracking-tight mt-1', s.value)}>
        {value}
      </div>
      {delta ? (
        <div className={cn('font-mono text-[10px] tracking-wider mt-1.5', t.delta)}>
          {delta}
        </div>
      ) : null}
    </div>
  );
}
