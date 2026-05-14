const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Transaction, Product, TemporaryRole, ModerationLog } = require('../../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');
const { formatDuration } = require('../../utils/parseDuration');
const { syncTransactionToSheets } = require('../../services/googleSheetsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transaction-process')
    .setDescription('Manually approve a pending transaction (Admin only)')
    .addStringOption(option =>
      option.setName('order_id')
        .setDescription('Order ID to approve')
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

      if (transaction.status === 'approved') {
        return interaction.editReply({
          embeds: [createInfoEmbed('Already Processed', 'This transaction has already been approved and the role has been assigned.')]
        });
      }

      if (transaction.status === 'rejected' || transaction.status === 'cancelled' || transaction.status === 'expired') {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Cannot Process',
            `This transaction is **${transaction.status}** and cannot be approved. Ask the user to create a new purchase.`
          )]
        });
      }

      // Get product and role
      const product = transaction.product;
      if (!product) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Product Not Found', 'The product for this transaction no longer exists.')]
        });
      }

      const role = guild.roles.cache.get(product.roleId);
      if (!role) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Role Not Found', 'The role for this product no longer exists in this server.')]
        });
      }

      // Fetch user and member
      const user = await interaction.client.users.fetch(transaction.userId);
      const member = await guild.members.fetch(transaction.userId).catch(() => null);

      if (!member) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Member Not Found', 'The user is no longer in this server.')]
        });
      }

      // Update transaction status
      await transaction.update({
        status: 'approved',
        paidAt: new Date(),
        reviewedBy: interaction.user.id,
        reviewedAt: new Date()
      });

      // Role stacking: extend if user already has an active temp role for this role
      const existingTempRole = await TemporaryRole.findOne({
        where: {
          serverId: guild.id,
          userId: transaction.userId,
          roleId: role.id
        }
      });

      let expiryDate;
      const now = new Date();

      if (existingTempRole && existingTempRole.expiresAt > now) {
        // Extend from current expiry
        expiryDate = new Date(existingTempRole.expiresAt.getTime() + parseInt(product.duration));
        await existingTempRole.update({
          expiresAt: expiryDate,
          notified24h: false,
          notified1h: false
        });
      } else {
        // Create fresh entry (replacing expired one if any)
        expiryDate = new Date(Date.now() + parseInt(product.duration));
        if (existingTempRole) {
          await existingTempRole.destroy();
        }
        await TemporaryRole.create({
          serverId: guild.id,
          userId: transaction.userId,
          roleId: role.id,
          grantedAt: new Date(),
          expiresAt: expiryDate,
          grantedBy: interaction.user.id,
          reason: `Manually approved: ${product.name} (Order: ${orderId})`,
          notified24h: false,
          notified1h: false
        });
      }

      // Add role if not already present
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }

      // Log moderation action
      await ModerationLog.create({
        actionType: 'temprole_add',
        moderatorId: interaction.user.id,
        targetUserId: transaction.userId,
        roleId: role.id,
        reason: `Manually approved transaction - Order: ${orderId}`,
        expiryTime: expiryDate,
        additionalData: {
          orderId: transaction.orderId,
          amount: transaction.amount,
          productId: product.id,
          productName: product.name
        }
      });

      // Format price
      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(transaction.amount);

      const expiryTimestamp = Math.floor(expiryDate.getTime() / 1000);

      // Send success message to admin
      const adminEmbed = createSuccessEmbed(
        'Transaction Approved',
        `Payment approved and ${role} assigned to ${user}`,
        [
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Product', value: product.name, inline: true },
          { name: 'Amount', value: formattedPrice, inline: true },
          { name: 'Duration', value: formatDuration(product.duration), inline: true },
          { name: 'Order ID', value: orderId, inline: false },
          { name: 'Expires', value: `<t:${expiryTimestamp}:R>`, inline: true }
        ]
      );

      adminEmbed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

      await interaction.editReply({ embeds: [adminEmbed] });

      // Send DM notification to user
      try {
        const userEmbed = createSuccessEmbed(
          'Pembayaran Disetujui!',
          `Pembayaran kamu telah disetujui dan ${role} sudah diberikan!`,
          [
            { name: '📦 Produk', value: product.name, inline: true },
            { name: '💰 Jumlah', value: formattedPrice, inline: true },
            { name: '⏱️ Durasi', value: formatDuration(product.duration), inline: true },
            { name: '⏳ Kadaluarsa', value: `<t:${expiryTimestamp}:R>`, inline: true }
          ]
        );

        userEmbed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

        await user.send({ embeds: [userEmbed] });
      } catch (error) {
        console.log(`Could not send DM to ${user.tag}`);
      }

      // Sync to Google Sheets
      try {
        await syncTransactionToSheets(transaction, guild);
      } catch (error) {
        console.log('Could not sync to Google Sheets:', error.message);
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
