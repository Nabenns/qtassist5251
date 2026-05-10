const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

const DriveConfig = sequelize.define('DriveConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'server_id',
    comment: 'Discord server ID'
  },
  driveFileIds: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'drive_file_ids',
    comment: 'Comma-separated list of Google Drive file/folder IDs to auto-share'
  },
  autoShareEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'auto_share_enabled',
    comment: 'Enable/disable auto-sharing when email registered'
  },
  shareRole: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'reader',
    field: 'share_role',
    comment: 'Permission role: reader, commenter, writer'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'drive_configs',
  timestamps: false
});

module.exports = DriveConfig;
