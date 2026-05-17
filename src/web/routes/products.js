const express = require('express');
const { parseDuration } = require('../../utils/parseDuration');
const { Product } = require('../../database/models');
const { requireAdmin } = require('../middleware');
const { clearProductCache } = require('./shop');

const VALID_LOUVIN_METHODS = ['qris', 'gopay', 'shopeepay', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'];

/**
 * Validate paymentMethods array. Returns cleaned array (deduped, valid only)
 * or null if invalid (not array, empty, or contains unknown values).
 */
function validatePaymentMethods(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const cleaned = [];
  for (const m of value) {
    if (typeof m !== 'string') return null;
    if (!VALID_LOUVIN_METHODS.includes(m)) return null;
    if (!cleaned.includes(m)) cleaned.push(m);
  }
  return cleaned.length > 0 ? cleaned : null;
}

function buildRouter({ getDiscordClient }) {
  const router = express.Router();
  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    try {
      const where = {};
      if (req.query.serverId) where.serverId = String(req.query.serverId);
      const products = await Product.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });
      return res.json({
        items: products.map((p) => ({
          id: p.id,
          roleId: p.roleId,
          serverId: p.serverId,
          name: p.name,
          description: p.description,
          price: p.price,
          duration: String(p.duration),
          isActive: p.isActive,
          paymentMethods: Array.isArray(p.paymentMethods) ? p.paymentMethods : ['qris'],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      });
    } catch (error) {
      console.error('GET /api/products error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const client = getDiscordClient();
      const { serverId, roleId, name, description, price, duration, isActive } = req.body || {};

      if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'invalid_server_id' });
      }
      if (!roleId || typeof roleId !== 'string') {
        return res.status(400).json({ error: 'invalid_role_id' });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'invalid_name' });
      }
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'invalid_price' });
      }
      let durationMs;
      if (typeof duration === 'string') {
        durationMs = parseDuration(duration);
        if (!durationMs) return res.status(400).json({ error: 'invalid_duration' });
      } else {
        durationMs = Number(duration);
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
          return res.status(400).json({ error: 'invalid_duration' });
        }
      }

      // Validate paymentMethods (optional, default ['qris'])
      let paymentMethods = ['qris'];
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'paymentMethods')) {
        const pm = validatePaymentMethods(req.body.paymentMethods);
        if (!pm) return res.status(400).json({ error: 'invalid_payment_methods' });
        paymentMethods = pm;
      }

      // Best-effort validation that the role exists in the guild and the bot
      // can assign it. Failure here is informative, not fatal — the row is
      // still created so the admin can fix the hierarchy and try again.
      let roleWarning = null;
      if (client) {
        try {
          const guild = await client.guilds.fetch(serverId).catch(() => null);
          if (!guild) {
            roleWarning = 'Bot is not in this guild; product created but role assignment will fail.';
          } else {
            const role =
              guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
            if (!role) {
              roleWarning = 'Role not found in guild';
            } else if (role.id === guild.id) {
              return res.status(400).json({ error: 'role_is_everyone' });
            } else if (role.managed) {
              return res.status(400).json({ error: 'role_is_managed' });
            } else {
              const me = await guild.members.fetchMe().catch(() => null);
              if (me && role.position >= me.roles.highest.position) {
                roleWarning = "Bot's highest role is not above this role; assignments will fail until you move the bot's role up.";
              }
            }
          }
        } catch (_) {
          // ignore
        }
      }

      const product = await Product.create({
        serverId: String(serverId),
        roleId: String(roleId),
        name: String(name).trim(),
        description: typeof description === 'string' ? description : null,
        price: Math.round(priceNum),
        duration: String(Math.round(durationMs)),
        isActive: isActive === false ? false : true,
        paymentMethods
      });

      clearProductCache(product.serverId);

      return res.status(201).json({
        ok: true,
        warning: roleWarning,
        product: {
          id: product.id,
          serverId: product.serverId,
          roleId: product.roleId,
          name: product.name,
          description: product.description,
          price: product.price,
          duration: String(product.duration),
          isActive: product.isActive,
          paymentMethods: Array.isArray(product.paymentMethods) ? product.paymentMethods : ['qris'],
          createdAt: product.createdAt
        }
      });
    } catch (error) {
      console.error('POST /api/products error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'invalid_id' });
      }

      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({ error: 'not_found' });
      }

      const allowedFields = ['name', 'description', 'price', 'isActive', 'paymentMethods'];
      const updates = {};
      for (const key of allowedFields) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
          updates[key] = req.body[key];
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'price')) {
        const priceNum = Number(updates.price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: 'invalid_price' });
        }
        updates.price = Math.round(priceNum);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'isActive')) {
        updates.isActive = Boolean(updates.isActive);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'name') && !String(updates.name).trim()) {
        return res.status(400).json({ error: 'invalid_name' });
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'paymentMethods')) {
        const pm = validatePaymentMethods(updates.paymentMethods);
        if (!pm) return res.status(400).json({ error: 'invalid_payment_methods' });
        updates.paymentMethods = pm;
      }

      await product.update(updates);

      clearProductCache(product.serverId);

      return res.json({
        ok: true,
        product: {
          id: product.id,
          roleId: product.roleId,
          serverId: product.serverId,
          name: product.name,
          description: product.description,
          price: product.price,
          duration: String(product.duration),
          isActive: product.isActive,
          paymentMethods: Array.isArray(product.paymentMethods) ? product.paymentMethods : ['qris'],
          updatedAt: product.updatedAt
        }
      });
    } catch (error) {
      console.error('PATCH /api/products/:id error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'invalid_id' });
      }
      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({ error: 'not_found' });
      }
      const serverId = product.serverId;
      await product.destroy();
      clearProductCache(serverId);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/products/:id error:', error);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
