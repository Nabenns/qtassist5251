const { Op } = require('sequelize');
const { Product, Transaction, TemporaryRole, EmailBinding, DriveConfig } = require('../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed, createWarningEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { syncTransactionToSheets } = require('../services/googleSheetsService');
const { shareMultipleDriveFiles, revokeMultipleDriveAccess } = require('../services/googleDriveService');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`❌ No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);

        const errorMessage = {
          content: '❌ There was an error executing this command!',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
      return;
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command || !command.autocomplete) {
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`❌ Error in autocomplete for ${interaction.commandName}:`, error);
      }
      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      try {
        // Handle buy product button
        if (interaction.customId.startsWith('buy_product_')) {
          await handleBuyProduct(interaction);
        }

        // Handle upload proof button
        if (interaction.customId.startsWith('upload_proof_')) {
          await handleUploadProof(interaction);
        }

        // Handle approve payment button
        if (interaction.customId.startsWith('approve_payment_')) {
          await handleApprovePayment(interaction);
        }

        // Handle reject payment button
        if (interaction.customId.startsWith('reject_payment_')) {
          await handleRejectPayment(interaction);
        }

        // Handle email registration button
        if (interaction.customId === 'email_register') {
          await handleEmailRegister(interaction);
        }

        // Handle My Info buttons
        if (interaction.customId === 'myinfo_roles') {
          await handleMyInfoRoles(interaction);
        }

        if (interaction.customId === 'myinfo_purchases') {
          await handleMyInfoPurchases(interaction);
        }
      } catch (error) {
        console.error('Error handling button interaction:', error);

        // Try to respond to the interaction if not already responded
        try {
          const errorEmbed = createErrorEmbed(
            'Interaction Error',
            'An error occurred while processing your request. Please try again.'
          );

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
          } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
          }
        } catch (replyError) {
          console.error('Could not send error response:', replyError.message);
        }
      }
    }

    // Handle modal (form) submissions
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId.startsWith('reject_reason_modal_')) {
          await handleRejectReasonSubmit(interaction);
        }

        if (interaction.customId === 'email_modal') {
          await handleEmailModalSubmit(interaction);
        }
      } catch (error) {
        console.error('Error handling modal submission:', error);

        try {
          const errorEmbed = createErrorEmbed(
            'Submission Error',
            'An error occurred while processing your submission. Please try again.'
          );

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed] });
          } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
          }
        } catch (replyError) {
          console.error('Could not send error response:', replyError.message);
        }
      }
    }
  }
};

async function handleBuyProduct(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const productId = parseInt(interaction.customId.replace('buy_product_', ''));
  const user = interaction.user;
  const guild = interaction.guild;

  try {
    // Fetch product
    const product = await Product.findOne({
      where: {
        id: productId,
        serverId: guild.id,
        isActive: true
      }
    });

    if (!product) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Produk Tidak Ditemukan',
          'Produk ini sudah tidak tersedia.'
        )]
      });
    }

    // Check if role exists
    const role = guild.roles.cache.get(product.roleId);
    if (!role) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Tidak Ditemukan',
          'Role untuk produk ini sudah tidak ada.'
        )]
      });
    }

    // Check if user already has temporary role (for role stacking)
    const existingTempRole = await TemporaryRole.findOne({
      where: {
        serverId: guild.id,
        userId: user.id,
        roleId: role.id
      }
    });

    let isExtension = false;
    let currentExpiry = null;

    if (existingTempRole) {
      const now = new Date();
      if (existingTempRole.expiresAt > now) {
        isExtension = true;
        currentExpiry = existingTempRole.expiresAt;
      }
    }

    // Check for pending or pending_review transaction
    const pendingTransaction = await Transaction.findOne({
      where: {
        userId: user.id,
        productId: product.id,
        status: ['pending', 'pending_review']
      }
    });

    if (pendingTransaction) {
      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(product.price);

      const fields = [
        { name: '🔖 Order ID', value: `\`${pendingTransaction.orderId}\``, inline: true },
        { name: '💰 Jumlah', value: formattedPrice, inline: true },
        { name: '📊 Status', value: pendingTransaction.status === 'pending_review' ? '⏳ Menunggu Admin' : '💳 Belum Bayar', inline: true }
      ];

      const uploadButton = new ButtonBuilder()
        .setCustomId(`upload_proof_${pendingTransaction.orderId}`)
        .setLabel('📤 Upload Bukti Bayar')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pendingTransaction.status === 'pending_review');

      const row = new ActionRowBuilder().addComponents(uploadButton);

      const embed = createInfoEmbed(
        'Transaksi Pending',
        `Kamu sudah punya transaksi pending untuk **${product.name}**.${pendingTransaction.status === 'pending_review' ? '\n\n✅ Bukti pembayaran sudah dikirim. Silakan tunggu admin review.' : '\n\n⚠️ Silakan selesaikan pembayaran dan upload bukti transfer.'}`,
        fields
      );

      embed.setFooter({
        text: pendingTransaction.status === 'pending_review' ? 'Menunggu persetujuan admin' : 'Transfer ke rekening dan upload bukti',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${user.id}`;

    // Save transaction to database
    await Transaction.create({
      orderId: orderId,
      userId: user.id,
      serverId: guild.id,
      productId: product.id,
      amount: product.price,
      status: 'pending'
    });

    // Format price
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(product.price);

    // Get bank details from environment (support multiple accounts)
    const bankNamesRaw = process.env.BANK_NAMES || process.env.BANK_NAME;
    const accountNumbersRaw = process.env.ACCOUNT_NUMBERS || process.env.ACCOUNT_NUMBER;
    const accountHoldersRaw = process.env.ACCOUNT_HOLDERS || process.env.ACCOUNT_HOLDER;

    if (!bankNamesRaw || !accountNumbersRaw || !accountHoldersRaw) {
      console.error('❌ Bank account env vars missing: BANK_NAMES, ACCOUNT_NUMBERS, ACCOUNT_HOLDERS');
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Konfigurasi Bank Belum Lengkap',
          'Admin belum mengatur rekening pembayaran. Hubungi admin untuk menyelesaikan setup sebelum melakukan pembelian.'
        )]
      });
    }

    const bankNames = bankNamesRaw.split('|');
    const accountNumbers = accountNumbersRaw.split('|');
    const accountHolders = accountHoldersRaw.split('|');

    // Build bank accounts info (compact format)
    let bankAccountsText = '';

    for (let i = 0; i < bankNames.length; i++) {
      const bankName = bankNames[i]?.trim() || 'Bank Tidak Diketahui';
      const accountNumber = accountNumbers[i]?.trim() || 'N/A';
      const accountHolder = accountHolders[i]?.trim() || 'Tidak Diketahui';

      if (bankNames.length > 1) {
        bankAccountsText += `\n**Rekening ${i + 1}:**\n`;
      }

      bankAccountsText += `🏦 **${bankName}**\n`;
      bankAccountsText += `💳 \`${accountNumber}\`\n`;
      bankAccountsText += `👤 ${accountHolder}\n`;
    }

    // Create embed fields
    const embedFields = [
      { name: '📦 Produk', value: product.name, inline: true },
      { name: '🎭 Role', value: `${role}`, inline: true },
      { name: '💰 Harga', value: formattedPrice, inline: true },
      { name: '⏱️ Durasi', value: formatDuration(product.duration), inline: true },
      { name: '🔖 Order ID', value: `\`${orderId}\``, inline: false },
      { name: '💳 Info Rekening', value: bankAccountsText.trim(), inline: false },
      { name: '📝 Cara Pembayaran', value: `**1.** Transfer **${formattedPrice}** ke salah satu rekening di atas\n**2.** Screenshot bukti transfer\n**3.** Klik tombol **Upload Bukti Bayar**\n**4.** Tunggu admin approve`, inline: false }
    ];

    // Add extension info if user is extending
    if (isExtension && currentExpiry) {
      const currentExpiryTimestamp = Math.floor(currentExpiry.getTime() / 1000);
      const newExpiry = new Date(currentExpiry.getTime() + parseInt(product.duration));
      const newExpiryTimestamp = Math.floor(newExpiry.getTime() / 1000);

      embedFields.splice(4, 0, {
        name: '🔄 Perpanjangan Role',
        value: `Kadaluarsa Saat Ini: <t:${currentExpiryTimestamp}:R>\nKadaluarsa Baru: <t:${newExpiryTimestamp}:R>\nDurasi ditambah **+${formatDuration(product.duration)}**`,
        inline: false
      });
    }

    const embed = createSuccessEmbed(
      isExtension ? 'Perpanjang Durasi Role' : 'Instruksi Pembayaran',
      `Silakan transfer untuk menyelesaikan pembelian **${product.name}**`,
      embedFields
    );

    embed.setFooter({
      text: 'Role akan diberikan setelah admin approve pembayaran',
      iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
    })
    .setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));

    // Create upload proof button
    const uploadButton = new ButtonBuilder()
      .setCustomId(`upload_proof_${orderId}`)
      .setLabel('📤 Upload Bukti Bayar')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(uploadButton);

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    // Also send DM
    try {
      await user.send({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.log(`Could not send DM to ${user.tag}`);
    }

  } catch (error) {
    console.error('Error handling buy product:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'An error occurred while processing your request. Please try again.'
      )]
    });
  }
}

