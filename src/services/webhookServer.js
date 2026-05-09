const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { verifyNotification } = require('./midtransService');
const { Transaction, Product, TemporaryRole, ModerationLog } = require('../database/models');
const { createSuccessEmbed, QTRADES_LOGO_URL } = require('../utils/embedBuilder');
const { formatDuration } = require('../utils/parseDuration');

let discordClient = null;

/**
 * Start Express server for webhook
 */
function startWebhookServer(client) {
  discordClient = client;

  const app = express();
  const PORT = process.env.WEBHOOK_PORT || 3000;

  // Parse JSON body
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'QTrades Payment Webhook Server',
      timestamp: new Date().toISOString()
    });
  });

  // Midtrans webhook endpoint
  app.post('/webhook/midtrans', async (req, res) => {
    try {
      console.log('📥 Received Midtrans webhook notification');

      // Verify Midtrans signature
      const {
        order_id,
        status_code,
        gross_amount,
        signature_key
      } = req.body;

      // Create hash for signature verification
      const serverKey = process.env.MIDTRANS_SERVER_KEY;
      const hash = crypto
        .createHash('sha512')
        .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
        .digest('hex');

      // Verify signature
      if (hash !== signature_key) {
        console.error('❌ Invalid signature - possible fraud attempt');
        console.log('Expected:', hash);
        console.log('Received:', signature_key);
        return res.status(403).json({ error: 'Invalid signature' });
      }

      console.log('✅ Signature verified');

      // Verify notification
      const notification = verifyNotification(req.body);

      if (notification.error) {
        console.error('❌ Webhook verification failed:', notification.error);
        return res.status(400).json({ error: 'Verification failed' });
      }

      console.log(`📋 Order ID: ${notification.orderId}, Status: ${notification.transactionStatus}, Paid: ${notification.isPaid}`);

      // Find transaction in database
      const transaction = await Transaction.findOne({
        where: { orderId: notification.orderId }
      });

      if (!transaction) {
        console.error('❌ Transaction not found:', notification.orderId);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Update transaction status
      transaction.status = notification.isPaid ? 'paid' : notification.transactionStatus;
      transaction.paymentType = notification.paymentType;
      transaction.midtransData = notification.rawData;

      if (notification.isPaid && !transaction.paidAt) {
        transaction.paidAt = new Date();
        await transaction.save();

        console.log('✅ Payment confirmed! Processing role assignment...');

        // Process payment success - assign role
        await processPaymentSuccess(transaction);
      } else {
        await transaction.save();
        console.log(`ℹ️ Transaction status updated to: ${transaction.status}`);
      }

      res.status(200).json({ status: 'ok' });

    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🌐 Webhook server running on port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook/midtrans`);
  });

  return app;
}

/**
 * Process successful payment - assign role
 */
async function processPaymentSuccess(transaction) {
  try {
    // Fetch product
    const product = await Product.findByPk(transaction.productId);
    if (!product) {
      console.error('❌ Product not found:', transaction.productId);
      return;
    }

    // Get guild and member
    const guild = await discordClient.guilds.fetch(transaction.serverId);
    if (!guild) {
      console.error('❌ Guild not found:', transaction.serverId);
      return;
    }

    const member = await guild.members.fetch(transaction.userId);
    if (!member) {
      console.error('❌ Member not found:', transaction.userId);
      return;
    }

    const role = guild.roles.cache.get(product.roleId);
    if (!role) {
      console.error('❌ Role not found:', product.roleId);
      return;
    }

    // Check for existing temporary role (for role stacking)
    const existingTempRole = await TemporaryRole.findOne({
      where: {
        serverId: guild.id,
        userId: member.id,
        roleId: role.id
      }
    });

    let expiresAt;
    let isExtension = false;

    if (existingTempRole) {
      // Role stacking: extend the expiry time
      const now = new Date();
      if (existingTempRole.expiresAt > now) {
        // Extend from current expiry
        expiresAt = new Date(existingTempRole.expiresAt.getTime() + parseInt(product.duration));
        isExtension = true;

        existingTempRole.expiresAt = expiresAt;
        existingTempRole.notified24h = false;
        existingTempRole.notified1h = false;
        await existingTempRole.save();

        console.log(`✅ Extended role ${role.name} for ${member.user.tag} until ${expiresAt}`);
      } else {
        // Role expired, create new entry
        expiresAt = new Date(Date.now() + parseInt(product.duration));
        await existingTempRole.destroy();

        await TemporaryRole.create({
          serverId: guild.id,
          userId: member.id,
          roleId: role.id,
          grantedAt: new Date(),
          expiresAt: expiresAt,
          grantedBy: discordClient.user.id,
          reason: `Purchased via payment - Order: ${transaction.orderId}`,
          notified24h: false,
          notified1h: false,
          isBulkOperation: false
        });

        console.log(`✅ Created new temporary role entry, expires at: ${expiresAt}`);
      }
    } else {
      // No existing role, create new
      expiresAt = new Date(Date.now() + parseInt(product.duration));

      await TemporaryRole.create({
        serverId: guild.id,
        userId: member.id,
        roleId: role.id,
        grantedAt: new Date(),
        expiresAt: expiresAt,
        grantedBy: discordClient.user.id,
        reason: `Purchased via payment - Order: ${transaction.orderId}`,
        notified24h: false,
        notified1h: false,
        isBulkOperation: false
      });

      console.log(`✅ Created temporary role entry, expires at: ${expiresAt}`);
    }

    // Add role to user if they don't have it
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`✅ Added role ${role.name} to ${member.user.tag}`);
    }

    // Log action
    await ModerationLog.create({
      actionType: 'temprole_add',
      moderatorId: discordClient.user.id,
      targetUserId: member.id,
      roleId: role.id,
      reason: `Auto-assigned via payment - Order: ${transaction.orderId}`,
      expiryTime: expiresAt,
      additionalData: {
        orderId: transaction.orderId,
        amount: transaction.amount,
        productId: product.id,
        productName: product.name
      }
    });

    // Send DM notification to user
    try {
      const user = await discordClient.users.fetch(transaction.userId);
      const expiryTimestamp = Math.floor(expiresAt.getTime() / 1000);

      const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(transaction.amount);

      const embed = createSuccessEmbed(
        'Payment Successful - Role Assigned!',
        `Your payment has been confirmed and **${role.name}** role has been assigned to you in **${guild.name}**!`,
        [
          { name: 'Order ID', value: transaction.orderId, inline: true },
          { name: 'Amount Paid', value: formattedPrice, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Duration', value: formatDuration(product.duration), inline: true },
          { name: 'Expires', value: `<t:${expiryTimestamp}:R>`, inline: true },
          { name: 'Expires On', value: `<t:${expiryTimestamp}:F>`, inline: false }
        ]
      );

      embed.setFooter({
        text: `${guild.name} • Thank you for your purchase!`,
        iconURL: QTRADES_LOGO_URL || guild.iconURL({ dynamic: true })
      })
      .setThumbnail(QTRADES_LOGO_URL || role.iconURL() || guild.iconURL({ dynamic: true }))
      .setTimestamp(expiresAt);

      await user.send({ embeds: [embed] });
      console.log(`✅ Sent confirmation DM to ${user.tag}`);

    } catch (error) {
      console.log(`⚠️ Could not send DM to user ${transaction.userId}:`, error.message);
    }

    // Notify admin channel (optional)
    const notificationChannelId = process.env.TEMP_ROLE_NOTIFICATION_CHANNEL_ID;
    if (notificationChannelId) {
      try {
        const channel = await guild.channels.fetch(notificationChannelId);
        if (channel) {
          const user = await discordClient.users.fetch(transaction.userId);

          const formattedPrice = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
          }).format(transaction.amount);

          await channel.send({
            embeds: [createSuccessEmbed(
              '💰 New Purchase',
              `**${user.tag}** purchased **${product.name}**`,
              [
                { name: 'Order ID', value: transaction.orderId, inline: true },
                { name: 'Amount', value: formattedPrice, inline: true },
                { name: 'Role', value: `${role}`, inline: true }
              ]
            )]
          });
        }
      } catch (error) {
        console.log('⚠️ Could not send admin notification:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error processing payment success:', error);
  }
}

module.exports = {
  startWebhookServer
};
