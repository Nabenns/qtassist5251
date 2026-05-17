# Quick Start Guide - QTAssist Discord Bot

**Repository:** https://github.com/Nabenns/qtassist5251.git

Quick reference untuk operator + developer. Untuk panduan lengkap lihat
[README.md](README.md), [deploy/README.md](deploy/README.md), dan
[PROGRESS.md](PROGRESS.md).

---

## For End Users

### Login Dashboard
- Buka URL dashboard (contoh: `https://qtrades.bensserver.cloud`)
- Klik **Login dengan Discord** → authorize OAuth2
- Admin → masuk dashboard penuh
- User biasa → diarahkan ke wizard `/daftar-ib`

### Slash Commands

**Untuk semua user:**
- `/help` — list semua command
- `/my-email` — cek email yang terdaftar untuk akses konten

**Untuk cek role / riwayat pembelian:**
- Tidak via slash command
- Buka channel **My Info** yang di-setup admin → klik tombol
  🎭 Cek Role atau 🛒 Riwayat Pembelian

### Beli Produk
1. Klik tombol **Beli** di shop channel
2. Bot tampilkan detail rekening bank (bisa multiple)
3. Transfer ke salah satu rekening
4. Klik **Upload Bukti Bayar** → upload screenshot
5. Tunggu admin review (notifikasi via DM)

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

### Daftar IB (Introducing Broker)
1. Login dashboard → otomatis di-redirect ke `/daftar-ib`
2. **Step 1:** Klik link affiliate Valetax untuk register
3. **Step 2:** Setelah deposit minimum, konfirmasi di dashboard
4. **Step 3:** Input nomor akun broker → bot verify ke Valetax API
5. Verified → role IB otomatis di-assign + status terlihat di dashboard

---

## For Admins

### Slash Commands (Admin Only)

**Product:**
- `/product-create <role> <name> <price> <duration> [desc]`
- `/product-list`
- `/product-delete <id>`

**Shop:**
- `/shop-setup #channel`

**Temporary Role:**
- `/temprole-add <user> <role> <duration> [reason]`
- `/temprole-remove <user> <role>`
- `/temprole-extend <user> <role> <duration>`
- `/temprole-list [user]`

**Transaction:**
- `/transaction-process <order_id>`
- `/transaction-cancel <order_id>`

**Setup:**
- `/email-setup #channel` — channel pendaftaran email
- `/email-list [page]` — list email terdaftar
- `/drive-setup add|list|enable|role` — Drive folder auto-share
- `/myinfo-setup #channel` — channel My Info dengan tombol cek role
- `/role-claim-setup #channel role1 [role2..role5] ...` — tombol claim role

### Format Durasi
- `1m` = 1 menit
- `1h` = 1 jam
- `1d` = 1 hari
- `1w` = 1 minggu
- `30d` = 30 hari
- `1d12h30m` = 1 hari 12 jam 30 menit (kombinasi)

> **Web Shop Configuration:** Setiap produk punya `paymentMethods` array.
> Edit produk di `/products` → centang metode yang mau di-enable. Minimum
> 1 metode wajib dipilih. Default saat create: QRIS only.

### Akses Admin Dashboard
- **Bootstrap (sekali aja):** Tabel `admin_roles` kosong → semua user
  dengan permission Discord ADMINISTRATOR di guild bisa login admin
- **Setelah ada role:** Hanya user dengan role yang terdaftar di
  Pengaturan Admin yang bisa login admin
- **Cache role:** di-refresh tiap 1 jam atau saat login ulang

### Dashboard Pages
- **Dashboard** — overview revenue, pending review, recent transactions
- **Transactions** — approve/reject payment, riwayat
- **Products / Temp Roles / Emails** — CRUD penuh
- **User Lookup** — cari user by Discord ID
- **Audit Log** — semua action admin
- **Discord Post** — composer untuk posting via bot
- **Bot Status** — uptime, cron status, gateway state
- **Backups** — backup manual, download, restore
- **IB Settings / IB Accounts** — token Valetax, daftar akun IB verified
- **Admin Roles / Email Roles** — config role-based access

---

## For Developers

### Quick Setup

```bash
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251
npm install
npm run build:web
cp .env.example .env
# Edit .env dengan config kamu
npm run deploy           # Register slash commands ke Discord
npm run dev              # Auto-reload via nodemon
```

### Environment Variables (Required)

```env
# Discord
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=...
DASHBOARD_BASE_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qtassist_bot
DB_USER=postgres
DB_PASSWORD=...

# Web
WEB_PORT=3000
JWT_SECRET=<min 32 char random hex>

# Payment
PAYMENT_REVIEW_CHANNEL_ID=...
PAYMENT_UPLOAD_CHANNEL_ID=...
BANK_NAMES=BCA|Mandiri
ACCOUNT_NUMBERS=1234567890|9876543210
ACCOUNT_HOLDERS=QTrades Official|QTrades Backup
```

