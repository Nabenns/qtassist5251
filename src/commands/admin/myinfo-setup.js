const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myinfo-setup')
    .setDescription('[ADMIN] Setup My Info channel with role & purchase history buttons')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the My Info message')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    try {
      const infoEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('👤 My Info')
        .setDescription(
          'Cek informasi akun kamu di server ini.\n\n' +
          '**Pilih salah satu tombol di bawah:**\n' +
          '🎭 **Cek Role** — Lihat role temporary aktif kamu beserta sisa durasinya\n' +
          '🛒 **Riwayat Pembelian** — Lihat history transaksi & pembelian kamu\n\n' +
          'Hasil hanya akan terlihat oleh kamu sendiri (ephemeral).'
        )
        .setTimestamp();

      infoEmbed.setFooter({
        text: 'QTrades • Personal Account Info',
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      });

      if (QTRADES_LOGO_URL) {
        infoEmbed.setThumbnail(QTRADES_LOGO_URL);
      }

      const rolesButton = new ButtonBuilder()
        .setCustomId('myinfo_roles')
        .setLabel('Cek Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎭');

      const purchasesButton = new ButtonBuilder()
        .setCustomId('myinfo_purchases')
        .setLabel('Riwayat Pembelian')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛒');

      const row = new ActionRowBuilder().addComponents(rolesButton, purchasesButton);

      const sentMessage = await channel.send({
        embeds: [infoEmbed],
        components: [row]
      });

      const confirmEmbed = createSuccessEmbed(
        'My Info Setup Complete',
        `My Info message berhasil dikirim ke ${channel}`,
        [
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Message ID', value: sentMessage.id, inline: true }
        ]
      );

      confirmEmbed.setFooter({
        text: 'User sekarang bisa cek role & purchase history via button',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });

      await interaction.editReply({ embeds: [confirmEmbed] });

    } catch (error) {
      console.error('Error setting up My Info:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'Gagal setup My Info channel. Pastikan bot punya permission untuk send message di channel tersebut.'
        )]
      });
    }
  }
};
