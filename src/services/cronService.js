const cron = require('node-cron');
const { TemporaryRole, ModerationLog, Transaction } = require('../database/models');
const { Op } = require('sequelize');
const { createWarningEmbed, createInfoEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { syncActiveUsersToSheets } = require('./googleSheetsService');
const { recordCronStart } = require('./cronStatus');
const { createBackup, pruneOldBackups } = require('./backupService');
const { emitEvent } = require('./eventBus');

let client = null;

/**
 * Wrap an async cron handler so it records its start/finish/duration to
 * cronStatus and never lets an exception escape into the cron scheduler.
 */
function trackedCron(name, fn) {
  return async () => {
    const run = recordCronStart(name);
    try {
      const meta = await fn();
      run.finalize('ok', { meta: meta || null });
    } catch (error) {
      console.error(`Cron "${name}" failed:`, error);
      run.finalize('error', { error: error.message || String(error) });
    }
  };
}

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

        // Notify user via DM with enhanced UI
        if (member) {
          try {
            const user = await client.users.fetch(tempRole.userId);
            const roleName = role ? role.name : 'Unknown Role';

            const dmEmbed = createInfoEmbed(
              'Temporary Role Expired',
              `Your temporary **${roleName}** role in **${guild.name}** has expired and been removed.`
            );

            dmEmbed.setFooter({
              text: `${guild.name}`,
              iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
            })
            .setThumbnail(QTRADES_LOGO_URL || guild.iconURL({ dynamic: true }));

            await user.send({ embeds: [dmEmbed] });
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

        const warningEmbed = createWarningEmbed(
          'Temporary Role Expiring Soon',
          `Your temporary **${roleName}** role in **${guild.name}** will expire <t:${expiresTimestamp}:R> (in ~24 hours).`
        );

        warningEmbed.setFooter({
          text: `${guild.name} • Final reminder at 1 hour before expiry`,
          iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
        })
        .setThumbnail(QTRADES_LOGO_URL || guild.iconURL({ dynamic: true }));

        await user.send({ embeds: [warningEmbed] });

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

        const warningEmbed = createWarningEmbed(
          'Temporary Role Expiring Soon',
          `Your temporary **${roleName}** role in **${guild.name}** will expire <t:${expiresTimestamp}:R> (in ~1 hour).`
        );

        warningEmbed.setFooter({
          text: `${guild.name} • This is your final reminder`,
          iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
        })
        .setThumbnail(QTRADES_LOGO_URL || guild.iconURL({ dynamic: true }));

        await user.send({ embeds: [warningEmbed] });

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
 * Check and expire old pending transactions
 * - status `pending` (waiting for user to pay): expires after 24 hours
 * - status `pending_review` (waiting for admin to review uploaded proof): expires after 7 days
 */
async function checkExpiredTransactions() {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Find expired transactions: stale `pending` (24h) or stale `pending_review` (7d)
    const expiredTransactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          {
            status: 'pending',
            createdAt: { [Op.lte]: twentyFourHoursAgo }
          },
          {
            status: 'pending_review',
            createdAt: { [Op.lte]: sevenDaysAgo }
          }
        ]
      }
    });

    if (expiredTransactions.length === 0) {
      return;
    }

    console.log(`🔍 Found ${expiredTransactions.length} expired transaction(s). Marking as expired...`);

    for (const transaction of expiredTransactions) {
      try {
        const previousStatus = transaction.status;
        transaction.status = 'expired';
        await transaction.save();

        console.log(`✅ Marked transaction ${transaction.orderId} (${previousStatus}) as expired`);

      } catch (error) {
        console.error(`Error expiring transaction ${transaction.orderId}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in checkExpiredTransactions:', error);
  }
}

/**
 * Start all cron jobs
 */
function startCronJobs(discordClient) {
  client = discordClient;

  console.log('⏰ Starting cron jobs...');

  // Check expired roles every 1 minute
  cron.schedule('* * * * *', trackedCron('checkExpiredRoles', checkExpiredRoles));

  // Check for expiry notifications every 5 minutes
  cron.schedule('*/5 * * * *', trackedCron('sendExpiryNotifications', sendExpiryNotifications));

  // Check expired transactions every 30 minutes
  cron.schedule('*/30 * * * *', trackedCron('checkExpiredTransactions', checkExpiredTransactions));

  // Sync active users to Google Sheets every 10 minutes
  cron.schedule(
    '*/10 * * * *',
    trackedCron('syncActiveUsersToSheets', async () => {
      let processed = 0;
      let failed = 0;
      for (const guild of client.guilds.cache.values()) {
        try {
          await syncActiveUsersToSheets(guild);
          processed++;
        } catch (error) {
          failed++;
          console.error(`❌ Error syncing active users for guild ${guild.id}:`, error.message);
        }
      }
      return { guildsProcessed: processed, guildsFailed: failed };
    })
  );

  // Daily database backup at 03:00 Asia/Jakarta. node-cron interprets the
  // expression in the system timezone, so we explicitly pin to WIB.
  cron.schedule(
    '0 3 * * *',
    trackedCron('dailyDatabaseBackup', async () => {
      try {
        const backup = await createBackup({ source: 'cron' });
        emitEvent('backup.created', {
          id: backup.id,
          name: backup.name,
          size: backup.size,
          source: 'cron',
          adminUsername: 'system'
        });
        const pruneResult = await pruneOldBackups();
        return {
          backupName: backup.name,
          backupSize: backup.size,
          ...pruneResult
        };
      } catch (error) {
        console.error('❌ Daily backup failed:', error.message);
        throw error;
      }
    }),
    { timezone: 'Asia/Jakarta' }
  );

  console.log('✅ Cron jobs started successfully.');
}

module.exports = {
  startCronJobs
};
