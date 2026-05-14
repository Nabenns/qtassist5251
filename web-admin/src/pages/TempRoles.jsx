import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, Clock } from 'lucide-react';
import { api, formatDateTime } from '../api.js';
import { ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select, FormField } from '../components/ui/Input.jsx';
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
        description="Active dan expired temporary role assignments."
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
              description="Tidak ada role temporary yang cocok dengan filter ini."
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
                      <Button
                        size="sm"
                        variant="danger"
                        leadingIcon={Trash2}
                        onClick={() => setConfirmRemove(r)}
                      >
                        Remove
                      </Button>
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
    </div>
  );
}
