/**
 * Shared approval/rejection logic for manual-payment transactions.
 * Used by the Discord button handlers, the /transaction-process command,
 * and the admin web dashboard so all paths produce identical behavior.
 */
const {
  Transaction,
  Product,
  TemporaryRole,
  ModerationLog
} = require('../database/models');
const { syncTransactionToSheets } = require('./googleSheetsService');
const { createSuccessEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');

/**
 * Approve a transaction by orderId.
 *
 * @param {Object} params
 * @param {import('discord.js').Client} params.client - Discord client used to fetch guild/member/user
 * @param {string} params.orderId
 * @param {string} params.reviewerId - Discord user ID of the admin (for ModerationLog/grantedBy/reviewedBy)
 * @param {string} [params.reviewerLabel] - Human-readable label for the reviewer (e.g. "web:username"). Used in reasons.
 * @returns {Promise<{ok: true, transaction, role, expiresAt} | {ok:false, code:string, message:string}>}
 */
async function approveTransaction({ client, orderId, reviewerId, reviewerLabel }) {
  const transaction = await Transaction.findOne({
    where: { orderId },
    include: [{ model: Product, as: 'product' }]
  });

  if (!transaction) {
    return { ok: false, code: 'not_found', message: 'Transaction not found' };
  }

  if (transaction.status === 'approved') {
    return { ok: false, code: 'already_approved', message: 'Transaction already approved' };
  }

  if (['rejected', 'cancelled', 'expired'].includes(transaction.status)) {
    return {
      ok: false,
      code: 'invalid_status',
      message: `Transaction is ${transaction.status} and cannot be approved`
    };
  }

  const product = transaction.product;
  if (!product) {
    return { ok: false, code: 'product_missing', message: 'Product no longer exists' };
  }

  const guild = await client.guilds.fetch(transaction.serverId).catch(() => null);
  if (!guild) {
    return { ok: false, code: 'guild_missing', message: 'Guild not accessible' };
  }

  const role = guild.roles.cache.get(product.roleId)
    || (await guild.roles.fetch(product.roleId).catch(() => null));
  if (!role) {
    return { ok: false, code: 'role_missing', message: 'Role no longer exists in guild' };
  }

  const member = await guild.members.fetch(transaction.userId).catch(() => null);
  if (!member) {
    return { ok: false, code: 'member_missing', message: 'User is not in the guild' };
  }

  await transaction.update({
    status: 'approved',
    paidAt: new Date(),
    reviewedBy: reviewerId,
    reviewedAt: new Date()
  });

  // Role stacking: extend if user already has an active temp role for this role.
  const now = new Date();
  const existingTempRole = await TemporaryRole.findOne({
    where: {
      serverId: guild.id,
      userId: transaction.userId,
      roleId: role.id
    }
  });

  let expiresAt;
  if (existingTempRole && existingTempRole.expiresAt > now) {
    expiresAt = new Date(existingTempRole.expiresAt.getTime() + parseInt(product.duration));
    await existingTempRole.update({
      expiresAt,
      notified24h: false,
      notified1h: false
    });
  } else {
    expiresAt = new Date(Date.now() + parseInt(product.duration));
    if (existingTempRole) await existingTempRole.destroy();
    await TemporaryRole.create({
      serverId: guild.id,
      userId: transaction.userId,
      roleId: role.id,
      grantedAt: new Date(),
      expiresAt,
      grantedBy: reviewerId,
      reason: `Approved transaction (${reviewerLabel || 'system'}): ${product.name} (Order: ${orderId})`,
      notified24h: false,
      notified1h: false
    });
  }

  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role, `Manual payment approval - Order ${orderId}`);
  }

  await ModerationLog.create({
    actionType: 'temprole_add',
    moderatorId: reviewerId,
    targetUserId: transaction.userId,
    roleId: role.id,
    reason: `Approved transaction (${reviewerLabel || 'system'}) - Order: ${orderId}`,
    expiryTime: expiresAt,
    additionalData: {
      orderId: transaction.orderId,
      amount: transaction.amount,
      productId: product.id,
      productName: product.name,
      reviewerLabel: reviewerLabel || null
    }
  });

  // Best-effort: DM user
  try {
    const user = await client.users.fetch(transaction.userId);
    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(transaction.amount);
    const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

    const userEmbed = createSuccessEmbed(
      'Pembayaran Disetujui!',
      `Pembayaran kamu telah disetujui dan ${role} sudah diberikan!`,
      [
        { name: '📦 Produk', value: product.name, inline: true },
        { name: '💰 Jumlah', value: formattedPrice, inline: true },
        { name: '⏱️ Durasi', value: formatDuration(product.duration), inline: true },
        { name: '⏳ Kadaluarsa', value: `<t:${expiryTimestamp}:R>`, inline: true }
      ]
    );
    userEmbed.setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }));
    await user.send({ embeds: [userEmbed] });
  } catch (error) {
    console.log(`Could not DM user ${transaction.userId}: ${error.message}`);
  }

  // Best-effort: sync to Google Sheets
  try {
    await syncTransactionToSheets(transaction, guild);
  } catch (error) {
    console.log('Could not sync to Google Sheets:', error.message);
  }

  return { ok: true, transaction, role, expiresAt };
}

/**
 * Reject a transaction by orderId.
 */
async function rejectTransaction({ client, orderId, reviewerId, reviewerLabel, reason }) {
  if (!reason || !reason.trim()) {
    return { ok: false, code: 'reason_required', message: 'Rejection reason is required' };
  }

  const transaction = await Transaction.findOne({
    where: { orderId },
    include: [{ model: Product, as: 'product' }]
  });

  if (!transaction) {
    return { ok: false, code: 'not_found', message: 'Transaction not found' };
  }

  if (transaction.status === 'rejected') {
    return { ok: false, code: 'already_rejected', message: 'Transaction already rejected' };
  }

  if (transaction.status === 'approved') {
    return {
      ok: false,
      code: 'already_approved',
      message: 'Transaction is already approved and cannot be rejected'
    };
  }

  await transaction.update({
    status: 'rejected',
    rejectionReason: reason.trim(),
    reviewedBy: reviewerId,
    reviewedAt: new Date()
  });

  // Best-effort: DM user
  try {
    const user = await client.users.fetch(transaction.userId);
    await user.send({
      embeds: [
        {
          title: '❌ Pembayaran Ditolak',
          description: `Pembayaran kamu untuk **${transaction.product ? transaction.product.name : 'produk'}** ditolak oleh admin.\n\n**Alasan:** ${reason.trim()}\n\nSilakan hubungi admin untuk info lebih lanjut.`,
          color: 0xED4245,
          timestamp: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    console.log(`Could not DM user ${transaction.userId}: ${error.message}`);
  }

  try {
    const guild = await client.guilds.fetch(transaction.serverId).catch(() => null);
    if (guild) {
      await syncTransactionToSheets(transaction, guild);
    }
  } catch (error) {
    console.log('Could not sync to Google Sheets:', error.message);
  }

  return { ok: true, transaction };
}

module.exports = {
  approveTransaction,
  rejectTransaction
};
