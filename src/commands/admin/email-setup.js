const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createSuccessEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('email-setup')
    .setDescription('[ADMIN] Setup pendaftaran email untuk akses video/drive')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel untuk post message pendaftaran email')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Judul embed (opsional)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Deskripsi/instruksi (opsional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title') || '📧 Daftar Email untuk Akses Konten';
    const description = interaction.options.getString('description') ||
      'Klik tombol di bawah untuk mendaftarkan email kamu.\n\n' +
      '**Catatan:**\n' +
      '• Setiap member hanya bisa daftar **1 email**\n' +
      '• Email digunakan untuk akses video/drive eksklusif\n' +
      '• Kamu bisa update email kapan saja';

    try {
      // Create embed
      const embed = createSuccessEmbed(title, description);

      embed.setFooter({
        text: `${interaction.guild.name} • Email Registration`,
        iconURL: QTRADES_LOGO_URL || interaction.guild.iconURL({ dynamic: true })
      })
      .setThumbnail(QTRADES_LOGO_URL || interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

      // Create button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('email_register')
            .setLabel('📧 Daftar Email')
            .setStyle(ButtonStyle.Primary)
        );

      // Send to channel
      await channel.send({
        embeds: [embed],
        components: [row]
      });

      // Confirm to admin
      await interaction.reply({
        embeds: [createSuccessEmbed(
          'Email Setup Berhasil',
          `Pendaftaran email berhasil di-setup di ${channel}`
        )],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in email-setup command:', error);
      await interaction.reply({
        content: '❌ Terjadi kesalahan saat setup pendaftaran email.',
        ephemeral: true
      });
    }
  },
};
