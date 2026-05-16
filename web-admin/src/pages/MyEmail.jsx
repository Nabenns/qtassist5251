import { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api, ApiError, formatDateTime } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField } from '../components/ui/Input.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '../components/ui/Modal.jsx';

/**
 * MyEmail — self-service email binding for any logged-in user.
 *
 * Mirrors the Discord `/my-email` slash command + the email-register
 * button flow, but driven from the dashboard so non-admin users can
 * bind / update / remove their email without touching Discord.
 */
export default function MyEmail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [binding, setBinding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/emails/me');
      setBinding(res.binding);
      setEmailInput(res.binding?.email || '');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.put('/api/emails/me', { email: emailInput.trim() });
      setBinding(res.binding);
      toast.success(binding ? 'Email berhasil diupdate.' : 'Email berhasil didaftarkan.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coba lagi.';
      toast.error('Gagal menyimpan email', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await api.delete('/api/emails/me');
      setBinding(null);
      setEmailInput('');
      setConfirmRemove(false);
      toast.success('Email berhasil dihapus.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Coba lagi.';
      toast.error('Gagal hapus email', { description: msg });
    } finally {
      setRemoving(false);
    }
  }

  const isDirty = emailInput.trim() !== (binding?.email || '');
  const hasBinding = Boolean(binding);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Saya"
        description={
          user
            ? `Halo ${user.globalName || user.username}, atur email kamu untuk akses video / drive eksklusif.`
            : 'Atur email kamu untuk akses video / drive eksklusif.'
        }
        accent="primary"
      />

      {error ? (
        <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!loading ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {hasBinding ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
                  {hasBinding ? 'Email Terdaftar' : 'Email Belum Terdaftar'}
                </div>
                <div className="text-xs text-muted-fg">
                  {hasBinding
                    ? 'Update email kamu kapan saja di form di bawah.'
                    : 'Masukkan email untuk mulai dapat akses konten.'}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {hasBinding ? (
              <div className="border border-border bg-surface-2 p-4 text-sm space-y-1.5">
                <Row
                  label="Email aktif"
                  value={
                    <span className="font-mono text-xs">{binding.email}</span>
                  }
                />
                <Row
                  label="Terdaftar sejak"
                  value={
                    binding.registeredAt
                      ? formatDateTime(binding.registeredAt)
                      : '-'
                  }
                />
                <Row
                  label="Terakhir diupdate"
                  value={
                    binding.updatedAt
                      ? formatDateTime(binding.updatedAt)
                      : '-'
                  }
                />
              </div>
            ) : null}

            <form onSubmit={handleSave} className="space-y-3" noValidate>
              <FormField label="Alamat email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  leadingIcon={Mail}
                  placeholder="kamu@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={submitting}
                />
              </FormField>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  leadingIcon={Save}
                  loading={submitting}
                  disabled={!emailInput.trim() || (hasBinding && !isDirty)}
                >
                  {hasBinding ? 'Simpan Update' : 'Daftarkan Email'}
                </Button>
                {hasBinding ? (
                  <Button
                    type="button"
                    variant="danger"
                    leadingIcon={Trash2}
                    onClick={() => setConfirmRemove(true)}
                    disabled={submitting}
                  >
                    Hapus Email
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="text-xs text-muted-fg space-y-1">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-fg mb-1">
            Catatan
          </div>
          <div>· Setiap user hanya bisa daftar 1 email per server.</div>
          <div>· Email dipakai oleh admin untuk grant akses video / drive eksklusif.</div>
          <div>· Kalau ganti email, akses lama akan dipindahkan otomatis (admin akan dinotifikasi).</div>
          <div>· Kamu bisa update atau hapus email kapan saja dari halaman ini.</div>
        </CardBody>
      </Card>

      <Modal open={confirmRemove} onOpenChange={(v) => !v && setConfirmRemove(false)}>
        <ModalHeader
          title="Hapus email?"
          description="Email kamu akan dihapus dari sistem."
          onClose={() => setConfirmRemove(false)}
          tone="danger"
        />
        <ModalBody>
          {binding ? (
            <div className="border border-border bg-surface-2 p-3 font-mono text-sm">
              {binding.email}
            </div>
          ) : null}
          <p className="text-sm text-muted-fg">
            Setelah dihapus, kamu mungkin kehilangan akses ke konten yang sebelumnya
            terbuka. Kamu bisa daftar ulang kapan saja.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setConfirmRemove(false)}
            disabled={removing}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            leadingIcon={Trash2}
            onClick={handleRemove}
            loading={removing}
          >
            Ya, hapus
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
        {label}
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}
