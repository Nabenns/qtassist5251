const jwt = require('jsonwebtoken');

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ROLE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET environment variable must be set and at least 32 characters long.'
    );
  }
  return secret;
}

function getCookieName() {
  return process.env.SESSION_COOKIE_NAME || 'qtassist_session';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Sign a session token for a logged-in dashboard user.
 *
 * The payload carries identifying info plus a snapshot of the admin
 * flag at sign time. Middleware checks `roleSyncedAt` to decide whether
 * to refresh from Discord on each request.
 */
function signSessionToken({ dashboardUserId, discordId, username, isAdmin }) {
  const payload = {
    dashboardUserId,
    discordId,
    username,
    isAdmin: Boolean(isAdmin),
    roleSyncedAt: Date.now()
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (_) {
    return null;
  }
}

function setAuthCookie(res, token) {
  res.cookie(getCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(getCookieName(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax'
  });
}

function readAuthCookie(req) {
  return req.cookies && req.cookies[getCookieName()];
}

/**
 * Generate / read a CSRF-style state cookie for the OAuth2 round-trip.
 * Discord echoes our `state` parameter back; we compare it to the cookie
 * value to make sure the callback originated from a flow we initiated.
 */
const OAUTH_STATE_COOKIE = 'qtassist_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function setOAuthStateCookie(res, state, returnTo) {
  const value = JSON.stringify({ state, returnTo: returnTo || '/' });
  res.cookie(OAUTH_STATE_COOKIE, value, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_MS
  });
}

function readOAuthStateCookie(req) {
  const raw = req.cookies && req.cookies[OAUTH_STATE_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function clearOAuthStateCookie(res) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax'
  });
}

module.exports = {
  signSessionToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  readAuthCookie,
  setOAuthStateCookie,
  readOAuthStateCookie,
  clearOAuthStateCookie,
  ROLE_REFRESH_INTERVAL_MS,
  TOKEN_TTL_SECONDS
};
