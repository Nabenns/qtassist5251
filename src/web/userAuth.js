const jwt = require('jsonwebtoken');

/**
 * Public IB user-facing auth (Discord OAuth2 session).
 *
 * This is intentionally separate from the admin auth (`./auth.js`) so an
 * end-user logging in via Discord at `/ib` never gets mistaken for an admin:
 *  - Different cookie name (`USER_SESSION_COOKIE_NAME`, defaults to
 *    `qtassist_user_session`).
 *  - Different JWT payload shape (`{ kind: 'ib_user', discordUserId, ... }`).
 *  - Different middleware (`requireUser` vs `requireAuth`).
 *
 * The signing secret is reused from `JWT_SECRET` because operators already
 * rotate that one secret for everything; if you ever want to scope keys
 * separately, add a `USER_JWT_SECRET` env var and read it here.
 */

const TOKEN_TTL = '7d'; // user session — longer than admin (24h) since it's lower privilege
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET environment variable must be set and at least 32 characters long.'
    );
  }
  return secret;
}

function getUserCookieName() {
  return process.env.USER_SESSION_COOKIE_NAME || 'qtassist_user_session';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function signUserToken(payload) {
  // `kind` lets requireUser reject any token that wasn't minted by this flow
  // (e.g. someone trying to reuse the admin cookie value here).
  return jwt.sign({ kind: 'ib_user', ...payload }, getJwtSecret(), {
    expiresIn: TOKEN_TTL
  });
}

function verifyUserToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload || payload.kind !== 'ib_user') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function setUserCookie(res, token) {
  res.cookie(getUserCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax', // 'lax' (not 'strict') so Discord's redirect back to us still carries the cookie
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/'
  });
}

function clearUserCookie(res) {
  res.clearCookie(getUserCookieName(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/'
  });
}

function readUserCookie(req) {
  return req.cookies && req.cookies[getUserCookieName()];
}

/**
 * Express middleware: require a valid IB user session.
 * Attaches `req.ibUser = { discordUserId, username, avatar }` on success.
 * Returns 401 JSON on failure.
 */
function requireUser(req, res, next) {
  const token = readUserCookie(req);
  if (!token) return res.status(401).json({ error: 'unauthenticated' });

  const payload = verifyUserToken(token);
  if (!payload || !payload.discordUserId) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  req.ibUser = {
    discordUserId: String(payload.discordUserId),
    username: payload.username || null,
    globalName: payload.globalName || null,
    avatar: payload.avatar || null
  };
  next();
}

module.exports = {
  signUserToken,
  verifyUserToken,
  setUserCookie,
  clearUserCookie,
  readUserCookie,
  requireUser
};
