import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, Clock, Plus, FastForward } from 'lucide-react';
import { api, formatDateTime, ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, FormField, Textarea } from '../components/ui/Input.jsx';
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
import { Tooltip } from '../components/ui/Tooltip.jsx';

export default function TempRoles() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('true');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [creating, setCreating] = useState(false);
  const [extending, setExtending] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function handleConfirmRemove() {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await api.delete(`/api/temproles/${confirmRemove.id}`);
      toast.success('Temporary role removed');
      setConfirmRemove(null);
      load();
    } catch (err) {
      toast.error('Failed to remove', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temporary Roles"
        description="Lihat, tambah, perpanjang, atau hapus temporary role assignments."
        actions={
          <div className="flex items-center gap-2">
            <FormField className="min-w-[160px]">
              <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="true">Active</option>
                <option value="expired">Expired</option>
                <option value="false">All</option>
              </Select>
            </FormField>
            <Button
              variant="secondary"
              onClick={load}
              loading={loading}
              leadingIcon={RefreshCw}
            >
              Refresh
            </Button>
            <Button leadingIcon={Plus} onClick={() => setCreating(true)}>
              Grant role
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
              <TH>User ID</TH>
              <TH>Role ID</TH>
              <TH>Granted</TH>
              <TH>Expires</TH>
              <TH>Reason</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={6} rows={5} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={6}
              icon={Clock}
              title="Tidak ada role temporary"
              description="Grant role baru pakai tombol di kanan atas."
              action={<Button leadingIcon={Plus} onClick={() => setCreating(true)}>Grant role</Button>}
            />
          ) : (
            <TBody>
              {items.map((r) => {
                const expired = new Date(r.expiresAt) <= new Date();
                return (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.userId}</TD>
                    <TD className="font-mono text-xs">{r.roleId}</TD>
                    <TD className="text-muted-fg">{formatDateTime(r.grantedAt)}</TD>
                    <TD>
                      <div className={expired ? 'text-muted-fg' : 'text-fg'}>
                        {formatDateTime(r.expiresAt)}
                      </div>
                      {expired ? (
                        <div className="text-xs text-danger">Expired</div>
                      ) : null}
                    </TD>
                    <TD className="max-w-[280px] truncate text-fg-muted">
                      <Tooltip content={r.reason || ''}>
                        <span>{r.reason || '-'}</span>
                      </Tooltip>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={FastForward}
                          onClick={() => setExtending(r)}
                        >
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          leadingIcon={Trash2}
                          onClick={() => setConfirmRemove(r)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          )}
        </DataTable>
      </Card>

      <Modal open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <ModalHeader
          title="Remove Temporary Role?"
          description="User akan kehilangan role di Discord, dan record dihapus dari database."
          onClose={() => setConfirmRemove(null)}
        />
        <ModalBody>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>User ID: <span className="font-mono text-xs">{confirmRemove?.userId}</span></div>
            <div>Role ID: <span className="font-mono text-xs">{confirmRemove?.roleId}</span></div>
            <div>Expires: <span className="text-muted-fg">{confirmRemove ? formatDateTime(confirmRemove.expiresAt) : ''}</span></div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmRemove(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmRemove} loading={busy} leadingIcon={Trash2}>
            Yes, remove
          </Button>
        </ModalFooter>
      </Modal>

      <CreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          toast.success('Role granted');
          load();
        }}
      />

      <ExtendModal
        record={extending}
        onClose={() => setExtending(null)}
        onExtended={() => {
          setExtending(null);
          toast.success('Extended');
          load();
        }}
      />
    </div>
  );
}

function CreateModal({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [userId, setUserId] = useState('');
  const [duration, setDuration] = useState('7d');
  const [reason, setReason] = useState('');
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

  useEffect(() => {
    if (!open) {
      setGuildId('');
      setRoleId('');
      setUserId('');
      setDuration('7d');
      setReason('');
    }
  }, [open]);

  async function handleSubmit() {
    if (!guildId || !roleId || !userId.trim() || !duration.trim()) {
      toast.warning('Lengkapi semua field wajib');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/temproles', {
        serverId: guildId,
        roleId,
        userId: userId.trim(),
        duration,
        reason: reason.trim() || undefined
      });
      onCreated();
    } catch (err) {
      toast.error('Grant failed', {
        description: err instanceof ApiError ? err.message || err.code : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalHeader
        title="Grant Temporary Role"
        description="Berikan role temporary ke user. Akan stack kalau user sudah punya role yang sama."
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
        <FormField label="Discord User ID">
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="contoh: 1234567890123456789"
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Duration" hint="Format: 30d, 1w, 12h, 1d12h, dll.">
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
          </FormField>
          <FormField label="Reason (opsional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hadiah event" />
          </FormField>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={busy} leadingIcon={Plus}>
          Grant role
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ExtendModal({ record, onClose, onExtended }) {
  const { toast } = useToast();
  const [duration, setDuration] = useState('7d');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!record) setDuration('7d');
  }, [record]);

  async function handleSubmit() {
    if (!record || !duration.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/temproles/${record.id}/extend`, { duration });
      onExtended();
    } catch (err) {
      toast.error('Extend failed', {
        description: err instanceof ApiError ? err.message || err.code : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!record} onOpenChange={(o) => !o && onClose()}>
      <ModalHeader
        title="Extend Temporary Role"
        description="Tambah durasi ke temporary role yang ada. Notification flags 24h/1h direset."
        onClose={onClose}
      />
      <ModalBody>
        {record ? (
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>User ID: <span className="font-mono text-xs">{record.userId}</span></div>
            <div>Role ID: <span className="font-mono text-xs">{record.roleId}</span></div>
            <div>Current expiry: <span className="text-muted-fg">{formatDateTime(record.expiresAt)}</span></div>
          </div>
        ) : null}
        <FormField label="Extend by" hint="Format: 30d, 1w, 12h, 1d12h, dll.">
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={busy} leadingIcon={FastForward}>
          Extend
        </Button>
      </ModalFooter>
    </Modal>
  );
}
