# QTAssist Discord Bot

Discord bot + admin web dashboard untuk QTrades. Mengelola temporary role berbayar dengan sistem pembayaran manual bank transfer, integrasi Google Sheets real-time, email entitlement bindings, dan Introducing Broker (IB) Valetax integration.

## Features

### ✅ Temporary Role Management
- Slash commands untuk manajemen role temporary
- Auto-removal saat role expire
- Sistem notifikasi (24 jam & 1 jam sebelum expire)
- Multiple temporary roles per user
- Background worker untuk automated tasks
- Cron jobs untuk monitoring role expiry

### ✅ Manual Payment System
- Sistem pembayaran manual via bank transfer
- Support multiple bank accounts (2+ rekening)
- Upload bukti transfer langsung di Discord
- Admin approval/rejection workflow
- Temporary channel untuk upload dengan auto-cleanup
- Payment proof forwarding ke admin review channel

### ✅ Google Sheets Integration
- Real-time sync ke Google Sheets
- **Active Transactions** - Transaksi pending/pending_review
- **Transaction History** - Transaksi approved/rejected dengan review details
- **Active Users** - User dengan role temporary yang masih aktif
- **Analytics** - Metrics lengkap dengan pie chart & top products
- Auto-update setiap 10 menit via cron job
- Format tanggal Indonesia (WIB timezone)

### ✅ Product & Shop Management
- Create, list, dan delete products
- Shop setup dengan embed UI yang clean
- Role-based product association
- Duration-based pricing

### ✅ Email Entitlement & Google Drive Auto-Share
- User mendaftarkan email → bot menyimpan binding email ↔ Discord user
- Konfigurasi Google Drive folder yang otomatis di-share ke email user yang punya role tertentu
- Akses dicabut otomatis saat role expire / dihapus

### ✅ Web Admin Dashboard
- Single-page React dashboard (Vite + Tailwind, brutalist theme)
- Login via Discord OAuth (bukan username/password)
- CRUD penuh: transaksi, produk, temprole, email, IB account, audit log
- Discord post composer (admin posting message via dashboard)
- Bot status, backup database (manual + jadwal harian), pengaturan admin
- Server-Sent Events (SSE) untuk update real-time

### ✅ IB Valetax Integration
- User non-admin login dashboard → wizard 3-langkah `/daftar-ib` (register → deposit → submit)
- Verifikasi otomatis nomor akun broker via Valetax API (mode `live`)
- Daily volume tracking, auto grant/revoke role IB berdasarkan aktivitas
- Token Valetax dipaste manual dari dashboard (sub-jam expiry)

### ✅ Database Backup & Restore
- Cron harian 03:00 WIB → `pg_dump` + gzip → upload ke Google Drive folder
- Retention otomatis: 30 daily + 12 monthly
- Backup/restore manual dari dashboard (download, restore, restore-from-upload)

## Commands

### 👨‍💼 Admin Commands

**Product Management:**
- `/product-create` - Buat produk baru dengan role, duration, dan harga
- `/product-list` - Lihat semua produk yang tersedia
- `/product-delete` - Hapus produk
- `/shop-setup` - Setup shop channel dengan embed dan tombol beli

**Temporary Role Management:**
- `/temprole-add` - Assign temporary role ke user
- `/temprole-remove` - Remove temporary role dari user
- `/temprole-list` - Lihat semua temporary role yang aktif
- `/temprole-extend` - Perpanjang durasi temporary role

**Transaction Management:**
- `/transaction-process` - Process transaksi manual (approve/reject payment)
- `/transaction-cancel` - Cancel transaksi

**Setup & Konfigurasi:**
- `/email-setup` - Setup channel pendaftaran email
- `/email-list` - Lihat semua email terdaftar (dengan pagination)
- `/drive-setup` - Konfigurasi Google Drive folder untuk auto-share
- `/myinfo-setup` - Setup channel "My Info" dengan tombol Cek Role & Riwayat Pembelian
- `/role-claim-setup` - Post tombol claim role (max 5 role per message)

### 👤 User Commands
- `/help` - Tampilkan semua command yang tersedia
- `/my-email` - Cek email terdaftar untuk akses konten

> **Catatan:** Cek role temporary aktif dan riwayat pembelian dilakukan via tombol di channel **My Info** (di-setup admin pakai `/myinfo-setup`), bukan slash command.

> **Catatan IB:** Pendaftaran IB tidak lagi via slash command. User non-admin login dashboard → otomatis diarahkan ke wizard `/daftar-ib`.

## Setup

