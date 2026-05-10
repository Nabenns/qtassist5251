const { sequelize } = require('../sequelize');

/**
 * Migration: Create email_bindings table
 *
 * Purpose: Store email bindings for video/drive access
 * - 1 user can only have 1 email per server
 * - 1 email can only be used by 1 user per server
 */
async function migrate() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Creating email_bindings table...');

    // Create email_bindings table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS email_bindings (
        id SERIAL PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_per_server UNIQUE (server_id, user_id),
        CONSTRAINT unique_email_per_server UNIQUE (server_id, email)
      );
    `, { transaction });

    console.log('✅ email_bindings table created successfully');

    // Create indexes for faster lookups
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_email_bindings_server
      ON email_bindings(server_id);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_email_bindings_user
      ON email_bindings(server_id, user_id);
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
    console.log('🔄 Rolling back email_bindings table...');

    await sequelize.query(`DROP TABLE IF EXISTS email_bindings CASCADE;`, { transaction });

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
