/**
 * Valetax IB API client.
 *
 * Phase 2 implementation. Endpoints captured from network inspection of
 * https://ma.valetaxid.com (the partner / IB dashboard at /partnership/*).
 *
 * Auth model:
 *   - Real auth is the `fx-token` request header (a Valetax-issued
 *     JWT-like blob). Browser cookies are HubSpot/analytics only and
 *     are NOT required for the API.
 *   - The token's payload encodes `userId` (= partner ID) and an `expiredAt`
 *     ISO timestamp. The token expires every ~1h with a 30 min prolongation
 *     window when the dashboard is active. For the bot we expect the
 *     operator to paste a fresh token into the admin web settings page
 *     when the previous one expires.
 *
 * Calls used:
 *   - POST /api.user.partnership.report.by.client.v2.getRange?skip=N&take=M
 *     Body: { from, to, email, isOnlyAssignedAccount, levels, refCodeId }
 *     Returns: { skip, count, items[], summary }
 *   - POST /api.user.partnership.report.summaryPartnerToMib?partnerId=N
 *     Used as a cheap auth probe.
 *
 * Set VALETAX_MODE=live in .env to flip into real-mode. VALETAX_DEBUG=true
 * dumps full request bodies and (truncated) response payloads to the bot
 * console for diagnostic.
 */

const { decryptString } = require('../utils/secrets');

const DEFAULT_BASE_URL = process.env.VALETAX_BASE_URL || 'https://ma.valetaxid.com';
const PAGE_SIZE = 100; // tuneable; Valetax accepts at least up to 100
const LOOKUP_MAX_PAGES = 50; // safety cap for pagination loops

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  'Content-Type': 'application/json',
  Origin: 'https://ma.valetaxid.com',
  Referer: 'https://ma.valetaxid.com/partnership/client',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
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

function debugLog(...args) {
  if (process.env.VALETAX_DEBUG === 'true') {
    console.log('[valetax]', ...args);
  }
}

function decryptToken(ibConfig) {
  if (!ibConfig || !ibConfig.encryptedCookie) {
    throw new ValetaxConfigError('Token Valetax (fx-token) belum dikonfigurasi di dashboard.');
  }
  const token = decryptString(ibConfig.encryptedCookie);
  if (!token || !token.trim()) {
    throw new ValetaxConfigError('Token Valetax kosong atau gagal didekripsi.');
  }
  return token.trim();
}

/**
 * Decode the fx-token JWT-like payload to verify it isn't expired locally
 * before sending the request. Saves an HTTP round-trip when the operator
 * has forgotten to refresh the token.
 *
 * Token format (observed): base64(json).base64(signature)
 * We only care about the payload's `expiredAt` and `userId`.
 */
function inspectToken(token) {
  try {
    // Find the last `.` separator. Some Valetax tokens are not standard JWTs;
    // the signature is just an opaque trailing blob.
    const dot = token.indexOf('.');
    if (dot < 0) return null;
    const payloadB64 = token.slice(0, dot)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function buildBaseUrl(ibConfig) {
  return (ibConfig?.valetaxBaseUrl && ibConfig.valetaxBaseUrl.trim()) || DEFAULT_BASE_URL;
}

async function valetaxFetch(path, { method = 'POST', token, body, query, base }) {
  const url = new URL(path, base || DEFAULT_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    ...DEFAULT_HEADERS,
    'fx-token': token
  };

  debugLog('REQ', method, url.toString());
  if (body !== undefined) debugLog('REQ-BODY', JSON.stringify(body));

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual'
    });
  } catch (error) {
    throw new Error(`Network error calling Valetax: ${error.message || error}`);
  }

  if (response.status === 302 || response.status === 303) {
    const location = response.headers.get('location') || '';
    if (/sign-in|login/i.test(location)) {
      throw new ValetaxAuthError('Token Valetax kedaluwarsa (di-redirect ke halaman login).');
    }
  }

  if (response.status === 401 || response.status === 403) {
    const text = await response.text().catch(() => '');
    throw new ValetaxAuthError(
      `Token Valetax ditolak (HTTP ${response.status}). ${text.slice(0, 200)}`
    );
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
    const data = await response.json();
    debugLog('RES', JSON.stringify(data).slice(0, 400));
    return data;
  }
  const text = await response.text();
  debugLog('RES-TEXT', text.slice(0, 300));
  return text;
}

