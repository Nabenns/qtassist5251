/**
 * Thin wrapper around the Louvin Payment Gateway HTTP API.
 *
 * Single responsibility: call API + parse response. No business logic.
 * Caller decides what to do with the result.
 *
 * Reads LOUVIN_API_KEY at call time (not module load) so hot-reload works.
 *
 * Default timeout: 10 seconds.
 *
 * Errors: throws LouvinError with `code` and optional `details`.
 */

const LOUVIN_BASE_URL = 'https://api.louvin.dev';
const DEFAULT_TIMEOUT_MS = 10_000;

class LouvinError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'LouvinError';
    this.code = code;
    this.details = details;
  }
}

function getApiKey() {
  const key = process.env.LOUVIN_API_KEY;
  if (!key) throw new LouvinError('config_missing', 'LOUVIN_API_KEY not set');
  return key;
}

async function louvinFetch(path, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${LOUVIN_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // non-JSON response
    }
    if (!res.ok || !data?.success) {
      throw new LouvinError(
        'gateway_error',
        data?.error || `Louvin returned ${res.status}`,
        data
      );
    }
    return data;
  } catch (err) {
    if (err instanceof LouvinError) throw err;
    if (err.name === 'AbortError') {
      throw new LouvinError('network_error', 'Louvin API timeout');
    }
    throw new LouvinError('network_error', err.message || 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /create-transaction
 * @param {Object} params
 * @param {number} params.amount - merchant net (IDR), kita pakai harga produk
 * @param {string} params.paymentType - qris, gopay, shopeepay, bni_va, ...
 * @param {string} params.customerName
 * @param {string} [params.customerEmail]
 * @param {string} [params.description]
 * @param {string} params.reference - our orderId
 * @returns {Promise<{ transaction, payment }>}
 */
async function createLouvinTransaction({
  amount,
  paymentType,
  customerName,
  customerEmail,
  description,
  reference
}) {
  const data = await louvinFetch('/create-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey()
    },
    body: JSON.stringify({
      amount,
      payment_type: paymentType,
      customer_name: customerName,
      customer_email: customerEmail,
      description,
      reference
    })
  });
  return { transaction: data.transaction, payment: data.payment };
}

/**
 * GET /check-status?id=...
 * @param {string} transactionId - UUID dari Louvin
 */
async function checkLouvinStatus(transactionId) {
  if (!transactionId) {
    throw new LouvinError('invalid_argument', 'transactionId required');
  }
  const data = await louvinFetch(
    `/check-status?id=${encodeURIComponent(transactionId)}`,
    {
      method: 'GET',
      headers: { 'x-api-key': getApiKey() }
    }
  );
  return { transaction: data.transaction };
}

module.exports = {
  createLouvinTransaction,
  checkLouvinStatus,
  LouvinError
};
