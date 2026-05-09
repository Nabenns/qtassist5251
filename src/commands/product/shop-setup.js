const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Product } = require('../../database/models');
const { formatDuration } = require('../../utils/parseDuration');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL, COLORS } = require('../../utils/embedBuilder');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop-setup')
    .setDescription('Setup shop message with purchase buttons')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send shop message')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    try {
      // Fetch all active products
      const products = await Product.findAll({
        where: {
          serverId: guild.id,
          isActive: true
        },
        order: [['price', 'ASC']]
      });

      if (products.length === 0) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'No Products Found',
            'No active products found. Create products first using `/product-create`.'
          )]
        });
      }

      // Build shop embed
      const shopEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🛒 QTrades Role Shop')
        .setDescription('Purchase exclusive roles with various durations!\n\n**How to purchase:**\n1. Click the button below for the role you want\n2. Complete payment via QRIS\n3. Role will be assigned automatically after payment\n\n**Available Packages:**')
        .setTimestamp();

      // Add products to embed
      for (const product of products) {
        const role = guild.roles.cache.get(product.roleId);
        const roleName = role ? `<@&${role.id}>` : 'Unknown Role';

        const formattedPrice = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(product.price);

        shopEmbed.addFields({
          name: `${product.name}`,
          value: `${roleName}\n💰 **Price:** ${formattedPrice}\n⏱️ **Duration:** ${formatDuration(product.duration)}\n📝 ${product.description}`,
          inline: false
        });
      }

      shopEmbed.setFooter({
        text: 'QTrades - Secure Payment via Midtrans',
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      });

      if (QTRADES_LOGO_URL) {
        shopEmbed.setThumbnail(QTRADES_LOGO_URL);
      }

      // Build buttons (max 5 buttons per row, max 5 rows)
      const buttons = [];
      for (let i = 0; i < Math.min(products.length, 25); i++) {
        const product = products[i];
        const role = guild.roles.cache.get(product.roleId);

        const button = new ButtonBuilder()
          .setCustomId(`buy_product_${product.id}`)
          .setLabel(`Buy ${product.name}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('💳');

        buttons.push(button);
      }

      // Group buttons into rows (max 5 buttons per row)
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder()
          .addComponents(buttons.slice(i, i + 5));
        rows.push(row);
      }

      // Send shop message
      const shopMessage = await channel.send({
        embeds: [shopEmbed],
        components: rows
      });

      // Send confirmation
      const confirmEmbed = createSuccessEmbed(
        'Shop Setup Complete',
        `Shop message sent to ${channel}`,
        [
          { name: 'Products', value: `${products.length} active products`, inline: true },
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Message ID', value: shopMessage.id, inline: true }
        ]
      );

      confirmEmbed.setFooter({
        text: 'Users can now purchase roles by clicking the buttons',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [confirmEmbed] });

    } catch (error) {
      console.error('Error setting up shop:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while setting up the shop. Please try again.'
        )]
      });
    }
  }
};
