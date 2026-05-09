const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Product } = require('../../database/models');
const { parseDuration, formatDuration } = require('../../utils/parseDuration');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('product-create')
    .setDescription('Create a new role product for purchase')
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to sell')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Product name (e.g., "VIP Package", "Premium 30 Days")')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('price')
        .setDescription('Price in IDR (e.g., 50000 for Rp 50,000)')
        .setRequired(true)
        .setMinValue(1000)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Role duration (e.g., 30d, 7d, 1w)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Product description (optional)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('role');
    const name = interaction.options.getString('name');
    const price = interaction.options.getInteger('price');
    const durationStr = interaction.options.getString('duration');
    const description = interaction.options.getString('description') || 'No description provided';
    const guild = interaction.guild;

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Invalid Duration',
          'Invalid duration format. Use: 1d, 7d, 30d, 1w, etc.'
        )]
      });
    }

    try {
      // Check if product already exists for this role
      const existingProduct = await Product.findOne({
        where: {
          serverId: guild.id,
          roleId: role.id
        }
      });

      if (existingProduct) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Product Already Exists',
            `A product already exists for ${role}. Use \`/product-edit\` to modify it.`
          )]
        });
      }

      // Create product
      const product = await Product.create({
        serverId: guild.id,
        roleId: role.id,
        name: name,
        description: description,
        price: price,
        duration: durationMs,
        isActive: true
      });

      // Format price
      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(price);

      // Send success message
      const embed = createSuccessEmbed(
        'Product Created',
        `Successfully created new role product`,
        [
          { name: 'Product ID', value: `#${product.id}`, inline: true },
          { name: 'Name', value: name, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Price', value: formattedPrice, inline: true },
          { name: 'Duration', value: formatDuration(durationMs), inline: true },
          { name: 'Status', value: '✅ Active', inline: true },
          { name: 'Description', value: description, inline: false }
        ]
      );

      embed.setFooter({
        text: 'Use /shop-setup to display this product in your shop channel',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      })
      .setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error creating product:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while creating the product. Please try again.'
        )]
      });
    }
  }
};
