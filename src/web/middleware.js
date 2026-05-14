const { readAuthCookie, verifyToken } = require('./auth');

/**
 * Express middleware: require a valid admin session.
 * Attaches `req.adminUser = { id, username }` on success.
 * Returns 401 JSON on failure.
 */
function requireAuth(req, res, next) {
  const token = readAuthCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.adminId) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  req.adminUser = {
    id: payload.adminId,
    username: payload.username
  };

  next();
}

module.exports = { requireAuth };
