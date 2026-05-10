const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { EmailBinding } = require('../../database/models');
const { QTRADES_LOGO_URL } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('email-list')
    .setDescription('[ADMIN] Lihat semua email yang terdaftar')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Halaman yang ingin ditampilkan (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;

    try {
      // Get all email bindings for this server
      const allBindings = await EmailBinding.findAll({
        where: { serverId: guild.id },
        order: [['registeredAt', 'DESC']]
      });

      if (allBindings.length === 0) {
        return interaction.editReply({
          embeds: [{
            color: 0x3498db,
            title: '📧 Daftar Email Terdaftar',
            description: 'Belum ada email yang terdaftar.',
            footer: {
              text: guild.name,
              icon_url: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
            }
          }]
        });
      }

      // Calculate pagination
      const totalPages = Math.ceil(allBindings.length / perPage);
      const currentPage = Math.min(page, totalPages);
      const startIndex = (currentPage - 1) * perPage;
      const endIndex = startIndex + perPage;
      const pageBindings = allBindings.slice(startIndex, endIndex);

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📧 Daftar Email Terdaftar')
        .setDescription(`Total: **${allBindings.length} email** terdaftar\n\nHalaman ${currentPage}/${totalPages}`)
        .setTimestamp()
        .setFooter({
          text: `${guild.name} • Gunakan /email-list page:<nomor> untuk halaman lain`,
          iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
        });

      // Add fields for each binding
      for (const binding of pageBindings) {
        try {
          // Try to fetch username
          const member = await guild.members.fetch(binding.userId).catch(() => null);
          const username = member ? member.user.tag : `User ID: ${binding.userId}`;

          const registeredDate = new Date(binding.registeredAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Jakarta'
          });

          embed.addFields({
            name: `👤 ${username}`,
            value: `**Email:** \`${binding.email}\`\n**Terdaftar:** ${registeredDate}`,
            inline: false
          });
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in email-list command:', error);
      return interaction.editReply({
        content: '❌ Terjadi kesalahan saat mengambil daftar email.',
      });
    }
  },
};
