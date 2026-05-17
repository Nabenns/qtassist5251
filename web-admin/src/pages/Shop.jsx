import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Clock,
  AlertTriangle,
  ExternalLink,
  CreditCard,
  Tag
} from 'lucide-react';
import {
  api,
  ApiError,
  formatIDR,
  formatDateTime,
  paymentMethodLabel
} from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import PaymentMethodPicker from '../components/PaymentMethodPicker.jsx';

/**
 * Shop — user-facing product catalog page.
 *
 * Sections:
 *   1. Resume banner (if there's an unexpired pending Louvin transaction)
 *   2. Discord-not-joined warning (if user hasn't joined the guild)
 *   3. Product grid (active products from /api/shop/products)
 *
 * Click "Beli" opens a PaymentMethodPicker modal. Submit triggers
 * `api.shop.checkout(productId, method)` and navigates to /shop/checkout/:orderId.
 */
export default function Shop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.shop.listProducts(),
      api.shop.pendingTransaction()
    ])
      .then(([list, pend]) => {
        if (cancelled) return;
        setProducts(Array.isArray(list?.items) ? list.items : []);
        setPending(pend?.pending || null);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat shop.');
        toast.error('Gagal memuat shop', {
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

  async function handleCheckout(method) {
    if (!picker) return;
    setCheckingOut(true);
    try {
      const res = await api.shop.checkout(picker.id, method);
      setPicker(null);
      if (res?.orderId) {
        navigate(`/shop/checkout/${res.orderId}`);
      } else {
        toast.error('Checkout gagal', {
          description: 'Server tidak mengembalikan orderId.'
        });
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'not_in_guild') {
        toast.error('Kamu belum di Discord QTrades', {
          description: "Klik 'Join Discord' untuk gabung dulu sebelum beli."
        });
      } else if (code === 'louvin_disabled') {
        toast.error('Pembayaran online belum aktif', {
          description: 'Hubungi admin untuk informasi.'
        });
      } else {
        toast.error('Gagal checkout', {
          description: err instanceof ApiError ? err.message : 'Coba lagi.'
        });
      }
    } finally {
      setCheckingOut(false);
    }
  }

  const discordInviteUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISCORD_INVITE_URL) ||
    'https://discord.gg/qtrades';

  // user.inGuild may be undefined on backends that don't expose it — only
  // show the warning when the field is explicitly false.
  const showJoinDiscord = user && user.inGuild === false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop"
        description="Beli temporary role secara online dengan pembayaran otomatis."
        accent="warning"
      />

      {error ? (
        <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
          {error}
        </div>
      ) : null}

      {pending ? <ResumeBanner pending={pending} onResume={(id) => navigate(`/shop/checkout/${id}`)} /> : null}

      {showJoinDiscord ? (
        <JoinDiscordBanner inviteUrl={discordInviteUrl} />
      ) : null}

      <ProductGrid
        loading={loading}
        products={products}
        onBuy={(product) => setPicker(product)}
        disabled={showJoinDiscord}
      />

      {picker ? (
        <PaymentMethodPicker
          product={picker}
          onClose={() => (checkingOut ? null : setPicker(null))}
          onCheckout={handleCheckout}
        />
      ) : null}
    </div>
  );
}

function ResumeBanner({ pending, onResume }) {
  const expiry = useMemo(() => {
    if (!pending?.louvinExpiredAt) return null;
    return new Date(pending.louvinExpiredAt);
  }, [pending]);

  const total = pending?.louvinTotalPayment ?? pending?.amount;
  const methodLabel = pending?.louvinPaymentType
    ? paymentMethodLabel(pending.louvinPaymentType)
    : null;

  return (
    <Card className="border-warning/50 bg-warning-soft">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <div>
            <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
              Lanjutkan Pembayaran
            </div>
            <div className="text-xs text-muted-fg">
              Kamu punya pesanan yang belum dibayar. Selesaikan sebelum kadaluarsa.
            </div>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid gap-2 border border-border bg-surface p-3 text-sm sm:grid-cols-2">
          <Row label="Order ID" value={<span className="font-mono text-xs">{pending.orderId}</span>} />
          <Row label="Produk" value={pending.productName || '-'} />
          <Row
            label="Total bayar"
            value={
              <span className="font-mono text-xs font-bold text-fg">
                {formatIDR(total)}
              </span>
            }
          />
          <Row label="Metode" value={methodLabel || '-'} />
          <Row
            label="Kadaluarsa"
            value={expiry ? formatDateTime(expiry) : '-'}
          />
        </div>
        <div>
          <Button
            leadingIcon={CreditCard}
            onClick={() => onResume(pending.orderId)}
          >
            Lanjutkan Bayar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function JoinDiscordBanner({ inviteUrl }) {
  return (
    <Card className="border-danger/40 bg-danger-soft">
      <CardBody>
        <div className="flex flex-wrap items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
          <div className="flex-1 min-w-[16rem]">
            <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
              Belum Gabung Discord QTrades
            </div>
            <div className="mt-1 text-sm text-muted-fg">
              Pembelian role butuh kamu jadi member Discord QTrades. Gabung dulu
              sebelum checkout.
            </div>
          </div>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-danger bg-danger px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-danger-fg hover:bg-danger/85"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Join Discord
          </a>
        </div>
      </CardBody>
    </Card>
  );
}

function ProductGrid({ loading, products, onBuy, disabled }) {
  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="font-mono text-sm text-muted-fg">Memuat produk...</div>
        </CardBody>
      </Card>
    );
  }
  if (!products.length) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <Tag className="h-5 w-5 shrink-0 text-muted-fg mt-0.5" />
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
                Belum Ada Produk
              </div>
              <div className="mt-1 text-sm text-muted-fg">
                Admin belum menyiapkan role yang bisa dibeli. Coba lagi nanti.
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onBuy={onBuy}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function ProductCard({ product, onBuy, disabled }) {
  const methods = Array.isArray(product.paymentMethods) ? product.paymentMethods : [];
  const methodCount = methods.length;
  return (
    <Card shadow="step" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="space-y-1 min-w-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
              #{product.id}
            </div>
            <h2 className="font-display text-base font-black uppercase tracking-tight text-fg leading-tight break-words">
              {product.name}
            </h2>
          </div>
          <Badge tone="primary">
            {formatIDR(product.price)}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="flex-1 space-y-3">
        {product.description ? (
          <p className="text-sm text-muted-fg whitespace-pre-line break-words">
            {product.description}
          </p>
        ) : (
          <p className="text-sm italic text-muted-fg">Tidak ada deskripsi.</p>
        )}
        <div className="border border-border bg-surface-2 p-3 space-y-1.5 text-sm">
          <Row label="Durasi" value={<span className="font-mono text-xs">{formatDuration(product.duration)}</span>} />
          <Row
            label="Metode bayar"
            value={
              <Badge tone={methodCount ? 'info' : 'neutral'}>
                {methodCount ? `${methodCount} metode` : 'Tidak tersedia'}
              </Badge>
            }
          />
        </div>
      </CardBody>
      <div className="border-t border-border bg-surface-2 px-4 py-3">
        <Button
          leadingIcon={ShoppingCart}
          onClick={() => onBuy(product)}
          disabled={disabled || !methodCount}
          className="w-full"
        >
          Beli
        </Button>
      </div>
    </Card>
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

/**
 * Format a duration in milliseconds to a short human label.
 * Example: 2592000000 -> "30 hari", 3600000 -> "1 jam".
 */
function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const days = Math.floor(n / 86400000);
  const hours = Math.floor((n % 86400000) / 3600000);
  const minutes = Math.floor((n % 3600000) / 60000);
  if (days && hours) return `${days} hari ${hours} jam`;
  if (days) return `${days} hari`;
  if (hours) return `${hours} jam`;
  if (minutes) return `${minutes} menit`;
  return `${Math.floor(n / 1000)} detik`;
}