### Optional Env Vars
- `GOOGLE_*` — Sheets sync + Drive backup
- `GOOGLE_BACKUP_FOLDER_ID` — Drive folder untuk backup harian
- `MOD_LOG_CHANNEL_ID`, `TEMP_ROLE_NOTIFICATION_CHANNEL_ID`
- `QTRADES_LOGO_URL`
- `VALETAX_MODE` — `live` untuk real API, kosong untuk mock
- `VALETAX_BASE_URL`, `VALETAX_DEBUG`
- `NODE_ENV=production` di server
- `LOUVIN_ENABLED`, `LOUVIN_API_KEY`, `LOUVIN_WEBHOOK_TOKEN`,
  `LOUVIN_DEFAULT_DESCRIPTION` — Web shop Louvin payment gateway
- `DISCORD_INVITE_URL` — Invite link untuk user yang belum di guild

Lihat [.env.example](.env.example) untuk template lengkap.

### Useful Commands

```bash
# Development
npm run dev              # Auto-reload (nodemon)
npm start                # Production start
npm run deploy           # Register/refresh slash commands
npm run build:web        # Build dashboard SPA ke web-admin/dist

# Production
pm2 logs qtassist        # Live log
pm2 restart qtassist     # Restart bot

# Database
psql -U qtassist -d qtassist_bot                # Akses DB
pg_dump qtassist_bot > backup.sql               # Manual backup

# Generate secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### File Structure (Singkat)

```
qtassist5251/
├── src/
│   ├── commands/           # Slash commands (admin/, product/, temprole/, transaction/, user/)
│   ├── events/             # Discord event handlers
│   ├── database/           # Models + migrations + Sequelize connection
│   ├── services/           # Business logic + integrations
│   ├── web/                # Express admin API
│   ├── utils/              # parseDuration, embedBuilder, secrets
│   └── index.js            # Entry point
├── web-admin/              # React + Vite SPA dashboard
├── deploy/                 # VPS deployment guide + nginx config
├── docs/                   # Setup docs + plans/specs
├── .env.example
├── README.md               # Project overview lengkap
├── PROGRESS.md             # Status fitur + perubahan terkini
├── TODO.md                 # Task aktif
└── QUICK-START.md          # File ini
```

Detail struktur lengkap di [README.md](README.md#project-structure).

### Stack Decisions (Locked)
- ✅ Node.js (BUKAN Python)
- ✅ Discord.js v14
- ✅ PostgreSQL (BUKAN SQLite/MongoDB)
- ✅ Slash commands ONLY (no prefix `!`)
- ✅ Single guild deployment
- ✅ React + Vite untuk dashboard (BUKAN Next.js)
- ✅ Discord OAuth untuk login dashboard (BUKAN username/password)
- ✅ VPS hosting (pm2 + nginx + certbot)

---

## Production Deployment

Lihat [deploy/README.md](deploy/README.md) — playbook lengkap untuk
Ubuntu 22.04/24.04 dengan pm2 + nginx + Let's Encrypt + Drive backup.

Ringkasan singkat:

```bash
# Server prep (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential postgresql postgresql-client \
                    nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# Database
sudo -u postgres psql -c "CREATE USER qtassist WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE qtassist_bot OWNER qtassist;"

# Deploy
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251
npm install
npm run build:web
cp .env.example .env && nano .env

npm run deploy
pm2 start src/index.js --name qtassist
pm2 save && pm2 startup

# nginx + TLS
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/qtassist
sudo ln -s /etc/nginx/sites-available/qtassist /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
```

---

## Important Reminders

- **Jangan commit `.env`** (already in `.gitignore`)
- **Jangan commit `JWT_SECRET`** atau credential apapun
- **Validasi user input** di route handler & command
- **Test command** di guild dev sebelum push ke production
- **Update slash command** via `npm run deploy` setiap nambah/ubah command
- **Backup DB** sebelum migration major

---

## Related Docs

- [README.md](README.md) — Project overview, features, env vars, troubleshooting
- [PROGRESS.md](PROGRESS.md) — Status fitur shipped + perubahan terkini
- [TODO.md](TODO.md) — Task aktif & blocker
- [deploy/README.md](deploy/README.md) — VPS deployment playbook
- [CHANGELOG-MANUAL-PAYMENT.md](CHANGELOG-MANUAL-PAYMENT.md) — Migrasi Midtrans → manual transfer
- [MIGRATION-MANUAL-PAYMENT.md](MIGRATION-MANUAL-PAYMENT.md) — Step-by-step migrasi
- [MULTIPLE-ACCOUNTS-GUIDE.md](MULTIPLE-ACCOUNTS-GUIDE.md) — Setup multiple bank accounts
- [docs/superpowers/](docs/superpowers/) — Plans + design specs

---

**Last Updated:** 2026-05-17
