# TODO

Reminders for future work, kept under version control so they survive
restarts and clones.

## Backup feature: switch to Google Workspace Shared Drive

**Status:** Blocked — temporarily disabled / partially functional.

**Problem.** The current backup feature uploads `pg_dump` output to a Drive
folder via the existing service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).
On free / personal Google accounts, every file uploaded by a service
account is owned by the service account itself, and service accounts on
standard Google Cloud projects do not have any Drive storage quota. As a
result, every upload fails with HTTP 403 / `storageQuotaExceeded`, even
when the destination folder is owned by the operator and shared with the
service account at Editor level.

**Why sharing the folder doesn't help.** Sharing a personal-Drive folder
with the service account grants the service account write access to that
folder, but the resulting file's storage is still charged to the file's
*owner* — which, for service-account uploads, is the service account.
The folder's owner is not consulted. The only way the bytes don't count
against the service account's (zero) quota is if the file lives inside a
**Shared Drive** (formerly "Team Drive"), which is a Workspace concept.

**The proper fix.** Move the backup destination into a Shared Drive:

1. Subscribe to Google Workspace (any tier with Drive Shared Drives —
   Business Starter is enough as of writing).
2. In the Google Admin console, create a Shared Drive (e.g.
   "QTAssist Backups").
3. Add the service account email as a member with the **Manager** role.
4. Copy the Shared Drive's ID and set `GOOGLE_BACKUP_FOLDER_ID=<id>` in
   `.env`.
5. Update `src/services/backupService.js` so every Drive call passes the
   `supportsAllDrives: true` (and where applicable `includeItemsFromAllDrives:
   true`) parameter; without those flags, googleapis silently treats the
   request as scoped to "My Drive" and Workspace returns 404 for the
   Shared Drive ID.
6. Re-test create / list / download / restore from the dashboard. Once
   verified, remove this TODO entry and update `deploy/README.md` section
   8 to point at the Shared Drive walkthrough.

**Interim workaround if Workspace is out of budget.** Switch the backup
destination to local disk (`/var/backups/qtassist/`) and keep retention +
manual download / upload restore in the dashboard, but lose the
off-site-by-default property. The dashboard UI does not need to change;
only `backupService.js` and `cronService.js` would.

## Optional next features

- "Share folder to my email" button on the dashboard (when the Shared
  Drive setup lands, this can also seed the operator with read access).
- Encryption at rest for backups (`BACKUP_ENCRYPTION_KEY` env var, AES-256
  GCM via Node's `crypto.createCipheriv`).
- A second admin user model + a "Manage admins" UI page.

## IB integration: Phase 2 — wire real Valetax API

**Status:** Phase 2 implemented (live API). Field-name mapping verified
opportunistically via heuristics; will need a 5-minute reconciliation
the first time a real client appears in the IB report.

**What is now live (`VALETAX_MODE=live`):**

- Auth via the `fx-token` request header (encoded JWT-like blob with
  `userId` / `expiredAt` / `expiration` / `prolongation`). Browser
  cookies are NOT used.
- Token decoded locally on every call so an obviously-expired token
  fails fast with a clear error before the HTTP round-trip.
- `lookupAccount` paginates through
  `POST /api.user.partnership.report.by.client.v2.getRange?skip=N&take=100`
  with a 1-year-back date window, scanning every item for a matching
  account number. Stops on first match. Tolerates several spellings
  for the account-number field (`accountNumber`, `accountId`, `account`,
  `login`, `mt5Account`, `mt4Account`, `tradingAccount`, `id`).
- `fetchAccountVolume` calls the same endpoint with `from`/`to` set to
  the start/end of one Asia/Jakarta day, and reads volume from
  `totalVolumeInLotsUsd` (with fallbacks `totalVolumeInLots`,
  `totalVolume`, `volumeLots`, `lots`).
- `testCookie` uses the cheap
  `POST /api.user.partnership.report.summaryPartnerToMib?partnerId=N`
  endpoint and 401-detects expired tokens.
- `VALETAX_DEBUG=true` logs the full request URL, body, and a 400-char
  preview of every response to console — invaluable when reconciling
  field names against a real client.
- Mock branch (default) preserved for offline development.

**What may still need attention once a real client exists:**

The summary endpoint we already saw exposes only aggregate counters
(`totalDeposit`, `totalVolumeInLotsUsd`, `numberOfClients`, etc.). The
per-client item shape inside `items[]` could not be observed because
the operator's IB list was empty during capture. The first time a
client registers and the bot calls Valetax:

1. Set `VALETAX_DEBUG=true` in `.env`, restart bot.
2. Have the user submit their broker account.
3. Look for the `LOOKUP-SAMPLE-KEYS` log line — it dumps the keys of
   the first row of the response. If the actual key for the account
   number is none of the candidates listed in `extractAccountNumber()`
   (currently `accountNumber`, `accountId`, `account`, `login`,
   `mt5Account`, `mt4Account`, `tradingAccount`, `id`), append the
   correct key to `extractAccountNumber()` in
   `src/services/valetaxService.js`.
4. Same drill for `extractVolume` if no volume registers correctly.
5. Restart bot; remove `VALETAX_DEBUG` from `.env`.

**Operator checklist for go-live:**

- [ ] Set `VALETAX_MODE=live` in `.env`
- [ ] Open Valetax IB dashboard in a browser, copy the fresh `fx-token`
      from any partnership API request's headers (DevTools → Network →
      pick any `api.user.partnership.*` request → Headers → `fx-token`)
- [ ] Web admin → **Pengaturan IB** → paste the token, set Partner ID
      (your `userId`, e.g. 895830), save
- [ ] Click **Tes token** — should report "OK"
- [ ] Have a test user (non-admin) login dashboard → wizard `/daftar-ib`
      should auto-open. Walk through Step 1 → Step 2 → Step 3.
- [ ] When the token expires (~1 h of inactivity), the dashboard's
      cookie-status badge turns red; paste a fresh token

**Known limitations to watch:**

- Token expiry is short. The bot does not auto-refresh because there
  is no documented refresh endpoint; the operator must paste in a new
  token periodically. A future improvement would be to drive a
  Playwright-based headless re-login when the token goes stale.

## Web Shop / Louvin: Follow-ups

**Status:** Phase 1 shipped (one-off purchase, 7 methods, manual + Louvin coexist).

### Nice-to-have future enhancements:

- [ ] Subscription / recurring payment via Louvin Subscription API
      (saat ini cuma QRIS via email reminder, ga seamless dengan flow kita)
- [ ] Refund flow di admin dashboard — mark cancelled + log + admin
      manual return funds (Louvin tidak punya refund API)
- [ ] Sandbox / mock mode Louvin untuk dev tanpa bayar real
      (`LOUVIN_DEV_MOCK=true` → bypass real API, fake settled events)
- [ ] HMAC signature verification kalau Louvin tambah feature itu
      (saat ini cuma path token + check-status verify)
- [ ] "Beli untuk teman" — input Discord ID lain saat checkout
- [ ] Multi-guild support — per-guild Louvin API key + project
- [ ] Payment method usage analytics di dashboard (which method paling
      sering dipakai user)
- [ ] Channel breakdown di Google Sheets sync (manual_bank vs louvin)
- [ ] `inGuild` field di /api/auth/me response (sekarang FE Shop page
      mengandalkan checkout endpoint untuk validate)
- [ ] Encryption at rest untuk QR string / VA number kalau ada compliance
      requirement (saat ini low-risk: short-lived + public-by-design)
