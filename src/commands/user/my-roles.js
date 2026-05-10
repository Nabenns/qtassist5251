const { SlashCommandBuilder } = require('discord.js');
const { TemporaryRole } = require('../../database/models');
const { createSuccessEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');
const { formatDuration } = require('../../utils/parseDuration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-roles')
    .setDescription('Cek role temporary kamu dan kapan kadaluarsanya'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guild = interaction.guild;

    try {
      // Get all active temporary roles for this user
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

      // Filter out expired and non-existing roles
      const now = new Date();
      const activeRoles = [];
      const expiredRoles = [];

      for (const tempRole of tempRoles) {
        const role = guild.roles.cache.get(tempRole.roleId);

        if (!role) continue; // Skip if role doesn't exist

        if (tempRole.expiresAt > now) {
          activeRoles.push({ tempRole, role });
        } else {
          expiredRoles.push({ tempRole, role });
        }
      }

      // Build embed
      const embed = createSuccessEmbed(
        '🎭 Role Temporary Kamu',
        activeRoles.length > 0
          ? `Kamu punya **${activeRoles.length}** role temporary yang aktif.`
          : 'Semua role kamu sudah kadaluarsa.',
        []
      );

      // Add active roles
      if (activeRoles.length > 0) {
        for (const { tempRole, role } of activeRoles) {
          const expiresAt = tempRole.expiresAt;
          const timeLeft = expiresAt - now;
          const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

          // Calculate time remaining
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

      // Add expired roles (if any)
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
};
