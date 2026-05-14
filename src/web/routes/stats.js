const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Transaction, Product, TemporaryRole } = require('../../database/models');
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

/**
 * GET /api/stats/timeseries?days=30
 * Daily revenue (sum of approved.amount), daily transaction counts grouped
 * by status, and a top-products breakdown over the requested window.
 */
router.get('/timeseries', async (req, res) => {
  try {
    const daysRaw = parseInt(req.query.days, 10);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 30, 1), 365);

    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Postgres-specific: bucket by day in Asia/Jakarta. The dialect of this
    // bot is always 'postgres' (see package.json dependencies), so it is
    // safe to use date_trunc here.
    //
    // Sequelize automatically quotes camelCase column names because the
    // Transaction model uses `timestamps: true` without `underscored: true`,
    // so the actual columns are "createdAt" and "updatedAt". `paidAt` has
    // an explicit `field: 'paid_at'` mapping so it lives in `paid_at`.
    const dayBucket = literal(`date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Jakarta')`);
    const dayBucketPaid = literal(`date_trunc('day', paid_at AT TIME ZONE 'Asia/Jakarta')`);

    // Daily revenue from approved transactions, bucketed by paidAt
    const revenueRows = await Transaction.findAll({
      attributes: [
        [dayBucketPaid, 'day'],
        [fn('SUM', col('amount')), 'revenue'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: {
        status: 'approved',
        paidAt: { [Op.gte]: start }
      },
      group: ['day'],
      order: [[literal('day'), 'ASC']],
      raw: true
    });

    // Daily counts of all transactions (regardless of status) bucketed by createdAt
    const activityRows = await Transaction.findAll({
      attributes: [
        [dayBucket, 'day'],
        'status',
        [fn('COUNT', col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: start }
      },
      group: ['day', 'status'],
      order: [[literal('day'), 'ASC']],
      raw: true
    });

    // Build a contiguous date series so the chart has zero-filled days.
    const series = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      series.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    function isoDay(d) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const revenueByDay = new Map(
      revenueRows.map((r) => [
        new Date(r.day).toISOString().slice(0, 10),
        { revenue: Number(r.revenue || 0), count: Number(r.count || 0) }
      ])
    );

    const statusByDay = new Map();
    for (const row of activityRows) {
      const key = new Date(row.day).toISOString().slice(0, 10);
      const map = statusByDay.get(key) || {};
      map[row.status] = Number(row.count || 0);
      statusByDay.set(key, map);
    }

    const dailyRevenue = series.map((d) => {
      const key = d.toISOString().slice(0, 10);
      const entry = revenueByDay.get(key) || { revenue: 0, count: 0 };
      return {
        date: isoDay(d),
        revenue: entry.revenue,
        approved: entry.count
      };
    });

    const dailyActivity = series.map((d) => {
      const key = d.toISOString().slice(0, 10);
      const entry = statusByDay.get(key) || {};
      return {
        date: isoDay(d),
        pending: entry.pending || 0,
        pending_review: entry.pending_review || 0,
        approved: entry.approved || 0,
        rejected: entry.rejected || 0,
        cancelled: entry.cancelled || 0,
        expired: entry.expired || 0
      };
    });

    // Top products by revenue in the same window
    const topProductsRows = await Transaction.findAll({
      attributes: [
        'productId',
        [fn('SUM', col('amount')), 'revenue'],
        [fn('COUNT', col('Transaction.id')), 'count']
      ],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name']
        }
      ],
      where: {
        status: 'approved',
        paidAt: { [Op.gte]: start }
      },
      group: ['productId', 'product.id'],
      order: [[literal('revenue'), 'DESC']],
      limit: 10
    });

    return res.json({
      windowDays: days,
      from: start.toISOString(),
      to: now.toISOString(),
      dailyRevenue,
      dailyActivity,
      topProducts: topProductsRows.map((r) => ({
        productId: r.productId,
        productName: r.product ? r.product.name : '(deleted)',
        revenue: Number(r.get('revenue') || 0),
        count: Number(r.get('count') || 0)
      }))
    });
  } catch (error) {
    console.error('GET /api/stats/timeseries error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
