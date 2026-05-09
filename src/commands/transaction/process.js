const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Transaction, Product, TemporaryRole } = require('../../database/models');
const { getTransactionStatus } = require('../../services/midtransService');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');
const { formatDuration } = require('../../utils/parseDuration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transaction-process')
    .setDescription('Manually process a paid transaction (Admin only)')
    .addStringOption(option =>
      option.setName('order_id')
        .setDescription('Order ID to process')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const orderId = interaction.options.getString('order_id');
    const guild = interaction.guild;

    try {
      // Find transaction in database
      const transaction = await Transaction.findOne({
        where: {
          orderId: orderId,
          serverId: guild.id
        },
        include: [{
          model: Product,
          as: 'product'
        }]
      });

      if (!transaction) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Transaction Not Found', `Could not find transaction with Order ID: **${orderId}**`)]
        });
      }

      if (transaction.status === 'paid') {
        return interaction.editReply({
          embeds: [createInfoEmbed('Already Processed', 'This transaction has already been processed and the role has been assigned.')]
        });
      }

      // Check payment status from Midtrans
      const statusResult = await getTransactionStatus(orderId);

      if (!statusResult.success) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Error Checking Status', `Failed to check payment status from Midtrans.\n\nError: ${statusResult.error || 'Unknown error'}`)]
        });
      }

      const { transactionStatus, fraudStatus } = statusResult;

      // Check if payment is successful
      let isPaid = false;
      if (transactionStatus === 'capture' && fraudStatus === 'accept') {
        isPaid = true;
      } else if (transactionStatus === 'settlement') {
        isPaid = true;
      }

      if (!isPaid) {
        return interaction.editReply({
          embeds: [createInfoEmbed(
            'Payment Not Completed',
            `Payment status from Midtrans: **${transactionStatus}**\n\nThis payment has not been completed yet. Please wait for the user to complete the payment first.`
          )]
        });
      }

      // Update transaction status
      await transaction.update({
        status: 'paid',
        paidAt: new Date()
      });

      // Get product and role
      const product = transaction.product;
      const role = guild.roles.cache.get(product.roleId);

      if (!role) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Role Not Found', 'Payment is successful but the role no longer exists in this server.')]
        });
      }

      // Get user and assign role
      const user = await interaction.client.users.fetch(transaction.userId);
      const member = await guild.members.fetch(transaction.userId);
      await member.roles.add(role);

      // Calculate expiry time
      const expiryDate = new Date(Date.now() + parseInt(product.duration));

      // Create temporary role entry
      await TemporaryRole.create({
        serverId: guild.id,
        userId: transaction.userId,
        roleId: role.id,
        grantedAt: new Date(),
        expiresAt: expiryDate,
        grantedBy: interaction.user.id,
        reason: `Manually processed: ${product.name}`
      });

      // Format price
      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(transaction.amount);

      // Send success message to admin
      const adminEmbed = createSuccessEmbed(
        'Transaction Processed Successfully',
        `Payment has been confirmed and ${role} has been assigned to ${user}`,
        [
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Product', value: product.name, inline: true },
          { name: 'Amount', value: formattedPrice, inline: true },
          { name: 'Duration', value: formatDuration(product.duration), inline: true },
          { name: 'Order ID', value: orderId, inline: false },
          { name: 'Expires', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: true }
        ]
      );

      adminEmbed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

      await interaction.editReply({ embeds: [adminEmbed] });

      // Send DM notification to user
      try {
        const userEmbed = createSuccessEmbed(
          'Payment Successful!',
          `Your payment has been confirmed and ${role} has been assigned!`,
          [
            { name: 'Product', value: product.name, inline: true },
            { name: 'Amount', value: formattedPrice, inline: true },
            { name: 'Duration', value: formatDuration(product.duration), inline: true },
            { name: 'Expires', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: true }
          ]
        );

        userEmbed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

        await user.send({ embeds: [userEmbed] });
      } catch (error) {
        console.log(`Could not send DM to ${user.tag}`);
      }

    } catch (error) {
      console.error('Error processing transaction:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          `An error occurred while processing the transaction.\n\n\`\`\`${error.message}\`\`\``
        )]
      });
    }
  }
};
