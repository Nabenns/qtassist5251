# Web Shop with Louvin Payment Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add web-based one-off purchase flow at `/shop` with Louvin Payment Gateway, auto-grant role on settled webhook, coexist with Discord manual bank transfer.

**Architecture:** Reuse `Transaction` table with new `paymentChannel` + `louvin_*` columns. Reuse `transactionService.approveTransaction()` for role grant — webhook handler invokes it with `reviewerId='system:louvin'`. Frontend gets 3 new pages (Shop, Checkout, MyPurchases) on the existing React SPA with Discord OAuth auth. Defense-in-depth security: webhook path token + server-to-server `check-status` verify before mutating state.

**Tech Stack:** Node.js 18, discord.js v14, Sequelize + Postgres, Express, React 18 + Vite + Tailwind, Louvin REST API, `qrcode.react`.

**Reference spec:** `docs/superpowers/specs/2026-05-17-web-shop-louvin-design.md`

---

## File Structure

### NEW backend files
- `src/database/migrations/add-payment-methods-to-products.js`
- `src/database/migrations/add-louvin-columns-to-transactions.js`
- `src/services/louvinService.js`
- `src/web/routes/shop.js`
- `src/web/routes/webhooks.js`

### MODIFIED backend files
- `src/database/models/Product.js` — add `paymentMethods`
- `src/database/models/Transaction.js` — add `paymentChannel`, `louvin*`
- `src/services/cronService.js` — add `expirePendingLouvinTransactions`
- `src/services/transactionService.js` — emit louvin metadata in audit log
- `src/web/server.js` — mount shop + webhooks routers
- `src/web/routes/products.js` — accept `paymentMethods`

### NEW frontend files
- `web-admin/src/pages/Shop.jsx`
- `web-admin/src/pages/Checkout.jsx`
- `web-admin/src/pages/MyPurchases.jsx`
- `web-admin/src/components/PaymentMethodPicker.jsx`

### MODIFIED frontend files
- `web-admin/src/App.jsx` — register 3 routes
- `web-admin/src/components/Layout.jsx` — nav items for non-admin
- `web-admin/src/api.js` — add `api.shop.*` namespace
- `web-admin/src/pages/Products.jsx` — multi-checkbox for paymentMethods
- `web-admin/package.json` — add `qrcode.react`

### Documentation
- `README.md`, `deploy/README.md`, `PROGRESS.md`, `QUICK-START.md`, `.env.example`

---

## Test Approach

Project belum punya test framework. Verification per task:
- **Migration tasks:** run script, check `\d <table>` di psql atau `SELECT column_name FROM information_schema.columns`
- **Service tasks:** smoke test via `node -e "require('./src/services/louvinService').createLouvinTransaction(...)"` adhoc
- **Route tasks:** curl ke endpoint, cek response shape
- **Frontend tasks:** `npm run build:web` lulus + manual browser test

Setiap task yang complex include "Step: Verify" dengan command konkret. Tidak ada auto-test runner.

---

## Task 1: Migration — `payment_methods` column on products

**Files:**
- Create: `src/database/migrations/add-payment-methods-to-products.js`

- [ ] **Step 1: Create migration file**

```js
/**
 * Migration: add payment_methods column to products
 *
 * Adds JSONB column with default ["qris"]. Idempotent — safe to re-run.
 *
 * Run via:
 *   node src/database/migrations/add-payment-methods-to-products.js
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('products');

  if (tableDescription.payment_methods) {
    console.log('ℹ️  Column payment_methods already exists, skipping');
  } else {
    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN payment_methods JSONB
      NOT NULL DEFAULT '["qris"]'::jsonb
    `);
    console.log('✅ Added payment_methods column to products');
  }

  // GIN index for filtering
  const [indexes] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexname = 'idx_products_payment_methods'`
  );
  if (indexes.length === 0) {
    await sequelize.query(`
      CREATE INDEX idx_products_payment_methods
      ON products USING gin (payment_methods)
    `);
    console.log('✅ Created GIN index idx_products_payment_methods');
  } else {
    console.log('ℹ️  Index idx_products_payment_methods already exists, skipping');
  }

  console.log('✅ Migration complete');
}

(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
```

- [ ] **Step 2: Run migration**

```bash
node src/database/migrations/add-payment-methods-to-products.js
```

Expected output:
```
✅ Added payment_methods column to products
✅ Created GIN index idx_products_payment_methods
✅ Migration complete
```

- [ ] **Step 3: Verify schema in psql**

```bash
psql -U $DB_USER -d $DB_NAME -c "\d products"
```

Expected: column `payment_methods | jsonb | not null default '[\"qris\"]'::jsonb` muncul, plus index `idx_products_payment_methods` listed.

- [ ] **Step 4: Re-run migration (idempotency)**

```bash
node src/database/migrations/add-payment-methods-to-products.js
```

Expected: both "already exists, skipping" lines printed, no error.

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/add-payment-methods-to-products.js
git commit -m "db: add payment_methods JSONB column to products"
```

---

## Task 2: Update Product model with `paymentMethods` field

**Files:**
- Modify: `src/database/models/Product.js`

- [ ] **Step 1: Add field to model**

Edit `src/database/models/Product.js`. Tambah field setelah `serverId`:

```js
serverId: {
  type: DataTypes.STRING,
  allowNull: false,
  field: 'server_id'
},
paymentMethods: {
  type: DataTypes.JSONB,
  allowNull: false,
  defaultValue: ['qris'],
  field: 'payment_methods',
  validate: {
    isValidMethods(value) {
      const VALID = ['qris', 'gopay', 'shopeepay', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'];
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('paymentMethods must be a non-empty array');
      }
      for (const m of value) {
        if (!VALID.includes(m)) {
          throw new Error(`Invalid payment method: ${m}`);
        }
      }
    }
  }
}
```

- [ ] **Step 2: Verify model loads**

```bash
node -e "const P = require('./src/database/models/Product'); console.log(Object.keys(P.rawAttributes));"
```

Expected: array berisi `paymentMethods` di antara field lain.

- [ ] **Step 3: Commit**

```bash
git add src/database/models/Product.js
git commit -m "model: add paymentMethods field to Product with validation"
```

---

## Task 3: Migration — Louvin columns on transactions

**Files:**
- Create: `src/database/migrations/add-louvin-columns-to-transactions.js`

- [ ] **Step 1: Create migration file**

```js
/**
 * Migration: add Louvin payment gateway columns to transactions.
 *
 * Adds payment_channel + 6 nullable louvin_* columns plus 2 indexes.
 * Idempotent — safe to re-run.
 *
 * Run: node src/database/migrations/add-louvin-columns-to-transactions.js
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function ensureColumn(queryInterface, tableDescription, name, ddl) {
  if (tableDescription[name]) {
    console.log(`ℹ️  Column ${name} already exists, skipping`);
    return;
  }
  await sequelize.query(`ALTER TABLE transactions ADD COLUMN ${name} ${ddl}`);
  console.log(`✅ Added column ${name}`);
}

async function ensureIndex(name, ddl) {
  const [results] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'transactions' AND indexname = $1`,
    { bind: [name] }
  );
  if (results.length > 0) {
    console.log(`ℹ️  Index ${name} already exists, skipping`);
    return;
  }
  await sequelize.query(ddl);
  console.log(`✅ Created index ${name}`);
}

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const td = await queryInterface.describeTable('transactions');

  await ensureColumn(queryInterface, td, 'payment_channel', `VARCHAR(32) NOT NULL DEFAULT 'manual_bank'`);
  await ensureColumn(queryInterface, td, 'louvin_transaction_id', 'VARCHAR(64)');
  await ensureColumn(queryInterface, td, 'louvin_payment_type', 'VARCHAR(32)');
  await ensureColumn(queryInterface, td, 'louvin_fee', 'INTEGER');
  await ensureColumn(queryInterface, td, 'louvin_total_payment', 'INTEGER');
  await ensureColumn(queryInterface, td, 'louvin_payment_number', 'TEXT');
  await ensureColumn(queryInterface, td, 'louvin_expired_at', 'TIMESTAMP WITH TIME ZONE');

  await ensureIndex('idx_transactions_louvin_id', `
    CREATE UNIQUE INDEX idx_transactions_louvin_id
    ON transactions(louvin_transaction_id)
    WHERE louvin_transaction_id IS NOT NULL
  `);
  await ensureIndex('idx_transactions_payment_channel', `
    CREATE INDEX idx_transactions_payment_channel
    ON transactions(payment_channel)
  `);

  console.log('✅ Migration complete');
}

(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
```

- [ ] **Step 2: Run migration**

```bash
node src/database/migrations/add-louvin-columns-to-transactions.js
```

Expected: 7 "Added column" + 2 "Created index" lines.

- [ ] **Step 3: Verify schema**

```bash
psql -U $DB_USER -d $DB_NAME -c "\d transactions"
```

Expected: lihat kolom `payment_channel`, `louvin_transaction_id`, `louvin_payment_type`, `louvin_fee`, `louvin_total_payment`, `louvin_payment_number`, `louvin_expired_at`.

- [ ] **Step 4: Re-run for idempotency**

Expected: semua "already exists, skipping" lines.

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/add-louvin-columns-to-transactions.js
git commit -m "db: add Louvin payment columns to transactions"
```

---

## Task 4: Update Transaction model with Louvin fields

**Files:**
- Modify: `src/database/models/Transaction.js`

- [ ] **Step 1: Add fields**

Edit `src/database/models/Transaction.js`. Tambah field-field baru setelah `paidAt`:

```js
paidAt: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'paid_at',
  comment: 'When payment was approved'
},
paymentChannel: {
  type: DataTypes.STRING(32),
  allowNull: false,
  defaultValue: 'manual_bank',
  field: 'payment_channel',
  validate: {
    isIn: {
      args: [['manual_bank', 'louvin']],
      msg: 'paymentChannel must be manual_bank or louvin'
    }
  }
},
louvinTransactionId: {
  type: DataTypes.STRING(64),
  allowNull: true,
  field: 'louvin_transaction_id',
  comment: 'UUID dari Louvin /create-transaction response'
},
louvinPaymentType: {
  type: DataTypes.STRING(32),
  allowNull: true,
  field: 'louvin_payment_type',
  comment: 'qris, gopay, bni_va, dst'
},
louvinFee: {
  type: DataTypes.INTEGER,
  allowNull: true,
  field: 'louvin_fee',
  comment: 'Fee Louvin (IDR)'
},
louvinTotalPayment: {
  type: DataTypes.INTEGER,
  allowNull: true,
  field: 'louvin_total_payment',
  comment: 'Total yang dibayar customer (amount + fee)'
},
louvinPaymentNumber: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'louvin_payment_number',
  comment: 'qr_string atau va_number untuk display'
},
louvinExpiredAt: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'louvin_expired_at',
  comment: 'Expiry timestamp dari Louvin'
}
```

Juga update indexes block — tambah `{ fields: ['payment_channel'] }`:

```js
indexes: [
  { fields: ['order_id'] },
  { fields: ['user_id'] },
  { fields: ['server_id'] },
  { fields: ['status'] },
  { fields: ['payment_channel'] }
]
```

- [ ] **Step 2: Verify model**

```bash
node -e "const T = require('./src/database/models/Transaction'); console.log(Object.keys(T.rawAttributes).filter(k => k.startsWith('louvin') || k === 'paymentChannel'));"
```

Expected: `[ 'paymentChannel', 'louvinTransactionId', 'louvinPaymentType', 'louvinFee', 'louvinTotalPayment', 'louvinPaymentNumber', 'louvinExpiredAt' ]`

- [ ] **Step 3: Commit**

```bash
git add src/database/models/Transaction.js
git commit -m "model: add Louvin fields to Transaction"
```

---

## Task 5: Louvin API service wrapper

**Files:**
- Create: `src/services/louvinService.js`

- [ ] **Step 1: Create service file**

```js
/**
 * Thin wrapper around the Louvin Payment Gateway HTTP API.
 *
 * Single responsibility: call API + parse response. No business logic.
 * Caller decides what to do with the result.
 *
 * Reads LOUVIN_API_KEY at call time (not module load) so hot-reload works.
 *
 * Default timeout: 10 seconds.
 *
 * Errors: throws LouvinError with `code` and optional `details`.
 */

