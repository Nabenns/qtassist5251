const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * One row per (Discord user, broker account) submission.
 *
 * Lifecycle:
 *   pending  → user submitted, queued for verification
 *   verified → matched in IB list with min deposit met; role granted
 *   failed   → exhausted retry attempts; admin must intervene
 *   removed  → was verified earlier but auto-revoked due to inactivity
 *
 * The `lastError` and `lastCheckResponse` columns retain the most recent
 * error string / sanitized API response from Valetax so admins can see
 * exactly why something is in `failed` without scraping logs.
 */
const IbAccount = sequelize.define('IbAccount', {
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
    field: 'user_id',
    comment: 'Discord user ID who submitted the account'
  },
  brokerAccountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'broker_account_number',
    comment: 'Account number on the broker (Valetax). Nullable: wizard creates the row in step 1 before user has provided the number in step 3.'
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'failed', 'removed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'retry_count'
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'next_retry_at',
    comment: 'When the next verification attempt should run'
  },
  lastCheckedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_checked_at'
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_error'
  },
  lastCheckResponse: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'last_check_response',
    comment: 'Most recent sanitized broker response (id, status, deposit, etc.) for transparency'
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'verified_at'
  },
  totalDepositUsd: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'total_deposit_usd'
  },
  lastVolumeAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_volume_at',
    comment: 'Most recent date the account had qualifying trading volume'
  },
  consecutiveZeroVolumeDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'consecutive_zero_volume_days'
  },
  removedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'removed_at'
  },
  removedReason: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'removed_reason'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  linkClickedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'link_clicked_at',
    comment: 'When user clicked the Valetax registration link from /daftar-ib step 1'
  },
  depositConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deposit_confirmed_at',
    comment: 'When user confirmed deposit in /daftar-ib step 2'
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
  tableName: 'ib_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      // Prevent the same Discord user from submitting the same account twice
      // in the same server.
      unique: true,
      fields: ['server_id', 'user_id', 'broker_account_number'],
      name: 'unique_account_per_user_per_server'
    },
    { fields: ['server_id'] },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['next_retry_at'] }
  ]
});

module.exports = IbAccount;
