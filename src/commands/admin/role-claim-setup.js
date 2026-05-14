const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { createSuccessEmbed, createErrorEmbed, QTRADES_LOGO_URL, COLORS } = require('../../utils/embedBuilder');

const MAX_ROLES = 5;

module.exports = {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName('role-claim-setup')
      .setDescription('[ADMIN] Post a claim message with buttons that give users a role on click')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Channel to send the claim message')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('role1')
          .setDescription('First claimable role')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    // Slots 2..5 are optional
    for (let i = 2; i <= MAX_ROLES; i++) {
      builder.addRoleOption(option =>
        option
          .setName(`role${i}`)
          .setDescription(`Optional claimable role #${i}`)
          .setRequired(false)
      );
    }

    builder
      .addStringOption(option =>
        option
          .setName('title')
          .setDescription('Custom embed title (optional)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('description')
          .setDescription('Custom embed description (optional). Use \\n for newlines.')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('button_style')
          .setDescription('Button color (default: primary/blue)')
          .setRequired(false)
          .addChoices(
            { name: 'Primary (Blue)', value: 'primary' },
            { name: 'Success (Green)', value: 'success' },
            { name: 'Secondary (Gray)', value: 'secondary' },
            { name: 'Danger (Red)', value: 'danger' }
          )
      );

    return builder;
  })(),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    // Collect role options into an array, skipping empty slots
    const roles = [];
    const seenRoleIds = new Set();
    for (let i = 1; i <= MAX_ROLES; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (!role) continue;
      if (seenRoleIds.has(role.id)) continue; // dedupe
      seenRoleIds.add(role.id);
      roles.push(role);
    }

    if (roles.length === 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed('No Roles', 'Pilih minimal 1 role yang bisa di-claim.')]
      });
    }

    // Validate roles
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Bot Tidak Punya Permission',
          'Bot tidak punya permission **Manage Roles**. Tambahkan permission tersebut ke bot lalu coba lagi.'
        )]
      });
    }

    const botHighestPosition = botMember.roles.highest.position;
    const invalidRoles = [];

    for (const role of roles) {
      if (role.id === guild.id) {
        invalidRoles.push(`${role.name} (@everyone tidak bisa di-assign)`);
        continue;
      }
      if (role.managed) {
        invalidRoles.push(`${role.name} (managed role / bot integration role)`);
        continue;
      }
      if (role.position >= botHighestPosition) {
        invalidRoles.push(`${role.name} (posisi role lebih tinggi atau sama dengan role bot)`);
        continue;
      }
    }

    if (invalidRoles.length > 0) {
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Role Tidak Valid',
          `Bot tidak bisa assign role berikut:\n\n${invalidRoles.map(r => `• ${r}`).join('\n')}\n\nPindahkan role bot ke posisi paling atas atau pilih role lain.`
        )]
      });
    }

    // Build embed
    const customTitle = interaction.options.getString('title');
    const customDescription = interaction.options.getString('description');
    const buttonStyleChoice = interaction.options.getString('button_style') || 'primary';

    const styleMap = {
      primary: ButtonStyle.Primary,
      success: ButtonStyle.Success,
      secondary: ButtonStyle.Secondary,
      danger: ButtonStyle.Danger
    };
    const buttonStyle = styleMap[buttonStyleChoice];

    const defaultDescription = roles.length === 1
      ? `Klik tombol di bawah untuk mendapatkan role <@&${roles[0].id}>.`
      : `Klik salah satu tombol di bawah untuk mendapatkan role yang kamu inginkan.\n\n**Role tersedia:**\n${roles.map(r => `• <@&${r.id}>`).join('\n')}`;

    const claimEmbed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(customTitle || '🎯 Klaim Role')
      .setDescription(
        (customDescription ? customDescription.replace(/\\n/g, '\n') : defaultDescription)
      )
      .setTimestamp();

    claimEmbed.setFooter({
      text: 'QTrades • Klik tombol untuk klaim role',
      iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
    });

    if (QTRADES_LOGO_URL) {
      claimEmbed.setThumbnail(QTRADES_LOGO_URL);
    }

    // Build buttons (max 5 per row; we cap at 5 roles total so 1 row is enough)
    const buttons = roles.map(role =>
      new ButtonBuilder()
        .setCustomId(`claim_role_${role.id}`)
        .setLabel(role.name.length > 80 ? role.name.slice(0, 77) + '...' : role.name)
        .setStyle(buttonStyle)
        .setEmoji('🎭')
    );

    const row = new ActionRowBuilder().addComponents(buttons);

    let sentMessage;
    try {
      sentMessage = await channel.send({
        embeds: [claimEmbed],
        components: [row]
      });
    } catch (error) {
      console.error('Failed to send claim message:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Gagal Kirim Message',
          `Bot tidak bisa kirim message ke ${channel}. Pastikan bot punya permission **View Channel**, **Send Messages**, dan **Embed Links** di channel tersebut.`
        )]
      });
    }

    const confirmEmbed = createSuccessEmbed(
      'Role Claim Setup Complete',
      `Claim message berhasil dikirim ke ${channel}`,
      [
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Roles', value: roles.map(r => `<@&${r.id}>`).join('\n'), inline: true },
        { name: 'Message ID', value: sentMessage.id, inline: false }
      ]
    );

    confirmEmbed.setFooter({
      text: 'User sekarang bisa klaim role dengan klik tombol',
      iconURL: QTRADES_LOGO_URL || interaction.client.user.displayAvatarURL()
    });

    await interaction.editReply({ embeds: [confirmEmbed] });
  }
};
