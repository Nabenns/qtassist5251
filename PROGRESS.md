# Development Progress - QTAssist Discord Bot

**Repository:** https://github.com/Nabenns/qtassist5251.git
**Last Updated:** 2026-05-17

> **Note:** Dokumen ini adalah ringkasan historis fitur yang sudah ship.
> Untuk task aktif & blocker, lihat [TODO.md](TODO.md). Untuk overview
> arsitektur & command, lihat [README.md](README.md).

---

## Project Overview

Discord bot + admin web dashboard untuk QTrades. Mengelola temporary
role berbayar (manual bank transfer), email entitlement bindings,
Google Sheets sync, Google Drive backup, dan Introducing Broker (IB)
Valetax integration.

### Tech Stack

- **Runtime:** Node.js 18+
- **Bot:** discord.js v14
- **Database:** PostgreSQL + Sequelize
- **Web API:** Express + helmet + JWT + Discord OAuth2
- **SPA:** React 18 + Vite + Tailwind (brutalist theme)
- **Integrations:** Google Sheets API, Google Drive API, Valetax API
- **Hosting:** VPS (pm2 + nginx + certbot)
- **Commands:** Slash commands only (no prefix)

### Key Constraints

- Single-server (single guild) deployment
- Slash commands only
- Unlimited duration & multiple roles per user untuk temprole
- Skip user yang sudah punya permanent role
- No grace period saat role expire

---

## Shipped Features (Cumulative)

### ✅ Core Temporary Role System
**Status:** Live since 2026-05-09

- Slash commands: `/temprole-add`, `/temprole-remove`, `/temprole-list`,
  `/temprole-extend`
- Auto-removal saat expire (cron tiap 1 menit, no grace period)
- Reminder DM 24 jam & 1 jam sebelum expire (cron tiap 5 menit)
- Notifikasi DM + mod channel saat granted/expired/extended
- Role hierarchy validation, skip permanent role
- Multiple roles per user
- Audit trail via `ModerationLog`
- Duration parser: `1m`, `1h`, `1d`, `1w`, kombinasi (`1d12h30m`)

### ✅ Manual Bank Transfer Payment
**Status:** Live since 2026-05-10 (replaced Midtrans QRIS)

- Tombol "Beli" di shop channel → tampilkan detail rekening
- Multiple bank accounts via `BANK_NAMES|ACCOUNT_NUMBERS|ACCOUNT_HOLDERS`
  pipe-separated
- Upload bukti transfer langsung di Discord (temporary upload channel)
- Forward ke admin review channel dengan tombol Approve/Reject
- Reject flow dengan modal alasan
- Status enum: `pending`, `pending_review`, `approved`, `rejected`,
  `expired`, `cancelled`
- Auto-grant role saat approved
- Auto-expire transaction lama (cron tiap 30 menit)

Lihat [CHANGELOG-MANUAL-PAYMENT.md](CHANGELOG-MANUAL-PAYMENT.md) untuk
detail migrasi dari Midtrans.

### ✅ Product & Shop Management
**Status:** Live

- `/product-create`, `/product-list`, `/product-delete`, `/shop-setup`
- Role-based product association
- Duration-based pricing
- Shop embed dengan tombol beli per produk

### ✅ Google Sheets Integration
**Status:** Live

4 sheet otomatis di-sync:

1. **Active Transactions** — pending / pending_review
2. **Transaction History** — approved / rejected dengan reviewer + alasan
3. **Active Users** — temprole aktif dengan days remaining + status indicator
4. **Analytics** — revenue, conversion rate, top products, pie chart

Auto-sync tiap 10 menit. Format tanggal Indonesia (WIB).

### ✅ Email Entitlement & Google Drive Auto-Share
**Status:** Live

- `/email-setup` — channel pendaftaran email
- `/email-list` — list email terdaftar (paginated)
- `/my-email` — user cek email yang di-bind
- `/drive-setup` — admin konfigurasi folder Drive untuk auto-share
- Email ↔ Discord user binding via tombol modal
- Auto-share Drive folder ke email user yang punya role tertentu
- Auto-revoke saat role expire
- Email-role mapping page di dashboard (`/email-roles`)

### ✅ Web Admin Dashboard
**Status:** Live (brutalist redesign 2026-05-16)

