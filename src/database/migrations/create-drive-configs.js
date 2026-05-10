const { sequelize } = require('../sequelize');

/**
 * Migration: Create drive_configs table
 *
 * Purpose: Store Google Drive auto-share configuration per server
 */
async function migrate() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Creating drive_configs table...');

    // Create drive_configs table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS drive_configs (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL UNIQUE,
        drive_file_ids TEXT,
        auto_share_enabled BOOLEAN NOT NULL DEFAULT false,
        share_role VARCHAR(50) NOT NULL DEFAULT 'reader',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `, { transaction });

    console.log('✅ drive_configs table created successfully');

    // Create index for faster lookups
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_drive_configs_server
      ON drive_configs(server_id);
    `, { transaction });

    console.log('✅ Indexes created successfully');

    await transaction.commit();
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback migration
 */
async function rollback() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Rolling back drive_configs table...');

    await sequelize.query(`DROP TABLE IF EXISTS drive_configs CASCADE;`, { transaction });

    await transaction.commit();
    console.log('✅ Rollback completed successfully!');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { migrate, rollback };
