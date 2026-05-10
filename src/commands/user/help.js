const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { QTRADES_LOGO_URL, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lihat daftar semua command yang tersedia'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('📚 Daftar Command QTAssist Bot')
      .setDescription('Berikut adalah semua command yang tersedia di bot ini.\n\n**Kategori Command:**')
      .setTimestamp();

    // User Commands
    embed.addFields({
      name: '👤 **User Commands**',
      value: [
        '`/my-roles` - Cek role temporary kamu dan kapan kadaluarsanya',
        '`/my-purchases` - Lihat riwayat pembelian kamu',
        '`/help` - Tampilkan menu bantuan ini'
      ].join('\n'),
      inline: false
    });

    // Shop Commands
    embed.addFields({
      name: '🛒 **Shop & Payment** (Button-based)',
      value: [
        '**Untuk User:**',
        '• Klik button product di shop channel',
        '• Klik "📤 Upload Bukti Bayar"',
        '• Upload gambar di channel upload',
        '',
        '**Untuk Admin:**',
        '• `/shop-setup #channel` - Setup shop dengan button',
        '• Klik "✅ Terima" atau "❌ Tolak" untuk review payment'
      ].join('\n'),
      inline: false
    });

    // Product Management
    embed.addFields({
      name: '📦 **Product Management** (Admin Only)',
      value: [
        '`/product-create <role> <name> <price> <duration> [desc]`',
        '├ Buat produk baru untuk dijual',
        '├ **Contoh:** `/product-create @VIP "VIP 30D" 50000 30d`',
        '',
        '`/product-list` - Lihat semua produk',
        '`/product-delete <id>` - Hapus produk'
      ].join('\n'),
      inline: false
    });

    // Temporary Role Management
    embed.addFields({
      name: '🎭 **Temporary Role Management** (Admin Only)',
      value: [
        '`/temprole-add <user> <role> <duration> [reason]`',
        '├ Berikan role sementara ke user',
        '├ **Contoh:** `/temprole-add @User @VIP 30d Hadiah event`',
        '',
        '`/temprole-remove <user> <role>`',
        '├ Hapus role sementara sebelum expired',
        '',
        '`/temprole-extend <user> <role> <duration>`',
        '├ Perpanjang durasi role',
        '',
        '`/temprole-list [user]`',
        '├ Lihat daftar role sementara yang aktif'
      ].join('\n'),
      inline: false
    });

    // Transaction Management
    embed.addFields({
      name: '💳 **Transaction Management** (Admin Only)',
      value: [
        '`/transaction-process <order_id>`',
        '├ Manual process transaction (backup)',
        '',
        '`/transaction-cancel <order_id>`',
        '├ Cancel/batalkan transaksi'
      ].join('\n'),
      inline: false
    });

    // Duration Format
    embed.addFields({
      name: '⏱️ **Format Durasi**',
      value: [
        '`1m` = 1 menit',
        '`1h` = 1 jam',
        '`1d` = 1 hari',
        '`1w` = 1 minggu',
        '`30d` = 30 hari',
        '`1d12h` = 1 hari 12 jam (kombinasi)'
      ].join('\n'),
      inline: true
    });

    // Permission Info
    embed.addFields({
      name: '🔐 **Info Permission**',
      value: [
        '👤 **User** - Semua member',
        '👮 **Admin** - Administrator only',
        '🛒 **Shop** - Button interaction'
      ].join('\n'),
      inline: true
    });

    // Footer with useful links
    embed.setFooter({
      text: 'QTAssist Bot • Manual Bank Transfer System',
      iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
    });

    if (QTRADES_LOGO_URL) {
      embed.setThumbnail(QTRADES_LOGO_URL);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
