const { Product, Transaction } = require('../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { syncTransactionToSheets } = require('../services/googleSheetsService');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if user has pending upload
    if (!message.client.pendingUploads) return;

    const pending = message.client.pendingUploads.get(message.author.id);
    if (!pending) return;

    // Check if message is in the correct temp channel
    if (message.channel.id !== pending.tempChannelId) return;

    // Check if expired
    if (Date.now() > pending.expiresAt) {
      message.client.pendingUploads.delete(message.author.id);
      return;
    }

    try {
      // Check if message has image attachment
      const imageAttachment = message.attachments.find(att =>
        att.contentType && att.contentType.startsWith('image/')
      );

      if (!imageAttachment) {
        const errorMsg = await message.reply({
          embeds: [createErrorEmbed(
            'Bukan Gambar',
            'Silakan upload **gambar** bukti transfer (PNG, JPG, dll).'
          )]
        });

        // Auto delete after 5 seconds
        setTimeout(() => {
          message.delete().catch(() => {});
          errorMsg.delete().catch(() => {});
        }, 5000);
        return;
      }

      // Get transaction
      const transaction = await Transaction.findOne({
        where: { orderId: pending.orderId },
        include: [{
          model: Product,
          as: 'product'
        }]
      });

      if (!transaction) {
        await message.reply({
          embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Transaksi sudah tidak valid.')]
        });
        message.client.pendingUploads.delete(message.author.id);
        return;
      }

      // Update transaction with payment proof
      await transaction.update({
        paymentProofUrl: imageAttachment.url,
        status: 'pending_review'
      });

      // Send to admin review channel
      const notifChannelId = process.env.PAYMENT_REVIEW_CHANNEL_ID || process.env.MOD_LOG_CHANNEL_ID;
      const notifChannel = message.guild.channels.cache.get(notifChannelId);

      if (notifChannel) {
        const product = transaction.product;
        const role = message.guild.roles.cache.get(product.roleId);

        const formattedPrice = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(transaction.amount);

        const adminEmbed = createInfoEmbed(
          '💳 Review Pembayaran Baru',
          `<@${transaction.userId}> telah mengirim bukti pembayaran untuk **${product.name}**`,
          [
            { name: '👤 User', value: `<@${transaction.userId}>`, inline: true },
            { name: '📦 Produk', value: product.name, inline: true },
            { name: '🎭 Role', value: `${role}`, inline: true },
            { name: '💰 Jumlah', value: formattedPrice, inline: true },
            { name: '⏱️ Durasi', value: formatDuration(product.duration), inline: true },
            { name: '🔖 Order ID', value: `\`${pending.orderId}\``, inline: false }
          ]
        );

        adminEmbed.setImage(imageAttachment.url);

        const approveButton = new ButtonBuilder()
          .setCustomId(`approve_payment_${pending.orderId}`)
          .setLabel('✅ Terima')
          .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
          .setCustomId(`reject_payment_${pending.orderId}`)
          .setLabel('❌ Tolak')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);

        await notifChannel.send({ embeds: [adminEmbed], components: [row] });
      }

      // Notify user
      const successMsg = await message.reply({
        embeds: [createSuccessEmbed(
          'Bukti Pembayaran Terkirim',
          'Bukti pembayaran kamu berhasil dikirim ke admin. Silakan tunggu approval.',
          [
            { name: '🔖 Order ID', value: `\`${pending.orderId}\``, inline: true },
            { name: '📊 Status', value: '⏳ Menunggu Review', inline: true }
          ]
        )]
      });

      // Delete instruction message
      try {
        const instructionMsg = await message.channel.messages.fetch(pending.instructionMsgId);
        await instructionMsg.delete();
      } catch (error) {
        console.log('Could not delete instruction message');
      }

      // Auto delete messages after 10 seconds
      setTimeout(async () => {
        try {
          await message.delete();
          await successMsg.delete();
        } catch (error) {
          console.log('Could not delete messages');
        }
      }, 10000);

      // Remove from pending
      message.client.pendingUploads.delete(message.author.id);

      // Sync to Google Sheets
      try {
        await syncTransactionToSheets(transaction, message.guild);
      } catch (error) {
        console.log('Could not sync to Google Sheets:', error.message);
      }

    } catch (error) {
      console.error('Error processing payment proof upload:', error);
      await message.reply({
        embeds: [createErrorEmbed('Error', 'Gagal memproses bukti pembayaran. Silakan coba lagi.')]
      });
    }
  }
};
