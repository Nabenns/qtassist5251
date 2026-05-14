import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatIDR, formatDateTime } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

function StatCard({ label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/api/stats')
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load stats');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">{error}</div>;
  if (!data) return null;

  const { totals, revenue, recentTransactions } = data;
  const pendingTotal = (totals.pending || 0) + (totals.pending_review || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of bot activity, revenue, and recent transactions.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (All Time)" value={formatIDR(revenue.allTime)} hint="Sum of approved transactions" />
        <StatCard label="Revenue (30 Days)" value={formatIDR(revenue.last30Days)} hint="Approved in last 30 days" />
        <StatCard label="Pending Review" value={pendingTotal} hint={`${totals.pending_review} waiting admin review`} />
        <StatCard label="Active Temp Roles" value={totals.activeTempRoles} hint={`${totals.activeProducts} active products`} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Transactions" value={totals.transactions} />
        <StatCard label="Approved" value={totals.approved} />
        <StatCard label="Rejected" value={totals.rejected} />
        <StatCard label="Pending" value={totals.pending} />
        <StatCard label="Cancelled" value={totals.cancelled} />
        <StatCard label="Expired" value={totals.expired} />
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm text-brand-700 hover:underline">
            View all
          </Link>
        </div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-xs">{tx.orderId}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{tx.userId}</td>
                    <td className="px-5 py-2.5">{tx.productName || '-'}</td>
                    <td className="px-5 py-2.5">{formatIDR(tx.amount)}</td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
