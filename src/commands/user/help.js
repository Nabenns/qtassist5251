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
        '`/my-email` - Cek email terdaftar untuk akses konten',
        '`/help` - Tampilkan menu bantuan ini',
        '',
        '**Cek Role & Riwayat Pembelian:**',
        '• Buka channel **My Info** yang disediakan admin',
        '• Klik tombol 🎭 **Cek Role** untuk lihat role temporary aktif',
        '• Klik tombol 🛒 **Riwayat Pembelian** untuk lihat history transaksi'
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

    // Email Registration & Drive
    embed.addFields({
      name: '📧 **Email Registration & Google Drive**',
      value: [
        '**Untuk User:**',
        '• Klik button "📧 Daftar Email"',
        '• Input email untuk akses video/drive',
        '• `/my-email` - Cek email terdaftar',
        '• Auto-dapat akses Google Drive (jika enabled)',
        '',
        '**Untuk Admin:**',
        '`/email-setup #channel` - Setup pendaftaran email',
        '`/email-list [page]` - Lihat semua email terdaftar',
        '`/drive-setup add <id>` - Tambah Drive folder untuk auto-share',
        '`/drive-setup list` - Lihat config Drive',
        '`/drive-setup enable` - Aktifkan auto-share',
        '`/drive-setup role <permission>` - Set permission level'
      ].join('\n'),
      inline: false
    });

    // My Info channel setup
    embed.addFields({
      name: '👤 **My Info Channel** (Admin Only)',
      value: [
        '`/myinfo-setup #channel`',
        '├ Setup channel "My Info" dengan 2 button:',
        '├ 🎭 Cek Role - Lihat role temporary aktif user',
        '└ 🛒 Riwayat Pembelian - Lihat history transaksi user'
      ].join('\n'),
      inline: false
    });

    // Role claim button setup
    embed.addFields({
      name: '🎯 **Role Claim Button** (Admin Only)',
      value: [
        '`/role-claim-setup #channel role1 [role2..role5] [title] [description] [button_style]`',
        '├ Post message dengan tombol untuk klaim role',
        '├ Bisa setup hingga **5 role** sekaligus dalam satu message',
        '├ User klik tombol → role langsung dikasih',
        '└ **Contoh:** `/role-claim-setup #announcement role1:@Member`'
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
