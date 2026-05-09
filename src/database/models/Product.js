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
