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
import { api, formatIDR, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
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
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { cn } from '../lib/cn.js';

function StatCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
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
            <div className="mt-1 text-2xl font-semibold text-fg">{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-fg">{hint}</div> : null}
          </div>
          {Icon ? (
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneClass)}>
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    load();
  }, []);

  const totals = data?.totals;
  const revenue = data?.revenue;
  const pendingTotal = totals ? (totals.pending || 0) + (totals.pending_review || 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview aktivitas bot, pendapatan, dan transaksi terbaru."
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
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
              label="Revenue (All Time)"
              value={formatIDR(revenue?.allTime)}
              hint="Sum of approved transactions"
            />
            <StatCard
              icon={Calendar}
              tone="info"
              label="Revenue (30 Days)"
              value={formatIDR(revenue?.last30Days)}
              hint="Approved in last 30 days"
            />
            <StatCard
              icon={HourglassIcon}
              tone="warning"
              label="Pending Review"
              value={pendingTotal}
              hint={`${totals?.pending_review ?? 0} waiting admin review`}
            />
            <StatCard
              icon={Sparkles}
              tone="success"
              label="Active Temp Roles"
              value={totals?.activeTempRoles ?? 0}
              hint={`${totals?.activeProducts ?? 0} active products`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard icon={Receipt} label="Total" value={totals?.transactions ?? 0} />
            <StatCard icon={CheckCircle2} tone="success" label="Approved" value={totals?.approved ?? 0} />
            <StatCard icon={XCircle} tone="danger" label="Rejected" value={totals?.rejected ?? 0} />
            <StatCard icon={Clock} tone="warning" label="Pending" value={totals?.pending ?? 0} />
            <StatCard icon={Ban} label="Cancelled" value={totals?.cancelled ?? 0} />
            <StatCard icon={AlertCircle} label="Expired" value={totals?.expired ?? 0} />
          </>
        )}
      </div>

      <Card>
        <CardHeader
          title="Recent Transactions"
          description="Latest 8 transactions across the bot."
          action={
            <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          }
        />
        <DataTable>
          <THead>
            <TR>
              <TH>Order ID</TH>
              <TH>User</TH>
              <TH>Product</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Created</TH>
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
                  <TD><StatusBadge status={tx.status} /></TD>
                  <TD className="text-muted-fg">{formatDateTime(tx.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          ) : (
            <TableEmpty
              columns={6}
              icon={Receipt}
              title="No transactions yet"
              description="Pembelian baru akan muncul di sini begitu user check out."
            />
          )}
        </DataTable>
      </Card>
    </div>
  );
}
