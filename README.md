# QTAssist Discord Bot

Discord bot with advanced temporary role management and Google Sheets integration.

## Features

### Phase 1 - Core Temporary Role System
- ✅ Slash commands for temporary role management
- ✅ Auto-removal when roles expire
- ✅ Notification system (24h, 1h before expiry)
- ✅ Multiple temporary roles per user
- ✅ Background worker for automated tasks

### Phase 2 - Advanced Features
- 🔄 Role templates for quick assignment
- 🔄 Bulk operations
- 🔄 Template usage tracking

### Phase 3 - Google Sheets Integration
- 🔄 Real-time sync to Google Sheets
- 🔄 3 sheets: Active Roles, History, Analytics
- 🔄 Auto-calculated formulas
- 🔄 Conditional formatting

## Commands

### Temporary Role Management
- `/temprole add` - Assign temporary role to user
- `/temprole remove` - Remove temporary role from user
- `/temprole list` - View all active temporary roles
- `/temprole extend` - Extend temporary role duration

### Moderation
- `/kick` - Kick user from server
- `/ban` - Ban user from server
- `/clear` - Clear messages

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
4. Create Service Account
5. Download credentials JSON
6. Add service account email and private key to `.env`

## Development Progress

**📊 See [PROGRESS.md](PROGRESS.md) for detailed development tracking and next steps.**

Current Status:
- ✅ Phase 1: Core Temporary Role System (100% Complete)
- ⏳ Phase 2: Role Templates & Bulk Operations (0%)
- ⏳ Phase 3: Google Sheets Integration (0%)
- ⏳ Phase 4: Testing & Additional Features (0%)

## Database Schema

See [DATABASE.md](./docs/DATABASE.md) for detailed schema documentation.

## Project Structure

```
qtassist5251/
├── src/
│   ├── commands/
│   │   ├── temprole/     # Temporary role commands
│   │   ├── moderation/   # Moderation commands
│   │   └── sheets/       # Google Sheets commands
│   ├── events/           # Discord event handlers
│   ├── utils/            # Utility functions
│   ├── database/         # Database models & migrations
│   ├── services/         # Business logic services
│   └── index.js          # Main entry point
├── config/               # Configuration files
├── .env.example          # Environment template
└── package.json
```

## Tech Stack

- **Discord.js v14** - Discord bot framework
- **PostgreSQL** - Database
- **Sequelize** - ORM
- **node-cron** - Background jobs
- **googleapis** - Google Sheets API

## Development Timeline

- **Week 1-3**: Core temporary role system ✅ (COMPLETED)
- **Week 4-5**: Role templates & bulk operations ⏳ (Next)
- **Week 6-7**: Google Sheets integration ⏳
- **Week 8**: Testing & deployment ⏳

## Documentation

- **[PROGRESS.md](PROGRESS.md)** - Development progress tracking (for AI/developers)
- **[docs/SETUP.md](docs/SETUP.md)** - Complete setup guide
- **[discord-bot-prd.md](../discord-bot-prd.md)** - Product Requirements Document

## License

MIT

## Author

[Your Name]

---

🤖 Generated with PRD v3.0
