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
  },
  paymentChannel: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'manual_bank',
    field: 'payment_channel',
    validate: {
      isIn: {
        args: [['manual_bank', 'louvin']],
        msg: 'paymentChannel must be manual_bank or louvin'
      }
    }
  },
  louvinTransactionId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'louvin_transaction_id',
    comment: 'UUID dari Louvin /create-transaction response'
  },
  louvinPaymentType: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'louvin_payment_type',
    comment: 'qris, gopay, bni_va, dst'
  },
  louvinFee: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'louvin_fee',
    comment: 'Fee Louvin (IDR)'
  },
  louvinTotalPayment: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'louvin_total_payment',
    comment: 'Total yang dibayar customer (amount + fee)'
  },
  louvinPaymentNumber: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'louvin_payment_number',
    comment: 'qr_string atau va_number untuk display'
  },
  louvinExpiredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'louvin_expired_at',
    comment: 'Expiry timestamp dari Louvin'
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
    },
    {
      fields: ['payment_channel']
    }
  ]
});

module.exports = Transaction;
