import { useCallback, useEffect, useState } from 'react';
import { api, formatIDR, formatDateTime } from '../api.js';

function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const seconds = Math.floor(n / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.join(' ') || `${seconds}s`;
}

export default function Products() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/products');
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">Edit product details. Create or delete products via the bot's slash commands.</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Price</th>
                <th className="px-5 py-2.5">Duration</th>
                <th className="px-5 py-2.5">Role ID</th>
                <th className="px-5 py-2.5">Active</th>
                <th className="px-5 py-2.5">Created</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">No products yet.</td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-slate-500 line-clamp-1">{p.description}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5">{formatIDR(p.price)}</td>
                    <td className="px-5 py-2.5">{formatDuration(p.duration)}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{p.roleId}</td>
                    <td className="px-5 py-2.5">
                      {p.isActive ? (
                        <span className="badge badge-approved">Active</span>
                      ) : (
                        <span className="badge badge-cancelled">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDateTime(p.createdAt)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => setEditing(p)} className="btn-secondary">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <EditModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function EditModal({ product, onClose, onSaved }) {
  const [name, setName] = useState(product.name || '');
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price);
  const [isActive, setIsActive] = useState(Boolean(product.isActive));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/api/products/${product.id}`, {
        name: name.trim(),
        description,
        price: Number(price),
        isActive
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Edit Product</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Price (IDR)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Active (shown in shop)
          </label>
          {error ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button onClick={onClose} className="btn-secondary" disabled={busy}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
