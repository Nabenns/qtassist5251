import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw, Package, Plus, Trash2 } from 'lucide-react';
import { api, formatIDR, formatDateTime, ApiError, paymentMethodLabel } from '../api.js';
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

const ALL_METHODS = [
  { value: 'qris', label: 'QRIS', fee: '0.7% + Rp 400' },
  { value: 'gopay', label: 'GoPay', fee: '0.7% + Rp 400' },
  { value: 'shopeepay', label: 'ShopeePay', fee: '0.7% + Rp 400' },
  { value: 'bni_va', label: 'BNI VA', fee: 'Rp 6.500' },
  { value: 'bri_va', label: 'BRI VA', fee: 'Rp 6.500' },
  { value: 'permata_va', label: 'Permata VA', fee: 'Rp 6.500' },
  { value: 'cimb_niaga_va', label: 'CIMB Niaga VA', fee: 'Rp 6.500' }
];

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
      toast.success('Produk dihapus');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error('Gagal menghapus', { description: err instanceof ApiError ? err.message : '' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk"
        description="Buat, edit, dan hapus produk role yang dijual via shop."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={load}
              loading={loading}
              leadingIcon={RefreshCw}
            >
              Muat ulang
            </Button>
            <Button leadingIcon={Plus} onClick={() => setCreating(true)}>
              Produk baru
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
              <TH>Nama</TH>
              <TH>Harga</TH>
              <TH>Durasi</TH>
              <TH>Role ID</TH>
              <TH>Metode</TH>
              <TH>Aktif</TH>
              <TH>Dibuat</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={8} rows={5} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={8}
              icon={Package}
              title="Belum ada produk"
              description="Klik 'Produk baru' untuk membuat produk pertama."
              action={<Button leadingIcon={Plus} onClick={() => setCreating(true)}>Produk baru</Button>}
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
                  <TD className="text-xs">
                    {(p.paymentMethods && p.paymentMethods.length > 0
                      ? p.paymentMethods
                      : ['qris']
                    )
                      .map((m) => paymentMethodLabel(m))
                      .join(', ')}
                  </TD>
                  <TD>
                    {p.isActive ? (
                      <Badge tone="success" dot>Aktif</Badge>
                    ) : (
                      <Badge tone="neutral">Nonaktif</Badge>
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
                        Hapus
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
          toast.success('Produk diperbarui');
          load();
        }}
      />

      <CreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          toast.success('Produk dibuat');
          load();
        }}
      />

      <Modal open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <ModalHeader
          title="Hapus produk?"
          description="Produk dihapus dari database. Transaksi yang sudah ada tidak terpengaruh."
          onClose={() => setConfirmDelete(null)}
        />
        <ModalBody>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="font-medium">{confirmDelete?.name}</div>
            <div className="mt-1 text-xs text-muted-fg">
              Harga: {confirmDelete ? formatIDR(confirmDelete.price) : ''} · Durasi:{' '}
              {confirmDelete ? formatDuration(confirmDelete.duration) : ''}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={busy}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} loading={busy} leadingIcon={Trash2}>
            Ya, hapus
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
  const [paymentMethods, setPaymentMethods] = useState(['qris']);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price ?? 0);
      setIsActive(Boolean(product.isActive));
      setPaymentMethods(
        Array.isArray(product.paymentMethods) && product.paymentMethods.length > 0
          ? product.paymentMethods
          : ['qris']
      );
    }
  }, [product]);

  async function handleSave() {
    if (!product) return;
    if (paymentMethods.length === 0) {
      toast.error('Pilih minimal 1 metode pembayaran');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/api/products/${product.id}`, {
        name: name.trim(),
        description,
        price: Number(price),
        isActive,
        paymentMethods
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
      <ModalHeader title="Edit Produk" onClose={onClose} />
      <ModalBody>
        <FormField label="Nama" htmlFor="p-name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Deskripsi" htmlFor="p-desc">
          <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Harga (IDR)" htmlFor="p-price">
          <Input
            id="p-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <FormField label="Metode Pembayaran (Web Shop)" htmlFor="p-methods-edit">
          <div className="space-y-1">
            {ALL_METHODS.map((m) => {
              const checked = paymentMethods.includes(m.value);
              return (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-center gap-3 border border-border p-2 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(paymentMethods);
                      if (e.target.checked) next.add(m.value);
                      else next.delete(m.value);
                      setPaymentMethods(Array.from(next));
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-bold">{m.label}</div>
                    <div className="text-xs text-muted-fg">Fee {m.fee}</div>
                  </div>
                </label>
              );
            })}
            {paymentMethods.length === 0 && (
              <div className="text-xs text-danger">Minimal 1 metode dipilih</div>
            )}
          </div>
        </FormField>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          Aktif (tampil di shop)
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button onClick={handleSave} loading={busy}>
          Simpan perubahan
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
  const [paymentMethods, setPaymentMethods] = useState(['qris']);
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
      setPaymentMethods(['qris']);
    }
  }, [open]);

  async function handleSubmit() {
    if (!guildId || !roleId || !name.trim() || !price || !duration) {
      toast.warning('Lengkapi semua field wajib');
      return;
    }
    if (paymentMethods.length === 0) {
      toast.error('Pilih minimal 1 metode pembayaran');
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
        isActive,
        paymentMethods
      });
      if (res.warning) {
        toast.warning('Produk dibuat dengan peringatan', { description: res.warning });
      }
      onCreated();
    } catch (err) {
      toast.error('Gagal membuat', { description: err instanceof ApiError ? err.message : 'Coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalHeader
        title="Produk Baru"
        description="Produk baru akan muncul di shop saat /shop-setup atau lewat Posting Discord."
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Server">
            <Select value={guildId} onChange={(e) => setGuildId(e.target.value)}>
              <option value="">Pilih server...</option>
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
              <option value="">{guildId ? 'Pilih role...' : 'Pilih server dulu'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.assignable}>
                  {r.name}
                  {!r.assignable ? ' (tidak bisa di-assign)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Nama">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP 30 Hari" />
        </FormField>
        <FormField label="Deskripsi">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Akses ke channel premium selama 30 hari..."
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Harga (IDR)">
            <Input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="50000"
            />
          </FormField>
          <FormField label="Durasi" hint="Format: 30d, 1w, 12h, 1d12h, dll.">
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30d" />
          </FormField>
        </div>
        <FormField label="Metode Pembayaran (Web Shop)" htmlFor="p-methods-create">
          <div className="space-y-1">
            {ALL_METHODS.map((m) => {
              const checked = paymentMethods.includes(m.value);
              return (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-center gap-3 border border-border p-2 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(paymentMethods);
                      if (e.target.checked) next.add(m.value);
                      else next.delete(m.value);
                      setPaymentMethods(Array.from(next));
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-bold">{m.label}</div>
                    <div className="text-xs text-muted-fg">Fee {m.fee}</div>
                  </div>
                </label>
              );
            })}
            {paymentMethods.length === 0 && (
              <div className="text-xs text-danger">Minimal 1 metode dipilih</div>
            )}
          </div>
        </FormField>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-border"
          />
          Aktif (tampil di shop)
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button onClick={handleSubmit} loading={busy} leadingIcon={Plus}>
          Buat produk
        </Button>
      </ModalFooter>
    </Modal>
  );
}
