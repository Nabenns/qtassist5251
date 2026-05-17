/**
 * User-facing shop endpoints. All require an authenticated session
 * (any user, admin or not).
 *
 * In-memory product cache (5 min) to reduce DB load on /shop browsing.
 * Cache invalidates per-server.
 */

const crypto = require('crypto');
const express = require('express');
const { Op } = require('sequelize');
const { Product, Transaction } = require('../../database/models');
const { requireAuth } = require('../middleware');
const { createLouvinTransaction, LouvinError } = require('../../services/louvinService');

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

function generateOrderId() {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex'); // 6 char hex
  return `qta-${ts}-${rand}`;
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

  // POST /api/shop/checkout
  // Body: { productId, paymentMethod }
  router.post('/checkout', async (req, res) => {
    try {
      if (process.env.LOUVIN_ENABLED !== 'true') {
        return res.status(503).json({ error: 'louvin_disabled' });
      }

      const { productId, paymentMethod } = req.body || {};
      if (!Number.isFinite(Number(productId))) {
        return res.status(400).json({ error: 'invalid_product_id' });
      }
      if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
        return res.status(400).json({ error: 'invalid_payment_method' });
      }

      const product = await Product.findByPk(Number(productId));
      if (!product || !product.isActive) {
        return res.status(404).json({ error: 'product_not_found' });
      }

      const allowed = Array.isArray(product.paymentMethods) ? product.paymentMethods : [];
      if (!allowed.includes(paymentMethod)) {
        return res.status(400).json({ error: 'method_not_allowed_for_product' });
      }

      // Fresh guild membership check
      const client = getDiscordClient();
      if (!client) {
        return res.status(503).json({ error: 'bot_not_ready' });
      }
      const guild = await client.guilds.fetch(product.serverId).catch(() => null);
      if (!guild) {
        return res.status(503).json({ error: 'guild_not_accessible' });
      }
      const member = await guild.members.fetch(req.session.discordId).catch(() => null);
      if (!member) {
        return res.status(403).json({
          error: 'not_in_guild',
          inviteUrl: process.env.DISCORD_INVITE_URL || null
        });
      }

      // Resume duplicate: existing pending un-expired txn for same product+method
      const now = new Date();
      const existingPending = await Transaction.findOne({
        where: {
          userId: req.session.discordId,
          productId: product.id,
          status: 'pending',
          paymentChannel: 'louvin',
          louvinPaymentType: paymentMethod,
          louvinExpiredAt: { [Op.gt]: now }
        }
      });
      if (existingPending) {
        return res.json({
          orderId: existingPending.orderId,
          resumed: true,
          paymentType: existingPending.louvinPaymentType,
          paymentNumber: existingPending.louvinPaymentNumber,
          totalPayment: existingPending.louvinTotalPayment,
          fee: existingPending.louvinFee,
          expiresAt: existingPending.louvinExpiredAt
        });
      }

      // Create local row first (status pending) so we have a stable orderId
      // to use as `reference` in Louvin call.
      const orderId = generateOrderId();
      const transaction = await Transaction.create({
        orderId,
        userId: req.session.discordId,
        serverId: product.serverId,
        productId: product.id,
        amount: product.price,
        status: 'pending',
        paymentChannel: 'louvin',
        louvinPaymentType: paymentMethod
      });

      // Call Louvin
      let louvinResp;
      try {
        louvinResp = await createLouvinTransaction({
          amount: product.price,
          paymentType: paymentMethod,
          customerName: req.session.username || req.session.discordId,
          description: process.env.LOUVIN_DEFAULT_DESCRIPTION || `Pembelian ${product.name}`,
          reference: orderId
        });
      } catch (err) {
        await transaction.update({ status: 'cancelled', rejectionReason: 'louvin_create_failed' });
        if (err instanceof LouvinError) {
          return res.status(502).json({ error: 'gateway_error', code: err.code, details: err.message });
        }
        throw err;
      }

      const { transaction: lvTrx, payment: lvPay } = louvinResp;
      // qr_string for QRIS/GoPay, va_number for VA, deeplink_url for ShopeePay
      const paymentNumber = lvPay.qr_string || lvPay.va_number || lvPay.deeplink_url || lvPay.payment_number || null;

      await transaction.update({
        louvinTransactionId: lvTrx.id,
        louvinFee: lvTrx.fee,
        louvinTotalPayment: lvTrx.amount, // total customer pays
        louvinPaymentNumber: paymentNumber,
        louvinExpiredAt: lvPay.expired_at ? new Date(lvPay.expired_at) : null
      });

      return res.status(201).json({
        orderId,
        resumed: false,
        paymentType: paymentMethod,
        paymentNumber,
        totalPayment: lvTrx.amount,
        fee: lvTrx.fee,
        amount: product.price,
        expiresAt: lvPay.expired_at
      });
    } catch (error) {
      console.error('POST /api/shop/checkout error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
module.exports.clearProductCache = clearProductCache;
