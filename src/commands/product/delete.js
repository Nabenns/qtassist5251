const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Product } = require('../../database/models');
const { formatDuration } = require('../../utils/parseDuration');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('product-delete')
    .setDescription('Delete a role product')
    .addIntegerOption(option =>
      option
        .setName('product_id')
        .setDescription('Product ID to delete')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const productId = interaction.options.getInteger('product_id');
    const guild = interaction.guild;

    try {
      // Find product
      const product = await Product.findOne({
        where: {
          id: productId,
          serverId: guild.id
        }
      });

      if (!product) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Product Not Found',
            `Product #${productId} not found in this server.`
          )]
        });
      }

      const role = guild.roles.cache.get(product.roleId);
      const roleName = role ? role.name : `Role ID: ${product.roleId}`;

      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(product.price);

      // Delete product
      await product.destroy();

      // Send success message
      const embed = createSuccessEmbed(
        'Product Deleted',
        `Successfully deleted product #${productId}`,
        [
          { name: 'Product Name', value: product.name, inline: true },
          { name: 'Role', value: roleName, inline: true },
          { name: 'Price', value: formattedPrice, inline: true },
          { name: 'Duration', value: formatDuration(product.duration), inline: true }
        ]
      );

      embed.setFooter({
        text: 'This product has been permanently deleted',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error deleting product:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while deleting the product. Please try again.'
        )]
      });
    }
  }
};
