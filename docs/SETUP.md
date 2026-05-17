# Setup Guide - QTAssist Discord Bot

> **⚠️ Legacy doc.** Panduan ini ditulis untuk Phase 1 (core temprole only)
> dan tidak mencakup: web admin dashboard, Discord OAuth login, manual
> bank transfer payment, IB Valetax integration, atau backup ke Google
> Drive.
>
> **Untuk panduan lengkap & terbaru:**
> - **Local development:** [../README.md](../README.md)
> - **Production VPS deployment:** [../deploy/README.md](../deploy/README.md)
> - **Quick reference:** [../QUICK-START.md](../QUICK-START.md)
>
> Bagian Discord bot setup, PostgreSQL setup, dan basic command usage
> di bawah masih akurat dan bisa dipakai sebagai pelengkap.

---

Complete setup guide for deploying the QTAssist Discord Bot.

## Prerequisites

- Node.js v18.0.0 or higher
- PostgreSQL 12 or higher
- Discord Bot Token + OAuth2 Client (Client ID & Secret)
- VPS or local server for hosting

## Step 1: Clone Repository

```bash
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configure Discord Bot

### 3.1 Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "QTAssist")
4. Go to "Bot" section in the left sidebar
5. Click "Add Bot" then "Yes, do it!"

### 3.2 Get Bot Token

1. In the Bot section, click "Reset Token"
2. Copy the token (you'll need this for `.env`)
3. **IMPORTANT:** Never share this token publicly!

### 3.3 Enable Privileged Intents

In the Bot section, scroll down to "Privileged Gateway Intents":
- ✅ Enable "SERVER MEMBERS INTENT"
- ✅ Enable "MESSAGE CONTENT INTENT"

### 3.4 Get Client ID & Secret (untuk OAuth dashboard)

1. Go to "OAuth2" > "General" in the left sidebar
2. Copy "CLIENT ID" → `.env` sebagai `DISCORD_CLIENT_ID`
3. Reset & copy "CLIENT SECRET" → `.env` sebagai `DISCORD_CLIENT_SECRET`
4. Tambahkan Redirect URI: `${DASHBOARD_BASE_URL}/api/auth/discord/callback`
   - Dev: `http://localhost:3000/api/auth/discord/callback`
   - Production: `https://your-domain.com/api/auth/discord/callback`

### 3.5 Invite Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Manage Roles
   - ✅ Manage Channels
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

### 3.6 Get Guild (Server) ID

1. In Discord, go to User Settings > Advanced
2. Enable "Developer Mode"
3. Right-click your server icon
4. Click "Copy Server ID"

## Step 4: Setup PostgreSQL Database

### 4.1 Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgresql-client
```

> `postgresql-client` (`pg_dump` & `psql`) wajib untuk fitur backup/restore
> dashboard.

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 4.2 Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE qtassist_bot;

# Create user (optional)
CREATE USER qtassist WITH PASSWORD 'your_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE qtassist_bot TO qtassist;

# Exit
\q
```

## Step 5: Configure Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` dan isi semua nilai yang dibutuhkan. Lihat
   [`.env.example`](../.env.example) untuk daftar lengkap (Discord, DB,
   payment channels, bank accounts, JWT secret, OAuth dashboard, dll.)

Generate `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### How to get Channel IDs:
1. In Discord (with Developer Mode enabled)
2. Right-click any channel
3. Click "Copy Channel ID"

## Step 6: Build Dashboard SPA

```bash
npm run build:web
```

Builds `web-admin/` ke `web-admin/dist/` yang nantinya di-serve oleh
Express.

## Step 7: Deploy Slash Commands

```bash
npm run deploy
```

Output:
```
✅ Loaded command: temprole-add
✅ Loaded command: temprole-remove
...
🚀 Successfully reloaded N guild (/) commands.
```

## Step 8: Start the Bot

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

You should see:
```
🚀 Starting QTAssist Discord Bot...
✅ Database connection established successfully.
✅ Database models synchronized.
✅ Loaded command: ...
✅ Loaded event: ready / interactionCreate / messageCreatePaymentProof
⏰ Starting cron jobs...
✅ Cron jobs started successfully.
🌐 Admin web server listening on port 3000
✅ Logged in as YourBotName#1234
✅ Bot is ready!
```

Buka `http://localhost:3000` untuk akses dashboard. Login via Discord OAuth.

## Step 9: Test the Bot

1. Go to your Discord server
2. Type `/` → semua command bot harus muncul
3. Coba `/temprole-add` untuk smoke test

## Step 10: Production Deployment (VPS)

Untuk production deployment lengkap (pm2 + nginx + Let's Encrypt + Drive
backup), lihat **[../deploy/README.md](../deploy/README.md)**. Doc itu
adalah source of truth untuk production.

## Troubleshooting

### Bot doesn't respond to commands
- Check if slash commands were deployed (`npm run deploy`)
- Check if bot has proper permissions in Discord
- Check if bot is online
- Check logs for errors

### Database connection failed
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Check if database exists: `psql -U postgres -l`

### Commands not showing in Discord
- Wait a few minutes (guild commands can take up to 1 minute)
- Re-deploy commands: `npm run deploy`
- Check `DISCORD_GUILD_ID` in `.env`

### Role hierarchy errors
- Make sure bot's role is higher than the roles it's trying to assign
- In Server Settings > Roles, drag bot's role above other roles

### Login dashboard error `bot_not_ready`
- Bot belum login Discord saat OAuth callback masuk
- Tunggu sampai bot fully online
- Pastikan user sudah join guild Discord

## Next Steps

Setelah bot jalan:

- Setup channel notifikasi opsional (`MOD_LOG_CHANNEL_ID`,
  `TEMP_ROLE_NOTIFICATION_CHANNEL_ID`, `PAYMENT_REVIEW_CHANNEL_ID`,
  `PAYMENT_UPLOAD_CHANNEL_ID`)
- Konfigurasi Google Service Account untuk Sheets sync + Drive backup
- Production deploy ke VPS via [../deploy/README.md](../deploy/README.md)

## Support

- Logs: `pm2 logs qtassist` (production) atau console (dev)
- [Discord API status](https://discordstatus.com/)
- [README.md](../README.md) untuk overview lengkap

