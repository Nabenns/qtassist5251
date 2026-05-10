const { sequelize } = require('../sequelize');
const TemporaryRole = require('./TemporaryRole');
const ModerationLog = require('./ModerationLog');
const Product = require('./Product');
const Transaction = require('./Transaction');
const EmailBinding = require('./EmailBinding');

// Define associations
Product.hasMany(Transaction, { foreignKey: 'productId', as: 'transactions' });
Transaction.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

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
  initDatabase
};
