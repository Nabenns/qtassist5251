const { syncActiveUsersToSheets } = require('../services/googleSheetsService');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    console.log(`👤 Total users: ${client.users.cache.size}`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: '/temprole help', type: 3 }], // 3 = Watching
      status: 'online',
    });

    console.log('✅ Bot is ready!');

    // Sync existing active users to Google Sheets
    for (const guild of client.guilds.cache.values()) {
      try {
        await syncActiveUsersToSheets(guild);
      } catch (error) {
        console.error(`❌ Error syncing active users for guild ${guild.id}:`, error.message);
      }
    }
  },
};
