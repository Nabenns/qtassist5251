const express = require('express');
const { Op } = require('sequelize');
const { Transaction, Product } = require('../../database/models');
const { requireAdmin } = require('../middleware');
const {
  approveTransaction,
  rejectTransaction
} = require('../../services/transactionService');

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    try {
      const {
        status,
        search,
        limit: limitRaw = '50',
        offset: offsetRaw = '0'
      } = req.query;

      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

      const where = {};
      if (status && status !== 'all') {
        where.status = status;
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        where[Op.or] = [
          { orderId: { [Op.iLike]: term } },
          { userId: { [Op.iLike]: term } }
        ];
      }

      const { rows, count } = await Transaction.findAndCountAll({
        where,
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return res.json({
        total: count,
        items: rows.map((tx) => ({
          id: tx.id,
          orderId: tx.orderId,
          userId: tx.userId,
          serverId: tx.serverId,
          productId: tx.productId,
          productName: tx.product ? tx.product.name : null,
          amount: tx.amount,
          status: tx.status,
          paymentProofUrl: tx.paymentProofUrl,
          reviewedBy: tx.reviewedBy,
          reviewedAt: tx.reviewedAt,
          rejectionReason: tx.rejectionReason,
          paidAt: tx.paidAt,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt
        })),
        limit,
        offset
      });
    } catch (error) {
      console.error('GET /api/transactions error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const tx = await Transaction.findOne({
        where: { orderId },
        include: [{ model: Product, as: 'product' }]
      });
      if (!tx) {
        return res.status(404).json({ error: 'not_found' });
      }
      return res.json({
        id: tx.id,
        orderId: tx.orderId,
        userId: tx.userId,
        serverId: tx.serverId,
        productId: tx.productId,
        product: tx.product
          ? {
              id: tx.product.id,
              name: tx.product.name,
              roleId: tx.product.roleId,
              duration: String(tx.product.duration)
            }
          : null,
        amount: tx.amount,
        status: tx.status,
        paymentProofUrl: tx.paymentProofUrl,
        reviewedBy: tx.reviewedBy,
        reviewedAt: tx.reviewedAt,
        rejectionReason: tx.rejectionReason,
        paidAt: tx.paidAt,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt
      });
    } catch (error) {
      console.error('GET /api/transactions/:orderId error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/:orderId/approve', async (req, res) => {
    try {
      const client = getDiscordClient();
      if (!client) {
        return res.status(503).json({ error: 'bot_not_ready' });
      }

      const result = await approveTransaction({
        client,
        orderId: req.params.orderId,
        reviewerId: client.user ? client.user.id : 'web-admin',
        reviewerLabel: `web:${req.adminUser.username}`
      });

      if (!result.ok) {
        const code = result.code || 'error';
        const status = code === 'not_found' ? 404 : 400;
        return res.status(status).json({ error: code, message: result.message });
      }

      return res.json({
        ok: true,
        orderId: result.transaction.orderId,
        status: result.transaction.status,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      console.error('POST /api/transactions/:orderId/approve error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/:orderId/reject', async (req, res) => {
    try {
      const { reason } = req.body || {};
      const client = getDiscordClient();
      if (!client) {
        return res.status(503).json({ error: 'bot_not_ready' });
      }

      const result = await rejectTransaction({
        client,
        orderId: req.params.orderId,
        reviewerId: client.user ? client.user.id : 'web-admin',
        reviewerLabel: `web:${req.adminUser.username}`,
        reason
      });

      if (!result.ok) {
        const code = result.code || 'error';
        const status = code === 'not_found' ? 404 : 400;
        return res.status(status).json({ error: code, message: result.message });
      }

      return res.json({
        ok: true,
        orderId: result.transaction.orderId,
        status: result.transaction.status,
        rejectionReason: result.transaction.rejectionReason
      });
    } catch (error) {
      console.error('POST /api/transactions/:orderId/reject error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
