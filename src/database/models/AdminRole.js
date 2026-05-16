const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * AdminRole
 *
 * A Discord role ID that grants admin access to the web dashboard.
 * Managed at runtime via the dashboard's "Pengaturan Admin Roles" page.
 *
 * Multiple rows can exist; a user is considered admin if they hold ANY
 * of the role IDs listed here. Bootstrap rule: if the table is empty,
 * a user with Discord guild ADMINISTRATOR permission is granted access
 * so the first admin can seed this table without being locked out.
 */
const AdminRole = sequelize.define('AdminRole', {
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
  tableName: 'admin_roles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['server_id', 'role_id'] }
  ]
});

module.exports = AdminRole;