async function handleUploadProof(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const orderId = interaction.customId.replace('upload_proof_', '');
  const guild = interaction.guild;
  const user = interaction.user;

  try {
    // Get temp upload channel
    const tempChannelId = process.env.PAYMENT_UPLOAD_CHANNEL_ID;

    if (!tempChannelId) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Channel Tidak Dikonfigurasi',
          'Admin belum setup channel untuk upload bukti pembayaran. Silakan hubungi admin.'
        )]
      });
    }

    const tempChannel = guild.channels.cache.get(tempChannelId);

    if (!tempChannel) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Channel Tidak Ditemukan',
          'Channel upload tidak ditemukan. Silakan hubungi admin.'
        )]
      });
    }

    // Create instruction message in temp channel
    const instructionEmbed = createInfoEmbed(
      '📤 Upload Bukti Pembayaran',
      `<@${user.id}>, silakan **upload gambar** bukti transfer kamu di channel ini.\n\n**Order ID:** \`${orderId}\`\n\n⚠️ **Penting:**\n• Upload **HANYA 1 GAMBAR** bukti transfer\n• Setelah upload, gambar akan otomatis dikirim ke admin\n• Pesan ini dan gambar akan otomatis dihapus\n• Jangan upload gambar lain selain bukti pembayaran`,
      [
        { name: '⏱️ Batas Waktu', value: '5 menit', inline: true },
        { name: '🔖 Order ID', value: `\`${orderId}\``, inline: true }
      ]
    );

    instructionEmbed.setFooter({
      text: 'Upload gambar sekarang, bot menunggu...',
      iconURL: user.displayAvatarURL()
    });

    const instructionMsg = await tempChannel.send({
      content: `<@${user.id}>`,
      embeds: [instructionEmbed]
    });

    // Send confirmation to user
    const confirmEmbed = createSuccessEmbed(
      'Channel Upload Siap',
      `Silakan upload bukti pembayaran kamu di ${tempChannel}`,
      [
        { name: '📍 Channel', value: `${tempChannel}`, inline: true },
        { name: '⏱️ Waktu', value: '5 menit', inline: true }
      ]
    );

    await interaction.editReply({ embeds: [confirmEmbed] });

    // Store pending upload in memory (simple approach)
    if (!interaction.client.pendingUploads) {
      interaction.client.pendingUploads = new Map();
    }

    interaction.client.pendingUploads.set(user.id, {
      orderId: orderId,
      instructionMsgId: instructionMsg.id,
      tempChannelId: tempChannel.id,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    // Auto cleanup after 5 minutes
    setTimeout(async () => {
      const pending = interaction.client.pendingUploads.get(user.id);
      if (pending && pending.orderId === orderId) {
        interaction.client.pendingUploads.delete(user.id);
        try {
          await instructionMsg.delete();
        } catch (error) {
          console.log('Instruction message already deleted');
        }
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error handling upload proof:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Terjadi kesalahan. Silakan coba lagi.')]
    });
  }
}


async function handleApprovePayment(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const orderId = interaction.customId.replace('approve_payment_', '');

  try {
    const transaction = await Transaction.findOne({
      where: { orderId: orderId },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!transaction) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Tidak dapat menemukan transaksi ini.')]
      });
    }

    if (transaction.status === 'approved') {
      return interaction.editReply({
        embeds: [createInfoEmbed('Sudah Disetujui', 'Pembayaran ini sudah disetujui sebelumnya.')]
      });
    }

    // Update transaction
    await transaction.update({
      status: 'approved',
      paidAt: new Date(),
      reviewedBy: interaction.user.id,
      reviewedAt: new Date()
    });

    const guild = interaction.guild;
    const product = transaction.product;
    const role = guild.roles.cache.get(product.roleId);

    if (!role) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Role Tidak Ditemukan', 'Role untuk produk ini sudah tidak ada.')]
      });
    }

    // Assign role to user
    const member = await guild.members.fetch(transaction.userId);
    await member.roles.add(role);

    // Calculate expiry
    const expiryDate = new Date(Date.now() + parseInt(product.duration));

    // Create temporary role entry
    await TemporaryRole.create({
      serverId: guild.id,
      userId: transaction.userId,
      roleId: role.id,
      grantedAt: new Date(),
      expiresAt: expiryDate,
      grantedBy: interaction.user.id,
      reason: `Pembelian: ${product.name}`
    });

    // Format price
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(transaction.amount);

    // Notify user
    try {
      const user = await interaction.client.users.fetch(transaction.userId);
      const userEmbed = createSuccessEmbed(
        'Pembayaran Disetujui!',
        `Pembayaran kamu telah disetujui dan ${role} sudah diberikan!`,
        [
          { name: '📦 Produk', value: product.name, inline: true },
          { name: '💰 Jumlah', value: formattedPrice, inline: true },
          { name: '⏱️ Durasi', value: formatDuration(product.duration), inline: true },
          { name: '⏳ Kadaluarsa', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: true }
        ]
      );

      await user.send({ embeds: [userEmbed] });
    } catch (error) {
      console.log('Could not send DM to user');
    }

    // Update original message
    if (interaction.message) {
      await interaction.message.edit({ components: [] });
    }

    const adminEmbed = createSuccessEmbed(
      'Pembayaran Disetujui',
      `Pembayaran disetujui dan ${role} diberikan ke <@${transaction.userId}>`,
      [
        { name: '🔖 Order ID', value: `\`${orderId}\``, inline: true },
        { name: '👮 Disetujui oleh', value: `<@${interaction.user.id}>`, inline: true }
      ]
    );

    await interaction.editReply({ embeds: [adminEmbed] });

    // Sync to Google Sheets
    try {
      await syncTransactionToSheets(transaction, guild);
    } catch (error) {
      console.log('Could not sync to Google Sheets:', error.message);
    }

  } catch (error) {
    console.error('Error approving payment:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Gagal menyetujui pembayaran. Silakan coba lagi.')]
    });
  }
}

