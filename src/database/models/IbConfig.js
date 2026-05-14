const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * Per-guild IB integration configuration.
 *
 * Stored as singleton per server (one row per Discord guild). Cookie is
 * stored encrypted; never log or return it raw outside the cookie helper.
 *
 * The web admin dashboard manages this row directly so QTrades operators
 * never have to touch the database.
 */
const IbConfig = sequelize.define('IbConfig', {
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
    comment: 'Discord guild this config belongs to'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Master switch — gate every IB action behind this'
  },
  ibRoleId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'ib_role_id',
    comment: 'Discord role given to verified IB users'
  },
  registrationChannelId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'registration_channel_id',
    comment: 'Channel where the public IB registration embed lives'
  },
  notificationChannelId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'notification_channel_id',
    comment: 'Channel for admin-only notifications (failed verifications, role removals)'
  },
  ibLink: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'ib_link',
    comment: 'Affiliate / IB referral URL shown to users'
  },
  encryptedCookie: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'encrypted_cookie',
    comment: 'AES-GCM encrypted Valetax IB session cookie blob (iv:tag:cipher base64)'
  },
  cookieUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cookie_updated_at'
  },
  cookieLastTestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cookie_last_tested_at'
  },
  cookieLastTestStatus: {
    type: DataTypes.ENUM('unknown', 'ok', 'expired', 'error'),
    allowNull: false,
    defaultValue: 'unknown',
    field: 'cookie_last_test_status'
  },
  cookieLastTestMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cookie_last_test_message'
  },
  retryIntervalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    field: 'retry_interval_minutes',
    validate: { min: 1, max: 1440 }
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'max_retries',
    validate: { min: 1, max: 50 }
  },
  minDepositUsd: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 100,
    field: 'min_deposit_usd',
    comment: 'Minimum cumulative deposit (USD) to grant the IB role'
  },
  volumeCheckEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'volume_check_enabled'
  },
  volumeGraceDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7,
    field: 'volume_grace_days',
    validate: { min: 1, max: 90 },
    comment: 'How many consecutive zero-volume days before the role is revoked'
  },
  minDailyVolumeLots: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'min_daily_volume_lots',
    comment: 'Minimum lots/day to be considered "active" (0 = any volume counts)'
  },
  embedTitle: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'embed_title'
  },
  embedDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'embed_description'
  },
  embedButtonLabel: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'embed_button_label'
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
  tableName: 'ib_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['server_id'] }]
});

module.exports = IbConfig;
