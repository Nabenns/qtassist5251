const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');

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

      // Send success message
      const embed = createSuccessEmbed(
        'Temporary Role Removed',
        null,
        [
          { name: 'User', value: `${targetUser}`, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Removed By', value: `${interaction.user}`, inline: true }
        ]
      );

      await interaction.editReply({ embeds: [embed] });

      // Notify user via DM
      try {
        await targetUser.send({
          embeds: [createSuccessEmbed(
            'Temporary Role Removed',
            `Your temporary **${role.name}** role in **${guild.name}** has been removed by a moderator.`
          )]
        });
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