- React 18 + Vite SPA, Tailwind CSS dengan brutalist theme
  (Space Grotesk + JetBrains Mono, zero radius, step shadow)
- **Auth:** Discord OAuth2 (bukan username/password)
- **Admin gating:** role Discord di-cache di tabel `admin_roles`
  (bootstrap = ADMINISTRATOR permission saat tabel kosong)
- **Pages:** Dashboard, Transactions, Products, TempRoles, Emails,
  AuditLog, UserLookup, DiscordPost, BotStatus, Backups, IbSettings,
  IbAccounts, AdminRoles, EmailRoles, MyEmail, daftar-ib wizard
- **Realtime:** Server-Sent Events (`/api/events`) untuk update live
  saat ada transaksi/role change
- **Discord post composer:** admin posting message via dashboard,
  bot yang publish ke channel target

### ✅ Database Backup ke Google Drive
**Status:** Live, ⚠️ blocked di free Google account

- Cron harian 03:00 Asia/Jakarta → `pg_dump | gzip` → upload ke Drive folder
- Retention: 30 daily + 12 monthly (first-of-month)
- Manual backup/restore dari dashboard Tools → Backup Database
- Restore destructif (drop + recreate semua tabel), butuh konfirmasi
  ketik `RESTORE`
- Restore-from-upload: upload `.sql.gz` dari komputer

⚠️ **Blocker:** service account di project Cloud standar tidak punya
quota Drive → `storageQuotaExceeded`. Fix proper: pindah ke Google
Workspace **Shared Drive**. Detail di [TODO.md](TODO.md).

### ✅ IB Valetax Integration
**Status:** Live (Phase 2 wired ke API live, wizard dashboard 2026-05-17)

- **Wizard 3-step di dashboard** (`/daftar-ib`):
  1. **Step 1 Register:** user klik link affiliate, bot track `linkClickedAt`
  2. **Step 2 Deposit:** user konfirmasi sudah deposit, bot track `depositConfirmedAt`
  3. **Step 3 Submit:** user input nomor akun broker → bot verify ke Valetax
- **Verifikasi:** paginate `POST /api.user.partnership.report.by.client.v2.getRange`
  dengan window 1 tahun, match nomor akun, set verified + assign role IB
- **Daily volume tracking:** sample volume per akun verified, simpan ke
  `IbVolumeRecord`, evaluasi grant/revoke role
- **Auth:** `fx-token` di-paste manual dari dashboard (token expire ~1 jam,
  dashboard punya badge status hijau/merah)
- **Mode:** `VALETAX_MODE=live` (real API) atau kosong (mock)
- **Debug:** `VALETAX_DEBUG=true` untuk log full request/response
  (jangan aktifkan di production, log PII)

Sebelumnya pendaftaran IB pakai slash command `/ib-setup` + tombol
`ib_register` di Discord — sudah di-remove pada migrasi 2026-05-17.

### ✅ Other Slash Commands
- `/myinfo-setup` — channel "My Info" dengan tombol Cek Role &
  Riwayat Pembelian (replaces `/my-roles` & `/my-purchases`)
- `/role-claim-setup` — post tombol claim role (max 5 per message)
- `/transaction-process`, `/transaction-cancel` — manual override transaksi
- `/help` — list semua command

---

## Recent Major Changes

| Date | Change |
|---|---|
| 2026-05-17 | IB registration migrated dari Discord button ke wizard dashboard `/daftar-ib` |
| 2026-05-17 | TIMESTAMP→TIMESTAMPTZ drift detection + auto-upgrade |
| 2026-05-17 | `/ib-setup` slash command + `ib_register` button removed |
| 2026-05-16 | Brutalist UI redesign shipped |
| 2026-05-16 | Login pindah ke Discord OAuth (admin role di-cache) |
| 2026-05-15 | Database backup ke Google Drive (cron + dashboard manual) |
| 2026-05-14 | IB Valetax Phase 2: wired ke real API dengan `fx-token` |
| 2026-05-13 | IB Valetax Phase 1: mock mode + dashboard pages |
| 2026-05-12 | Email entitlement + Drive auto-share |
| 2026-05-11 | Web admin dashboard MVP (transactions, products, temproles) |
| 2026-05-10 | Manual bank transfer payment (replaced Midtrans QRIS) |
| 2026-05-09 | Phase 1 core temprole system |

