import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ListChecks, Search } from 'lucide-react';
import { api, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, FormField } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
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

const ACTION_TONES = {
  temprole_add: 'success',
  temprole_remove: 'danger',
  temprole_extend: 'info',
  temprole_expired: 'neutral',
  payment_approved: 'success',
  payment_rejected: 'danger'
};

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [actionTypes, setActionTypes] = useState([]);
  const [actionType, setActionType] = useState('all');
  const [moderatorId, setModeratorId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/audit/action-types')
      .then((res) => {
        if (!cancelled) setActionTypes(res.items || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (actionType && actionType !== 'all') params.set('actionType', actionType);
      if (moderatorId.trim()) params.set('moderatorId', moderatorId.trim());
      if (targetUserId.trim()) params.set('targetUserId', targetUserId.trim());
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/api/audit?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [actionType, moderatorId, targetUserId, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Riwayat tindakan moderation di Discord dan dashboard."
        actions={
          <Button variant="secondary" leadingIcon={RefreshCw} loading={loading} onClick={load}>
            Refresh
          </Button>
        }
      />

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FormField label="Action Type">
            <Select
              value={actionType}
              onChange={(e) => {
                setPage(0);
                setActionType(e.target.value);
              }}
            >
              <option value="all">All actions</option>
              {actionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Moderator ID">
            <Input
              placeholder="Discord ID"
              value={moderatorId}
              onChange={(e) => setModeratorId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(0), load())}
            />
          </FormField>
          <FormField label="Target User ID">
            <Input
              placeholder="Discord ID"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(0), load())}
            />
          </FormField>
          <FormField label="Search">
            <Input
              leadingIcon={Search}
              placeholder="reason, user/role ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(0), load())}
            />
          </FormField>
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
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Moderator</TH>
              <TH>Target</TH>
              <TH>Role</TH>
              <TH>Reason</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={7} rows={6} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={7}
              icon={ListChecks}
              title="Belum ada audit entry"
              description="Tidak ada entry yang cocok dengan filter."
            />
          ) : (
            <TBody>
              {items.flatMap((row) => {
                const isOpen = expandedId === row.id;
                const tone = ACTION_TONES[row.actionType] || 'neutral';
                const rows = [
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-muted-fg">{formatDateTime(row.createdAt)}</TD>
                    <TD>
                      <Badge tone={tone}>{row.actionType}</Badge>
                    </TD>
                    <TD className="font-mono text-xs">{row.moderatorId || '-'}</TD>
                    <TD className="font-mono text-xs">{row.targetUserId || '-'}</TD>
                    <TD className="font-mono text-xs">{row.roleId || '-'}</TD>
                    <TD className="max-w-md truncate">{row.reason || '-'}</TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                      >
                        {isOpen ? 'Hide' : 'Details'}
                      </Button>
                    </TD>
                  </TR>
                ];
                if (isOpen) {
                  rows.push(
                    <TR key={`${row.id}-detail`} className="bg-surface-2/50">
                      <TD colSpan={7} className="text-xs">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <KeyValue k="Expiry time" v={row.expiryTime ? formatDateTime(row.expiryTime) : '-'} />
                          <KeyValue k="Template ID" v={row.templateId ?? '-'} />
                          {row.additionalData ? (
                            <div className="md:col-span-2">
                              <div className="mb-1 text-muted-fg uppercase">additionalData</div>
                              <pre className="overflow-x-auto rounded-md bg-surface px-3 py-2 text-[11px] text-fg-muted ring-1 ring-border">
                                {JSON.stringify(row.additionalData, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                }
                return rows;
              })}
            </TBody>
          )}
        </DataTable>
        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-5 py-2.5 text-sm text-muted-fg">
          <div>
            {total} total · page {page + 1} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KeyValue({ k, v }) {
  return (
    <div>
      <div className="text-muted-fg uppercase">{k}</div>
      <div className="mt-0.5 break-all">{v}</div>
    </div>
  );
}
