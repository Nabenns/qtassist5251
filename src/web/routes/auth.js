const express = require('express');
const rateLimit = require('express-rate-limit');
const { AdminUser } = require('../../database/models');
const {
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie
} = require('../auth');
const { requireAuth } = require('../middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_login_attempts' }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'invalid_request' });
    }

    if (!username.trim() || !password) {
      return res.status(400).json({ error: 'missing_credentials' });
    }

    const admin = await AdminUser.findOne({ where: { username: username.trim() } });

    // Always run the bcrypt compare even when the user is missing to avoid
    // user-enumeration via timing differences.
    const dummyHash = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.5vdCoYg1eC3dq5v3jr3wQ.eU5dm.';
    const ok = admin
      ? await verifyPassword(password, admin.passwordHash)
      : (await verifyPassword(password, dummyHash), false);

    if (!admin || !ok) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = signToken({
      adminId: admin.id,
      username: admin.username
    });

    setAuthCookie(res, token);

    return res.json({
      ok: true,
      admin: {
        id: admin.id,
        username: admin.username,
        lastLoginAt: admin.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const admin = await AdminUser.findByPk(req.adminUser.id, {
      attributes: ['id', 'username', 'lastLoginAt', 'createdAt']
    });

    if (!admin) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    return res.json({
      admin: {
        id: admin.id,
        username: admin.username,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('GET /me error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
