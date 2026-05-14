# Deploying QTAssist to a VPS

This guide walks through deploying the bot + admin web dashboard to a Linux VPS
behind nginx with TLS via Let's Encrypt.

---

## 1. Server prerequisites

Tested on Ubuntu 22.04 / 24.04. Adjust paths for other distros.

```bash
# Node.js 20 LTS (>=18 required)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# PostgreSQL (server + client tools — pg_dump and psql are required for the
# admin dashboard backup/restore feature)
sudo apt install -y postgresql postgresql-contrib postgresql-client

# nginx + certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Process manager (run bot as a service)
sudo npm install -g pm2
```

Create the database:

```bash
sudo -u postgres psql -c "CREATE USER qtassist WITH PASSWORD 'changeme';"
sudo -u postgres psql -c "CREATE DATABASE qtassist_bot OWNER qtassist;"
```

---

## 2. Clone and configure

```bash
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251

# Backend deps
npm install

# Build the admin dashboard SPA (creates web-admin/dist/)
npm run build:web

# Configure environment
cp .env.example .env
nano .env
```

Fill these required values in `.env`:

| Variable | Notes |
|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` | App ID and target server ID |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Postgres credentials |
| `PAYMENT_REVIEW_CHANNEL_ID`, `PAYMENT_UPLOAD_CHANNEL_ID` | Discord channels |
| `BANK_NAMES`, `ACCOUNT_NUMBERS`, `ACCOUNT_HOLDERS` | Pipe-separated bank info |
| `WEB_PORT` | Port for admin web (default 3000) |
| `ADMIN_USERNAME` | First admin username |
| `ADMIN_PASSWORD_HASH` | bcrypt hash, see below |
| `JWT_SECRET` | Random hex string, see below |
| `NODE_ENV` | Set to `production` |

Optional values: `GOOGLE_*` (Sheets sync), `MOD_LOG_CHANNEL_ID`,
`TEMP_ROLE_NOTIFICATION_CHANNEL_ID`, `QTRADES_LOGO_URL`,
`SESSION_COOKIE_NAME`.

### Generate the admin password hash

```bash
npm run hash-password -- 'yourStrongPasswordHere'
```

Copy the output line into `.env` as `ADMIN_PASSWORD_HASH=...`. The plaintext
password is never stored anywhere.

### Generate a JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into `.env` as `JWT_SECRET=...`. Treat it like a password —
never commit it.

---

## 3. Deploy slash commands and start the bot

```bash
# Register slash commands with Discord (run once after a fresh deploy or
# whenever you add/remove commands)
npm run deploy

# Start under pm2
pm2 start src/index.js --name qtassist
pm2 save
pm2 startup    # follow the printed instructions to enable boot autostart
```

You should see `🌐 Admin web server listening on port 3000` in
`pm2 logs qtassist`. Verify locally before fronting nginx:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","uptime": 12.34}
```

---

## 4. nginx + TLS

Copy the example config and edit the `server_name`:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/qtassist
sudo nano /etc/nginx/sites-available/qtassist
# replace `your-domain.com` with your real domain (twice)

sudo ln -s /etc/nginx/sites-available/qtassist /etc/nginx/sites-enabled/qtassist

# Disable the default site if it would conflict
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

Issue a Let's Encrypt cert:

```bash
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
```

certbot will fill in the `ssl_certificate` paths automatically. Renewal is
handled by the `certbot.timer` systemd unit.

DNS: point an A record (and AAAA if you want IPv6) for `your-domain.com` to
your VPS public IP before running certbot.

---

## 5. Verify

Open `https://your-domain.com/` in a browser. You should see the QTAssist
admin login screen. Log in with the username and password you set above.

The dashboard shows revenue, pending reviews, recent transactions, and lets
you approve/reject payments, edit products, manage temp roles, and inspect
email bindings — all backed by the same database the bot uses.

---

## 6. Routine operations

| Task | Command |
|---|---|
| View logs | `pm2 logs qtassist` |
| Restart bot | `pm2 restart qtassist` |
| Update code | `git pull && npm install && npm run build:web && pm2 restart qtassist` |
| Rotate admin password | `npm run hash-password -- 'newPassword'` then update `.env` and `pm2 restart qtassist` |
| Rotate JWT secret | Update `JWT_SECRET` in `.env` and restart. All existing sessions are invalidated |
| Add second admin | Insert a row into the `admin_users` table with bcrypt hash. (Future: a UI for this) |

---

## 7. Hardening checklist

- [ ] `NODE_ENV=production` in `.env`
- [ ] UFW or another firewall: only allow 22, 80, 443 inbound
- [ ] PostgreSQL `pg_hba.conf` set to `local` or `host 127.0.0.1/32` only
- [ ] `JWT_SECRET` is at least 48 random bytes hex (96 chars)
- [ ] Password hash uses bcrypt (default cost 10)
- [ ] Discord bot has only the permissions it actually needs
- [ ] `.env` file is `chmod 600` and owned by the deploy user
- [ ] Regular Postgres backups (`pg_dump`) or volume snapshots

## 8. Database backups (automated to Google Drive)

The bot runs a daily cron at 03:00 Asia/Jakarta that calls `pg_dump`,
gzips the output, and uploads the file to a `QTAssist Backups` folder
on the Google service account's Drive. Auto-retention keeps the 30
most recent daily backups plus 12 monthly backups (the first backup of
each calendar month).

You can also trigger a manual backup or restore from the dashboard at
**Tools → Backup Database**:

- **Backup sekarang** — runs `pg_dump` immediately and uploads to
  Drive. Optional note is stored in the file metadata.
- **Download** — streams the `.sql.gz` from Drive back through the
  bot to your browser.
- **Restore** — replaces the entire current database with the contents
  of the chosen backup. Requires typing `RESTORE` to confirm.
- **Restore dari file** — same as above, but you upload a `.sql.gz`
  from your computer instead of selecting one already in Drive.

Requirements:

- `pg_dump` and `psql` must be on the host's PATH
  (`apt install postgresql-client` on Debian/Ubuntu).
- The `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` env vars
  are reused — no extra credential is required. The "QTAssist Backups"
  folder is created on first use and lives in the service account's
  own Drive.
- To download backups manually, share the folder with your personal
  Google account (the bot does not do this for you, on purpose):

```
# Find the folder ID once via the dashboard logs or the Drive API,
# then in Google Sheets / Drive UI share the folder with your email.
```

Restoring is destructive: every table is dropped and recreated from the
SQL dump. The dashboard requires you to type `RESTORE` before the call
goes through.