async function handleRejectPayment(interaction) {
  const orderId = interaction.customId.replace('reject_payment_', '');

  // Show modal for rejection reason
  const modal = new ModalBuilder()
    .setCustomId(`reject_reason_modal_${orderId}`)
    .setTitle('Tolak Pembayaran');

  const reasonInput = new TextInputBuilder()
    .setCustomId('rejection_reason')
    .setLabel('Alasan Penolakan')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Masukkan alasan mengapa pembayaran ditolak...')
    .setRequired(true)
    .setMaxLength(500);

  const row = new ActionRowBuilder().addComponents(reasonInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleRejectReasonSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const orderId = interaction.customId.replace('reject_reason_modal_', '');
  const rejectionReason = interaction.fields.getTextInputValue('rejection_reason');

  try {
    const transaction = await Transaction.findOne({
      where: { orderId: orderId },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!transaction) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Tidak dapat menemukan transaksi ini.')]
      });
    }

    // Update transaction
    await transaction.update({
      status: 'rejected',
      rejectionReason: rejectionReason,
      reviewedBy: interaction.user.id,
      reviewedAt: new Date()
    });

    // Notify user
    try {
      const user = await interaction.client.users.fetch(transaction.userId);
      const userEmbed = createErrorEmbed(
        'Pembayaran Ditolak',
        `Pembayaran kamu untuk **${transaction.product.name}** ditolak oleh admin.\n\n**Alasan:** ${rejectionReason}\n\nSilakan hubungi admin untuk info lebih lanjut atau kirim ulang bukti pembayaran yang benar.`
      );

      await user.send({ embeds: [userEmbed] });
    } catch (error) {
      console.log('Could not send DM to user');
    }

    // Update original message
    if (interaction.message) {
      await interaction.message.edit({ components: [] });
    }

    const adminEmbed = createWarningEmbed(
      'Pembayaran Ditolak',
      `Pembayaran ditolak untuk <@${transaction.userId}>\n\n**Alasan:** ${rejectionReason}`
    );

    adminEmbed.addFields([
      { name: '🔖 Order ID', value: `\`${orderId}\``, inline: true },
      { name: '👮 Ditolak oleh', value: `<@${interaction.user.id}>`, inline: true }
    ]);

    await interaction.editReply({ embeds: [adminEmbed] });

    // Sync to Google Sheets
    try {
      await syncTransactionToSheets(transaction, interaction.guild);
    } catch (error) {
      console.log('Could not sync to Google Sheets:', error.message);
    }

  } catch (error) {
    console.error('Error rejecting payment:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed('Error', 'Gagal menolak pembayaran. Silakan coba lagi.')]
    });
  }
}

