/**
 * Tiny in-process event bus for SSE notifications to the admin dashboard.
 *
 * The bot emits events here (e.g. when a user uploads a payment proof
 * and the transaction flips to pending_review). The web SSE endpoint
 * subscribes and pushes them to all connected admins.
 *
 * No persistence — events that arrive while no client is listening are
 * dropped. The dashboard refetches its data on every SSE event anyway.
 */

const { EventEmitter } = require('events');

class AdminEventBus extends EventEmitter {}

const bus = new AdminEventBus();
// Allow many SSE listeners without warning (one per dashboard tab open).
bus.setMaxListeners(100);

function emitEvent(type, payload = {}) {
  bus.emit('event', {
    type,
    timestamp: new Date().toISOString(),
    ...payload
  });
}

module.exports = {
  bus,
  emitEvent
};
