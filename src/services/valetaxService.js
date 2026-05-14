/**
 * Valetax IB API client.
 *
 * STATUS: Phase 1 stub. The real Valetax endpoints have not been mapped
 * yet (we will use Playwright MCP to inspect the IB dashboard's network
 * traffic and capture the exact URLs / payload shapes). Until that
 * happens, every method here returns deterministic mock data so the
 * rest of the system (Discord flow, retry cron, role removal, dashboard
 * UI) can be built and tested end-to-end.
 *
 * Phase 2 work (search this file for "[VALETAX-TODO]"):
 *   - Replace VALETAX_BASE_URL + endpoint paths with the real ones
 *   - Reshape parseAccount / parseVolume to match actual response JSON
 *   - Implement cookie staleness detection so cookieLastTestStatus is
 *     accurate
 *   - Decide if we need rate limiting / request queueing
 */

const { decryptString } = require('../utils/secrets');

// [VALETAX-TODO] Confirm the IB dashboard origin once we have it. Multiple
// candidates exist (broker.valetax.com, ib.valetax.com, my.valetax.com).
const VALETAX_BASE_URL = process.env.VALETAX_BASE_URL || 'https://my.valetax.com';

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  // [VALETAX-TODO] Replace with the User-Agent string Valetax expects.
  // Some IB dashboards reject requests that look like bots.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};

class ValetaxConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValetaxConfigError';
    this.code = 'config_error';
  }
}

class ValetaxAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValetaxAuthError';
    this.code = 'auth_error';
  }
}

class ValetaxNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValetaxNotFoundError';
    this.code = 'not_found';
  }
}

/**
 * Build the cookie header from the encrypted blob stored in IbConfig.
 * Throws ValetaxConfigError if no cookie has been saved yet.
 */
function decryptCookie(ibConfig) {
  if (!ibConfig || !ibConfig.encryptedCookie) {
    throw new ValetaxConfigError('Cookie Valetax belum dikonfigurasi di dashboard.');
  }
  const cookie = decryptString(ibConfig.encryptedCookie);
  if (!cookie || !cookie.trim()) {
    throw new ValetaxConfigError('Cookie Valetax kosong atau gagal didekripsi.');
  }
  return cookie.trim();
}

/**
 * Internal HTTP fetch wrapper. Centralized so we can later add request
 * logging, retry-on-5xx, etc. without changing call sites.
 *
 * Tagged with [VALETAX-TODO] because the request shape (cookie header
 * format, CSRF token requirement, etc.) is unknown until we capture the
 * real traffic.
 */
