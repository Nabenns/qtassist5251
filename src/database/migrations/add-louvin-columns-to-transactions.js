/**
 * Migration: add Louvin payment gateway columns to transactions.
 *
 * Adds payment_channel + 6 nullable louvin_* columns plus 2 indexes.
 * Idempotent — safe to re-run.
 *
 * Run: node src/database/migrations/add-louvin-columns-to-transactions.js
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function ensureColumn(queryInterface, tableDescription, name, ddl) {
  if (tableDescription[name]) {
    console.log(`ℹ️  Column ${name} already exists, skipping`);
    return;
  }
  await sequelize.query(`ALTER TABLE transactions ADD COLUMN ${name} ${ddl}`);
  console.log(`✅ Added column ${name}`);
}

async function ensureIndex(name, ddl) {
  const [results] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'transactions' AND indexname = $1`,
    { bind: [name] }
  );
  if (results.length > 0) {
    console.log(`ℹ️  Index ${name} already exists, skipping`);
    return;
  }
  await sequelize.query(ddl);
  console.log(`✅ Created index ${name}`);
}

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const td = await queryInterface.describeTable('transactions');

  await ensureColumn(queryInterface, td, 'payment_channel', `VARCHAR(32) NOT NULL DEFAULT 'manual_bank'`);
  await ensureColumn(queryInterface, td, 'louvin_transaction_id', 'VARCHAR(64)');
  await ensureColumn(queryInterface, td, 'louvin_payment_type', 'VARCHAR(32)');
  await ensureColumn(queryInterface, td, 'louvin_fee', 'INTEGER');
  await ensureColumn(queryInterface, td, 'louvin_total_payment', 'INTEGER');
  await ensureColumn(queryInterface, td, 'louvin_payment_number', 'TEXT');
  await ensureColumn(queryInterface, td, 'louvin_expired_at', 'TIMESTAMP WITH TIME ZONE');

  await ensureIndex('idx_transactions_louvin_id', `
    CREATE UNIQUE INDEX idx_transactions_louvin_id
    ON transactions(louvin_transaction_id)
    WHERE louvin_transaction_id IS NOT NULL
  `);
  await ensureIndex('idx_transactions_payment_channel', `
    CREATE INDEX idx_transactions_payment_channel
    ON transactions(payment_channel)
  `);

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
