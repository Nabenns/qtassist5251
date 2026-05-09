const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Product } = require('../../database/models');
const { formatDuration } = require('../../utils/parseDuration');
const { createInfoEmbed, createErrorEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('product-list')
    .setDescription('View all role products')
    .addBooleanOption(option =>
      option
        .setName('show_inactive')
        .setDescription('Show inactive products (default: false)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const showInactive = interaction.options.getBoolean('show_inactive') || false;
    const guild = interaction.guild;

    try {
      // Build query
      const whereClause = {
        serverId: guild.id
      };

      if (!showInactive) {
        whereClause.isActive = true;
      }

      // Fetch products
      const products = await Product.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      if (products.length === 0) {
        const message = showInactive
          ? 'No products found.'
          : 'No active products found. Use `/product-create` to create one.';

        return interaction.editReply({
          embeds: [createInfoEmbed('Role Products', message)]
        });
      }

      // Build embed
      const title = showInactive
        ? `All Role Products (${products.length})`
        : `Active Role Products (${products.length})`;

      const description = `Total products in database: ${products.length}`;

      const embed = createInfoEmbed(title, description);

      // Add fields (max 25 fields per embed)
      let fieldCount = 0;
      const maxFields = 25;

      for (const product of products) {
        if (fieldCount >= maxFields) {
          embed.setFooter({
            text: `Showing first ${maxFields} products • Total: ${products.length}`,
            iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
          });
          break;
        }

        const role = guild.roles.cache.get(product.roleId);
        const roleName = role ? role.name : `Role ID: ${product.roleId}`;

        const formattedPrice = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(product.price);

        const status = product.isActive ? '✅ Active' : '❌ Inactive';

        const fieldValue = [
          `**Role:** ${roleName}`,
          `**Price:** ${formattedPrice}`,
          `**Duration:** ${formatDuration(product.duration)}`,
          `**Status:** ${status}`,
          product.description ? `**Description:** ${product.description}` : ''
        ].filter(Boolean).join('\n');

        embed.addFields({
          name: `#${product.id} - ${product.name}`,
          value: fieldValue,
          inline: false
        });

        fieldCount++;
      }

      // Add default footer if not set
      if (!embed.data.footer) {
        embed.setFooter({
          text: `${products.length} product(s) • Use /product-edit to modify`,
          iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
        });
      }

      // Add thumbnail
      if (QTRADES_LOGO_URL) {
        embed.setThumbnail(QTRADES_LOGO_URL);
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing products:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while fetching products. Please try again.'
        )]
      });
    }
  }
};
