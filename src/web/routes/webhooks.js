/**
 * Louvin webhook receiver.
 *
 * Defense in depth:
 *  1. Path token must match LOUVIN_WEBHOOK_TOKEN (constant-time compare)
 *  2. Server-to-server check-status to verify event payload not spoofed
 *  3. Idempotent — already-final transactions return 200 no-op
 *
 * Always returns 200 on successful processing or no-op.
 * Returns 4xx only for genuine bad input (Louvin will retry).
 */

const crypto = require('crypto');
const express = require('express');
const { Transaction } = require('../../database/models');
const { checkLouvinStatus, LouvinError } = require('../../services/louvinService');
const { approveTransaction } = require('../../services/transactionService');
const { emitEvent } = require('../../services/eventBus');

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function buildRouter({ getDiscordClient }) {
  const router = express.Router();

  router.post('/louvin/:token', async (req, res) => {
    // 1. Path token check (404 to obscure existence)
    const expected = process.env.LOUVIN_WEBHOOK_TOKEN;
    if (!expected || !constantTimeEqual(req.params.token, expected)) {
      return res.status(404).json({ error: 'not_found' });
    }

    // 2. Validate payload shape
    const { event, data } = req.body || {};
    if (!event || !data || !data.transaction_id) {
      return res.status(400).json({ error: 'invalid_payload' });
    }

    // 3. Verify ke Louvin (defense in depth)
    let verified;
    try {
      verified = await checkLouvinStatus(data.transaction_id);
    } catch (err) {
      console.error('Webhook verify failed:', err.code || err.message);
      // 502 → Louvin will retry. Don't 4xx an outage.
      return res.status(502).json({ error: 'verify_failed' });
    }

    // 4. Find local transaction
    const trx = await Transaction.findOne({
      where: { louvinTransactionId: data.transaction_id }
    });
    if (!trx) {
      console.warn(`Webhook for unknown louvin_transaction_id ${data.transaction_id}`);
      return res.status(404).json({ error: 'not_found' });
    }

    // 5. Idempotency: if already final, no-op
    if (['approved', 'rejected', 'expired', 'cancelled'].includes(trx.status)) {
      console.log(`Webhook idempotent no-op for ${trx.orderId} (status=${trx.status})`);
      return res.status(200).json({ received: true, idempotent: true });
    }

    // 6. Dispatch
    const client = getDiscordClient();
    try {
      if (verified.transaction.status === 'settled') {
        if (!client) {
          // Defer: bot not ready. Louvin will retry. Don't mark approved
          // because role grant requires Discord client.
          return res.status(503).json({ error: 'bot_not_ready' });
        }
        const result = await approveTransaction({
          client,
          orderId: trx.orderId,
          reviewerId: 'system:louvin',
          reviewerLabel: `louvin:webhook:${data.transaction_id}`
        });
        if (!result.ok) {
          console.error(`approveTransaction failed for ${trx.orderId}:`, result.code, result.message);
          // Still return 200 to Louvin; admin can recover via dashboard.
          return res.status(200).json({ received: true, approved: false, code: result.code });
        }
        return res.status(200).json({ received: true, approved: true });
      }

      if (verified.transaction.status === 'failed') {
        await trx.update({ status: 'expired' });
        emitEvent('transaction.failed', {
          orderId: trx.orderId,
          userId: trx.userId,
          serverId: trx.serverId,
          reason: 'louvin_failed'
        });
        return res.status(200).json({ received: true, status: 'expired' });
      }

      // Pending or unknown — accept silently.
      return res.status(200).json({ received: true, status: verified.transaction.status });
    } catch (err) {
      console.error('Webhook dispatch error:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return router;
}

module.exports = buildRouter;