### Prerequisites
- Node.js v18.0.0 or higher
- PostgreSQL 12 atau lebih baru (`pg_dump` & `psql` harus tersedia di PATH untuk fitur backup/restore)
- Discord Bot Token + OAuth2 Client (Client ID & Secret)
- Google Service Account (untuk Sheets sync + Drive backup folder)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251
```

2. Install dependencies:
```bash
npm install
```

3. Build dashboard SPA:
```bash
npm run build:web
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Setup database:
```bash
# Create PostgreSQL database
createdb qtassist_bot

# Migrations auto-run on first start (sequelize sync + migration scripts)
```

6. Deploy slash commands:
```bash
npm run deploy
```

7. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

> **Production:** lihat [`deploy/README.md`](deploy/README.md) untuk panduan VPS lengkap (pm2 + nginx + certbot + Drive backup).

## Configuration

### Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Go to Bot section and create bot
4. Copy bot token to `.env` as `DISCORD_TOKEN`
5. Enable these Privileged Gateway Intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
6. Go to OAuth2 > URL Generator
7. Select scopes: `bot`, `applications.commands`
8. Select permissions:
   - Manage Roles
   - Kick Members
   - Ban Members
   - Manage Messages
   - Send Messages
   - Embed Links
9. Use generated URL to invite bot to your server

### Discord OAuth (Login Dashboard)
Login dashboard sekarang full Discord OAuth, bukan username/password.

1. Di Developer Portal, buka aplikasi yang sama
2. OAuth2 > General:
   - Copy `Client ID` ke `.env` sebagai `DISCORD_CLIENT_ID`
   - Reset & copy `Client Secret` ke `.env` sebagai `DISCORD_CLIENT_SECRET`
3. OAuth2 > Redirects > Add Redirect:
   - Format: `${DASHBOARD_BASE_URL}/api/auth/discord/callback`
   - Contoh production: `https://qtrades.bensserver.cloud/api/auth/discord/callback`
   - Contoh dev: `http://localhost:3000/api/auth/discord/callback`
4. Set `DASHBOARD_BASE_URL` di `.env` sesuai base URL dashboard kamu
5. Generate `JWT_SECRET` (min 32 char):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

#### Akses Admin
- **Bootstrap (sekali aja):** Saat tabel `admin_roles` masih kosong, siapapun yang punya permission Discord ADMINISTRATOR di guild bisa akses dashboard admin sebagai bootstrap
- **Setelah ada role admin di tabel:** Hanya user dengan role-role yang terdaftar yang bisa akses dashboard admin
- **Manage role admin:** Login sebagai admin → menu "Pengaturan Admin" → tambah/hapus role Discord
- **Refresh role:** Cached snapshot role di-refresh dari Discord setiap 1 jam (atau setiap login ulang)

#### Flow user
- User non-admin login → otomatis diarahkan ke `/daftar-ib` untuk submit nomor akun broker IB
- User admin login → masuk ke dashboard admin penuh, juga bisa akses `/daftar-ib`
- User yang belum di guild Discord atau bot offline saat login pertama kali akan dapat error `bot_not_ready`

### PostgreSQL Setup
1. Install PostgreSQL
2. Create database:
```sql
CREATE DATABASE qtassist_bot;
```
3. Configure connection in `.env`

### Google Sheets API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable Google Sheets API
4. Create Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Give it a name (e.g., "qtassist-sheets")
   - Grant role "Editor"
   - Click "Done"
5. Generate credentials:
   - Click on the service account
   - Go to "Keys" tab
   - Add Key > Create new key > JSON
   - Download the JSON file
6. Extract credentials from JSON:
   - Copy `client_email` to `.env` as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy `private_key` to `.env` as `GOOGLE_PRIVATE_KEY`
7. Create Google Spreadsheet:
   - Create new Google Sheets
   - Copy spreadsheet ID from URL (between `/d/` and `/edit`)
   - Add to `.env` as `GOOGLE_SPREADSHEET_ID`
   - **IMPORTANT:** Share spreadsheet dengan service account email (Editor access)

### Bank Account Configuration (Manual Payment)
Untuk support multiple bank accounts, gunakan format pipe-separated (`|`) di `.env`:

```env
BANK_NAMES=BCA|Mandiri|SeaBank
ACCOUNT_NUMBERS=1234567890|9876543210|1112223334
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup|QTrades Main
```

Bot akan display semua rekening ke user saat mereka klik tombol "Beli".

## Development Progress

Status saat ini (2026-05-17):

