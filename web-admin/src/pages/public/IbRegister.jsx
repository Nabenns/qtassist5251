import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  XCircle
} from 'lucide-react';
import { api, ApiError, formatDateTime } from '../../api.js';
import { useTheme } from '../../lib/theme.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input, FormField } from '../../components/ui/Input.jsx';

/**
 * Public IB registration page (route: /ib).
 *
 * Auth model is Discord OAuth2:
 *   - User clicks "Login dengan Discord" → redirect to /api/ib-public/auth/discord
 *   - On callback, the bot sets a httpOnly cookie and redirects back here
 *   - This page calls GET /api/ib-public/me to find out who they are + IB status
 *   - User submits broker account → POST /api/ib-public/register → bot calls
 *     Valetax, grants Discord role if verified
 *
 * The page is intentionally self-contained — no admin layout, no admin
 * cookie required, no admin nav. It's safe to render at a public URL.
 */
export default function IbRegister() {
  const { theme, toggle } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(null); // { user, membership, account } | null
  const [meStatus, setMeStatus] = useState('loading'); // 'loading' | 'guest' | 'authed' | 'error'
  const [meError, setMeError] = useState(null);
  const [accountInput, setAccountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Read & clean up oauth_error query param (e.g. set by /auth/callback on failure)
  const oauthError = searchParams.get('oauth_error');
  useEffect(() => {
    if (!oauthError) return;
    const next = new URLSearchParams(searchParams);
    next.delete('oauth_error');
    setSearchParams(next, { replace: true });
  }, [oauthError, searchParams, setSearchParams]);

  // Load public config (always — works whether logged in or not)
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/ib-public/config')
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load `me` (will 401 if not logged in — that's expected for guests)
  const loadMe = useCallback(async () => {
    try {
      const data = await api.get('/api/ib-public/me');
      setMe(data);
      setMeStatus('authed');
      setMeError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMe(null);
        setMeStatus('guest');
      } else {
        setMeStatus('error');
        setMeError(err.message || 'Gagal memuat data.');
      }
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const account = me?.account || null;
  const status = account?.status || null;

  // Pre-fill input with current account if it's failed/removed (so user can retry it)
  useEffect(() => {
    if (account && (account.status === 'failed' || account.status === 'removed') && !accountInput) {
      setAccountInput(account.brokerAccountNumber);
    }
  }, [account, accountInput]);

  const handleLogin = useCallback(() => {
    // Server-side endpoint kicks off OAuth and redirects back here on success.
    window.location.assign('/api/ib-public/auth/discord?next=' + encodeURIComponent('/ib'));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/api/ib-public/auth/logout');
    } finally {
      setMe(null);
      setMeStatus('guest');
      setFeedback(null);
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setFeedback(null);
      const trimmed = accountInput.trim().replace(/\s+/g, '');
      if (!trimmed) {
        setFeedback({ kind: 'error', message: 'Nomor akun wajib diisi.' });
        return;
      }
      if (!/^[0-9A-Za-z\-]+$/.test(trimmed)) {
        setFeedback({
          kind: 'error',
          message: 'Format salah. Hanya boleh huruf, angka, dan tanda hubung (-).'
        });
        return;
      }
      setSubmitting(true);
      try {
        const data = await api.post('/api/ib-public/register', {
          brokerAccountNumber: trimmed
        });
        setFeedback({
          kind: data.status === 'verified' ? 'success' : data.status === 'failed' ? 'error' : 'info',
          message: data.message
        });
        // Refresh `me` so the status card reflects the new state.
        await loadMe();
      } catch (err) {
        setFeedback({ kind: 'error', message: mapRegisterError(err) });
      } finally {
        setSubmitting(false);
      }
    },
    [accountInput, loadMe]
  );

  const handleReverify = useCallback(async () => {
    setFeedback(null);
    setSubmitting(true);
    try {
      const data = await api.post('/api/ib-public/reverify', {});
      setFeedback({
        kind: data.status === 'verified' ? 'success' : data.status === 'failed' ? 'error' : 'info',
        message: data.message
      });
      await loadMe();
    } catch (err) {
      setFeedback({ kind: 'error', message: mapRegisterError(err) });
    } finally {
      setSubmitting(false);
    }
  }, [loadMe]);

  const ibLink = config?.ibLink || null;
  const minDeposit = config?.minDepositUsd || 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-4 py-10 sm:py-16">
      {/* Decorative blobs (consistent with admin Login page) */}
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

      <div className="relative z-10 mx-auto w-full max-w-2xl space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg text-xl font-bold shadow-soft">
            Q
          </div>
          <h1 className="text-2xl font-semibold text-fg">Pendaftaran IB QTrades</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Daftar IB QTrades di Valetax dan dapatkan role eksklusif di Discord secara otomatis.
          </p>
        </header>

        {oauthError ? (
          <Banner kind="error">
            Login Discord gagal: <code>{oauthError}</code>. Coba lagi.
          </Banner>
        ) : null}

        {/* Disabled state */}
        {config && !config.enabled ? (
          <div className="surface p-6">
            <p className="text-sm text-muted-fg">
              Sistem pendaftaran IB belum diaktifkan oleh admin. Silakan kembali lagi nanti atau
              hubungi admin server.
            </p>
          </div>
        ) : null}

        {/* Loading */}
        {meStatus === 'loading' && config?.enabled !== false ? (
          <div className="surface p-6">
            <p className="text-sm text-muted-fg">Memuat...</p>
          </div>
        ) : null}

        {/* Guest: not logged in */}
        {meStatus === 'guest' && config?.enabled !== false ? (
          <div className="surface p-6 space-y-5">
            <Steps minDeposit={minDeposit} ibLink={ibLink} />

            <div className="rounded-lg bg-surface-2 p-4 text-center">
              <p className="mb-3 text-sm text-muted-fg">
                Login pakai Discord dulu supaya role bisa otomatis dikasih ke akun kamu.
              </p>
              <Button leadingIcon={DiscordIcon} onClick={handleLogin}>
                Login dengan Discord
              </Button>
            </div>
          </div>
        ) : null}

        {/* Errored loading */}
        {meStatus === 'error' ? (
          <Banner kind="error">{meError || 'Terjadi kesalahan.'}</Banner>
        ) : null}

        {/* Authed */}
        {meStatus === 'authed' && me ? (
          <>
            <UserCard user={me.user} onLogout={handleLogout} />

            {me.membership?.checked && me.membership.isMember === false ? (
              <Banner kind="warning">
                <span>
                  Kamu belum jadi member server Discord{' '}
                  {me.membership.guildName ? <strong>{me.membership.guildName}</strong> : ''}.
                  Join dulu sebelum daftar — kalau belum join, role IB-nya gak bisa dikasih.
                </span>
                {(() => {
                  const inviteUrl = me.inviteUrl || me.membership.inviteUrl || null;
                  return inviteUrl ? (
                    <a
                      href={inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-fg underline-offset-2 hover:underline"
                    >
                      Join server <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null;
                })()}
              </Banner>
            ) : null}

            {account ? (
              <StatusCard
                account={account}
                config={config}
                onReverify={handleReverify}
                submitting={submitting}
              />
            ) : (
              <Steps minDeposit={minDeposit} ibLink={ibLink} />
            )}

            {(!account || account.status === 'failed' || account.status === 'removed') ? (
              <RegisterForm
                value={accountInput}
                onChange={setAccountInput}
                onSubmit={handleSubmit}
                submitting={submitting}
                isRetry={Boolean(account)}
                feedback={feedback}
              />
            ) : (
              feedback ? <Banner kind={feedback.kind}>{feedback.message}</Banner> : null
            )}
          </>
        ) : null}

        <footer className="pt-4 text-center text-xs text-muted-fg">
          QTrades · IB Verification · Powered by Valetax
        </footer>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────────────── */

function UserCard({ user, onLogout }) {
  const avatarUrl = useMemo(() => {
    if (!user?.discordUserId) return null;
    if (user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.discordUserId}/${user.avatar}.png?size=128`;
    }
    // Default avatar — Discord rotates across 6 generic ones based on user id
    const idx = (BigInt(user.discordUserId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }, [user]);

  const displayName = user?.globalName || user?.username || 'Discord User';

  return (
    <div className="surface flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full ring-1 ring-border"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-surface-2" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{displayName}</p>
          <p className="truncate text-xs text-muted-fg">ID: {user.discordUserId}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" leadingIcon={LogOut} onClick={onLogout}>
        Logout
      </Button>
    </div>
  );
}

function Steps({ minDeposit, ibLink }) {
  return (
    <ol className="space-y-3 text-sm">
      <Step
        n={1}
        title="Daftar di Valetax via link IB QTrades"
        body={
          ibLink ? (
            <a
              href={ibLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Buka link pendaftaran <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-muted-fg">
              Link pendaftaran belum diatur admin. Hubungi admin server.
            </span>
          )
        }
      />
      <Step
        n={2}
        title="Lakukan deposit minimum"
        body={
          <span className="text-muted-fg">
            {minDeposit > 0
              ? `Minimum deposit untuk verifikasi: USD ${formatNumber(minDeposit)}.`
              : 'Tidak ada minimum deposit.'}
          </span>
        }
      />
      <Step
        n={3}
        title="Login dengan Discord & masukkan nomor akun broker kamu"
        body={
          <span className="text-muted-fg">
            Bot akan cek otomatis ke Valetax. Kalau ketemu dan deposit cukup, role IB akan langsung
            dikasih.
          </span>
        }
      />
    </ol>
  );
}

function Step({ n, title, body }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/30">
        {n}
      </span>
      <div className="space-y-0.5">
        <p className="font-medium text-fg">{title}</p>
        <div className="text-xs">{body}</div>
      </div>
    </li>
  );
}

function StatusCard({ account, config, onReverify, submitting }) {
  const map = STATUS_MAP[account.status] || STATUS_MAP.pending;
  const Icon = map.icon;

  return (
    <div className="surface overflow-hidden">
      <div className={`flex items-center gap-3 border-b border-border px-5 py-4 ${map.headerClass}`}>
        <Icon className="h-5 w-5" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{map.title}</p>
          <p className="text-xs opacity-80">{map.subtitle}</p>
        </div>
      </div>
      <dl className="divide-y divide-border text-sm">
        <Row label="Nomor Akun Broker">
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
            {account.brokerAccountNumber}
          </code>
        </Row>
        <Row label="Status">{statusBadge(account.status)}</Row>
        {account.totalDepositUsd != null ? (
          <Row label="Total Deposit">USD {formatNumber(account.totalDepositUsd)}</Row>
        ) : null}
        {account.verifiedAt ? (
          <Row label="Diverifikasi">{formatDateTime(account.verifiedAt)}</Row>
        ) : null}
        {account.lastCheckedAt ? (
          <Row label="Cek Terakhir">{formatDateTime(account.lastCheckedAt)}</Row>
        ) : null}
        {account.status === 'pending' && account.nextRetryAt ? (
          <Row label="Retry Berikutnya">{formatDateTime(account.nextRetryAt)}</Row>
        ) : null}
        {account.lastError ? <Row label="Catatan">{account.lastError}</Row> : null}
        {account.status === 'pending' && config ? (
          <Row label="Percobaan">
            {account.retryCount} / {config.maxRetries} (cek otomatis tiap{' '}
            {config.retryIntervalMinutes} menit)
          </Row>
        ) : null}
      </dl>

      {account.status === 'pending' || account.status === 'failed' ? (
        <div className="flex justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="secondary" size="sm" loading={submitting} onClick={onReverify}>
            Cek sekarang
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RegisterForm({ value, onChange, onSubmit, submitting, isRetry, feedback }) {
  return (
    <form onSubmit={onSubmit} className="surface p-6 space-y-4" noValidate>
      <FormField
        label={isRetry ? 'Coba lagi dengan nomor akun ini' : 'Nomor Akun Broker (Valetax)'}
        htmlFor="broker_account"
        hint="Hanya huruf, angka, atau tanda hubung. Misal: 12345678 atau MT5-1234."
      >
        <Input
          id="broker_account"
          autoComplete="off"
          inputMode="text"
          required
          minLength={3}
          maxLength={32}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="contoh: 12345678"
          disabled={submitting}
        />
      </FormField>

      {feedback ? <Banner kind={feedback.kind}>{feedback.message}</Banner> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitting ? 'Memverifikasi...' : isRetry ? 'Coba Verifikasi Lagi' : 'Daftar & Verifikasi'}
        </Button>
      </div>
    </form>
  );
}

function Banner({ kind = 'info', children }) {
  const tones = {
    success: 'bg-success-soft text-success ring-success/30',
    error: 'bg-danger-soft text-danger ring-danger/30',
    warning: 'bg-warning-soft text-warning ring-warning/30',
    info: 'bg-info-soft text-info ring-info/30'
  };
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${
        tones[kind] || tones.info
      }`}
    >
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-4 px-5 py-2.5">
      <dt className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted-fg">{label}</dt>
      <dd className="flex-1 text-sm text-fg">{children}</dd>
    </div>
  );
}

function statusBadge(status) {
  const tone = {
    verified: 'bg-success-soft text-success ring-success/30',
    pending: 'bg-warning-soft text-warning ring-warning/30',
    failed: 'bg-danger-soft text-danger ring-danger/30',
    removed: 'bg-surface-2 text-muted-fg ring-border'
  }[status] || 'bg-surface-2 text-muted-fg ring-border';
  const label = {
    verified: 'Terverifikasi',
    pending: 'Menunggu',
    failed: 'Gagal',
    removed: 'Dicabut'
  }[status] || status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  );
}

const STATUS_MAP = {
  verified: {
    icon: ShieldCheck,
    title: 'Terverifikasi',
    subtitle: 'Role IB sudah dikasih ke akun Discord kamu.',
    headerClass: 'bg-success-soft text-success'
  },
  pending: {
    icon: Clock,
    title: 'Menunggu Verifikasi',
    subtitle: 'Bot akan cek lagi otomatis setiap beberapa menit.',
    headerClass: 'bg-warning-soft text-warning'
  },
  failed: {
    icon: ShieldAlert,
    title: 'Verifikasi Gagal',
    subtitle: 'Cek nomor akun & status deposit, lalu coba lagi.',
    headerClass: 'bg-danger-soft text-danger'
  },
  removed: {
    icon: XCircle,
    title: 'Role Sudah Dicabut',
    subtitle: 'Daftar ulang kalau kamu sudah aktif trading lagi.',
    headerClass: 'bg-surface-2 text-muted-fg'
  }
};

function DiscordIcon(props) {
  // Simple inline mark so we don't need to add a new asset.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.166.298-.36.7-.493 1.018a18.27 18.27 0 0 0-5.13 0A12.6 12.6 0 0 0 10.44 3a19.74 19.74 0 0 0-3.76 1.37C2.94 9.046 2.02 13.58 2.43 18.06a19.93 19.93 0 0 0 6.06 3.07c.49-.66.92-1.36 1.29-2.1-.71-.27-1.39-.6-2.04-.99.17-.13.33-.26.49-.4 3.92 1.81 8.18 1.81 12.06 0 .16.14.32.27.49.4-.65.39-1.33.72-2.04.99.37.74.8 1.44 1.29 2.1a19.94 19.94 0 0 0 6.06-3.07c.5-5.18-.83-9.67-3.77-13.69ZM9.68 15.33c-1.18 0-2.16-1.08-2.16-2.4 0-1.32.96-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.32-.96 2.4-2.16 2.4Zm7.97 0c-1.19 0-2.16-1.08-2.16-2.4 0-1.32.96-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.32-.96 2.4-2.16 2.4Z" />
    </svg>
  );
}

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function mapRegisterError(err) {
  if (!(err instanceof ApiError)) return 'Gagal memproses pendaftaran.';
  switch (err.code) {
    case 'unauthenticated':
      return 'Sesi habis. Login ulang dengan Discord.';
    case 'ib_disabled':
      return 'Sistem IB belum aktif di server.';
    case 'missing_account_number':
      return 'Nomor akun wajib diisi.';
    case 'invalid_account_format':
      return 'Format akun salah. Hanya boleh huruf, angka, dan tanda hubung.';
    case 'invalid_account_length':
      return 'Panjang akun harus 3–32 karakter.';
    case 'different_account_already_registered':
      return `Kamu sudah pernah daftar dengan nomor akun ${
        err.body?.existingBrokerAccountNumber || 'lain'
      }. Hubungi admin untuk reset.`;
    case 'not_in_server':
      return 'Kamu harus join server Discord dulu sebelum daftar.';
    case 'too_many_requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa menit.';
    default:
      return err.message || 'Gagal memproses pendaftaran.';
  }
}
