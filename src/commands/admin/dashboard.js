const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Transaction, Product, TemporaryRole } = require('../../database/models');
const { createSuccessEmbed, QTRADES_LOGO_URL } = require('../../utils/embedBuilder');
const { Op } = require('sequelize');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View admin dashboard with statistics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const now = new Date();

      // Today's date range
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      // This month's date range
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Revenue Statistics
      const todayRevenue = await Transaction.sum('amount', {
        where: {
          serverId: guild.id,
          status: 'paid',
          paidAt: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      }) || 0;

      const monthRevenue = await Transaction.sum('amount', {
        where: {
          serverId: guild.id,
          status: 'paid',
          paidAt: {
            [Op.between]: [monthStart, monthEnd]
          }
        }
      }) || 0;

      const totalRevenue = await Transaction.sum('amount', {
        where: {
          serverId: guild.id,
          status: 'paid'
        }
      }) || 0;

      // Transaction Statistics
      const todayTransactions = await Transaction.count({
        where: {
          serverId: guild.id,
          status: 'paid',
          paidAt: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      });

      const pendingTransactions = await Transaction.count({
        where: {
          serverId: guild.id,
          status: 'pending'
        }
      });

      const totalTransactions = await Transaction.count({
        where: {
          serverId: guild.id,
          status: 'paid'
        }
      });

      // Active Subscribers
      const activeSubscribers = await TemporaryRole.count({
        where: {
          serverId: guild.id,
          expiresAt: {
            [Op.gt]: now
          }
        }
      });

      // Recent Transactions (Last 5)
      const recentTransactions = await Transaction.findAll({
        where: {
          serverId: guild.id,
          status: 'paid'
        },
        include: [{
          model: Product,
          as: 'product'
        }],
        order: [['paidAt', 'DESC']],
        limit: 5
      });

      // Format currency
      const formatIDR = (amount) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(amount);

      // Build recent transactions text
      let recentText = '';
      if (recentTransactions.length > 0) {
        recentText = recentTransactions.map((tx, index) => {
          const user = `<@${tx.userId}>`;
          const product = tx.product ? tx.product.name : 'Unknown';
          const amount = formatIDR(tx.amount);
          const time = `<t:${Math.floor(new Date(tx.paidAt).getTime() / 1000)}:R>`;
          return `${index + 1}. ${user} - ${product} (${amount}) ${time}`;
        }).join('\n');
      } else {
        recentText = 'No transactions yet';
      }

      // Create embed
      const embed = createSuccessEmbed(
        '📊 Admin Dashboard',
        `Server statistics for **${guild.name}**`,
        [
          {
            name: '💰 Revenue Statistics',
            value: `Today: **${formatIDR(todayRevenue)}**\nThis Month: **${formatIDR(monthRevenue)}**\nAll Time: **${formatIDR(totalRevenue)}**`,
            inline: true
          },
          {
            name: '📈 Transaction Statistics',
            value: `Today: **${todayTransactions}** sales\nPending: **${pendingTransactions}** orders\nTotal: **${totalTransactions}** sales`,
            inline: true
          },
          {
            name: '👥 Active Subscribers',
            value: `**${activeSubscribers}** active roles`,
            inline: true
          },
          {
            name: '🕒 Recent Transactions',
            value: recentText,
            inline: false
          }
        ]
      );

      embed.setFooter({
        text: `${guild.name} • Updated just now`,
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      })
      .setThumbnail(QTRADES_LOGO_URL || guild.iconURL({ dynamic: true }))
      .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in dashboard command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching dashboard data.',
        ephemeral: true
      });
    }
  }
};
