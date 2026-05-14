const express = require('express');
const { Product } = require('../../database/models');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll({
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
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
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

    const allowedFields = ['name', 'description', 'price', 'isActive'];
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

    await product.update(updates);

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
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('PATCH /api/products/:id error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
