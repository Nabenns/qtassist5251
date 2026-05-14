const express = require('express');
const { bus } = require('../../services/eventBus');
const { readAuthCookie, verifyToken } = require('../auth');

/**
 * GET /api/events
 *
 * Server-Sent Events stream. EventSource doesn't let us attach Authorization
 * headers but cookies are sent by default, so we authenticate via the JWT
 * cookie just like the rest of the API.
 *
 * Emits:
 *   - "ping"   every 25s to keep proxies (nginx default 60s timeout) happy
 *   - "event"  whenever something interesting happens server-side
 *              (transaction.pending_review, transaction.approved,
 *               transaction.rejected, role_claimed, etc.)
 */

function buildRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    const token = readAuthCookie(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload || !payload.adminId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable nginx's response buffering for this endpoint specifically.
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    function send(eventName, data) {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Initial hello so the client knows the connection is alive
    send('hello', {
      timestamp: new Date().toISOString(),
      admin: { id: payload.adminId, username: payload.username || null }
    });

    const onEvent = (evt) => {
      try {
        send('event', evt);
      } catch (err) {
        console.error('SSE write failed:', err);
      }
    };

    bus.on('event', onEvent);

    const ping = setInterval(() => {
      try {
        send('ping', { t: Date.now() });
      } catch (_) {
        clearInterval(ping);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(ping);
      bus.off('event', onEvent);
    });
  });

  return router;
}

module.exports = buildRouter;
