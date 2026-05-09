const { EmbedBuilder } = require('discord.js');

/**
 * Create success embed
 */
function createSuccessEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00) // Green
    .setTitle(`✅ ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

/**
 * Create error embed
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xff0000) // Red
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create info embed
 */
function createInfoEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff) // Blue
    .setTitle(`ℹ️ ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

/**
 * Create warning embed
 */
function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xffaa00) // Orange/Yellow
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createWarningEmbed
};
