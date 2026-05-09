const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { parseDuration, formatDuration } = require('../../utils/parseDuration');
const { createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole-extend')
    .setDescription('Extend the duration of a temporary role')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user whose role to extend')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to extend')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('additional_time')
        .setDescription('Additional time to add (e.g., 1d, 12h, 30m)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const additionalTimeStr = interaction.options.getString('additional_time');
    const guild = interaction.guild;

    // Parse additional time
    const additionalMs = parseDuration(additionalTimeStr);
    if (!additionalMs) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Invalid Duration',
          'Invalid duration format. Use: 1m, 1h, 1d, 7d, 1w, or combinations like 1d12h'
        )],
        ephemeral: true
      });
    }

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

      // Calculate new expiry time
      const oldExpiresAt = new Date(tempRole.expiresAt);
      const newExpiresAt = new Date(oldExpiresAt.getTime() + additionalMs);

      // Update database
      tempRole.expiresAt = newExpiresAt;
      tempRole.notified24h = false; // Reset notifications
      tempRole.notified1h = false;
      await tempRole.save();

      // Log action
      await ModerationLog.create({
        actionType: 'temprole_extend',
        moderatorId: interaction.user.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        reason: `Extended by ${formatDuration(additionalMs)}`,
        expiryTime: newExpiresAt
      });

      // Send success message
      const embed = createSuccessEmbed(
        'Temporary Role Extended',
        null,
        [
          { name: 'User', value: `${targetUser}`, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Extended By', value: `${interaction.user}`, inline: true },
          { name: 'Additional Time', value: formatDuration(additionalMs), inline: true },
          { name: 'Old Expiry', value: `<t:${Math.floor(oldExpiresAt.getTime() / 1000)}:F>`, inline: false },
          { name: 'New Expiry', value: `<t:${Math.floor(newExpiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(newExpiresAt.getTime() / 1000)}:R>)`, inline: false }
        ]
      );

      await interaction.editReply({ embeds: [embed] });

      // Notify user via DM
      try {
        const dmEmbed = createSuccessEmbed(
          'Temporary Role Extended',
          `Your temporary **${role.name}** role in **${guild.name}** has been extended.`,
          [
            { name: 'Additional Time', value: formatDuration(additionalMs), inline: true },
            { name: 'New Expiry', value: `<t:${Math.floor(newExpiresAt.getTime() / 1000)}:R>`, inline: true }
          ]
        );

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Could not send DM to ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Error extending temporary role:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while extending the temporary role. Please try again.'
        )],
        ephemeral: true
      });
    }
  }
};
