/**
 * Migration: add IB tracking columns
 *
 * Adds linkClickedAt and depositConfirmedAt to ib_accounts. Also relaxes
 * broker_account_number from NOT NULL to nullable so wizard can create
 * the row in step 1 before user provides the number in step 3.
 *
 * Adds a partial unique index `(server_id, user_id) WHERE broker_account_number IS NULL`
 * so concurrent step-1 link clicks cannot create duplicate pre-account rows.
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
const PARTIAL_INDEX_NAME = 'ib_accounts_unique_pre_account_per_user';

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
    await sequelize.query(
      `ALTER TABLE ib_accounts ALTER COLUMN ${columnName} TYPE TIMESTAMP WITH TIME ZONE USING ${columnName} AT TIME ZONE 'UTC'`
    );
    console.log(`✅ Upgraded ${columnName} from ${col.type} to TIMESTAMP WITH TIME ZONE`);
    return;
  }
  console.log(`ℹ️  Column ${columnName} already TIMESTAMP WITH TIME ZONE, skipping`);
}

async function ensurePartialUniqueIndex() {
  // Check if index already exists
  const [results] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'ib_accounts' AND indexname = $1`,
    { bind: [PARTIAL_INDEX_NAME] }
  );

  if (results.length > 0) {
    console.log(`ℹ️  Partial unique index ${PARTIAL_INDEX_NAME} already exists, skipping`);
    return;
  }

  // Before creating, deduplicate any existing pre-account rows that would conflict.
  // Keep the most recently updated row per (server_id, user_id) pair where
  // broker_account_number IS NULL. Older duplicates get deleted.
  const [duplicates] = await sequelize.query(`
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY server_id, user_id
        ORDER BY updated_at DESC, id DESC
      ) AS rn
      FROM ib_accounts
      WHERE broker_account_number IS NULL
    ) t
    WHERE rn > 1
  `);

  if (duplicates.length > 0) {
    const ids = duplicates.map((r) => r.id);
    await sequelize.query(
      `DELETE FROM ib_accounts WHERE id IN (${ids.join(',')})`
    );
    console.log(`✅ Deduplicated ${ids.length} legacy pre-account row(s) before adding index`);
  }

  await sequelize.query(`
    CREATE UNIQUE INDEX ${PARTIAL_INDEX_NAME}
    ON ib_accounts (server_id, user_id)
    WHERE broker_account_number IS NULL
  `);
  console.log(`✅ Created partial unique index ${PARTIAL_INDEX_NAME}`);
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

  await ensurePartialUniqueIndex();

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
