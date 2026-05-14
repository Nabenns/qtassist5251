const express = require('express');
const { Op } = require('sequelize');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { requireAuth } = require('../middleware');

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const { active = 'true', limit: limitRaw = '100', offset: offsetRaw = '0' } = req.query;
      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500);
      const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

      const where = {};
      if (active === 'true') {
        where.expiresAt = { [Op.gt]: new Date() };
      } else if (active === 'expired') {
        where.expiresAt = { [Op.lte]: new Date() };
      }

      const { rows, count } = await TemporaryRole.findAndCountAll({
        where,
        order: [['expiresAt', 'ASC']],
        limit,
        offset
      });

      return res.json({
        total: count,
        items: rows.map((r) => ({
          id: r.id,
          serverId: r.serverId,
          userId: r.userId,
          roleId: r.roleId,
          grantedAt: r.grantedAt,
          expiresAt: r.expiresAt,
          grantedBy: r.grantedBy,
          reason: r.reason,
          notified24h: r.notified24h,
          notified1h: r.notified1h
        })),
        limit,
        offset
      });
    } catch (error) {
      console.error('GET /api/temproles error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'invalid_id' });
      }

      const record = await TemporaryRole.findByPk(id);
      if (!record) {
        return res.status(404).json({ error: 'not_found' });
      }

      const client = getDiscordClient();
      if (!client) {
        return res.status(503).json({ error: 'bot_not_ready' });
      }

      // Best-effort: remove the role from the user via the bot
      try {
        const guild = await client.guilds.fetch(record.serverId).catch(() => null);
        if (guild) {
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (member && member.roles.cache.has(record.roleId)) {
            await member.roles.remove(record.roleId, `Removed via web admin (${req.adminUser.username})`);
          }
        }
      } catch (err) {
        console.log('Could not remove discord role during temprole delete:', err.message);
      }

      await ModerationLog.create({
        actionType: 'temprole_remove',
        moderatorId: client.user ? client.user.id : 'web-admin',
        targetUserId: record.userId,
        roleId: record.roleId,
        reason: `Removed via web admin by ${req.adminUser.username}`
      });

      await record.destroy();
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/temproles/:id error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
