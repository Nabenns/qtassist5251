import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Server,
  Cpu,
  Database,
  Clock,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { api, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { cn } from '../lib/cn.js';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function pingTone(ping) {
  if (!Number.isFinite(ping) || ping < 0) return 'neutral';
  if (ping < 100) return 'success';
  if (ping < 300) return 'warning';
  return 'danger';
}

export default function BotStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/bot/status');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!auto) return undefined;
    const handle = setInterval(load, 15000);
    return () => clearInterval(handle);
  }, [auto, load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status Bot"
        description="Monitoring uptime, gateway ping, database, dan cron jobs."
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />
              Refresh otomatis (15d)
            </label>
            <Button variant="secondary" leadingIcon={RefreshCw} onClick={load} loading={loading}>
              Muat ulang
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}

      {data ? <StatusContent data={data} /> : null}
    </div>
  );
}

function StatusContent({ data }) {
  const { discord, process: proc, database, counters, cron } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigStat
          icon={Wifi}
          label="Discord Gateway"
          value={discord?.ready ? 'Terhubung' : 'Terputus'}
          tone={discord?.ready ? 'success' : 'danger'}
          hint={
            discord?.ready
              ? `Ping ${discord.ping}ms · ${discord.guildCount} server`
              : 'Bot tidak siap'
          }
        />
        <BigStat
          icon={Database}
          label="Database"
          value={database?.status === 'ok' ? 'Sehat' : 'Error'}
          tone={database?.status === 'ok' ? 'success' : 'danger'}
          hint={`${database?.dialect || '-'} · ${
            Number.isFinite(database?.latencyMs) ? `${database.latencyMs}ms` : '-'
          }`}
        />
        <BigStat
          icon={Clock}
          label="Uptime"
          value={formatUptime(proc.uptimeSeconds)}
          tone="info"
          hint={`Sejak ${formatDateTime(proc.startedAt)}`}
        />
        <BigStat
          icon={Cpu}
          label="Memori (RSS)"
          value={formatBytes(proc.memory?.rss)}
          tone="neutral"
          hint={`Heap ${formatBytes(proc.memory?.heapUsed)} / ${formatBytes(proc.memory?.heapTotal)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Discord" description={discord?.username || 'Bot offline'} />
          <CardBody className="space-y-3">
            <Row k="User" v={discord?.username ? `${discord.username} (${discord.userId})` : '-'} />
            <Row k="Status" v={
              discord?.ready ? (
                <Badge tone="success" dot>Siap</Badge>
              ) : (
                <Badge tone="danger" dot>Tidak siap</Badge>
              )
            } />
            <Row k="Gateway ping" v={
              <Badge tone={pingTone(discord?.ping)}>{discord?.ping ?? '-'} ms</Badge>
            } />
            <Row k="Server" v={discord?.guildCount ?? 0} />
            <Row k="Total member" v={discord?.totalMembers?.toLocaleString('id-ID') ?? 0} />
            {discord?.guilds?.length ? (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-surface-2">
                    <tr className="text-left text-xs uppercase text-muted-fg">
                      <th className="px-3 py-1.5">Server</th>
                      <th className="px-3 py-1.5">Member</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {discord.guilds.map((g) => (
                      <tr key={g.id}>
                        <td className="px-3 py-1.5">
                          <div>{g.name}</div>
                          <div className="font-mono text-[11px] text-muted-fg">{g.id}</div>
                        </td>
                        <td className="px-3 py-1.5 text-fg-muted">{g.memberCount?.toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Proses" description={`PID ${proc.pid} · ${proc.platform}/${proc.arch}`} />
          <CardBody className="space-y-3">
            <Row k="Hostname" v={proc.hostname} />
            <Row k="Node" v={proc.nodeVersion} />
            <Row k="Mulai jalan" v={formatDateTime(proc.startedAt)} />
            <Row k="Uptime" v={formatUptime(proc.uptimeSeconds)} />
            <Row k="Total memori sistem" v={formatBytes(proc.totalMemory)} />
            <Row k="Memori sistem tersisa" v={formatBytes(proc.freeMemory)} />
            <Row
              k="Load average (1m / 5m / 15m)"
              v={proc.loadAvg?.map((n) => n.toFixed(2)).join(' / ') || '-'}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Counter" description="Ringkasan dari database" />
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Admin" value={counters?.adminUsers ?? 0} />
          <Stat label="Total transaksi" value={counters?.totalTransactions ?? 0} />
          <Stat label="Role sementara aktif" value={counters?.activeTempRoles ?? 0} />
          <Stat label="Cron jobs dilacak" value={cron?.length ?? 0} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cron Jobs" description="Status dari setiap scheduled job." />
        <CardBody className="space-y-2">
          {!cron || cron.length === 0 ? (
            <div className="text-sm text-muted-fg">Belum ada cron yang berjalan sejak bot start.</div>
          ) : (
            cron.map((job) => <CronRow key={job.name} job={job} />)
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'bg-surface-3 text-fg-muted',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info'
  }[tone];
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-fg">{label}</div>
            <div className="mt-1 text-xl font-semibold text-fg">{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-fg">{hint}</div> : null}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CronRow({ job }) {
  const ok = job.status === 'ok';
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ok ? 'text-success' : 'text-danger')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs">{job.name}</code>
          <Badge tone={ok ? 'success' : 'danger'} dot>{job.status}</Badge>
          {Number.isFinite(job.durationMs) ? (
            <span className="text-xs text-muted-fg">{job.durationMs}ms</span>
          ) : null}
          <span className="text-xs text-muted-fg">jumlah: {job.count}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-fg">
          terakhir berjalan · {formatDateTime(job.last)}
        </div>
        {job.error ? (
          <div className="mt-1 text-xs text-danger">{job.error}</div>
        ) : null}
        {job.meta ? (
          <pre className="mt-1 max-h-24 overflow-auto rounded-md bg-surface px-2 py-1 text-[11px] text-fg-muted ring-1 ring-border">
            {JSON.stringify(job.meta, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-fg">{k}</span>
      <span className="text-fg break-all text-right">{v}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-fg">{value}</div>
    </div>
  );
}
