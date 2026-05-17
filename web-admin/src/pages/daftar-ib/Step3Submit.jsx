import { useState } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, FormField } from '../../components/ui/Input.jsx';
import { StatusPill } from '../../components/ui/brutalist/index.js';

/**
 * Step3Submit — wizard step 3.
 *
 * Initial render: form to input broker account number and submit.
 * Post-submit: inline status display with the resulting account state.
 *   - pending  → loading-style banner + reverify button
 *   - failed   → error banner + retry option
 *   - removed  → role-revoked banner + retry option
 *   - verified → handled by parent (renders StatusView instead)
 *
 * Props:
 *   account     — current IbAccount or null. Has lastError if returning from failed/removed.
 *   onBack      — () => void (only relevant for forward flow; failed/removed users
 *                  don't really need it but we leave it accessible)
 *   onSubmit    — (brokerAccountNumber: string) => Promise<account>
 *   onReverify  — () => Promise<{result, account}>
 */
export function Step3Submit({ account, onBack, onSubmit, onReverify }) {
  const [accountInput, setAccountInput] = useState(account?.brokerAccountNumber || '');
  const [submitting, setSubmitting] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState(null);

  const status = account?.status;
  const isPending = status === 'pending' && account?.brokerAccountNumber;
  const isFailed = status === 'failed';
  const isRemoved = status === 'removed';
  const showForm = !account?.brokerAccountNumber || isFailed || isRemoved;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!accountInput.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(accountInput.trim());
    } catch (err) {
      setError(err?.message || 'Gagal submit. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverify() {
    setReverifying(true);
    setError(null);
    try {
      await onReverify();
    } catch (err) {
      setError(err?.message || 'Gagal cek ulang. Coba lagi.');
    } finally {
      setReverifying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 3 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Submit Nomor Akun
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {(isFailed || isRemoved) && account?.lastError ? (
          <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            <div className="font-bold uppercase tracking-wider">
              [ pendaftaran sebelumnya: {isFailed ? 'gagal' : 'role dicabut'} ]
            </div>
            <div className="mt-0.5 font-sans">{account.lastError}</div>
            {account.removedReason ? (
              <div className="mt-0.5 font-sans">{account.removedReason}</div>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <div className="border border-warning/40 bg-warning-soft px-3 py-2 font-mono text-sm text-warning">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-bold uppercase tracking-wider">[ menunggu verifikasi ]</span>
              <StatusPill status="pending" className="ml-auto" />
            </div>
            <div className="mt-1 font-sans">
              Akun {account.brokerAccountNumber} sedang dicek otomatis. Bot ulang
              cek tiap beberapa menit. Percobaan {account.retryCount}/5.
            </div>
            {account.lastError ? (
              <div className="mt-1 font-sans opacity-80">{account.lastError}</div>
            ) : null}
          </div>
        ) : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-muted-fg leading-relaxed">
              Masukkan nomor akun MT5 / Valetax kamu. Bot akan auto-verify ke
              Valetax — kalau akun ditemukan dan deposit cukup, role IB Discord
              langsung dikasih ke kamu.
            </p>

            <FormField label="Nomor akun broker" htmlFor="acct">
              <Input
                id="acct"
                inputMode="numeric"
                autoComplete="off"
                required
                placeholder="contoh: 1234567"
                variant="mono"
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                disabled={submitting}
              />
            </FormField>

            {error ? (
              <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex justify-between gap-3">
              <Button
                variant="secondary"
                onClick={onBack}
                leadingIcon={ArrowLeft}
                disabled={submitting}
                type="button"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                loading={submitting}
                disabled={!accountInput.trim() || submitting}
              >
                {submitting ? 'Memverifikasi...' : 'Verifikasi Sekarang'}
              </Button>
            </div>
          </form>
        ) : null}

        {isPending ? (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={handleReverify}
              loading={reverifying}
            >
              Cek ulang sekarang
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