async function valetaxFetch(path, { method = 'GET', cookie, body, query } = {}) {
  const url = new URL(path, VALETAX_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    ...DEFAULT_HEADERS,
    Cookie: cookie
  };

  if (body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    redirect: 'manual' // surfaces 302 → /login as auth issues
  });

  // [VALETAX-TODO] Confirm exactly how Valetax indicates a stale session.
  // Common patterns: 302 to login, 401, 403, or even a 200 HTML page.
  if (response.status === 302 || response.status === 303) {
    const location = response.headers.get('location') || '';
    if (/login/i.test(location)) {
      throw new ValetaxAuthError(
        'Cookie Valetax kedaluwarsa (di-redirect ke halaman login). Update cookie di dashboard.'
      );
    }
  }
  if (response.status === 401 || response.status === 403) {
    throw new ValetaxAuthError(`Cookie Valetax ditolak (HTTP ${response.status}).`);
  }
  if (response.status === 404) {
    throw new ValetaxNotFoundError(`Endpoint tidak ditemukan: ${path}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Valetax HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

/**
 * Look up a single broker account in the IB clients list.
 *
 * @param {Object} params
 * @param {Object} params.ibConfig          IbConfig row (sequelize instance)
 * @param {string} params.brokerAccountNumber  The account number to verify
 *
 * Returns:
 *   { found: true, accountNumber, totalDepositUsd, status, raw }
 *   { found: false }
 *
 * Phase 1 mock behavior:
 *   - Account numbers ending in `99` → found, $250 deposit, active
 *   - Account numbers ending in `00` → found but only $50 deposit (below default min)
 *   - Account numbers ending in `XX` (alpha) → throws auth error to test that path
 *   - Anything else → not found
 *
 * This lets us exercise every branch of ibService without a live API.
 */
async function lookupAccount({ ibConfig, brokerAccountNumber }) {
  const cookie = decryptCookie(ibConfig);
  const acct = String(brokerAccountNumber || '').trim();
  if (!acct) {
    return { found: false };
  }

  if (process.env.VALETAX_MODE === 'live') {
    // [VALETAX-TODO] Real implementation will live here. Expected shape:
    //
    //   const data = await valetaxFetch('/api/ib/clients', {
    //     cookie,
    //     query: { search: acct, limit: 1 }
    //   });
    //   const match = (data?.items || []).find(
    //     (row) => String(row.accountNumber) === acct
    //   );
    //   if (!match) return { found: false };
    //   return {
    //     found: true,
    //     accountNumber: match.accountNumber,
    //     totalDepositUsd: Number(match.totalDeposit || 0),
    //     status: match.status,
    //     raw: sanitize(match)
    //   };
    //
    // For now, fall through so the operator gets a clear error if someone
    // flips VALETAX_MODE=live before Phase 2 ships.
    throw new ValetaxConfigError(
      'VALETAX_MODE=live tetapi integrasi real Valetax belum diimplementasikan (Phase 2).'
    );
  }

  // ─── Phase 1 mock ──────────────────────────────────────────────────
  if (/[a-z]/i.test(acct.slice(-2))) {
    throw new ValetaxAuthError('Mock: cookie expired (account ends with letters)');
  }

  if (acct.endsWith('99')) {
    return {
      found: true,
      accountNumber: acct,
      totalDepositUsd: 250,
      status: 'active',
      raw: { mock: true, accountNumber: acct, totalDeposit: 250, status: 'active' }
    };
  }
  if (acct.endsWith('00')) {
    return {
      found: true,
      accountNumber: acct,
      totalDepositUsd: 50,
      status: 'active',
      raw: { mock: true, accountNumber: acct, totalDeposit: 50, status: 'active' }
    };
  }
  return { found: false };
}

/**
 * Fetch trading volume (in lots) for an account on a given calendar date.
 *
 * Returns:
 *   { volumeLots: number, raw: object | null }
 *
 * Phase 1 mock: pseudo-random but deterministic per account/date so admins
 * can build reasonable volume charts during development. Use account
 * number + date as seed.
 */
async function fetchAccountVolume({ ibConfig, brokerAccountNumber, date }) {
  const cookie = decryptCookie(ibConfig);
  const acct = String(brokerAccountNumber || '').trim();
  const day = date instanceof Date ? date : new Date(date);
  if (!acct) return { volumeLots: 0, raw: null };

  if (process.env.VALETAX_MODE === 'live') {
    // [VALETAX-TODO] Real implementation:
    //
    //   const data = await valetaxFetch('/api/ib/volume', {
    //     cookie,
    //     query: {
    //       account: acct,
    //       from: day.toISOString().slice(0, 10),
    //       to: day.toISOString().slice(0, 10)
    //     }
    //   });
    //   const volume = Number(data?.totalLots || 0);
    //   return { volumeLots: volume, raw: sanitize(data) };
    //
    throw new ValetaxConfigError(
      'VALETAX_MODE=live tetapi integrasi real Valetax belum diimplementasikan (Phase 2).'
    );
  }

  // ─── Phase 1 mock ──────────────────────────────────────────────────
  // Deterministic pseudo-random 0..3 lots per day using simple hash.
  const seedString = `${acct}-${day.toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) | 0;
  }
  const r = ((hash % 1000) + 1000) % 1000; // 0..999
  // 30% chance of zero, otherwise 0.1..3 lots
  const volumeLots = r < 300 ? 0 : Number(((r - 300) / 200 + 0.1).toFixed(2));

  return {
    volumeLots,
    raw: { mock: true, accountNumber: acct, date: day.toISOString().slice(0, 10), volumeLots }
  };
}

/**
 * Lightweight cookie sanity check. Fetch any cheap endpoint just to see
 * whether the session is still valid. Returns one of:
 *   { ok: true }
 *   { ok: false, code: 'expired' | 'error' | 'config_error', message }
 */
async function testCookie({ ibConfig }) {
  try {
    const cookie = decryptCookie(ibConfig);
    if (process.env.VALETAX_MODE === 'live') {
      // [VALETAX-TODO] Replace with a cheap endpoint such as
      // /api/me or /api/ib/dashboard.
      await valetaxFetch('/api/me', { cookie });
      return { ok: true };
    }
    // Mock: cookies that contain "expired" → reject; everything else passes.
    if (/expired/i.test(cookie)) {
      return { ok: false, code: 'expired', message: 'Mock: cookie ditandai expired' };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ValetaxAuthError) {
      return { ok: false, code: 'expired', message: error.message };
    }
    if (error instanceof ValetaxConfigError) {
      return { ok: false, code: 'config_error', message: error.message };
    }
    return { ok: false, code: 'error', message: error.message || String(error) };
  }
}

module.exports = {
  lookupAccount,
  fetchAccountVolume,
  testCookie,
  ValetaxConfigError,
  ValetaxAuthError,
  ValetaxNotFoundError
};