---

## Current State

### ✅ Working
Lihat section "Shipped Features" di atas — semuanya live dan stable.

### ⚠️ Blocked / Partial
- **Backup ke Drive di free Google account** — `storageQuotaExceeded`,
  butuh Workspace Shared Drive (lihat [TODO.md](TODO.md))
- **IB field-name reconciliation** — perlu 5 menit verifikasi ke real
  client response pertama saat ada user IB live (lihat [TODO.md](TODO.md))
- **Manual Valetax token rotation** — token expire ~1 jam, paste manual
  dari dashboard. Otomatisasi via Playwright headless future improvement.

### 🟡 Nice-to-have (Future)
- "Share folder ke email saya" tombol di dashboard backup
- AES-256 GCM encryption-at-rest untuk backup file
- UI page untuk manage `admin_users` (saat ini cuma via DB / Pengaturan Admin role-based)

---

## Architecture Notes

### Single-process Boot Order
`node src/index.js` boot urutan di [src/index.js](src/index.js):

1. Database (Sequelize PG connect + sync + migration)
2. Discord bot (load commands + events dari `src/commands/**` dan `src/events/*`)
3. Cron jobs (`startCronJobs`)
4. Google Sheets (`initializeSheets`)
5. Express admin web server (`startWebServer`)
6. Discord login (`client.login`)

Web server start **sebelum** Discord login agar dashboard tetap reachable
saat Discord gateway degraded.

### Layering

- `src/database/models/` — Sequelize schemas + associations
- `src/services/` — business logic + external integrations
- `src/events/interactionCreate.js` — fat dispatcher buat semua
  button/modal/autocomplete (~1278 baris)
- `src/web/routes/*` — REST API `/api/*`, `ib.js` paling besar
- `web-admin/src/` — SPA dengan route guards `RequireAuth` /
  `RequireAdmin` / `RedirectIfAuthed`

### Important Files Quick Reference

- **Bot entry:** [src/index.js](src/index.js)
- **Commands:** [src/commands/](src/commands/)
- **Models:** [src/database/models/](src/database/models/)
- **Services:** [src/services/](src/services/)
- **Web API:** [src/web/routes/](src/web/routes/)
- **SPA:** [web-admin/src/](web-admin/src/)
- **Plans & specs:** [docs/superpowers/](docs/superpowers/)

---

## Coding Conventions

- Async/await (no callbacks)
- `const` / `let` (no `var`)
- Try-catch untuk semua side-effecting code
- Bahasa Indonesia untuk user-facing message (sesuai server target)
- Bahasa Inggris untuk code comment & log
- Slash command file di `src/commands/<category>/<name>.js` dengan export
  `data` (SlashCommandBuilder) dan `execute` function
- Model file di `src/database/models/<Model>.js`, di-register di
  `src/database/models/index.js`

---

## Operator Cheat Sheet

```bash
# Development
npm run dev              # Auto-reload (nodemon)
npm start                # Production start
npm run deploy           # Register slash commands
npm run build:web        # Build dashboard SPA

# Production (di VPS)
pm2 logs qtassist        # Live log
pm2 restart qtassist     # Restart bot
git pull && npm install && npm run build:web && pm2 restart qtassist  # Update

# Database
psql -U qtassist -d qtassist_bot                # Akses DB
pg_dump qtassist_bot > backup.sql               # Manual backup
psql qtassist_bot < backup.sql                  # Manual restore

# Helpers
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # Generate JWT_SECRET
```

---

## References

- **README:** [README.md](README.md)
- **VPS Deploy:** [deploy/README.md](deploy/README.md)
- **Active TODOs:** [TODO.md](TODO.md)
- **Migration history:** [CHANGELOG-MANUAL-PAYMENT.md](CHANGELOG-MANUAL-PAYMENT.md), [MIGRATION-MANUAL-PAYMENT.md](MIGRATION-MANUAL-PAYMENT.md)
- **Multi-bank guide:** [MULTIPLE-ACCOUNTS-GUIDE.md](MULTIPLE-ACCOUNTS-GUIDE.md)
- **Plans & specs:** [docs/superpowers/](docs/superpowers/)
