/**
 * Discord OAuth2 helper.
 *
 * We only need the `identify` scope to know who the user is — guild role
 * membership is checked through the bot client (which is already in the
 * guild) rather than through OAuth's `guilds.members.read`. That way the
 * bot keeps a single source of truth and the OAuth scope stays minimal.
 *
 * Required env:
 *   DISCORD_CLIENT_ID         (already set, used by bot too)
 *   DISCORD_CLIENT_SECRET     (new — from Discord Developer Portal)
 *   DASHBOARD_BASE_URL        (new — e.g. https://qtrades.bensserver.cloud)
 *
 * The redirect URI is derived deterministically as:
 *   `${DASHBOARD_BASE_URL}/api/auth/discord/callback`
 * Operator must register that exact URL in the Discord application's
 * "Redirects" tab.
 */

const DISCORD_API = 'https://discord.com/api';
const DISCORD_OAUTH = `${DISCORD_API}/oauth2`;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Environment variable ${name} is required for Discord OAuth.`);
  }
  return String(v).trim();
}

function getRedirectUri() {
  const base = requireEnv('DASHBOARD_BASE_URL').replace(/\/$/, '');
  return `${base}/api/auth/discord/callback`;
}

function getClientId() {
  return requireEnv('DISCORD_CLIENT_ID');
}

function getClientSecret() {
  return requireEnv('DISCORD_CLIENT_SECRET');
}

/**
 * Build the URL to send the user to Discord for authorization.
 *
 * @param {string} state CSRF / return-path token (opaque to Discord)
 */
function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'identify',
    prompt: 'none',
    state
  });
  return `${DISCORD_OAUTH}/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 * Returns the parsed token response (we only use it to fetch /users/@me;
 * we do NOT persist the token because we don't need a long-lived
 * Discord-on-behalf-of-user session).
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri()
  });

  const resp = await fetch(`${DISCORD_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`Discord token exchange returned non-JSON (${resp.status}): ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    const msg = data?.error_description || data?.error || `HTTP ${resp.status}`;
    throw new Error(`Discord token exchange failed: ${msg}`);
  }
  return data;
}

/**
 * Fetch the current user's Discord profile using a bearer access token.
 */
async function fetchCurrentUser(accessToken) {
  const resp = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`Discord /users/@me returned non-JSON (${resp.status}): ${text.slice(0, 200)}`);
  }
  if (!resp.ok) {
    const msg = data?.message || `HTTP ${resp.status}`;
    throw new Error(`Discord /users/@me failed: ${msg}`);
  }
  return data;
}

function isConfigured() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DASHBOARD_BASE_URL
  );
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCode,
  fetchCurrentUser,
  getRedirectUri,
  isConfigured
};
