/**
 * Email-binding eligibility check.
 *
 * Returns whether a Discord user can register / update / delete their
 * email binding. Used by:
 *   - Web routes (`/api/emails/me`) — gates user-facing CRUD
 *   - Discord button handler (`email_register`) — gates the modal popup
 *
 * Eligibility rules (in order):
 *   1. Dashboard admin (DashboardUser.isAdmin = true) → always eligible
 *   2. EmailRole table empty for server → closed for everyone except admin
 *   3. User holds any role ID listed in EmailRole → eligible
 *   4. Otherwise → not eligible
 *
 * Returns { eligible: boolean, reason?: string, requiredRoleIds?: string[] }
 *
 * - reason: 'feature_disabled' | 'no_required_role' | 'member_not_found'
 * - requiredRoleIds: list of admin-configured role IDs (only when not eligible
 *   due to missing role) so the UI can hint which roles are needed
 */

const { EmailRole, DashboardUser } = require('../database/models');

let getDiscordClientFn = () => null;

function setDiscordClientAccessor(getter) {
  if (typeof getter === 'function') {
    getDiscordClientFn = getter;
  }
}

/**
 * Look up the eligibility for a given Discord user in a given server.
 *
 * @param {Object} params
 * @param {string} params.serverId  Discord guild ID
 * @param {string} params.userId    Discord user snowflake ID
 * @param {boolean} [params.isAdmin] If known (e.g. from session), short-circuits the check
 */
async function checkEmailEligibility({ serverId, userId, isAdmin = false }) {
  if (isAdmin) {
    return { eligible: true, reason: 'admin_bypass' };
  }

  // If caller didn't pass isAdmin (e.g. Discord button handler), look it up
  // from the cached DashboardUser row. This is best-effort: a user that
  // never logged into the dashboard won't have a row, which is fine —
  // they fall through to the role check below.
  if (!isAdmin) {
    try {
      const dashboardUser = await DashboardUser.findOne({ where: { discordId: userId } });
      if (dashboardUser?.isAdmin) {
        return { eligible: true, reason: 'admin_bypass' };
      }
    } catch (_) {
      // Non-fatal — continue to role check
    }
  }

  const requiredRoles = await EmailRole.findAll({ where: { serverId } });

  if (requiredRoles.length === 0) {
    return {
      eligible: false,
      reason: 'feature_disabled',
      requiredRoleIds: []
    };
  }

  const requiredRoleIds = requiredRoles.map((r) => r.roleId);

  // Look up the member's roles via the bot client.
  const client = getDiscordClientFn();
  if (!client || !client.isReady?.()) {
    return {
      eligible: false,
      reason: 'bot_not_ready',
      requiredRoleIds
    };
  }

  let member;
  try {
    const guild = await client.guilds.fetch(serverId);
    member = await guild.members.fetch(userId);
  } catch (_) {
    return {
      eligible: false,
      reason: 'member_not_found',
      requiredRoleIds
    };
  }

  const memberRoleIds = new Set(member.roles.cache.keys());
  const hasRequiredRole = requiredRoleIds.some((id) => memberRoleIds.has(id));

  if (hasRequiredRole) {
    return { eligible: true, reason: 'has_required_role' };
  }

  return {
    eligible: false,
    reason: 'no_required_role',
    requiredRoleIds
  };
}

module.exports = {
  setDiscordClientAccessor,
  checkEmailEligibility
};
