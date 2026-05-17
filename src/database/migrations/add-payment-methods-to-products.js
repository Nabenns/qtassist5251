/**
 * Migration: add payment_methods column to products
 *
 * Adds JSONB column with default ["qris"]. Idempotent — safe to re-run.
 *
 * Run via:
 *   node src/database/migrations/add-payment-methods-to-products.js
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('products');

  if (tableDescription.payment_methods) {
    console.log('ℹ️  Column payment_methods already exists, skipping');
  } else {
    await sequelize.query(`
      ALTER TABLE products
      ADD COLUMN payment_methods JSONB
      NOT NULL DEFAULT '["qris"]'::jsonb
    `);
    console.log('✅ Added payment_methods column to products');
  }

  // GIN index for filtering
  const [indexes] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexname = 'idx_products_payment_methods'`
  );
  if (indexes.length === 0) {
    await sequelize.query(`
      CREATE INDEX idx_products_payment_methods
      ON products USING gin (payment_methods)
    `);
    console.log('✅ Created GIN index idx_products_payment_methods');
  } else {
    console.log('ℹ️  Index idx_products_payment_methods already exists, skipping');
  }

  console.log('✅ Migration complete');
}

(async () => {
  try {
    await migrate();
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
