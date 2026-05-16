import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  Clock,
  Sparkles,
  Receipt,
  CheckCircle2,
  XCircle,
  HourglassIcon,
  Ban,
  AlertCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { api, formatIDR, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
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
import { SkeletonCard, Skeleton } from '../components/ui/Skeleton.jsx';
import { KPIBlock, StatusPill } from '../components/ui/brutalist/index.js';
import {
  useChartTheme,
  tooltipContentStyle,
  tooltipLabelStyle,
  tooltipItemStyle
} from '../components/charts/theme.js';
import { Select, FormField } from '../components/ui/Input.jsx';
import { useRealtimeEvent } from '../lib/realtime.jsx';

const RANGE_OPTIONS = [
  { value: 7, label: '7 hari terakhir' },
  { value: 30, label: '30 hari terakhir' },
  { value: 90, label: '90 hari terakhir' }
];

function StatCard({ icon: Icon, label, value, hint, tone = 'muted' }) {
  // Map old tone names to KPIBlock tones; fallback to muted.
  const KPI_TONES = ['primary', 'muted', 'success', 'warning', 'danger'];
  const kpiTone = KPI_TONES.includes(tone) ? tone : 'muted';
  return (
    <div className="relative">
      <KPIBlock label={label} value={value} delta={hint} tone={kpiTone} size="md" />
      {Icon && kpiTone === 'muted' ? (
        <Icon className="absolute right-3 top-3 h-4 w-4 text-muted-fg" aria-hidden="true" />
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [series, setSeries] = useState(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [days, setDays] = useState(30);

  function load() {
    setLoading(true);
    api
      .get('/api/stats')
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }

  function loadSeries(d) {
    setSeriesLoading(true);
    api
      .get(`/api/stats/timeseries?days=${d}`)
      .then((res) => setSeries(res))
      .catch(() => setSeries(null))
      .finally(() => setSeriesLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadSeries(days);
  }, [days]);

  // Refresh both summary and timeseries when a transaction event fires.
  useRealtimeEvent(
    ['transaction.pending_review', 'transaction.approved', 'transaction.rejected'],
    () => {
      load();
      loadSeries(days);
    }
  );

  const totals = data?.totals;
  const revenue = data?.revenue;
  const pendingTotal = totals ? (totals.pending || 0) + (totals.pending_review || 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan aktivitas bot, pendapatan, dan transaksi terbaru."
        accent="primary"
        actions={
          <Button variant="secondary" onClick={load}>
            Muat ulang
          </Button>
        }
      />

      {error ? (
        <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={TrendingUp}
              tone="primary"
              label="Pendapatan (Total)"
              value={formatIDR(revenue?.allTime)}
              hint="Jumlah transaksi yang disetujui"
            />
            <StatCard
              icon={Calendar}
              tone="muted"
              label="Pendapatan (30 Hari)"
              value={formatIDR(revenue?.last30Days)}
              hint="Disetujui dalam 30 hari terakhir"
            />
            <StatCard
              icon={HourglassIcon}
              tone="warning"
              label="Menunggu Review"
              value={pendingTotal}
              hint={`${totals?.pending_review ?? 0} menunggu review admin`}
            />
            <StatCard
              icon={Sparkles}
              tone="success"
              label="Role Sementara Aktif"
              value={totals?.activeTempRoles ?? 0}
              hint={`${totals?.activeProducts ?? 0} produk aktif`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Pendapatan & Persetujuan"
            description="Pendapatan harian dari transaksi yang disetujui"
            action={
              <FormField className="min-w-[160px]">
                <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            }
          />
          <CardBody>
            <RevenueChart series={series} loading={seriesLoading} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Distribusi Status" description="Snapshot status semua transaksi" />
          <CardBody>
            <StatusPie totals={totals} loading={loading} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Aktivitas per Status" description="Transaksi harian dipisah per status" />
          <CardBody>
            <ActivityChart series={series} loading={seriesLoading} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Produk Terlaris" description="Pendapatan tertinggi di periode ini" />
          <CardBody className="p-0">
            <TopProducts series={series} loading={seriesLoading} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon={Receipt} label="Total" value={totals?.transactions ?? 0} />
            <StatCard icon={CheckCircle2} tone="success" label="Disetujui" value={totals?.approved ?? 0} />
            <StatCard icon={XCircle} tone="danger" label="Ditolak" value={totals?.rejected ?? 0} />
            <StatCard icon={Clock} tone="warning" label="Menunggu" value={totals?.pending ?? 0} />
            <StatCard icon={Ban} label="Dibatalkan" value={totals?.cancelled ?? 0} />
            <StatCard icon={AlertCircle} label="Kadaluarsa" value={totals?.expired ?? 0} />
          </>
        )}
      </div>

      <Card>
        <CardHeader
          title="Transaksi Terbaru"
          description="8 transaksi terbaru dari seluruh bot."
          action={
            <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
              Lihat semua
            </Link>
          }
        />
        <DataTable>
          <THead>
            <TR>
              <TH>Order ID</TH>
              <TH>User</TH>
              <TH>Produk</TH>
              <TH>Jumlah</TH>
              <TH>Status</TH>
              <TH>Dibuat</TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={6} rows={5} />
          ) : data?.recentTransactions?.length ? (
            <TBody>
              {data.recentTransactions.map((tx) => (
                <TR key={tx.id}>
                  <TD className="font-mono text-xs">{tx.orderId}</TD>
                  <TD className="font-mono text-xs">{tx.userId}</TD>
                  <TD>{tx.productName || '-'}</TD>
                  <TD>{formatIDR(tx.amount)}</TD>
                  <TD>
                    <StatusPill status={tx.status} />
                  </TD>
                  <TD className="text-muted-fg">{formatDateTime(tx.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          ) : (
            <TableEmpty
              columns={6}
              icon={Receipt}
              title="Belum ada transaksi"
              description="Pembelian baru akan muncul di sini begitu user check out."
            />
          )}
        </DataTable>
      </Card>
    </div>
  );
}

function RevenueChart({ series, loading }) {
  const colors = useChartTheme();
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (!series || !series.dailyRevenue?.length) {
    return <div className="py-10 text-center text-sm text-muted-fg">Belum ada data revenue.</div>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series.dailyRevenue}>
          <defs>
            <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity={0.4} />
              <stop offset="100%" stopColor={colors.primary} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={colors.grid} vertical={false} />
          <XAxis dataKey="date" stroke={colors.text} tick={{ fontSize: 11 }} tickMargin={8} />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v / 1000}k`}
            width={50}
          />
          <Tooltip
            contentStyle={tooltipContentStyle(colors)}
            labelStyle={tooltipLabelStyle(colors)}
            itemStyle={tooltipItemStyle(colors)}
            formatter={(value, name) => {
              if (name === 'revenue') return [formatIDR(value), 'Pendapatan'];
              return [value, name];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={colors.primary}
            strokeWidth={2}
            fill="url(#dashRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityChart({ series, loading }) {
  const colors = useChartTheme();
  if (loading) return <Skeleton className="h-72 w-full" />;
  if (!series || !series.dailyActivity?.length) {
    return <div className="py-10 text-center text-sm text-muted-fg">Belum ada aktivitas.</div>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series.dailyActivity}>
          <CartesianGrid strokeDasharray="4 4" stroke={colors.grid} vertical={false} />
          <XAxis dataKey="date" stroke={colors.text} tick={{ fontSize: 11 }} tickMargin={8} />
          <YAxis stroke={colors.text} tick={{ fontSize: 11 }} width={36} />
          <Tooltip
            contentStyle={tooltipContentStyle(colors)}
            labelStyle={tooltipLabelStyle(colors)}
            itemStyle={tooltipItemStyle(colors)}
          />
          <Legend wrapperStyle={{ color: colors.text, fontSize: 11 }} />
          <Bar stackId="a" dataKey="approved" fill={colors.success} name="Disetujui" />
          <Bar stackId="a" dataKey="pending_review" fill={colors.info} name="Review" />
          <Bar stackId="a" dataKey="pending" fill={colors.warning} name="Menunggu" />
          <Bar stackId="a" dataKey="rejected" fill={colors.danger} name="Ditolak" />
          <Bar stackId="a" dataKey="cancelled" fill={colors.neutral} name="Dibatalkan" />
          <Bar stackId="a" dataKey="expired" fill={colors.muted} name="Kadaluarsa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusPie({ totals, loading }) {
  const colors = useChartTheme();
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!totals) return <div className="py-10 text-center text-sm text-muted-fg">Belum ada data</div>;

  const data = [
    { name: 'Disetujui', value: totals.approved || 0, color: colors.success },
    { name: 'Menunggu Review', value: totals.pending_review || 0, color: colors.info },
    { name: 'Menunggu', value: totals.pending || 0, color: colors.warning },
    { name: 'Ditolak', value: totals.rejected || 0, color: colors.danger },
    { name: 'Dibatalkan', value: totals.cancelled || 0, color: colors.neutral },
    { name: 'Kadaluarsa', value: totals.expired || 0, color: colors.muted }
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-fg">Belum ada data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipContentStyle(colors)}
            labelStyle={tooltipLabelStyle(colors)}
            itemStyle={tooltipItemStyle(colors)}
          />
          <Legend wrapperStyle={{ color: colors.text, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopProducts({ series, loading }) {
  if (loading) return <Skeleton className="m-5 h-48" />;
  if (!series || !series.topProducts?.length) {
    return <div className="py-10 text-center text-sm text-muted-fg">Belum ada produk yang disetujui.</div>;
  }
  const max = series.topProducts[0]?.revenue || 1;
  return (
    <ul className="divide-y divide-border">
      {series.topProducts.map((p) => (
        <li key={p.productId} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">{p.productName}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-fg">
              {p.count} disetujui
            </div>
            <div className="mt-1.5 h-1.5 w-full bg-surface-2 border border-border">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.max(4, (p.revenue / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="whitespace-nowrap font-display text-sm font-bold text-fg">
            {formatIDR(p.revenue)}
          </div>
        </li>
      ))}
    </ul>
  );
}
