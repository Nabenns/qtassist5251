/**
 * IB business logic.
 *
 * Sits between Discord/web event sources and the broker client
 * (valetaxService). Owns:
 *   - submitting an account (queue for verification)
 *   - running a verification attempt (called by both manual flows and cron)
 *   - granting / revoking the IB role
 *   - daily volume sampling and inactivity-based auto-removal
 *
 * Every state change writes a sequence of audit log entries so the web
 * dashboard's audit page reflects all IB activity automatically.
 */

const { Op } = require('sequelize');
const {
  IbConfig,
  IbAccount,
  IbVolumeRecord,
  ModerationLog
} = require('../database/models');
const valetax = require('./valetaxService');
const { emitEvent } = require('./eventBus');

/**
 * Helper: clamp a configured retry interval into the supported range and
 * return the next-retry timestamp.
 */
function computeNextRetryAt(intervalMinutes) {
  const minutes = Math.min(Math.max(Number(intervalMinutes) || 5, 1), 1440);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function getEnabledConfig(serverId) {
  const cfg = await IbConfig.findOne({ where: { serverId } });
  if (!cfg || !cfg.enabled) return null;
  return cfg;
}

/**
 * Sanitize a Valetax response for storage. Trims to safe scalar fields.
 */
function sanitizeBrokerResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of [
    'mock',
    'accountNumber',
    'totalDeposit',
    'totalDepositUsd',
    'status',
    'currency',
    'registeredAt',
    'volumeLots',
    'date'
  ]) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

/**
 * Submit (or re-submit) an account for verification. Idempotent: if the
 * same (server, user, account) row already exists we either return it as-is
 * (verified) or reset it back into pending state with retry counter cleared
 * (failed/removed → user wants to retry).
 *
 * @returns {Promise<{ account: IbAccount, alreadyVerified: boolean, alreadyPending: boolean, reset: boolean }>}
 */
async function submitAccount({ serverId, userId, brokerAccountNumber }) {
  const acctNumber = String(brokerAccountNumber || '').trim();
  if (!acctNumber) {
    throw new Error('Nomor akun broker wajib diisi.');
  }

  const config = await getEnabledConfig(serverId);
  if (!config) {
    throw new Error('Sistem IB belum diaktifkan untuk server ini.');
  }

  const [record, created] = await IbAccount.findOrCreate({
    where: { serverId, userId, brokerAccountNumber: acctNumber },
    defaults: {
      serverId,
      userId,
      brokerAccountNumber: acctNumber,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: new Date()
    }
  });

  if (created) {
    return { account: record, alreadyVerified: false, alreadyPending: false, reset: false };
  }

  if (record.status === 'verified') {
    return { account: record, alreadyVerified: true, alreadyPending: false, reset: false };
  }
  if (record.status === 'pending') {
    return { account: record, alreadyVerified: false, alreadyPending: true, reset: false };
  }

  // failed / removed → reset for a fresh attempt
  await record.update({
    status: 'pending',
    retryCount: 0,
    nextRetryAt: new Date(),
    lastError: null,
    lastCheckResponse: null,
    removedAt: null,
    removedReason: null
  });

  return { account: record, alreadyVerified: false, alreadyPending: false, reset: true };
}

/**
 * Run a single verification attempt against Valetax for one account row.
 * Updates the row in-place with the outcome.
 *
 * @param {Object} params
 * @param {Object} params.account             IbAccount instance
 * @param {Object} params.config              IbConfig instance
 * @param {Object} params.discordClient       Required to grant the role
 * @param {string} params.source              'manual' | 'cron' (audit only)
 * @returns {Promise<{ status: 'verified' | 'pending' | 'failed', message: string }>}
 */
