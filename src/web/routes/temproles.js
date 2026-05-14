const express = require('express');
const { Op } = require('sequelize');
const { TemporaryRole, ModerationLog } = require('../../database/models');
const { parseDuration } = require('../../utils/parseDuration');
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

  router.post('/', async (req, res) => {
    try {
      const client = getDiscordClient();
      if (!client) return res.status(503).json({ error: 'bot_not_ready' });

      const { serverId, userId, roleId, duration, reason } = req.body || {};
      if (!serverId || !userId || !roleId) {
        return res.status(400).json({ error: 'missing_fields' });
      }
      let durationMs;
      if (typeof duration === 'string') {
        durationMs = parseDuration(duration);
        if (!durationMs) return res.status(400).json({ error: 'invalid_duration' });
      } else {
        durationMs = Number(duration);
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
          return res.status(400).json({ error: 'invalid_duration' });
        }
      }

      const guild = await client.guilds.fetch(serverId).catch(() => null);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      const role =
        guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
      if (!role) return res.status(404).json({ error: 'role_not_found' });
      if (role.id === guild.id) return res.status(400).json({ error: 'role_is_everyone' });
      if (role.managed) return res.status(400).json({ error: 'role_is_managed' });

      const me = await guild.members.fetchMe().catch(() => null);
      if (!me) return res.status(503).json({ error: 'bot_not_in_guild' });
      if (role.position >= me.roles.highest.position) {
        return res.status(400).json({ error: 'role_above_bot' });
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'member_not_found' });

      // Stack with existing record if present
      const now = new Date();
      const existing = await TemporaryRole.findOne({
        where: { serverId: guild.id, userId, roleId: role.id }
      });

      let record;
      let expiresAt;
      const moderatorId = client.user ? client.user.id : 'web-admin';
      const adminLabel = `web:${req.adminUser.username}`;

      if (existing && existing.expiresAt > now) {
        expiresAt = new Date(existing.expiresAt.getTime() + durationMs);
        await existing.update({ expiresAt, notified24h: false, notified1h: false });
        record = existing;
      } else {
        if (existing) await existing.destroy();
        expiresAt = new Date(Date.now() + durationMs);
        record = await TemporaryRole.create({
          serverId: guild.id,
          userId,
          roleId: role.id,
          grantedAt: new Date(),
          expiresAt,
          grantedBy: moderatorId,
          reason: reason || `Granted via web admin (${adminLabel})`,
          notified24h: false,
          notified1h: false
        });
      }

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, `Web admin (${req.adminUser.username})`);
      }

      await ModerationLog.create({
        actionType: existing && existing.expiresAt > now ? 'temprole_extend' : 'temprole_add',
        moderatorId,
        targetUserId: userId,
        roleId: role.id,
        reason: reason || `Granted via web admin by ${req.adminUser.username}`,
        expiryTime: expiresAt,
        additionalData: { source: 'web', adminUsername: req.adminUser.username }
      });

      return res.status(201).json({
        ok: true,
        record: {
          id: record.id,
          serverId: record.serverId,
          userId: record.userId,
          roleId: record.roleId,
          expiresAt: record.expiresAt,
          grantedAt: record.grantedAt,
          reason: record.reason
        }
      });
    } catch (error) {
      console.error('POST /api/temproles error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/:id/extend', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
      const { duration } = req.body || {};

      let durationMs;
      if (typeof duration === 'string') {
        durationMs = parseDuration(duration);
        if (!durationMs) return res.status(400).json({ error: 'invalid_duration' });
      } else {
        durationMs = Number(duration);
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
          return res.status(400).json({ error: 'invalid_duration' });
        }
      }

      const record = await TemporaryRole.findByPk(id);
      if (!record) return res.status(404).json({ error: 'not_found' });

      const base = record.expiresAt > new Date() ? record.expiresAt : new Date();
      const newExpiry = new Date(base.getTime() + durationMs);
      await record.update({
        expiresAt: newExpiry,
        notified24h: false,
        notified1h: false
      });

      const client = getDiscordClient();
      const moderatorId = client && client.user ? client.user.id : 'web-admin';
      await ModerationLog.create({
        actionType: 'temprole_extend',
        moderatorId,
        targetUserId: record.userId,
        roleId: record.roleId,
        reason: `Extended by ${durationMs}ms via web admin (${req.adminUser.username})`,
        expiryTime: newExpiry,
        additionalData: { source: 'web', adminUsername: req.adminUser.username }
      });

      return res.json({
        ok: true,
        record: {
          id: record.id,
          expiresAt: record.expiresAt
        }
      });
    } catch (error) {
      console.error('POST /api/temproles/:id/extend error:', error);
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
        reason: `Removed via web admin by ${req.adminUser.username}`,
        additionalData: { source: 'web', adminUsername: req.adminUser.username }
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
