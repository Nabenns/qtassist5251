import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  api,
  ApiError,
  formatIDR,
  paymentMethodLabel
} from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtimeEvent } from '../lib/realtime.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';

/**
 * Checkout — payment screen for a single Louvin transaction.
 *
 * Combines polling (every 5s) with SSE (`transaction.approved`,
 * `transaction.failed`, `transaction.expired`, `transaction.rejected`)
 * for instant status updates. Renders QR for QRIS/GoPay or VA number
 * for bank-transfer methods.
 */
export default function Checkout() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [trx, setTrx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recheckBusy, setRecheckBusy] = useState(false);

  // Refs to keep async/effect logic stable across re-renders.
  const pollTimerRef = useRef(null);
  const approvedHandledRef = useRef(false);
  const aliveRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.shop.getTransaction(orderId);
      if (!aliveRef.current) return null;
      setTrx(data);
      return data;
    } catch (err) {
      if (!aliveRef.current) return null;
      if (err instanceof ApiError && err.status === 404) {
        toast.error('Transaksi tidak ditemukan');
        navigate('/shop', { replace: true });
        return null;
      }
      toast.error('Gagal memuat transaksi', {
        description: err instanceof ApiError ? err.message : ''
      });
      return null;
    }
  }, [orderId, toast, navigate]);

  // Initial load.
  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    fetchStatus().finally(() => {
      if (aliveRef.current) setLoading(false);
    });
    return () => {
      aliveRef.current = false;
    };
  }, [fetchStatus]);

  // Polling loop. Stops once we reach a final status.
  useEffect(() => {
    if (!trx) return undefined;
    if (FINAL_STATUSES.includes(trx.status)) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }
    if (pollTimerRef.current) return undefined;
    pollTimerRef.current = setInterval(() => {
      fetchStatus();
    }, 5000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [trx, fetchStatus]);

  // Handle approved → toast + navigate.
  useEffect(() => {
    if (!trx || approvedHandledRef.current) return;
    if (trx.status !== 'approved') return;
    approvedHandledRef.current = true;
    toast.success('Pembayaran berhasil!', {
      description: 'Role telah diberikan ke akun Discord kamu.'
    });
    const t = setTimeout(() => {
      navigate(`/my-purchases?highlight=${orderId}`);
    }, 2000);
    return () => clearTimeout(t);
  }, [trx, toast, navigate, orderId]);

  // SSE: refetch immediately when a relevant event for this order arrives.
  useRealtimeEvent(
    ['transaction.approved', 'transaction.failed', 'transaction.expired', 'transaction.rejected'],
    (evt) => {
      if (evt?.orderId === orderId) fetchStatus();
    }
  );

  async function handleRecheck() {
    setRecheckBusy(true);
    try {
      await api.shop.recheckStatus(orderId);
      await fetchStatus();
      toast.info('Status diperbarui');
    } catch (err) {
      toast.error('Gagal cek status', {
        description: err instanceof ApiError ? err.message : ''
      });
    } finally {
      setRecheckBusy(false);
    }
  }

  async function copyText(text, label = 'Disalin') {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch (_) {
      toast.error('Gagal menyalin');
    }
  }

  const backButton = (
    <Button
      variant="secondary"
      leadingIcon={ArrowLeft}
      onClick={() => navigate('/shop')}
    >
      Kembali ke Shop
    </Button>
  );

  if (loading && !trx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Checkout" description="Memuat transaksi..." actions={backButton} />
        <Card>
          <CardBody>
            <div className="font-mono text-sm text-muted-fg">Memuat...</div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!trx) {
    // fetchStatus already toasted + navigated on 404; this is a transient null state.
    return null;
  }

  const method = trx.louvinPaymentType;
  const isPending = trx.status === 'pending';
  const productPrice = Number(trx.amount) || 0;
  const fee = Number(trx.louvinFee) || 0;
  const total = trx.louvinTotalPayment ?? productPrice + fee;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkout"
        description={`Order #${trx.orderId}`}
        accent="warning"
        actions={backButton}
      />

      <DetailPanel trx={trx} username={user?.username} />

      <PaymentBreakdown
        productPrice={productPrice}
        fee={fee}
        total={total}
        method={method}
      />

      {isPending && trx.louvinPaymentNumber ? (
        <PaymentInstructions
          method={method}
          paymentNumber={trx.louvinPaymentNumber}
          total={total}
          onCopy={copyText}
        />
      ) : null}

      <StatusPanel
        trx={trx}
        recheckBusy={recheckBusy}
        onRecheck={handleRecheck}
      />
    </div>
  );
}

const FINAL_STATUSES = ['approved', 'rejected', 'expired', 'cancelled'];

function isQrMethod(method) {
  return ['qris', 'gopay'].includes(method);
}

function isVaMethod(method) {
  return ['bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'].includes(method);
}

