const express = require('express');
const { requireAuth } = require('../middleware');
const {
  createBackup,
  listBackups,
  deleteBackup,
  streamBackup,
  restoreBackupFromDrive,
  restoreBackupFromBuffer,
  pruneOldBackups
} = require('../../services/backupService');
const { emitEvent } = require('../../services/eventBus');

const RESTORE_FILE_LIMIT = 200 * 1024 * 1024; // 200 MB upper bound for safety

function buildRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const items = await listBackups({ pageSize: 200 });
      res.json({ items });
    } catch (error) {
      console.error('GET /api/backups error:', error);
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { note } = req.body || {};
      const result = await createBackup({ note, source: 'manual' });
      emitEvent('backup.created', {
        id: result.id,
        name: result.name,
        size: result.size,
        source: 'manual',
        adminUsername: req.adminUser.username
      });
      res.status(201).json({ ok: true, backup: result });
    } catch (error) {
      console.error('POST /api/backups error:', error);
      res.status(500).json({ error: 'backup_failed', message: error.message });
    }
  });

  router.get('/:id/download', async (req, res) => {
    try {
      const items = await listBackups({ pageSize: 200 });
      const meta = items.find((b) => b.id === req.params.id);
      if (!meta) {
        return res.status(404).json({ error: 'not_found' });
      }
      const stream = await streamBackup(req.params.id);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${meta.name.replace(/"/g, '')}"`
      );
      stream.on('error', (err) => {
        console.error('Drive stream error:', err);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('GET /api/backups/:id/download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error', message: error.message });
      }
    }
  });

  router.post('/:id/restore', async (req, res) => {
    try {
      // Acknowledge intent: the SPA must send `confirm: 'yes-restore'` so a
      // misbehaving fetch can never trigger a wipe by accident.
      if (!req.body || req.body.confirm !== 'yes-restore') {
        return res.status(400).json({ error: 'confirmation_required' });
      }

      console.log(
        `🛠 Web admin "${req.adminUser.username}" started restore of backup ${req.params.id}`
      );

      const result = await restoreBackupFromDrive(req.params.id);

      console.log(
        `✅ Restore done in ${result.durationMs}ms by ${req.adminUser.username}`
      );

      emitEvent('backup.restored', {
        id: req.params.id,
        durationMs: result.durationMs,
        adminUsername: req.adminUser.username
      });

      res.json({ ok: true, durationMs: result.durationMs });
    } catch (error) {
      console.error('POST /api/backups/:id/restore error:', error);
      res.status(500).json({ error: 'restore_failed', message: error.message });
    }
  });

  router.post('/restore-upload', express.raw({ type: 'application/octet-stream', limit: RESTORE_FILE_LIMIT }), async (req, res) => {
    try {
      if (req.headers['x-confirm'] !== 'yes-restore') {
        return res.status(400).json({ error: 'confirmation_required' });
      }
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'empty_body' });
      }

      console.log(
        `🛠 Web admin "${req.adminUser.username}" started restore from uploaded ${(
          req.body.length / 1024 /
          1024
        ).toFixed(1)}MB file`
      );

      const result = await restoreBackupFromBuffer(req.body);

      console.log(
        `✅ Upload restore done in ${result.durationMs}ms by ${req.adminUser.username}`
      );

      emitEvent('backup.restored', {
        source: 'upload',
        durationMs: result.durationMs,
        adminUsername: req.adminUser.username
      });

      res.json({ ok: true, durationMs: result.durationMs });
    } catch (error) {
      console.error('POST /api/backups/restore-upload error:', error);
      res.status(500).json({ error: 'restore_failed', message: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await deleteBackup(req.params.id);
      emitEvent('backup.deleted', {
        id: req.params.id,
        adminUsername: req.adminUser.username
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/backups/:id error:', error);
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  router.post('/prune', async (req, res) => {
    try {
      const result = await pruneOldBackups();
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('POST /api/backups/prune error:', error);
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  });

  return router;
}

module.exports = buildRouter;