const LOUVIN_BASE_URL = 'https://api.louvin.dev';
const DEFAULT_TIMEOUT_MS = 10_000;

class LouvinError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'LouvinError';
    this.code = code;
    this.details = details;
  }
}

function getApiKey() {
  const key = process.env.LOUVIN_API_KEY;
  if (!key) throw new LouvinError('config_missing', 'LOUVIN_API_KEY not set');
  return key;
}

async function louvinFetch(path, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${LOUVIN_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // non-JSON response
    }
    if (!res.ok || !data?.success) {
      throw new LouvinError(
        'gateway_error',
        data?.error || `Louvin returned ${res.status}`,
        data
      );
    }
    return data;
  } catch (err) {
    if (err instanceof LouvinError) throw err;
    if (err.name === 'AbortError') {
      throw new LouvinError('network_error', 'Louvin API timeout');
    }
    throw new LouvinError('network_error', err.message || 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /create-transaction
 * @param {Object} params
 * @param {number} params.amount - merchant net (IDR), kita pakai harga produk
 * @param {string} params.paymentType - qris, gopay, shopeepay, bni_va, ...
 * @param {string} params.customerName
 * @param {string} [params.customerEmail]
 * @param {string} [params.description]
 * @param {string} params.reference - our orderId
 * @returns {Promise<{ transaction, payment }>}
 */
async function createLouvinTransaction({
  amount,
  paymentType,
  customerName,
  customerEmail,
  description,
  reference
}) {
  const data = await louvinFetch('/create-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey()
    },
    body: JSON.stringify({
      amount,
      payment_type: paymentType,
      customer_name: customerName,
      customer_email: customerEmail,
      description,
      reference
    })
  });
  return { transaction: data.transaction, payment: data.payment };
}

/**
 * GET /check-status?id=...
 * @param {string} transactionId - UUID dari Louvin
 */
async function checkLouvinStatus(transactionId) {
  if (!transactionId) {
    throw new LouvinError('invalid_argument', 'transactionId required');
  }
  const data = await louvinFetch(
    `/check-status?id=${encodeURIComponent(transactionId)}`,
    {
      method: 'GET',
      headers: { 'x-api-key': getApiKey() }
    }
  );
  return { transaction: data.transaction };
}

module.exports = {
  createLouvinTransaction,
  checkLouvinStatus,
  LouvinError
};
```

- [ ] **Step 2: Smoke test config_missing branch**

```bash
node -e "delete process.env.LOUVIN_API_KEY; const { createLouvinTransaction } = require('./src/services/louvinService'); createLouvinTransaction({ amount: 1500, paymentType: 'qris', customerName: 'Test', reference: 'test-1' }).catch(e => console.log(e.code, e.message));"
```

Expected: `config_missing LOUVIN_API_KEY not set`

- [ ] **Step 3: Smoke test gateway_error branch (bad API key)**

```bash
node -e "process.env.LOUVIN_API_KEY='lv_invalid'; const { createLouvinTransaction } = require('./src/services/louvinService'); createLouvinTransaction({ amount: 1500, paymentType: 'qris', customerName: 'Test', reference: 'test-1' }).then(r => console.log(JSON.stringify(r))).catch(e => console.log(e.code, e.message));"
```

Expected: `gateway_error <some message>` dari Louvin (probably 401 unauthorized).

- [ ] **Step 4: Commit**

```bash
git add src/services/louvinService.js
git commit -m "service: add Louvin API wrapper (create + check-status)"
```

---

## Task 6: Add `LOUVIN_*` env vars to .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append env section**

Tambahkan di akhir `.env.example` (sebelum baris terakhir kalau ada):

```env

# ============================================================
# Louvin Payment Gateway (web shop /shop)
# ============================================================
# Set true untuk aktifkan flow Louvin di /shop. Existing Discord
# manual bank transfer ga terpengaruh.
LOUVIN_ENABLED=false

# API key dari https://louvin.dev Dashboard → Proyek → Detail Proyek
# Format: lv_<random>
LOUVIN_API_KEY=

# Random hex untuk webhook path token. Generate:
#   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Webhook URL untuk register di Louvin Dashboard:
#   ${DASHBOARD_BASE_URL}/api/webhooks/louvin/${LOUVIN_WEBHOOK_TOKEN}
LOUVIN_WEBHOOK_TOKEN=

# Default description di Louvin transaction (visibility di Louvin Dashboard)
LOUVIN_DEFAULT_DESCRIPTION=Pembelian role QTrades

# Discord invite URL untuk user yang belum di guild
DISCORD_INVITE_URL=https://discord.gg/qtrades
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "env: add LOUVIN_* and DISCORD_INVITE_URL placeholders"
```

---

## Task 7: Shop API route — list products + pending

**Files:**
- Create: `src/web/routes/shop.js`

- [ ] **Step 1: Create route file (list + pending only, more endpoints in next tasks)**

```js
/**
 * User-facing shop endpoints. All require an authenticated session
 * (any user, admin or not).
 *
 * In-memory product cache (5 min) to reduce DB load on /shop browsing.
 * Cache invalidates per-server.
 */

const express = require('express');
const { Op } = require('sequelize');
const { Product, Transaction } = require('../../database/models');
const { requireAuth } = require('../middleware');

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const productCache = new Map(); // serverId -> { items, expiresAt }

function getCachedProducts(serverId) {
  const entry = productCache.get(serverId);
  if (entry && entry.expiresAt > Date.now()) return entry.items;
  return null;
}

function setCachedProducts(serverId, items) {
  productCache.set(serverId, {
    items,
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS
  });
}

function clearProductCache(serverId) {
  if (serverId) productCache.delete(serverId);
  else productCache.clear();
}

