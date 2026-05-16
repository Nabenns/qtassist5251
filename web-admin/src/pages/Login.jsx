import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { HazardStripe } from '../components/ui/brutalist/HazardStripe.jsx';

const ERROR_MESSAGES = {
  oauth_not_configured:
    'Discord OAuth belum dikonfigurasi di server. Hubungi admin.',
  missing_code: 'Login dibatalkan atau respons Discord tidak lengkap.',
  state_mismatch: 'Sesi login kadaluarsa. Coba login lagi.',
  token_exchange_failed: 'Gagal verifikasi ke Discord. Coba lagi.',
  profile_fetch_failed: 'Gagal ambil profil Discord. Coba lagi.',
  guild_not_configured: 'Server Discord belum dikonfigurasi di bot.',
  bot_not_ready:
    'Bot Discord belum siap atau kamu belum join server. Pastikan kamu sudah masuk server, lalu coba lagi.',
  internal_error: 'Terjadi kesalahan internal. Coba lagi.'
};

function DiscordLogo({ className }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.16a.077.077 0 0 0-.082.038c-.354.63-.747 1.453-1.022 2.1a18.27 18.27 0 0 0-5.504 0 12.66 12.66 0 0 0-1.04-2.1.08.08 0 0 0-.081-.038A19.74 19.74 0 0 0 4.07 4.369a.07.07 0 0 0-.032.027C.533 9.045-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.099.245.197.372.291a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.106c.36.699.772 1.364 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.548-13.66a.06.06 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function Login() {
  const { loginWithDiscord, status } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Pick up `?error=...` from the OAuth callback redirect.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('error');
    if (code) {
      setError(ERROR_MESSAGES[code] || `Login gagal (${code}).`);
    }
  }, [location.search]);

  function handleClick() {
    setError(null);
    setSubmitting(true);
    const returnTo = (location.state && location.state.from) || '/';
    // No need to await — this is a full-page redirect.
    loginWithDiscord(returnTo);
  }

  const isLoading = submitting || status === 'loading';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4">
      {/* Theme toggle pinned top-right */}
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-6 inline-flex h-9 w-9 items-center justify-center text-fg-muted hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label="Ganti tema"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Top: hazard stripe + brand row */}
        <div className="border border-border bg-surface shadow-step-lg">
          <HazardStripe height={4} density={10} />

          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-primary p-1.5">
              <img
                src="/qtrades-logo.webp"
                alt="QTrades"
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>
            <h1 className="font-display text-xl font-bold uppercase tracking-[0.2em] text-fg">
              QTASSIST
            </h1>
            <p className="mt-1 text-xs text-muted-fg">
              Masuk dengan akun Discord untuk lanjut
            </p>
          </div>

          <div className="border-t border-border px-6 py-5">
            {/* Mono request-label row */}
            <div className="mb-3 flex items-baseline justify-between">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-fg">
                Discord Auth ·
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-muted">
                req · oauth2
              </span>
            </div>

            {/* Outline button */}
            <button
              type="button"
              onClick={handleClick}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2.5 border-2 border-primary bg-transparent px-5 py-3.5 font-display font-bold text-primary uppercase tracking-wider text-sm transition-colors duration-75 hover:bg-primary hover:text-primary-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {isLoading ? (
                <span className="font-mono text-xs">[ menyambungkan… ]</span>
              ) : (
                <>
                  <DiscordLogo className="h-5 w-5" />
                  Initiate Login
                </>
              )}
            </button>

            <div className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-fg-muted">
              ▼ scope · identify only
            </div>

            {error ? (
              <div className="mt-4 border border-danger/40 bg-danger-soft px-3 py-2 font-mono text-xs text-danger">
                <div className="font-bold uppercase tracking-wider mb-0.5">[ error ]</div>
                <div className="font-sans">{error}</div>
              </div>
            ) : null}
          </div>

          {/* Footer info row */}
          <div className="border-t border-border bg-surface-2 px-6 py-3 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-fg leading-relaxed">
              admin · akses dashboard penuh
              <br />
              user · diarahkan ke daftar ib
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-fg-muted">
          <span>QTrades · Internal Tools</span>
          <span className="text-primary">v1.0</span>
        </div>
      </div>
    </div>
  );
}
