import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { KPIBlock } from '../../components/ui/brutalist/index.js';

/**
 * Step2Deposit — wizard step 2.
 *
 * Shows minimum deposit amount as a KPI block, asks user to confirm
 * via checkbox, then advances to step 3 after firing the
 * trackDepositConfirmed call (which gates step-3 submit on the backend).
 *
 * Props:
 *   config                 — IbConfig with `minDepositUsd` field
 *   onBack                 — () => void
 *   onAdvance              — () => void, called after track succeeds
 *   trackDepositConfirmed  — () => Promise<{ ok }>, must succeed before advancing
 */
export function Step2Deposit({ config, onBack, onAdvance, trackDepositConfirmed }) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const minDeposit = Number(config?.minDepositUsd) || 0;

  async function handleAdvance() {
    setSubmitting(true);
    setError(null);
    try {
      await trackDepositConfirmed();
      onAdvance();
    } catch (err) {
      setError(err?.message || 'Gagal lanjut ke step 3. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 2 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Setor Deposit
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <KPIBlock
          label="Minimum Deposit"
          value={`USD ${minDeposit.toFixed(2)}`}
          tone="primary"
          size="lg"
        />

        <p className="text-sm text-muted-fg leading-relaxed">
          Lakukan deposit minimum di akun Valetax kamu sebelum lanjut. Bot akan
          auto-verify deposit saat kamu submit nomor akun di step berikutnya.
          Kalau deposit kurang dari minimum, status akan jadi pending sampai
          deposit-nya cukup.
        </p>

        <label className="flex items-start gap-3 border border-border bg-surface-2 p-3 text-sm text-fg cursor-pointer hover:bg-surface-3 transition-colors duration-75">
          <input
            type="checkbox"
            className="mt-0.5 border-border"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Aku sudah setor deposit minimum di akun Valetax saya</span>
        </label>

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
          >
            Kembali
          </Button>
          <Button
            onClick={handleAdvance}
            disabled={!confirmed || submitting}
            loading={submitting}
            trailingIcon={ArrowRight}
          >
            Lanjut ke Step 3
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
