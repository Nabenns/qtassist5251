const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const { IbConfig, IbAccount } = require('../../database/models');
const ibService = require('../../services/ibService');
const {
  signUserToken,
  setUserCookie,
  clearUserCookie,
  requireUser
} = require('../userAuth');

/**
 * Public IB registration routes.
 *
 * Mounted at /api/ib-public (NOT behind admin requireAuth). Used by the
 * public page at /ib in the SPA. Auth model is Discord OAuth2:
 *
 *   GET  /api/ib-public/auth/discord            → 302 to Discord
 *   GET  /api/ib-public/auth/callback           ← Discord redirects here
 *   POST /api/ib-public/auth/logout             clear user session cookie
 *   GET  /api/ib-public/me                      who am I + IB status
 *   POST /api/ib-public/register                submit broker account
 *   POST /api/ib-public/reverify                manual re-check current account
 *
 * Discord OAuth scopes requested: `identify` (just user ID + username + avatar).
 * No `email`, no `guilds.join`, nothing else — minimum viable for "prove
 * you own this Discord account".
 *
 * The CSRF protection on /auth/callback is the standard `state` param: we
 * store a random string in a short-lived cookie before redirecting to
 * Discord, then verify it on callback.
 */

const DISCORD_API = 'https://discord.com/api';
const STATE_COOKIE = 'qtassist_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 min — plenty for a sane user, short enough to not be a leak risk

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  // Light rate-limit for the public surface. Generous because Discord OAuth
  // sometimes triggers double calls in dev tools.
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' }
  });
  router.use(generalLimiter);

  /* ──────────────────────────────────────────────────────────────────
   * OAuth: kick-off
   * ────────────────────────────────────────────────────────────────── */
  router.get('/auth/discord', (req, res) => {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const redirectUri = getRedirectUri(req);
      if (!clientId) {
        return res.status(500).json({ error: 'discord_oauth_not_configured' });
      }

      const state = crypto.randomBytes(24).toString('hex');
      // Optional ?next=/some/path for post-login redirect inside the SPA.
      const nextRaw = String(req.query.next || '/ib');
      const next = isSafeNext(nextRaw) ? nextRaw : '/ib';
      const stateValue = `${state}.${Buffer.from(next, 'utf8').toString('base64url')}`;

      res.cookie(STATE_COOKIE, stateValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: STATE_TTL_MS,
        path: '/api/ib-public/auth'
      });

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify',
        state: stateValue,
        prompt: 'none' // skip the consent screen on subsequent logins
      });
      const url = `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
      return res.redirect(url);
    } catch (error) {
      console.error('OAuth /auth/discord error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * OAuth: callback
   * ────────────────────────────────────────────────────────────────── */
  router.get('/auth/callback', async (req, res) => {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const redirectUri = getRedirectUri(req);
      if (!clientId || !clientSecret) {
        return redirectToError(res, 'oauth_not_configured');
      }

      const code = String(req.query.code || '');
      const stateParam = String(req.query.state || '');
      const stateCookie = req.cookies?.[STATE_COOKIE];

      // Always clear the state cookie regardless of outcome.
      res.clearCookie(STATE_COOKIE, { path: '/api/ib-public/auth' });

      if (!code) return redirectToError(res, 'oauth_cancelled');
      if (!stateCookie || stateCookie !== stateParam) {
        return redirectToError(res, 'state_mismatch');
      }

      // Exchange code → access_token
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });
      if (!tokenRes.ok) {
        const text = await tokenRes.text().catch(() => '');
        console.error('Discord token exchange failed:', tokenRes.status, text.slice(0, 300));
        return redirectToError(res, 'token_exchange_failed');
      }
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) return redirectToError(res, 'no_access_token');

      // Fetch user identity
      const meRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!meRes.ok) {
        const text = await meRes.text().catch(() => '');
        console.error('Discord /users/@me failed:', meRes.status, text.slice(0, 300));
        return redirectToError(res, 'fetch_user_failed');
      }
      const me = await meRes.json();

      const token = signUserToken({
        discordUserId: String(me.id),
        username: me.username || null,
        globalName: me.global_name || null,
        avatar: me.avatar || null
      });
      setUserCookie(res, token);

      // Recover the post-login redirect target from the state value's tail.
      const next = decodeNextFromState(stateParam);
      return res.redirect(next);
    } catch (error) {
      console.error('OAuth /auth/callback error:', error);
      return redirectToError(res, 'internal_error');
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * Logout
   * ────────────────────────────────────────────────────────────────── */
  router.post('/auth/logout', (req, res) => {
    clearUserCookie(res);
    return res.json({ ok: true });
  });

  /* ──────────────────────────────────────────────────────────────────
   * Public config (used by /ib page even before login to decide whether
   * to show the registration form at all). Returns ONLY non-sensitive
   * fields — no cookie, no partner ID.
   * ────────────────────────────────────────────────────────────────── */
  router.get('/config', async (req, res) => {
    try {
      const serverId = String(req.query.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const config = await IbConfig.findOne({ where: { serverId } });
      if (!config) {
        return res.json({
          enabled: false,
          serverId,
          ibLink: null,
          minDepositUsd: 0,
          retryIntervalMinutes: 5,
          maxRetries: 3
        });
      }

      return res.json({
        enabled: Boolean(config.enabled),
        serverId,
        ibLink: config.ibLink || null,
        minDepositUsd: Number(config.minDepositUsd) || 0,
        retryIntervalMinutes: Number(config.retryIntervalMinutes) || 5,
        maxRetries: Number(config.maxRetries) || 3,
        embedTitle: config.embedTitle || null,
        embedDescription: config.embedDescription || null
      });
    } catch (error) {
      console.error('GET /api/ib-public/config error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * me — who am I + IB status (login required)
   * ────────────────────────────────────────────────────────────────── */
  router.get('/me', requireUser, async (req, res) => {
    try {
      const serverId = String(req.query.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const account = await IbAccount.findOne({
        where: { serverId, userId: req.ibUser.discordUserId },
        order: [['updatedAt', 'DESC']]
      });

      // Best-effort guild membership probe so the page can prompt the user
      // to join the server if they aren't a member yet (we can't grant the
      // role to a non-member).
      const memberStatus = await checkMemberStatus({
        getDiscordClient,
        serverId,
        userId: req.ibUser.discordUserId
      });

      return res.json({
        user: req.ibUser,
        membership: memberStatus,
        account: account ? serializePublicAccount(account) : null
      });
    } catch (error) {
      console.error('GET /api/ib-public/me error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * register — submit broker account (login required)
   * ────────────────────────────────────────────────────────────────── */
  const registerLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' }
  });

  router.post('/register', requireUser, registerLimiter, async (req, res) => {
    try {
      const serverId = String(req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const config = await IbConfig.findOne({ where: { serverId } });
      if (!config || !config.enabled) {
        return res.status(403).json({ error: 'ib_disabled' });
      }

      const rawAccount = String(req.body?.brokerAccountNumber || '').trim();
      const brokerAccountNumber = rawAccount.replace(/\s+/g, '');
      if (!brokerAccountNumber) {
        return res.status(400).json({ error: 'missing_account_number' });
      }
      if (!/^[0-9A-Za-z\-]+$/.test(brokerAccountNumber)) {
        return res.status(400).json({ error: 'invalid_account_format' });
      }
      if (brokerAccountNumber.length < 3 || brokerAccountNumber.length > 32) {
        return res.status(400).json({ error: 'invalid_account_length' });
      }

      // Enforce "one account per user". If the user already has an account
      // row in this server with a different account number, refuse — they
      // need to ask an admin to remove the old one first. If it's the same
      // number, fall through to the normal idempotent submit/reset path.
      const existing = await IbAccount.findOne({
        where: {
          serverId,
          userId: req.ibUser.discordUserId,
          brokerAccountNumber: { [Op.ne]: brokerAccountNumber }
        }
      });
      if (existing && existing.status !== 'removed') {
        return res.status(409).json({
          error: 'different_account_already_registered',
          existingBrokerAccountNumber: existing.brokerAccountNumber,
          existingStatus: existing.status
        });
      }

      // Verify guild membership before we even bother calling Valetax.
      // Without membership the role grant in runVerification() is a no-op
      // and the user gets a confusing experience.
      const memberStatus = await checkMemberStatus({
        getDiscordClient,
        serverId,
        userId: req.ibUser.discordUserId
      });
      if (memberStatus.checked && !memberStatus.isMember) {
        return res.status(403).json({
          error: 'not_in_server',
          inviteUrl: process.env.DISCORD_INVITE_URL || null
        });
      }

      const submission = await ibService.submitAccount({
        serverId,
        userId: req.ibUser.discordUserId,
        brokerAccountNumber
      });

      if (submission.alreadyVerified) {
        return res.json({
          status: 'verified',
          message: `Akun ${brokerAccountNumber} sudah pernah diverifikasi sebelumnya. Role IB seharusnya sudah kamu miliki.`,
          account: serializePublicAccount(submission.account)
        });
      }

      const discordClient = getDiscordClient ? getDiscordClient() : null;

      const result = await ibService.runVerification({
        account: submission.account,
        config,
        discordClient,
        source: 'web'
      });

      // Reload to capture all the new fields (status, retryCount, etc.)
      await submission.account.reload();

      return res.json({
        status: result.status,
        message: result.message,
        account: serializePublicAccount(submission.account),
        nextRetryHint: {
          intervalMinutes: Number(config.retryIntervalMinutes) || 5,
          maxRetries: Number(config.maxRetries) || 3
        }
      });
    } catch (error) {
      console.error('POST /api/ib-public/register error:', error);
      return res.status(500).json({
        error: 'internal_error',
        message: error.message || 'unknown'
      });
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * reverify — re-run an immediate check on the user's existing account
   * (e.g. user has now deposited the required amount)
   * ────────────────────────────────────────────────────────────────── */
  const reverifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' }
  });

  router.post('/reverify', requireUser, reverifyLimiter, async (req, res) => {
    try {
      const serverId = String(req.body?.serverId || process.env.DISCORD_GUILD_ID || '');
      if (!serverId) return res.status(400).json({ error: 'missing_server_id' });

      const account = await IbAccount.findOne({
        where: { serverId, userId: req.ibUser.discordUserId }
      });
      if (!account) return res.status(404).json({ error: 'no_account' });
      if (account.status === 'verified') {
        return res.json({
          status: 'verified',
          message: 'Akun sudah terverifikasi.',
          account: serializePublicAccount(account)
        });
      }

      const discordClient = getDiscordClient ? getDiscordClient() : null;
      const result = await ibService.reVerifyAccount({ account, discordClient });
      await account.reload();
      return res.json({
        status: result.status,
        message: result.message,
        account: serializePublicAccount(account)
      });
    } catch (error) {
      console.error('POST /api/ib-public/reverify error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

/* ──────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

function getRedirectUri(req) {
  if (process.env.DISCORD_OAUTH_REDIRECT_URI) {
    return process.env.DISCORD_OAUTH_REDIRECT_URI;
  }
  // Fallback for local dev: derive from request.
  const proto = req.protocol;
  const host = req.get('host');
  return `${proto}://${host}/api/ib-public/auth/callback`;
}

