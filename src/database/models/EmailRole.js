const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * EmailRole
 *
 * A Discord role ID that grants access to the email-binding feature.
 * Managed at runtime via the dashboard's "Pengaturan Email" page.
 *
 * Eligibility rule:
 *   - If this table is empty for a server: feature is closed for everyone
 *     except dashboard admins (admins always bypass).
 *   - If non-empty: user must hold ANY of the listed role IDs in the guild
 *     to register / update / delete their email.
 *
 * Same-server scoping ensures multi-server installs (future) stay isolated.
 */
const EmailRole = sequelize.define('EmailRole', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serverId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'server_id',
    comment: 'Discord guild ID this role belongs to'
  },
  roleId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'role_id',
    comment: 'Discord role snowflake ID'
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Friendly label for the dashboard list (e.g. role name at time of add)'
  },
  addedByDiscordId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'added_by_discord_id',
    comment: 'Dashboard user (Discord ID) that added this entry'
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
  tableName: 'email_roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['server_id', 'role_id'] }
  ]
});

module.exports = EmailRole;
