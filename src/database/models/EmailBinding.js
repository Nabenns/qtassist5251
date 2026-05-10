const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const EmailBinding = sequelize.define('EmailBinding', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'server_id',
    comment: 'Discord server ID'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id',
    comment: 'Discord user ID'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    },
    comment: 'User email address for video/drive access'
  },
  registeredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'registered_at',
    comment: 'When email was registered'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
    comment: 'Last update timestamp'
  }
}, {
  tableName: 'email_bindings',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['server_id', 'user_id'],
      name: 'unique_user_per_server'
    },
    {
      unique: true,
      fields: ['server_id', 'email'],
      name: 'unique_email_per_server'
    }
  ]
});

module.exports = EmailBinding;
