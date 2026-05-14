const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { IbConfig } = require('../../database/models');
const {
  createSuccessEmbed,
  createErrorEmbed,
  QTRADES_LOGO_URL,
  COLORS
} = require('../../utils/embedBuilder');

/**
 * /ib-setup posts the public IB registration embed in a chosen channel and
 * upserts the channel into IbConfig.registrationChannelId. Most other IB
 * configuration (cookie, role, retry settings, deposit thresholds) is done
 * from the web admin dashboard, not here, so the slash command stays small.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ib-setup')
    .setDescription('[ADMIN] Posting embed pendaftaran IB QTrades di channel pilihan')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel tujuan untuk posting embed pendaftaran IB')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    try {
      const config = await IbConfig.findOne({ where: { serverId: guild.id } });
      if (!config || !config.enabled) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'IB Belum Aktif',
            'Aktifkan dulu sistem IB di **Web Admin → Pengaturan IB**, lalu jalankan command ini lagi.'
          )]
        });
      }
      if (!config.ibRoleId) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Role IB Belum Diatur',
            'Set role IB di **Web Admin → Pengaturan IB** dulu.'
          )]
        });
      }
      if (!config.encryptedCookie) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Cookie Valetax Belum Diisi',
            'Isi cookie session Valetax di **Web Admin → Pengaturan IB** dulu, baru posting embed.'
          )]
        });
      }

      const title = config.embedTitle || '🤝 Daftar IB QTrades';
      const description =
        (config.embedDescription || defaultDescription(config.ibLink)).replace(/\\n/g, '\n');
      const buttonLabel = config.embedButtonLabel || 'Saya Sudah Daftar IB';

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

      embed.setFooter({
        text: 'QTrades · IB Verification',
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      });
      if (QTRADES_LOGO_URL) embed.setThumbnail(QTRADES_LOGO_URL);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ib_register')
          .setLabel(buttonLabel)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🤝')
      );

      const message = await channel.send({ embeds: [embed], components: [row] });

      await config.update({ registrationChannelId: channel.id });

      const confirm = createSuccessEmbed(
        'Embed IB Terkirim',
        `Embed pendaftaran IB sudah dipost ke ${channel}.`,
        [
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Message ID', value: message.id, inline: true }
        ]
      );
      confirm.setFooter({
        text: 'User sekarang bisa klik tombol untuk daftar IB.',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      });
      await interaction.editReply({ embeds: [confirm] });
    } catch (error) {
      console.error('Error in /ib-setup:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed(
          'Gagal Memposting Embed IB',
          `Error: \`${error.message || 'unknown'}\``
        )]
      });
    }
  }
};

function defaultDescription(ibLink) {
  const link = ibLink || '<set link di web admin>';
  return [
    'Dapatkan akses ke channel signal eksklusif dengan daftar IB QTrades di **Valetax**!',
    '',
    '**Cara daftar:**',
    `1. Klik link IB QTrades: ${link}`,
    '2. Daftar akun baru / pindahkan IB ke QTrades',
    '3. Lakukan deposit minimum sesuai syarat',
    '4. Klik tombol **Saya Sudah Daftar IB** di bawah',
    '5. Masukkan nomor akun broker kamu',
    '',
    'Bot akan cek otomatis ke Valetax. Kalau akun terdaftar dan deposit memenuhi minimum, role IB akan langsung diberikan.'
  ].join('\n');
}