function serializeProduct(p) {
  return {
    id: p.id,
    serverId: p.serverId,
    roleId: p.roleId,
    name: p.name,
    description: p.description,
    price: p.price,
    duration: String(p.duration),
    paymentMethods: Array.isArray(p.paymentMethods) ? p.paymentMethods : ['qris'],
    isActive: p.isActive
  };
}

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAuth);

  // GET /api/shop/products — list active products for the configured guild.
  router.get('/products', async (req, res) => {
    try {
      const serverId = process.env.DISCORD_GUILD_ID;
      if (!serverId) return res.status(500).json({ error: 'guild_not_configured' });

      const cached = getCachedProducts(serverId);
      if (cached) {
        return res.json({ items: cached, cached: true });
      }

      const products = await Product.findAll({
        where: { serverId, isActive: true },
        order: [['createdAt', 'DESC']]
      });
      const items = products.map(serializeProduct);
      setCachedProducts(serverId, items);
      return res.json({ items, cached: false });
    } catch (error) {
      console.error('GET /api/shop/products error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // GET /api/shop/products/:id — single product detail.
  router.get('/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

      const product = await Product.findByPk(id);
      if (!product || !product.isActive) {
        return res.status(404).json({ error: 'product_not_found' });
      }
      return res.json({ product: serializeProduct(product) });
    } catch (error) {
      console.error('GET /api/shop/products/:id error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // GET /api/shop/pending — latest non-expired pending transaction for user.
  // Used by /shop page to show resume banner.
  router.get('/pending', async (req, res) => {
    try {
      const userId = req.session.discordId;
      const trx = await Transaction.findOne({
        where: {
          userId,
          status: 'pending',
          paymentChannel: 'louvin',
          louvinExpiredAt: { [Op.gt]: new Date() }
        },
        include: [{ model: Product, as: 'product' }],
        order: [['createdAt', 'DESC']]
      });
      if (!trx) return res.json({ pending: null });

      return res.json({
        pending: {
          orderId: trx.orderId,
          productId: trx.productId,
          productName: trx.product?.name,
          amount: trx.amount,
          louvinFee: trx.louvinFee,
          louvinTotalPayment: trx.louvinTotalPayment,
          louvinPaymentType: trx.louvinPaymentType,
          louvinExpiredAt: trx.louvinExpiredAt,
          createdAt: trx.createdAt
        }
      });
    } catch (error) {
      console.error('GET /api/shop/pending error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
module.exports.clearProductCache = clearProductCache;
```

- [ ] **Step 2: Commit (will mount + extend in later tasks)**

```bash
git add src/web/routes/shop.js
git commit -m "route: add /api/shop products + pending endpoints (cache 5min)"
```

---

## Task 8: Shop API route — checkout endpoint

**Files:**
- Modify: `src/web/routes/shop.js`

- [ ] **Step 1: Import deps + helpers**

Tambah di top imports `src/web/routes/shop.js`:

```js
const crypto = require('crypto');
const { createLouvinTransaction, LouvinError } = require('../../services/louvinService');
```

- [ ] **Step 2: Add `generateOrderId` helper above `buildRouter`**

```js
function generateOrderId() {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex'); // 6 char hex
  return `qta-${ts}-${rand}`;
}
```

- [ ] **Step 3: Add POST /api/shop/checkout endpoint inside `buildRouter`**

Sebelum `return router;`:

```js
  // POST /api/shop/checkout
  // Body: { productId, paymentMethod }
  router.post('/checkout', async (req, res) => {
    try {
      if (process.env.LOUVIN_ENABLED !== 'true') {
        return res.status(503).json({ error: 'louvin_disabled' });
      }

      const { productId, paymentMethod } = req.body || {};
      if (!Number.isFinite(Number(productId))) {
        return res.status(400).json({ error: 'invalid_product_id' });
      }
      if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
        return res.status(400).json({ error: 'invalid_payment_method' });
      }

      const product = await Product.findByPk(Number(productId));
      if (!product || !product.isActive) {
        return res.status(404).json({ error: 'product_not_found' });
      }

      const allowed = Array.isArray(product.paymentMethods) ? product.paymentMethods : [];
      if (!allowed.includes(paymentMethod)) {
        return res.status(400).json({ error: 'method_not_allowed_for_product' });
      }

      // Fresh guild membership check
      const client = getDiscordClient();
      if (!client) {
        return res.status(503).json({ error: 'bot_not_ready' });
      }
      const guild = await client.guilds.fetch(product.serverId).catch(() => null);
      if (!guild) {
        return res.status(503).json({ error: 'guild_not_accessible' });
      }
      const member = await guild.members.fetch(req.session.discordId).catch(() => null);
      if (!member) {
        return res.status(403).json({
          error: 'not_in_guild',
          inviteUrl: process.env.DISCORD_INVITE_URL || null
        });
      }

      // Resume duplicate: existing pending un-expired txn for same product+method
      const now = new Date();
      const existingPending = await Transaction.findOne({
        where: {
          userId: req.session.discordId,
          productId: product.id,
          status: 'pending',
          paymentChannel: 'louvin',
          louvinPaymentType: paymentMethod,
          louvinExpiredAt: { [Op.gt]: now }
        }
      });
      if (existingPending) {
        return res.json({
          orderId: existingPending.orderId,
          resumed: true,
          paymentType: existingPending.louvinPaymentType,
          paymentNumber: existingPending.louvinPaymentNumber,
          totalPayment: existingPending.louvinTotalPayment,
          fee: existingPending.louvinFee,
          expiresAt: existingPending.louvinExpiredAt
        });
      }

      // Create local row first (status pending) so we have a stable orderId
      // to use as `reference` in Louvin call.
      const orderId = generateOrderId();
      const transaction = await Transaction.create({
        orderId,
        userId: req.session.discordId,
        serverId: product.serverId,
        productId: product.id,
        amount: product.price,
        status: 'pending',
        paymentChannel: 'louvin',
        louvinPaymentType: paymentMethod
      });

      // Call Louvin
      let louvinResp;
      try {
        louvinResp = await createLouvinTransaction({
          amount: product.price,
          paymentType: paymentMethod,
          customerName: req.session.username || req.session.discordId,
          description: process.env.LOUVIN_DEFAULT_DESCRIPTION || `Pembelian ${product.name}`,
          reference: orderId
        });
      } catch (err) {
        await transaction.update({ status: 'cancelled', rejectionReason: 'louvin_create_failed' });
        if (err instanceof LouvinError) {
          return res.status(502).json({ error: 'gateway_error', code: err.code, details: err.message });
        }
        throw err;
      }

      const { transaction: lvTrx, payment: lvPay } = louvinResp;
      // qr_string for QRIS/GoPay, va_number for VA, deeplink_url for ShopeePay
      const paymentNumber = lvPay.qr_string || lvPay.va_number || lvPay.deeplink_url || lvPay.payment_number || null;

      await transaction.update({
        louvinTransactionId: lvTrx.id,
        louvinFee: lvTrx.fee,
        louvinTotalPayment: lvTrx.amount, // total customer pays
        louvinPaymentNumber: paymentNumber,
        louvinExpiredAt: lvPay.expired_at ? new Date(lvPay.expired_at) : null
      });

      return res.status(201).json({
        orderId,
        resumed: false,
        paymentType: paymentMethod,
        paymentNumber,
        totalPayment: lvTrx.amount,
        fee: lvTrx.fee,
        amount: product.price,
        expiresAt: lvPay.expired_at
      });
    } catch (error) {
      console.error('POST /api/shop/checkout error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });
```

- [ ] **Step 4: Commit**

```bash
git add src/web/routes/shop.js
git commit -m "route: add POST /api/shop/checkout (verify guild, create Louvin txn)"
```

---

## Task 9: Shop API route — transaction status, recheck, my-transactions

**Files:**
- Modify: `src/web/routes/shop.js`

- [ ] **Step 1: Add `checkLouvinStatus` import**

Update top imports:

```js
const { createLouvinTransaction, checkLouvinStatus, LouvinError } = require('../../services/louvinService');
```

- [ ] **Step 2: Add 3 endpoints inside `buildRouter`, before `return router;`**

```js
  // GET /api/shop/transactions/:orderId — owner-only status + payment instructions.
  router.get('/transactions/:orderId', async (req, res) => {
    try {
      const trx = await Transaction.findOne({
        where: { orderId: req.params.orderId, userId: req.session.discordId },
        include: [{ model: Product, as: 'product' }]
      });
      if (!trx) return res.status(404).json({ error: 'not_found' });
      res.set('Cache-Control', 'no-store');
      return res.json({
        orderId: trx.orderId,
        status: trx.status,
        paymentChannel: trx.paymentChannel,
        amount: trx.amount,
        louvinPaymentType: trx.louvinPaymentType,
        louvinPaymentNumber: trx.louvinPaymentNumber,
        louvinFee: trx.louvinFee,
        louvinTotalPayment: trx.louvinTotalPayment,
        louvinExpiredAt: trx.louvinExpiredAt,
        rejectionReason: trx.rejectionReason,
        productName: trx.product?.name,
        productRoleId: trx.product?.roleId,
        productDuration: trx.product ? String(trx.product.duration) : null,
        createdAt: trx.createdAt,
        paidAt: trx.paidAt
      });
    } catch (error) {
      console.error('GET /api/shop/transactions/:orderId error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // POST /api/shop/transactions/:orderId/recheck — force pull status from Louvin.
  // Useful when webhook is delayed.
  router.post('/transactions/:orderId/recheck', async (req, res) => {
    try {
      const trx = await Transaction.findOne({
        where: { orderId: req.params.orderId, userId: req.session.discordId }
      });
      if (!trx) return res.status(404).json({ error: 'not_found' });
      if (!trx.louvinTransactionId) {
        return res.status(400).json({ error: 'not_a_louvin_transaction' });
      }
      if (['approved', 'rejected', 'expired', 'cancelled'].includes(trx.status)) {
        return res.json({ orderId: trx.orderId, status: trx.status, refreshed: false });
      }

      let lv;
      try {
        lv = await checkLouvinStatus(trx.louvinTransactionId);
      } catch (err) {
        return res.status(502).json({ error: 'gateway_error', message: err.message });
      }

      // Apply state changes — but DO NOT call approveTransaction here
      // (that path is reserved for webhook handler to keep idempotency
      // honest). Recheck only flips local status; user re-polls and
      // webhook eventually grants role. If webhook never fires, admin
      // must approve manually from /transactions admin page.
      if (lv.transaction.status === 'failed' && trx.status === 'pending') {
        await trx.update({ status: 'expired' });
      }
      // For settled, return current Louvin status to FE; webhook handler
      // (or admin manual) will flip status to approved + grant role.
      return res.json({
        orderId: trx.orderId,
        status: trx.status,
        louvinStatus: lv.transaction.status,
        refreshed: true
      });
    } catch (error) {
      console.error('POST /api/shop/transactions/:orderId/recheck error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // GET /api/shop/my-transactions — paginated history.
  router.get('/my-transactions', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const { rows, count } = await Transaction.findAndCountAll({
        where: { userId: req.session.discordId },
        include: [{ model: Product, as: 'product' }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return res.json({
        items: rows.map((t) => ({
          orderId: t.orderId,
          productName: t.product?.name || null,
          amount: t.amount,
          status: t.status,
          paymentChannel: t.paymentChannel,
          louvinPaymentType: t.louvinPaymentType,
          louvinTotalPayment: t.louvinTotalPayment,
          createdAt: t.createdAt,
          paidAt: t.paidAt,
          rejectionReason: t.rejectionReason
        })),
        total: count,
        limit,
        offset
      });
    } catch (error) {
      console.error('GET /api/shop/my-transactions error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });
```

- [ ] **Step 3: Commit**

```bash
git add src/web/routes/shop.js
git commit -m "route: add transaction status, recheck, my-transactions endpoints"
```

---

## Task 10: Webhook router for Louvin

**Files:**
- Create: `src/web/routes/webhooks.js`

- [ ] **Step 1: Create webhook handler**

```js
/**
 * Louvin webhook receiver.
 *
 * Defense in depth:
 *  1. Path token must match LOUVIN_WEBHOOK_TOKEN (constant-time compare)
 *  2. Server-to-server check-status to verify event payload not spoofed
 *  3. Idempotent — already-final transactions return 200 no-op
 *
 * Always returns 200 on successful processing or no-op.
 * Returns 4xx only for genuine bad input (Louvin will retry).
 */

const crypto = require('crypto');
const express = require('express');
const { Transaction } = require('../../database/models');
const { checkLouvinStatus, LouvinError } = require('../../services/louvinService');
const { approveTransaction } = require('../../services/transactionService');
const { emitEvent } = require('../../services/eventBus');

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  router.post('/louvin/:token', async (req, res) => {
    // 1. Path token check (404 to obscure existence)
    const expected = process.env.LOUVIN_WEBHOOK_TOKEN;
    if (!expected || !constantTimeEqual(req.params.token, expected)) {
      return res.status(404).json({ error: 'not_found' });
    }

    // 2. Validate payload shape
    const { event, data } = req.body || {};
    if (!event || !data || !data.transaction_id) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    // 3. Verify ke Louvin (defense in depth)
    let verified;
    try {
      verified = await checkLouvinStatus(data.transaction_id);
    } catch (err) {
      console.error('Webhook verify failed:', err.code || err.message);
      // 502 → Louvin will retry. Don't 4xx an outage.
      return res.status(502).json({ error: 'verify_failed' });
    }

    // 4. Find local transaction
    const trx = await Transaction.findOne({
      where: { louvinTransactionId: data.transaction_id }
    });
    if (!trx) {
      console.warn(`Webhook for unknown louvin_transaction_id ${data.transaction_id}`);
      return res.status(404).json({ error: 'not_found' });
    }

    // 5. Idempotency: if already final, no-op
    if (['approved', 'rejected', 'expired', 'cancelled'].includes(trx.status)) {
      console.log(`Webhook idempotent no-op for ${trx.orderId} (status=${trx.status})`);
      return res.status(200).json({ received: true, idempotent: true });
    }

    // 6. Dispatch
    const client = getDiscordClient();
    try {
      if (verified.transaction.status === 'settled') {
        if (!client) {
          // Defer: bot not ready. Louvin will retry. Don't mark approved
          // because role grant requires Discord client.
          return res.status(503).json({ error: 'bot_not_ready' });
        }
        const result = await approveTransaction({
          client,
          orderId: trx.orderId,
          reviewerId: 'system:louvin',
          reviewerLabel: `louvin:webhook:${data.transaction_id}`
        });
        if (!result.ok) {
          console.error(`approveTransaction failed for ${trx.orderId}:`, result.code, result.message);
          // Still return 200 to Louvin; admin can recover via dashboard.
          return res.status(200).json({ received: true, approved: false, code: result.code });
        }
        return res.status(200).json({ received: true, approved: true });
      }

      if (verified.transaction.status === 'failed') {
        await trx.update({ status: 'expired' });
        emitEvent('transaction.failed', {
          orderId: trx.orderId,
          userId: trx.userId,
          serverId: trx.serverId,
          reason: 'louvin_failed'
        });
        return res.status(200).json({ received: true, status: 'expired' });
      }

      // Pending or unknown — accept silently.
      return res.status(200).json({ received: true, status: verified.transaction.status });
    } catch (err) {
      console.error('Webhook dispatch error:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
```

- [ ] **Step 2: Commit**

```bash
git add src/web/routes/webhooks.js
git commit -m "route: add Louvin webhook handler with token + verify + idempotency"
```

---

## Task 11: Mount shop + webhooks in web/server.js

**Files:**
- Modify: `src/web/server.js`

- [ ] **Step 1: Find existing mount block + add new mounts**

Cari block dimana router lain di-mount (`app.use('/api/...', ...)`). Tambah dua line setelah block terakhir, sebelum SPA fallback:

```js
const buildShopRouter = require('./routes/shop');
const buildWebhooksRouter = require('./routes/webhooks');

app.use('/api/shop', buildShopRouter({ getDiscordClient }));
app.use('/api/webhooks', buildWebhooksRouter({ getDiscordClient }));
```

> **Penting:** webhooks router harus mount **sebelum** SPA fallback (`app.get('*', ...)`) supaya POST ga ke-rewrite ke index.html.

- [ ] **Step 2: Verify server starts**

```bash
npm start
```

Expected: log includes `🌐 Admin web server listening on port 3000` dan tidak ada error mount router.

`Ctrl+C` setelah confirmed.

- [ ] **Step 3: Smoke test endpoint shape**

```bash
curl -s http://localhost:3000/api/shop/products
```

Expected: `{"error":"unauthorized"}` (karena no session cookie). Membuktikan route mounted.

- [ ] **Step 4: Commit**

```bash
git add src/web/server.js
git commit -m "server: mount /api/shop and /api/webhooks routers"
```

---

## Task 12: Update products admin route to accept paymentMethods

**Files:**
- Modify: `src/web/routes/products.js`

- [ ] **Step 1: Add validation helper at top of file**

```js
const VALID_LOUVIN_METHODS = ['qris', 'gopay', 'shopeepay', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'];

function validatePaymentMethods(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const cleaned = [];
  for (const m of value) {
    if (typeof m !== 'string') return null;
    if (!VALID_LOUVIN_METHODS.includes(m)) return null;
    if (!cleaned.includes(m)) cleaned.push(m);
  }
  return cleaned.length > 0 ? cleaned : null;
}
```

- [ ] **Step 2: Update POST handler**

Cari `await Product.create({...})` di POST handler. Tambahkan `paymentMethods` validation di awal handler (setelah validasi duration):

```js
// Validate paymentMethods (optional, default ['qris'])
let paymentMethods = ['qris'];
if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'paymentMethods')) {
  const pm = validatePaymentMethods(req.body.paymentMethods);
  if (!pm) return res.status(400).json({ error: 'invalid_payment_methods' });
  paymentMethods = pm;
}
```

Lalu tambah `paymentMethods` ke `Product.create({...})` body, dan ke response object yang di-return (`product: { ..., paymentMethods }`).

- [ ] **Step 3: Update PATCH handler**

Tambah `paymentMethods` ke `allowedFields` array. Setelah block validasi `name`, tambah:

```js
if (Object.prototype.hasOwnProperty.call(updates, 'paymentMethods')) {
  const pm = validatePaymentMethods(updates.paymentMethods);
  if (!pm) return res.status(400).json({ error: 'invalid_payment_methods' });
  updates.paymentMethods = pm;
}
```

Tambah `paymentMethods` ke response `product` object.

- [ ] **Step 4: Update GET response**

Di handler `router.get('/', ...)`, di mapping `products.map((p) => ({...}))`, tambah:

```js
paymentMethods: Array.isArray(p.paymentMethods) ? p.paymentMethods : ['qris'],
```

- [ ] **Step 5: Invalidate shop cache on changes**

Di top imports:

```js
const { clearProductCache } = require('./shop');
```

Di POST handler setelah `Product.create`, sebelum return:

```js
clearProductCache(product.serverId);
```

Di PATCH handler setelah `product.update`:

```js
clearProductCache(product.serverId);
```

Di DELETE handler setelah `product.destroy()`, sebelum return:

```js
clearProductCache(product.serverId);
```

> Note: `product` masih in scope sebelum destroy — pastikan capture `serverId` ke variable lokal sebelum destroy kalau perlu.

- [ ] **Step 6: Commit**

```bash
git add src/web/routes/products.js
git commit -m "route: products admin accepts paymentMethods + invalidates shop cache"
```

---

## Task 13: Cron job — expire pending Louvin transactions

**Files:**
- Modify: `src/services/cronService.js`

- [ ] **Step 1: Add new cron handler**

Cari spot dengan handler yang sudah ada (search "expirePendingTransactions" atau handler lain). Tambah function baru di dekat handler-handler existing:

```js
/**
 * Mark pending Louvin transactions stale-past-expiry as 'expired'.
 * Idempotent. Called every 5 minutes.
 */
async function expirePendingLouvinTransactions() {
  const now = new Date();
  const stale = await Transaction.findAll({
    where: {
      paymentChannel: 'louvin',
      status: 'pending',
      louvinExpiredAt: { [Op.lt]: now }
    }
  });

  if (stale.length === 0) return { count: 0 };

  console.log(`🔍 Found ${stale.length} expired Louvin transaction(s). Marking expired...`);
  for (const trx of stale) {
    await trx.update({ status: 'expired' });
    emitEvent('transaction.expired', {
      orderId: trx.orderId,
      userId: trx.userId,
      serverId: trx.serverId,
      reason: 'louvin_expired'
    });
  }
  return { count: stale.length };
}
```

- [ ] **Step 2: Schedule it inside `startCronJobs`**

Cari function `startCronJobs(c)` (kira-kira di bawah file). Di dalam fungsi tersebut, tambah block schedule baru — pakai `trackedCron` wrapper yang sudah ada:

```js
cron.schedule('*/5 * * * *', trackedCron('expirePendingLouvinTransactions', async () => {
  return await expirePendingLouvinTransactions();
}));
console.log('✅ Cron: expirePendingLouvinTransactions every 5 min');
```

- [ ] **Step 3: Verify import is OK**

`Transaction` dan `Op` dan `emitEvent` sudah di-import di top file (cek baris awal `cronService.js`). Kalau belum (misal `Transaction` cuma di-require di scope lain), tambah ke top imports yang sudah ada.

- [ ] **Step 4: Smoke test boot**

```bash
npm start
```

Expected: log includes "✅ Cron: expirePendingLouvinTransactions every 5 min". `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/services/cronService.js
git commit -m "cron: expire pending Louvin transactions every 5 min"
```

---

## Task 14: Frontend — install qrcode.react

**Files:**
- Modify: `web-admin/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd web-admin
npm install qrcode.react@^3.1.0
```

Expected: package added without warnings.

- [ ] **Step 2: Verify import works**

```bash
node -e "console.log(require('./web-admin/node_modules/qrcode.react/package.json').version)"
```

Expected: prints version like `3.1.0`.

- [ ] **Step 3: Commit**

```bash
git add web-admin/package.json web-admin/package-lock.json
git commit -m "deps: add qrcode.react for shop checkout QR rendering"
```

---

## Task 15: Frontend API client — `api.shop.*` namespace

**Files:**
- Modify: `web-admin/src/api.js`

- [ ] **Step 1: Append shop namespace + helper**

Setelah block `export const api = {...}`, sebelum currency/date helpers:

```js
api.shop = {
  listProducts: () => api.get('/api/shop/products'),
  getProduct: (id) => api.get(`/api/shop/products/${id}`),
  checkout: (productId, paymentMethod) =>
    api.post('/api/shop/checkout', { productId, paymentMethod }),
  getTransaction: (orderId) =>
    api.get(`/api/shop/transactions/${orderId}`),
  recheckStatus: (orderId) =>
    api.post(`/api/shop/transactions/${orderId}/recheck`),
  myTransactions: ({ limit = 20, offset = 0 } = {}) =>
    api.get(`/api/shop/my-transactions?limit=${limit}&offset=${offset}`),
  pendingTransaction: () => api.get('/api/shop/pending')
};
```

- [ ] **Step 2: Add payment method label helper**

Di bawah `formatDate`:

```js
export const PAYMENT_METHOD_LABELS = {
  qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  bni_va: 'BNI Virtual Account',
  bri_va: 'BRI Virtual Account',
  permata_va: 'Permata Virtual Account',
  cimb_niaga_va: 'CIMB Niaga Virtual Account'
};

export function paymentMethodLabel(code) {
  return PAYMENT_METHOD_LABELS[code] || code;
}

/**
 * Estimate Louvin fee for a given amount + method.
 * QRIS / e-wallets: 0.7% + Rp 400.
 * VA: Rp 6.500 flat.
 */
export function estimateLouvinFee(amount, method) {
  if (!method) return 0;
  if (['qris', 'gopay', 'shopeepay'].includes(method)) {
    return Math.round(amount * 0.007) + 400;
  }
  if (['bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'].includes(method)) {
    return 6500;
  }
  return 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/api.js
git commit -m "api: add api.shop.* namespace + payment method labels/fee helpers"
```

---

## Task 16: Frontend — Update Layout sidebar for non-admin users

**Files:**
- Modify: `web-admin/src/components/Layout.jsx`

- [ ] **Step 1: Import ShoppingCart icon**

Di imports `lucide-react` (sekitar line 3-28):

```js
import {
  ...,
  ShoppingCart,
  History
} from 'lucide-react';
```

- [ ] **Step 2: Update `getNavSections` for non-admin**

Replace block `if (!isAdmin) { return [...] }` (sekitar line 44-55) dengan:

```js
function getNavSections({ isAdmin }) {
  if (!isAdmin) {
    return [
      {
        label: 'Akun Saya',
        items: [
          { to: '/shop', label: 'Shop', icon: ShoppingCart },
          { to: '/daftar-ib', label: 'Daftar IB', icon: IdCard },
          { to: '/my-purchases', label: 'Riwayat Pembelian', icon: History },
          { to: '/my-email', label: 'Email Saya', icon: Mail }
        ]
      }
    ];
  }
  // ... rest unchanged
```

- [ ] **Step 3: Verify build**

```bash
npm run build:web
```

Expected: build success, no TS/lint errors.

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/components/Layout.jsx
git commit -m "web: add Shop + Riwayat Pembelian to non-admin sidebar"
```

---

## Task 17: Frontend — Shop page

**Files:**
- Create: `web-admin/src/pages/Shop.jsx`
- Modify: `web-admin/src/App.jsx`

- [ ] **Step 1: Create Shop.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, AlertTriangle, Clock } from 'lucide-react';
import { api, formatIDR, ApiError, paymentMethodLabel } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import PaymentMethodPicker from '../components/PaymentMethodPicker.jsx';

function formatDuration(ms) {
  const n = Number(ms);
  const days = Math.floor(n / 86400000);
  const hours = Math.floor((n % 86400000) / 3600000);
  if (days) return hours ? `${days}h ${hours}j` : `${days} hari`;
  if (hours) return `${hours} jam`;
  return `${Math.floor(n / 60000)} menit`;
}

export default function Shop() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { product }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.shop.listProducts(), api.shop.pendingTransaction()])
      .then(([list, pend]) => {
        if (cancelled) return;
        setProducts(list.items || []);
        setPending(pend.pending || null);
      })
      .catch((err) => {
        if (cancelled) return;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop"
        description="Beli temporary role secara online dengan pembayaran otomatis."
        icon={ShoppingCart}
      />

      {pending && (
        <Card className="border-warning bg-warning/10">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="font-mono text-sm text-warning">
                <Clock className="inline h-4 w-4" /> PESANAN BELUM DIBAYAR
              </div>
              <div className="mt-1 text-fg">
                Order #{pending.orderId} — {pending.productName} —{' '}
                {formatIDR(pending.louvinTotalPayment || pending.amount)}
              </div>
              <div className="text-xs text-muted-fg">
                {paymentMethodLabel(pending.louvinPaymentType)} · expire{' '}
                {new Date(pending.louvinExpiredAt).toLocaleTimeString('id-ID')}
              </div>
            </div>
            <Button onClick={() => navigate(`/shop/checkout/${pending.orderId}`)}>
              Lanjutkan Bayar
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-6 text-muted-fg">Memuat produk...</Card>
      ) : products.length === 0 ? (
        <Card className="p-6 text-muted-fg">Belum ada produk tersedia.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="font-mono text-xs uppercase text-muted-fg">
                #{p.id}
              </div>
              <h3 className="mt-1 text-xl font-bold text-fg">{p.name}</h3>
              {p.description && (
                <p className="mt-2 text-sm text-muted-fg">{p.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="primary">{formatIDR(p.price)}</Badge>
                <Badge variant="secondary">Durasi: {formatDuration(p.duration)}</Badge>
                <Badge variant="outline">
                  {p.paymentMethods.length} metode
                </Badge>
              </div>
              <div className="mt-2 text-xs text-muted-fg">
                Metode:{' '}
                {p.paymentMethods.map(paymentMethodLabel).join(', ')}
              </div>
              <div className="mt-auto pt-4">
                <Button
                  className="w-full"
                  onClick={() => setPicker({ product: p })}
                >
                  Beli
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {picker && (
        <PaymentMethodPicker
          product={picker.product}
          onClose={() => setPicker(null)}
          onCheckout={async (method) => {
            try {
              const res = await api.shop.checkout(picker.product.id, method);
              setPicker(null);
              navigate(`/shop/checkout/${res.orderId}`);
            } catch (err) {
              if (err instanceof ApiError && err.code === 'not_in_guild') {
                toast.error('Kamu belum di Discord QTrades', {
                  description:
                    'Klik "Join Discord" untuk gabung dulu sebelum beli.'
                });
              } else if (err instanceof ApiError && err.code === 'louvin_disabled') {
                toast.error('Pembayaran online belum aktif', {
                  description: 'Hubungi admin untuk informasi.'
                });
              } else {
                toast.error('Gagal checkout', {
                  description: err instanceof ApiError ? err.message : ''
                });
              }
            }
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.jsx**

Edit `web-admin/src/App.jsx`. Tambah import:

```jsx
import Shop from './pages/Shop.jsx';
```

Tambah route di section "User-accessible routes":

```jsx
<Route path="/shop" element={<UserShell><Shop /></UserShell>} />
```

- [ ] **Step 3: Build verify**

```bash
npm run build:web
```

Expected: build success.

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/pages/Shop.jsx web-admin/src/App.jsx
git commit -m "web: add /shop page with product grid and resume banner"
```

---

## Task 18: Frontend — PaymentMethodPicker modal

**Files:**
- Create: `web-admin/src/components/PaymentMethodPicker.jsx`

- [ ] **Step 1: Create component**

```jsx
import { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import { formatIDR, paymentMethodLabel, estimateLouvinFee } from '../api.js';

export default function PaymentMethodPicker({ product, onClose, onCheckout }) {
  const [method, setMethod] = useState(product.paymentMethods[0] || 'qris');
  const [busy, setBusy] = useState(false);

  const fee = estimateLouvinFee(product.price, method);
  const total = product.price + fee;

  return (
    <Modal open={true} onClose={onClose}>
      <ModalHeader title={`Beli: ${product.name}`} onClose={onClose} />
      <ModalBody>
        <div className="space-y-1 font-mono text-sm">
          <div className="flex justify-between">
            <span>Harga produk</span>
            <span>{formatIDR(product.price)}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="font-mono text-xs uppercase text-muted-fg">
            Pilih metode pembayaran
          </div>
          <div className="mt-2 space-y-1">
            {product.paymentMethods.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-3 border-2 border-fg p-3 hover:bg-surface-2"
              >
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                <div className="flex-1">
                  <div className="font-bold">{paymentMethodLabel(m)}</div>
                  <div className="text-xs text-muted-fg">
                    Fee: {formatIDR(estimateLouvinFee(product.price, m))}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t-2 border-fg pt-3 font-mono text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatIDR(product.price)}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee Louvin ({paymentMethodLabel(method)})</span>
            <span>{formatIDR(fee)}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-bold">
            <span>TOTAL BAYAR</span>
            <span>{formatIDR(total)}</span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onCheckout(method);
            } finally {
              setBusy(false);
            }
          }}
        >
          Bayar Sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}
```

- [ ] **Step 2: Build verify**

```bash
npm run build:web
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/components/PaymentMethodPicker.jsx
git commit -m "web: add PaymentMethodPicker modal with fee breakdown"
```

---

## Task 19: Frontend — Checkout page

**Files:**
- Create: `web-admin/src/pages/Checkout.jsx`
- Modify: `web-admin/src/App.jsx`

- [ ] **Step 1: Create Checkout.jsx**

```jsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle2, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { api, formatIDR, ApiError, paymentMethodLabel } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtimeEvent } from '../lib/realtime.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const POLL_INTERVAL_MS = 5000;
const FINAL_STATUSES = ['approved', 'rejected', 'expired', 'cancelled'];

function isQrMethod(method) {
  return ['qris', 'gopay'].includes(method);
}

function isVaMethod(method) {
  return ['bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'].includes(method);
}

function Countdown({ expiresAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span className="text-danger">EXPIRED</span>;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export default function Checkout() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [trx, setTrx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const pollRef = useRef(null);

  async function fetchStatus() {
    try {
      const data = await api.shop.getTransaction(orderId);
      setTrx(data);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.error('Transaksi tidak ditemukan');
        navigate('/shop');
      }
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchStatus().finally(() => {
      if (!cancelled) setLoading(false);
    });

    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data && FINAL_STATUSES.includes(data.status)) {
        clearInterval(pollRef.current);
        if (data.status === 'approved') {
          toast.success('Pembayaran berhasil!', {
            description: 'Role telah diberikan ke akun Discord kamu.'
          });
          setTimeout(() => navigate(`/my-purchases?highlight=${orderId}`), 2000);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  // SSE: instant update on transaction.approved
  useRealtimeEvent('transaction.approved', (data) => {
    if (data?.orderId === orderId) {
      fetchStatus();
    }
  });

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

  if (loading || !trx) {
    return <Card className="p-6 text-muted-fg">Memuat...</Card>;
  }

  const isLouvin = trx.paymentChannel === 'louvin';
  const showQR = isLouvin && isQrMethod(trx.louvinPaymentType) && trx.louvinPaymentNumber;
  const showVA = isLouvin && isVaMethod(trx.louvinPaymentType);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checkout"
        description={`Order #${trx.orderId}`}
        actions={
          <Link to="/shop">
            <Button variant="secondary" leadingIcon={ArrowLeft}>
              Kembali ke Shop
            </Button>
          </Link>
        }
      />

      {/* Confirmation panel */}
      <Card className="p-4">
        <div className="font-mono text-xs uppercase text-muted-fg">Detail</div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-fg">Produk</div>
            <div className="font-bold">{trx.productName}</div>
          </div>
          <div>
            <div className="text-muted-fg">Discord</div>
            <div className="font-bold">@{user?.username}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-fg">
          Role akan otomatis diberikan ke akun Discord kamu setelah pembayaran disetujui.
        </div>
      </Card>

      {/* Payment breakdown */}
      <Card className="p-4">
        <div className="font-mono text-xs uppercase text-muted-fg">Rincian Bayar</div>
        <div className="mt-2 space-y-1 font-mono text-sm">
          <div className="flex justify-between">
            <span>Harga produk</span>
            <span>{formatIDR(trx.amount)}</span>
          </div>
          {trx.louvinFee != null && (
            <div className="flex justify-between">
              <span>Fee Louvin ({paymentMethodLabel(trx.louvinPaymentType)})</span>
              <span>{formatIDR(trx.louvinFee)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t-2 border-fg pt-2 text-base font-bold">
            <span>TOTAL</span>
            <span>{formatIDR(trx.louvinTotalPayment || trx.amount)}</span>
          </div>
        </div>
      </Card>

      {/* Payment instructions */}
      {trx.status === 'pending' && (
        <Card className="p-4">
          <div className="font-mono text-xs uppercase text-muted-fg">Cara Bayar</div>
          {showQR && (
            <div className="mt-3 flex flex-col items-center">
              <div className="border-4 border-fg bg-white p-4">
                <QRCodeSVG value={trx.louvinPaymentNumber} size={256} level="M" />
              </div>
              <div className="mt-2 text-sm text-muted-fg">
                Scan QR dengan e-wallet (GoPay, OVO, Dana, ShopeePay, dll)
              </div>
            </div>
          )}
          {showVA && (
            <div className="mt-3 space-y-2 font-mono">
              <div>
                <span className="text-muted-fg">Bank:</span>{' '}
                <span className="font-bold">
                  {trx.louvinPaymentType.replace('_va', '').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-fg">VA:</span>
                <span className="text-2xl font-bold tracking-widest">
                  {trx.louvinPaymentNumber}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={Copy}
                  onClick={() => {
                    navigator.clipboard.writeText(trx.louvinPaymentNumber);
                    toast.success('Nomor VA disalin');
                  }}
                >
                  Copy
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-fg">Total:</span>
                <span className="font-bold">{formatIDR(trx.louvinTotalPayment)}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={Copy}
                  onClick={() => {
                    navigator.clipboard.writeText(String(trx.louvinTotalPayment));
                    toast.success('Total disalin');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Status panel */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase text-muted-fg">Status</div>
            <div className="mt-1">
              {trx.status === 'pending' && (
                <Badge variant="warning">⏳ Menunggu Pembayaran</Badge>
              )}
              {trx.status === 'approved' && (
                <Badge variant="success">
                  <CheckCircle2 className="inline h-3 w-3" /> APPROVED
                </Badge>
              )}
              {trx.status === 'expired' && (
                <Badge variant="danger">
                  <XCircle className="inline h-3 w-3" /> EXPIRED
                </Badge>
              )}
              {(trx.status === 'rejected' || trx.status === 'cancelled') && (
                <Badge variant="danger">{trx.status.toUpperCase()}</Badge>
              )}
            </div>
            {trx.status === 'pending' && trx.louvinExpiredAt && (
              <div className="mt-2 text-xs text-muted-fg">
                Expire dalam <Countdown expiresAt={trx.louvinExpiredAt} />
              </div>
            )}
          </div>
          {trx.status === 'pending' && (
            <Button
              variant="secondary"
              loading={recheckBusy}
              leadingIcon={RefreshCw}
              onClick={handleRecheck}
            >
              Cek Status
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.jsx**

```jsx
import Checkout from './pages/Checkout.jsx';
```

```jsx
<Route path="/shop/checkout/:orderId" element={<UserShell><Checkout /></UserShell>} />
```

- [ ] **Step 3: Build verify**

```bash
npm run build:web
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/pages/Checkout.jsx web-admin/src/App.jsx
git commit -m "web: add /shop/checkout/:orderId page (QR/VA + polling + SSE)"
```

---

## Task 20: Frontend — MyPurchases page

**Files:**
- Create: `web-admin/src/pages/MyPurchases.jsx`
- Modify: `web-admin/src/App.jsx`

- [ ] **Step 1: Create MyPurchases.jsx**

```jsx
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

const STATUS_VARIANTS = {
  pending: 'warning',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  expired: 'danger',
  cancelled: 'secondary'
};

export default function MyPurchases() {
  const { toast } = useToast();
  const [search] = useSearchParams();
  const highlight = search.get('highlight');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.shop
      .myTransactions({ limit: 50 })
      .then((res) => setItems(res.items || []))
      .catch((err) =>
        toast.error('Gagal memuat riwayat', {
          description: err instanceof ApiError ? err.message : ''
        })
      )
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Pembelian"
        description="Semua transaksi kamu, termasuk dari Discord shop dan web shop."
        icon={History}
        actions={
          <Link to="/shop">
            <Button leadingIcon={ShoppingCart}>Beli Lagi</Button>
          </Link>
        }
      />

      {loading ? (
        <Card className="p-6 text-muted-fg">Memuat...</Card>
      ) : items.length === 0 ? (
        <Card className="p-6 text-muted-fg">Belum ada transaksi.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <Card
              key={t.orderId}
              className={
                highlight === t.orderId
                  ? 'border-success bg-success/10 p-4'
                  : 'p-4'
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-mono text-xs uppercase text-muted-fg">
                    Order #{t.orderId}
                  </div>
                  <div className="mt-1 text-base font-bold">{t.productName || '-'}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      {t.paymentChannel === 'louvin'
                        ? `WEB · ${paymentMethodLabel(t.louvinPaymentType)}`
                        : 'DISCORD · TRANSFER MANUAL'}
                    </Badge>
                    <span className="text-muted-fg">{formatDateTime(t.createdAt)}</span>
                  </div>
                  {t.rejectionReason && (
                    <div className="mt-2 text-xs text-danger">
                      Alasan: {t.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant={STATUS_VARIANTS[t.status] || 'secondary'}>
                    {t.status.toUpperCase()}
                  </Badge>
                  <div className="mt-1 font-mono text-sm">
                    {formatIDR(t.louvinTotalPayment || t.amount)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.jsx**

```jsx
import MyPurchases from './pages/MyPurchases.jsx';
```

```jsx
<Route path="/my-purchases" element={<UserShell><MyPurchases /></UserShell>} />
```

- [ ] **Step 3: Build verify**

```bash
npm run build:web
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/pages/MyPurchases.jsx web-admin/src/App.jsx
git commit -m "web: add /my-purchases page (combined manual_bank + louvin history)"
```

---

## Task 21: Admin Products page — paymentMethods multi-checkbox

**Files:**
- Modify: `web-admin/src/pages/Products.jsx`

- [ ] **Step 1: Add helper at top of file**

```jsx
const ALL_METHODS = [
  { value: 'qris', label: 'QRIS', fee: '0.7% + Rp 400' },
  { value: 'gopay', label: 'GoPay', fee: '0.7% + Rp 400' },
  { value: 'shopeepay', label: 'ShopeePay', fee: '0.7% + Rp 400' },
  { value: 'bni_va', label: 'BNI VA', fee: 'Rp 6.500' },
  { value: 'bri_va', label: 'BRI VA', fee: 'Rp 6.500' },
  { value: 'permata_va', label: 'Permata VA', fee: 'Rp 6.500' },
  { value: 'cimb_niaga_va', label: 'CIMB Niaga VA', fee: 'Rp 6.500' }
];
```

- [ ] **Step 2: Add `paymentMethods` to form state**

Cari useState untuk form (kira-kira `editing`, `creating`). Pastikan default `paymentMethods: ['qris']`. Misal di handler create modal:

```jsx
// Saat init create form
const [form, setForm] = useState({
  name: '',
  // ... existing fields
  paymentMethods: ['qris']
});
```

Saat load existing untuk edit:

```jsx
setForm({
  name: editing.name,
  // ... existing
  paymentMethods: Array.isArray(editing.paymentMethods)
    ? editing.paymentMethods
    : ['qris']
});
```

- [ ] **Step 3: Add multi-checkbox UI to form**

Di create/edit modal body, setelah field price/duration, tambah:

```jsx
<FormField label="Metode Pembayaran (Web Shop)">
  <div className="space-y-1">
    {ALL_METHODS.map((m) => {
      const checked = form.paymentMethods.includes(m.value);
      return (
        <label
          key={m.value}
          className="flex cursor-pointer items-center gap-3 border-2 border-fg p-2 hover:bg-surface-2"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              const next = new Set(form.paymentMethods);
              if (e.target.checked) next.add(m.value);
              else next.delete(m.value);
              setForm({ ...form, paymentMethods: Array.from(next) });
            }}
          />
          <div className="flex-1">
            <div className="font-bold">{m.label}</div>
            <div className="text-xs text-muted-fg">Fee {m.fee}</div>
          </div>
        </label>
      );
    })}
    {form.paymentMethods.length === 0 && (
      <div className="text-xs text-danger">
        Minimal 1 metode dipilih
      </div>
    )}
  </div>
</FormField>
```

- [ ] **Step 4: Send paymentMethods on submit**

Cari handler submit (`api.post('/api/products', ...)` atau `api.patch`). Tambah `paymentMethods: form.paymentMethods` ke body. Validasi sebelum submit:

```jsx
if (form.paymentMethods.length === 0) {
  toast.error('Pilih minimal 1 metode pembayaran');
  return;
}
```

- [ ] **Step 5: Show paymentMethods in product table**

Cari tabel listing. Tambah kolom baru:

```jsx
<TH>Metode</TH>
```

Di body row:

```jsx
<TD className="text-xs">
  {(p.paymentMethods || ['qris']).map((m) => paymentMethodLabel(m)).join(', ')}
</TD>
```

(import `paymentMethodLabel` dari `../api.js`)

- [ ] **Step 6: Build verify**

```bash
npm run build:web
```

- [ ] **Step 7: Commit**

```bash
git add web-admin/src/pages/Products.jsx
git commit -m "web: admin Products form supports paymentMethods multi-checkbox"
```

---

## Task 22: End-to-end smoke test

**Files:** none (manual)

- [ ] **Step 1: Setup test env**

Edit `.env`:
```env
LOUVIN_ENABLED=false
LOUVIN_API_KEY=lv_dummy
LOUVIN_WEBHOOK_TOKEN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
DISCORD_INVITE_URL=https://discord.gg/test
```

(LOUVIN_ENABLED=false dulu — checkout endpoint akan return 503, pure UI flow yang dites)

- [ ] **Step 2: Start bot**

```bash
npm start
```

Wait for `🌐 Admin web server listening on port 3000` + `✅ Bot is ready!`.

- [ ] **Step 3: Test as non-admin user**

Login dashboard via Discord OAuth as user yang **bukan admin** (atau impersonate dengan menghapus row di `admin_roles`).

- [ ] **Step 4: Verify navigation**

Sidebar shows: Shop, Daftar IB, Riwayat Pembelian, Email Saya. Klik **Shop**.

- [ ] **Step 5: Browse Shop**

`/shop` — produk muncul dengan badges. Klik **Beli** pada produk.

- [ ] **Step 6: Open PaymentMethodPicker**

Modal muncul dengan radio button per metode dan total breakdown. Klik **Bayar Sekarang**.

- [ ] **Step 7: Verify 503 error toast**

Karena LOUVIN_ENABLED=false, toast "Pembayaran online belum aktif" muncul. Modal close.

- [ ] **Step 8: Enable Louvin (real test)**

Edit `.env`:
```env
LOUVIN_ENABLED=true
LOUVIN_API_KEY=lv_<your real test key>
LOUVIN_WEBHOOK_TOKEN=<keep token from step 1>
```

Set webhook URL di Louvin Dashboard:
`http://localhost:3000/api/webhooks/louvin/<TOKEN>` (untuk dev pakai ngrok atau cloudflared kalau perlu external reachable, atau gunakan production URL)

Restart bot.

- [ ] **Step 9: Buy real product (Rp 1.500 minimum QRIS)**

Bikin produk test seharga 1500 IDR via admin /products. Pilih method QRIS. Beli sebagai user.

- [ ] **Step 10: Verify checkout page**

QR code muncul. Countdown jalan. Status badge "MENUNGGU PEMBAYARAN".

- [ ] **Step 11: Pay**

Scan QR via e-wallet, bayar Rp 1.500 + fee Rp 411 = Rp 1.911.

- [ ] **Step 12: Verify webhook + role grant**

- Polling/SSE detect status change ke `approved`
- Toast "Pembayaran berhasil!"
- Redirect ke `/my-purchases?highlight=...`
- Cek Discord — role granted, DM masuk
- Cek admin `/transactions` — transaksi muncul dengan badge LOUVIN

- [ ] **Step 13: Verify Sheets sync**

Buka Google Sheet — Active Users + Transaction History terupdate.

- [ ] **Step 14: Test idempotency (manual)**

Manual trigger webhook lagi dengan curl:

```bash
curl -X POST http://localhost:3000/api/webhooks/louvin/<TOKEN> \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.settled","data":{"transaction_id":"<louvin-id>"}}'
```

Expected: 200 `{"received":true,"idempotent":true}`. Tidak duplicate role grant.

- [ ] **Step 15: Test webhook with bad token**

```bash
curl -X POST http://localhost:3000/api/webhooks/louvin/wrong-token \
  -H "Content-Type: application/json" -d '{}'
```

Expected: 404 `{"error":"not_found"}`.

- [ ] **Step 16: Test cron expire**

Bikin transaksi baru, jangan bayar. Tunggu sampai `louvin_expired_at` lewat (atau manually update DB):

```sql
UPDATE transactions SET louvin_expired_at = NOW() - INTERVAL '1 hour'
WHERE order_id = 'qta-xxx';
```

Tunggu sampai 5 menit (atau force trigger cron). Cek status di DB → harus `expired`.

- [ ] **Step 17: Mark complete**

Kalau semua step lulus, smoke test passed. Lanjut docs update.

---

## Task 23: Documentation — README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add feature section**

Cari section `### ✅ Database Backup & Restore`. Setelah block itu, tambah:

```markdown
### ✅ Web Shop & Louvin Payment Gateway
- Page `/shop` di dashboard untuk user non-admin (login via Discord OAuth)
- Beli temporary role online dengan pembayaran otomatis via [Louvin](https://louvin.dev)
- Support 7 metode pembayaran (QRIS, GoPay, ShopeePay, BNI/BRI/Permata/CIMB VA), admin pilih per produk
- Verifikasi guild membership real-time saat checkout
- Auto-grant role setelah webhook settled (no admin intervention)
- Cron auto-expire transaksi pending stale tiap 5 menit
- Page `/my-purchases` untuk riwayat user (gabungan Discord manual + web Louvin)
- Coexist dengan Discord manual bank transfer (existing) — keduanya jalan paralel
```

- [ ] **Step 2: Update Commands section**

Cari section `### 👤 User Commands`. Setelah baris `/my-email`, tambah note:

```markdown
> **Catatan Shop:** User non-admin login dashboard → sidebar dapat menu Shop. Beli role online via Louvin Payment Gateway, role otomatis di-grant tanpa admin approval.
```

- [ ] **Step 3: Add Louvin env vars to env section**

Cari section `## Environment Variables` → `**Optional:**`. Tambah:

```markdown
- `LOUVIN_ENABLED` - `true` untuk aktifkan web shop Louvin
- `LOUVIN_API_KEY` - API key dari [louvin.dev](https://louvin.dev) Dashboard
- `LOUVIN_WEBHOOK_TOKEN` - Random hex token untuk webhook path verification
- `LOUVIN_DEFAULT_DESCRIPTION` - Deskripsi default di Louvin transaction
- `DISCORD_INVITE_URL` - Invite link untuk user yang belum di guild
```

- [ ] **Step 4: Update Workflow section — add Web Purchase Flow**

Cari section `### IB Registration Flow`. Sebelum `### Auto-Sync & Monitoring`, tambah:

```markdown
### Web Purchase Flow (Louvin)
1. User non-admin login dashboard → sidebar Shop
2. Pilih produk → modal pilih metode pembayaran (QRIS/VA/dll)
3. Klik Bayar → backend verify guild membership fresh
4. Bot create transaction (paymentChannel=louvin) + call Louvin API
5. Frontend tampilkan QR code / nomor VA + countdown expiry
6. User bayar via e-wallet/bank
7. Louvin webhook fires → bot verify ke `/check-status` (defense in depth)
8. Status `settled` → `transactionService.approveTransaction()` grant role + DM + sheets sync
9. SSE event ke FE → redirect ke `/my-purchases` dengan toast success
```

- [ ] **Step 5: Update Auto-Sync section**

Cari `### Auto-Sync & Monitoring`. Tambah:

```markdown
- **Every 5 minutes:** Expire pending Louvin transactions yang lewat `louvin_expired_at`
```

- [ ] **Step 6: Update Troubleshooting section**

Sebelum `### Database error` di Troubleshooting, tambah:

```markdown
### Webhook Louvin tidak fire
- Cek webhook URL di Louvin Dashboard sesuai `${DASHBOARD_BASE_URL}/api/webhooks/louvin/<TOKEN>`
- Cek `LOUVIN_WEBHOOK_TOKEN` di `.env` match dengan token di URL
- Test manual: `curl -X POST <url> -H "Content-Type: application/json" -d '{}'` → harus 400 invalid_payload (bukan 404)
- Cek pm2 logs untuk `Webhook for unknown` atau `Webhook verify failed`

### Pembayaran sukses tapi role tidak granted
- Cek `LOUVIN_ENABLED=true` di `.env`
- Cek user masih di guild Discord
- Cek bot online (cek `/api/health`)
- Cek `/transactions` di admin dashboard → kalau status pending tapi sudah lewat expire, manual approve
- Cek log untuk `approveTransaction failed`

### Checkout error 403 not_in_guild
- User belum join Discord QTrades
- Set `DISCORD_INVITE_URL` di `.env` agar tombol Join Discord muncul di shop
```

- [ ] **Step 7: Update Project Structure section**

Cari block `src/services/`. Tambah:
```markdown
│   │   ├── louvinService.js          # Louvin payment gateway API client (NEW)
```

Cari block `src/web/routes/`. Tambah:
```markdown
│   │                                 # webhooks (NEW: Louvin webhook)
│   │                                 # shop (NEW: user-facing shop API)
```

Cari block `web-admin/src/pages/`. Tambah ke list:
```markdown
│   │   │                             # Shop, Checkout, MyPurchases (NEW)
```

- [ ] **Step 8: Update Tech Stack section**

Cari frontend section. Tambah:
```markdown
- **qrcode.react** — Render QR code untuk QRIS / GoPay payment
```

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs: add Web Shop + Louvin sections to README"
```

---

## Task 24: Documentation — deploy/README.md

**Files:**
- Modify: `deploy/README.md`

- [ ] **Step 1: Add Louvin setup section**

Setelah section "Database backups". Tambah:

```markdown
## 9. Louvin Payment Gateway setup (web shop)

The dashboard at `/shop` lets non-admin users buy temporary roles via
[Louvin Payment Gateway](https://louvin.dev). Setup is one-time, takes
~5 minutes.

### One-time setup

1. **Create a Louvin project**
   - Sign up at [louvin.dev](https://louvin.dev)
   - Dashboard → **Proyek** → **Buat Proyek**
   - Copy the API key (starts with `lv_`) → `.env` as `LOUVIN_API_KEY`

2. **Generate webhook token**
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
   Set in `.env` as `LOUVIN_WEBHOOK_TOKEN`.

3. **Register webhook URL in Louvin**
   - Dashboard → **Proyek** → **Detail Proyek** → **Webhook URL**
   - Set to: `https://your-domain.com/api/webhooks/louvin/<TOKEN>`
     where `<TOKEN>` is your `LOUVIN_WEBHOOK_TOKEN` value.

4. **Configure invite link & description**
   ```env
   DISCORD_INVITE_URL=https://discord.gg/your-server
   LOUVIN_DEFAULT_DESCRIPTION=Pembelian role QTrades
   ```

5. **Enable & restart**
   ```env
   LOUVIN_ENABLED=true
   ```
   Then `pm2 restart qtassist`.

### Configure products

In the admin dashboard `/products`, edit each product to enable the
desired payment methods (multi-checkbox). Default: QRIS only.

### Test flow

1. Login dashboard as a non-admin Discord user
2. Sidebar → **Shop** → pick a product
3. Pay via QRIS / VA
4. Webhook fires → role auto-granted
5. Verify in `/transactions` admin page (badge **LOUVIN**)

### Troubleshooting

- **Webhook not firing:** check Louvin Dashboard webhook log. Common
  causes: nginx blocking POST, mismatched `LOUVIN_WEBHOOK_TOKEN`, or
  webhook URL has wrong host.
- **`storageQuotaExceeded`-like errors:** Louvin doesn't have storage,
  this is unrelated. Drive backup is separate.
- **Refunds:** Louvin has no refund API. Refund manually via admin
  `/transactions` (mark cancelled), then return funds out-of-band.
```

- [ ] **Step 2: Update routine ops table**

Cari section `## 6. Routine operations`. Tambah row:

```markdown
| Test webhook | `curl -X POST https://your-domain.com/api/webhooks/louvin/<token> -H "Content-Type: application/json" -d '{"event":"test","data":{"transaction_id":"x"}}'` → expect 502 (verify_failed) |
```

- [ ] **Step 3: Update hardening checklist**

Cari section `## 7. Hardening checklist`. Tambah:

```markdown
- [ ] `LOUVIN_WEBHOOK_TOKEN` is at least 32 random bytes hex (16 bytes from crypto.randomBytes)
- [ ] Webhook URL in Louvin Dashboard exactly matches `LOUVIN_WEBHOOK_TOKEN` value
- [ ] `LOUVIN_ENABLED=false` until first end-to-end test passes
```

- [ ] **Step 4: Commit**

```bash
git add deploy/README.md
git commit -m "docs: add Louvin Payment Gateway deployment section"
```

---

## Task 25: Documentation — PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Add to Shipped Features**

Cari section `## Shipped Features (Cumulative)`. Tambah block baru sebelum `### ✅ IB Valetax Integration`:

```markdown
### ✅ Web Shop & Louvin Payment Gateway
**Status:** Live since 2026-05-17

- Page `/shop` untuk user non-admin (Discord OAuth session)
- 7 metode pembayaran via Louvin (QRIS, GoPay, ShopeePay, BNI/BRI/Permata/CIMB VA)
- Admin configurable payment methods per product (JSONB array)
- Webhook handler dengan path token + verify ke Louvin (defense in depth)
- Reuse `transactionService.approveTransaction()` untuk role grant
- Cron auto-expire pending transactions tiap 5 menit
- Page `/my-purchases` gabung manual_bank + louvin history
- Coexist dengan Discord manual bank transfer (existing)
- Feature flag `LOUVIN_ENABLED=false` default — safe rollout
```

- [ ] **Step 2: Add to Recent Major Changes**

Cari table `Recent Major Changes`. Tambah row paling atas:

```markdown
| 2026-05-17 | Web shop with Louvin payment gateway shipped (page /shop, /my-purchases, webhook handler) |
```

- [ ] **Step 3: Update header date**

```markdown
**Last Updated:** 2026-05-17 (web shop + Louvin)
```

- [ ] **Step 4: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: mark web shop + Louvin as shipped in PROGRESS"
```

---

## Task 26: Documentation — QUICK-START.md

**Files:**
- Modify: `QUICK-START.md`

- [ ] **Step 1: Add to "For End Users" section**

Cari section `### Beli Produk` (atau ekuivalen). Tambah subsection sebelum daftar IB:

```markdown
### Beli Produk via Web Shop (Louvin)
1. Login dashboard via Discord OAuth
2. Sidebar → **Shop**
3. Pilih produk → klik **Beli**
4. Pilih metode pembayaran (QRIS/GoPay/VA/dll)
5. Bayar via e-wallet atau transfer ke nomor VA
6. Role otomatis di-grant ke akun Discord kamu
7. Cek status di **Riwayat Pembelian**

> **Note:** Discord shop dengan transfer manual masih jalan paralel di
> shop channel Discord. Pilih sesuai preferensi.
```

- [ ] **Step 2: Add to "For Admins" section**

Cari section `**Setup:**`. Tambah note di bawahnya:

```markdown
> **Web Shop Configuration:** Setiap produk punya `paymentMethods` array.
> Edit produk di `/products` → centang metode yang mau di-enable. Minimum
> 1 metode wajib dipilih. Default saat create: QRIS only.
```

- [ ] **Step 3: Add Louvin env vars**

Cari section `## Optional Env Vars`. Tambah:

```markdown
- `LOUVIN_ENABLED`, `LOUVIN_API_KEY`, `LOUVIN_WEBHOOK_TOKEN`,
  `LOUVIN_DEFAULT_DESCRIPTION` — Web shop Louvin payment gateway
- `DISCORD_INVITE_URL` — Invite link untuk user yang belum di guild
```

- [ ] **Step 4: Update header date**

```markdown
**Last Updated:** 2026-05-17
```

- [ ] **Step 5: Commit**

```bash
git add QUICK-START.md
git commit -m "docs: add web shop + Louvin section to QUICK-START"
```

---

## Task 27: Documentation — TODO.md

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Add follow-up section**

Tambah di akhir file:

```markdown
## Web Shop / Louvin: Follow-ups

**Status:** Phase 1 shipped (one-off purchase, 7 methods, manual + Louvin coexist).

### Nice-to-have future enhancements:

- [ ] Subscription / recurring payment via Louvin Subscription API
      (saat ini cuma QRIS via email reminder, ga seamless dengan flow kita)
- [ ] Refund flow di admin dashboard — mark cancelled + log + admin
      manual return funds (Louvin tidak punya refund API)
- [ ] Sandbox / mock mode Louvin untuk dev tanpa bayar real
      (`LOUVIN_DEV_MOCK=true` → bypass real API, fake settled events)
- [ ] HMAC signature verification kalau Louvin tambah feature itu
      (saat ini cuma path token + check-status verify)
- [ ] "Beli untuk teman" — input Discord ID lain saat checkout
- [ ] Multi-guild support — per-guild Louvin API key + project
- [ ] Payment method usage analytics di dashboard (which method paling
      sering dipakai user)
- [ ] Channel breakdown di Google Sheets sync (manual_bank vs louvin)
- [ ] Encryption at rest untuk QR string / VA number kalau ada compliance
      requirement (saat ini low-risk: short-lived + public-by-design)
```

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: add web shop / Louvin follow-ups to TODO"
```

---

## Self-Review Checklist

Setelah eksekusi semua task, run:

- [ ] All migrations idempotent (run twice tanpa error)
- [ ] Existing manual bank transfer flow ga break (test di Discord shop)
- [ ] Sheets sync jalan untuk both channels
- [ ] Admin `/transactions` page tampilin transaksi Louvin (cek payment_channel column visible / badge)
- [ ] No console errors di FE saat browse `/shop`, `/my-purchases`
- [ ] `/my-purchases` show transaksi dari kedua channel
- [ ] `LOUVIN_ENABLED=false` block checkout dengan error message yang baik
- [ ] User non-admin tidak bisa akses admin pages, tapi bisa akses `/shop`, `/my-purchases`
- [ ] User admin bisa akses `/shop` juga (untuk testing)
- [ ] Webhook reject 404 untuk wrong token
- [ ] Webhook idempotent untuk replay event

## Final Commit Summary

After all tasks complete, total commits:
1. db: payment_methods column
2. model: Product.paymentMethods
3. db: Louvin columns on transactions
4. model: Transaction Louvin fields
5. service: Louvin API wrapper
6. env: LOUVIN_* placeholders
7. route: shop products + pending
8. route: shop checkout
9. route: shop status, recheck, my-transactions
10. route: webhooks Louvin handler
11. server: mount shop + webhooks
12. route: products admin paymentMethods + cache invalidation
13. cron: expire pending Louvin transactions
14. deps: qrcode.react
15. api: shop namespace + helpers
16. web: Layout sidebar non-admin
17. web: /shop page
18. web: PaymentMethodPicker
19. web: /shop/checkout/:orderId
20. web: /my-purchases
21. web: admin Products multi-checkbox
22. (manual smoke test, no commit)
23. docs: README
24. docs: deploy/README
25. docs: PROGRESS
26. docs: QUICK-START
27. docs: TODO

**Total: 26 commits.**

