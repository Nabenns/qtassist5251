const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { TemporaryRole } = require('../../database/models');
const { createInfoEmbed, createErrorEmbed } = require('../../utils/embedBuilder');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole-list')
    .setDescription('View all active temporary roles')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Filter by specific user (optional)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply();

    const filterUser = interaction.options.getUser('user');
    const guild = interaction.guild;

    try {
      // Build query
      const whereClause = {
        serverId: guild.id,
        expiresAt: {
          [Op.gt]: new Date() // Only active roles (not expired)
        }
      };

      if (filterUser) {
        whereClause.userId = filterUser.id;
      }

      // Fetch temporary roles
      const tempRoles = await TemporaryRole.findAll({
        where: whereClause,
        order: [['expiresAt', 'ASC']]
      });

      if (tempRoles.length === 0) {
        const message = filterUser
          ? `No active temporary roles found for ${filterUser}.`
          : 'No active temporary roles found.';

        return interaction.editReply({
          embeds: [createInfoEmbed('Active Temporary Roles', message)],
          ephemeral: true
        });
      }

      // Build embed with enhanced UI
      const title = filterUser
        ? `Active Temporary Roles for ${filterUser.tag}`
        : `Active Temporary Roles`;

      const description = filterUser
        ? `Showing all active temporary roles for this user`
        : `📊 **Total Active Roles:** ${tempRoles.length}\n🔄 Auto-updating every minute`;

      const embed = createInfoEmbed(title, description);

      // Group by user if not filtered
      const rolesByUser = {};

      for (const tempRole of tempRoles) {
        if (!rolesByUser[tempRole.userId]) {
          rolesByUser[tempRole.userId] = [];
        }
        rolesByUser[tempRole.userId].push(tempRole);
      }

      // Add fields (max 25 fields per embed)
      let fieldCount = 0;
      const maxFields = 25;

      for (const [userId, roles] of Object.entries(rolesByUser)) {
        if (fieldCount >= maxFields) {
          embed.setFooter({
            text: `⚠️ Showing first ${maxFields} entries • Use /temprole-list with user filter for more`,
            iconURL: interaction.client.user.displayAvatarURL()
          });
          break;
        }

        const user = await interaction.client.users.fetch(userId).catch(() => null);
        const userName = user ? user.tag : `User ID: ${userId}`;

        for (const tempRole of roles) {
          if (fieldCount >= maxFields) break;

          const role = guild.roles.cache.get(tempRole.roleId);
          const roleName = role ? role.name : `Role ID: ${tempRole.roleId}`;

          const grantedBy = await interaction.client.users.fetch(tempRole.grantedBy).catch(() => null);
          const grantedByName = grantedBy ? grantedBy.tag : 'Unknown';

          const expiresTimestamp = Math.floor(tempRole.expiresAt.getTime() / 1000);

          const fieldValue = [
            `🎭 **Role:** ${roleName}`,
            `⏰ **Expires:** <t:${expiresTimestamp}:R> (<t:${expiresTimestamp}:f>)`,
            `👮 **Granted by:** ${grantedByName}`,
            tempRole.reason ? `📝 **Reason:** ${tempRole.reason}` : ''
          ].filter(Boolean).join('\n');

          embed.addFields({
            name: `👤 ${userName}`,
            value: fieldValue,
            inline: false
          });

          fieldCount++;
        }
      }

      // Add footer if not already set
      if (!embed.data.footer) {
        embed.setFooter({
          text: `🤖 ${tempRoles.length} active role(s) • Updated every minute`,
          iconURL: interaction.client.user.displayAvatarURL()
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing temporary roles:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while fetching temporary roles. Please try again.'
        )],
        ephemeral: true
      });
    }
  }
};
