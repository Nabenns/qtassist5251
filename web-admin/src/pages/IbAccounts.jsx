import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  Users,
  Activity,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea, FormField } from '../components/ui/Input.jsx';
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
import { useRealtimeEvent } from '../lib/realtime.jsx';

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'failed', label: 'Gagal' },
  { value: 'removed', label: 'Dicabut' }
];

const STATUS_TONES = {
  pending: { tone: 'warning', label: 'Menunggu' },
  verified: { tone: 'success', label: 'Terverifikasi' },
  failed: { tone: 'danger', label: 'Gagal' },
  removed: { tone: 'neutral', label: 'Dicabut' }
};

const PAGE_SIZE = 25;

export default function IbAccounts() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/api/ib/accounts?${params.toString()}`);
      setItems(res.items || []);
      setTotal(res.total || 0);
      setError(null);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar akun IB.');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent(
    ['ib.verified', 'ib.failed', 'ib.role_removed', 'ib.cookie_expired'],
    () => load()
  );

  async function handleRunVolume() {
    setRunning(true);
    try {
      const res = await api.post('/api/ib/volume/run');
      toast.success('Volume cron dijalankan', {
        description: `Diproses ${res.accountsProcessed || 0} akun · ${res.rolesRevoked || 0} role dicabut`
      });
      load();
    } catch (err) {
      toast.error('Gagal menjalankan volume cron', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setRunning(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Akun IB"
        description="Daftar pendaftaran IB user beserta status verifikasi dan riwayat volume."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leadingIcon={Activity}
              onClick={handleRunVolume}
              loading={running}
            >
              Jalankan cek volume
            </Button>
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={load}
              loading={loading}
            >
              Muat ulang
            </Button>
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <FormField label="Status" className="min-w-[180px]">
            <Select
              value={status}
              onChange={(e) => {
                setPage(0);
                setStatus(e.target.value);
              }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Cari" className="flex-1 min-w-[260px]">
            <Input
              leadingIcon={Search}
              placeholder="nomor akun atau Discord User ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(0);
                  load();
                }
              }}
            />
          </FormField>
          <Button
            variant="secondary"
            onClick={() => {
              setPage(0);
              load();
            }}
          >
            Terapkan
          </Button>
        </CardBody>
      </Card>

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      <Card>
        <DataTable>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Nomor Akun</TH>
              <TH>Status</TH>
              <TH>Deposit</TH>
              <TH>Retry</TH>
              <TH>Terakhir Cek</TH>
              <TH>Volume Terakhir</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={8} rows={6} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={8}
              icon={Users}
              title="Belum ada pendaftaran IB"
              description="User akan muncul di sini begitu mereka submit nomor akun via Discord."
            />
          ) : (
            <TBody>
              {items.map((a) => {
                const meta = STATUS_TONES[a.status] || { tone: 'neutral', label: a.status };
                return (
                  <TR key={a.id}>
                    <TD>
                      <Link
                        to={`/users/${a.userId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {a.userId}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs">{a.brokerAccountNumber}</TD>
                    <TD>
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </TD>
                    <TD>{a.totalDepositUsd != null ? `USD ${Number(a.totalDepositUsd).toFixed(2)}` : '-'}</TD>
                    <TD className="text-fg-muted">{a.retryCount}</TD>
                    <TD className="text-muted-fg">{a.lastCheckedAt ? formatDateTime(a.lastCheckedAt) : '-'}</TD>
                    <TD className="text-muted-fg">
                      {a.lastVolumeAt ? (
                        formatDateTime(a.lastVolumeAt)
                      ) : a.consecutiveZeroVolumeDays > 0 ? (
                        <span className="text-warning">{a.consecutiveZeroVolumeDays} hari tanpa volume</span>
                      ) : (
                        '-'
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={Eye}
                          onClick={() => setSelected(a)}
                        >
                          Detail
                        </Button>
                        {a.status !== 'verified' ? null : (
                          <Button
                            size="sm"
                            variant="danger"
                            leadingIcon={Trash2}
                            onClick={() => setRemoving(a)}
                          >
                            Cabut role
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          )}
        </DataTable>
        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-5 py-2.5 text-sm text-muted-fg">
          <div>
            {total} total · halaman {page + 1} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Sebelumnya
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </Card>

      <DetailModal
        account={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          load();
        }}
      />

      <RemoveModal
        account={removing}
        onClose={() => setRemoving(null)}
        onDone={() => {
          setRemoving(null);
          load();
        }}
      />
    </div>
  );
}

