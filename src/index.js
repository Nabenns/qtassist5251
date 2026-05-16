const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./database/sequelize');
const { initDatabase } = require('./database/models');
const { startCronJobs } = require('./services/cronService');
const { initializeSheets, syncActiveUsersToSheets } = require('./services/googleSheetsService');
const { startWebServer } = require('./web/server');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Initialize commands collection
client.commands = new Collection();

let webServer = null;

// Load commands from subdirectories
function loadCommands(dir) {
  const commandFolders = fs.readdirSync(dir);

  for (const folder of commandFolders) {
    const folderPath = path.join(dir, folder);

    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.log(`⚠️ Warning: ${filePath} is missing required "data" or "execute" property.`);
      }
    }
  }
}

// Load events
function loadEvents(dir) {
  const eventFiles = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(dir, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`✅ Loaded event: ${event.name}`);
  }
}

// Initialize bot
async function init() {
  try {
    console.log('🚀 Starting QTAssist Discord Bot...');

    // Test database connection
    await testConnection();

    // Initialize database models
    await initDatabase();

    // Load commands
    const commandsPath = path.join(__dirname, 'commands');
    loadCommands(commandsPath);

    // Load events
    const eventsPath = path.join(__dirname, 'events');
    loadEvents(eventsPath);

    // Start cron jobs
    startCronJobs(client);

    // Initialize Google Sheets
    await initializeSheets();

    // Start admin web server (independent of Discord login so the dashboard
    // is reachable even if the gateway is having issues)
    webServer = startWebServer({
      getDiscordClient: () => (client && client.isReady() ? client : null)
    });

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);

  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (webServer) {
    try {
      await new Promise((resolve) => webServer.close(resolve));
      console.log('🌐 Web server closed');
    } catch (err) {
      console.error('Error closing web server:', err);
    }
  }
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Start bot
init();
