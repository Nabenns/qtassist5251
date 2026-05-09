const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const TemporaryRole = sequelize.define('TemporaryRole', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'server_id'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id'
  },
  roleId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'role_id'
  },
  grantedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'granted_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  grantedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'granted_by'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  templateUsed: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'template_used'
    // Phase 2: Uncomment when RoleTemplates table is created
    // references: {
    //   model: 'RoleTemplates',
    //   key: 'id'
    // }
  },
  notified24h: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'notified_24h'
  },
  notified1h: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'notified_1h'
  },
  isBulkOperation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_bulk_operation'
  },
  bulkOperationId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'bulk_operation_id'
  }
}, {
  tableName: 'temporary_roles',
  timestamps: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['server_id']
    }
  ]
});

module.exports = TemporaryRole;