/**
 * Handle email registration button click
 */
async function handleEmailRegister(interaction) {
  try {
    // Check if user already has email registered
    const existingBinding = await EmailBinding.findOne({
      where: {
        serverId: interaction.guild.id,
        userId: interaction.user.id
      }
    });

    // Create modal for email input
    const modal = new ModalBuilder()
      .setCustomId('email_modal')
      .setTitle('Daftar Email untuk Akses Konten');

    const emailInput = new TextInputBuilder()
      .setCustomId('email_input')
      .setLabel('Email Address')
      .setPlaceholder('contoh@gmail.com')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(255);

    // Pre-fill dengan email yang sudah ada jika user sudah pernah daftar
    if (existingBinding) {
      emailInput.setValue(existingBinding.email);
    }

    const row = new ActionRowBuilder().addComponents(emailInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

  } catch (error) {
    console.error('Error showing email modal:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'Gagal membuka form pendaftaran email.')],
      ephemeral: true
    });
  }
}

/**
 * Handle email modal submission
 */
async function handleEmailModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const email = interaction.fields.getTextInputValue('email_input').trim();

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Format Email Tidak Valid',
          'Mohon masukkan alamat email yang valid.\n\nContoh: `user@gmail.com`'
        )]
      });
    }

    // Check if email is already used by another user
    const emailTaken = await EmailBinding.findOne({
      where: {
        serverId: interaction.guild.id,
        email: email
      }
    });

    if (emailTaken && emailTaken.userId !== interaction.user.id) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Email Sudah Terdaftar',
          'Email ini sudah digunakan oleh member lain.\n\nSilakan gunakan email yang berbeda.'
        )]
      });
    }

    // Check if user already has email registered
    const existingBinding = await EmailBinding.findOne({
      where: {
        serverId: interaction.guild.id,
        userId: interaction.user.id
      }
    });

    // Get Drive config for auto-share
    const driveConfig = await DriveConfig.findOne({
      where: { serverId: interaction.guild.id }
    });

    if (existingBinding) {
      // Update existing email
      const oldEmail = existingBinding.email;
      existingBinding.email = email;
      existingBinding.updatedAt = new Date();
      await existingBinding.save();

      // Handle Drive auto-share if enabled
      if (driveConfig && driveConfig.autoShareEnabled && driveConfig.driveFileIds) {
        const driveIds = driveConfig.driveFileIds.split(',').filter(id => id);

        if (driveIds.length > 0) {
          // Revoke old email and share with new email
          try {
            await revokeMultipleDriveAccess(driveIds, oldEmail);
            const results = await shareMultipleDriveFiles(driveIds, email, driveConfig.shareRole);

            const successCount = results.filter(r => r.success).length;

            return interaction.editReply({
              embeds: [createSuccessEmbed(
                'Email Berhasil Diperbarui',
                `Email kamu berhasil diperbarui!\n\n` +
                `**Email Lama:** ${oldEmail}\n` +
                `**Email Baru:** ${email}\n\n` +
                `🔄 **Google Drive Auto-Share:**\n` +
                `✅ Akses diperbarui untuk ${successCount}/${driveIds.length} Drive folder/file.\n\n` +
                `Cek email kamu untuk link akses Google Drive!`
              )]
            });
          } catch (error) {
            console.error('Error updating Drive access:', error);
            // Still show success for email update even if Drive fails
            return interaction.editReply({
              embeds: [createSuccessEmbed(
                'Email Berhasil Diperbarui',
                `Email kamu berhasil diperbarui!\n\n` +
                `**Email Lama:** ${oldEmail}\n` +
                `**Email Baru:** ${email}\n\n` +
                `⚠️ Terjadi kesalahan saat update akses Drive. Hubungi admin.`
              )]
            });
          }
        }
      }

      return interaction.editReply({
        embeds: [createSuccessEmbed(
          'Email Berhasil Diperbarui',
          `Email kamu berhasil diperbarui!\n\n` +
          `**Email Lama:** ${oldEmail}\n` +
          `**Email Baru:** ${email}\n\n` +
          `Gunakan command \`/my-email\` untuk melihat email terdaftar.`
        )]
      });
    } else {
      // Create new binding
      await EmailBinding.create({
        serverId: interaction.guild.id,
        userId: interaction.user.id,
        email: email,
        registeredAt: new Date(),
        updatedAt: new Date()
      });

      // Handle Drive auto-share if enabled
      if (driveConfig && driveConfig.autoShareEnabled && driveConfig.driveFileIds) {
        const driveIds = driveConfig.driveFileIds.split(',').filter(id => id);

        if (driveIds.length > 0) {
          try {
            const results = await shareMultipleDriveFiles(driveIds, email, driveConfig.shareRole);

            const successCount = results.filter(r => r.success).length;

            return interaction.editReply({
              embeds: [createSuccessEmbed(
                'Email Berhasil Didaftarkan',
                `Email kamu berhasil didaftarkan!\n\n` +
                `**Email:** ${email}\n\n` +
                `🎉 **Google Drive Auto-Share:**\n` +
                `✅ Kamu mendapat akses ke ${successCount}/${driveIds.length} Drive folder/file!\n\n` +
                `Cek email kamu untuk link akses Google Drive.\n\n` +
                `Gunakan command \`/my-email\` untuk melihat email terdaftar.`
              )]
            });
          } catch (error) {
            console.error('Error sharing Drive access:', error);
            // Still show success for email registration even if Drive fails
            return interaction.editReply({
              embeds: [createSuccessEmbed(
                'Email Berhasil Didaftarkan',
                `Email kamu berhasil didaftarkan!\n\n` +
                `**Email:** ${email}\n\n` +
                `⚠️ Terjadi kesalahan saat memberikan akses Drive. Hubungi admin.\n\n` +
                `Gunakan command \`/my-email\` untuk melihat email terdaftar.`
              )]
            });
          }
        }
      }

      return interaction.editReply({
        embeds: [createSuccessEmbed(
          'Email Berhasil Didaftarkan',
          `Email kamu berhasil didaftarkan!\n\n` +
          `**Email:** ${email}\n\n` +
          `Email ini akan digunakan untuk memberikan akses ke konten eksklusif.\n\n` +
          `Gunakan command \`/my-email\` untuk melihat email terdaftar.`
        )]
      });
    }

  } catch (error) {
    console.error('Error processing email registration:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'Terjadi kesalahan saat memproses pendaftaran email. Silakan coba lagi.'
      )]
    });
  }
}


