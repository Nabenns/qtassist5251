const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole-remove')
    .setDescription('Remove a temporary role from a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove the role from')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to remove')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const guild = interaction.guild;

    try {
      // Find temporary role in database
      const tempRole = await TemporaryRole.findOne({
        where: {
          serverId: guild.id,
          userId: targetUser.id,
          roleId: role.id
        }
      });

      if (!tempRole) {
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Temporary Role Not Found',
            `${targetUser} does not have a temporary ${role} role.`
          )],
          ephemeral: true
        });
      }

      // Remove role from user
      const member = await guild.members.fetch(targetUser.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
      }

      // Delete from database
      await tempRole.destroy();

      // Log action
      await ModerationLog.create({
        actionType: 'temprole_remove',
        moderatorId: interaction.user.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        reason: 'Manually removed by moderator'
      });

      // Send success message with enhanced UI
      const embed = createSuccessEmbed(
        'Temporary Role Removed',
        `Successfully removed temporary role from ${targetUser}`,
        [
          { name: 'User', value: `${targetUser}`, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Removed By', value: `${interaction.user}`, inline: true }
        ]
      );

      embed.setFooter({
        text: 'Role removed manually by moderator',
        iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
      })
      .setThumbnail(QTRADES_LOGO_URL || targetUser.displayAvatarURL({ dynamic: true }));

      await interaction.editReply({ embeds: [embed] });

      // Notify user via DM with enhanced UI
      try {
        const dmEmbed = createSuccessEmbed(
          'Temporary Role Removed',
          `Your temporary **${role.name}** role in **${guild.name}** has been removed by a moderator.`
        );

        dmEmbed.setFooter({
          text: `${guild.name}`,
          iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
        })
        .setThumbnail(QTRADES_LOGO_URL || guild.iconURL({ dynamic: true }));

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Could not send DM to ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Error removing temporary role:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while removing the temporary role. Please try again.'
        )],
        ephemeral: true
      });
    }
  }
};
