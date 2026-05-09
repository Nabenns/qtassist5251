const cron = require('node-cron');
const { TemporaryRole, ModerationLog } = require('../database/models');
const { Op } = require('sequelize');
const { createWarningEmbed, createInfoEmbed } = require('../utils/embedBuilder');

let client = null;

/**
 * Check and remove expired roles
 */
async function checkExpiredRoles() {
  try {
    const now = new Date();

    // Find all expired roles
    const expiredRoles = await TemporaryRole.findAll({
      where: {
        expiresAt: {
          [Op.lte]: now
        }
      }
    });

    if (expiredRoles.length === 0) {
      return;
    }

    console.log(`🔍 Found ${expiredRoles.length} expired temporary role(s). Processing...`);

    for (const tempRole of expiredRoles) {
      try {
        // Get guild and member
        const guild = await client.guilds.fetch(tempRole.serverId).catch(() => null);
        if (!guild) {
          console.log(`Guild ${tempRole.serverId} not found. Cleaning up database entry.`);
          await tempRole.destroy();
          continue;
        }

        const member = await guild.members.fetch(tempRole.userId).catch(() => null);
        const role = guild.roles.cache.get(tempRole.roleId);

        // Remove role from member if they still have it
        if (member && role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          console.log(`✅ Removed expired role ${role.name} from ${member.user.tag}`);
        }

        // Delete from database
        await tempRole.destroy();

        // Log action
        await ModerationLog.create({
          actionType: 'temprole_expired',
          moderatorId: client.user.id,
          targetUserId: tempRole.userId,
          roleId: tempRole.roleId,
          reason: 'Role expired automatically'
        });

        // Notify user via DM
        if (member) {
          try {
            const user = await client.users.fetch(tempRole.userId);
            const roleName = role ? role.name : 'Unknown Role';

            await user.send({
              embeds: [createInfoEmbed(
                'Temporary Role Expired',
                `Your temporary **${roleName}** role in **${guild.name}** has expired and been removed.`
              )]
            });
          } catch (error) {
            console.log(`Could not send DM to user ${tempRole.userId}`);
          }
        }

        // Notify mod channel
        const modChannelId = process.env.TEMP_ROLE_NOTIFICATION_CHANNEL_ID;
        if (modChannelId) {
          try {
            const modChannel = await guild.channels.fetch(modChannelId);
            if (modChannel) {
              const user = await client.users.fetch(tempRole.userId).catch(() => null);
              const userName = user ? user.tag : `User ID: ${tempRole.userId}`;
              const roleName = role ? role.name : 'Unknown Role';

              await modChannel.send({
                embeds: [createInfoEmbed(
                  'Temporary Role Expired',
                  `**${roleName}** role has been removed from **${userName}** (expired).`
                )]
              });
            }
          } catch (error) {
            console.log('Could not send notification to mod channel:', error.message);
          }
        }

      } catch (error) {
        console.error(`Error processing expired role ${tempRole.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in checkExpiredRoles:', error);
  }
}

/**
 * Send notifications for roles expiring soon
 */
async function sendExpiryNotifications() {
  try {
    const now = new Date();

    // Check for roles expiring in 24 hours
    const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const twentyThreeHoursFromNow = new Date(now.getTime() + (23 * 60 * 60 * 1000));

    const roles24h = await TemporaryRole.findAll({
      where: {
        expiresAt: {
          [Op.between]: [twentyThreeHoursFromNow, twentyFourHoursFromNow]
        },
        notified24h: false
      }
    });

    for (const tempRole of roles24h) {
      try {
        const guild = await client.guilds.fetch(tempRole.serverId).catch(() => null);
        if (!guild) continue;

        const user = await client.users.fetch(tempRole.userId).catch(() => null);
        if (!user) continue;

        const role = guild.roles.cache.get(tempRole.roleId);
        const roleName = role ? role.name : 'Unknown Role';

        const expiresTimestamp = Math.floor(tempRole.expiresAt.getTime() / 1000);

        await user.send({
          embeds: [createWarningEmbed(
            'Temporary Role Expiring Soon',
            `Your temporary **${roleName}** role in **${guild.name}** will expire <t:${expiresTimestamp}:R> (in ~24 hours).`
          )]
        });

        tempRole.notified24h = true;
        await tempRole.save();

        console.log(`📧 Sent 24h expiry notification to ${user.tag} for role ${roleName}`);

      } catch (error) {
        console.log(`Could not send 24h notification for role ${tempRole.id}:`, error.message);
      }
    }

    // Check for roles expiring in 1 hour
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
    const fiftyNineMinutesFromNow = new Date(now.getTime() + (59 * 60 * 1000));

    const roles1h = await TemporaryRole.findAll({
      where: {
        expiresAt: {
          [Op.between]: [fiftyNineMinutesFromNow, oneHourFromNow]
        },
        notified1h: false
      }
    });

    for (const tempRole of roles1h) {
      try {
        const guild = await client.guilds.fetch(tempRole.serverId).catch(() => null);
        if (!guild) continue;

        const user = await client.users.fetch(tempRole.userId).catch(() => null);
        if (!user) continue;

        const role = guild.roles.cache.get(tempRole.roleId);
        const roleName = role ? role.name : 'Unknown Role';

        const expiresTimestamp = Math.floor(tempRole.expiresAt.getTime() / 1000);

        await user.send({
          embeds: [createWarningEmbed(
            'Temporary Role Expiring Soon',
            `Your temporary **${roleName}** role in **${guild.name}** will expire <t:${expiresTimestamp}:R> (in ~1 hour).`
          )]
        });

        tempRole.notified1h = true;
        await tempRole.save();

        console.log(`📧 Sent 1h expiry notification to ${user.tag} for role ${roleName}`);

      } catch (error) {
        console.log(`Could not send 1h notification for role ${tempRole.id}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error in sendExpiryNotifications:', error);
  }
}

/**
 * Start all cron jobs
 */
function startCronJobs(discordClient) {
  client = discordClient;

  console.log('⏰ Starting cron jobs...');

  // Check expired roles every 1 minute
  cron.schedule('* * * * *', async () => {
    await checkExpiredRoles();
  });

  // Check for expiry notifications every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await sendExpiryNotifications();
  });

  console.log('✅ Cron jobs started successfully.');
}

module.exports = {
  startCronJobs
};