// ============================================================
// My Info button handlers (replaces the old /my-roles and
// /my-purchases slash commands)
// ============================================================

async function handleMyInfoRoles(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const guild = interaction.guild;

  try {
    const tempRoles = await TemporaryRole.findAll({
      where: {
        serverId: guild.id,
        userId: userId
      },
      order: [['expiresAt', 'ASC']]
    });

    if (tempRoles.length === 0) {
      return interaction.editReply({
        embeds: [createInfoEmbed(
          'Tidak Ada Role Temporary',
          'Kamu tidak punya role temporary yang aktif saat ini.'
        )]
      });
    }

    const now = new Date();
    const activeRoles = [];
    const expiredRoles = [];

    for (const tempRole of tempRoles) {
      const role = guild.roles.cache.get(tempRole.roleId);
      if (!role) continue;

      if (tempRole.expiresAt > now) {
        activeRoles.push({ tempRole, role });
      } else {
        expiredRoles.push({ tempRole, role });
      }
    }

    const embed = createSuccessEmbed(
      '🎭 Role Temporary Kamu',
      activeRoles.length > 0
        ? `Kamu punya **${activeRoles.length}** role temporary yang aktif.`
        : 'Semua role kamu sudah kadaluarsa.',
      []
    );

    if (activeRoles.length > 0) {
      for (const { tempRole, role } of activeRoles) {
        const expiresAt = tempRole.expiresAt;
        const timeLeft = expiresAt - now;
        const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        let timeRemaining;
        if (daysLeft > 0) {
          timeRemaining = `${daysLeft} hari ${hoursLeft} jam`;
        } else if (hoursLeft > 0) {
          timeRemaining = `${hoursLeft} jam ${minutesLeft} menit`;
        } else {
          timeRemaining = `${minutesLeft} menit`;
        }

        embed.addFields({
          name: `${role.name}`,
          value: `⏳ **Sisa waktu:** ${timeRemaining}\n📅 **Kadaluarsa:** <t:${expiresTimestamp}:R>\n🔖 **Diberikan:** <t:${Math.floor(tempRole.grantedAt.getTime() / 1000)}:R>`,
          inline: false
        });
      }
    }

    if (expiredRoles.length > 0) {
      const expiredRoleNames = expiredRoles.map(({ role }) => role.name).join(', ');
      embed.addFields({
        name: '⚠️ Role Kadaluarsa (akan segera dihapus)',
        value: expiredRoleNames,
        inline: false
      });
    }

    embed.setFooter({
      text: `Total: ${activeRoles.length} active, ${expiredRoles.length} expired`,
      iconURL: QTRADES_LOGO_URL || interaction.user.displayAvatarURL()
    });

    embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching user roles:', error);
    return interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'Terjadi kesalahan saat mengambil data role kamu. Silakan coba lagi.'
      )]
    });
  }
}

