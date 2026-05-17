const express = require('express');
const { EmailBinding } = require('../../database/models');
const { requireAuth, requireAdmin } = require('../middleware');
const { checkEmailEligibility } = require('../../services/emailEligibility');

const router = express.Router();

/* ────────────────────────────────────────────────────────────────────
 * User-facing self-service routes (any logged-in dashboard user).
 *
 * Mirror Discord `/my-email` slash command via the dashboard, plus a
 * write endpoint so non-admin users can register / update their own
 * email without going through the Discord button flow.
 *
 *   GET  /api/emails/me   Current user's email binding (or null)
 *   PUT  /api/emails/me   Upsert {email}; replaces any existing entry
 *   DELETE /api/emails/me Remove the binding
 *
 * Each binding is keyed by (serverId, userId). Discord ID identity is
 * resolved from the session — the user cannot bind for someone else.
 * Email uniqueness within a server is enforced by the model index.
 * ──────────────────────────────────────────────────────────────────── */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServerId() {
  return String(process.env.DISCORD_GUILD_ID || '');
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const serverId = getServerId();
    if (!serverId) return res.status(500).json({ error: 'server_not_configured' });

    const eligibility = await checkEmailEligibility({
      serverId,
      userId: req.session.discordId,
      isAdmin: req.session.isAdmin
    });

    const binding = await EmailBinding.findOne({
      where: { serverId, userId: req.session.discordId }
    });

    return res.json({
      eligibility: {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        requiredRoleIds: eligibility.requiredRoleIds || []
      },
      binding: binding
        ? {
            email: binding.email,
            registeredAt: binding.registeredAt,
            updatedAt: binding.updatedAt
          }
        : null
    });
  } catch (error) {
    console.error('GET /api/emails/me error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const serverId = getServerId();
    if (!serverId) return res.status(500).json({ error: 'server_not_configured' });

    const eligibility = await checkEmailEligibility({
      serverId,
      userId: req.session.discordId,
      isAdmin: req.session.isAdmin
    });
    if (!eligibility.eligible) {
      const status = eligibility.reason === 'feature_disabled' ? 403 : 403;
      return res.status(status).json({
        error: eligibility.reason || 'forbidden',
        message:
          eligibility.reason === 'feature_disabled'
            ? 'Fitur email belum dibuka oleh admin.'
            : 'Kamu belum punya role yang dibutuhkan untuk daftar email.'
      });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({
        error: 'missing_email',
        message: 'Email wajib diisi.'
      });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        error: 'invalid_email',
        message: 'Format email tidak valid.'
      });
    }
    if (email.length > 255) {
      return res.status(400).json({
        error: 'email_too_long',
        message: 'Email terlalu panjang (maksimum 255 karakter).'
      });
    }

    // Reject if email already bound to someone else in this server.
    const conflict = await EmailBinding.findOne({
      where: { serverId, email }
    });
    if (conflict && conflict.userId !== req.session.discordId) {
      return res.status(409).json({
        error: 'email_taken',
        message: 'Email ini sudah didaftarkan user lain.'
      });
    }

    const [binding] = await EmailBinding.findOrCreate({
      where: { serverId, userId: req.session.discordId },
      defaults: { serverId, userId: req.session.discordId, email }
    });

    if (binding.email !== email) {
      binding.email = email;
      binding.updatedAt = new Date();
      await binding.save();
    }

    return res.json({
      ok: true,
      binding: {
        email: binding.email,
        registeredAt: binding.registeredAt,
        updatedAt: binding.updatedAt
      }
    });
  } catch (error) {
    console.error('PUT /api/emails/me error:', error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'email_taken',
        message: 'Email ini sudah didaftarkan user lain.'
      });
    }
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

router.delete('/me', requireAuth, async (req, res) => {
  try {
    const serverId = getServerId();
    if (!serverId) return res.status(500).json({ error: 'server_not_configured' });

    const eligibility = await checkEmailEligibility({
      serverId,
      userId: req.session.discordId,
      isAdmin: req.session.isAdmin
    });
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: eligibility.reason || 'forbidden',
        message:
          eligibility.reason === 'feature_disabled'
            ? 'Fitur email belum dibuka oleh admin.'
            : 'Kamu belum punya role yang dibutuhkan untuk hapus email.'
      });
    }

    const removed = await EmailBinding.destroy({
      where: { serverId, userId: req.session.discordId }
    });
    return res.json({ ok: true, removed });
  } catch (error) {
    console.error('DELETE /api/emails/me error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * Admin-only routes (existing).
 * ──────────────────────────────────────────────────────────────────── */

router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { limit: limitRaw = '100', offset: offsetRaw = '0' } = req.query;
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

    const { rows, count } = await EmailBinding.findAndCountAll({
      order: [['registeredAt', 'DESC']],
      limit,
      offset
    });

    return res.json({
      total: count,
      items: rows.map((b) => ({
        id: b.id,
        serverId: b.serverId,
        userId: b.userId,
        email: b.email,
        registeredAt: b.registeredAt,
        updatedAt: b.updatedAt
      })),
      limit,
      offset
    });
  } catch (error) {
    console.error('GET /api/emails error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
