/**
 * Database backup service: pg_dump → gzip → Google Drive.
 *
 * Uses the same Google service account that powers Drive auto-share so the
 * operator does not need to manage a separate credential. The backup folder
 * is auto-created on first use.
 *
 * Backups are SQL dumps in pg_dump's plain "custom-options" plain SQL format
 * compressed with gzip. Restore is `gunzip` + `psql`. Both pg_dump and psql
 * must be installed on the host (apt install postgresql-client on Debian).
 */

const { spawn } = require('child_process');
const { Readable, PassThrough } = require('stream');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getGoogleDriveClient } = require('./googleDriveService');

const BACKUP_FOLDER_NAME = 'QTAssist Backups';
let cachedFolderId = null;

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    name: process.env.DB_NAME || 'qtassist_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  };
}

function buildPgEnv() {
  const cfg = getDbConfig();
  return {
    ...process.env,
    PGHOST: cfg.host,
    PGPORT: String(cfg.port),
    PGDATABASE: cfg.name,
    PGUSER: cfg.user,
    PGPASSWORD: cfg.password
  };
}

/**
 * Resolve the Drive folder for backup uploads.
 *
 * Order of resolution:
 *   1. GOOGLE_BACKUP_FOLDER_ID env var if set — used directly. The folder
 *      must be owned by a regular Google account (not the service account)
 *      and shared with the service account email with Editor access. This
 *      is the recommended setup because Google service accounts do not
 *      have their own Drive storage quota.
 *   2. Auto-create / find a "QTAssist Backups" folder owned by the service
 *      account. Only works if the service account has access to a Shared
 *      Drive or has been granted storage via Workspace; on regular Google
 *      Cloud projects this fails with "storageQuotaExceeded".
 */
async function ensureBackupFolder() {
  if (cachedFolderId) return cachedFolderId;

  const client = getGoogleDriveClient();
  if (!client) {
    throw new Error('Google Drive belum dikonfigurasi (cek GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY)');
  }
  const { drive } = client;

  const explicitFolderId = process.env.GOOGLE_BACKUP_FOLDER_ID;
  if (explicitFolderId) {
    // Verify it's reachable. If the service account hasn't been granted
    // Editor access, this will throw with a 404, which is a much better
    // failure mode than uploading and finding out later.
    try {
      await drive.files.get({
        fileId: explicitFolderId,
        fields: 'id, name, mimeType, capabilities'
      });
    } catch (error) {
      throw new Error(
        `Folder backup (GOOGLE_BACKUP_FOLDER_ID=${explicitFolderId}) tidak ditemukan atau service account belum di-share. ` +
        `Pastikan folder di-share ke ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} dengan akses Editor.`
      );
    }
    cachedFolderId = explicitFolderId;
    return cachedFolderId;
  }

  // Search existing folder owned by the service account
  const query = [
    `name = '${BACKUP_FOLDER_NAME.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `'me' in owners`,
    `trashed = false`
  ].join(' and ');

  const search = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (search.data.files && search.data.files.length > 0) {
    cachedFolderId = search.data.files[0].id;
    return cachedFolderId;
  }

  // Create — only succeeds if the service account has storage quota,
  // which standard service accounts on regular Google Cloud projects do
  // not. The error from Google is "storageQuotaExceeded".
  try {
    const created = await drive.files.create({
      requestBody: {
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    cachedFolderId = created.data.id;
    return cachedFolderId;
  } catch (error) {
    if (error?.errors?.[0]?.reason === 'storageQuotaExceeded' || /storageQuotaExceeded/i.test(error.message || '')) {
      throw new Error(
        'Service account tidak punya quota Drive. Buat folder di Drive personal kamu, share ke ' +
        `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (akses Editor), lalu set GOOGLE_BACKUP_FOLDER_ID=<folder id> ` +
        'di .env dan restart bot.'
      );
    }
    throw error;
  }
}

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatBackupName(prefix = 'qtassist') {
  // Use Asia/Jakarta date for filename so admins can read it at a glance.
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const stamp = `${wib.getUTCFullYear()}${pad(wib.getUTCMonth() + 1)}${pad(wib.getUTCDate())}-${pad(
    wib.getUTCHours()
  )}${pad(wib.getUTCMinutes())}${pad(wib.getUTCSeconds())}`;
  return `${prefix}-${stamp}.sql.gz`;
}

/**
 * Run pg_dump and stream the gzipped output through `consumer` (which gets
 * a Readable stream). Resolves with { bytes, durationMs }.
 */
async function streamPgDumpGzip(consumer) {
  const start = Date.now();
  const cfg = getDbConfig();

  const pgDump = spawn(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--clean', '--if-exists', cfg.name],
    {
      env: buildPgEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  let stderrBuf = '';
  pgDump.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
  });

  const gz = zlib.createGzip({ level: 6 });
  let bytes = 0;
  const counter = new PassThrough();
  counter.on('data', (chunk) => {
    bytes += chunk.length;
  });

  // Compose: pg_dump.stdout -> gzip -> counter -> consumer
  pgDump.stdout.pipe(gz).pipe(counter);

  const exitPromise = new Promise((resolve, reject) => {
    pgDump.on('error', reject);
    pgDump.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}: ${stderrBuf.trim().slice(0, 500)}`));
    });
  });

  // Hand the readable stream off to the consumer; await both.
  const consumePromise = consumer(counter);

  await Promise.all([exitPromise, consumePromise]);
  return { bytes, durationMs: Date.now() - start, stderr: stderrBuf };
}

