import { useCallback, useEffect, useState } from 'react';
import { Pencil, RefreshCw, Package } from 'lucide-react';
import { api, formatIDR, formatDateTime } from '../api.js';
import { ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Textarea, FormField } from '../components/ui/Input.jsx';
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
      <PageHeader
        title="Products"
        description="Edit product details. Create atau delete via bot slash commands."
        actions={
          <Button
            variant="secondary"
            onClick={load}
            loading={loading}
            leadingIcon={RefreshCw}
          >
            Refresh
          </Button>
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
              description="Buat produk lewat /product-create di Discord."
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
                    <Button
                      size="sm"
                      variant="secondary"
                      leadingIcon={Pencil}
                      onClick={() => setEditing(p)}
                    >
                      Edit
                    </Button>
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
