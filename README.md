# QTAssist Discord Bot

Bot Discord untuk manajemen temporary role otomatis dengan sistem pembayaran manual dan integrasi Google Sheets real-time.

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

### 👤 User Commands
- `/help` - Tampilkan semua command yang tersedia
- `/my-roles` - Cek role temporary kamu dan kapan kadaluarsanya
- `/my-purchases` - Lihat riwayat pembelian kamu

## Setup

### Prerequisites
- Node.js v16.9.0 or higher
- PostgreSQL database
- Discord Bot Token
- Google Service Account (for Sheets integration)

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

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Setup database:
```bash
# Create PostgreSQL database
createdb qtassist_bot

# Run migrations (auto-runs on first start)
```

5. Deploy slash commands:
```bash
npm run deploy
```

6. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

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

Current Status:
- ✅ **Phase 1:** Core Temporary Role System (100% Complete)
- ✅ **Phase 2:** Manual Payment System (100% Complete)
- ✅ **Phase 3:** Google Sheets Integration (100% Complete)
- ✅ **Phase 4:** Product & Shop Management (100% Complete)
- ✅ **Phase 5:** User Commands & Help System (100% Complete)

### Recent Updates
- ✅ Manual bank transfer payment system dengan admin approval
- ✅ Multiple bank accounts support (pipe-separated config)
- ✅ Direct image upload untuk payment proof
- ✅ Google Sheets real-time sync (4 sheets: Active Transactions, History, Active Users, Analytics)
- ✅ Analytics dengan pie chart dan top products by revenue
- ✅ Active Users monitoring sheet dengan status indicators
- ✅ `/help` command untuk list semua commands
- ✅ `/my-roles` command untuk user cek role expiry
- ✅ Full Indonesian localization
- ✅ Cron jobs untuk auto-sync sheets setiap 10 menit

## Database Schema

See [DATABASE.md](./docs/DATABASE.md) for detailed schema documentation.

## Project Structure

```
qtassist5251/
├── src/
│   ├── commands/
│   │   ├── admin/           # Admin commands (products, temprole, transactions)
│   │   └── user/            # User commands (help, my-roles, my-purchases)
│   ├── events/
│   │   ├── interactionCreateButton.js    # Button interaction handler
│   │   ├── interactionCreateCommand.js   # Slash command handler
│   │   ├── messageCreatePaymentProof.js  # Payment proof upload handler
│   │   └── ready.js                      # Bot ready event
│   ├── database/
│   │   ├── models/          # Sequelize models
│   │   │   ├── Transaction.js
│   │   │   ├── Product.js
│   │   │   ├── TemporaryRole.js
│   │   │   └── ModerationLog.js
│   │   ├── migrations/      # Database migrations
│   │   └── sequelize.js     # Database connection
│   ├── services/
│   │   ├── googleSheetsService.js  # Google Sheets integration
│   │   └── cronService.js          # Cron jobs & background tasks
│   ├── utils/
│   │   └── embedBuilder.js         # Discord embed templates
│   └── index.js             # Main entry point
├── .env.example             # Environment template
├── package.json
└── README.md
```

## Tech Stack

- **Discord.js v14** - Discord bot framework
- **PostgreSQL** - Database
- **Sequelize** - ORM
- **node-cron** - Background jobs
- **googleapis** - Google Sheets API

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

### Auto-Sync & Monitoring
- **Every 1 minute:** Check & remove expired roles
- **Every 5 minutes:** Send expiry notifications (24h & 1h)
- **Every 10 minutes:** Sync Active Users to Google Sheets
- **Every 30 minutes:** Expire old pending transactions

## Environment Variables

Lihat [.env.example](.env.example) untuk template lengkap.

**Required:**
- `DISCORD_TOKEN` - Bot token dari Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_CLIENT_SECRET` - OAuth2 client secret (untuk login dashboard)
- `DISCORD_GUILD_ID` - Server ID untuk testing
- `DASHBOARD_BASE_URL` - Base URL dashboard, contoh `https://qtrades.bensserver.cloud`. Discord redirect URI = `${DASHBOARD_BASE_URL}/api/auth/discord/callback`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config
- `JWT_SECRET` - Min 32 karakter, untuk sign session token
- `PAYMENT_REVIEW_CHANNEL_ID` - Channel untuk admin review payment
- `PAYMENT_UPLOAD_CHANNEL_ID` - Channel untuk user upload bukti
- `BANK_NAMES`, `ACCOUNT_NUMBERS`, `ACCOUNT_HOLDERS` - Bank account details (pipe-separated)

**Optional:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - For Sheets integration
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `GOOGLE_SPREADSHEET_ID` - Target spreadsheet ID
- `MOD_LOG_CHANNEL_ID` - Channel untuk moderation logs
- `TEMP_ROLE_NOTIFICATION_CHANNEL_ID` - Channel untuk role expiry notifications
- `QTRADES_LOGO_URL` - Logo untuk embeds

## Troubleshooting

### Bot tidak online
- Cek `DISCORD_TOKEN` di `.env`
- Pastikan bot sudah di-invite ke server dengan permissions yang benar
- Cek logs untuk error messages

### Commands tidak muncul
- Jalankan `npm run deploy` untuk deploy slash commands
- Atau restart bot (commands auto-register saat start)
- Cek `DISCORD_CLIENT_ID` dan `DISCORD_GUILD_ID` di `.env`

### Google Sheets tidak sync
- Pastikan spreadsheet sudah di-share dengan service account email
- Cek `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, dan `GOOGLE_SPREADSHEET_ID`
- Pastikan Google Sheets API sudah enabled di Google Cloud Console
- Lihat logs untuk error messages

### Payment upload tidak work
- Cek `PAYMENT_UPLOAD_CHANNEL_ID` ada dan bot punya akses
- Cek `PAYMENT_REVIEW_CHANNEL_ID` untuk admin review
- Pastikan bot punya permission: Manage Channels, Send Messages, Attach Files

### Database error
- Pastikan PostgreSQL running
- Cek database credentials di `.env`
- Jalankan migrations jika ada: `node src/database/migrations/update-transaction-manual-payment.js`

## Contributing

Pull requests are welcome! Untuk perubahan major, buka issue dulu untuk diskusi.

## License

MIT

## Author

QTrades Development Team

---

**Built with Discord.js v14 | PostgreSQL | Google Sheets API**

🤖 Generated with Claude Code
