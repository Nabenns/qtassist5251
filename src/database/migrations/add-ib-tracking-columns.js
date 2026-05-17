/**
 * Migration: add IB tracking columns
 *
 * Adds linkClickedAt and depositConfirmedAt to ib_accounts. Also relaxes
 * broker_account_number from NOT NULL to nullable so wizard can create
 * the row in step 1 before user provides the number in step 3.
 *
 * Idempotent — safe to re-run. Checks current column state before each
 * change. Run once via:
 *
 *   node src/database/migrations/add-ib-tracking-columns.js
 *
 * Then restart the bot.
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  let tableDescription;

  try {
    tableDescription = await queryInterface.describeTable('ib_accounts');
  } catch (err) {
    console.error('❌ Could not describe ib_accounts table:', err.message);
    console.error('   Make sure DATABASE_URL or DB_* env vars are set and the table exists.');
    await sequelize.close();
    process.exit(1);
  }

  // Add link_clicked_at if missing
  if (!tableDescription.link_clicked_at) {
    await queryInterface.addColumn('ib_accounts', 'link_clicked_at', {
      type: 'TIMESTAMP',
      allowNull: true
    });
    console.log('✅ Added column link_clicked_at to ib_accounts');
  } else {
    console.log('ℹ️  Column link_clicked_at already exists, skipping');
  }

  // Add deposit_confirmed_at if missing
  if (!tableDescription.deposit_confirmed_at) {
    await queryInterface.addColumn('ib_accounts', 'deposit_confirmed_at', {
      type: 'TIMESTAMP',
      allowNull: true
    });
    console.log('✅ Added column deposit_confirmed_at to ib_accounts');
  } else {
    console.log('ℹ️  Column deposit_confirmed_at already exists, skipping');
  }

  // Relax broker_account_number to nullable if currently NOT NULL
  const brokerCol = tableDescription.broker_account_number;
  if (brokerCol && brokerCol.allowNull === false) {
    await queryInterface.changeColumn('ib_accounts', 'broker_account_number', {
      type: 'VARCHAR(255)',
      allowNull: true
    });
    console.log('✅ Relaxed broker_account_number to nullable');
  } else if (brokerCol && brokerCol.allowNull === true) {
    console.log('ℹ️  Column broker_account_number already nullable, skipping');
  } else {
    console.warn('⚠️  Column broker_account_number not found — was the table renamed?');
  }

  console.log('✅ Migration complete');
  await sequelize.close();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
