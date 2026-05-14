export function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Pending', className: 'badge-pending' },
    pending_review: { label: 'Pending Review', className: 'badge-review' },
    approved: { label: 'Approved', className: 'badge-approved' },
    rejected: { label: 'Rejected', className: 'badge-rejected' },
    cancelled: { label: 'Cancelled', className: 'badge-cancelled' },
    expired: { label: 'Expired', className: 'badge-expired' }
  };
  const meta = map[status] || { label: status || 'unknown', className: 'badge-cancelled' };
  return <span className={meta.className}>{meta.label}</span>;
}
