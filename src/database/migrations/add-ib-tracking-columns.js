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
 *
 * Recovery note: if a previous version of this script created the columns
 * as plain TIMESTAMP (no time zone), the alignment block below will detect
 * the drift and ALTER them to TIMESTAMP WITH TIME ZONE so they match what
 * Sequelize's DataTypes.DATE produces.
 */

require('dotenv').config();
const { sequelize } = require('../sequelize');

const TZ_TYPE = 'TIMESTAMP WITH TIME ZONE';

/**
 * Postgres reports `TIMESTAMP WITH TIME ZONE` as `TIMESTAMP WITH TIME ZONE`
 * via Sequelize's describeTable, but plain `TIMESTAMP` shows as `TIMESTAMP`.
 * Treat anything that doesn't include "WITH TIME ZONE" as drift.
 */
function isTimestampWithTimezone(colType) {
  if (!colType) return false;
  return /WITH TIME ZONE/i.test(colType);
}

async function ensureTimestampTzColumn(queryInterface, columnName, tableDescription) {
  const col = tableDescription[columnName];
  if (!col) {
    await queryInterface.addColumn('ib_accounts', columnName, {
      type: TZ_TYPE,
      allowNull: true
    });
    console.log(`✅ Added column ${columnName} to ib_accounts`);
    return;
  }
  if (!isTimestampWithTimezone(col.type)) {
    // Use raw SQL via the underlying connection so the timezone semantics are preserved.
    await sequelize.query(
      `ALTER TABLE ib_accounts ALTER COLUMN ${columnName} TYPE TIMESTAMP WITH TIME ZONE USING ${columnName} AT TIME ZONE 'UTC'`
    );
    console.log(`✅ Upgraded ${columnName} from ${col.type} to TIMESTAMP WITH TIME ZONE`);
    return;
  }
  console.log(`ℹ️  Column ${columnName} already TIMESTAMP WITH TIME ZONE, skipping`);
}

async function migrate() {
  const queryInterface = sequelize.getQueryInterface();

  let tableDescription;
  try {
    tableDescription = await queryInterface.describeTable('ib_accounts');
  } catch (err) {
    console.error('❌ Could not describe ib_accounts table:', err.message);
    console.error('   Make sure DATABASE_URL or DB_* env vars are set and the table exists.');
    throw err;
  }

  await ensureTimestampTzColumn(queryInterface, 'link_clicked_at', tableDescription);
  await ensureTimestampTzColumn(queryInterface, 'deposit_confirmed_at', tableDescription);

  // Relax broker_account_number to nullable if currently NOT NULL.
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