- ✅ **Core Temporary Role System** (auto-removal, notifikasi 24h/1h, multi-role per user)
- ✅ **Manual Bank Transfer Payment** (multi-bank, upload bukti, admin approve/reject)
- ✅ **Google Sheets Integration** (4 sheets, auto-sync 10 menit)
- ✅ **Product & Shop Management** (slash command + tombol beli)
- ✅ **Email Entitlement & Google Drive Auto-Share**
- ✅ **Web Admin Dashboard** (Discord OAuth, brutalist UI, SSE realtime)
- ✅ **IB Valetax Integration** (`/daftar-ib` wizard 3-step, daily volume tracking)
- ✅ **Database Backup ke Google Drive** (cron 03:00 WIB, retention 30 daily + 12 monthly)
  - ⚠️ Free Google account terkena `storageQuotaExceeded`. Lihat [TODO.md](TODO.md) — fix proper butuh pindah ke Google Workspace Shared Drive.

### Recent Updates
- ✅ Brutalist UI redesign (Space Grotesk + JetBrains Mono, zero radius, step shadow)
- ✅ Migrasi pendaftaran IB dari Discord button → wizard dashboard `/daftar-ib`
- ✅ Login dashboard pindah ke Discord OAuth (admin role di-cache dari Discord)
- ✅ Manual bank transfer payment dengan admin approval
- ✅ Multiple bank accounts support (pipe-separated config)
- ✅ Direct image upload untuk payment proof
- ✅ Google Sheets real-time sync (4 sheets: Active Transactions, History, Active Users, Analytics)
- ✅ Database backup harian ke Google Drive + restore via dashboard

Untuk task list aktif, lihat [TODO.md](TODO.md).

## Project Structure

```
qtassist5251/
├── src/
│   ├── commands/
│   │   ├── admin/                    # drive-setup, email-setup, email-list,
│   │   │                             # myinfo-setup, role-claim-setup
│   │   ├── product/                  # create, list, delete, shop-setup
│   │   ├── temprole/                 # add, remove, list, extend
│   │   ├── transaction/              # process, cancel
│   │   └── user/                     # help, my-email
│   ├── events/
│   │   ├── interactionCreate.js      # Dispatcher: slash, button, modal, autocomplete
│   │   ├── messageCreatePaymentProof.js
│   │   └── ready.js
│   ├── database/
│   │   ├── models/                   # Transaction, Product, TemporaryRole,
│   │   │                             # ModerationLog, EmailBinding, EmailRole,
│   │   │                             # DriveConfig, AdminRole, IbConfig,
│   │   │                             # IbAccount, IbVolumeRecord, ...
│   │   ├── migrations/               # add-ib-tracking-columns, create-drive-configs,
│   │   │                             # create-email-bindings, update-transaction-manual-payment
│   │   └── sequelize.js              # PG connection
│   ├── services/
│   │   ├── cronService.js            # Role expiry, reminders, sheet sync, backup
│   │   ├── googleSheetsService.js    # 4-sheet sync
│   │   ├── googleDriveService.js     # Drive share/revoke
│   │   ├── backupService.js          # pg_dump → Drive
│   │   ├── transactionService.js
│   │   ├── valetaxService.js         # IB Valetax API client
│   │   ├── ibService.js              # IB business rules
│   │   ├── postingService.js         # Bot-driven Discord posts dari dashboard
│   │   ├── discordRoleSync.js
│   │   ├── emailEligibility.js
│   │   ├── eventBus.js               # SSE source untuk dashboard /api/events
│   │   └── cronStatus.js
│   ├── utils/                        # parseDuration, embedBuilder, secrets
│   ├── web/                          # Express admin API + SPA serve
│   │   ├── server.js                 # Mount /api/*, helmet CSP, SPA fallback
│   │   ├── auth.js, discordOAuth.js, middleware.js, seedAdmin.js
│   │   └── routes/                   # auth, stats, audit, events, transactions,
│   │                                 # products, temproles, emails, users, discord,
│   │                                 # discordPosts, bot, backups, ib, adminRoles,
│   │                                 # emailRoles
│   ├── scripts/hash-password.js      # Helper bcrypt (legacy, dashboard pakai OAuth)
│   ├── deploy-commands.js            # Slash command registration
│   └── index.js                      # Entry: DB → bot → cron → sheets → web → login
├── web-admin/                        # React SPA dashboard
│   ├── src/
│   │   ├── pages/                    # Dashboard, Transactions, Products, TempRoles,
│   │   │                             # Emails, AuditLog, UserLookup, DiscordPost,
│   │   │                             # BotStatus, Backups, IbSettings, IbAccounts,
│   │   │                             # AdminRoles, EmailRoles, Login, MyEmail,
│   │   │                             # daftar-ib/ (Step1/2/3 + StatusView)
│   │   ├── components/               # Layout, ui/, ui/brutalist/
│   │   ├── lib/                      # cn, realtime (SSE), notifications, theme
│   │   ├── App.jsx, main.jsx, auth.jsx, api.js
│   │   └── ...
│   ├── public/                       # qtrades-logo.webp, theme-bootstrap.js
│   ├── tailwind.config.js, vite.config.js, postcss.config.js
│   └── package.json
├── deploy/
│   ├── README.md                     # VPS deployment playbook
│   └── nginx.conf.example            # nginx + TLS reverse proxy
├── docs/
│   ├── SETUP.md                      # Older Phase 1 setup guide (legacy)
│   └── superpowers/                  # Plans + design specs
├── .env.example
├── package.json
└── README.md
```

