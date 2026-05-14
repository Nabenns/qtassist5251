import { clsx } from 'clsx';

/**
 * Small classnames helper. Just a re-export of clsx so component code stays
 * concise: `cn('btn', isPrimary && 'btn-primary')`.
 */
export function cn(...inputs) {
  return clsx(inputs);
}
