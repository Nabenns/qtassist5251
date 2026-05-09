# Quick Start Guide - QTAssist Discord Bot

**Repository**: https://github.com/Nabenns/qtassist5251.git

---

## For Bot Users

### Available Commands (Phase 1)

All commands use Discord's slash command system - type `/` to see available commands:

#### Temporary Role Management

**`/temprole-add`**
- Assign temporary role to user with automatic expiry
- Example: `/temprole-add user:@john role:@VIP duration:7d reason:Event winner`
- Supports: minutes (m), hours (h), days (d), weeks (w)
- Combinations: `1d12h30m` = 1 day, 12 hours, 30 minutes

**`/temprole-remove`**
- Remove temporary role before it expires
- Example: `/temprole-remove user:@john role:@VIP`

**`/temprole-list`**
- View all active temporary roles
- Example: `/temprole-list` (all) or `/temprole-list user:@john` (filter)

**`/temprole-extend`**
- Extend the duration of temporary role
- Example: `/temprole-extend user:@john role:@VIP additional_time:3d`

### Features

✅ **Auto-Removal**: Roles automatically removed when expired (checked every minute)
✅ **Notifications**: DM sent 24h before, 1h before, and when role expires
✅ **Multiple Roles**: Users can have unlimited temporary roles
✅ **Smart Detection**: Skips if user already has permanent role
✅ **Role Hierarchy**: Validates bot can manage the role

---

## For Developers/AI

### Phase 1 Complete ✅

**Status**: Production ready
**Commits**: 3 commits pushed to GitHub
**Files**: 21 files created

#### What's Implemented:

1. **Core Commands** (4 commands)
   - `/temprole-add`, `/temprole-remove`, `/temprole-list`, `/temprole-extend`

2. **Database** (PostgreSQL + Sequelize)
   - TemporaryRole model
   - ModerationLog model
   - Auto-sync enabled

3. **Background Worker** (node-cron)
   - Auto-removal every 1 minute
   - Notifications every 5 minutes

4. **Utilities**
   - Duration parser (supports 1m, 1h, 1d, 7d, 1w)
   - Embed builder (4 types)

5. **Documentation**
   - README.md
   - SETUP.md (complete guide)
   - PROGRESS.md (development tracking)

### Next: Phase 2 (Templates & Bulk)

**Status**: Not started (0%)
**Target**: 2 weeks

**Tasks**:
1. Create RoleTemplate & TemplateRole models
2. Implement 4 template commands
3. Implement autocomplete
4. Implement bulk operations
5. Testing & docs

**Full details**: See [PROGRESS.md](PROGRESS.md)

### Quick Commands

```bash
# Setup
git clone https://github.com/Nabenns/qtassist5251.git
cd qtassist5251
npm install
cp .env.example .env
# Edit .env with your config
npm run deploy
npm start

# Development
npm run dev              # Auto-reload
npm run deploy           # Deploy slash commands

# Git workflow
git add .
git commit -m "Your message"
git push origin main     # ALWAYS PUSH!
```

### Files Structure

```
qtassist5251/
├── PROGRESS.md          ← Development tracking (READ THIS FIRST)
├── README.md            ← Project overview
├── QUICK-START.md       ← This file
├── .env.example         ← Environment template
├── package.json         ← Dependencies
├── src/
│   ├── index.js         ← Entry point
│   ├── deploy-commands.js
│   ├── commands/temprole/    ← 4 commands ✅
│   ├── events/               ← ready, interactionCreate ✅
│   ├── database/models/      ← TemporaryRole, ModerationLog ✅
│   ├── services/             ← cronService ✅
│   └── utils/                ← parseDuration, embedBuilder ✅
└── docs/
    └── SETUP.md         ← Complete setup guide
```

### Environment Variables Required

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_server_id

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qtassist_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Optional (for notifications)
MOD_LOG_CHANNEL_ID=
TEMP_ROLE_NOTIFICATION_CHANNEL_ID=
```

### Key Decisions (DO NOT CHANGE)

- ✅ Node.js (NOT Python)
- ✅ Discord.js v14
- ✅ PostgreSQL (NOT SQLite/MongoDB)
- ✅ Slash commands ONLY (NOT prefix like `!`)
- ✅ Single server (NOT multi-server)
- ✅ VPS hosting

### Important Links

- **Repository**: https://github.com/Nabenns/qtassist5251.git
- **PRD**: [discord-bot-prd.md](../discord-bot-prd.md)
- **Progress Tracking**: [PROGRESS.md](PROGRESS.md)
- **Setup Guide**: [docs/SETUP.md](docs/SETUP.md)

---

## Testing Checklist

Before pushing new code:

- [ ] Code runs without errors
- [ ] Slash commands deployed (`npm run deploy`)
- [ ] Commands work in Discord
- [ ] Database updates correctly
- [ ] Error handling works
- [ ] Documentation updated
- [ ] **Pushed to GitHub** ⚠️

---

## Critical Reminders

1. **ALWAYS PUSH TO GITHUB** after changes
2. Never commit `.env` file (use `.env.example`)
3. Never commit credentials or tokens
4. Test in development server first
5. Read [PROGRESS.md](PROGRESS.md) for detailed tasks
6. Follow existing code style
7. Add error handling (try-catch)
8. Update documentation

---

**Current Phase**: Phase 1 Complete ✅
**Next Task**: Phase 2 - Role Templates & Bulk Operations
**Repository**: https://github.com/Nabenns/qtassist5251.git

**Last Updated**: 2026-05-09
