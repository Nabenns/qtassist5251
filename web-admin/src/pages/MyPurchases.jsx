import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { History, ShoppingCart } from 'lucide-react';
import {
  api,
  formatIDR,
  formatDateTime,
  ApiError,
  paymentMethodLabel
} from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const STATUS_TONES = {
  pending: 'warning',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral'
};

const STATUS_LABELS = {
  pending: 'Menunggu',
  pending_review: 'Menunggu Review',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  expired: 'Kadaluarsa',
  cancelled: 'Dibatalkan'
};

export default function MyPurchases() {
  const { toast } = useToast();
  const [search] = useSearchParams();
  const highlight = search.get('highlight');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.shop
      .myTransactions({ limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error('Gagal memuat riwayat', {
          description: err instanceof ApiError ? err.message : ''
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Pembelian"
        description="Semua transaksi kamu, termasuk dari Discord shop dan web shop."
        actions={
          <Link to="/shop">
            <Button leadingIcon={ShoppingCart}>Beli Lagi</Button>
          </Link>
        }
      />

      {loading ? (
        <Card className="p-6">
          <p className="text-muted-fg">Memuat...</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-fg">Belum ada transaksi.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const isHighlighted = highlight === t.orderId;
            return (
              <Card
                key={t.orderId}
                className={
                  isHighlighted
                    ? 'p-4 border-success bg-success-soft'
                    : 'p-4'
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs uppercase text-muted-fg tracking-wider">
                      Order #{t.orderId}
                    </div>
                    <div className="mt-1 text-base font-bold text-fg">
                      {t.productName || '-'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <Badge tone="neutral">
                        {t.paymentChannel === 'louvin'
                          ? `WEB · ${paymentMethodLabel(t.louvinPaymentType)}`
                          : 'DISCORD · TRANSFER MANUAL'}
                      </Badge>
                      <span className="text-xs text-muted-fg">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </div>
                    {t.rejectionReason && (
                      <div className="mt-2 text-xs text-danger">
                        Alasan: {t.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={STATUS_TONES[t.status] || 'neutral'}>
                      {STATUS_LABELS[t.status] || t.status}
                    </Badge>
                    <div className="mt-1 font-mono text-sm text-fg">
                      {formatIDR(t.louvinTotalPayment || t.amount)}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