/**
 * Iterate every page of `report.by.client.v2.getRange` between [from, to].
 * Yields { items, summary } per page. Used by lookupAccount() and
 * fetchAccountVolume(); keeps pagination logic in one place so we never
 * accidentally fetch only the first page.
 */
async function* iterateClientReport({ ibConfig, from, to, email = null }) {
  const token = decryptToken(ibConfig);
  const base = buildBaseUrl(ibConfig);

  let skip = 0;
  let total = Infinity;
  let pages = 0;

  while (skip < total && pages < LOOKUP_MAX_PAGES) {
    const data = await valetaxFetch('/api.user.partnership.report.by.client.v2.getRange', {
      method: 'POST',
      token,
      base,
      query: { skip, take: PAGE_SIZE },
      body: {
        email,
        from,
        to,
        isOnlyAssignedAccount: false,
        levels: [],
        refCodeId: null
      }
    });

    if (typeof data !== 'object' || data === null) {
      throw new Error('Valetax respons bukan objek JSON yang valid.');
    }

    total = Number(data.count || 0);
    const items = Array.isArray(data.items) ? data.items : [];
    yield { items, summary: data.summary || null, skip };

    if (items.length === 0) break;
    skip += items.length;
    pages++;
    if (skip >= total) break;
  }
}

/**
 * Pull a single field from a client item, tolerating the multiple
 * naming conventions Valetax has used historically. We accept the union
 * of plausible keys so a minor backend change doesn't silently break us.
 */
function readNumber(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function readString(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) {
      const s = String(obj[k]);
      if (s.trim()) return s.trim();
    }
  }
  return null;
}

/**
 * Heuristic: try every plausible field name an item could expose for
 * the broker account number. As of Phase 2 capture this is unknown
 * (operator's IB list was empty), so we accept several spellings.
 */
function extractAccountNumber(item) {
  const candidates = [
    item.accountNumber,
    item.accountId,
    item.account,
    item.login,
    item.mt5Account,
    item.mt4Account,
    item.tradingAccount,
    item.id
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim()) {
      return String(c).trim();
    }
  }
  return null;
}

function extractStatus(item) {
  return readString(item, 'status', 'state', 'accountStatus') || null;
}

function extractDeposit(item) {
  return readNumber(
    item,
    'totalDeposit',
    'totalDepositUsd',
    'deposit',
    'depositUsd'
  );
}

function extractVolume(item) {
  return readNumber(
    item,
    'totalVolumeInLotsUsd',
    'totalVolumeInLots',
    'totalVolume',
    'volumeLots',
    'lots'
  );
}

/**
 * Sanitize a response item for storage: copy the keys we care about plus
 * a small copy of the raw object truncated to ~1KB so admins can audit
 * without bloating the database.
 */
function snapshotItem(item) {
  if (!item || typeof item !== 'object') return null;
  const accountNumber = extractAccountNumber(item);
  return {
    accountNumber,
    email: readString(item, 'email', 'clientEmail') || null,
    status: extractStatus(item),
    totalDeposit: extractDeposit(item),
    totalVolumeInLotsUsd: extractVolume(item),
    rawSampleKeys: Object.keys(item).slice(0, 30),
    rawSample: JSON.stringify(item).slice(0, 1024)
  };
}

/**
 * Scan the IB client list for an account number.
 *
 * Strategy: page through `report.by.client.v2.getRange` with a wide date
 * window (default 1 year back) and stop as soon as we find a row whose
 * extracted account number equals our target. If we never find it, the
 * account is "not in the IB network" → `{ found: false }`.
 *
 * The same call also gives us the deposit, so we don't need a separate
 * lookup for the verification step.
 */
