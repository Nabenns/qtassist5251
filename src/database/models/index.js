const { sequelize } = require('../sequelize');
const TemporaryRole = require('./TemporaryRole');
const ModerationLog = require('./ModerationLog');
const Product = require('./Product');
const Transaction = require('./Transaction');

// Initialize database and sync models
const initDatabase = async () => {
  try {
    // Sync all models
    await sequelize.sync({ alter: true });
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
  initDatabase
};
