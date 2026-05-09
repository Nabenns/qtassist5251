const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { parseDuration, formatDuration } = require('../../utils/parseDuration');
const { createSuccessEmbed, createErrorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole-add')
    .setDescription('Assign a temporary role to a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to assign the role to')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('The role to assign')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Duration (e.g., 1d, 12h, 30m, 7d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for assigning this role')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUser.id);

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Invalid Duration',
          'Invalid duration format. Use: 1m, 1h, 1d, 7d, 1w, or combinations like 1d12h'
        )],
        ephemeral: true
      });
    }

    // Check if user already has the role (permanent)
    if (member.roles.cache.has(role.id)) {
      // Check if it's a temporary role
      const existingTempRole = await TemporaryRole.findOne({
        where: {
          serverId: guild.id,
          userId: targetUser.id,
          roleId: role.id
        }
      });

      if (!existingTempRole) {
        // User has permanent role, skip
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Role Already Assigned',
            `${targetUser} already has the ${role} role permanently. Skipping assignment.`
          )],
          ephemeral: true
        });
      } else {
        // User already has this temporary role
        return interaction.editReply({
          embeds: [createErrorEmbed(
            'Temporary Role Exists',
            `${targetUser} already has a temporary ${role} role.\nUse \`/temprole-extend\` to extend the duration.`
          )],
          ephemeral: true
        });
      }
    }

    // Check role hierarchy
    const botMember = await guild.members.fetch(interaction.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Hierarchy Error',
          `Cannot assign ${role} - this role is higher than or equal to my highest role.`
        )],
        ephemeral: true
      });
    }

    if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Hierarchy Error',
          `Cannot assign ${role} - this role is higher than or equal to your highest role.`
        )],
        ephemeral: true
      });
    }

    try {
      // Add role to user
      await member.roles.add(role);

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + durationMs);

      // Create database entry
      await TemporaryRole.create({
        serverId: guild.id,
        userId: targetUser.id,
        roleId: role.id,
        grantedAt: new Date(),
        expiresAt: expiresAt,
        grantedBy: interaction.user.id,
        reason: reason,
        notified24h: false,
        notified1h: false,
        isBulkOperation: false
      });

      // Log action
      await ModerationLog.create({
        actionType: 'temprole_add',
        moderatorId: interaction.user.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        reason: reason,
        expiryTime: expiresAt
      });

      // Send success message
      const embed = createSuccessEmbed(
        'Temporary Role Added',
        null,
        [
          { name: 'User', value: `${targetUser}`, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Duration', value: formatDuration(durationMs), inline: true },
          { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`, inline: false },
          { name: 'Granted By', value: `${interaction.user}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        ]
      );

      embed.setFooter({ text: 'The role will be automatically removed when it expires.' });

      await interaction.editReply({ embeds: [embed] });

      // Send DM to user
      try {
        const dmEmbed = createSuccessEmbed(
          'Temporary Role Assigned',
          `You have been assigned the **${role.name}** role in **${guild.name}**.`,
          [
            { name: 'Duration', value: formatDuration(durationMs), inline: true },
            { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true },
            { name: 'Reason', value: reason, inline: false }
          ]
        );

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log(`Could not send DM to ${targetUser.tag}`);
      }

    } catch (error) {
      console.error('Error adding temporary role:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while adding the temporary role. Please try again.'
        )],
        ephemeral: true
      });
    }
  }
};