async function handleMyInfoPurchases(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = interaction.user;
    const guild = interaction.guild;
    const now = new Date();

    const activeRoles = await TemporaryRole.findAll({
      where: {
        serverId: guild.id,
        userId: user.id,
        expiresAt: { [Op.gt]: now }
      },
      order: [['expiresAt', 'ASC']]
    });

    const allTransactions = await Transaction.findAll({
      where: {
        serverId: guild.id,
        userId: user.id
      },
      include: [{
        model: Product,
        as: 'product'
      }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const paidTransactions = allTransactions.filter(tx => tx.status === 'approved');
    const pendingTransactions = allTransactions.filter(
      tx => tx.status === 'pending' || tx.status === 'pending_review'
    );

    const formatIDR = (amount) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);

    let activeRolesText;
    if (activeRoles.length > 0) {
      activeRolesText = activeRoles.map((tempRole, index) => {
        const role = guild.roles.cache.get(tempRole.roleId);
        const roleName = role ? role.name : 'Unknown Role';
        const expiresTimestamp = Math.floor(tempRole.expiresAt.getTime() / 1000);
        return `${index + 1}. **${roleName}** - Expires <t:${expiresTimestamp}:R>`;
      }).join('\n');
    } else {
      activeRolesText = 'No active roles';
    }

    let historyText;
    if (paidTransactions.length > 0) {
      historyText = paidTransactions.slice(0, 5).map((tx, index) => {
        const product = tx.product ? tx.product.name : 'Unknown Product';
        const amount = formatIDR(tx.amount);
        const time = tx.paidAt
          ? `<t:${Math.floor(new Date(tx.paidAt).getTime() / 1000)}:d>`
          : `<t:${Math.floor(new Date(tx.createdAt).getTime() / 1000)}:d>`;
        return `${index + 1}. ${product} - ${amount} (${time})`;
      }).join('\n');
    } else {
      historyText = 'No purchase history';
    }

    let pendingText;
    if (pendingTransactions.length > 0) {
      pendingText = pendingTransactions.map((tx, index) => {
        const product = tx.product ? tx.product.name : 'Unknown Product';
        const amount = formatIDR(tx.amount);
        const created = `<t:${Math.floor(new Date(tx.createdAt).getTime() / 1000)}:R>`;
        return `${index + 1}. ${product} - ${amount}\n   Order ID: \`${tx.orderId}\`\n   Created ${created}`;
      }).join('\n\n');
    } else {
      pendingText = 'No pending payments';
    }

    const totalSpent = paidTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    const embed = createSuccessEmbed(
      '🛒 My Purchases',
      `Purchase history for ${user.tag}`,
      [
        {
          name: '✅ Active Roles',
          value: activeRolesText,
          inline: false
        },
        {
          name: '📊 Statistics',
          value: `Total Purchases: **${paidTransactions.length}**\nTotal Spent: **${formatIDR(totalSpent)}**\nPending Orders: **${pendingTransactions.length}**`,
          inline: false
        },
        {
          name: '🕒 Recent Purchases (Last 5)',
          value: historyText,
          inline: false
        }
      ]
    );

    if (pendingTransactions.length > 0) {
      embed.addFields({
        name: '⏳ Pending Payments',
        value: pendingText,
        inline: false
      });
    }

    embed.setFooter({
      text: `${guild.name} • Personal info — only visible to you`,
      iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
    })
    .setThumbnail(QTRADES_LOGO_URL || user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in myinfo_purchases handler:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        'Terjadi kesalahan saat mengambil riwayat pembelian. Silakan coba lagi.'
      )]
    });
  }
}