import { cn } from '../../../lib/cn.js';

/**
 * HazardStripe — diagonal repeating-linear-gradient strip used as
 * top-of-layout decoration, section dividers, and modal headers.
 *
 * Props:
 *   height: pixels (default 6)
 *   density: pixels per stripe period (default 12)
 *   color:  one of "primary" | "warning" | "danger" | "success"
 *   className: extra classes
 *
 * Implementation note: we inline the gradient as a style prop because
 * Tailwind cannot generate dynamic repeating-linear-gradient values
 * from arbitrary numeric props.
 */
export function HazardStripe({
  height = 6,
  density = 12,
  color = 'primary',
  className
}) {
  const stripeColors = {
    primary: 'rgb(var(--primary))',
    warning: 'rgb(var(--warning))',
    danger: 'rgb(var(--danger))',
    success: 'rgb(var(--success))'
  };
  const accent = stripeColors[color] || stripeColors.primary;
  const bg = 'rgb(var(--bg))';
  const period = density * 2;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('w-full', className)}
      style={{
        height: `${height}px`,
        backgroundImage: `repeating-linear-gradient(135deg, ${accent} 0 ${density}px, ${bg} ${density}px ${period}px)`
      }}
    />
  );
}
