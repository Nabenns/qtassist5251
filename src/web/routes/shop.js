/**
 * User-facing shop endpoints. All require an authenticated session
 * (any user, admin or not).
 *
 * In-memory product cache (5 min) to reduce DB load on /shop browsing.
 * Cache invalidates per-server.
 */

const express = require('express');
const { Op } = require('sequelize');
const { Product, Transaction } = require('../../database/models');
const { requireAuth } = require('../middleware');

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const productCache = new Map(); // serverId -> { items, expiresAt }

function getCachedProducts(serverId) {
  const entry = productCache.get(serverId);
  if (entry && entry.expiresAt > Date.now()) return entry.items;
  return null;
}

function setCachedProducts(serverId, items) {
  productCache.set(serverId, {
    items,
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS
  });
}

function clearProductCache(serverId) {
  if (serverId) productCache.delete(serverId);
  else productCache.clear();
}

function serializeProduct(p) {
  return {
    id: p.id,
    serverId: p.serverId,
    roleId: p.roleId,
    name: p.name,
    description: p.description,
    price: p.price,
    duration: String(p.duration),
    paymentMethods: Array.isArray(p.paymentMethods) ? p.paymentMethods : ['qris'],
    isActive: p.isActive
  };
}

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAuth);

  // GET /api/shop/products — list active products for the configured guild.
  router.get('/products', async (req, res) => {
    try {
      const serverId = process.env.DISCORD_GUILD_ID;
      if (!serverId) return res.status(500).json({ error: 'guild_not_configured' });

      const cached = getCachedProducts(serverId);
      if (cached) {
        return res.json({ items: cached, cached: true });
      }

      const products = await Product.findAll({
        where: { serverId, isActive: true },
        order: [['createdAt', 'DESC']]
      });
      const items = products.map(serializeProduct);
      setCachedProducts(serverId, items);
      return res.json({ items, cached: false });
    } catch (error) {
      console.error('GET /api/shop/products error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // GET /api/shop/products/:id — single product detail.
  router.get('/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });

      const product = await Product.findByPk(id);
      if (!product || !product.isActive) {
        return res.status(404).json({ error: 'product_not_found' });
      }
      return res.json({ product: serializeProduct(product) });
    } catch (error) {
      console.error('GET /api/shop/products/:id error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  // GET /api/shop/pending — latest non-expired pending transaction for user.
  // Used by /shop page to show resume banner.
  router.get('/pending', async (req, res) => {
    try {
      const userId = req.session.discordId;
      const trx = await Transaction.findOne({
        where: {
          userId,
          status: 'pending',
          paymentChannel: 'louvin',
          louvinExpiredAt: { [Op.gt]: new Date() }
        },
        include: [{ model: Product, as: 'product' }],
        order: [['createdAt', 'DESC']]
      });
      if (!trx) return res.json({ pending: null });

      return res.json({
        pending: {
          orderId: trx.orderId,
          productId: trx.productId,
          productName: trx.product?.name,
          amount: trx.amount,
          louvinFee: trx.louvinFee,
          louvinTotalPayment: trx.louvinTotalPayment,
          louvinPaymentType: trx.louvinPaymentType,
          louvinExpiredAt: trx.louvinExpiredAt,
          createdAt: trx.createdAt
        }
      });
    } catch (error) {
      console.error('GET /api/shop/pending error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
module.exports.clearProductCache = clearProductCache;
