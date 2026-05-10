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
    type: DataTypes.ENUM('pending', 'pending_review', 'approved', 'rejected', 'expired', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false,
    comment: 'pending = waiting payment, pending_review = waiting admin approval, approved = role assigned, rejected = payment rejected'
  },
  paymentProofUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'payment_proof_url',
    comment: 'Discord attachment URL of payment proof'
  },
  reviewedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'reviewed_by',
    comment: 'Admin user ID who approved/rejected'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at',
    comment: 'When admin reviewed the payment'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason',
    comment: 'Reason for rejection (optional)'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at',
    comment: 'When payment was approved'
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
