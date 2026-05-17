import { useState } from 'react';
import { CheckCircle2, RefreshCw, Copy } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StatusPill } from '../../components/ui/brutalist/index.js';
import { formatDateTime } from '../../api.js';

/**
 * StatusView — for users whose IB account is already verified.
 *
 * Shows account summary, deposit, last verification, volume tracking.
 * No wizard, just status. User can re-verify on demand.
 *
 * Props:
 *   account     — IbAccount with status='verified'
 *   config      — IbConfig (for minDeposit, volumeCheckEnabled, etc)
 *   onReverify  — () => Promise<{result, account}>
 *   onCopy      — (text: string) => void (for copy-to-clipboard with toast)
 */
export function StatusView({ account, config, onReverify, onCopy }) {
  const [reverifying, setReverifying] = useState(false);
  const [error, setError] = useState(null);

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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wider text-fg">
                Akun Terverifikasi
              </div>
              <div className="text-xs text-muted-fg">
                Role IB sudah aktif di Discord. Pertahankan volume trading harian.
              </div>
            </div>
          </div>
          <StatusPill status={account.status} />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="border border-border bg-surface-2 p-4 text-sm space-y-1.5">
          <Row
            label="Nomor akun broker"
            value={
              <span className="inline-flex items-center gap-2 font-mono text-xs">
                {account.brokerAccountNumber}
                <button
                  type="button"
                  onClick={() => onCopy(account.brokerAccountNumber)}
                  className="text-muted-fg hover:text-fg"
                  title="Salin"
                  aria-label="Salin nomor akun"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </span>
            }
          />
          {account.totalDepositUsd != null ? (
            <Row
              label="Total deposit terdeteksi"
              value={`USD ${Number(account.totalDepositUsd).toFixed(2)}`}
            />
          ) : null}
          {config?.minDepositUsd ? (
            <Row label="Minimum deposit" value={`USD ${Number(config.minDepositUsd).toFixed(2)}`} />
          ) : null}
          <Row
            label="Terakhir dicek"
            value={account.lastCheckedAt ? formatDateTime(account.lastCheckedAt) : 'Belum pernah'}
          />
          {account.verifiedAt ? (
            <Row label="Terverifikasi pada" value={formatDateTime(account.verifiedAt)} />
          ) : null}
          {config?.volumeCheckEnabled ? (
            <>
              <Row
                label="Volume harian terakhir"
                value={
                  account.lastVolumeAt
                    ? formatDateTime(account.lastVolumeAt)
                    : 'Belum ada'
                }
              />
              {account.consecutiveZeroVolumeDays > 0 ? (
                <Row
                  label="Hari tanpa volume"
                  value={
                    <span className="text-warning">
                      {account.consecutiveZeroVolumeDays} / {config.volumeGraceDays} hari
                    </span>
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>

        {error ? (
          <div className="border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-sm text-danger">
            {error}
          </div>
        ) : null}

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
      </CardBody>
    </Card>
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
