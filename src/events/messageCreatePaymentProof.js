const { Product, Transaction } = require('../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { syncTransactionToSheets } = require('../services/googleSheetsService');
const { emitEvent } = require('../services/eventBus');

/**
 * Download an image attachment from Discord's CDN and return a Buffer.
 * Discord CDN URLs are signed and expire (~24h). To keep the proof viewable
 * after the user's original message is auto-deleted, we have to re-host the
 * image as an attachment on the admin review message.
 */
async function downloadAttachment(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download attachment: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only process messages in the configured payment upload channel.
    // This is the restart-safe gate: even if the in-memory pendingUploads Map is empty
    // (e.g. after a bot restart), we can still recover the user's pending transaction
    // from the database below.
    const uploadChannelId = process.env.PAYMENT_UPLOAD_CHANNEL_ID;
    if (!uploadChannelId || message.channel.id !== uploadChannelId) return;

    // Look up the active upload session in memory (preferred — gives us the
    // instruction message id to clean up). If missing (bot restarted), we
    // fall back to a DB lookup for the user's most recent pending transaction.
    let pending = message.client.pendingUploads
      ? message.client.pendingUploads.get(message.author.id)
      : null;

    if (pending && Date.now() > pending.expiresAt) {
      message.client.pendingUploads.delete(message.author.id);
      pending = null;
    }

    let transaction;

    if (pending) {
      transaction = await Transaction.findOne({
        where: { orderId: pending.orderId },
        include: [{ model: Product, as: 'product' }]
      });
    } else {
      // Restart-safe fallback: pick the user's most recent `pending` transaction
      // in this guild. Only `pending` (not yet uploaded), so we don't overwrite
      // a previously uploaded proof that's already in `pending_review`.
      transaction = await Transaction.findOne({
        where: {
          userId: message.author.id,
          serverId: message.guild.id,
          status: 'pending'
        },
        include: [{ model: Product, as: 'product' }],
        order: [['createdAt', 'DESC']]
      });

      if (!transaction) return; // user has no active upload session
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

      if (!transaction) {
        await message.reply({
          embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Transaksi sudah tidak valid.')]
        });
        if (pending && message.client.pendingUploads) {
          message.client.pendingUploads.delete(message.author.id);
        }
        return;
      }

      // Don't reprocess a transaction that's already under review or finalized
      if (transaction.status !== 'pending') {
        const errorMsg = await message.reply({
          embeds: [createInfoEmbed(
            'Sudah Diproses',
            `Bukti pembayaran untuk order ini sudah dalam status **${transaction.status}**. Tidak perlu upload ulang.`
          )]
        });
        setTimeout(() => {
          message.delete().catch(() => {});
          errorMsg.delete().catch(() => {});
        }, 5000);
        return;
      }

      const orderId = transaction.orderId;

      // Download the attachment buffer immediately. We re-upload it to the
      // admin review channel so the image stays viewable even after the
      // original (signed, expiring) Discord CDN URL becomes invalid and
      // after the user's source message is auto-deleted below.
      let proofBuffer;
      try {
        proofBuffer = await downloadAttachment(imageAttachment.url);
      } catch (error) {
        console.error('Failed to download payment proof:', error);
        await message.reply({
          embeds: [createErrorEmbed(
            'Gagal Memproses Gambar',
            'Bot tidak dapat mengunduh gambar bukti pembayaran. Silakan coba upload ulang.'
          )]
        });
        return;
      }

      // Build a stable filename. Keep extension if it's something common.
      const originalName = imageAttachment.name || 'proof.png';
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const proofFilename = `proof_${orderId}_${safeName}`;

      // Send to admin review channel
      const notifChannelId = process.env.PAYMENT_REVIEW_CHANNEL_ID || process.env.MOD_LOG_CHANNEL_ID;
      const notifChannel = notifChannelId
        ? message.guild.channels.cache.get(notifChannelId)
        : null;

      let persistentProofUrl = null;

      if (notifChannel) {
        const product = transaction.product;
        const role = product ? message.guild.roles.cache.get(product.roleId) : null;

        const formattedPrice = new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(transaction.amount);

        const adminEmbed = createInfoEmbed(
          '💳 Review Pembayaran Baru',
          `<@${transaction.userId}> telah mengirim bukti pembayaran untuk **${product ? product.name : 'Unknown Product'}**`,
          [
            { name: '👤 User', value: `<@${transaction.userId}>`, inline: true },
            { name: '📦 Produk', value: product ? product.name : 'Unknown', inline: true },
            { name: '🎭 Role', value: role ? `${role}` : '_role hilang_', inline: true },
            { name: '💰 Jumlah', value: formattedPrice, inline: true },
            { name: '⏱️ Durasi', value: product ? formatDuration(product.duration) : '-', inline: true },
            { name: '🔖 Order ID', value: `\`${orderId}\``, inline: false }
          ]
        );

        // Reference the re-uploaded attachment via attachment:// scheme so the
        // embed renders the image hosted on the admin message itself.
        adminEmbed.setImage(`attachment://${proofFilename}`);

        const proofAttachment = new AttachmentBuilder(proofBuffer, { name: proofFilename });

        const approveButton = new ButtonBuilder()
          .setCustomId(`approve_payment_${orderId}`)
          .setLabel('✅ Terima')
          .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
          .setCustomId(`reject_payment_${orderId}`)
          .setLabel('❌ Tolak')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);

        const adminMessage = await notifChannel.send({
          embeds: [adminEmbed],
          components: [row],
          files: [proofAttachment]
        });

        // Capture the persistent attachment URL from the admin message we just
        // sent. This URL is tied to the admin message (which we don't delete),
        // not to the user's about-to-be-deleted message.
        const reuploaded = adminMessage.attachments.first();
        if (reuploaded) {
          persistentProofUrl = reuploaded.url;
        }
      } else {
        console.warn(`⚠️ PAYMENT_REVIEW_CHANNEL_ID not configured or not found; admin won't see proof for ${orderId}`);
      }

      // Update transaction with the persistent proof URL (or fall back to the
      // original URL if the admin channel isn't configured — better than nothing).
      await transaction.update({
        paymentProofUrl: persistentProofUrl || imageAttachment.url,
        status: 'pending_review'
      });

      // Notify dashboard subscribers in real time so the admin sees the
      // new pending review immediately.
      emitEvent('transaction.pending_review', {
        orderId,
        userId: transaction.userId,
        serverId: transaction.serverId,
        amount: transaction.amount,
        productId: transaction.productId,
        productName: transaction.product ? transaction.product.name : null,
        proofUrl: persistentProofUrl || imageAttachment.url
      });

      // Notify user
      const successMsg = await message.reply({
        embeds: [createSuccessEmbed(
          'Bukti Pembayaran Terkirim',
          'Bukti pembayaran kamu berhasil dikirim ke admin. Silakan tunggu approval.',
          [
            { name: '🔖 Order ID', value: `\`${orderId}\``, inline: true },
            { name: '📊 Status', value: '⏳ Menunggu Review', inline: true }
          ]
        )]
      });

      // Delete instruction message if we have its id
      if (pending && pending.instructionMsgId) {
        try {
          const instructionMsg = await message.channel.messages.fetch(pending.instructionMsgId);
          await instructionMsg.delete();
        } catch (error) {
          console.log('Could not delete instruction message');
        }
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
      if (message.client.pendingUploads) {
        message.client.pendingUploads.delete(message.author.id);
      }

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
