const { EmbedBuilder } = require('discord.js');

// Modern color palette
const COLORS = {
  SUCCESS: 0x2ecc71,    // Modern green
  ERROR: 0xe74c3c,      // Modern red
  INFO: 0x3498db,       // Modern blue
  WARNING: 0xf39c12,    // Modern orange
  PRIMARY: 0x9b59b6     // Modern purple
};

/**
 * Create success embed with enhanced styling
 */
function createSuccessEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
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
 * Create error embed with enhanced styling
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create info embed with enhanced styling
 */
function createInfoEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`📋 ${title}`)
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
 * Create warning embed with enhanced styling
 */
function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  createSuccessEmbed,
  createErrorEmbed,
  createInfoEmbed,
  createWarningEmbed,
  COLORS
};
