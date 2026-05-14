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
