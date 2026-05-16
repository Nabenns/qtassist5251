import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy
} from 'lucide-react';
import { api, ApiError, formatDateTime } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const STATUS_META = {
  pending: {
    tone: 'warning',
    label: 'Menunggu Verifikasi',
    icon: Clock,
    description:
      'Akun kamu sedang dicek otomatis. Bot akan ulang cek setiap beberapa menit sampai akun ditemukan dan deposit minimum tercapai.'
  },
  verified: {
    tone: 'success',
    label: 'Terverifikasi',
    icon: CheckCircle2,
    description:
      'Akun kamu sudah terdaftar sebagai IB. Role Discord IB sudah diberikan. Pertahankan volume trading harian agar role tetap aktif.'
  },
  failed: {
    tone: 'danger',
    label: 'Gagal',
    icon: XCircle,
    description:
      'Akun tidak bisa diverifikasi otomatis. Cek alasannya di bawah dan submit ulang nomor akun yang benar.'
  },
  removed: {
    tone: 'neutral',
    label: 'Role Dicabut',
    icon: AlertTriangle,
    description:
      'Role IB kamu sudah dicabut. Lihat alasan di bawah. Kamu bisa daftar ulang dengan submit nomor akun baru.'
  }
};

export default function DaftarIb() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accountInput, setAccountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reverifying, setReverifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ib/my-account');
      setData(res);
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!accountInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/api/ib/my-account', {
        brokerAccountNumber: accountInput.trim()
      });
      if (res.alreadyVerified) {
        toast.info('Akun ini sudah terverifikasi.');
      } else if (res.alreadyPending) {
        toast.info('Akun ini sudah dalam antrian verifikasi.');
      } else {
        toast.success('Nomor akun tersimpan, sedang dicek otomatis.');
      }
      setAccountInput('');
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Gagal menyimpan akun.';
      toast.error('Gagal menyimpan', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverify() {
    setReverifying(true);
    try {
      const res = await api.post('/api/ib/my-account/reverify');
      const status = res?.result?.status;
      if (status === 'verified') {
        toast.success('Berhasil! Akun terverifikasi.');
      } else if (status === 'failed') {
        toast.warning('Verifikasi gagal', { description: res?.result?.message });
      } else {
        toast.info('Belum bisa diverifikasi', { description: res?.result?.message });
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coba lagi.';
      toast.error('Gagal cek ulang', { description: msg });
    } finally {
      setReverifying(false);
    }
  }

  const config = data?.config;
  const account = data?.account;
  const meta = account ? STATUS_META[account.status] : null;
  const StatusIcon = meta?.icon || Clock;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar IB"
        description={
          user
            ? `Halo ${user.globalName || user.username}, kelola pendaftaran IB Valetax kamu di sini.`
            : 'Kelola pendaftaran IB Valetax kamu.'
        }
      />

      {config && !config.enabled ? (
        <Card>
          <CardBody>
            <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning ring-1 ring-inset ring-warning/30">
              <div className="font-medium">Sistem IB sedang dinonaktifkan</div>
              <div className="mt-1">
                Admin belum mengaktifkan pendaftaran IB. Coba lagi nanti.
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted-fg">Memuat data...</div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && config?.ibLink ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-fg">Belum punya akun IB Valetax?</div>
              <div className="text-xs text-muted-fg">
                Daftar dulu lewat link IB resmi di bawah, lalu balik ke sini untuk submit nomor akun.
              </div>
            </div>
            <a
              href={config.ibLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface-2"
            >
              <ExternalLink className="h-4 w-4" />
              Buka link IB
            </a>
          </CardBody>
        </Card>
      ) : null}

      {!loading && account ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 text-${meta.tone}`} />
                <div>
                  <div className="text-sm font-semibold text-fg">Status Akun Kamu</div>
                  <div className="text-xs text-muted-fg">{meta.label}</div>
                </div>
              </div>
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm space-y-1.5">
              <Row
                label="Nomor akun broker"
                value={
                  <span className="inline-flex items-center gap-2 font-mono text-xs">
                    {account.brokerAccountNumber}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(account.brokerAccountNumber);
                        toast.success('Nomor akun disalin');
                      }}
                      className="text-muted-fg hover:text-fg"
                      title="Salin"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                }
              />
              {account.totalDepositUsd != null ? (
                <Row
                  label="Total deposit terdeteksi"
                  value={`USD ${Number(account.totalDepositUsd).toFixed(2)}`}
                />
              ) : null}
              {config?.minDepositUsd ? (
                <Row label="Minimum deposit" value={`USD ${Number(config.minDepositUsd).toFixed(2)}`} />
              ) : null}
              <Row
                label="Terakhir dicek"
                value={account.lastCheckedAt ? formatDateTime(account.lastCheckedAt) : 'Belum pernah'}
              />
              {account.verifiedAt ? (
                <Row label="Terverifikasi pada" value={formatDateTime(account.verifiedAt)} />
              ) : null}
              {account.status === 'verified' && config?.volumeCheckEnabled ? (
                <>
                  <Row
                    label="Volume harian terakhir"
                    value={
                      account.lastVolumeAt
                        ? formatDateTime(account.lastVolumeAt)
                        : 'Belum ada'
                    }
                  />
                  {account.consecutiveZeroVolumeDays > 0 ? (
                    <Row
                      label="Hari tanpa volume"
                      value={
                        <span className="text-warning">
                          {account.consecutiveZeroVolumeDays} / {config.volumeGraceDays} hari
                        </span>
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <p className="text-sm text-muted-fg">{meta.description}</p>

            {account.lastError ? (
              <div className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning ring-1 ring-inset ring-warning/30">
                <div className="font-medium">Pesan dari sistem</div>
                <div className="mt-0.5">{account.lastError}</div>
              </div>
            ) : null}

            {account.removedAt ? (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
                <div className="font-medium">Role dicabut</div>
                <div className="mt-0.5">
                  {account.removedReason || 'Tidak ada alasan tercatat'}
                </div>
                <div className="text-xs text-danger/80">{formatDateTime(account.removedAt)}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(account.status === 'pending' || account.status === 'verified') ? (
                <Button
                  variant="secondary"
                  leadingIcon={RefreshCw}
                  onClick={handleReverify}
                  loading={reverifying}
                >
                  Cek ulang sekarang
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && (!account || account.status === 'failed' || account.status === 'removed') ? (
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-fg">
              {account ? 'Submit Akun Baru' : 'Submit Nomor Akun'}
            </div>
            <div className="text-xs text-muted-fg">
              {account
                ? 'Kalau kamu sudah register akun broker baru, masukkan nomor akun di sini.'
                : 'Masukkan nomor akun MT5 / Valetax kamu untuk dicek otomatis.'}
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FormField label="Nomor akun broker" htmlFor="acct">
                <Input
                  id="acct"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  placeholder="contoh: 1234567"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  disabled={submitting || (config && !config.enabled)}
                />
              </FormField>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                loading={submitting}
                disabled={!accountInput.trim() || (config && !config.enabled)}
              >
                {submitting ? 'Menyimpan...' : 'Submit & Verifikasi'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="text-xs text-muted-fg space-y-1">
          <div className="font-medium text-fg">Cara kerja:</div>
          <div>1. Daftar IB Valetax pakai link di atas (kalau belum punya akun).</div>
          <div>2. Setor minimal sesuai minimum deposit yang ditetapkan admin.</div>
          <div>3. Submit nomor akun di form ini.</div>
          <div>4. Bot akan cek otomatis ke Valetax — kamu akan dapat role IB Discord saat akun ditemukan dan deposit cukup.</div>
          <div>5. Jaga volume trading harian agar role tetap aktif.</div>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs uppercase tracking-wide text-muted-fg">{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}