function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}

function redirectToError(res, code) {
  const base = getPublicSiteUrl();
  const url = `${base}/ib?oauth_error=${encodeURIComponent(code)}`;
  return res.redirect(url || '/ib?oauth_error=' + encodeURIComponent(code));
}

function isSafeNext(next) {
  // Only allow same-site relative paths to prevent open redirect.
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//');
}

function decodeNextFromState(stateValue) {
  const dot = stateValue.indexOf('.');
  if (dot < 0) return '/ib';
  try {
    const tail = stateValue.slice(dot + 1);
    const decoded = Buffer.from(tail, 'base64url').toString('utf8');
    return isSafeNext(decoded) ? decoded : '/ib';
  } catch (_) {
    return '/ib';
  }
}

async function checkMemberStatus({ getDiscordClient, serverId, userId }) {
  try {
    const client = getDiscordClient ? getDiscordClient() : null;
    if (!client) {
      return { checked: false, isMember: null, reason: 'bot_not_ready' };
    }
    const guild = await client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
      return { checked: false, isMember: null, reason: 'guild_unreachable' };
    }
    const member = await guild.members.fetch(userId).catch(() => null);
    return {
      checked: true,
      isMember: Boolean(member),
      guildName: guild.name || null
    };
  } catch (_) {
    return { checked: false, isMember: null, reason: 'lookup_failed' };
  }
}

function serializePublicAccount(a) {
  if (!a) return null;
  return {
    brokerAccountNumber: a.brokerAccountNumber,
    status: a.status,
    retryCount: a.retryCount,
    nextRetryAt: a.nextRetryAt,
    lastCheckedAt: a.lastCheckedAt,
    lastError: a.lastError,
    verifiedAt: a.verifiedAt,
    totalDepositUsd: a.totalDepositUsd != null ? Number(a.totalDepositUsd) : null,
    lastVolumeAt: a.lastVolumeAt,
    consecutiveZeroVolumeDays: a.consecutiveZeroVolumeDays,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

module.exports = buildRouter;