function statusMeta(status) {
  switch (status) {
    case 'pending':
      return { tone: 'warning', label: 'Menunggu Pembayaran' };
    case 'approved':
      return { tone: 'success', label: 'Disetujui' };
    case 'rejected':
      return { tone: 'danger', label: 'Ditolak' };
    case 'expired':
      return { tone: 'danger', label: 'Kadaluarsa' };
    case 'cancelled':
      return { tone: 'danger', label: 'Dibatalkan' };
    case 'pending_review':
      return { tone: 'warning', label: 'Menunggu Review' };
    default:
      return { tone: 'neutral', label: status || 'unknown' };
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Sections                                  */
/* -------------------------------------------------------------------------- */

function DetailPanel({ trx, username }) {
  return (
    <Card>
      <CardHeader title="Detail Pesanan" />
      <CardBody className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Order ID" value={<span className="font-mono text-xs">{trx.orderId}</span>} />
          <Row label="Produk" value={trx.productName || '-'} />
          <Row
            label="Discord"
            value={username ? <span className="font-mono text-xs">@{username}</span> : '-'}
          />
          <Row
            label="Metode bayar"
            value={trx.louvinPaymentType ? paymentMethodLabel(trx.louvinPaymentType) : '-'}
          />
        </div>
        <div className="flex items-start gap-2 border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Role akan otomatis diberikan ke akun Discord kamu setelah pembayaran disetujui.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function PaymentBreakdown({ productPrice, fee, total, method }) {
  const feeLabel = method ? `Fee Louvin (${paymentMethodLabel(method)})` : 'Fee Louvin';
  return (
    <Card>
      <CardHeader title="Rincian Pembayaran" />
      <CardBody className="space-y-2">
        <Row
          label="Harga produk"
          value={<span className="font-mono text-xs">{formatIDR(productPrice)}</span>}
        />
        <Row
          label={feeLabel}
          value={<span className="font-mono text-xs">{formatIDR(fee)}</span>}
        />
        <div className="border-t border-border pt-2">
          <Row
            label={<span className="font-bold text-fg">TOTAL</span>}
            value={
              <span className="font-mono text-sm font-bold text-fg">
                {formatIDR(total)}
              </span>
            }
          />
        </div>
      </CardBody>
    </Card>
  );
}

function PaymentInstructions({ method, paymentNumber, total, onCopy }) {
  if (isQrMethod(method)) {
    return (
      <Card>
        <CardHeader
          title="Scan QR untuk Bayar"
          description="Scan QR dengan e-wallet (GoPay, OVO, Dana, ShopeePay, dll)"
        />
        <CardBody className="flex flex-col items-center gap-3">
          <div className="border-2 border-fg bg-white p-4 shadow-step">
            <QRCodeSVG value={paymentNumber} size={256} level="M" />
          </div>
          <div className="text-center">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
              Total Bayar
            </div>
            <div className="font-mono text-base font-bold text-fg">
              {formatIDR(total)}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isVaMethod(method)) {
    return (
      <Card>
        <CardHeader
          title="Transfer ke Virtual Account"
          description="Bayar via mobile banking, ATM, atau internet banking."
        />
        <CardBody className="space-y-3">
          <Row label="Bank" value={paymentMethodLabel(method)} />
          <CopyRow
            label="Nomor VA"
            value={paymentNumber}
            display={<span className="font-mono text-base font-bold text-fg break-all">{paymentNumber}</span>}
            onCopy={() => onCopy(paymentNumber, 'Nomor VA disalin')}
          />
          <CopyRow
            label="Total Bayar"
            value={String(total)}
            display={<span className="font-mono text-base font-bold text-fg">{formatIDR(total)}</span>}
            onCopy={() => onCopy(String(total), 'Total disalin')}
          />
          <div className="flex items-start gap-2 border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Transfer harus PERSIS sesuai nominal di atas, kalau beda akan ditolak otomatis.</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Fallback (e.g. ShopeePay deeplink) — show raw value with copy button.
  return (
    <Card>
      <CardHeader title="Instruksi Pembayaran" />
      <CardBody className="space-y-3">
        <Row label="Metode" value={paymentMethodLabel(method) || method} />
        <CopyRow
          label="Kode bayar"
          value={paymentNumber}
          display={<span className="font-mono text-xs break-all text-fg">{paymentNumber}</span>}
          onCopy={() => onCopy(paymentNumber, 'Disalin')}
        />
      </CardBody>
    </Card>
  );
}

function StatusPanel({ trx, recheckBusy, onRecheck }) {
  const meta = statusMeta(trx.status);
  const isPending = trx.status === 'pending';
  return (
    <Card>
      <CardHeader title="Status Pembayaran" />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {isPending && trx.louvinExpiredAt ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-fg">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Expire dalam</span>
              <Countdown expiresAt={trx.louvinExpiredAt} />
            </div>
          ) : null}
        </div>

        {trx.status === 'rejected' && trx.rejectionReason ? (
          <div className="border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            Alasan: {trx.rejectionReason}
          </div>
        ) : null}

        {isPending ? (
          <div>
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              loading={recheckBusy}
              onClick={onRecheck}
            >
              Cek Status Manual
            </Button>
            <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-fg">
              Status diperbarui otomatis setiap 5 detik.
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function Countdown({ expiresAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return <span className="font-mono font-bold text-danger">EXPIRED</span>;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono font-bold text-fg">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
        {label}
      </div>
      <div className="text-right min-w-0 break-words">{value}</div>
    </div>
  );
}

function CopyRow({ label, value, display, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-border bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
          {label}
        </div>
        <div className="mt-0.5">{display ?? <span className="font-mono text-sm">{value}</span>}</div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={Copy}
        onClick={onCopy}
      >
        Salin
      </Button>
    </div>
  );
}