## Tech Stack

**Backend:**
- **Discord.js v14** — Discord bot framework
- **Express** + **helmet** + **express-rate-limit** — Admin API server
- **PostgreSQL** + **Sequelize** — Database & ORM
- **node-cron** — Background jobs
- **googleapis** — Sheets + Drive API
- **jsonwebtoken** + **bcrypt** — Session & password hashing
- **Discord OAuth2** — Dashboard authentication

**Frontend (web-admin):**
- **React 18** + **Vite 5** — SPA framework
- **Tailwind CSS 3** — Styling (brutalist theme: zero radius, step shadow)
- **React Router 6** — Routing dengan `RequireAuth` / `RequireAdmin` guards
- **Recharts** — Analytics charts
- **Radix UI** — Dialog, dropdown, tooltip primitives
- **Server-Sent Events** — Realtime updates dari bot (`/api/events`)

## Google Sheets Structure

Bot otomatis membuat dan mengelola 4 sheets:

### 1. Active Transactions
Transaksi yang sedang pending atau pending review:
- Order ID, User ID, Username
- Product, Role, Amount
- Status, Created At
- Payment Proof URL

### 2. Transaction History
Semua transaksi yang sudah approved atau rejected:
- Semua kolom dari Active Transactions
- Reviewed By, Reviewed At
- Rejection Reason (jika ditolak)

### 3. Active Users ⭐ NEW!
User yang masih punya role temporary aktif:
- User ID, Username
- Role ID, Role Name
- Granted At, Expires At
- **Days Remaining** - Sisa waktu (X hari Y jam)
- **Status** - ✅ Active, ⏰ Expiring Soon, ⚠️ Critical

Auto-update setiap 10 menit via cron job.

### 4. Analytics
Metrics & visualizations:
- **Overview:** Total transactions, approved, rejected, pending, cancelled
- **Revenue:** Total revenue, average transaction
- **Performance:** Approval rate, rejection rate, conversion rate
- **Top Products:** 5 produk dengan revenue tertinggi
- **Pie Chart:** Status distribution visualization
- Last updated timestamp (WIB)

## Workflow

### User Purchase Flow
1. User klik tombol "Beli" di shop channel
2. Bot tampilkan detail rekening bank (support multiple accounts)
3. User klik "Upload Bukti Transfer"
4. Bot create temporary channel untuk upload
5. User upload screenshot/foto bukti transfer
6. Bot forward ke admin review channel dengan tombol Approve/Reject
7. Admin review dan approve/reject
8. Jika approved: Role otomatis diberikan + sync ke Google Sheets
9. Temporary channel auto-delete setelah 10 detik

### Admin Review Flow
1. Payment proof muncul di review channel
2. Admin klik "✅ Approve" atau "❌ Reject"
3. Jika reject: Admin diminta isi alasan penolakan
4. Transaction status updated di database
5. User dapat notifikasi via DM
6. Google Sheets otomatis ter-update:
   - Removed dari "Active Transactions"
   - Added ke "Transaction History"
   - User muncul di "Active Users" (jika approved)
   - Analytics di-refresh

### IB Registration Flow
1. User non-admin login dashboard via Discord OAuth → otomatis di-redirect ke `/daftar-ib`
2. **Step 1 — Register:** User klik link affiliate Valetax. Bot track `linkClickedAt`.
3. **Step 2 — Deposit:** User konfirmasi sudah deposit minimum. Bot track `depositConfirmedAt`.
4. **Step 3 — Submit:** User input nomor akun broker. Bot verify ke Valetax API:
   - Match → simpan, set status verified, assign role IB
   - Tidak match → user diminta cek ulang
5. **Status view:** User verified bisa lihat volume harian + status role

### Auto-Sync & Monitoring
- **Every 1 minute:** Check & remove expired roles
- **Every 5 minutes:** Send expiry notifications (24h & 1h)
- **Every 10 minutes:** Sync Active Users to Google Sheets
- **Every 30 minutes:** Expire old pending transactions
- **Every 1 hour:** Sample IB volume per akun verified, grant/revoke role IB
- **Daily 03:00 WIB:** `pg_dump` + upload ke Google Drive (retention 30 daily + 12 monthly)

