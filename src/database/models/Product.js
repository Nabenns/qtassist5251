const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roleId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'role_id'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Price in IDR'
  },
  duration: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Duration in milliseconds'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'server_id'
  },
  paymentMethods: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: ['qris'],
    field: 'payment_methods',
    validate: {
      isValidMethods(value) {
        const VALID = ['qris', 'gopay', 'shopeepay', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va'];
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('paymentMethods must be a non-empty array');
        }
        for (const m of value) {
          if (!VALID.includes(m)) {
            throw new Error(`Invalid payment method: ${m}`);
          }
        }
      }
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      fields: ['server_id']
    },
    {
      fields: ['role_id']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Product;
