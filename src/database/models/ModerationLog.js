const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const ModerationLog = sequelize.define('ModerationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  actionType: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'action_type'
    // kick, ban, mute, temprole_add, temprole_remove, template_create, etc.
  },
  moderatorId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'moderator_id'
  },
  targetUserId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'target_user_id'
  },
  roleId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'role_id'
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'template_id'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expiryTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expiry_time'
  },
  additionalData: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'additional_data'
  }
}, {
  tableName: 'moderation_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['moderator_id']
    },
    {
      fields: ['target_user_id']
    },
    {
      fields: ['action_type']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = ModerationLog;
