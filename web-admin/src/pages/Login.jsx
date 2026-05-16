import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { Button } from '../components/ui/Button.jsx';

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-info/15 blur-3xl"
      />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label="Ganti tema"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="surface p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg text-xl font-bold shadow-soft">
              Q
            </div>
            <h1 className="text-lg font-semibold text-fg">QTAssist</h1>
            <p className="mt-1 text-sm text-muted-fg">
              Masuk dengan akun Discord untuk lanjut
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
              {error}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={handleClick}
            className="w-full bg-[#5865F2] text-white hover:bg-[#4752c4] focus-visible:ring-[#5865F2]/40"
            loading={submitting || status === 'loading'}
          >
            <DiscordLogo className="mr-2 h-5 w-5" />
            {submitting ? 'Mengarahkan ke Discord...' : 'Login dengan Discord'}
          </Button>

          <p className="mt-5 text-center text-xs text-muted-fg">
            Akses ke dashboard admin dibatasi untuk anggota dengan role admin.
            User biasa akan diarahkan ke halaman daftar IB.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-fg">
          QTrades · Login Discord
        </p>
      </div>
    </div>
  );
}
