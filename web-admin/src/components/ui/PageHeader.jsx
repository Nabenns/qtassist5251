import { cn } from '../../lib/cn.js';
import { HazardStripe } from './brutalist/HazardStripe.jsx';

/**
 * PageHeader — block-heavy page heading.
 *
 * Title in display font, weight 900, letter-spacing tight. Optional
 * `accent` prop renders a hazard stripe under the title row for
 * high-attention pages.
 *
 * Props:
 *   title:       string
 *   description: string
 *   actions:     React node, right-aligned
 *   accent:      "primary" | "warning" | "danger" | "success" — adds hazard stripe
 *   className:   extra classes
 */
export function PageHeader({ title, description, actions, accent, className }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-fg leading-none">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-fg max-w-2xl">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {accent ? <HazardStripe color={accent} height={4} density={10} /> : null}
    </div>
  );
}
