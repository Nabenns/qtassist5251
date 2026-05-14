import { useCallback, useEffect, useState } from 'react';
import { api, formatIDR, formatDateTime } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
];

const PAGE_SIZE = 25;

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/api/transactions?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">Review, approve, or reject manual payments.</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setPage(0);
                setStatus(e.target.value);
              }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="order ID or user ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(0);
                  load();
                }
              }}
            />
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              setPage(0);
              load();
            }}
          >
            Search
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Order ID</th>
                <th className="px-5 py-2.5">User</th>
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">Amount</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Created</th>
                <th className="px-5 py-2.5">Reviewed</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">No transactions match this filter.</td>
                </tr>
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-xs">{tx.orderId}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{tx.userId}</td>
                    <td className="px-5 py-2.5">{tx.productName || '-'}</td>
                    <td className="px-5 py-2.5">{formatIDR(tx.amount)}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={tx.status} /></td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-5 py-2.5 text-slate-500">{tx.reviewedAt ? formatDateTime(tx.reviewedAt) : '-'}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => setSelected(tx)} className="btn-secondary">Review</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-sm text-slate-600">
          <div>{total} total · page {page + 1} / {totalPages}</div>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected ? (
        <ReviewModal
          tx={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewModal({ tx, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/transactions/${encodeURIComponent(tx.orderId)}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load transaction details');
      });
    return () => {
      cancelled = true;
    };
  }, [tx.orderId]);

  async function handleApprove() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/transactions/${encodeURIComponent(tx.orderId)}/approve`);
      onChanged();
    } catch (err) {
      setError(err.message || 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setError(null);
    if (!rejectReason.trim()) {
      setError('Alasan penolakan wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/transactions/${encodeURIComponent(tx.orderId)}/reject`, {
        reason: rejectReason.trim()
      });
      onChanged();
    } catch (err) {
      setError(err.message || 'Reject failed');
    } finally {
      setBusy(false);
    }
  }

  const canAct = tx.status === 'pending' || tx.status === 'pending_review';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="card w-full max-w-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="font-semibold text-slate-900">Transaction Review</h2>
            <p className="text-xs font-mono text-slate-500">{tx.orderId}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-slate-500">User ID</div>
              <div className="font-mono text-xs">{tx.userId}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Product</div>
              <div>{tx.productName || (detail && detail.product && detail.product.name) || '-'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Amount</div>
              <div>{formatIDR(tx.amount)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Status</div>
              <div><StatusBadge status={tx.status} /></div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Created</div>
              <div>{formatDateTime(tx.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Reviewed</div>
              <div>{tx.reviewedAt ? formatDateTime(tx.reviewedAt) : '-'}</div>
            </div>
          </div>

          {tx.rejectionReason ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              <div className="font-medium">Rejection reason</div>
              <div className="mt-0.5">{tx.rejectionReason}</div>
            </div>
          ) : null}

          {tx.paymentProofUrl ? (
            <div>
              <div className="mb-1 text-xs uppercase text-slate-500">Payment Proof</div>
              <a href={tx.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={tx.paymentProofUrl}
                  alt="payment proof"
                  className="max-h-96 rounded-lg border border-slate-200 object-contain"
                />
              </a>
              <div className="mt-1 text-xs text-slate-500">
                <a className="text-brand-700 hover:underline" href={tx.paymentProofUrl} target="_blank" rel="noopener noreferrer">Open original</a>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
              No payment proof attached.
            </div>
          )}

          {error ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          ) : null}

          {showReject ? (
            <div className="space-y-2">
              <label className="label">Alasan penolakan</label>
              <textarea
                className="input min-h-[100px]"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Bukti tidak valid / nominal tidak sesuai / dll."
              />
            </div>
          ) : null}
        </div>

        {canAct ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {showReject ? (
              <>
                <button onClick={() => setShowReject(false)} className="btn-secondary" disabled={busy}>Cancel</button>
                <button onClick={handleReject} className="btn-danger" disabled={busy}>
                  {busy ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowReject(true)} className="btn-danger" disabled={busy}>Reject</button>
                <button onClick={handleApprove} className="btn-success" disabled={busy}>
                  {busy ? 'Approving...' : 'Approve'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