async function lookupAccount({ ibConfig, brokerAccountNumber }) {
  const acct = String(brokerAccountNumber || '').trim();
  if (!acct) return { found: false };

  if (process.env.VALETAX_MODE !== 'live') {
    return mockLookup(acct);
  }

  const tokenInfo = inspectToken(decryptToken(ibConfig));
  if (tokenInfo && tokenInfo.expiredAt) {
    const expired = new Date(tokenInfo.expiredAt);
    if (Number.isFinite(expired.getTime()) && expired.getTime() < Date.now()) {
      throw new ValetaxAuthError(
        `Token Valetax kedaluwarsa pada ${tokenInfo.expiredAt}. Update fx-token di Pengaturan IB.`
      );
    }
  }

  // Search from one year ago up to one day in the future to capture
  // edge cases where Valetax records "future" registrations.
  const now = new Date();
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  for await (const { items } of iterateClientReport({
    ibConfig,
    from: from.toISOString(),
    to: to.toISOString()
  })) {
    if (items.length === 0) continue;
    debugLog(`LOOKUP got ${items.length} items, searching for "${acct}"`);
    if (items.length > 0) {
      // First time we see live data: dump the first row keys to help the
      // operator reconcile field names with our heuristics.
      debugLog('LOOKUP-SAMPLE-KEYS', Object.keys(items[0]).slice(0, 40).join(','));
    }
    const match = items.find((row) => extractAccountNumber(row) === acct);
    if (match) {
      const snap = snapshotItem(match);
      return {
        found: true,
        accountNumber: snap.accountNumber,
        totalDepositUsd: snap.totalDeposit,
        status: snap.status,
        raw: snap
      };
    }
  }
  return { found: false };
}

/**
 * Fetch the volume (in USD-lots) for one account on a given calendar day.
 * Reuses report.by.client.v2.getRange with `from = startOfDay`, `to =
 * endOfDay`. Iterate just to be safe — if the IB has thousands of clients
 * the matching row may not be on page 1.
 */
async function fetchAccountVolume({ ibConfig, brokerAccountNumber, date }) {
  const acct = String(brokerAccountNumber || '').trim();
  const day = date instanceof Date ? date : new Date(date);

  if (!acct) return { volumeLots: 0, raw: null };
  if (process.env.VALETAX_MODE !== 'live') {
    return mockVolume(acct, day);
  }

  // Asia/Jakarta day window expressed in UTC ISO. We add +07:00 offset
  // by computing local 00:00:00 → 23:59:59 in WIB.
  const wibOffsetMinutes = 7 * 60;
  const localStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)
      - wibOffsetMinutes * 60 * 1000
  );
  const localEnd = new Date(localStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  for await (const { items } of iterateClientReport({
    ibConfig,
    from: localStart.toISOString(),
    to: localEnd.toISOString()
  })) {
    if (items.length === 0) continue;
    const match = items.find((row) => extractAccountNumber(row) === acct);
    if (match) {
      return {
        volumeLots: extractVolume(match),
        raw: snapshotItem(match)
      };
    }
  }
  return { volumeLots: 0, raw: null };
}

/**
 * Cheap auth probe: the partner-summary endpoint replies fast and 401s
 * when the token is bad, so we use it for the "Tes cookie" button on
 * the dashboard.
 */
async function testCookie({ ibConfig }) {
  try {
    const token = decryptToken(ibConfig);
    if (process.env.VALETAX_MODE !== 'live') {
      if (/expired/i.test(token)) {
        return { ok: false, code: 'expired', message: 'Mock: token ditandai expired' };
      }
      return { ok: true };
    }

    const tokenInfo = inspectToken(token);
    const partnerId = ibConfig.partnerId || tokenInfo?.userId;
    if (!partnerId) {
      return {
        ok: false,
        code: 'config_error',
        message: 'Partner ID belum diatur di Pengaturan IB.'
      };
    }

    const base = buildBaseUrl(ibConfig);
    await valetaxFetch('/api.user.partnership.report.summaryPartnerToMib', {
      method: 'POST',
      token,
      base,
      query: { partnerId },
      body: {}
    });
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

/* ──────────────────────────────────────────────────────────────────────
 * Phase 1 mock — kept around so VALETAX_MODE != 'live' still works for
 * local development without hitting Valetax. Same heuristics as before.
 * ────────────────────────────────────────────────────────────────────── */

function mockLookup(acct) {
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

function mockVolume(acct, day) {
  const seedString = `${acct}-${day.toISOString().slice(0, 10)}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) | 0;
  }
  const r = ((hash % 1000) + 1000) % 1000;
  const volumeLots = r < 300 ? 0 : Number(((r - 300) / 200 + 0.1).toFixed(2));
  return {
    volumeLots,
    raw: { mock: true, accountNumber: acct, date: day.toISOString().slice(0, 10), volumeLots }
  };
}

module.exports = {
  lookupAccount,
  fetchAccountVolume,
  testCookie,
  ValetaxConfigError,
  ValetaxAuthError,
  ValetaxNotFoundError,
  // exposed for tests / future tooling
  __internal: { iterateClientReport, extractAccountNumber, extractDeposit, extractVolume, snapshotItem }
};
