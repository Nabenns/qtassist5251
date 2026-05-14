import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw, Package, Plus, Trash2 } from 'lucide-react';
import { api, formatIDR, formatDateTime, ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Textarea, Select, FormField } from '../components/ui/Input.jsx';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '../components/ui/Modal.jsx';
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableLoading,
  TableEmpty
} from '../components/ui/Table.jsx';
import { useToast } from '../components/ui/Toast.jsx';

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
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.delete(`/api/products/${confirmDelete.id}`);
      toast.success('Product deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof ApiError ? err.message : '' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Buat, edit, dan hapus produk role yang dijual via shop."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={load}
              loading={loading}
              leadingIcon={RefreshCw}
            >
              Refresh
            </Button>
            <Button leadingIcon={Plus} onClick={() => setCreating(true)}>
              New product
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Price</TH>
              <TH>Duration</TH>
              <TH>Role ID</TH>
              <TH>Active</TH>
              <TH>Created</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={7} rows={5} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={7}
              icon={Package}
              title="Belum ada produk"
              description="Klik 'New product' untuk bikin produk pertama."
              action={<Button leadingIcon={Plus} onClick={() => setCreating(true)}>New product</Button>}
            />
          ) : (
            <TBody>
              {items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium text-fg">{p.name}</div>
                    {p.description ? (
                      <div className="text-xs text-muted-fg line-clamp-1 max-w-md">
                        {p.description}
                      </div>
                    ) : null}
                  </TD>
                  <TD>{formatIDR(p.price)}</TD>
                  <TD>{formatDuration(p.duration)}</TD>
                  <TD className="font-mono text-xs">{p.roleId}</TD>
                  <TD>
                    {p.isActive ? (
                      <Badge tone="success" dot>Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </TD>
                  <TD className="text-muted-fg">{formatDateTime(p.createdAt)}</TD>
                  <TD align="right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        leadingIcon={Pencil}
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        leadingIcon={Trash2}
                        onClick={() => setConfirmDelete(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          )}
        </DataTable>
      </Card>

      <EditModal
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success('Product updated');
          load();
        }}
      />

      <CreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          toast.success('Product created');
          load();
        }}
      />

      <Modal open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <ModalHeader
          title="Delete product?"
          description="Produk dihapus dari database; transaksi yang sudah ada tidak ke-touch."
          onClose={() => setConfirmDelete(null)}
        />
        <ModalBody>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="font-medium">{confirmDelete?.name}</div>
            <div className="mt-1 text-xs text-muted-fg">
              Price: {confirmDelete ? formatIDR(confirmDelete.price) : ''} · Duration:{' '}
              {confirmDelete ? formatDuration(confirmDelete.duration) : ''}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} loading={busy} leadingIcon={Trash2}>
            Yes, delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function EditModal({ product, onClose, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price ?? 0);
      setIsActive(Boolean(product.isActive));
    }
  }, [product]);

  async function handleSave() {
    if (!product) return;
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
      toast.error('Save failed', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!product} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader title="Edit Product" onClose={onClose} />
      <ModalBody>
        <FormField label="Name" htmlFor="p-name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="p-desc">
          <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Price (IDR)" htmlFor="p-price">
          <Input
            id="p-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          Active (shown in shop)
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={busy}>
          Save changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function CreateModal({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30d');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get('/api/discord/guilds')
      .then((res) => {
        const list = res.items || [];
        setGuilds(list);
        if (list.length === 1) setGuildId(list[0].id);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!guildId) {
      setRoles([]);
      setRoleId('');
      return;
    }
    setRolesLoading(true);
    api
      .get(`/api/discord/guilds/${guildId}/roles`)
      .then((res) => setRoles(res.items || []))
      .catch(() => setRoles([]))
      .finally(() => setRolesLoading(false));
  }, [guildId]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setGuildId('');
      setRoleId('');
      setName('');
      setDescription('');
      setPrice('');
      setDuration('30d');
      setIsActive(true);
    }
  }, [open]);

  async function handleSubmit() {
    if (!guildId || !roleId || !name.trim() || !price || !duration) {
      toast.warning('Lengkapi semua field wajib');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/api/products', {
        serverId: guildId,
        roleId,
        name: name.trim(),
        description,
        price: Number(price),
        duration,
        isActive
      });
      if (res.warning) {
        toast.warning('Product created with warning', { description: res.warning });
      }
      onCreated();
    } catch (err) {
      toast.error('Create failed', { description: err instanceof ApiError ? err.message : 'Coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalHeader
        title="New Product"
        description="Produk baru muncul di shop pas /shop-setup atau Discord Posts."
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Guild">
            <Select value={guildId} onChange={(e) => setGuildId(e.target.value)}>
              <option value="">Pilih guild...</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Role">
            <Select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={!guildId || rolesLoading}
            >
              <option value="">{guildId ? 'Pilih role...' : 'Pilih guild dulu'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.assignable}>
                  {r.name}
                  {!r.assignable ? ' (not assignable)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP 30 Days" />
        </FormField>
        <FormField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Akses ke channel premium selama 30 hari..."
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Price (IDR)">
            <Input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="50000"
            />
          </FormField>
          <FormField label="Duration" hint="Format: 30d, 1w, 12h, 1d12h, dll.">
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30d" />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          Active (shown in shop)
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={busy} leadingIcon={Plus}>
          Create product
        </Button>
      </ModalFooter>
    </Modal>
  );
}
