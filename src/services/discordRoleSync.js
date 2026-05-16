/**
 * Discord role sync service.
 *
 * Bridges the dashboard's auth layer to the live Discord guild via the
 * bot client. We use the bot (which already has GuildMembers intent)
 * instead of OAuth's `guilds.members.read` so a single source of truth
 * exists and the OAuth scope stays at `identify`.
 *
 * Public surface:
 *   - `getMemberRoleIds(guildId, userId)` — fetch live role IDs for a user
 *   - `isAdminRoleSet(serverId, roleIds, member?)` — check whether any
 *     of the given role IDs is configured as an admin role; falls back
 *     to ADMINISTRATOR permission if the AdminRole table is empty
 *   - `syncDashboardUser(dashboardUser, opts)` — refresh a DashboardUser
 *     row from the live guild and persist `isAdmin` / `cachedRoleIds`
 *     / `rolesSyncedAt`
 *
 * The bot client is provided lazily via the `getDiscordClient` accessor
 * passed to the web server, so calls made before the bot is ready will
 * return `{ ok: false, reason: 'bot_not_ready' }` rather than throw.
 */

const { PermissionsBitField } = require('discord.js');
const { AdminRole } = require('../database/models');

let getDiscordClientFn = () => null;

/**
 * Wire the role sync service to the running bot client. Called once
 * from `server.js` startup so all subsequent calls use the same accessor.
 */
function setDiscordClientAccessor(getter) {
  if (typeof getter === 'function') {
    getDiscordClientFn = getter;
  }
}

/**
 * Resolve the guild ID we operate against. The bot is single-server
 * today, so we lock onto DISCORD_GUILD_ID.
 */
function getPrimaryGuildId() {
  return String(process.env.DISCORD_GUILD_ID || '').trim();
}

async function fetchGuild(guildId) {
  const client = getDiscordClientFn();
  if (!client || !client.isReady?.()) return null;
  try {
    return await client.guilds.fetch(guildId);
  } catch (_) {
    return null;
  }
}

async function fetchMember(guildId, userId) {
  const guild = await fetchGuild(guildId);
  if (!guild) return null;
  try {
    return await guild.members.fetch(userId);
  } catch (_) {
    return null;
  }
}

/**
 * Fetch the live Discord guild role IDs for a user.
 *
 * @returns {Promise<{ ok: boolean, roleIds?: string[], hasAdminPerm?: boolean, reason?: string }>}
 */
async function getMemberRoleIds(guildId, userId) {
  const member = await fetchMember(guildId, userId);
  if (!member) {
    return { ok: false, reason: 'member_not_found' };
  }
  const roleIds = [...member.roles.cache.keys()];
  const hasAdminPerm = member.permissions?.has?.(PermissionsBitField.Flags.Administrator) === true;
  return { ok: true, roleIds, hasAdminPerm };
}

/**
 * Decide whether a given set of role IDs grants admin access.
 *
 * Bootstrap rule: if no AdminRole row exists yet for this server,
 * fall back to Discord native ADMINISTRATOR permission so the very
 * first admin can seed the table.
 */
async function isAdminRoleSet(serverId, roleIds, hasAdminPerm = false) {
  const adminRoles = await AdminRole.findAll({ where: { serverId } });
  if (adminRoles.length === 0) {
    return Boolean(hasAdminPerm);
  }
  const adminRoleIds = new Set(adminRoles.map((r) => r.roleId));
  return (roleIds || []).some((id) => adminRoleIds.has(id));
}

/**
 * Refresh a DashboardUser's admin flag + cached roles from the live guild.
 *
 * If the bot can't be reached or the user is no longer in the guild we
 * keep whatever was last cached but bump `rolesSyncedAt` is NOT set so
 * the caller can decide whether to deny / allow based on staleness.
 *
 * @param {Object} dashboardUser  Sequelize instance to mutate + save
 * @param {Object} [opts]
 * @param {boolean} [opts.persist=true]  Whether to call .save()
 * @returns {Promise<{ ok: boolean, isAdmin: boolean, reason?: string }>}
 */
async function syncDashboardUser(dashboardUser, opts = {}) {
  const persist = opts.persist !== false;
  const guildId = getPrimaryGuildId();
  if (!guildId) {
    return { ok: false, isAdmin: dashboardUser.isAdmin === true, reason: 'no_guild_configured' };
  }

  const live = await getMemberRoleIds(guildId, dashboardUser.discordId);
  if (!live.ok) {
    // Don't flip isAdmin to false on transient bot outages — only when
    // we positively determined the user is not a member or has no roles.
    if (live.reason === 'member_not_found') {
      dashboardUser.isAdmin = false;
      dashboardUser.cachedRoleIds = [];
      dashboardUser.rolesSyncedAt = new Date();
      if (persist) await dashboardUser.save();
      return { ok: true, isAdmin: false };
    }
    return { ok: false, isAdmin: dashboardUser.isAdmin === true, reason: live.reason };
  }

  const isAdmin = await isAdminRoleSet(guildId, live.roleIds, live.hasAdminPerm);

  dashboardUser.isAdmin = isAdmin;
  dashboardUser.cachedRoleIds = live.roleIds;
  dashboardUser.rolesSyncedAt = new Date();
  if (persist) await dashboardUser.save();

  return { ok: true, isAdmin };
}

module.exports = {
  setDiscordClientAccessor,
  getPrimaryGuildId,
  getMemberRoleIds,
  isAdminRoleSet,
  syncDashboardUser
};
