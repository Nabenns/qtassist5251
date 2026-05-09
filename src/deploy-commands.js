const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];

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
        commands.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.log(`⚠️ Warning: ${filePath} is missing required "data" or "execute" property.`);
      }
    }
  }
}

// Load all commands
const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    // Register commands to specific guild (faster for development)
    if (process.env.DISCORD_GUILD_ID) {
      const data = await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commands },
      );

      console.log(`✅ Successfully reloaded ${data.length} guild (/) commands.`);
    } else {
      // Register commands globally (takes up to 1 hour to propagate)
      const data = await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands },
      );

      console.log(`✅ Successfully reloaded ${data.length} global (/) commands.`);
      console.log('⚠️ Note: Global commands may take up to 1 hour to appear in Discord.');
    }

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
