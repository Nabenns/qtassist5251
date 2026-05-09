const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'order_id'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id'
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'server_id'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Amount in IDR'
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'expired', 'cancelled', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  paymentUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'payment_url'
  },
  paymentType: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'payment_type'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  midtransData: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'midtrans_data',
    comment: 'Raw Midtrans response data'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['order_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['server_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Transaction;
