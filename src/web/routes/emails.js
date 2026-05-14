const express = require('express');
const { EmailBinding } = require('../../database/models');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.use(requireAuth);

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
