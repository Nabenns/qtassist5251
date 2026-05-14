const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * Daily volume snapshot for an IB account.
 *
 * The volume cron picks up every verified IbAccount, fetches its trading
 * activity for the day from Valetax, and writes one row here. We keep the
 * raw response (sanitized) so admins can audit the inactivity-based role
 * removal flow.
 */
const IbVolumeRecord = sequelize.define('IbVolumeRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ibAccountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'ib_account_id',
    references: { model: 'ib_accounts', key: 'id' },
    onDelete: 'CASCADE'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Calendar date (Asia/Jakarta) of this volume sample'
  },
  volumeLots: {
    type: DataTypes.DECIMAL(14, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'volume_lots'
  },
  rawResponse: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'raw_response',
    comment: 'Sanitized snapshot of the broker volume API response'
  },
  fetchedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'fetched_at'
  }
}, {
  tableName: 'ib_volume_records',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['ib_account_id', 'date'],
      name: 'unique_volume_per_account_per_day'
    },
    { fields: ['date'] }
  ]
});

module.exports = IbVolumeRecord;