/**
 * Create a backup and upload to Drive. Returns the Drive file metadata.
 *
 * @param {Object} opts
 * @param {string} [opts.note]   Optional human-readable note saved as Drive file description.
 * @param {string} [opts.source] 'manual' | 'cron'. Stored in description for audit.
 */
async function createBackup({ note, source = 'manual' } = {}) {
  const folderId = await ensureBackupFolder();
  const client = getGoogleDriveClient();
  const { drive } = client;

  const filename = formatBackupName();

  let driveFileId = null;
  let driveMeta = null;
  let bytes = 0;
  let durationMs = 0;

  await streamPgDumpGzip(async (stream) => {
    const upload = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        description: JSON.stringify({
          source,
          note: note || null,
          createdAt: new Date().toISOString(),
          dbName: getDbConfig().name
        })
      },
      media: {
        mimeType: 'application/gzip',
        body: stream
      },
      fields: 'id, name, size, createdTime, description, modifiedTime'
    });
    driveFileId = upload.data.id;
    driveMeta = upload.data;
  });

  const result = await streamPgDumpInfo(driveMeta);
  bytes = result.bytes;
  durationMs = result.durationMs;

  return {
    id: driveFileId,
    name: driveMeta.name,
    size: driveMeta.size ? Number(driveMeta.size) : bytes,
    createdAt: driveMeta.createdTime,
    description: parseDescription(driveMeta.description),
    durationMs
  };
}

/**
 * Used to merge the pg_dump stats (which we measure locally) with the Drive
 * file metadata returned from the upload. Drive `size` is authoritative once
 * the upload completes; we keep `bytes` only as a fallback in case Drive
 * does not return it immediately.
 */
async function streamPgDumpInfo(driveMeta) {
  return {
    bytes: driveMeta?.size ? Number(driveMeta.size) : 0,
    durationMs: 0
  };
}

function parseDescription(description) {
  if (!description) return null;
  try {
    return JSON.parse(description);
  } catch {
    return { raw: description };
  }
}

/**
 * List all backup files in the QTAssist Backups folder, newest first.
 */
async function listBackups({ pageSize = 100 } = {}) {
  const folderId = await ensureBackupFolder();
  const client = getGoogleDriveClient();
  const { drive } = client;

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size, createdTime, description, modifiedTime)',
    orderBy: 'createdTime desc',
    pageSize
  });

  return (res.data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size ? Number(f.size) : 0,
    createdAt: f.createdTime,
    modifiedAt: f.modifiedTime,
    description: parseDescription(f.description)
  }));
}

/**
 * Permanently delete a backup file from Drive.
 */
async function deleteBackup(fileId) {
  const client = getGoogleDriveClient();
  const { drive } = client;
  await drive.files.delete({ fileId });
}

