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

**Status:** Phase 1 complete (foundation). Phase 2 blocked on Playwright
MCP investigation.

**What Phase 1 ships:**

- Database models `IbConfig`, `IbAccount`, `IbVolumeRecord`
- Encrypted-cookie helper (`src/utils/secrets.js`, AES-256-GCM keyed off
  `JWT_SECRET`)
- Discord `/ib-setup` admin command + button + modal flow that captures
  the broker account number
- Cron jobs:
  - Every minute: process the IB verification queue (re-runs
    `valetaxService.lookupAccount` for any `pending` row that has come
    due based on `retryIntervalMinutes`)
  - Every 04:00 WIB: sample daily trading volume, advance
    `consecutiveZeroVolumeDays`, and revoke the IB role once the count
    reaches `volumeGraceDays`
- Web admin pages:
  - **Pengaturan IB** — toggle, role/channel pickers, retry settings,
    deposit / volume thresholds, encrypted cookie editor, cookie
    sanity-check button
  - **Akun IB** — list with status filters, detail modal with volume
    history, manual re-verify, manual role removal
- REST API under `/api/ib/*`
- Audit log entries for `ib_verified`, `ib_failed`, `ib_role_removed`

**What is stubbed:**

`src/services/valetaxService.js` returns deterministic mock data so all
flows above can be exercised end-to-end. Specifically:

- Account number ending with `99` → "found", USD 250 deposit, active
- Ending with `00` → found but only USD 50 (below default min)
- Ending with two letters → throws `ValetaxAuthError` (mocks expired cookie)
- Anything else → not found
- Volume per day is deterministic pseudo-random 0..3 lots (30% chance of zero)

Run with `VALETAX_MODE=` (default) for mock; `VALETAX_MODE=live` is set
aside for Phase 2.

**Phase 2 plan (after Playwright MCP is installed):**

1. Use Playwright MCP to log into a Valetax IB dashboard and capture:
   - Cookie domain + name(s)
   - Endpoint URL for the IB clients listing (likely a JSON XHR)
   - Endpoint URL for the per-account daily volume report
   - Exact JSON shapes of both responses
2. Update `src/services/valetaxService.js`:
   - Set `VALETAX_BASE_URL` to the right origin (search for [VALETAX-TODO])
   - Replace mock branches under `process.env.VALETAX_MODE === 'live'`
   - Map response fields into the `{ found, accountNumber, totalDepositUsd,
     status, raw }` and `{ volumeLots, raw }` shapes already used by
     `ibService`
   - Implement a real `testCookie` against a cheap endpoint (likely
     `/api/me` equivalent)
   - Confirm staleness detection: redirect to `/login`, 401, 403, or some
     other shape — the existing code handles all four but the chosen
     branch should match real-world behavior
3. Set `VALETAX_MODE=live` in `.env`, run a small set of registrations
   end-to-end on a staging guild, verify role grant + role revoke flows.
4. Document any per-environment quirks in this file before removing it.

No changes to `ibService` or the dashboard pages should be needed for
Phase 2 — they only call into the public surface of `valetaxService`.
