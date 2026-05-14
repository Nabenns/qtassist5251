const express = require('express');
const os = require('os');
const { Op } = require('sequelize');
const { sequelize, AdminUser, Transaction, TemporaryRole } = require('../../database/models');
const { getCronStatus } = require('../../services/cronStatus');
const { requireAuth } = require('../middleware');

/**
 * GET /api/bot/status
 * Live snapshot of bot health: gateway state, ping, guild/member counts,
 * uptime, memory usage, db connectivity, cron job state.
 */

function buildRouter({ getDiscordClient, getProcessStartedAt }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/status', async (req, res) => {
    try {
      const client = getDiscordClient();
      const now = Date.now();
      const startedAt = getProcessStartedAt();

      // Memory
      const mem = process.memoryUsage();

      // DB ping
      let dbStatus = 'unknown';
      let dbLatencyMs = null;
      try {
        const t0 = Date.now();
        await sequelize.authenticate();
        dbLatencyMs = Date.now() - t0;
        dbStatus = 'ok';
      } catch (err) {
        dbStatus = 'error';
      }

      const [adminCount, totalTransactions, totalActiveTempRoles] = await Promise.all([
        AdminUser.count().catch(() => 0),
        Transaction.count().catch(() => 0),
        TemporaryRole.count({ where: { expiresAt: { [Op.gt]: new Date() } } }).catch(() => 0)
      ]);

      let discord = {
        ready: false,
        ping: null,
        username: null,
        userId: null,
        guildCount: 0,
        totalMembers: 0,
        guilds: []
      };

      if (client && client.isReady && client.isReady()) {
        const guilds = client.guilds.cache.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
          iconURL: g.iconURL({ extension: 'png', size: 64 }) || null
        }));
        discord = {
          ready: true,
          ping: client.ws.ping,
          username: client.user ? client.user.username : null,
          userId: client.user ? client.user.id : null,
          guildCount: guilds.length,
          totalMembers: guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0),
          guilds
        };
      }

      return res.json({
        timestamp: new Date().toISOString(),
        process: {
          uptimeSeconds: Math.floor((now - startedAt) / 1000),
          startedAt: new Date(startedAt).toISOString(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          hostname: os.hostname(),
          memory: {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external
          },
          loadAvg: os.loadavg(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem()
        },
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          dialect: sequelize.getDialect(),
          host: sequelize.config?.host || null
        },
        discord,
        counters: {
          adminUsers: adminCount,
          totalTransactions,
          activeTempRoles: totalActiveTempRoles
        },
        cron: getCronStatus()
      });
    } catch (error) {
      console.error('GET /api/bot/status error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
