const express = require('express');
const { EmailRole } = require('../../database/models');
const { requireAdmin } = require('../middleware');

/**
 * Email Roles management.
 *
 * Curates the list of Discord role IDs that grant access to the
 * email-binding feature. The eligibility helper at
 * `src/services/emailEligibility.js` reads this table to decide
 * whether a user can register / update / delete their email.
 *
 *   GET    /api/email-roles                List configured email roles
 *   POST   /api/email-roles                Add a role { roleId, label? }
 *   DELETE /api/email-roles/:id            Remove a role entry
 *   GET    /api/email-roles/guild-roles    List actual guild roles for the picker
 */
function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAdmin);

  function getServerId(req) {
    return String(req.query.serverId || req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
  }

  router.get('/', async (req, res) => {
    try {
      const serverId = getServerId(req);
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });
      const rows = await EmailRole.findAll({
        where: { serverId },
        order: [['createdAt', 'ASC']]
      });
      return res.json({
        items: rows.map((r) => ({
          id: r.id,
          serverId: r.serverId,
          roleId: r.roleId,
          label: r.label,
          addedByDiscordId: r.addedByDiscordId,
          createdAt: r.createdAt
        }))
      });
    } catch (error) {
      console.error('GET /api/email-roles error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const serverId = getServerId(req);
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const roleId = String(req.body?.roleId || '').trim();
      if (!/^\d{15,25}$/.test(roleId)) {
        return res.status(400).json({
          error: 'invalid_role_id',
          message: 'Role ID Discord harus berupa angka (snowflake).'
        });
      }

      let label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
      if (!label) {
        try {
          const client = getDiscordClient();
          if (client) {
            const guild = await client.guilds.fetch(serverId);
            const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId));
            if (role) label = role.name;
          }
        } catch (_) {
          // best-effort only
        }
      }
      if (!label) label = `role-${roleId}`;

      const [row, created] = await EmailRole.findOrCreate({
        where: { serverId, roleId },
        defaults: {
          serverId,
          roleId,
          label,
          addedByDiscordId: req.session?.discordId || null
        }
      });

      if (!created) {
        return res.status(409).json({
          error: 'already_exists',
          message: 'Role ini sudah ada di daftar email.'
        });
      }

      return res.status(201).json({
        ok: true,
        item: {
          id: row.id,
          serverId: row.serverId,
          roleId: row.roleId,
          label: row.label,
          addedByDiscordId: row.addedByDiscordId,
          createdAt: row.createdAt
        }
      });
    } catch (error) {
      console.error('POST /api/email-roles error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

      const row = await EmailRole.findByPk(id);
      if (!row) return res.status(404).json({ error: 'not_found' });

      // No "last role" safeguard here — admins can validly empty the list
      // to disable the feature entirely (closes self-service for non-admins).
      await row.destroy();
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/email-roles/:id error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  /**
   * SPA helper — list actual guild roles for the picker dropdown.
   */
  router.get('/guild-roles', async (req, res) => {
    try {
      const serverId = getServerId(req);
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const client = getDiscordClient();
      if (!client) return res.status(503).json({ error: 'bot_not_ready' });

      const guild = await client.guilds.fetch(serverId);
      const roles = await guild.roles.fetch();
      const items = [...roles.values()]
        .filter((r) => r.id !== guild.id) // skip @everyone
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position,
          managed: r.managed
        }));
      return res.json({ items });
    } catch (error) {
      console.error('GET /api/email-roles/guild-roles error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  return router;
}

module.exports = buildRouter;
