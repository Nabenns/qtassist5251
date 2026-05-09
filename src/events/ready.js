module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
    console.log(`👤 Total users: ${client.users.cache.size}`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: '/temprole help', type: 3 }], // 3 = Watching
      status: 'online',
    });

    console.log('✅ Bot is ready!');
  },
};
