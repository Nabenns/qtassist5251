const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { DashboardUser } = require('../../database/models');
const {
  signSessionToken,
  setAuthCookie,
  clearAuthCookie,
  setOAuthStateCookie,
  readOAuthStateCookie,
  clearOAuthStateCookie
} = require('../auth');
const { requireAuth } = require('../middleware');
const discordOAuth = require('../discordOAuth');
const {
  syncDashboardUser,
  getPrimaryGuildId
} = require('../../services/discordRoleSync');

const router = express.Router();

const callbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' }
});

/**
 * Sanitize a redirect path so we never bounce the user to an external URL.
 */
function safeReturnTo(path) {
  if (typeof path !== 'string') return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  if (path.startsWith('/api/')) return '/';
  return path;
}

/**
 * GET /api/auth/discord/login
 *
 * Optional `returnTo` query param specifies the SPA path the user came
 * from; we round-trip it through the state cookie so the callback can
 * land them back where they were.
 */
router.get('/discord/login', (req, res) => {
  if (!discordOAuth.isConfigured()) {
    return res.status(500).json({
      error: 'oauth_not_configured',
      message:
        'Discord OAuth belum diset. Pastikan DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, dan DASHBOARD_BASE_URL ada di .env.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const returnTo = safeReturnTo(String(req.query.returnTo || '/'));
  setOAuthStateCookie(res, state, returnTo);

  const url = discordOAuth.buildAuthorizeUrl(state);
  return res.redirect(url);
});

/**
 * GET /api/auth/discord/callback
 *
 * Discord redirects here with `?code=...&state=...`. We:
 *   1. Validate the state cookie matches.
 *   2. Exchange the code for an access token.
 *   3. Fetch /users/@me.
 *   4. Upsert a DashboardUser row.
 *   5. Sync admin status from the live guild.
 *   6. Issue our own session cookie and redirect into the SPA.
 *
 * Error handling: on any failure we redirect to /login?error=... rather
 * than dumping JSON, since this is a browser-driven flow.
 */
router.get('/discord/callback', callbackLimiter, async (req, res) => {
  const finishWithError = (code) => {
    clearOAuthStateCookie(res);
    return res.redirect(`/login?error=${encodeURIComponent(code)}`);
  };

  try {
    if (!discordOAuth.isConfigured()) return finishWithError('oauth_not_configured');

    const { code, state } = req.query || {};
    if (!code || !state) return finishWithError('missing_code');

    const stateCookie = readOAuthStateCookie(req);
    if (!stateCookie || stateCookie.state !== state) {
      return finishWithError('state_mismatch');
    }

    let token;
    try {
      token = await discordOAuth.exchangeCode(code);
    } catch (err) {
      console.error('Discord token exchange failed:', err);
      return finishWithError('token_exchange_failed');
    }

    let profile;
    try {
      profile = await discordOAuth.fetchCurrentUser(token.access_token);
    } catch (err) {
      console.error('Discord /users/@me failed:', err);
      return finishWithError('profile_fetch_failed');
    }

    const guildId = getPrimaryGuildId();
    if (!guildId) return finishWithError('guild_not_configured');

    // Upsert the dashboard user record by Discord ID.
    const [user] = await DashboardUser.findOrCreate({
      where: { discordId: profile.id },
      defaults: {
        discordId: profile.id,
        username: profile.username,
        globalName: profile.global_name || null,
        discriminator:
          profile.discriminator && profile.discriminator !== '0'
            ? profile.discriminator
            : null,
        avatar: profile.avatar || null,
        email: profile.email || null,
        isAdmin: false
      }
    });

    // Always update the cached profile fields — Discord usernames change.
    user.username = profile.username;
    user.globalName = profile.global_name || null;
    user.discriminator =
      profile.discriminator && profile.discriminator !== '0' ? profile.discriminator : null;
    user.avatar = profile.avatar || null;
    user.email = profile.email || user.email;
    user.lastLoginAt = new Date();

    // Sync admin flag from the live guild before persisting so the
    // session token carries the freshest snapshot.
    let syncResult;
    try {
      syncResult = await syncDashboardUser(user, { persist: false });
    } catch (err) {
      console.error('Role sync failed during login:', err);
      syncResult = { ok: false };
    }

    if (!syncResult.ok && user.cachedRoleIds == null) {
      // First-time login and bot couldn't reach guild → block. Otherwise
      // we'd issue a session that genuinely doesn't know whether the user
      // is admin or not.
      console.warn(`Login blocked: bot couldn't verify guild membership for ${profile.id}`);
      return finishWithError('bot_not_ready');
    }

    await user.save();

    const sessionToken = signSessionToken({
      dashboardUserId: user.id,
      discordId: user.discordId,
      username: user.username,
      isAdmin: user.isAdmin
    });
    setAuthCookie(res, sessionToken);
    clearOAuthStateCookie(res);

    // Admins land where they came from; non-admins always land on /daftar-ib.
    const target = user.isAdmin
      ? safeReturnTo(stateCookie.returnTo || '/')
      : '/daftar-ib';
    return res.redirect(target);
  } catch (error) {
    console.error('Discord OAuth callback error:', error);
    return finishWithError('internal_error');
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  return res.json({
    user: {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
      isAdmin: Boolean(user.isAdmin),
      rolesSyncedAt: user.rolesSyncedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    }
  });
});

module.exports = router;
