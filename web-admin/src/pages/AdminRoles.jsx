import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, Shield, AlertCircle } from 'lucide-react';
import { api, ApiError, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select, FormField } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
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

/**
 * Admin Role manager.
 *
 * Discord role IDs listed here grant access to the admin dashboard.
 * Bootstrap rule (handled server-side): if this list is empty, anyone
 * with Discord guild ADMINISTRATOR permission can still log in as admin
 * so the very first admin can seed the list.
 */
export default function AdminRoles() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [guildRoles, setGuildRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, guild] = await Promise.all([
        api.get('/api/admin-roles'),
        api.get('/api/admin-roles/guild-roles').catch(() => ({ items: [] }))
      ]);
      setItems(list.items || []);
      setGuildRoles(guild.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
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
        title="Pengaturan Admin Roles"
        description="Daftar role Discord yang bisa akses dashboard admin. User dengan role ini saat login akan langsung masuk ke dashboard penuh."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={load}
              loading={loading}
            >
              Muat ulang
            </Button>
            <Button leadingIcon={Plus} onClick={() => setPicker(true)}>
              Tambah role
            </Button>
          </div>
        }
      />

      {items.length === 0 && !loading ? (
        <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning ring-1 ring-inset ring-warning/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Belum ada role admin yang diset</div>
              <div className="mt-1">
                Sementara ini siapapun dengan permission Discord ADMINISTRATOR di server bisa akses dashboard. Tambahkan minimal satu role admin biar lebih spesifik.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>Role</TH>
              <TH>Role ID</TH>
              <TH>Ditambahkan oleh</TH>
              <TH>Tanggal</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={5} rows={3} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={5}
              icon={Shield}
              title="Belum ada role admin"
              description="Klik 'Tambah role' di pojok kanan atas untuk mulai."
            />
          ) : (
            <TBody>
              {items.map((row) => {
                const live = guildRoles.find((r) => r.id === row.roleId);
                return (
                  <TR key={row.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {live?.color && live.color !== '#000000' ? (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: live.color }}
                          />
                        ) : (
                          <Shield className="h-3.5 w-3.5 text-muted-fg" />
                        )}
                        <span className="font-medium text-fg">
                          {live?.name || row.label || `role-${row.roleId}`}
                        </span>
                      </div>
                    </TD>
                    <TD className="font-mono text-xs">{row.roleId}</TD>
                    <TD className="font-mono text-xs">{row.addedByDiscordId || '-'}</TD>
                    <TD className="text-muted-fg">{formatDateTime(row.createdAt)}</TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="danger"
                        leadingIcon={Trash2}
                        onClick={() => setRemoving(row)}
                      >
                        Hapus
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          )}
        </DataTable>
      </Card>

      <PickerModal
        open={picker}
        guildRoles={guildRoles}
        existingIds={new Set(items.map((i) => i.roleId))}
        onClose={() => setPicker(false)}
        onAdded={() => {
          setPicker(false);
          load();
        }}
      />

      <RemoveModal
        row={removing}
        onClose={() => setRemoving(null)}
        onDone={() => {
          setRemoving(null);
          load();
        }}
      />
    </div>
  );
}

function PickerModal({ open, guildRoles, existingIds, onClose, onAdded }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setSelected('');
  }, [open]);

  const candidates = guildRoles.filter(
    (r) => !r.managed && !existingIds.has(r.id) && r.name !== '@everyone'
  );

  async function handleAdd() {
    if (!selected) return;
    setBusy(true);
    try {
      const role = guildRoles.find((r) => r.id === selected);
      await api.post('/api/admin-roles', {
        roleId: selected,
        label: role?.name || null
      });
      toast.success('Role admin ditambahkan');
      onAdded();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coba lagi.';
      toast.error('Gagal tambah role', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalHeader
        title="Tambah role admin"
        description="Pilih role Discord yang boleh akses dashboard admin."
        onClose={onClose}
      />
      <ModalBody>
        {guildRoles.length === 0 ? (
          <div className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Bot belum bisa akses guild atau belum ada role di server.
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted-fg">
            Semua role yang valid sudah ditambahkan.
          </div>
        ) : (
          <FormField label="Role">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">— pilih role —</option>
              {candidates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </Select>
          </FormField>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button onClick={handleAdd} loading={busy} disabled={!selected}>
          Tambahkan
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function RemoveModal({ row, onClose, onDone }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    if (!row) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin-roles/${row.id}`);
      toast.success('Role dihapus dari daftar admin');
      onDone();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coba lagi.';
      toast.error('Gagal hapus role', { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!row} onOpenChange={(v) => !v && onClose()}>
      <ModalHeader
        title="Hapus role admin?"
        description="User dengan role ini tidak akan bisa lagi akses dashboard admin."
        onClose={onClose}
      />
      <ModalBody>
        {row ? (
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>Role: <span className="font-medium text-fg">{row.label || `role-${row.roleId}`}</span></div>
            <div>ID: <span className="font-mono text-xs">{row.roleId}</span></div>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="danger"
          leadingIcon={Trash2}
          onClick={handleRemove}
          loading={busy}
        >
          Ya, hapus
        </Button>
      </ModalFooter>
    </Modal>
  );
}