function DetailModal({ account, onClose, onChanged }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) {
      setDetail(null);
      return;
    }
    setLoading(true);
    api
      .get(`/api/ib/accounts/${account.id}`)
      .then((res) => setDetail(res))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [account]);

  async function handleReverify() {
    if (!account) return;
    setBusy(true);
    try {
      const res = await api.post(`/api/ib/accounts/${account.id}/reverify`);
      const status = res?.result?.status;
      if (status === 'verified') {
        toast.success('Akun terverifikasi');
      } else if (status === 'failed') {
        toast.warning('Verifikasi gagal', { description: res?.result?.message });
      } else {
        toast.info('Diset ulang ke pending', { description: res?.result?.message });
      }
      onChanged();
    } catch (err) {
      toast.error('Gagal re-verify', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  if (!account) return null;
  const meta = STATUS_TONES[account.status] || { tone: 'neutral', label: account.status };
  const volumes = detail?.volumes || [];

  return (
    <Modal open={!!account} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader
        title={`Akun IB · ${account.brokerAccountNumber}`}
        description={`Discord user ${account.userId}`}
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Status" value={<Badge tone={meta.tone} dot>{meta.label}</Badge>} />
          <Field label="Retry count" value={account.retryCount} />
          <Field label="Total deposit" value={account.totalDepositUsd != null ? `USD ${Number(account.totalDepositUsd).toFixed(2)}` : '-'} />
          <Field label="Verified at" value={account.verifiedAt ? formatDateTime(account.verifiedAt) : '-'} />
          <Field label="Last checked" value={account.lastCheckedAt ? formatDateTime(account.lastCheckedAt) : '-'} />
          <Field label="Next retry" value={account.nextRetryAt ? formatDateTime(account.nextRetryAt) : '-'} />
          <Field label="Last volume" value={account.lastVolumeAt ? formatDateTime(account.lastVolumeAt) : '-'} />
          <Field label="Hari tanpa volume" value={account.consecutiveZeroVolumeDays} />
        </div>

        {account.lastError ? (
          <div className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            <div className="font-medium">Pesan error terakhir</div>
            <div className="mt-0.5">{account.lastError}</div>
          </div>
        ) : null}

        {account.removedAt ? (
          <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            <div className="font-medium">Role dicabut</div>
            <div className="mt-0.5">{account.removedReason || 'Tidak ada alasan tercatat'}</div>
            <div className="text-xs text-danger/80">{formatDateTime(account.removedAt)}</div>
          </div>
        ) : null}

        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-fg">
            Riwayat volume (60 hari terakhir)
          </div>
          {loading ? (
            <div className="text-sm text-muted-fg">Memuat...</div>
          ) : volumes.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted-fg">
              Belum ada data volume.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-surface-2">
                  <tr className="text-left uppercase text-muted-fg">
                    <th className="px-3 py-1.5">Tanggal</th>
                    <th className="px-3 py-1.5">Lots</th>
                    <th className="px-3 py-1.5">Diambil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {volumes.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-1.5 font-mono">{v.date}</td>
                      <td className="px-3 py-1.5">{v.volumeLots.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-muted-fg">{formatDateTime(v.fetchedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {account.lastCheckResponse ? (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-fg">
              Respon broker terakhir (sanitized)
            </div>
            <pre className="overflow-x-auto rounded-md bg-surface px-3 py-2 text-[11px] text-fg-muted ring-1 ring-border">
              {JSON.stringify(account.lastCheckResponse, null, 2)}
            </pre>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Tutup
        </Button>
        <Button
          onClick={handleReverify}
          loading={busy}
          leadingIcon={CheckCircle2}
        >
          Verifikasi ulang sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function RemoveModal({ account, onClose, onDone }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) setReason('');
  }, [account]);

  async function handleRemove() {
    if (!account) return;
    setBusy(true);
    try {
      await api.post(`/api/ib/accounts/${account.id}/remove`, {
        reason: reason.trim() || undefined
      });
      toast.success('Role IB dicabut');
      onDone();
    } catch (err) {
      toast.error('Gagal mencabut role', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!account} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader
        title="Cabut role IB?"
        description="User akan kehilangan role IB di Discord."
        onClose={onClose}
      />
      <ModalBody>
        {account ? (
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>User: <span className="font-mono text-xs">{account.userId}</span></div>
            <div>Akun: <span className="font-mono text-xs">{account.brokerAccountNumber}</span></div>
            {account.totalDepositUsd != null ? (
              <div>Deposit terakhir: USD {Number(account.totalDepositUsd).toFixed(2)}</div>
            ) : null}
          </div>
        ) : null}
        <FormField label="Alasan (opsional)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Volume rendah selama 14 hari, dll."
            rows={3}
          />
        </FormField>
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
          Ya, cabut role
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-fg">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
