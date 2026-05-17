import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { StepIndicator } from './daftar-ib/StepIndicator.jsx';
import { Step1Register } from './daftar-ib/Step1Register.jsx';
import { Step2Deposit } from './daftar-ib/Step2Deposit.jsx';
import { Step3Submit } from './daftar-ib/Step3Submit.jsx';
import { StatusView } from './daftar-ib/StatusView.jsx';

/**
 * DaftarIb — IB Valetax registration entry point.
 *
 * Routes between three modes based on account state:
 *   - Verified user → StatusView (no wizard)
 *   - First-timer / mid-flow / failed / removed → Wizard (3 steps)
 *
 * Wizard step is determined by:
 *   - !linkClickedAt           → Step 1
 *   - !depositConfirmedAt      → Step 2
 *   - else                     → Step 3
 *
 * Failed/removed users go straight to Step 3 with banner.
 * Pending users with brokerAccountNumber stay on Step 3 showing status.
 * Local step override allows clicking "Kembali" to go back without losing
 * timestamp data.
 */
export default function DaftarIb() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepOverride, setStepOverride] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ib/my-account');
      setData(res);
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

  const config = data?.config;
  const account = data?.account;

  // Determine which step from server data, or honor local override.
  function deriveStep() {
    if (!account) return 1;
    if (account.brokerAccountNumber) return 3;
    if (!account.linkClickedAt) return 1;
    if (!account.depositConfirmedAt) return 2;
    return 3;
  }
  const activeStep = stepOverride ?? deriveStep();

  async function trackLinkClicked() {
    const res = await api.post('/api/ib/my-account/track-link-clicked');
    setData((prev) => ({ ...prev, account: res.account }));
  }

  async function trackDepositConfirmed() {
    const res = await api.post('/api/ib/my-account/track-deposit-confirmed');
    setData((prev) => ({ ...prev, account: res.account }));
  }

  async function submitAccount(brokerAccountNumber) {
    const res = await api.post('/api/ib/my-account', { brokerAccountNumber });
    setData((prev) => ({ ...prev, account: res.account }));
    if (res.account?.status === 'verified') {
      toast.success('Akun kamu terverifikasi. Role IB sudah dikasih.');
    } else if (res.account?.status === 'failed') {
      toast.warning('Verifikasi gagal', { description: res.account.lastError });
    } else {
      toast.info('Akun masuk antrian verifikasi.');
    }
    setStepOverride(null);
  }

  async function reverifyAccount() {
    const res = await api.post('/api/ib/my-account/reverify');
    setData((prev) => ({ ...prev, account: res.account }));
    const status = res?.result?.status;
    if (status === 'verified') {
      toast.success('Akun terverifikasi.');
    } else if (status === 'failed') {
      toast.warning('Verifikasi gagal', { description: res?.result?.message });
    } else {
      toast.info('Belum bisa diverifikasi', { description: res?.result?.message });
    }
  }

  function copyToClipboard(text) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    toast.success('Disalin');
  }

  // ==== Render ====

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar IB"
        description={
          user
            ? `Halo ${user.globalName || user.username}, daftar IB Valetax dalam 3 langkah.`
            : 'Daftar IB Valetax dalam 3 langkah.'
        }
        accent="primary"
      />

      {error ? (
        <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
          {error}
        </div>
      ) : null}

      {config && !config.enabled ? (
        <Card>
          <CardBody>
            <div className="border border-warning/40 bg-warning-soft px-4 py-3 font-mono text-sm text-warning">
              <div className="font-bold uppercase tracking-wider">[ sistem ib dinonaktifkan ]</div>
              <div className="mt-1 font-sans">
                Admin belum mengaktifkan pendaftaran IB. Coba lagi nanti.
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted-fg">Memuat data...</div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && account?.status === 'verified' ? (
        <StatusView
          account={account}
          config={config}
          onReverify={reverifyAccount}
          onCopy={copyToClipboard}
        />
      ) : null}

      {!loading && account?.status !== 'verified' ? (
        <>
          <StepIndicator activeStep={activeStep} />

          {activeStep === 1 ? (
            <Step1Register
              config={config}
              onAdvance={() => setStepOverride(2)}
              trackLinkClicked={trackLinkClicked}
            />
          ) : null}

          {activeStep === 2 ? (
            <Step2Deposit
              config={config}
              onBack={() => setStepOverride(1)}
              onAdvance={() => setStepOverride(3)}
              trackDepositConfirmed={trackDepositConfirmed}
            />
          ) : null}

          {activeStep === 3 ? (
            <Step3Submit
              account={account}
              onBack={() => setStepOverride(2)}
              onSubmit={submitAccount}
              onReverify={reverifyAccount}
            />
          ) : null}
        </>
      ) : null}

      <Card>
        <CardBody className="text-xs text-muted-fg space-y-1">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-fg mb-1">
            Cara Kerja
          </div>
          <div>1. Daftar akun Valetax pakai link IB resmi (Step 1).</div>
          <div>2. Setor minimum deposit yang ditentukan admin (Step 2).</div>
          <div>3. Submit nomor akun untuk verifikasi otomatis (Step 3).</div>
          <div>4. Bot auto-cek ke Valetax tiap beberapa menit. Role IB Discord langsung dikasih saat akun ditemukan dan deposit cukup.</div>
          <div>5. Jaga volume trading harian agar role tetap aktif (kalau volume tracking di-enable).</div>
        </CardBody>
      </Card>
    </div>
  );
}
