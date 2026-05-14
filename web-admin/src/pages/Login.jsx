import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { ApiError } from '../api.js';
import { Button } from '../components/ui/Button.jsx';
import { Input, FormField } from '../components/ui/Input.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const redirectTo = (location.state && location.state.from) || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'invalid_credentials') {
          setError('Username atau password salah.');
        } else if (err.code === 'too_many_login_attempts') {
          setError('Terlalu banyak percobaan login. Coba lagi 15 menit lagi.');
        } else if (err.code === 'missing_credentials') {
          setError('Username dan password wajib diisi.');
        } else {
          setError(err.message || 'Login gagal.');
        }
      } else {
        setError('Login gagal. Coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      {/* Decorative gradient blobs */}
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
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="surface p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg text-xl font-bold shadow-soft">
              Q
            </div>
            <h1 className="text-lg font-semibold text-fg">QTAssist Admin</h1>
            <p className="mt-1 text-sm text-muted-fg">Login dengan kredensial admin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField label="Username" htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                required
                leadingIcon={User}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                placeholder="admin"
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  leadingIcon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-fg hover:text-fg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            {error ? (
              <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-inset ring-danger/30">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full" loading={submitting}>
              {submitting ? 'Logging in...' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-fg">
          QTrades · Internal admin tools
        </p>
      </div>
    </div>
  );
}
