const {
  readAuthCookie,
  verifyToken,
  signSessionToken,
  setAuthCookie,
  ROLE_REFRESH_INTERVAL_MS
} = require('./auth');
const { DashboardUser } = require('../database/models');
const { syncDashboardUser } = require('../services/discordRoleSync');

/**
 * Resolve the current session: validate the JWT, load the DashboardUser,
 * and refresh the admin flag from Discord if the cached snapshot is older
 * than ROLE_REFRESH_INTERVAL_MS.
 *
 * On success, attaches:
 *   req.user      = DashboardUser sequelize instance
 *   req.session   = { dashboardUserId, discordId, username, isAdmin, roleSyncedAt }
 *
 * On failure, returns a 401 with a stable JSON shape and stops the chain.
 */
async function loadSession(req, res) {
  const token = readAuthCookie(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const payload = verifyToken(token);
  if (!payload || !payload.dashboardUserId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const user = await DashboardUser.findByPk(payload.dashboardUserId);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const lastSync = payload.roleSyncedAt || 0;
  const stale = Date.now() - lastSync > ROLE_REFRESH_INTERVAL_MS;

  if (stale) {
    // Best-effort refresh. If the bot is down or Discord is unreachable
    // we keep the cached `isAdmin` snapshot so the dashboard stays usable.
    try {
      await syncDashboardUser(user);
    } catch (err) {
      console.warn('Role refresh failed (using cached value):', err?.message || err);
    }

    // Re-issue cookie with fresh roleSyncedAt + updated isAdmin so the
    // next request doesn't hit the same refresh path.
    const refreshed = signSessionToken({
      dashboardUserId: user.id,
      discordId: user.discordId,
      username: user.username,
      isAdmin: user.isAdmin
    });
    setAuthCookie(res, refreshed);
  }

  req.user = user;
  req.session = {
    dashboardUserId: user.id,
    discordId: user.discordId,
    username: user.username,
    isAdmin: Boolean(user.isAdmin),
    roleSyncedAt: stale ? Date.now() : lastSync
  };
  // Backward-compat shim: many existing routes were written against the
  // old AdminUser-based middleware that exposed `req.adminUser = { id, username }`.
  // Keep that shape working so we don't have to touch every audit log call.
  req.adminUser = {
    id: user.id,
    username: user.username,
    discordId: user.discordId
  };
  return req.session;
}

/**
 * Express middleware: any logged-in dashboard user (admin or not).
 * Suitable for /api/auth/me, /api/ib/my-account, etc.
 */
async function requireAuth(req, res, next) {
  try {
    const session = await loadSession(req, res);
    if (!session) return; // loadSession already responded
    next();
  } catch (error) {
    console.error('requireAuth error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_error' });
    }
  }
}

/**
 * Express middleware: admin-only.
 *
 * Loads the session, refreshes if stale, and rejects with 403 if the
 * resulting user is not flagged as admin.
 */
async function requireAdmin(req, res, next) {
  try {
    const session = await loadSession(req, res);
    if (!session) return;
    if (!session.isAdmin) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_error' });
    }
  }
}

module.exports = { requireAuth, requireAdmin };