## Environment Variables

Lihat [.env.example](.env.example) untuk template lengkap.

**Required:**
- `DISCORD_TOKEN` - Bot token dari Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_CLIENT_SECRET` - OAuth2 client secret (untuk login dashboard)
- `DISCORD_GUILD_ID` - Server ID
- `DASHBOARD_BASE_URL` - Base URL dashboard, contoh `https://qtrades.bensserver.cloud`. Discord redirect URI = `${DASHBOARD_BASE_URL}/api/auth/discord/callback`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config
- `JWT_SECRET` - Min 32 karakter, untuk sign session token
- `WEB_PORT` - Port admin web (default 3000)
- `PAYMENT_REVIEW_CHANNEL_ID` - Channel untuk admin review payment
- `PAYMENT_UPLOAD_CHANNEL_ID` - Channel untuk user upload bukti
- `BANK_NAMES`, `ACCOUNT_NUMBERS`, `ACCOUNT_HOLDERS` - Bank account details (pipe-separated)

**Optional:**
- `NODE_ENV` - Set `production` di server (secure cookies + asset cache)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Untuk Sheets + Drive backup
- `GOOGLE_PRIVATE_KEY` - Service account private key (literal `\n` accepted)
- `GOOGLE_SPREADSHEET_ID` - Target spreadsheet ID
- `GOOGLE_BACKUP_FOLDER_ID` - Drive folder ID untuk backup harian
- `MOD_LOG_CHANNEL_ID` - Channel untuk moderation logs
- `TEMP_ROLE_NOTIFICATION_CHANNEL_ID` - Channel untuk role expiry notifications
- `QTRADES_LOGO_URL` - Logo untuk embeds
- `SESSION_COOKIE_NAME` - Default `qtassist_session`
- `VALETAX_MODE` - Kosong = mock, `live` = real API
- `VALETAX_BASE_URL` - Base URL Valetax API
- `VALETAX_DEBUG` - `true` untuk verbose log (jangan aktifkan di production, log PII)
- `COOKIE_ENCRYPTION_KEY` - Fallback ke `JWT_SECRET` kalau kosong

## Troubleshooting

### Bot tidak online
- Cek `DISCORD_TOKEN` di `.env`
- Pastikan bot sudah di-invite ke server dengan permissions yang benar
- Cek logs untuk error messages

### Commands tidak muncul
- Jalankan `npm run deploy` untuk deploy slash commands
- Atau restart bot (commands auto-register saat start)
- Cek `DISCORD_CLIENT_ID` dan `DISCORD_GUILD_ID` di `.env`

### Login dashboard error `bot_not_ready`
- Bot belum login ke Discord saat user OAuth callback masuk
- Tunggu bot fully online (cek log `Logged in as ...`)
- Pastikan user sudah join guild Discord

### Google Sheets tidak sync
- Pastikan spreadsheet sudah di-share dengan service account email
- Cek `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, dan `GOOGLE_SPREADSHEET_ID`
- Pastikan Google Sheets API sudah enabled di Google Cloud Console
- Lihat logs untuk error messages

### Backup error `storageQuotaExceeded`
- Service account di project Cloud standar tidak punya quota Drive
- Fix proper: pindah ke Google Workspace **Shared Drive**, lihat [TODO.md](TODO.md)

### Payment upload tidak work
- Cek `PAYMENT_UPLOAD_CHANNEL_ID` ada dan bot punya akses
- Cek `PAYMENT_REVIEW_CHANNEL_ID` untuk admin review
- Pastikan bot punya permission: Manage Channels, Send Messages, Attach Files

### IB verify selalu gagal
- Cek `VALETAX_MODE=live` dan token Valetax di-paste fresh dari dashboard "Pengaturan IB"
- Aktifkan `VALETAX_DEBUG=true`, restart bot, lihat `LOOKUP-SAMPLE-KEYS` log
- Bandingkan key yang muncul dengan `extractAccountNumber` candidate di `src/services/valetaxService.js`

### Database error
- Pastikan PostgreSQL running
- Cek database credentials di `.env`
- Migration auto-run via Sequelize sync; manual: jalankan script di `src/database/migrations/`

## Contributing

Pull requests are welcome! Untuk perubahan major, buka issue dulu untuk diskusi.

## License

MIT

## Author

QTrades Development Team

---

**Built with Discord.js v14 | PostgreSQL | Express | React | Tailwind**
