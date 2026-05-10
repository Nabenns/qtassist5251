const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { DriveConfig } = require('../../database/models');
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require('../../utils/embedBuilder');
const { getDriveFileInfo } = require('../../services/googleDriveService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drive-setup')
    .setDescription('[ADMIN] Setup Google Drive auto-share untuk email registration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Tambah Drive folder/file untuk auto-share')
        .addStringOption(option =>
          option
            .setName('drive_id')
            .setDescription('Google Drive file/folder ID (dari URL)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Hapus Drive folder/file dari auto-share')
        .addStringOption(option =>
          option
            .setName('drive_id')
            .setDescription('Google Drive file/folder ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat semua Drive folder/file yang ter-config')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable auto-share saat email didaftarkan')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable auto-share')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Set permission role untuk auto-share')
        .addStringOption(option =>
          option
            .setName('permission')
            .setDescription('Permission level')
            .setRequired(true)
            .addChoices(
              { name: 'Reader (View only)', value: 'reader' },
              { name: 'Commenter (Can comment)', value: 'commenter' },
              { name: 'Writer (Can edit)', value: 'writer' }
            )
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    try {
      // Get or create config
      let config = await DriveConfig.findOne({
        where: { serverId: guild.id }
      });

      if (!config) {
        config = await DriveConfig.create({
          serverId: guild.id,
          driveFileIds: '',
          autoShareEnabled: false,
          shareRole: 'reader'
        });
      }

      // Handle subcommands
      if (subcommand === 'add') {
        const driveId = interaction.options.getString('drive_id').trim();

        // Validate Drive ID by trying to get file info
        try {
          const fileInfo = await getDriveFileInfo(driveId);
          if (!fileInfo) {
            return interaction.editReply({
              embeds: [createErrorEmbed(
                'Google Drive Tidak Terkonfigurasi',
                'Service account Google Drive belum dikonfigurasi.\n\n' +
                'Pastikan `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_PRIVATE_KEY` sudah diset di `.env`.'
              )]
            });
          }

          // Add to config
          const currentIds = config.driveFileIds ? config.driveFileIds.split(',') : [];
          if (currentIds.includes(driveId)) {
            return interaction.editReply({
              embeds: [createInfoEmbed(
                'Drive ID Sudah Ada',
                `Drive folder/file \`${driveId}\` sudah ada di config.`
              )]
            });
          }

          currentIds.push(driveId);
          config.driveFileIds = currentIds.join(',');
          config.updatedAt = new Date();
          await config.save();

          return interaction.editReply({
            embeds: [createSuccessEmbed(
              'Drive Folder/File Ditambahkan',
              `**Nama:** ${fileInfo.name}\n` +
              `**Type:** ${fileInfo.mimeType.includes('folder') ? 'Folder' : 'File'}\n` +
              `**Drive ID:** \`${driveId}\`\n\n` +
              `Sekarang ada ${currentIds.length} Drive folder/file ter-config.\n\n` +
              `Gunakan \`/drive-setup enable\` untuk mengaktifkan auto-share.`
            )]
          });

        } catch (error) {
          return interaction.editReply({
            embeds: [createErrorEmbed(
              'Drive ID Tidak Valid',
              `Tidak bisa mengakses Drive file/folder dengan ID: \`${driveId}\`\n\n` +
              `Pastikan:\n` +
              `• Drive ID benar (dari URL)\n` +
              `• Service account punya akses ke file/folder tersebut\n` +
              `• File/folder sudah di-share ke service account email`
            )]
          });
        }
      }

      if (subcommand === 'remove') {
        const driveId = interaction.options.getString('drive_id').trim();

        const currentIds = config.driveFileIds ? config.driveFileIds.split(',') : [];
        if (!currentIds.includes(driveId)) {
          return interaction.editReply({
            embeds: [createErrorEmbed(
              'Drive ID Tidak Ditemukan',
              `Drive ID \`${driveId}\` tidak ada di config.`
            )]
          });
        }

        const filtered = currentIds.filter(id => id !== driveId);
        config.driveFileIds = filtered.join(',');
        config.updatedAt = new Date();
        await config.save();

        return interaction.editReply({
          embeds: [createSuccessEmbed(
            'Drive Folder/File Dihapus',
            `Drive ID \`${driveId}\` berhasil dihapus dari config.\n\n` +
            `Sisa: ${filtered.length} Drive folder/file.`
          )]
        });
      }

      if (subcommand === 'list') {
        const currentIds = config.driveFileIds ? config.driveFileIds.split(',').filter(id => id) : [];

        if (currentIds.length === 0) {
          return interaction.editReply({
            embeds: [createInfoEmbed(
              'Belum Ada Drive Ter-config',
              'Gunakan `/drive-setup add <drive_id>` untuk menambah Drive folder/file.'
            )]
          });
        }

        let description = `**Status:** ${config.autoShareEnabled ? '✅ Enabled' : '❌ Disabled'}\n`;
        description += `**Permission:** ${config.shareRole}\n\n`;
        description += `**Drive Folders/Files (${currentIds.length}):**\n\n`;

        for (const driveId of currentIds) {
          try {
            const fileInfo = await getDriveFileInfo(driveId);
            const type = fileInfo.mimeType.includes('folder') ? '📁' : '📄';
            description += `${type} **${fileInfo.name}**\n`;
            description += `└ ID: \`${driveId}\`\n\n`;
          } catch (error) {
            description += `❌ **Error loading info**\n`;
            description += `└ ID: \`${driveId}\`\n\n`;
          }
        }

        return interaction.editReply({
          embeds: [createInfoEmbed('Google Drive Auto-Share Config', description)]
        });
      }

      if (subcommand === 'enable') {
        if (config.autoShareEnabled) {
          return interaction.editReply({
            embeds: [createInfoEmbed(
              'Auto-Share Sudah Enabled',
              'Google Drive auto-share sudah aktif.'
            )]
          });
        }

        config.autoShareEnabled = true;
        config.updatedAt = new Date();
        await config.save();

        return interaction.editReply({
          embeds: [createSuccessEmbed(
            'Auto-Share Enabled',
            '✅ Google Drive auto-share diaktifkan!\n\n' +
            'Setiap user yang mendaftar email akan otomatis mendapat akses ke Drive folder/file yang ter-config.'
          )]
        });
      }

      if (subcommand === 'disable') {
        if (!config.autoShareEnabled) {
          return interaction.editReply({
            embeds: [createInfoEmbed(
              'Auto-Share Sudah Disabled',
              'Google Drive auto-share tidak aktif.'
            )]
          });
        }

        config.autoShareEnabled = false;
        config.updatedAt = new Date();
        await config.save();

        return interaction.editReply({
          embeds: [createSuccessEmbed(
            'Auto-Share Disabled',
            '❌ Google Drive auto-share dinonaktifkan.\n\n' +
            'User yang mendaftar email tidak akan otomatis mendapat akses Drive.'
          )]
        });
      }

      if (subcommand === 'role') {
        const role = interaction.options.getString('permission');

        config.shareRole = role;
        config.updatedAt = new Date();
        await config.save();

        const roleNames = {
          reader: 'Reader (View only)',
          commenter: 'Commenter (Can comment)',
          writer: 'Writer (Can edit)'
        };

        return interaction.editReply({
          embeds: [createSuccessEmbed(
            'Permission Role Updated',
            `Permission untuk auto-share diubah ke: **${roleNames[role]}**`
          )]
        });
      }

    } catch (error) {
      console.error('Error in drive-setup command:', error);
      return interaction.editReply({
        embeds: [createErrorEmbed(
          'Error',
          'Terjadi kesalahan saat mengatur Drive config.'
        )]
      });
    }
  },
};
