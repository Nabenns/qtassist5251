const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { Transaction, Product, TemporaryRole } = require('../../database/models');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalTx,
      approvedCount,
      pendingCount,
      pendingReviewCount,
      rejectedCount,
      cancelledCount,
      expiredCount,
      activeProducts,
      activeRoles,
      revenueAllRow,
      revenue30dRow,
      recentTx
    ] = await Promise.all([
      Transaction.count(),
      Transaction.count({ where: { status: 'approved' } }),
      Transaction.count({ where: { status: 'pending' } }),
      Transaction.count({ where: { status: 'pending_review' } }),
      Transaction.count({ where: { status: 'rejected' } }),
      Transaction.count({ where: { status: 'cancelled' } }),
      Transaction.count({ where: { status: 'expired' } }),
      Product.count({ where: { isActive: true } }),
      TemporaryRole.count({ where: { expiresAt: { [Op.gt]: now } } }),
      Transaction.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: { status: 'approved' },
        raw: true
      }),
      Transaction.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
        where: {
          status: 'approved',
          paidAt: { [Op.gte]: startOf30d }
        },
        raw: true
      }),
      Transaction.findAll({
        order: [['createdAt', 'DESC']],
        limit: 8,
        include: [{ model: Product, as: 'product', attributes: ['name'] }]
      })
    ]);

    return res.json({
      totals: {
        transactions: totalTx,
        approved: approvedCount,
        pending: pendingCount,
        pending_review: pendingReviewCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
        expired: expiredCount,
        activeProducts,
        activeTempRoles: activeRoles
      },
      revenue: {
        allTime: Number(revenueAllRow?.total || 0),
        last30Days: Number(revenue30dRow?.total || 0)
      },
      recentTransactions: recentTx.map((tx) => ({
        id: tx.id,
        orderId: tx.orderId,
        userId: tx.userId,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
        productName: tx.product ? tx.product.name : null
      }))
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