async function runVerification({ account, config, discordClient, source = 'cron' }) {
  let result;
  try {
    result = await valetax.lookupAccount({
      ibConfig: config,
      brokerAccountNumber: account.brokerAccountNumber
    });
  } catch (error) {
    if (error instanceof valetax.ValetaxAuthError) {
      // Cookie expired — record on the config and stop hammering until
      // the operator updates it. We don't bump retryCount because the
      // failure is on our side, not the user's.
      await config.update({
        cookieLastTestedAt: new Date(),
        cookieLastTestStatus: 'expired',
        cookieLastTestMessage: error.message
      });
      await account.update({
        lastCheckedAt: new Date(),
        lastError: `Cookie Valetax bermasalah: ${error.message}`,
        nextRetryAt: computeNextRetryAt(config.retryIntervalMinutes)
      });
      emitEvent('ib.cookie_expired', { serverId: config.serverId, message: error.message });
      return { status: 'pending', message: error.message };
    }

    // Network / 5xx / config error — keep pending, don't bump retry counter
    // (we want to retry transient failures forever within the operator's
    // tolerance, not exhaust the user's chances on our outages).
    await account.update({
      lastCheckedAt: new Date(),
      lastError: error.message || String(error),
      nextRetryAt: computeNextRetryAt(config.retryIntervalMinutes)
    });
    return { status: 'pending', message: error.message || String(error) };
  }

  await config.update({
    cookieLastTestedAt: new Date(),
    cookieLastTestStatus: 'ok',
    cookieLastTestMessage: null
  });

  if (!result.found) {
    const newRetry = account.retryCount + 1;
    if (newRetry >= config.maxRetries) {
      await account.update({
        status: 'failed',
        retryCount: newRetry,
        lastCheckedAt: new Date(),
        lastError: 'Akun tidak ditemukan setelah percobaan maksimum.',
        lastCheckResponse: null,
        nextRetryAt: null
      });
      await ModerationLog.create({
        actionType: 'ib_failed',
        moderatorId: discordClient?.user ? discordClient.user.id : 'system',
        targetUserId: account.userId,
        reason: `IB account ${account.brokerAccountNumber} tidak ditemukan setelah ${newRetry} percobaan.`,
        additionalData: { source, accountNumber: account.brokerAccountNumber }
      });
      emitEvent('ib.failed', {
        serverId: config.serverId,
        userId: account.userId,
        accountNumber: account.brokerAccountNumber,
        retries: newRetry
      });
      return {
        status: 'failed',
        message: `Akun belum terdaftar setelah ${newRetry} percobaan. Hubungi admin.`
      };
    }

    await account.update({
      retryCount: newRetry,
      lastCheckedAt: new Date(),
      lastError: 'Akun belum terdaftar di list IB Valetax.',
      lastCheckResponse: null,
      nextRetryAt: computeNextRetryAt(config.retryIntervalMinutes)
    });
    return {
      status: 'pending',
      message: `Akun belum ditemukan. Akan dicoba lagi otomatis (percobaan ${newRetry}/${config.maxRetries}).`
    };
  }

  // Found! Check deposit threshold.
  const minDeposit = Number(config.minDepositUsd) || 0;
  const totalDeposit = Number(result.totalDepositUsd) || 0;

  if (totalDeposit < minDeposit) {
    const newRetry = account.retryCount + 1;
    const exhausted = newRetry >= config.maxRetries;
    await account.update({
      status: exhausted ? 'failed' : 'pending',
      retryCount: newRetry,
      lastCheckedAt: new Date(),
      lastError: `Deposit belum mencukupi (USD ${totalDeposit.toFixed(2)} / minimum USD ${minDeposit.toFixed(2)}).`,
      lastCheckResponse: sanitizeBrokerResponse(result.raw),
      totalDepositUsd: totalDeposit,
      nextRetryAt: exhausted ? null : computeNextRetryAt(config.retryIntervalMinutes)
    });
    if (exhausted) {
      await ModerationLog.create({
        actionType: 'ib_failed',
        moderatorId: discordClient?.user ? discordClient.user.id : 'system',
        targetUserId: account.userId,
        reason: `IB account ${account.brokerAccountNumber} deposit kurang dari minimum (USD ${totalDeposit} < ${minDeposit}).`,
        additionalData: { source, accountNumber: account.brokerAccountNumber, totalDeposit }
      });
      emitEvent('ib.failed', {
        serverId: config.serverId,
        userId: account.userId,
        accountNumber: account.brokerAccountNumber,
        reason: 'min_deposit'
      });
      return {
        status: 'failed',
        message: `Deposit kamu USD ${totalDeposit.toFixed(2)} belum mencukupi minimum USD ${minDeposit.toFixed(2)}. Hubungi admin.`
      };
    }
    return {
      status: 'pending',
      message: `Akun ditemukan tapi deposit baru USD ${totalDeposit.toFixed(2)} (minimum USD ${minDeposit.toFixed(2)}). Akan dicek lagi otomatis (percobaan ${newRetry}/${config.maxRetries}).`
    };
  }

  // ─── Verified ─────────────────────────────────────────────────────────
  await account.update({
    status: 'verified',
    verifiedAt: new Date(),
    lastCheckedAt: new Date(),
    lastError: null,
    lastCheckResponse: sanitizeBrokerResponse(result.raw),
    totalDepositUsd: totalDeposit,
    nextRetryAt: null,
    retryCount: account.retryCount + 1,
    consecutiveZeroVolumeDays: 0,
    removedAt: null,
    removedReason: null
  });

  // Grant Discord role best-effort.
  let roleAssigned = false;
  try {
    if (discordClient && config.ibRoleId) {
      const guild = await discordClient.guilds.fetch(config.serverId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(account.userId).catch(() => null);
        const role =
          guild.roles.cache.get(config.ibRoleId) ||
          (await guild.roles.fetch(config.ibRoleId).catch(() => null));
        if (member && role) {
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role, `IB verified · account ${account.brokerAccountNumber}`);
          }
          roleAssigned = true;
        }
      }
    }
  } catch (error) {
    console.error('Could not assign IB role:', error);
  }

  await ModerationLog.create({
    actionType: 'ib_verified',
    moderatorId: discordClient?.user ? discordClient.user.id : 'system',
    targetUserId: account.userId,
    roleId: config.ibRoleId,
    reason: `IB account ${account.brokerAccountNumber} verified · deposit USD ${totalDeposit}`,
    additionalData: {
      source,
      accountNumber: account.brokerAccountNumber,
      totalDeposit,
      roleAssigned
    }
  });

  emitEvent('ib.verified', {
    serverId: config.serverId,
    userId: account.userId,
    accountNumber: account.brokerAccountNumber,
    totalDeposit
  });

  return {
    status: 'verified',
    message: `Akun ${account.brokerAccountNumber} terverifikasi! Role sudah diberikan${roleAssigned ? '' : ' (Discord role belum bisa diberikan, hubungi admin)'}.`
  };
}

