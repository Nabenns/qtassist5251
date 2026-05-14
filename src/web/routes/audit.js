const express = require('express');
const { Op } = require('sequelize');
const { ModerationLog } = require('../../database/models');
const { requireAuth } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const {
      actionType,
      moderatorId,
      targetUserId,
      from,
      to,
      search,
      limit: limitRaw = '50',
      offset: offsetRaw = '0'
    } = req.query;

    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

    const where = {};
    if (actionType && actionType !== 'all') {
      where.actionType = actionType;
    }
    if (moderatorId) {
      where.moderatorId = String(moderatorId).trim();
    }
    if (targetUserId) {
      where.targetUserId = String(targetUserId).trim();
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { reason: { [Op.iLike]: term } },
        { moderatorId: { [Op.iLike]: term } },
        { targetUserId: { [Op.iLike]: term } },
        { roleId: { [Op.iLike]: term } }
      ];
    }

    const { rows, count } = await ModerationLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return res.json({
      total: count,
      items: rows.map((r) => ({
        id: r.id,
        actionType: r.actionType,
        moderatorId: r.moderatorId,
        targetUserId: r.targetUserId,
        roleId: r.roleId,
        templateId: r.templateId,
        reason: r.reason,
        expiryTime: r.expiryTime,
        additionalData: r.additionalData,
        createdAt: r.createdAt
      })),
      limit,
      offset
    });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/action-types', async (req, res) => {
  try {
    const rows = await ModerationLog.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('action_type')), 'actionType']],
      raw: true
    });
    return res.json({ items: rows.map((r) => r.actionType).filter(Boolean).sort() });
  } catch (error) {
    console.error('GET /api/audit/action-types error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