/**
 * Stream the gzipped backup contents from Drive. Returns the raw Readable.
 */
async function streamBackup(fileId) {
  const client = getGoogleDriveClient();
  const { drive } = client;
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data; // readable stream of gzipped sql
}

/**
 * Restore a backup by streaming gzip → gunzip → psql. Drops the existing
 * database content (pg_dump --clean --if-exists in createBackup ensures the
 * generated SQL drops all known objects before recreating them).
 *
 * Returns { durationMs, stderr }. Throws on non-zero psql exit.
 */
async function restoreBackupFromDrive(fileId) {
  const start = Date.now();
  const cfg = getDbConfig();
  const client = getGoogleDriveClient();
  const { drive } = client;

  const driveStream = (await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  )).data;

  const psql = spawn(
    'psql',
    ['--quiet', '--no-psqlrc', '-d', cfg.name],
    {
      env: buildPgEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );

  let stderrBuf = '';
  psql.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
  });

  const gunzip = zlib.createGunzip();

  driveStream.on('error', (err) => {
    psql.stdin.destroy(err);
  });

  // Pipeline: drive → gunzip → psql.stdin
  const pipePromise = pipeline(driveStream, gunzip, psql.stdin);

  const exitPromise = new Promise((resolve, reject) => {
    psql.on('error', reject);
    psql.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exited with code ${code}: ${stderrBuf.trim().slice(0, 1000)}`));
    });
  });

  await Promise.all([pipePromise, exitPromise]);

  return {
    durationMs: Date.now() - start,
    stderr: stderrBuf
  };
}

/**
 * Restore a backup uploaded directly from the dashboard (Buffer in memory).
 * Used when the admin chooses "Upload .sql.gz then restore".
 */
async function restoreBackupFromBuffer(buffer) {
  const start = Date.now();
  const cfg = getDbConfig();

  const psql = spawn(
    'psql',
    ['--quiet', '--no-psqlrc', '-d', cfg.name],
    {
      env: buildPgEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );

  let stderrBuf = '';
  psql.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
  });

  const source = Readable.from(buffer);
  const gunzip = zlib.createGunzip();

  const pipePromise = pipeline(source, gunzip, psql.stdin);
  const exitPromise = new Promise((resolve, reject) => {
    psql.on('error', reject);
    psql.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exited with code ${code}: ${stderrBuf.trim().slice(0, 1000)}`));
    });
  });

  await Promise.all([pipePromise, exitPromise]);

  return {
    durationMs: Date.now() - start,
    stderr: stderrBuf
  };
}

/**
 * Apply retention policy: keep latest N daily backups + latest M monthly
 * (the first backup of each calendar month).
 *
 * Defaults: 30 daily + 12 monthly = up to ~42 files retained.
 */
async function pruneOldBackups({ keepDaily = 30, keepMonthly = 12 } = {}) {
  const backups = await listBackups({ pageSize: 1000 });
  if (!backups.length) return { kept: 0, deleted: 0 };

  const sorted = [...backups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const keepIds = new Set();

  // 30 newest daily
  sorted.slice(0, keepDaily).forEach((b) => keepIds.add(b.id));

  // 12 newest "first backup of each month"
  const seenMonths = new Map();
  for (const b of sorted) {
    const d = new Date(b.createdAt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!seenMonths.has(key)) {
      seenMonths.set(key, b.id);
    }
  }
  Array.from(seenMonths.values()).slice(0, keepMonthly).forEach((id) => keepIds.add(id));

  let deleted = 0;
  for (const b of sorted) {
    if (keepIds.has(b.id)) continue;
    try {
      await deleteBackup(b.id);
      deleted++;
    } catch (err) {
      console.warn(`Could not delete old backup ${b.name}: ${err.message}`);
    }
  }

  return { kept: keepIds.size, deleted };
}

module.exports = {
  ensureBackupFolder,
  createBackup,
  listBackups,
  deleteBackup,
  streamBackup,
  restoreBackupFromDrive,
  restoreBackupFromBuffer,
  pruneOldBackups,
  formatBackupName
};
