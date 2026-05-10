const { SlashCommandBuilder } = require('discord.js');
const { EmailBinding } = require('../../database/models');
const { createSuccessEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-email')
    .setDescription('Cek email yang terdaftar untuk akses konten'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guild = interaction.guild;

    try {
      // Find email binding for this user
      const binding = await EmailBinding.findOne({
        where: {
          serverId: guild.id,
          userId: userId
        }
      });

      if (!binding) {
        const embed = createInfoEmbed(
          'Email Belum Terdaftar',
          'Kamu belum mendaftarkan email untuk akses konten.\n\n' +
          'Gunakan tombol **📧 Daftar Email** di channel pendaftaran untuk mendaftarkan email kamu.'
        );

        embed.setFooter({
          text: `${guild.name}`,
          iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
        });

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // Format registered date
      const registeredDate = new Date(binding.registeredAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
      });

      const updatedDate = new Date(binding.updatedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
      });

      const embed = createSuccessEmbed(
        '📧 Email Terdaftar',
        `Berikut adalah informasi email yang terdaftar untuk akses konten:`
      );

      embed.addFields(
        {
          name: 'Email',
          value: `\`${binding.email}\``,
          inline: false
        },
        {
          name: 'Terdaftar Sejak',
          value: registeredDate,
          inline: true
        },
        {
          name: 'Terakhir Diupdate',
          value: updatedDate,
          inline: true
        }
      );

      embed.setFooter({
        text: `${guild.name} • Gunakan tombol "Daftar Email" untuk update`,
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in my-email command:', error);
      return interaction.reply({
        content: '❌ Terjadi kesalahan saat mengambil data email.',
        ephemeral: true
      });
    }
  },
};
