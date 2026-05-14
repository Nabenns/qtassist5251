const { SlashCommandBuilder } = require('discord.js');
const { Transaction, Product, TemporaryRole } = require('../../database/models');
const { createSuccessEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');
const { formatDuration } = require('../../utils/parseDuration');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('my-purchases')
    .setDescription('View your purchase history and active roles'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = interaction.user;
      const guild = interaction.guild;
      const now = new Date();

      // Get active roles
      const activeRoles = await TemporaryRole.findAll({
        where: {
          serverId: guild.id,
          userId: user.id,
          expiresAt: {
            [Op.gt]: now
          }
        },
        order: [['expiresAt', 'ASC']]
      });

      // Get all transactions
      const allTransactions = await Transaction.findAll({
        where: {
          serverId: guild.id,
          userId: user.id
        },
        include: [{
          model: Product,
          as: 'product'
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      // Separate by status
      const paidTransactions = allTransactions.filter(tx => tx.status === 'approved');
      const pendingTransactions = allTransactions.filter(
        tx => tx.status === 'pending' || tx.status === 'pending_review'
      );

      // Format currency
      const formatIDR = (amount) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount);

      // Build active roles text
      let activeRolesText = '';
      if (activeRoles.length > 0) {
        activeRolesText = activeRoles.map((tempRole, index) => {
          const role = guild.roles.cache.get(tempRole.roleId);
          const roleName = role ? role.name : 'Unknown Role';
          const expiresTimestamp = Math.floor(tempRole.expiresAt.getTime() / 1000);
          return `${index + 1}. **${roleName}** - Expires <t:${expiresTimestamp}:R>`;
        }).join('\n');
      } else {
        activeRolesText = 'No active roles';
      }

      // Build purchase history text
      let historyText = '';
      if (paidTransactions.length > 0) {
        historyText = paidTransactions.slice(0, 5).map((tx, index) => {
          const product = tx.product ? tx.product.name : 'Unknown Product';
          const amount = formatIDR(tx.amount);
          const time = `<t:${Math.floor(new Date(tx.paidAt).getTime() / 1000)}:d>`;
          return `${index + 1}. ${product} - ${amount} (${time})`;
        }).join('\n');
      } else {
        historyText = 'No purchase history';
      }

      // Build pending transactions text
      let pendingText = '';
      if (pendingTransactions.length > 0) {
        pendingText = pendingTransactions.map((tx, index) => {
          const product = tx.product ? tx.product.name : 'Unknown Product';
          const amount = formatIDR(tx.amount);
          const created = `<t:${Math.floor(new Date(tx.createdAt).getTime() / 1000)}:R>`;
          return `${index + 1}. ${product} - ${amount}\n   Order ID: \`${tx.orderId}\`\n   Created ${created}`;
        }).join('\n\n');
      } else {
        pendingText = 'No pending payments';
      }

      // Calculate total spent
      const totalSpent = paidTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // Create embed
      const embed = createSuccessEmbed(
        '🛒 My Purchases',
        `Purchase history for ${user.tag}`,
        [
          {
            name: '✅ Active Roles',
            value: activeRolesText,
            inline: false
          },
          {
            name: '📊 Statistics',
            value: `Total Purchases: **${paidTransactions.length}**\nTotal Spent: **${formatIDR(totalSpent)}**\nPending Orders: **${pendingTransactions.length}**`,
            inline: false
          },
          {
            name: '🕒 Recent Purchases (Last 5)',
            value: historyText,
            inline: false
          }
        ]
      );

      if (pendingTransactions.length > 0) {
        embed.addFields({
          name: '⏳ Pending Payments',
          value: pendingText,
          inline: false
        });
      }

      embed.setFooter({
        text: `${guild.name} • Use /transaction-process to manually verify pending payments`,
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      })
      .setThumbnail(QTRADES_LOGO_URL || user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in my-purchases command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching your purchase history.',
        ephemeral: true
      });
    }
  }
};
