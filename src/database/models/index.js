const { sequelize } = require('../sequelize');
const TemporaryRole = require('./TemporaryRole');
const ModerationLog = require('./ModerationLog');
const Product = require('./Product');
const Transaction = require('./Transaction');
const EmailBinding = require('./EmailBinding');
const DriveConfig = require('./DriveConfig');
const AdminUser = require('./AdminUser');
const DashboardUser = require('./DashboardUser');
const AdminRole = require('./AdminRole');
const EmailRole = require('./EmailRole');
const IbConfig = require('./IbConfig');
const IbAccount = require('./IbAccount');
const IbVolumeRecord = require('./IbVolumeRecord');

// Define associations
Product.hasMany(Transaction, { foreignKey: 'productId', as: 'transactions' });
Transaction.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

IbAccount.hasMany(IbVolumeRecord, { foreignKey: 'ibAccountId', as: 'volumes', onDelete: 'CASCADE' });
IbVolumeRecord.belongsTo(IbAccount, { foreignKey: 'ibAccountId', as: 'account' });

// Initialize database and sync models
const initDatabase = async () => {
  try {
    // Sync all models (without alter - use migrations instead)
    await sequelize.sync();
    console.log('✅ Database models synchronized.');
  } catch (error) {
    console.error('❌ Error syncing database models:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  TemporaryRole,
  ModerationLog,
  Product,
  Transaction,
  EmailBinding,
  DriveConfig,
  AdminUser,
  DashboardUser,
  AdminRole,
  EmailRole,
  IbConfig,
  IbAccount,
  IbVolumeRecord,
  initDatabase
};
