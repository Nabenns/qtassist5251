const express = require('express');
const { Op } = require('sequelize');
const { IbConfig, IbAccount, IbVolumeRecord } = require('../../database/models');
const { encryptString, decryptString, maskSecret } = require('../../utils/secrets');
const { requireAuth, requireAdmin } = require('../middleware');
const valetax = require('../../services/valetaxService');
const ibService = require('../../services/ibService');

/**
 * IB integration REST routes.
 *
 * GET    /api/ib/config                        Current config (cookie redacted)
 * PUT    /api/ib/config                        Update config (partial)
 * POST   /api/ib/config/test-cookie            Trigger a cookie sanity check
 * DELETE /api/ib/config/cookie                 Clear stored cookie
 *
 * GET    /api/ib/accounts                      List submitted accounts
 * GET    /api/ib/accounts/:id                  Single account + recent volume rows
 * POST   /api/ib/accounts/:id/reverify         Manual immediate re-verification
 * POST   /api/ib/accounts/:id/remove           Manual role removal
 * POST   /api/ib/accounts/:id/run-volume       Manual one-shot volume sample
 *
 * POST   /api/ib/volume/run                    Run volume cron for all configs now
 */

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  /* ────────────────────────────────────────────────────────────────────
   * User-facing routes (any logged-in dashboard user, admin or not).
   *
   * These power the /daftar-ib SPA page so non-admin Discord users can
   * submit their broker account number and see verification status
   * without touching admin endpoints below.
   * ──────────────────────────────────────────────────────────────────── */

  router.get('/my-account', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const config = await IbConfig.findOne({ where: { serverId } });
      const account = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId },
        order: [['updatedAt', 'DESC']]
      });

      return res.json({
        config: config
          ? {
              enabled: Boolean(config.enabled),
              ibLink: config.ibLink || null,
              minDepositUsd: Number(config.minDepositUsd) || 0,
              minDailyVolumeLots: Number(config.minDailyVolumeLots) || 0,
              volumeCheckEnabled: Boolean(config.volumeCheckEnabled),
              volumeGraceDays: config.volumeGraceDays
            }
          : null,
        account: account ? serializeAccount(account) : null
      });
    } catch (error) {
      console.error('GET /api/ib/my-account error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/my-account/track-link-clicked', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const [account] = await IbAccount.findOrCreate({
        where: { serverId, userId: req.session.discordId },
        defaults: {
          serverId,
          userId: req.session.discordId,
          status: 'pending',
          brokerAccountNumber: null,
          retryCount: 0
        }
      });

      // Idempotent: only set if currently null
      if (!account.linkClickedAt) {
        account.linkClickedAt = new Date();
        await account.save();
      }

      return res.json({ ok: true, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/my-account/track-link-clicked error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/my-account/track-deposit-confirmed', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const account = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId, brokerAccountNumber: null }
      });
      if (!account) {
        return res.status(404).json({
          error: 'no_account',
          message: 'Selesaikan step 1 dulu sebelum konfirmasi deposit.'
        });
      }
      if (!account.linkClickedAt) {
        return res.status(409).json({
          error: 'step_1_incomplete',
          message: 'Selesaikan step 1 (daftar Valetax) dulu.'
        });
      }

      // Idempotent: only set if currently null
      if (!account.depositConfirmedAt) {
        account.depositConfirmedAt = new Date();
        await account.save();
      }

      return res.json({ ok: true, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/my-account/track-deposit-confirmed error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/my-account', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const accountNumber = String(req.body?.brokerAccountNumber || '').trim();
      if (!accountNumber) {
        return res.status(400).json({
          error: 'missing_account_number',
          message: 'Nomor akun broker wajib diisi.'
        });
      }
      // Account numbers from MT5 / Valetax are numeric and short. Reject
      // obviously bad input early so we don't queue garbage.
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(accountNumber)) {
        return res.status(400).json({
          error: 'invalid_account_number',
          message: 'Nomor akun tidak valid.'
        });
      }

      // Wizard step-completion guard. Skipped for legacy accounts that already
      // have a brokerAccountNumber (mid-retry users from before this feature
      // landed) so they can still submit retries without first running the
      // wizard backfill.
      const existing = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId }
      });
      const isLegacyMidFlow = existing && existing.brokerAccountNumber !== null;
      if (!isLegacyMidFlow) {
        if (!existing || !existing.linkClickedAt) {
          return res.status(412).json({
            error: 'step_1_incomplete',
            message: 'Selesaikan step 1 (daftar Valetax) dulu.'
          });
        }
        if (!existing.depositConfirmedAt) {
          return res.status(412).json({
            error: 'step_2_incomplete',
            message: 'Selesaikan step 2 (konfirmasi deposit) dulu.'
          });
        }
      }

      const client = getDiscordClient();

      // Prevent the same broker account from being claimed by two
      // different Discord users while it is still in active use.
      const conflict = await IbAccount.findOne({
        where: {
          serverId,
          brokerAccountNumber: accountNumber,
          userId: { [Op.ne]: req.session.discordId }
        }
      });
      if (conflict && conflict.status !== 'failed' && conflict.status !== 'removed') {
        return res.status(409).json({
          error: 'account_taken',
          message: 'Nomor akun ini sudah dipakai user lain.'
        });
      }

      const result = await ibService.submitAccount({
        serverId,
        userId: req.session.discordId,
        brokerAccountNumber: accountNumber
      });

      // For new / reset submissions, kick off an immediate verification
      // attempt so the user gets fast feedback instead of waiting for the
      // cron tick. Errors here are fine — the row is already queued.
      if (!result.alreadyVerified && !result.alreadyPending) {
        try {
          const config = await IbConfig.findOne({ where: { serverId } });
          if (config && config.enabled) {
            await ibService.runVerification({
              account: result.account,
              config,
              discordClient: client,
              source: 'manual'
            });
            await result.account.reload();
          }
        } catch (verifyErr) {
          console.error('Inline verification failed (queued for retry):', verifyErr);
        }
      }

      return res.json({
        ok: true,
        alreadyVerified: result.alreadyVerified,
        alreadyPending: result.alreadyPending,
        account: serializeAccount(result.account)
      });
    } catch (error) {
      console.error('POST /api/ib/my-account error:', error);
      return res.status(400).json({
        error: 'submit_failed',
        message: error.message || 'Gagal menyimpan akun.'
      });
    }
  });

  router.post('/my-account/reverify', requireAuth, async (req, res) => {
    try {
      const serverId = String(process.env.DISCORD_GUILD_ID || '');
      const account = await IbAccount.findOne({
        where: { serverId, userId: req.session.discordId },
        order: [['updatedAt', 'DESC']]
      });
      if (!account) return res.status(404).json({ error: 'no_account' });

      // Don't let users hammer the broker. Limit to once per minute.
      const lastChecked = account.lastCheckedAt ? new Date(account.lastCheckedAt) : null;
      if (lastChecked && Date.now() - lastChecked.getTime() < 60 * 1000) {
        return res.status(429).json({
          error: 'too_soon',
          message: 'Tunggu sebentar sebelum cek lagi.'
        });
      }

      const client = getDiscordClient();
      const result = await ibService.reVerifyAccount({ account, discordClient: client });
      await account.reload();
      return res.json({ ok: true, result, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/my-account/reverify error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  /* ────────────────────────────────────────────────────────────────────
   * Admin routes — everything below requires admin role.
   * ──────────────────────────────────────────────────────────────────── */

  router.use(requireAdmin);

  /* ────────────────────────────────────────────────────────────────────
   * Config
   * ──────────────────────────────────────────────────────────────────── */

  router.get('/config', async (req, res) => {
    try {
      const serverId = String(req.query.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) {
        return res.status(400).json({ error: 'missing_server_id' });
      }
      let config = await IbConfig.findOne({ where: { serverId } });
      if (!config) {
        config = await IbConfig.create({ serverId, enabled: false });
      }
      return res.json(serializeConfig(config));
    } catch (error) {
      console.error('GET /api/ib/config error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.put('/config', async (req, res) => {
    try {
      const serverId = String(req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) {
        return res.status(400).json({ error: 'missing_server_id' });
      }
      const [config] = await IbConfig.findOrCreate({
        where: { serverId },
        defaults: { serverId, enabled: false }
      });

      const allowed = [
        'enabled',
        'ibRoleId',
        'registrationChannelId',
        'notificationChannelId',
        'ibLink',
        'partnerId',
        'valetaxBaseUrl',
        'retryIntervalMinutes',
        'maxRetries',
        'minDepositUsd',
        'volumeCheckEnabled',
        'volumeGraceDays',
        'minDailyVolumeLots',
        'embedTitle',
        'embedDescription',
        'embedButtonLabel'
      ];
      const updates = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key];
        }
      }

      // Cookie is handled separately so we don't overwrite it with empty
      // strings from form submissions that didn't touch the cookie field.
      if (
        Object.prototype.hasOwnProperty.call(req.body, 'cookie') &&
        typeof req.body.cookie === 'string'
      ) {
        const trimmed = req.body.cookie.trim();
        if (trimmed === '') {
          // Empty string explicitly clears the cookie
          updates.encryptedCookie = null;
          updates.cookieUpdatedAt = new Date();
          updates.cookieLastTestStatus = 'unknown';
          updates.cookieLastTestMessage = null;
          updates.cookieLastTestedAt = null;
        } else {
          updates.encryptedCookie = encryptString(trimmed);
          updates.cookieUpdatedAt = new Date();
          updates.cookieLastTestStatus = 'unknown';
          updates.cookieLastTestMessage = null;
          updates.cookieLastTestedAt = null;
        }
      }

      // Coerce numeric / boolean
      if ('enabled' in updates) updates.enabled = Boolean(updates.enabled);
      if ('volumeCheckEnabled' in updates)
        updates.volumeCheckEnabled = Boolean(updates.volumeCheckEnabled);
      if ('retryIntervalMinutes' in updates) {
        const n = parseInt(updates.retryIntervalMinutes, 10);
        if (!Number.isFinite(n) || n < 1 || n > 1440) {
          return res.status(400).json({ error: 'invalid_retry_interval' });
        }
        updates.retryIntervalMinutes = n;
      }
      if ('maxRetries' in updates) {
        const n = parseInt(updates.maxRetries, 10);
        if (!Number.isFinite(n) || n < 1 || n > 50) {
          return res.status(400).json({ error: 'invalid_max_retries' });
        }
        updates.maxRetries = n;
      }
      if ('volumeGraceDays' in updates) {
        const n = parseInt(updates.volumeGraceDays, 10);
        if (!Number.isFinite(n) || n < 1 || n > 90) {
          return res.status(400).json({ error: 'invalid_grace_days' });
        }
        updates.volumeGraceDays = n;
      }
      if ('minDepositUsd' in updates) {
        const n = Number(updates.minDepositUsd);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: 'invalid_min_deposit' });
        }
        updates.minDepositUsd = n;
      }
      if ('minDailyVolumeLots' in updates) {
        const n = Number(updates.minDailyVolumeLots);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: 'invalid_min_volume' });
        }
        updates.minDailyVolumeLots = n;
      }

      await config.update(updates);
      return res.json({ ok: true, config: serializeConfig(config) });
    } catch (error) {
      console.error('PUT /api/ib/config error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.delete('/config/cookie', async (req, res) => {
    try {
      const serverId = String(req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
      const config = await IbConfig.findOne({ where: { serverId } });
      if (!config) return res.status(404).json({ error: 'not_found' });
      await config.update({
        encryptedCookie: null,
        cookieUpdatedAt: new Date(),
        cookieLastTestStatus: 'unknown',
        cookieLastTestMessage: null,
        cookieLastTestedAt: null
      });
      return res.json({ ok: true, config: serializeConfig(config) });
    } catch (error) {
      console.error('DELETE /api/ib/config/cookie error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/config/test-cookie', async (req, res) => {
    try {
      const serverId = String(req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
      const config = await IbConfig.findOne({ where: { serverId } });
      if (!config) return res.status(404).json({ error: 'not_found' });
      const result = await valetax.testCookie({ ibConfig: config });
      await config.update({
        cookieLastTestedAt: new Date(),
        cookieLastTestStatus: result.ok ? 'ok' : (result.code === 'expired' ? 'expired' : 'error'),
        cookieLastTestMessage: result.ok ? null : (result.message || null)
      });
      return res.json({
        ok: result.ok,
        status: config.cookieLastTestStatus,
        message: result.message || null
      });
    } catch (error) {
      console.error('POST /api/ib/config/test-cookie error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  /* ────────────────────────────────────────────────────────────────────
   * Accounts
   * ──────────────────────────────────────────────────────────────────── */

  router.get('/accounts', async (req, res) => {
    try {
      const {
        serverId: serverIdRaw,
        status,
        search,
        limit: limitRaw = '50',
        offset: offsetRaw = '0'
      } = req.query;

      const serverId = String(serverIdRaw || process.env.DISCORD_GUILD_ID || '');
      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

      const where = {};
      if (serverId) where.serverId = serverId;
      if (status && status !== 'all') where.status = status;
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        where[Op.or] = [
          { brokerAccountNumber: { [Op.iLike]: term } },
          { userId: { [Op.iLike]: term } }
        ];
      }

      const { rows, count } = await IbAccount.findAndCountAll({
        where,
        order: [
          ['status', 'ASC'],
          ['updatedAt', 'DESC']
        ],
        limit,
        offset
      });

      return res.json({
        total: count,
        items: rows.map(serializeAccount),
        limit,
        offset
      });
    } catch (error) {
      console.error('GET /api/ib/accounts error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.get('/accounts/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
      const account = await IbAccount.findByPk(id);
      if (!account) return res.status(404).json({ error: 'not_found' });
      const volumes = await IbVolumeRecord.findAll({
        where: { ibAccountId: id },
        order: [['date', 'DESC']],
        limit: 60
      });
      return res.json({
        account: serializeAccount(account),
        volumes: volumes.map((v) => ({
          id: v.id,
          date: v.date,
          volumeLots: Number(v.volumeLots) || 0,
          fetchedAt: v.fetchedAt
        }))
      });
    } catch (error) {
      console.error('GET /api/ib/accounts/:id error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/accounts/:id/reverify', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
      const account = await IbAccount.findByPk(id);
      if (!account) return res.status(404).json({ error: 'not_found' });

      const client = getDiscordClient();
      if (!client) return res.status(503).json({ error: 'bot_not_ready' });

      const result = await ibService.reVerifyAccount({ account, discordClient: client });
      await account.reload();
      return res.json({
        ok: true,
        result,
        account: serializeAccount(account)
      });
    } catch (error) {
      console.error('POST /api/ib/accounts/:id/reverify error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/accounts/:id/remove', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
      const account = await IbAccount.findByPk(id);
      if (!account) return res.status(404).json({ error: 'not_found' });

      const client = getDiscordClient();
      if (!client) return res.status(503).json({ error: 'bot_not_ready' });

      await ibService.manuallyRemoveAccount({
        account,
        discordClient: client,
        reason: typeof req.body?.reason === 'string' ? req.body.reason.trim() : null,
        adminLabel: `web:${req.adminUser.username}`
      });
      await account.reload();
      return res.json({ ok: true, account: serializeAccount(account) });
    } catch (error) {
      console.error('POST /api/ib/accounts/:id/remove error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/accounts/:id/run-volume', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
      const account = await IbAccount.findByPk(id);
      if (!account) return res.status(404).json({ error: 'not_found' });
      const config = await IbConfig.findOne({ where: { serverId: account.serverId } });
      if (!config) return res.status(404).json({ error: 'config_not_found' });

      const client = getDiscordClient();
      const result = await ibService.processVolumeForConfig({
        config,
        discordClient: client,
        date: new Date()
      });
      return res.json({ ok: true, result });
    } catch (error) {
      console.error('POST /api/ib/accounts/:id/run-volume error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/volume/run', async (req, res) => {
    try {
      const client = getDiscordClient();
      const result = await ibService.processVolumeAllConfigs({ discordClient: client });
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('POST /api/ib/volume/run error:', error);
      return res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  return router;
}

/* ────────────────────────────────────────────────────────────────────
 * Serializers (never leak the raw cookie)
 * ──────────────────────────────────────────────────────────────────── */

function serializeConfig(config) {
  const cookieMasked = (() => {
    if (!config.encryptedCookie) return null;
    try {
      const decrypted = decryptString(config.encryptedCookie);
      return decrypted ? maskSecret(decrypted, 6, 6) : null;
    } catch (_) {
      return '••• (gagal didekripsi)';
    }
  })();

  return {
    id: config.id,
    serverId: config.serverId,
    enabled: config.enabled,
    ibRoleId: config.ibRoleId,
    registrationChannelId: config.registrationChannelId,
    notificationChannelId: config.notificationChannelId,
    ibLink: config.ibLink,
    partnerId: config.partnerId,
    valetaxBaseUrl: config.valetaxBaseUrl,
    cookie: {
      configured: Boolean(config.encryptedCookie),
      preview: cookieMasked,
      updatedAt: config.cookieUpdatedAt,
      lastTestedAt: config.cookieLastTestedAt,
      lastTestStatus: config.cookieLastTestStatus,
      lastTestMessage: config.cookieLastTestMessage
    },
    retryIntervalMinutes: config.retryIntervalMinutes,
    maxRetries: config.maxRetries,
    minDepositUsd: Number(config.minDepositUsd) || 0,
    volumeCheckEnabled: config.volumeCheckEnabled,
    volumeGraceDays: config.volumeGraceDays,
    minDailyVolumeLots: Number(config.minDailyVolumeLots) || 0,
    embedTitle: config.embedTitle,
    embedDescription: config.embedDescription,
    embedButtonLabel: config.embedButtonLabel,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

function serializeAccount(a) {
  return {
    id: a.id,
    serverId: a.serverId,
    userId: a.userId,
    brokerAccountNumber: a.brokerAccountNumber,
    linkClickedAt: a.linkClickedAt,
    depositConfirmedAt: a.depositConfirmedAt,
    status: a.status,
    retryCount: a.retryCount,
    nextRetryAt: a.nextRetryAt,
    lastCheckedAt: a.lastCheckedAt,
    lastError: a.lastError,
    lastCheckResponse: a.lastCheckResponse,
    verifiedAt: a.verifiedAt,
    totalDepositUsd: a.totalDepositUsd != null ? Number(a.totalDepositUsd) : null,
    lastVolumeAt: a.lastVolumeAt,
    consecutiveZeroVolumeDays: a.consecutiveZeroVolumeDays,
    removedAt: a.removedAt,
    removedReason: a.removedReason,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

module.exports = buildRouter;
