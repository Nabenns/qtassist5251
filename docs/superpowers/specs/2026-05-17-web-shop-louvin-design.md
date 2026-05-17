# Web Shop with Louvin Payment Gateway — Design Spec

**Date:** 2026-05-17
**Author:** Brainstorming session
**Status:** Approved design, ready for implementation plan

## Goal

Tambah jalur pembelian online di web admin dashboard yang memungkinkan
user non-admin (yang login via Discord OAuth) beli temporary role secara
mandiri, dengan pembayaran otomatis via [Louvin Payment Gateway](https://louvin.dev/docs.html).
Role di-grant otomatis setelah pembayaran ter-verifikasi via webhook,
tanpa intervensi admin.

Existing manual bank transfer di Discord shop tetap jalan paralel
(coexist) — tidak di-deprecate dalam scope ini.

## Non-Goals

- Subscription / recurring payment (Louvin support, tapi out of scope MVP)
- "Beli untuk teman" (input Discord ID lain) — semua pembelian auto-grant ke session user
- Refund flow — Louvin tidak menyediakan refund API, refund manual via admin
- Migrasi atau deprecate Discord manual bank transfer
- Web admin posting QRIS image manual ke Discord (Louvin auto handle reminder via email untuk subscription, tapi tidak relevan untuk one-off)
- Encryption-at-rest untuk QR string / VA number di DB (low risk: short-lived dan public-by-design)

## Architecture Overview

### High-level flow

```
User di /shop (web)
   │  click "Beli"
   ▼
POST /api/shop/checkout { productId, paymentMethod }
   │  - verify guildMember (fresh)
   │  - create transactions row (status=pending, paymentChannel=louvin)
   │  - call Louvin POST /create-transaction
   │  - update row dengan louvin_transaction_id, qr_string/va_number, expired_at
   ▼
Frontend redirect ke /shop/checkout/:orderId
   │  - render QR / VA number
   │  - polling GET /api/shop/transactions/:orderId tiap 5 detik
   │  - listen SSE /api/events untuk transaction.approved
   │
   │  [user bayar via QRIS / VA]
   ▼
Louvin webhook fires:
POST /api/webhooks/louvin/<token>
   │  - verify path token
   │  - GET Louvin /check-status (verify-server-to-server)
   │  - find transaction by louvin_transaction_id
   │  - idempotency: skip kalau sudah final state
   │  - dispatch:
   │     settled → transactionService.approveTransaction()
   │                 ↳ grant role + create TemporaryRole + DM + sheets sync + emit SSE
   │     failed  → status='expired' + emit SSE
   ▼
Frontend SSE/polling detect status change → redirect ke /my-purchases
```

### Component Diagram

```
                 ┌─────────────────────────┐
                 │   web-admin (React)     │
                 │  ┌──────────────────┐   │
                 │  │ Shop.jsx         │   │
                 │  │ Checkout.jsx     │   │
                 │  │ MyPurchases.jsx  │   │
                 │  │ Products.jsx +pm │   │
                 │  └──────────────────┘   │
                 └────────────┬────────────┘
                              │  /api/shop/*, /api/events
                              ▼
        ┌────────────────────────────────────────┐
        │   src/web/routes                       │
        │  ┌──────────┐  ┌────────────┐          │
        │  │ shop.js  │  │webhooks.js │          │
        │  └────┬─────┘  └─────┬──────┘          │
        └───────┼──────────────┼─────────────────┘
                ▼              ▼
        ┌──────────────┐  ┌──────────────────────┐
        │ louvin       │  │ transactionService   │
        │ Service.js   │  │ (existing,reusable)  │
        └──────┬───────┘  └──────────┬───────────┘
               │                     │
               ▼                     ▼
        ┌──────────────┐      ┌─────────────┐
        │ api.louvin   │      │ Postgres    │
        │ .dev (HTTP)  │      │ transactions│
        └──────────────┘      │ products    │
                              └─────────────┘
```

### Data Flow Decisions

**Reuse `Transaction` table dengan kolom Louvin nullable** (Approach 1
dari brainstorm). Alasan:
- `transactionService.approveTransaction()` reusable as-is, cuma butuh
  `reviewerId='system:louvin'` + `reviewerLabel='louvin:webhook:<id>'`
- Existing admin `/transactions` page langsung jalan tanpa refactor
- Sheets sync, audit log, SSE event semuanya unchanged
- Single source of truth untuk semua transaksi

**Tidak buat tabel terpisah `louvin_transactions`** — over-normalisasi
untuk MVP, butuh JOIN di tiap query, refactor existing code lebih banyak.

**JSONB array untuk `paymentMethods` di products** — Sequelize support
native `DataTypes.JSONB`, GIN index untuk filtering, ga overkill kayak
junction table.

## Database Schema

### Migration 1: `add-payment-methods-to-products.js`

```sql
-- Idempotent
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS payment_methods JSONB
  NOT NULL DEFAULT '["qris"]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_payment_methods
  ON products USING gin (payment_methods);
```

**Model `Product.js` — kolom baru:**
```js
paymentMethods: {
  type: DataTypes.JSONB,
  allowNull: false,
  defaultValue: ['qris'],
  field: 'payment_methods',
  validate: {
    isValidMethods(value) {
      const VALID = ['qris', 'gopay', 'shopeepay', 'bni_va', 'bri_va',
                     'permata_va', 'cimb_niaga_va'];
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('paymentMethods must be non-empty array');
      }
      for (const m of value) {
        if (!VALID.includes(m)) throw new Error(`Invalid method: ${m}`);
      }
    }
  }
}
```

### Migration 2: `add-louvin-columns-to-transactions.js`

```sql
-- Idempotent
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(32)
  NOT NULL DEFAULT 'manual_bank';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_transaction_id VARCHAR(64);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_payment_type VARCHAR(32);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_fee INTEGER;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_total_payment INTEGER;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_payment_number TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS louvin_expired_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_louvin_id
  ON transactions(louvin_transaction_id)
  WHERE louvin_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_channel
  ON transactions(payment_channel);
```

**Model `Transaction.js` — kolom baru:**
- `paymentChannel` STRING(32), defaultValue `'manual_bank'`, NOT NULL.
  Validate: `['manual_bank', 'louvin']`. (Bukan ENUM Sequelize karena
  ENUM di Postgres bikin TYPE terpisah yang ribet untuk migration
  idempotent. Validate runtime sudah cukup.)
- `louvinTransactionId` STRING(64), unique nullable
- `louvinPaymentType` STRING(32) nullable
- `louvinFee` INTEGER nullable
- `louvinTotalPayment` INTEGER nullable
- `louvinPaymentNumber` TEXT nullable (qr_string / va_number)
- `louvinExpiredAt` DATE nullable

**Status enum tetap tidak berubah:**
- Louvin `pending` → `pending`
- Louvin `settled` → `approved` (via `transactionService.approveTransaction`)
- Louvin `failed` / expired → `expired`

### Sample Louvin row

```
order_id:                qta-1747481305042-abc123
user_id:                 123456789012345678
product_id:              5
amount:                  50000           ← harga produk (net merchant)
status:                  pending → approved
payment_channel:         louvin
louvin_transaction_id:   550e8400-e29b-41d4-a716-446655440000
louvin_payment_type:     qris
louvin_fee:              750
louvin_total_payment:    50750           ← yang user bayar
louvin_payment_number:   00020101021226...   (qr_string)
louvin_expired_at:       2026-05-17 11:36:43+00
```

`amount` tetap merchant net (konsisten dengan manual bank flow). FE
display `louvin_total_payment` sebagai "yang harus dibayar".

### Backward compatibility

- Existing manual bank transactions: `paymentChannel='manual_bank'`,
  semua kolom Louvin = NULL
- Existing products: `paymentMethods=['qris']` default — tidak akan
  dipakai sampai Louvin enabled (`LOUVIN_ENABLED=true`)
- Sheets sync tetap jalan; tinggal nanti tambah kolom `Channel` di header
  sheet (opsional follow-up, tidak in scope MVP)

## Backend Components

### `src/services/louvinService.js` (NEW)

Slim wrapper untuk Louvin API. Single responsibility: HTTP call + parse.
Tidak ngerti business logic.

**Public functions:**
```js
async function createLouvinTransaction({
  amount, paymentType, customerName, customerEmail, description, reference
}) → { transaction, payment }

async function checkLouvinStatus(transactionId) → { transaction }

class LouvinError extends Error {
  code: 'config_missing' | 'gateway_error' | 'network_error' | 'invalid_response'
  details: any  // payload dari Louvin
}
```

**Behavior:**
- `LOUVIN_API_KEY` di-baca dari env saat call (bukan saat module load) —
  safe untuk hot reload
- Default timeout 10 detik (`AbortController`)
- Lempar `LouvinError` dengan code untuk caller decide
- No retry built-in — caller decide retry policy

### `src/web/routes/shop.js` (NEW)

Mounted di `/api/shop`. Auth: `requireAuth` (any logged-in user).

| Method | Path | Description |
|---|---|---|
| GET | `/api/shop/products` | List produk `isActive=true` (in-memory cache 5 menit per server). Returns hanya field yang relevan untuk display |
| GET | `/api/shop/products/:id` | Detail produk (untuk checkout page) |
| POST | `/api/shop/checkout` | Body: `{ productId, paymentMethod }`. Verify guild membership fresh, validate paymentMethod ∈ product.paymentMethods, create transaction + Louvin call |
| GET | `/api/shop/transactions/:orderId` | Status + payment instructions. Hanya owner. Polling-friendly (cache-control: no-store) |
| POST | `/api/shop/transactions/:orderId/recheck` | Force refresh status dari Louvin |
| GET | `/api/shop/my-transactions` | List transaksi user (semua status, paginated 20 per page) |
| GET | `/api/shop/pending` | Latest transaksi user dengan `status=pending AND louvin_expired_at > now`. Untuk resume banner di /shop |

**Validasi `POST /api/shop/checkout`:**
1. `LOUVIN_ENABLED=true` di env. Kalau ga, return `503 louvin_disabled`
2. Product exists, isActive
3. `paymentMethod` ∈ `product.paymentMethods`
4. User masih di guild — fresh fetch via `client.guilds.fetch(serverId)`
   + `guild.members.fetch(userId)`. Kalau ga: `403 not_in_guild` dengan
   field `inviteUrl: process.env.DISCORD_INVITE_URL`
5. User sudah punya `pending` transaction untuk product+method ini?
   Kalau ya **dan `louvin_expired_at > now`**, return existing instead
   of create baru (cegah duplicate Louvin transactions). Kalau pending
   tapi sudah lewat `louvin_expired_at`, anggap stale → create baru
   (cron expire akan cleanup row stale di background).

**Order ID format:** `qta-<unix-ms>-<random6>`. Sent ke Louvin sebagai
`reference` untuk traceability.

### `src/web/routes/webhooks.js` (NEW)

Mounted di `/api/webhooks`. **Tidak pakai `requireAuth`** — Louvin
server-to-server.

| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/louvin/:token` | Handle Louvin webhook event |

**Handler logic:**
```js
1. Verify path token vs LOUVIN_WEBHOOK_TOKEN (constant-time compare)
   → mismatch: 404 (obscure existence)
2. Parse req.body { event, data }, validate shape
3. Verify ke Louvin: GET /check-status?id=data.transaction_id
   → kalau gagal: 502 (Louvin akan retry)
4. Find transaction WHERE louvin_transaction_id = data.transaction_id
   → tidak ada: 404
5. Idempotency: status sudah ['approved','rejected','expired','cancelled'] → 200 no-op
6. Dispatch:
   - verified.status === 'settled' → transactionService.approveTransaction({
        client, orderId, reviewerId: 'system:louvin',
        reviewerLabel: `louvin:webhook:${transactionId}`
     })
   - verified.status === 'failed' → trx.update({ status: 'expired' })
        + emitEvent('transaction.failed', {...})
7. Always return 200 { received: true }
```

**Defense in depth:**
- Path token cegah random spoof (someone POST acak ke webhook URL)
- `check-status` verify cegah replay attack dengan event payload spoofed
- Idempotency cegah double-grant kalau Louvin retry webhook
- Louvin docs bilang "selalu return HTTP 200" — apapun yang terjadi
  internally, return 200 kecuali error parsing/validasi

### Cron job di `cronService.js` — NEW

```js
// Tiap 5 menit
cron.schedule('*/5 * * * *', async () => {
  const stale = await Transaction.findAll({
    where: {
      paymentChannel: 'louvin',
      status: 'pending',
      louvinExpiredAt: { [Op.lt]: new Date() }
    }
  });
  for (const trx of stale) {
    await trx.update({ status: 'expired' });
    emitEvent('transaction.expired', {
      orderId: trx.orderId,
      userId: trx.userId,
      reason: 'louvin_expired'
    });
  }
});
```

Catatan: cron ini **tidak** call Louvin `/check-status` — cuma cleanup
data stale. Yang call Louvin: webhook handler + manual recheck endpoint.

### Mount di `src/web/server.js`

```js
const buildShopRouter = require('./routes/shop');
const buildWebhooksRouter = require('./routes/webhooks');

app.use('/api/shop', buildShopRouter({ getDiscordClient }));
app.use('/api/webhooks', buildWebhooksRouter({ getDiscordClient }));
```

Webhooks router **harus mount sebelum** SPA fallback supaya `POST` ke
`/api/webhooks/...` ga ke-rewrite ke `index.html`.

### Update `src/web/routes/products.js` (admin)

Tambah field `paymentMethods` di:
- `POST /api/products` — accept array, validate, default `['qris']`
- `PATCH /api/products/:id` — accept array update, validate

### Update audit log (`ModerationLog.additionalData`)

Saat `transactionService.approveTransaction` dipanggil dari webhook:
```js
additionalData: {
  orderId,
  amount,
  productId,
  productName,
  reviewerLabel,            // 'louvin:webhook:<id>'
  paymentChannel: 'louvin', // NEW
  louvinTransactionId,      // NEW
  louvinPaymentType,        // NEW
  louvinFee                 // NEW
}
```

`transactionService` akan baca `transaction.paymentChannel` &
`transaction.louvin*` dan inject ke `additionalData` kalau exist.

## Frontend Components

### Routing update di `web-admin/src/App.jsx`

```jsx
{/* User-accessible routes */}
<Route path="/daftar-ib" element={<UserShell><DaftarIb /></UserShell>} />
<Route path="/my-email"  element={<UserShell><MyEmail /></UserShell>} />
<Route path="/shop"      element={<UserShell><Shop /></UserShell>} />                       {/* NEW */}
<Route path="/shop/checkout/:orderId"
                          element={<UserShell><Checkout /></UserShell>} />                  {/* NEW */}
<Route path="/my-purchases" element={<UserShell><MyPurchases /></UserShell>} />             {/* NEW */}
```

### Sidebar nav update di `Layout.jsx`

`getNavSections({ isAdmin })` — section "Akun Saya" dapat 4 item:
1. 🛒 **Shop** (`/shop`)
2. 📝 **Daftar IB** (`/daftar-ib`)
3. 📦 **Riwayat Pembelian** (`/my-purchases`)
4. 📧 **Email Saya** (`/my-email`)

Default landing untuk non-admin **tetap `/daftar-ib`** (IB onboarding
priority). User klik Shop dari sidebar.

### Page: `Shop.jsx`

```
┌─────────────────────────────────────────────────────┐
│ HEADER: "SHOP" + subtitle "Beli role temporary"     │
├─────────────────────────────────────────────────────┤
│ [BANNER] Resume pending transaction (kalau ada)     │
│  └─ "Kamu punya pesanan belum dibayar:              │
│      Order #qta-xxx — Rp 50.750 — expire 12 menit"  │
│      [Lanjutkan Bayar]                              │
├─────────────────────────────────────────────────────┤
│ [WARNING] Kalau user.inGuild=false:                 │
│  └─ "Kamu belum gabung Discord QTrades.             │
│      [Join Discord]" (link DISCORD_INVITE_URL env)  │
├─────────────────────────────────────────────────────┤
│ PRODUCT GRID                                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │ VIP 30 HARI  │ │ VIP 7 HARI   │ │ ROOKIE 30D   │  │
│ │ Rp 50.000    │ │ Rp 15.000    │ │ Rp 100.000   │  │
│ │ Durasi: 30d  │ │ Durasi: 7d   │ │ Durasi: 30d  │  │
│ │ Methods: 4   │ │ Methods: 2   │ │ Methods: 7   │  │
│ │ [Beli]       │ │ [Beli]       │ │ [Beli]       │  │
│ └──────────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

**State:**
- `useEffect` fetch `/api/shop/products` + `/api/shop/pending` paralel saat mount
- Click "Beli" → buka modal `PaymentMethodPicker`

**Modal `PaymentMethodPicker`:**
- Radio button list dari `product.paymentMethods`
- Tampilkan estimasi fee per method (formula Louvin: QRIS/e-wallet 0.7%
  + Rp 400, VA Rp 6.500 flat)
- Submit → `api.shop.checkout(productId, paymentMethod)` →
  redirect ke `/shop/checkout/:orderId`
- Tombol disabled kalau `user.inGuild === false`

### Page: `Checkout.jsx`

```
┌─────────────────────────────────────────────────────┐
│ HEADER: "CHECKOUT" + breadcrumb < Shop              │
├─────────────────────────────────────────────────────┤
│ [INFO PANEL]                                        │
│  Order ID: qta-xxx                                  │
│  Produk: VIP 30 HARI                                │
│  Role: @VIP → akan diberikan ke @username           │
│  Durasi: 30 hari setelah disetujui                  │
├─────────────────────────────────────────────────────┤
│ [PAYMENT BREAKDOWN]                                 │
│  Harga produk:        Rp 50.000                     │
│  Fee Louvin (QRIS):   Rp    750                     │
│  ─────────────────────────────                      │
│  TOTAL BAYAR:         Rp 50.750                     │
├─────────────────────────────────────────────────────┤
│ [PAYMENT INSTRUCTIONS]                              │
│  QRIS (qr_string available):                        │
│  ┌─────────────┐                                    │
│  │ ░░ QR ░░░░ │  ← qrcode.react render qr_string    │
│  │ ░░░░ CODE ░│                                     │
│  └─────────────┘                                    │
│                                                     │
│  VA (va_number available):                          │
│  Bank: BNI                                          │
│  No. VA: 8810 1234 5678 9012  [Copy]                │
│  Total: Rp 50.750             [Copy]                │
├─────────────────────────────────────────────────────┤
│ [STATUS BADGE] ⏳ Menunggu pembayaran                │
│ Expires: 14:23 (countdown live)                     │
│ [Cek Status Manual] [Batalkan]                      │
└─────────────────────────────────────────────────────┘
```

**State management:**
- `useEffect` polling `api.shop.getTransaction(orderId)` tiap 5 detik
  (clearInterval saat status final atau unmount)
- `useRealtime()` SSE listener untuk `transaction.approved` event matching `orderId`
  → instant update tanpa polling delay
- Saat `approved` → toast success + redirect `/my-purchases?highlight=:orderId` (after 2s delay)
- Saat `expired`/`rejected` → tampilkan banner + tombol balik ke `/shop`

**Confirmation panel — visual confirmation pre-bayar:**
- "Role akan otomatis diberikan ke akun Discord kamu: **@username**"
- Tidak ada input — pure display
- User Discord username + ID dari `useAuth().user`

**QR rendering:**
- Library: `qrcode.react` (~3KB gz, popular, no deps).
  Add ke `web-admin/package.json`
- Render `qr_string` dari Louvin response → SVG QR

**Cancel button:**
- Memo: Louvin tidak punya cancel API. "Batalkan" cuma update DB ke
  `status='cancelled'` — Louvin transaction technically masih hidup
  sampai expired_at. Tapi karena kita pakai webhook + status check,
  kalau user akhirnya bayar transaksi yang sudah cancelled di kita,
  webhook handler akan detect `status='cancelled'` dan return 200
  no-op (bagian dari idempotency final-state list). User dapat
  warning di /my-purchases: "Pembayaran terdeteksi setelah dibatalkan,
  hubungi admin." Admin bisa manual-approve dari `/transactions`.
  Edge case rare karena window cancel→bayar sangat pendek.

### Page: `MyPurchases.jsx`

```
┌──────────────────────────────────────────────────────────────┐
│ RIWAYAT PEMBELIAN                                            │
├──────────────────────────────────────────────────────────────┤
│ [FILTER] Status: [Semua ▾]   Channel: [Semua ▾]              │
├──────────────────────────────────────────────────────────────┤
│ Order #qta-xxx  │ VIP 30 HARI  │ Rp 50.000  │ APPROVED       │
│ 17 May 2026     │ Channel: QRIS│            │ Aktif s/d 16Jun│
│                                              [Beli Lagi]     │
├──────────────────────────────────────────────────────────────┤
│ Order #qta-yyy  │ VIP 7 HARI   │ Rp 15.000  │ EXPIRED        │
│ 15 May 2026     │ Channel: QRIS│            │ Tidak dibayar  │
├──────────────────────────────────────────────────────────────┤
│ Order #manual-1 │ ROOKIE 30D   │ Rp 100.000 │ APPROVED       │
│ 10 May 2026     │ Channel:Bank │            │ Aktif s/d 9Jun │
└──────────────────────────────────────────────────────────────┘
```

Show baik `manual_bank` maupun `louvin`. Channel badge differentiates.
Status pakai existing brutalist `StatusPill`. Highlight row kalau ada
query `?highlight=qta-xxx` (post-checkout success).

### Update `Products.jsx` (admin)

Form create/edit product tambah field multi-checkbox:

```
Payment Methods (pilih min 1):
  [✓] QRIS                   fee 0.7% + Rp 400
  [✓] GoPay                  fee 0.7% + Rp 400
  [ ] ShopeePay              fee 0.7% + Rp 400
  [✓] BNI VA                 fee Rp 6.500 flat
  [ ] BRI VA                 fee Rp 6.500 flat
  [ ] Permata VA             fee Rp 6.500 flat
  [ ] CIMB Niaga VA          fee Rp 6.500 flat
```

Default saat create: `['qris']`. Validasi: minimal 1 method dipilih.

### API client extension di `web-admin/src/api.js`

```js
api.shop = {
  listProducts: () => api.get('/api/shop/products'),
  getProduct:   (id) => api.get(`/api/shop/products/${id}`),
  checkout:     (productId, paymentMethod) =>
                api.post('/api/shop/checkout', { productId, paymentMethod }),
  getTransaction: (orderId) =>
                api.get(`/api/shop/transactions/${orderId}`),
  recheckStatus: (orderId) =>
                api.post(`/api/shop/transactions/${orderId}/recheck`),
  myTransactions: (params) =>
                api.get('/api/shop/my-transactions', { params }),
  pendingTransaction: () => api.get('/api/shop/pending'),
};
```

## Configuration

### New env vars (`.env.example`)

```env
# Louvin Payment Gateway (one-off web shop)
# Set false untuk disable Louvin entirely (tombol Beli muncul tapi
# checkout return 503). Existing manual bank transfer di Discord ga
# terpengaruh.
LOUVIN_ENABLED=false

# API key dari https://louvin.dev Dashboard → Proyek → Detail Proyek.
# Format: lv_<random>
LOUVIN_API_KEY=

# Random hex untuk webhook path token.
# Generate: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Webhook URL untuk register di Louvin Dashboard:
#   ${DASHBOARD_BASE_URL}/api/webhooks/louvin/${LOUVIN_WEBHOOK_TOKEN}
LOUVIN_WEBHOOK_TOKEN=

# Default description di Louvin transaction (untuk visibility di Louvin Dashboard)
LOUVIN_DEFAULT_DESCRIPTION=Pembelian role QTrades

# Discord invite URL untuk user yang belum di guild
DISCORD_INVITE_URL=https://discord.gg/qtrades
```

### Setup checklist (operator)

1. Daftar di [louvin.dev](https://louvin.dev), buat proyek
2. Copy API key (`lv_...`) ke `.env` sebagai `LOUVIN_API_KEY`
3. Generate `LOUVIN_WEBHOOK_TOKEN`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
4. Set webhook URL di Louvin Dashboard:
   ```
   https://qtrades.bensserver.cloud/api/webhooks/louvin/<TOKEN>
   ```
5. Set `LOUVIN_ENABLED=true`, `DISCORD_INVITE_URL=...`
6. `pm2 restart qtassist`
7. Test: bikin produk dengan `paymentMethods=['qris']`, beli sebagai user
   non-admin

## Error Handling

| Skenario | Backend | Frontend |
|---|---|---|
| `LOUVIN_ENABLED=false` saat checkout | 503 `louvin_disabled` | Toast error + tombol Beli disabled |
| User tidak di guild | 403 `not_in_guild` + `inviteUrl` | Banner + tombol Join Discord |
| Product inactive / not found | 404 `product_not_found` | Toast + redirect /shop |
| Method bukan di paymentMethods | 400 `invalid_method` | Modal validation error |
| Louvin API timeout / error | 502 `gateway_error` | Toast "Layanan pembayaran sedang gangguan, coba lagi" |
| Duplicate pending transaction (same product+method, belum expired) | 200 dengan existing transaction | Redirect ke checkout existing (resume flow) |
| Webhook path token mismatch | 404 (obscure) | n/a |
| Webhook event invalid shape | 400 `invalid_payload` | n/a (Louvin akan retry) |
| Webhook verify ke Louvin gagal | 502 `verify_failed` | Louvin retry |
| Webhook untuk transaction sudah final | 200 idempotent no-op | n/a |
| Cron expire pending stale | Status update + emitEvent | SSE detect, FE update |
| QR/VA expired tapi user tetap bayar (race) | Webhook idempotency: status sudah `expired` di DB → 200 no-op. Banner di /my-purchases minta hubungi admin manual-approve | Banner peringatan di /my-purchases |

## Testing Strategy

### Unit tests (services)
- `louvinService.createLouvinTransaction` — mock fetch, test happy path + 4XX/5XX
- `louvinService.checkLouvinStatus` — same
- `transactionService.approveTransaction` — sudah ada, tambah test case `paymentChannel='louvin'`

### Integration tests (routes)
- `POST /api/shop/checkout`:
  - happy path
  - LOUVIN_ENABLED=false → 503
  - user not in guild → 403
  - invalid paymentMethod → 400
  - duplicate pending → return existing
- `POST /api/webhooks/louvin/:token`:
  - happy path settled → role granted via approveTransaction
  - failed event → status=expired
  - invalid token → 404
  - sudah final state → 200 idempotent
  - verify gagal → 502
- `GET /api/shop/pending` returns latest pending only

### E2E manual test (operator checklist post-deploy)
1. Login dashboard sebagai user non-admin yang sudah di guild
2. Buka `/shop` → list produk muncul
3. Buy produk QRIS → checkout page muncul dengan QR
4. Scan QR via e-wallet → bayar Rp 50.750
5. Tunggu 5 detik — status auto update ke approved
6. Cek Discord — role @VIP sudah diberikan, DM masuk
7. Buka `/my-purchases` — transaksi muncul dengan status APPROVED + sisa durasi
8. Cek admin `/transactions` — transaksi visible dengan badge "LOUVIN"
9. Cek Google Sheets — sync ter-update

### Test case khusus untuk dev (tanpa bayar real)
- Dev mode: tambah env `LOUVIN_DEV_MOCK=true` (saat `LOUVIN_ENABLED=false`)
  yang bypass real Louvin call. Checkout return mock QR string +
  fake `louvinTransactionId`. Webhook test endpoint `POST /api/dev/louvin-fake-webhook?orderId=xxx&status=settled`
  untuk simulate webhook tanpa Louvin server.
- **Decision:** simpan untuk follow-up plan kalau perlu, tidak in MVP scope
  awal. Operator test pakai sandbox di Louvin (jika ada) atau real
  transaction kecil (Rp 1.500 minimum QRIS).

## Documentation Updates

Semua doc berikut harus di-update sebagai bagian dari implementation:

1. **README.md**:
   - Tambah feature section "Web Shop & Louvin Payment"
   - Tambah env vars baru
   - Tambah workflow "User Purchase Flow (Web)"
   - Tambah troubleshooting Louvin

2. **deploy/README.md**:
   - Section baru "Setup Louvin Payment Gateway" dengan langkah operator

3. **PROGRESS.md**:
   - Tambah ke "Recent Major Changes" + "Shipped Features"

4. **QUICK-START.md**:
   - Section "For End Users" tambah "Beli Produk via Web"
   - Section "For Admins" tambah info Payment Methods config

5. **NEW: docs/superpowers/specs/2026-05-17-web-shop-louvin-design.md**:
   - File ini

6. **NEW: docs/superpowers/plans/2026-05-17-web-shop-louvin-plan.md**:
   - Implementation plan (next step)

7. **TODO.md**:
   - Hapus / update kalau ada item Louvin-related selesai
   - Tambah follow-up: Louvin sandbox/mock support, refund flow, dll

## Migration / Rollout

1. **Phase 1 (this spec):** Ship semua kode dengan `LOUVIN_ENABLED=false`
   default. Migration jalan, model & route mounted, tapi user-facing
   tombol "Beli" return 503 kalau di-test. Aman di-merge.
2. **Phase 2:** Operator setup Louvin proyek + webhook URL. Set
   `LOUVIN_ENABLED=true` di production .env, restart bot. Test dengan
   produk dummy seharga Rp 1.500 (QRIS minimum).
3. **Phase 3:** Tambah produk real ke `paymentMethods`, monitor.
4. **Future:** Decide apakah deprecate Discord manual transfer.

## Open Questions / Future Work

- Webhook signature verify — Louvin docs ga mention HMAC signature.
  Path token + status verify cukup untuk MVP. Kalau Louvin tambah
  signature endpoint, upgrade.
- Subscription support — Louvin API ada, tapi cuma QRIS via email
  reminder. Out of scope MVP.
- Refund flow — manual via dashboard `/transactions`, status update +
  bot DM ke user. Tidak otomatis ke Louvin (no API).
- Multi-server support — current scope single guild
  (`DISCORD_GUILD_ID`). Bila multi-guild future, butuh per-guild Louvin
  config.
- "Beli untuk teman" — input Discord ID lain. Out of scope.
