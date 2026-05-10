# Migration Guide: Manual Payment Approval System

## Overview

Project QTAssist5251 telah diubah dari sistem **Midtrans Payment Gateway (QRIS)** menjadi sistem **Manual Bank Transfer dengan Admin Approval**.

## Perubahan Utama

### 1. Flow Pembayaran Baru

**Sebelum (Midtrans QRIS):**
1. User klik button product
2. Bot generate QRIS code
3. User scan & bayar
4. Webhook otomatis assign role

**Sekarang (Manual Transfer):**
1. User klik button product
2. Bot tampilkan nomor rekening bank
3. User transfer & upload bukti bayar
4. Admin review & approve/reject
5. Bot assign role setelah approved

### 2. Database Schema Changes

**Kolom Baru di `transactions` table:**
- `payment_proof_url` - URL bukti transfer dari Discord
- `reviewed_by` - User ID admin yang review
- `reviewed_at` - Waktu review
- `rejection_reason` - Alasan reject (opsional)

**Status Baru:**
- `pending` - User belum bayar
- `pending_review` - Menunggu admin approval
- `approved` - Payment approved, role assigned
- `rejected` - Payment ditolak
- `expired` - Payment expired
- `cancelled` - Dibatalkan user

**Kolom Lama (tetap ada untuk backward compatibility):**
- `payment_url`
- `payment_type`
- `midtrans_data`

### 3. Environment Variables

**Dihapus:**
```env
MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY
MIDTRANS_IS_PRODUCTION
WEBHOOK_PORT
```

**Ditambah:**
```env
PAYMENT_REVIEW_CHANNEL_ID=<channel_id_untuk_review>
BANK_NAME=BCA
ACCOUNT_NUMBER=1234567890
ACCOUNT_HOLDER=QTrades Official
```

### 4. Kode yang Diubah

**File yang dimodifikasi:**
- `src/database/models/Transaction.js` - Update model schema
- `src/events/interactionCreateButton.js` - Complete rewrite untuk manual flow
- `src/commands/product/shop-setup.js` - Update instruksi
- `src/index.js` - Hapus webhook server
- `.env.example` - Update config

**File yang tidak digunakan lagi:**
- `src/services/webhookServer.js` - ❌ Tidak digunakan
- `src/services/midtransService.js` - ❌ Tidak digunakan
- `src/events/refreshPaymentHandler.js` - ❌ Tidak digunakan

**Dependencies yang bisa dihapus (opsional):**
- `midtrans-client`
- `qrcode`
- `express`
- `body-parser`

## Cara Migrasi

### Step 1: Backup Database

```bash
# PostgreSQL backup
pg_dump -U postgres qtassist_bot > backup_before_migration.sql
```

### Step 2: Update Environment Variables

Edit file `.env`:

```env
# Hapus atau comment Midtrans config
# MIDTRANS_SERVER_KEY=...
# MIDTRANS_CLIENT_KEY=...
# MIDTRANS_IS_PRODUCTION=...
# WEBHOOK_PORT=...

# Tambah config bank transfer
PAYMENT_REVIEW_CHANNEL_ID=your_review_channel_id

# Opsi 1: Single Bank Account
BANK_NAME=BCA
ACCOUNT_NUMBER=1234567890
ACCOUNT_HOLDER=QTrades Official

# Opsi 2: Multiple Bank Accounts (pisahkan dengan | pipe)
BANK_NAMES=BCA|Mandiri|BRI
ACCOUNT_NUMBERS=1234567890|9876543210|5555666777
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup|QTrades Support

# Note: Jika pakai BANK_NAMES (multiple), variable BANK_NAME akan di-ignore
```

### Step 3: Run Migration Script

```bash
cd src/database/migrations
node update-transaction-manual-payment.js
```

Output yang diharapkan:
```
🔄 Starting migration: Update Transaction for Manual Payment...
➕ Adding new columns...
✅ New columns added successfully
🔄 Updating status ENUM...
✅ Status ENUM updated successfully
✅ Migration completed successfully!
```

### Step 4: Update Dependencies (Opsional)

Jika ingin hapus dependency Midtrans:

```bash
npm uninstall midtrans-client qrcode express body-parser
```

**Note:** Express dan body-parser mungkin digunakan fitur lain, pastikan cek dulu.

### Step 5: Restart Bot

```bash
npm run dev
# atau
npm start
```

## Testing Flow

### Test 1: User Purchase

1. Jalankan `/shop-setup #channel-shop`
2. Sebagai user biasa, klik button product
3. Cek apakah muncul:
   - Detail product
   - Nomor rekening bank
   - Button "Upload Payment Proof"

### Test 2: Upload Bukti Bayar

1. Klik button "Upload Payment Proof"
2. Modal akan muncul
3. Upload gambar ke Discord → Copy link → Paste di modal
4. Submit
5. Cek channel review apakah muncul notifikasi dengan:
   - Bukti transfer (image)
   - Button "Approve" dan "Reject"

### Test 3: Admin Approve

1. Sebagai admin, klik button "✅ Approve"
2. Role harus otomatis assign ke user
3. User dapat DM notification
4. Transaction status: `approved`
5. Button hilang dari message

### Test 4: Admin Reject

1. Klik button "❌ Reject"
2. Modal muncul untuk input alasan
3. Submit alasan
4. User dapat DM dengan alasan reject
5. Transaction status: `rejected`

## Troubleshooting

### Error: "Column already exists"

Jika migration error karena kolom sudah ada:

```sql
-- Check existing columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions';

-- Manual add if needed
ALTER TABLE transactions ADD COLUMN payment_proof_url TEXT;
ALTER TABLE transactions ADD COLUMN reviewed_by VARCHAR(255);
ALTER TABLE transactions ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN rejection_reason TEXT;
```

### Error: "ENUM type already exists"

```sql
-- Drop old enum
DROP TYPE IF EXISTS "enum_transactions_status";

-- Re-run migration script
```

### Channel Review Tidak Muncul Notifikasi

Pastikan:
1. `PAYMENT_REVIEW_CHANNEL_ID` sudah diisi di `.env`
2. Bot punya permission `Send Messages` dan `Embed Links` di channel
3. Channel ID benar (klik kanan channel → Copy ID, pastikan Developer Mode aktif)

## Rollback (Jika Diperlukan)

Jika ada masalah dan ingin rollback:

```bash
# Restore database
psql -U postgres qtassist_bot < backup_before_migration.sql

# Revert code
git checkout <commit-sebelum-migrasi>

# Restore .env
# (manual restore dari backup)
```

## Command Reference

**User Commands:**
- Klik button product di shop channel
- Klik "Upload Payment Proof" untuk upload bukti

**Admin Commands:**
- `/transaction-process <order_id>` - Manual process (masih ada, tapi tidak pakai Midtrans lagi)
- Klik "✅ Approve" atau "❌ Reject" di channel review

**Existing Commands (tidak berubah):**
- `/product-create` - Buat product baru
- `/product-delete` - Hapus product
- `/product-list` - List semua product
- `/shop-setup` - Setup shop channel

## Support

Jika ada masalah saat migrasi, cek:
1. Console log bot untuk error messages
2. PostgreSQL logs
3. Database schema: `\d transactions` di psql

## Changelog

**v2.0.0 - Manual Payment System**
- ✅ Removed Midtrans integration
- ✅ Added manual bank transfer flow
- ✅ Added admin approval system
- ✅ Added payment proof upload via modal
- ✅ Added approve/reject buttons for admin
- ✅ Updated database schema
- ✅ Removed webhook server
- ✅ Updated environment variables

---

**Last Updated:** 2026-05-10
