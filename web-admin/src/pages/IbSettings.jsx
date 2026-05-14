import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Save,
  Cookie,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Power,
  Settings as SettingsIcon
} from 'lucide-react';
import { api, ApiError, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea, FormField } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

const COOKIE_STATUS_TONES = {
  ok: { tone: 'success', label: 'OK' },
  unknown: { tone: 'neutral', label: 'Belum dites' },
  expired: { tone: 'danger', label: 'Kedaluwarsa' },
  error: { tone: 'warning', label: 'Error' }
};

export default function IbSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);

  const [guilds, setGuilds] = useState([]);
  const [serverId, setServerId] = useState('');
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);

  // Form fields
  const [enabled, setEnabled] = useState(false);
  const [ibRoleId, setIbRoleId] = useState('');
  const [registrationChannelId, setRegistrationChannelId] = useState('');
  const [notificationChannelId, setNotificationChannelId] = useState('');
  const [ibLink, setIbLink] = useState('');
  const [retryInterval, setRetryInterval] = useState(5);
  const [maxRetries, setMaxRetries] = useState(3);
  const [minDeposit, setMinDeposit] = useState(100);
  const [volumeCheck, setVolumeCheck] = useState(true);
  const [graceDays, setGraceDays] = useState(7);
  const [minDailyVolume, setMinDailyVolume] = useState(0);
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedButtonLabel, setEmbedButtonLabel] = useState('');
  const [cookieInput, setCookieInput] = useState('');

  // Load guild list once
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/discord/guilds')
      .then((res) => {
        if (cancelled) return;
        const list = res.items || [];
        setGuilds(list);
        if (list.length === 1 && !serverId) setServerId(list[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = useCallback(
    async (sid) => {
      if (!sid) return;
      setLoading(true);
      try {
        const res = await api.get(`/api/ib/config?serverId=${encodeURIComponent(sid)}`);
        setConfig(res);
        setEnabled(Boolean(res.enabled));
        setIbRoleId(res.ibRoleId || '');
        setRegistrationChannelId(res.registrationChannelId || '');
        setNotificationChannelId(res.notificationChannelId || '');
        setIbLink(res.ibLink || '');
        setRetryInterval(res.retryIntervalMinutes ?? 5);
        setMaxRetries(res.maxRetries ?? 3);
        setMinDeposit(res.minDepositUsd ?? 100);
        setVolumeCheck(Boolean(res.volumeCheckEnabled));
        setGraceDays(res.volumeGraceDays ?? 7);
        setMinDailyVolume(res.minDailyVolumeLots ?? 0);
        setEmbedTitle(res.embedTitle || '');
        setEmbedDescription(res.embedDescription || '');
        setEmbedButtonLabel(res.embedButtonLabel || '');
        setCookieInput('');
        setError(null);
      } catch (err) {
        setError(err.message || 'Gagal memuat konfigurasi IB.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!serverId) return;
    loadConfig(serverId);
    // Reload channels + roles when guild changes
    Promise.all([
      api.get(`/api/discord/guilds/${serverId}/channels`).then((r) => setChannels(r.items || [])).catch(() => setChannels([])),
      api.get(`/api/discord/guilds/${serverId}/roles`).then((r) => setRoles(r.items || [])).catch(() => setRoles([]))
    ]);
  }, [serverId, loadConfig]);

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        serverId,
        enabled,
        ibRoleId: ibRoleId || null,
        registrationChannelId: registrationChannelId || null,
        notificationChannelId: notificationChannelId || null,
        ibLink: ibLink.trim() || null,
        retryIntervalMinutes: Number(retryInterval),
        maxRetries: Number(maxRetries),
        minDepositUsd: Number(minDeposit),
        volumeCheckEnabled: volumeCheck,
        volumeGraceDays: Number(graceDays),
        minDailyVolumeLots: Number(minDailyVolume),
        embedTitle: embedTitle.trim() || null,
        embedDescription: embedDescription.trim() || null,
        embedButtonLabel: embedButtonLabel.trim() || null
      };
      if (cookieInput.trim()) {
        body.cookie = cookieInput.trim();
      }
      const res = await api.put('/api/ib/config', body);
      setConfig(res.config);
      setCookieInput('');
      toast.success('Pengaturan IB tersimpan');
    } catch (err) {
      toast.error('Gagal menyimpan', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestCookie() {
    if (!serverId) return;
    setTesting(true);
    try {
      const res = await api.post('/api/ib/config/test-cookie', { serverId });
      if (res.ok) {
        toast.success('Cookie valid');
      } else {
        toast.warning('Cookie bermasalah', {
          description: res.message || res.status
        });
      }
      loadConfig(serverId);
    } catch (err) {
      toast.error('Gagal mengetes cookie', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleClearCookie() {
    if (!serverId) return;
    if (!confirm('Hapus cookie Valetax yang tersimpan?')) return;
    try {
      const res = await api.delete('/api/ib/config/cookie', {
        // delete with body via fetch wrapper not supported; fall back to put
      });
      // The api wrapper does not send body with DELETE, so we re-fetch.
      loadConfig(serverId);
      toast.success('Cookie dihapus');
    } catch (err) {
      // If DELETE without body fails (no serverId), fall back to PUT cookie="".
      try {
        await api.put('/api/ib/config', { serverId, cookie: '' });
        loadConfig(serverId);
        toast.success('Cookie dihapus');
      } catch (err2) {
        toast.error('Gagal menghapus cookie', {
          description: err2 instanceof ApiError ? err2.message : 'Coba lagi.'
        });
      }
    }
  }

  const cookieStatus = config?.cookie?.lastTestStatus || 'unknown';
  const cookieMeta = COOKIE_STATUS_TONES[cookieStatus] || COOKIE_STATUS_TONES.unknown;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan IB"
        description="Konfigurasi sistem pendaftaran IB Valetax: cookie, role, retry, dan threshold."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FormField className="min-w-[220px]">
              <Select
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
              >
                <option value="">Pilih server...</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={() => serverId && loadConfig(serverId)}
              loading={loading}
              disabled={!serverId}
            >
              Muat ulang
            </Button>
          </div>
        }
      />

      {!serverId ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted-fg">
              Pilih server Discord di atas untuk memuat konfigurasi.
            </div>
          </CardBody>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" /> Konfigurasi Utama
                </span>
              }
              description="Master switch + integrasi Discord"
            />
            <CardBody className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-fg">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <div>
                  <div className="font-medium">Aktifkan sistem IB</div>
                  <div className="text-xs text-muted-fg">
                    Saat dimatikan, tombol pendaftaran tetap muncul di Discord
                    tapi bot menolak menerima pendaftaran baru dan cron
                    verifikasi tidak jalan.
                  </div>
                </div>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Role IB">
                  <Select value={ibRoleId} onChange={(e) => setIbRoleId(e.target.value)}>
                    <option value="">Tidak diatur</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id} disabled={!r.assignable}>
                        {r.name}
                        {!r.assignable ? ' (tidak bisa di-assign)' : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Channel pendaftaran (auto-isi setelah /ib-setup)">
                  <Select
                    value={registrationChannelId}
                    onChange={(e) => setRegistrationChannelId(e.target.value)}
                  >
                    <option value="">Tidak diatur</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Channel notifikasi admin (opsional)">
                  <Select
                    value={notificationChannelId}
                    onChange={(e) => setNotificationChannelId(e.target.value)}
                  >
                    <option value="">Tidak diatur</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Link IB / Affiliate">
                  <Input
                    value={ibLink}
                    onChange={(e) => setIbLink(e.target.value)}
                    placeholder="https://link.valetax.com/?ref=..."
                  />
                </FormField>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Cookie className="h-4 w-4" /> Cookie Valetax
                </span>
              }
              description="Session cookie untuk akses dashboard IB"
            />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-fg">Status</span>
                <Badge tone={cookieMeta.tone} dot>
                  {cookieMeta.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-fg">
                {config?.cookie?.configured ? (
                  <>
                    Tersimpan: <span className="font-mono text-fg">{config?.cookie?.preview}</span>
                  </>
                ) : (
                  <span>Belum ada cookie tersimpan.</span>
                )}
              </div>
              {config?.cookie?.lastTestedAt ? (
                <div className="text-xs text-muted-fg">
                  Tes terakhir: {formatDateTime(config.cookie.lastTestedAt)}
                </div>
              ) : null}
              {config?.cookie?.lastTestMessage ? (
                <div className="rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
                  {config.cookie.lastTestMessage}
                </div>
              ) : null}

              <FormField label="Cookie baru" hint="Paste seluruh string cookie dari DevTools. Akan dienkripsi sebelum disimpan.">
                <Textarea
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="session=...; XSRF-TOKEN=...; ..."
                  rows={4}
                  className="font-mono text-xs"
                />
              </FormField>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={CheckCircle2}
                  onClick={handleTestCookie}
                  loading={testing}
                  disabled={!config?.cookie?.configured && !cookieInput.trim()}
                >
                  Tes cookie
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  leadingIcon={Trash2}
                  onClick={handleClearCookie}
                  disabled={!config?.cookie?.configured}
                >
                  Hapus cookie
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Verifikasi Otomatis"
              description="Retry otomatis kalau akun belum terdaftar di Valetax saat user submit"
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Interval retry (menit)" hint="1 - 1440 menit">
                <Input
                  type="number"
                  min="1"
                  max="1440"
                  value={retryInterval}
                  onChange={(e) => setRetryInterval(e.target.value)}
                />
              </FormField>
              <FormField label="Maksimum percobaan">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                />
              </FormField>
              <FormField label="Minimum deposit (USD)">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(e.target.value)}
                />
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pengecekan Volume"
              description="Auto-revoke role kalau user tidak trading"
            />
            <CardBody className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-fg">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border"
                  checked={volumeCheck}
                  onChange={(e) => setVolumeCheck(e.target.checked)}
                />
                <div>
                  <div className="font-medium">Aktifkan pengecekan volume harian</div>
                  <div className="text-xs text-muted-fg">
                    Cron jam 04:00 WIB akan mengambil volume harian setiap akun terverifikasi.
                  </div>
                </div>
              </label>
              <FormField label="Grace days (hari tanpa volume sebelum role dicabut)" hint="1 - 90 hari">
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                />
              </FormField>
              <FormField label="Minimum lots/hari" hint="0 = volume sekecil apapun dihitung aktif">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minDailyVolume}
                  onChange={(e) => setMinDailyVolume(e.target.value)}
                />
              </FormField>
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader
              title="Custom Embed Pendaftaran"
              description="Bisa di-override; kosongkan untuk pakai default."
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Judul embed">
                <Input
                  value={embedTitle}
                  onChange={(e) => setEmbedTitle(e.target.value)}
                  placeholder="🤝 Daftar IB QTrades"
                />
              </FormField>
              <FormField label="Label tombol">
                <Input
                  value={embedButtonLabel}
                  onChange={(e) => setEmbedButtonLabel(e.target.value)}
                  placeholder="Saya Sudah Daftar IB"
                />
              </FormField>
              <FormField className="md:col-span-2" label="Deskripsi" hint="Pakai \\n untuk pindah baris.">
                <Textarea
                  value={embedDescription}
                  onChange={(e) => setEmbedDescription(e.target.value)}
                  rows={6}
                  placeholder="Daftar IB QTrades di Valetax untuk akses signal eksklusif..."
                />
              </FormField>
            </CardBody>
          </Card>

          <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-2">
            <Button leadingIcon={Save} onClick={handleSave} loading={saving}>
              Simpan pengaturan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
