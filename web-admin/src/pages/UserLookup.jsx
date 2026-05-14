import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  User as UserIcon,
  RefreshCw,
  Receipt,
  Mail,
  Clock,
  ListChecks
} from 'lucide-react';
import { api, formatIDR, formatDateTime, ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField } from '../components/ui/Input.jsx';
import { Badge, StatusBadge } from '../components/ui/Badge.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD
} from '../components/ui/Table.jsx';
import { Skeleton, SkeletonCard, SkeletonText } from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/Toast.jsx';

export default function UserLookup() {
  const { userId: paramId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState(paramId || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleLoad = useCallback(async (targetId) => {
    const id = String(targetId).trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/users/${encodeURIComponent(id)}`);
      setData(res);
    } catch (err) {
      setData(null);
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('User belum punya data di database.');
        } else if (err.status === 400) {
          setError('Discord User ID tidak valid.');
        } else {
          setError(err.message || 'Gagal memuat data user.');
        }
      } else {
        setError('Gagal memuat data user.');
      }
    } finally {
      setLoading(false);
    }
  }, []);
  // Reload whenever the URL :userId changes (deep-link friendly).
  useEffect(() => {
    if (paramId) {
      setQuery(paramId);
      handleLoad(paramId);
    }
  }, [paramId, handleLoad]);

  function handleSubmit(e) {
    e.preventDefault();
    const id = query.trim();
    if (!id) return;
    if (id !== paramId) {
      navigate(`/users/${id}`, { replace: !paramId });
    } else {
      handleLoad(id);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cari User"
        description="Cari berdasarkan Discord User ID untuk lihat semua aktivitas user di satu tempat."
        actions={
          paramId ? (
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={() => handleLoad(paramId)}
              loading={loading}
            >
              Muat ulang
            </Button>
          ) : null
        }
      />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <FormField label="Discord User ID" className="flex-1 min-w-[260px]">
              <Input
                leadingIcon={Search}
                placeholder="contoh: 1234567890123456789"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FormField>
            <Button type="submit" loading={loading}>
              Cari
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!query.trim()) {
                  toast.warning('Masukkan User ID dulu.');
                  return;
                }
                navigator.clipboard?.writeText(query.trim());
                toast.success('Tersalin ke clipboard');
              }}
            >
              Salin ID
            </Button>
          </form>
        </CardBody>
      </Card>

      {error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={UserIcon}
              title="Tidak ada data"
              description={error}
            />
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-1" />
          <SkeletonCard className="lg:col-span-2" />
        </div>
      ) : null}

      {data ? <UserDetail data={data} /> : null}
    </div>
  );
}

function UserDetail({ data }) {
  const { discord, totals, transactions, tempRoles, emails, moderationLogs } = data;
  const userId = data.userId;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            {discord?.avatarURL ? (
              <img
                src={discord.avatarURL}
                alt=""
                className="h-16 w-16 rounded-full ring-2 ring-border"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-3 text-fg-muted">
                <UserIcon className="h-7 w-7" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold text-fg">
                {discord?.globalName || discord?.username || `User ${userId}`}
              </div>
              <div className="font-mono text-xs text-muted-fg">{userId}</div>
              {discord ? (
                <div className="mt-1 text-xs text-muted-fg">
                  Username: <span className="font-mono">{discord.tag}</span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-warning">
                  Bot tidak bisa fetch identity Discord (mungkin user pernah meninggalkan server).
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total Belanja" value={formatIDR(totals.totalSpent)} />
              <Stat label="Disetujui" value={totals.approved} />
              <Stat label="Menunggu" value={totals.pending} />
              <Stat label="Role Aktif" value={totals.activeTempRoles} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Transaksi</span>} description={`${totals.transactions} total`} />
        <DataTable>
          <THead>
            <TR>
              <TH>Order ID</TH>
              <TH>Produk</TH>
              <TH>Jumlah</TH>
              <TH>Status</TH>
              <TH>Dibuat</TH>
              <TH>Direview</TH>
            </TR>
          </THead>
          {transactions.length === 0 ? (
            <TBody>
              <TR>
                <TD colSpan={6}>
                  <EmptyState
                    icon={Receipt}
                    title="Belum ada transaksi"
                    description="User ini belum pernah membuat transaksi."
                  />
                </TD>
              </TR>
            </TBody>
          ) : (
            <TBody>
              {transactions.map((t) => (
                <TR key={t.id}>
                  <TD className="font-mono text-xs">
                    <Link to="/transactions" className="text-primary hover:underline">
                      {t.orderId}
                    </Link>
                  </TD>
                  <TD>{t.productName || '-'}</TD>
                  <TD>{formatIDR(t.amount)}</TD>
                  <TD>
                    <StatusBadge status={t.status} />
                  </TD>
                  <TD className="text-muted-fg">{formatDateTime(t.createdAt)}</TD>
                  <TD className="text-muted-fg">{t.reviewedAt ? formatDateTime(t.reviewedAt) : '-'}</TD>
                </TR>
              ))}
            </TBody>
          )}
        </DataTable>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Role Sementara</span>} />
          <DataTable>
            <THead>
              <TR>
                <TH>Role</TH>
                <TH>Server</TH>
                <TH>Kadaluarsa</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            {tempRoles.length === 0 ? (
              <TBody>
                <TR>
                  <TD colSpan={4}>
                    <EmptyState
                      icon={Clock}
                      title="Tidak ada role sementara"
                      description="User ini belum pernah dapat role sementara."
                    />
                  </TD>
                </TR>
              </TBody>
            ) : (
              <TBody>
                {tempRoles.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div>{r.roleName || '-'}</div>
                      <div className="font-mono text-[11px] text-muted-fg">{r.roleId}</div>
                    </TD>
                    <TD>
                      <div>{r.guildName || '-'}</div>
                      <div className="font-mono text-[11px] text-muted-fg">{r.serverId}</div>
                    </TD>
                    <TD className="text-muted-fg">{formatDateTime(r.expiresAt)}</TD>
                    <TD>
                      {r.isActive ? (
                        <Badge tone="success" dot>
                          Aktif
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Kadaluarsa</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            )}
          </DataTable>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Daftar Email</span>} />
          <DataTable>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Server ID</TH>
                <TH>Didaftarkan</TH>
              </TR>
            </THead>
            {emails.length === 0 ? (
              <TBody>
                <TR>
                  <TD colSpan={3}>
                    <EmptyState
                      icon={Mail}
                      title="Tidak ada email"
                      description="User ini belum mendaftarkan email."
                    />
                  </TD>
                </TR>
              </TBody>
            ) : (
              <TBody>
                {emails.map((b) => (
                  <TR key={b.id}>
                    <TD>{b.email}</TD>
                    <TD className="font-mono text-xs">{b.serverId}</TD>
                    <TD className="text-muted-fg">{formatDateTime(b.registeredAt)}</TD>
                  </TR>
                ))}
              </TBody>
            )}
          </DataTable>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Riwayat Moderasi Terbaru</span>}
          description={`${moderationLogs.length} entries`}
          action={
            <Link to={`/audit?targetUserId=${userId}`} className="text-sm font-medium text-primary hover:underline">
              Lihat semua di audit log
            </Link>
          }
        />
        <DataTable>
          <THead>
            <TR>
              <TH>Waktu</TH>
              <TH>Tindakan</TH>
              <TH>Moderator</TH>
              <TH>Role</TH>
              <TH>Alasan</TH>
            </TR>
          </THead>
          {moderationLogs.length === 0 ? (
            <TBody>
              <TR>
                <TD colSpan={5}>
                  <EmptyState
                    icon={ListChecks}
                    title="Tidak ada riwayat"
                    description="Belum ada moderation log untuk user ini."
                  />
                </TD>
              </TR>
            </TBody>
          ) : (
            <TBody>
              {moderationLogs.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-muted-fg">{formatDateTime(m.createdAt)}</TD>
                  <TD>{m.actionType}</TD>
                  <TD className="font-mono text-xs">{m.moderatorId || '-'}</TD>
                  <TD className="font-mono text-xs">{m.roleId || '-'}</TD>
                  <TD className="max-w-md truncate">{m.reason || '-'}</TD>
                </TR>
              ))}
            </TBody>
          )}
        </DataTable>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 min-w-[120px]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-fg">{value}</div>
    </div>
  );
}
