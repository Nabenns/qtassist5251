const express = require('express');
const { Op } = require('sequelize');
const {
  Transaction,
  Product,
  TemporaryRole,
  EmailBinding,
  ModerationLog
} = require('../../database/models');
const { requireAdmin } = require('../middleware');

/**
 * Return a unified profile for a single Discord user:
 *   - Discord identity (if bot can fetch them)
 *   - Active + expired temporary roles
 *   - All transactions (paginated, summary first)
 *   - Email binding(s) across guilds
 *   - Recent moderation log entries where they are the target
 *   - Aggregate counters (total spent, total transactions, etc.)
 */

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAdmin);

  router.get('/:userId', async (req, res) => {
    try {
      const userId = String(req.params.userId).trim();
      if (!userId) {
        return res.status(400).json({ error: 'invalid_user_id' });
      }

      const client = getDiscordClient();

      const [
        transactions,
        tempRoles,
        emailBindings,
        moderationLogs
      ] = await Promise.all([
        Transaction.findAll({
          where: { userId },
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'roleId', 'duration'] }],
          order: [['createdAt', 'DESC']]
        }),
        TemporaryRole.findAll({
          where: { userId },
          order: [['expiresAt', 'ASC']]
        }),
        EmailBinding.findAll({
          where: { userId },
          order: [['updatedAt', 'DESC']]
        }),
        ModerationLog.findAll({
          where: { targetUserId: userId },
          order: [['createdAt', 'DESC']],
          limit: 25
        })
      ]);

      // Try to fetch Discord identity. Failure is non-fatal (user may have
      // left the guild or might just be unreachable from cache).
      let discord = null;
      if (client) {
        try {
          const user = await client.users.fetch(userId);
          discord = {
            id: user.id,
            username: user.username,
            globalName: user.globalName || null,
            tag: user.tag,
            avatarURL: user.displayAvatarURL({ extension: 'png', size: 128 })
          };
        } catch (_) {
          discord = null;
        }
      }

      // Counters
      const approved = transactions.filter((t) => t.status === 'approved');
      const pending = transactions.filter((t) => t.status === 'pending' || t.status === 'pending_review');
      const totals = {
        transactions: transactions.length,
        approved: approved.length,
        pending: pending.length,
        rejected: transactions.filter((t) => t.status === 'rejected').length,
        cancelled: transactions.filter((t) => t.status === 'cancelled').length,
        expired: transactions.filter((t) => t.status === 'expired').length,
        totalSpent: approved.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        activeTempRoles: tempRoles.filter((r) => new Date(r.expiresAt) > new Date()).length
      };

      // For each guild the user has temp roles in, try to enrich with role
      // names so the UI doesn't have to look them up itself.
      const enrichedTempRoles = await Promise.all(
        tempRoles.map(async (r) => {
          let roleName = null;
          let guildName = null;
          if (client) {
            try {
              const guild = await client.guilds.fetch(r.serverId).catch(() => null);
              if (guild) {
                guildName = guild.name;
                const role =
                  guild.roles.cache.get(r.roleId) ||
                  (await guild.roles.fetch(r.roleId).catch(() => null));
                if (role) roleName = role.name;
              }
            } catch (_) {
              // ignore
            }
          }
          return {
            id: r.id,
            serverId: r.serverId,
            guildName,
            roleId: r.roleId,
            roleName,
            grantedAt: r.grantedAt,
            expiresAt: r.expiresAt,
            grantedBy: r.grantedBy,
            reason: r.reason,
            isActive: new Date(r.expiresAt) > new Date()
          };
        })
      );

      return res.json({
        userId,
        discord,
        totals,
        transactions: transactions.map((t) => ({
          id: t.id,
          orderId: t.orderId,
          serverId: t.serverId,
          productId: t.productId,
          productName: t.product ? t.product.name : null,
          amount: t.amount,
          status: t.status,
          paymentProofUrl: t.paymentProofUrl,
          rejectionReason: t.rejectionReason,
          paidAt: t.paidAt,
          reviewedAt: t.reviewedAt,
          reviewedBy: t.reviewedBy,
          createdAt: t.createdAt
        })),
        tempRoles: enrichedTempRoles,
        emails: emailBindings.map((b) => ({
          id: b.id,
          serverId: b.serverId,
          email: b.email,
          registeredAt: b.registeredAt,
          updatedAt: b.updatedAt
        })),
        moderationLogs: moderationLogs.map((m) => ({
          id: m.id,
          actionType: m.actionType,
          moderatorId: m.moderatorId,
          roleId: m.roleId,
          reason: m.reason,
          expiryTime: m.expiryTime,
          createdAt: m.createdAt
        }))
      });
    } catch (error) {
      console.error('GET /api/users/:userId error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