/**
 * Cron entry point: pick up every account that is pending and due, run
 * verification, and return aggregate counters for the cron status panel.
 */
async function processPendingQueue({ discordClient }) {
  const now = new Date();
  const pendings = await IbAccount.findAll({
    where: {
      status: 'pending',
      nextRetryAt: { [Op.lte]: now }
    },
    order: [['nextRetryAt', 'ASC']],
    limit: 50
  });

  let verified = 0;
  let stillPending = 0;
  let failed = 0;

  for (const account of pendings) {
    try {
      const config = await getEnabledConfig(account.serverId);
      if (!config) {
        // Config got disabled while we were in the queue — leave the row
        // alone but stop hammering the broker.
        await account.update({
          nextRetryAt: null,
          lastError: 'Sistem IB di-nonaktifkan oleh admin.'
        });
        continue;
      }
      const result = await runVerification({
        account,
        config,
        discordClient,
        source: 'cron'
      });
      if (result.status === 'verified') verified++;
      else if (result.status === 'failed') failed++;
      else stillPending++;
    } catch (error) {
      stillPending++;
      console.error('Error in IB verification cron:', error);
    }
  }

  return { processed: pendings.length, verified, stillPending, failed };
}

/**
 * Daily volume sample for every verified account in a single config.
 * Reads volume from Valetax, persists into IbVolumeRecord, and updates
 * the account's consecutiveZeroVolumeDays counter. If the counter reaches
 * volumeGraceDays, the role is auto-revoked.
 */
async function processVolumeForConfig({ config, discordClient, date }) {
  if (!config.volumeCheckEnabled) {
    return { skipped: true, reason: 'volume_check_disabled' };
  }

  const accounts = await IbAccount.findAll({
    where: {
      serverId: config.serverId,
      status: 'verified'
    }
  });

  const day = date instanceof Date ? date : new Date(date);
  // Normalize to date only (Asia/Jakarta) — the broker is unlikely to
  // care about hours when grouping daily volume.
  const wibDay = new Date(day.getTime() + 7 * 60 * 60 * 1000);
  const isoDay = wibDay.toISOString().slice(0, 10);

  const minLots = Number(config.minDailyVolumeLots) || 0;
  let processed = 0;
  let revoked = 0;
  let errors = 0;

  for (const account of accounts) {
    processed++;
    try {
      const { volumeLots, raw } = await valetax.fetchAccountVolume({
        ibConfig: config,
        brokerAccountNumber: account.brokerAccountNumber,
        date: day
      });

      await IbVolumeRecord.upsert({
        ibAccountId: account.id,
        date: isoDay,
        volumeLots,
        rawResponse: sanitizeBrokerResponse(raw),
        fetchedAt: new Date()
      });

      const qualifies = volumeLots > minLots; // strictly greater so 0 always counts as inactive
      if (qualifies) {
        await account.update({
          consecutiveZeroVolumeDays: 0,
          lastVolumeAt: new Date()
        });
      } else {
        const newCount = account.consecutiveZeroVolumeDays + 1;
        if (newCount >= config.volumeGraceDays) {
          await revokeRoleForInactivity({
            account,
            config,
            discordClient,
            zeroDays: newCount
          });
          revoked++;
        } else {
          await account.update({
            consecutiveZeroVolumeDays: newCount
          });
        }
      }
    } catch (error) {
      errors++;
      if (error instanceof valetax.ValetaxAuthError) {
        await config.update({
          cookieLastTestedAt: new Date(),
          cookieLastTestStatus: 'expired',
          cookieLastTestMessage: error.message
        });
        emitEvent('ib.cookie_expired', { serverId: config.serverId, message: error.message });
        // No point hammering the rest of the accounts on this config until
        // the operator updates the cookie.
        break;
      }
      console.error('IB volume sample failed:', error);
    }
  }

  return { processed, revoked, errors };
}

