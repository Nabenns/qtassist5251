const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

/**
 * DashboardUser
 *
 * Discord-authenticated user that can log into the web dashboard.
 *
 * Identity comes entirely from Discord OAuth (`identify` scope). Whether
 * the user can see admin pages or only `/daftar-ib` is determined by
 * checking — at login time and on a periodic refresh — whether they
 * carry any of the role IDs configured in the AdminRole table.
 *
 * The cached `isAdmin` flag here is a snapshot for fast middleware checks
 * between role refreshes; the source of truth is always the live guild.
 */
const DashboardUser = sequelize.define('DashboardUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  discordId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'discord_id',
    comment: 'Discord user snowflake ID'
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord username (e.g. nabens)'
  },
  globalName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'global_name',
    comment: 'Discord global display name (may be null)'
  },
  discriminator: {
    type: DataTypes.STRING(8),
    allowNull: true,
    comment: 'Legacy discriminator (#1234) for users that still have one'
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Avatar hash from Discord'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email address (only set if email scope was granted)'
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_admin',
    comment: 'Cached admin flag — true if user carries any admin role at last sync'
  },
  cachedRoleIds: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'cached_role_ids',
    comment: 'Snapshot of the user\'s guild role IDs at last sync'
  },
  rolesSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'roles_synced_at',
    comment: 'Timestamp of most recent role refresh from Discord'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at',
    comment: 'Timestamp of most recent successful login'
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
  tableName: 'dashboard_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['discord_id'] }
  ]
});

module.exports = DashboardUser;
