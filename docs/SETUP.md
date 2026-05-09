# Setup Guide - QTAssist Discord Bot

Complete setup guide for deploying the QTAssist Discord Bot.

## Prerequisites

- Node.js v16.9.0 or higher
- PostgreSQL 12 or higher
- Discord Bot Token
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

### 3.4 Get Client ID

1. Go to "OAuth2" > "General" in the left sidebar
2. Copy the "CLIENT ID" (you'll need this for `.env`)

### 3.5 Invite Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ Manage Roles
   - ✅ Kick Members
   - ✅ Ban Members
   - ✅ Manage Messages
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
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
sudo apt install postgresql postgresql-contrib
```

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

2. Edit `.env` with your favorite text editor:
```bash
nano .env
```

3. Fill in all required values:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_server_guild_id_here

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qtassist_bot
DB_USER=postgres
DB_PASSWORD=your_database_password

# Google Sheets API Configuration (Phase 3 - leave empty for now)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SPREADSHEET_ID=

# Bot Configuration (get these channel IDs after bot is running)
MOD_LOG_CHANNEL_ID=
TEMP_ROLE_NOTIFICATION_CHANNEL_ID=

# Environment
NODE_ENV=development
```

### How to get Channel IDs:
1. In Discord (with Developer Mode enabled)
2. Right-click any channel
3. Click "Copy Channel ID"

## Step 6: Deploy Slash Commands

```bash
npm run deploy
```

You should see output like:
```
✅ Loaded command: temprole-add
✅ Loaded command: temprole-remove
✅ Loaded command: temprole-list
✅ Loaded command: temprole-extend
🚀 Started refreshing 4 application (/) commands.
✅ Successfully reloaded 4 guild (/) commands.
```

## Step 7: Start the Bot

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
✅ Loaded command: temprole-add
✅ Loaded command: temprole-remove
✅ Loaded command: temprole-list
✅ Loaded command: temprole-extend
✅ Loaded event: ready
✅ Loaded event: interactionCreate
⏰ Starting cron jobs...
✅ Cron jobs started successfully.
✅ Logged in as YourBotName#1234
📊 Serving 1 server(s)
✅ Bot is ready!
```

## Step 8: Test the Bot

1. Go to your Discord server
2. Type `/` and you should see the bot's commands
3. Try `/temprole-add` to test:
   - Select a user
   - Select a role (make sure bot's role is higher in role hierarchy)
   - Enter duration (e.g., `30m`, `1h`, `1d`)
   - Add a reason (optional)

## Step 9: Production Deployment (VPS)

### Using PM2 (Recommended)

1. Install PM2:
```bash
npm install -g pm2
```

2. Start bot with PM2:
```bash
pm2 start src/index.js --name qtassist-bot
```

3. Save PM2 configuration:
```bash
pm2 save
```

4. Setup PM2 to start on boot:
```bash
pm2 startup
```

5. Useful PM2 commands:
```bash
pm2 status              # Check status
pm2 logs qtassist-bot   # View logs
pm2 restart qtassist-bot # Restart bot
pm2 stop qtassist-bot   # Stop bot
pm2 monit               # Monitor resources
```

### Using systemd (Alternative)

1. Create service file:
```bash
sudo nano /etc/systemd/system/qtassist-bot.service
```

2. Add configuration:
```ini
[Unit]
Description=QTAssist Discord Bot
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/qtassist5251
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=qtassist-bot

[Install]
WantedBy=multi-user.target
```

3. Start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable qtassist-bot
sudo systemctl start qtassist-bot
sudo systemctl status qtassist-bot
```

## Step 10: Setup Notification Channels (Optional)

1. Create a text channel in Discord (e.g., `#bot-logs` or `#mod-logs`)
2. Copy the channel ID (right-click > Copy Channel ID)
3. Update `.env`:
```env
TEMP_ROLE_NOTIFICATION_CHANNEL_ID=your_channel_id
```
4. Restart the bot

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

## Next Steps

- Configure notification channels
- Test all commands thoroughly
- Setup database backups
- Monitor bot performance
- Proceed to Phase 2 (Role Templates & Bulk Operations)

## Support

For issues or questions:
- Check logs: `pm2 logs qtassist-bot`
- Review [README.md](../README.md)
- Check Discord API status: https://discordstatus.com/

---

✅ Phase 1 Setup Complete!
