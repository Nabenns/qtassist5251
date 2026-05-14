import { useCallback, useEffect, useState } from 'react';
import { api, formatDateTime } from '../api.js';

export default function TempRoles() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('true'); // 'true' = active, 'expired' = expired, 'false' = all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ active: filter, limit: '200' });
      const res = await api.get(`/api/temproles?${params.toString()}`);
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load temporary roles');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(id) {
    if (!confirm('Hapus role temporary ini? User akan kehilangan role di Discord.')) return;
    try {
      await api.delete(`/api/temproles/${id}`);
      load();
    } catch (err) {
      alert(err.message || 'Failed to remove temprole');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Temporary Roles</h1>
          <p className="text-sm text-slate-500">Active and expired temporary role assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="true">Active</option>
            <option value="expired">Expired</option>
            <option value="false">All</option>
          </select>
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
                <th className="px-5 py-2.5">User ID</th>
                <th className="px-5 py-2.5">Role ID</th>
                <th className="px-5 py-2.5">Granted</th>
                <th className="px-5 py-2.5">Expires</th>
                <th className="px-5 py-2.5">Reason</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No temporary roles match this filter.
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const expired = new Date(r.expiresAt) <= new Date();
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-mono text-xs">{r.userId}</td>
                      <td className="px-5 py-2.5 font-mono text-xs">{r.roleId}</td>
                      <td className="px-5 py-2.5 text-slate-500">{formatDateTime(r.grantedAt)}</td>
                      <td className="px-5 py-2.5">
                        <div className={expired ? 'text-slate-500' : 'text-slate-900'}>
                          {formatDateTime(r.expiresAt)}
                        </div>
                        {expired ? (
                          <div className="text-xs text-red-600">Expired</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-2.5 max-w-[280px] truncate text-slate-600" title={r.reason || ''}>
                        {r.reason || '-'}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <button onClick={() => handleRemove(r.id)} className="btn-danger">Remove</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