async function revokeRoleForInactivity({ account, config, discordClient, zeroDays }) {
  // Try to remove the Discord role first; even if that fails we still flip
  // the status so we don't keep retrying every day.
  try {
    if (discordClient && config.ibRoleId) {
      const guild = await discordClient.guilds.fetch(config.serverId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(account.userId).catch(() => null);
        if (member && member.roles.cache.has(config.ibRoleId)) {
          await member.roles.remove(
            config.ibRoleId,
            `IB volume cron: ${zeroDays} hari tanpa volume trading`
          );
        }
      }
    }
  } catch (error) {
    console.error('Could not remove IB role:', error);
  }

  await account.update({
    status: 'removed',
    removedAt: new Date(),
    removedReason: `${zeroDays} hari tanpa volume trading`,
    consecutiveZeroVolumeDays: zeroDays
  });

  await ModerationLog.create({
    actionType: 'ib_role_removed',
    moderatorId: discordClient?.user ? discordClient.user.id : 'system',
    targetUserId: account.userId,
    roleId: config.ibRoleId,
    reason: `IB role dicabut: ${zeroDays} hari tanpa volume trading`,
    additionalData: { accountNumber: account.brokerAccountNumber, zeroDays }
  });

  emitEvent('ib.role_removed', {
    serverId: config.serverId,
    userId: account.userId,
    accountNumber: account.brokerAccountNumber,
    zeroDays
  });
}

/**
 * Daily cron entry point: iterate every enabled config and sample volumes.
 */
async function processVolumeAllConfigs({ discordClient }) {
  const configs = await IbConfig.findAll({
    where: {
      enabled: true,
      volumeCheckEnabled: true
    }
  });

  let totalProcessed = 0;
  let totalRevoked = 0;
  let totalErrors = 0;

  for (const config of configs) {
    try {
      const result = await processVolumeForConfig({
        config,
        discordClient,
        date: new Date()
      });
      if (result?.processed) totalProcessed += result.processed;
      if (result?.revoked) totalRevoked += result.revoked;
      if (result?.errors) totalErrors += result.errors;
    } catch (error) {
      totalErrors++;
      console.error(`IB volume cron failed for ${config.serverId}:`, error);
    }
  }

  return { configs: configs.length, accountsProcessed: totalProcessed, rolesRevoked: totalRevoked, errors: totalErrors };
}

/**
 * Manually re-verify an account immediately (e.g. dashboard "Re-verify"
 * button). Resets retry counter so the user gets a fresh window.
 */
async function reVerifyAccount({ account, discordClient }) {
  const config = await getEnabledConfig(account.serverId);
  if (!config) {
    throw new Error('Sistem IB tidak aktif di server ini.');
  }
  await account.update({
    status: 'pending',
    retryCount: 0,
    nextRetryAt: new Date(),
    lastError: null
  });
  return runVerification({ account, config, discordClient, source: 'manual' });
}

/**
 * Manually remove the IB role from a user and flip status to `removed`.
 * Used when an operator wants to revoke immediately rather than wait for
 * the volume cron to act.
 */
async function manuallyRemoveAccount({ account, discordClient, reason, adminLabel }) {
  const config = await getEnabledConfig(account.serverId);
  if (!config) {
    throw new Error('Sistem IB tidak aktif di server ini.');
  }

  try {
    if (discordClient && config.ibRoleId) {
      const guild = await discordClient.guilds.fetch(config.serverId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(account.userId).catch(() => null);
        if (member && member.roles.cache.has(config.ibRoleId)) {
          await member.roles.remove(config.ibRoleId, reason || 'IB role dicabut admin');
        }
      }
    }
  } catch (error) {
    console.error('Manual IB role remove failed:', error);
  }

  await account.update({
    status: 'removed',
    removedAt: new Date(),
    removedReason: reason || `Manually removed by ${adminLabel || 'admin'}`
  });

  await ModerationLog.create({
    actionType: 'ib_role_removed',
    moderatorId: discordClient?.user ? discordClient.user.id : 'system',
    targetUserId: account.userId,
    roleId: config.ibRoleId,
    reason: reason || `Manually removed by ${adminLabel || 'admin'}`,
    additionalData: {
      accountNumber: account.brokerAccountNumber,
      manual: true,
      adminLabel: adminLabel || null
    }
  });

  emitEvent('ib.role_removed', {
    serverId: config.serverId,
    userId: account.userId,
    accountNumber: account.brokerAccountNumber,
    manual: true
  });
}

module.exports = {
  submitAccount,
  runVerification,
  processPendingQueue,
  processVolumeAllConfigs,
  processVolumeForConfig,
  reVerifyAccount,
  manuallyRemoveAccount,
  sanitizeBrokerResponse
};
