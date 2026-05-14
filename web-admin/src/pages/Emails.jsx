import { useCallback, useEffect, useState } from 'react';
import { api, formatDateTime } from '../api.js';

export default function Emails() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/emails?limit=200');
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load email bindings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search.trim()
    ? items.filter((b) => {
        const term = search.trim().toLowerCase();
        return (
          (b.email || '').toLowerCase().includes(term) ||
          (b.userId || '').toLowerCase().includes(term)
        );
      })
    : items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Email Bindings</h1>
          <p className="text-sm text-slate-500">{total} total registered emails.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Filter by email or user ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={load} className="btn-secondary" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
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
                <th className="px-5 py-2.5">Email</th>
                <th className="px-5 py-2.5">User ID</th>
                <th className="px-5 py-2.5">Server ID</th>
                <th className="px-5 py-2.5">Registered</th>
                <th className="px-5 py-2.5">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    {items.length === 0 ? 'No email bindings yet.' : 'No emails match the filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">{b.email}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{b.userId}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{b.serverId}</td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDateTime(b.registeredAt)}</td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDateTime(b.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
