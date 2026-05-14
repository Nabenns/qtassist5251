import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Calendar,
  HardDrive
} from 'lucide-react';
import { api, ApiError, formatDateTime } from '../api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField, Textarea } from '../components/ui/Input.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '../components/ui/Modal.jsx';
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableLoading,
  TableEmpty
} from '../components/ui/Table.jsx';
import { useRealtimeEvent } from '../lib/realtime.jsx';

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function Backups() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createNote, setCreateNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/backups');
      setItems(res.items || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar backup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent(['backup.created', 'backup.deleted'], () => {
    load();
  });

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await api.post('/api/backups', {
        note: createNote.trim() || undefined
      });
      toast.success('Backup dibuat', {
        description: res.backup?.name || 'File ter-upload ke Google Drive.'
      });
      setCreateNote('');
      load();
    } catch (err) {
      toast.error('Gagal membuat backup', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    try {
      await api.delete(`/api/backups/${confirmDelete.id}`);
      toast.success('Backup dihapus');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error('Gagal menghapus', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    }
  }

  function handleDownload(backup) {
    // Browser akan handle redirect/download via Express stream.
    window.location.href = `/api/backups/${backup.id}/download`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup Database"
        description="Backup otomatis ke Google Drive setiap hari pukul 03:00 WIB. Bisa juga backup manual atau restore dari sini."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              loading={loading}
              onClick={load}
            >
              Muat ulang
            </Button>
            <Button
              variant="secondary"
              leadingIcon={Upload}
              onClick={() => setUploadOpen(true)}
            >
              Restore dari file
            </Button>
            <Button
              leadingIcon={Plus}
              loading={creating}
              onClick={handleCreate}
            >
              Backup sekarang
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Peringatan restore</div>
            <p className="mt-0.5 text-warning/90">
              Tombol <span className="font-medium">Restore</span> akan menghapus dan menimpa
              seluruh data database saat ini dengan isi backup yang dipilih. Pastikan kamu
              backup dulu data terbaru sebelum restore. Operasi ini tidak bisa dibatalkan.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Tambahan catatan untuk backup manual (opsional)"
          description="Catatan ini disimpan sebagai metadata di file backup (misalnya: 'Sebelum migrate', 'Pre-launch')."
        />
        <CardBody>
          <FormField>
            <Textarea
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
              placeholder="Catatan opsional untuk backup berikutnya..."
              rows={2}
            />
          </FormField>
        </CardBody>
      </Card>

      {error ? (
        <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Riwayat Backup"
          description={`${items.length} file di Google Drive · Auto-cleanup: simpan 30 backup harian + 12 backup bulanan.`}
        />
        <DataTable>
          <THead>
            <TR>
              <TH>Nama File</TH>
              <TH>Sumber</TH>
              <TH>Ukuran</TH>
              <TH>Dibuat</TH>
              <TH>Catatan</TH>
              <TH align="right"></TH>
            </TR>
          </THead>
          {loading ? (
            <TableLoading columns={6} rows={5} />
          ) : items.length === 0 ? (
            <TableEmpty
              columns={6}
              icon={Database}
              title="Belum ada backup"
              description="Klik 'Backup sekarang' untuk membuat backup pertama."
              action={<Button leadingIcon={Plus} onClick={handleCreate} loading={creating}>Backup sekarang</Button>}
            />
          ) : (
            <TBody>
              {items.map((b) => {
                const desc = b.description || {};
                return (
                  <TR key={b.id}>
                    <TD>
                      <div className="font-mono text-xs text-fg">{b.name}</div>
                      <div className="text-[11px] text-muted-fg">ID: {b.id}</div>
                    </TD>
                    <TD>
                      {desc.source === 'cron' ? (
                        <Badge tone="info" dot>
                          Otomatis
                        </Badge>
                      ) : (
                        <Badge tone="primary" dot>
                          Manual
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1 text-fg">
                        <HardDrive className="h-3.5 w-3.5 text-muted-fg" />
                        {formatBytes(b.size)}
                      </span>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1 text-fg-muted">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(b.createdAt)}
                      </span>
                    </TD>
                    <TD className="max-w-[260px] truncate text-fg-muted">
                      {desc.note || '-'}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={Download}
                          onClick={() => handleDownload(b)}
                        >
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={RotateCcw}
                          onClick={() => setRestoring(b)}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          leadingIcon={Trash2}
                          onClick={() => setConfirmDelete(b)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          )}
        </DataTable>
      </Card>

      <RestoreConfirmModal
        backup={restoring}
        onClose={() => setRestoring(null)}
        onDone={() => {
          setRestoring(null);
          load();
        }}
      />

      <DeleteConfirmModal
        backup={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <UploadRestoreModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false);
          load();
        }}
      />
    </div>
  );
}

function RestoreConfirmModal({ backup, onClose, onDone }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!backup) {
      setConfirmText('');
    }
  }, [backup]);

  async function handleRestore() {
    if (!backup) return;
    if (confirmText !== 'RESTORE') {
      toast.warning('Ketik RESTORE untuk konfirmasi.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/api/backups/${backup.id}/restore`, {
        confirm: 'yes-restore'
      });
      toast.success('Database berhasil di-restore', {
        description: `Selesai dalam ${(res.durationMs / 1000).toFixed(1)} detik.`
      });
      onDone();
    } catch (err) {
      toast.error('Restore gagal', {
        description: err instanceof ApiError ? err.message : 'Coba lagi.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!backup} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader
        title="Restore database dari backup ini?"
        description="Operasi ini akan menimpa SEMUA data saat ini dengan isi backup. Tidak bisa dibatalkan."
        onClose={onClose}
      />
      <ModalBody>
        {backup ? (
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>File: <span className="font-mono text-xs">{backup.name}</span></div>
            <div>Ukuran: {formatBytes(backup.size)}</div>
            <div>Dibuat: <span className="text-muted-fg">{formatDateTime(backup.createdAt)}</span></div>
          </div>
        ) : null}

        <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <div className="font-semibold">⚠ Peringatan</div>
          <ul className="mt-1 list-disc pl-5 text-danger/90">
            <li>Semua transaksi, role sementara, email, audit log, dan admin akan ditimpa.</li>
            <li>Bot tetap jalan, tapi data state-nya kembali ke saat backup dibuat.</li>
            <li>Sangat disarankan klik <strong>Backup sekarang</strong> dulu sebelum restore.</li>
          </ul>
        </div>

        <FormField label="Ketik RESTORE untuk konfirmasi">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESTORE"
            autoFocus
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="danger"
          onClick={handleRestore}
          loading={busy}
          disabled={confirmText !== 'RESTORE'}
          leadingIcon={RotateCcw}
        >
          Ya, restore sekarang
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function DeleteConfirmModal({ backup, onClose, onConfirm }) {
  return (
    <Modal open={!!backup} onOpenChange={(open) => !open && onClose()}>
      <ModalHeader
        title="Hapus backup ini?"
        description="File akan dihapus permanen dari Google Drive."
        onClose={onClose}
      />
      <ModalBody>
        {backup ? (
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div>File: <span className="font-mono text-xs">{backup.name}</span></div>
            <div>Ukuran: {formatBytes(backup.size)}</div>
            <div>Dibuat: <span className="text-muted-fg">{formatDateTime(backup.createdAt)}</span></div>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button variant="danger" leadingIcon={Trash2} onClick={onConfirm}>
          Ya, hapus
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function UploadRestoreModal({ open, onClose, onDone }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!open) {
      setFile(null);
      setConfirmText('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  async function handleRestore() {
    if (!file) {
      toast.warning('Pilih file backup dulu');
      return;
    }
    if (confirmText !== 'RESTORE') {
      toast.warning('Ketik RESTORE untuk konfirmasi.');
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/backups/restore-upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Confirm': 'yes-restore'
        },
        body: buffer
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || payload.error || 'Restore gagal');
      }
      toast.success('Database berhasil di-restore', {
        description: `Selesai dalam ${(payload.durationMs / 1000).toFixed(1)} detik.`
      });
      onDone();
    } catch (err) {
      toast.error('Restore gagal', { description: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalHeader
        title="Restore dari file backup"
        description="Upload file .sql.gz hasil pg_dump (atau file backup yang pernah kamu download)."
        onClose={onClose}
      />
      <ModalBody>
        <FormField label="File backup (.sql.gz)">
          <input
            ref={fileRef}
            type="file"
            accept=".gz,.sql.gz,application/gzip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-fg hover:file:bg-primary/90"
          />
          {file ? (
            <div className="mt-1 text-xs text-muted-fg">
              {file.name} · {formatBytes(file.size)}
            </div>
          ) : null}
        </FormField>

        <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <div className="font-semibold">⚠ Operasi destruktif</div>
          <p className="mt-0.5 text-danger/90">
            File backup yang di-upload akan menggantikan seluruh data database
            saat ini. Pastikan file valid dan dari source yang kamu percaya.
          </p>
        </div>

        <FormField label="Ketik RESTORE untuk konfirmasi">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESTORE"
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          variant="danger"
          onClick={handleRestore}
          loading={busy}
          disabled={!file || confirmText !== 'RESTORE'}
          leadingIcon={Upload}
        >
          Restore dari file
        </Button>
      </ModalFooter>
    </Modal>
  );
}
