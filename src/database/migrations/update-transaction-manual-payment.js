/**
 * Migration script to update Transaction model for manual payment approval system
 *
 * This script will:
 * 1. Add new columns for manual payment approval
 * 2. Update status ENUM to include new statuses
 * 3. Keep old Midtrans columns for backward compatibility
 *
 * Run this script once to migrate existing database
 */

const { sequelize } = require('../sequelize');

async function migrate() {
  console.log('🔄 Starting migration: Update Transaction for Manual Payment...');

  try {
    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // 1. Add new columns for manual payment approval
      console.log('➕ Adding new columns...');

      // Check if columns already exist before adding
      const [columns] = await sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'transactions'
      `, { transaction });

      const existingColumns = columns.map(c => c.column_name);

      if (!existingColumns.includes('payment_proof_url')) {
        await sequelize.query(`
          ALTER TABLE transactions
          ADD COLUMN payment_proof_url TEXT;
        `, { transaction });
        console.log('   ✓ Added payment_proof_url');
      } else {
        console.log('   ⚠ payment_proof_url already exists, skipping');
      }

      if (!existingColumns.includes('reviewed_by')) {
        await sequelize.query(`
          ALTER TABLE transactions
          ADD COLUMN reviewed_by VARCHAR(255);
        `, { transaction });
        console.log('   ✓ Added reviewed_by');
      } else {
        console.log('   ⚠ reviewed_by already exists, skipping');
      }

      if (!existingColumns.includes('reviewed_at')) {
        await sequelize.query(`
          ALTER TABLE transactions
          ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
        `, { transaction });
        console.log('   ✓ Added reviewed_at');
      } else {
        console.log('   ⚠ reviewed_at already exists, skipping');
      }

      if (!existingColumns.includes('rejection_reason')) {
        await sequelize.query(`
          ALTER TABLE transactions
          ADD COLUMN rejection_reason TEXT;
        `, { transaction });
        console.log('   ✓ Added rejection_reason');
      } else {
        console.log('   ⚠ rejection_reason already exists, skipping');
      }

      console.log('✅ New columns added successfully');

      // 2. Update status ENUM
      console.log('🔄 Updating status ENUM...');

      // Check if enum exists
      const [enumCheck] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_transactions_status'
        ) as enum_exists;
      `, { transaction });

      const enumExists = enumCheck[0].enum_exists;

      if (enumExists) {
        console.log('   ✓ ENUM exists, updating...');

        // Drop default value first
        await sequelize.query(`
          ALTER TABLE transactions
          ALTER COLUMN status DROP DEFAULT;
        `, { transaction });

        // Drop old enum backup if exists
        await sequelize.query(`
          DROP TYPE IF EXISTS enum_transactions_status_old CASCADE;
        `, { transaction });

        // Rename current enum to old
        await sequelize.query(`
          ALTER TYPE enum_transactions_status RENAME TO enum_transactions_status_old;
        `, { transaction });

        // Create new enum with new values
        await sequelize.query(`
          CREATE TYPE enum_transactions_status AS ENUM (
            'pending',
            'pending_review',
            'approved',
            'rejected',
            'expired',
            'cancelled'
          );
        `, { transaction });

        // Convert column to new enum type
        await sequelize.query(`
          ALTER TABLE transactions
          ALTER COLUMN status TYPE enum_transactions_status
          USING (
            CASE status::text
              WHEN 'paid' THEN 'approved'
              WHEN 'failed' THEN 'cancelled'
              ELSE status::text
            END
          )::enum_transactions_status;
        `, { transaction });

        // Drop old enum
        await sequelize.query(`
          DROP TYPE IF EXISTS enum_transactions_status_old;
        `, { transaction });

      } else {
        console.log('   ✓ ENUM does not exist, creating new...');

        // Create new enum
        await sequelize.query(`
          CREATE TYPE enum_transactions_status AS ENUM (
            'pending',
            'pending_review',
            'approved',
            'rejected',
            'expired',
            'cancelled'
          );
        `, { transaction });

        // Update column type to use enum
        await sequelize.query(`
          ALTER TABLE transactions
          ALTER COLUMN status TYPE enum_transactions_status
          USING status::text::enum_transactions_status;
        `, { transaction });
      }

      // Set default value and NOT NULL
      await sequelize.query(`
        ALTER TABLE transactions
        ALTER COLUMN status SET DEFAULT 'pending'::enum_transactions_status;
      `, { transaction });

      await sequelize.query(`
        ALTER TABLE transactions
        ALTER COLUMN status SET NOT NULL;
      `, { transaction });

      console.log('✅ Status ENUM updated successfully');

      // 3. Add comments to columns
      console.log('📝 Adding column comments...');

      await sequelize.query(`
        COMMENT ON COLUMN transactions.payment_proof_url IS 'Discord attachment URL of payment proof';
        COMMENT ON COLUMN transactions.reviewed_by IS 'Admin user ID who approved/rejected';
        COMMENT ON COLUMN transactions.reviewed_at IS 'When admin reviewed the payment';
        COMMENT ON COLUMN transactions.rejection_reason IS 'Reason for rejection (optional)';
        COMMENT ON COLUMN transactions.status IS 'pending = waiting payment, pending_review = waiting admin approval, approved = role assigned, rejected = payment rejected';
      `, { transaction });

      console.log('✅ Comments added');

      // Commit transaction
      await transaction.commit();

      console.log('');
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('📋 Summary:');
      console.log('   ✓ Added: payment_proof_url, reviewed_by, reviewed_at, rejection_reason');
      console.log('   ✓ Updated: status ENUM (pending, pending_review, approved, rejected, expired, cancelled)');
      console.log('   ✓ Converted: old "paid" → "approved", old "failed" → "cancelled"');
      console.log('   ✓ Kept: payment_url, payment_type, midtrans_data (backward compatibility)');
      console.log('');
      console.log('🎉 Database is ready for manual payment approval system!');

    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL is running');
    console.error('   2. Check database connection in .env');
    console.error('   3. Ensure user has ALTER TABLE permissions');
    console.error('   4. If enum error, run: DROP TYPE IF EXISTS enum_transactions_status CASCADE;');
    console.error('');
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed');
      process.exit(1);
    });
}

module.exports = { migrate };
