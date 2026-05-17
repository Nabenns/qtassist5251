import { useState } from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';

/**
 * Step1Register — wizard step 1.
 *
 * User clicks the Valetax registration link (opens new tab, fires
 * background trackLinkClicked call), confirms via checkbox, then
 * advances to step 2.
 *
 * Props:
 *   config           — IbConfig object with `ibLink` field (string URL or null)
 *   onAdvance        — () => void, called when user clicks the advance button
 *   trackLinkClicked — () => Promise<void>, fired on link click (background)
 */
export function Step1Register({ config, onAdvance, trackLinkClicked }) {
  const [confirmed, setConfirmed] = useState(false);
  const [linkOpened, setLinkOpened] = useState(false);

  function handleLinkClick() {
    // Fire-and-forget tracking. Don't block UI on result.
    trackLinkClicked().catch(() => {
      // Network failure is non-fatal — user can still continue.
    });
    setLinkOpened(true);
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-fg">
            Step 1 of 3
          </div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-fg mt-1">
            Daftar di Valetax
          </h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <p className="text-sm text-muted-fg leading-relaxed">
          Klik tombol di bawah untuk register akun Valetax baru. Pakai link IB
          resmi QTrades supaya kamu di-attach ke kelompok partner. Kalau kamu
          sudah punya akun Valetax sebelumnya, kamu masih bisa lanjut — bot
          akan auto-detect saat verifikasi.
        </p>

        {config?.ibLink ? (
          <a
            href={config.ibLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleLinkClick}
            className="inline-flex w-full items-center justify-center gap-2.5 border-2 border-primary bg-transparent px-5 py-3.5 font-display font-bold text-primary uppercase tracking-wider text-sm transition-colors duration-75 hover:bg-primary hover:text-primary-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <ExternalLink className="h-5 w-5" />
            Buka Link Pendaftaran Valetax
          </a>
        ) : (
          <div className="border border-warning/40 bg-warning-soft px-3 py-2 font-mono text-sm text-warning">
            Link IB belum diset oleh admin. Hubungi admin server.
          </div>
        )}

        <label className="flex items-start gap-3 border border-border bg-surface-2 p-3 text-sm text-fg cursor-pointer hover:bg-surface-3 transition-colors duration-75">
          <input
            type="checkbox"
            className="mt-0.5 border-border"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Aku sudah register akun di Valetax via link tersebut</span>
        </label>

        <div className="flex justify-end">
          <Button
            onClick={onAdvance}
            disabled={!confirmed}
            trailingIcon={ArrowRight}
          >
            Lanjut ke Step 2
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
