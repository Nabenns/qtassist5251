const { Transaction, Product, TemporaryRole } = require('../database/models');
const { getTransactionStatus } = require('../services/midtransService');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');

async function handleRefreshPayment(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const orderId = interaction.customId.replace('refresh_payment_', '');
  const user = interaction.user;
  const guild = interaction.guild;

  try {
    // Find transaction in database
    const transaction = await Transaction.findOne({
      where: {
        orderId: orderId,
        userId: user.id,
        serverId: guild.id
      },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!transaction) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Transaction Not Found',
          'Could not find this transaction.'
        )]
      });
    }

    if (transaction.status === 'paid') {
      return interaction.editReply({
        embeds: [createSuccessEmbed(
          'Payment Already Processed',
          'This payment has already been processed and your role has been assigned!'
        )]
      });
    }

    // Check payment status from Midtrans
    const statusResult = await getTransactionStatus(orderId);

    if (!statusResult.success) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error Checking Status',
          'Failed to check payment status. Please try again later.'
        )]
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

    if (isPaid && transaction.status !== 'paid') {
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
          embeds: [createErrorEmbed(
            'Role Not Found',
            'Payment successful but the role no longer exists.'
          )]
        });
      }

      // Assign role
      const member = await guild.members.fetch(user.id);
      await member.roles.add(role);

      // Calculate expiry time
      const expiryDate = new Date(Date.now() + parseInt(product.duration));

      // Create temporary role entry
      await TemporaryRole.create({
        serverId: guild.id,
        userId: user.id,
        roleId: role.id,
        grantedAt: new Date(),
        expiresAt: expiryDate,
        grantedBy: interaction.client.user.id,
        reason: `Purchased: ${product.name}`
      });

      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(transaction.amount);

      const embed = createSuccessEmbed(
        'Payment Successful!',
        `Your payment has been confirmed and ${role} has been assigned!`,
        [
          { name: 'Product', value: product.name, inline: true },
          { name: 'Amount', value: formattedPrice, inline: true },
          { name: 'Duration', value: formatDuration(product.duration), inline: true },
          { name: 'Expires', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: true }
        ]
      );

      embed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

      await interaction.editReply({ embeds: [embed] });

      // Send DM notification
      try {
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.log(`Could not send DM to ${user.tag}`);
      }

    } else if (transactionStatus === 'pending') {
      return interaction.editReply({
        embeds: [createInfoEmbed(
          'Payment Pending',
          `Your payment is still pending. Status: **${transactionStatus}**\n\nPlease complete the payment and try refreshing again.`
        )]
      });
    } else if (transactionStatus === 'expire') {
      await transaction.update({ status: 'expired' });
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Payment Expired',
          'This payment has expired. Please create a new purchase.'
        )]
      });
    } else {
      return interaction.editReply({
        embeds: [createInfoEmbed(
          'Payment Not Completed',
          `Payment status: **${transactionStatus}**\n\nPlease complete the payment first.`
        )]
      });
    }

  } catch (error) {
    console.error('Error handling refresh payment:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'An error occurred while checking payment status. Please try again.'
      )]
    });
  }
}

module.exports = { handleRefreshPayment };
