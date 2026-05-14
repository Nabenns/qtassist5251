import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Receipt,
  ImageOff
} from 'lucide-react';
import { api, formatIDR, formatDateTime } from '../api.js';
import { ApiError } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
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

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
];

const PAGE_SIZE = 25;

export default function Transactions() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/api/transactions?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
      setError(null);
      setBulkSelected(new Set());
    } catch (err) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canBulk = status === 'pending' || status === 'pending_review';

  function toggleBulk(orderId) {
    setBulkSelected((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleBulkAll() {
    setBulkSelected((current) => {
      const eligible = items
        .filter((tx) => tx.status === 'pending' || tx.status === 'pending_review')
        .map((tx) => tx.orderId);
      const allSelected = eligible.every((id) => current.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(eligible);
    });
  }

  async function handleBulkApprove() {
    if (bulkSelected.size === 0) return;
    if (!confirm(`Approve ${bulkSelected.size} transaksi?`)) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const orderId of bulkSelected) {
      try {
        await api.post(`/api/transactions/${encodeURIComponent(orderId)}/approve`);
        success++;
      } catch (_) {
        failed++;
      }
    }
    setBulkBusy(false);
    if (success > 0) {
      toast.success(`${success} approved`, {
        description: failed > 0 ? `${failed} failed` : undefined
      });
    } else if (failed > 0) {
      toast.error(`${failed} failed`);
    }
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Review, approve, atau reject pembayaran manual."
        actions={
          <Button
            variant="secondary"
            onClick={load}
            loading={loading}
            leadingIcon={RefreshCw}
          >
            Refresh
          </Button>
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

          <FormField label="Search" className="flex-1 min-w-[260px]">
            <Input
              leadingIcon={Search}
              placeholder="order ID atau user ID"
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
            Apply
          </Button>

          {canBulk && bulkSelected.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-fg">
                {bulkSelected.size} dipilih
              </span>
              <Button
                variant="success"
                size="sm"
                onClick={handleBulkApprove}
                loading={bulkBusy}
                leadingIcon={CheckCircle2}
              >
                Bulk approve
              </Button>
            </div>
          ) : null}
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
              {canBulk ? (
                <TH className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    onChange={toggleBulkAll}
                    checked={
                      items.length > 0 &&
                      items
                        .filter((tx) => tx.status === 'pending' || tx.status === 'pending_review')
                        .every((tx) => bulkSelected.has(tx.orderId))
                    }
                    className="rounded border-border"
                  />
                </TH>
              ) : null}
              <TH>Order ID</TH>
              <TH>User</TH>
              <TH>Product</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH>Reviewed</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={canBulk ? 9 : 8} rows={6} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={canBulk ? 9 : 8}
              icon={Receipt}
              title="Tidak ada transaksi"
              description="Tidak ada transaksi yang cocok dengan filter ini."
            />
          ) : (
            <TBody>
              {items.map((tx) => {
                const eligibleForBulk = tx.status === 'pending' || tx.status === 'pending_review';
                return (
                  <TR key={tx.id}>
                    {canBulk ? (
                      <TD>
                        {eligibleForBulk ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${tx.orderId}`}
                            checked={bulkSelected.has(tx.orderId)}
                            onChange={() => toggleBulk(tx.orderId)}
                            className="rounded border-border"
                          />
                        ) : null}
                      </TD>
                    ) : null}
                    <TD className="font-mono text-xs">{tx.orderId}</TD>
                    <TD className="font-mono text-xs">{tx.userId}</TD>
                    <TD>{tx.productName || '-'}</TD>
                    <TD>{formatIDR(tx.amount)}</TD>
                    <TD>
                      <StatusBadge status={tx.status} />
                    </TD>
                    <TD className="text-muted-fg">{formatDateTime(tx.createdAt)}</TD>
                    <TD className="text-muted-fg">{tx.reviewedAt ? formatDateTime(tx.reviewedAt) : '-'}</TD>
                    <TD align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(tx)}
                        leadingIcon={Eye}
                      >
                        Review
                      </Button>
                    </TD>
                  </TR>
                );
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

      <ReviewModal
        tx={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          load();
        }}
      />
    </div>
  );
}

function ReviewModal({ tx, onClose, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setShowReject(false);
    setRejectReason('');
    setImgError(false);
  }, [tx?.id]);

  async function handleApprove() {
    setBusy(true);
    try {
      await api.post(`/api/transactions/${encodeURIComponent(tx.orderId)}/approve`);
      toast.success('Pembayaran disetujui', { description: tx.orderId });
      onChanged();
    } catch (err) {
      toast.error('Gagal menyetujui', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.warning('Alasan wajib diisi');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/transactions/${encodeURIComponent(tx.orderId)}/reject`, {
        reason: rejectReason.trim()
      });
      toast.success('Pembayaran ditolak', { description: tx.orderId });
      onChanged();
    } catch (err) {
      toast.error('Gagal menolak', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  if (!tx) {
    return <Modal open={false} onOpenChange={() => {}}>{null}</Modal>;
  }

  const canAct = tx.status === 'pending' || tx.status === 'pending_review';

  return (
    <Modal open={!!tx} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader
        title="Transaction Review"
        description={tx.orderId}
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="User ID" value={<span className="font-mono text-xs">{tx.userId}</span>} />
          <Field label="Product" value={tx.productName || '-'} />
          <Field label="Amount" value={formatIDR(tx.amount)} />
          <Field label="Status" value={<StatusBadge status={tx.status} />} />
          <Field label="Created" value={formatDateTime(tx.createdAt)} />
          <Field label="Reviewed" value={tx.reviewedAt ? formatDateTime(tx.reviewedAt) : '-'} />
        </div>

        {tx.rejectionReason ? (
          <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
            <div className="font-medium">Rejection reason</div>
            <div className="mt-0.5">{tx.rejectionReason}</div>
          </div>
        ) : null}

        {tx.paymentProofUrl ? (
          imgError ? (
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-muted-fg flex items-center gap-2">
              <ImageOff className="h-4 w-4" />
              <span>Gambar tidak bisa di-load.</span>
              <a
                href={tx.paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Buka original
              </a>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-xs uppercase text-muted-fg">Payment Proof</div>
              <a href={tx.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={tx.paymentProofUrl}
                  alt="payment proof"
                  loading="lazy"
                  onError={() => setImgError(true)}
                  className="max-h-96 w-full rounded-lg border border-border object-contain bg-surface-2"
                />
              </a>
              <div className="mt-1 text-xs">
                <a
                  className="text-primary hover:underline"
                  href={tx.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka original
                </a>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-muted-fg">
            Tidak ada bukti pembayaran terlampir.
          </div>
        )}

        {showReject ? (
          <FormField label="Alasan penolakan">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Bukti tidak valid / nominal tidak sesuai / dll."
              rows={4}
            />
          </FormField>
        ) : null}
      </ModalBody>

      {canAct ? (
        <ModalFooter>
          {showReject ? (
            <>
              <Button variant="secondary" onClick={() => setShowReject(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                loading={busy}
                leadingIcon={XCircle}
              >
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="danger"
                onClick={() => setShowReject(true)}
                disabled={busy}
                leadingIcon={XCircle}
              >
                Reject
              </Button>
              <Button
                variant="success"
                onClick={handleApprove}
                loading={busy}
                leadingIcon={CheckCircle2}
              >
                Approve
              </Button>
            </>
          )}
        </ModalFooter>
      ) : (
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </ModalFooter>
      )}
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
