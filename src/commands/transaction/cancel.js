const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Transaction, Product } = require('../../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transaction-cancel')
    .setDescription('Cancel a pending transaction (Admin only)')
    .addStringOption(option =>
      option.setName('order_id')
        .setDescription('Order ID to cancel (optional - shows list if not provided)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const orderId = interaction.options.getString('order_id');

    // If no order ID provided, show list of pending transactions
    if (!orderId) {
      const pendingTransactions = await Transaction.findAll({
        where: {
          serverId: interaction.guild.id,
          status: 'pending'
        },
        include: [{
          model: Product,
          as: 'product'
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      if (pendingTransactions.length === 0) {
        return interaction.reply({
          embeds: [createInfoEmbed(
            'No Pending Transactions',
            'There are no pending transactions to cancel.'
          )],
          ephemeral: true
        });
      }

      const fields = pendingTransactions.map(tx => {
        const formattedPrice = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(tx.amount);

        const user = `<@${tx.userId}>`;
        const createdAt = `<t:${Math.floor(new Date(tx.createdAt).getTime() / 1000)}:R>`;

        return {
          name: `Order: ${tx.orderId}`,
          value: `User: ${user}\nProduct: ${tx.product?.name || 'Unknown'}\nAmount: ${formattedPrice}\nCreated: ${createdAt}`,
          inline: false
        };
      });

      const embed = createInfoEmbed(
        'Pending Transactions',
        `Found ${pendingTransactions.length} pending transaction(s). Use \`/transaction-cancel order_id:<ORDER_ID>\` to cancel a specific transaction.`,
        fields
      );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Cancel specific transaction
    const transaction = await Transaction.findOne({
      where: {
        orderId: orderId,
        serverId: interaction.guild.id
      },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!transaction) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Transaction Not Found',
          `No transaction found with Order ID: \`${orderId}\``
        )],
        ephemeral: true
      });
    }

    if (transaction.status !== 'pending') {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Cannot Cancel',
          `This transaction is already \`${transaction.status}\`. Only pending transactions can be cancelled.`
        )],
        ephemeral: true
      });
    }

    // Update transaction status to cancelled
    await transaction.update({ status: 'cancelled' });

    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(transaction.amount);

    const embed = createSuccessEmbed(
      'Transaction Cancelled',
      `Successfully cancelled transaction for <@${transaction.userId}>`,
      [
        { name: 'Order ID', value: transaction.orderId, inline: true },
        { name: 'Product', value: transaction.product?.name || 'Unknown', inline: true },
        { name: 'Amount', value: formattedPrice, inline: true }
      ]
    );

    await interaction.reply({ embeds: [embed] });

    // Try to notify user
    try {
      const user = await interaction.client.users.fetch(transaction.userId);
      const dmEmbed = createInfoEmbed(
        'Transaction Cancelled',
        `Your transaction for **${transaction.product?.name || 'Unknown Product'}** has been cancelled by an administrator.`,
        [
          { name: 'Order ID', value: transaction.orderId, inline: true },
          { name: 'Amount', value: formattedPrice, inline: true }
        ]
      );

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.log(`Could not notify user ${transaction.userId} about cancelled transaction`);
    }
  }
};
