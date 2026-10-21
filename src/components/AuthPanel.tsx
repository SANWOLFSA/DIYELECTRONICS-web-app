import { useEffect, useState } from 'react';
import { Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Compass, Info } from 'lucide-react';
import type { UserProfile } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  completeRedirectSignIn,
  enterAsGuest,
  friendlyAuthError,
  requestPasswordReset,
  signInWithEmail,
  signInWithSocial,
  signUpWithEmail,
  type SocialProvider
} from '../lib/authFlow';

type Mode = 'signin' | 'signup' | 'reset';
type Busy = null | 'email' | 'google' | 'facebook' | 'guest' | 'reset' | 'redirect';

const inputClass =
  'w-full pl-11 pr-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 ' +
  'text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-60';

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/**
 * The sign-in / sign-up / password-reset form used on the welcome page and in the
 * in-app auth modal. Never assigns admin: new accounts are Technicians, guests are Guests.
 */
export default function AuthPanel({
  onLoginSuccess,
  customBackground,
  showGuest = true,
  notice,
  initialMode = 'signin'
}: {
  onLoginSuccess: (user: UserProfile) => void;
  customBackground?: string;
  showGuest?: boolean;
  /** Optional banner shown above the form (e.g. "session expired"). */
  notice?: string | null;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const loading = busy !== null;
  const cloudDisabled = !isFirebaseConfigured;

  // Pick up a redirect-based Google/Facebook sign-in (popup fallback on mobile).
  useEffect(() => {
    if (cloudDisabled) return;
    let cancelled = false;
    setBusy('redirect');
    completeRedirectSignIn(customBackground)
      .then(profile => {
        if (!cancelled && profile) onLoginSuccess(profile);
      })
      .catch(err => {
        if (!cancelled) setError(friendlyAuthError(err));
      })
      .finally(() => {
        if (!cancelled) setBusy(prev => (prev === 'redirect' ? null : prev));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<UserProfile | null | void>) => {
    setError('');
    setSuccess('');
    setBusy(kind);
    try {
      const profile = await action();
      if (profile) onLoginSuccess(profile);
    } catch (err) {
      console.warn('[auth]', err);
      setError(friendlyAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode === 'reset') {
      void run('reset', async () => {
        try {
          await requestPasswordReset(trimmedEmail);
        } catch (err) {
          // Don't reveal whether an account exists for this email.
          if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
        }
        setSuccess(`If an account exists for ${trimmedEmail}, a reset link is on its way. Check your inbox and spam folder.`);
      });
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please tell us your name.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Choose a stronger password: at least 6 characters.');
      return;
    }
    void run('email', () =>
      mode === 'signup'
        ? signUpWithEmail(name, trimmedEmail, password, customBackground)
        : signInWithEmail(trimmedEmail, password, customBackground)
    );
  };

  const handleSocial = (which: SocialProvider) => run(which, () => signInWithSocial(which, customBackground));
  const handleGuest = () => run('guest', () => enterAsGuest(customBackground));

  const title = mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
  const subtitle =
    mode === 'signup'
      ? 'Save guides, track repairs and join the community.'
      : mode === 'reset'
        ? "Enter your email and we'll send you a reset link."
        : 'Sign in to your repair bench.';

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      {mode !== 'reset' && (
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              disabled={loading}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-2 text-sm text-indigo-800 dark:text-indigo-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {cloudDisabled && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Online accounts are unavailable right now. You can still explore as a guest.</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {mode === 'signup' && (
          <label className="relative block">
            <span className="sr-only">Full name</span>
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
            <input
              disabled={loading || cloudDisabled}
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </label>
        )}

        <label className="relative block">
          <span className="sr-only">Email address</span>
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          <input
            disabled={loading || cloudDisabled}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className={inputClass}
          />
        </label>

        {mode !== 'reset' && (
          <label className="relative block">
            <span className="sr-only">Password</span>
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
            <input
              disabled={loading || cloudDisabled}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </label>
        )}

        {mode === 'signin' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || cloudDisabled}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy === 'email' || busy === 'reset' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{mode === 'reset' ? 'Sending link…' : mode === 'signup' ? 'Creating account…' : 'Signing in…'}</span>
            </>
          ) : (
            <>
              <span>{mode === 'reset' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="w-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← Back to sign in
          </button>
        )}
      </form>

      {mode !== 'reset' && (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400 dark:text-slate-500">or continue with</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading || cloudDisabled}
              onClick={() => handleSocial('google')}
              className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy === 'google' || busy === 'redirect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              <span>Google</span>
            </button>
            <button
              type="button"
              disabled={loading || cloudDisabled}
              onClick={() => handleSocial('facebook')}
              className="py-2.5 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy === 'facebook' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FacebookIcon />}
              <span>Facebook</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-300">
            {mode === 'signup' ? 'By creating an account' : 'By continuing'} you agree to the <a href="/terms" target="_blank" rel="noopener" className="underline font-semibold">Terms of Use</a> and confirm you are 13 or older (under 18 with a parent or guardian's consent).
          </p>

          {showGuest && (
            <div className="pt-1 space-y-1.5">
              <button
                type="button"
                disabled={loading}
                onClick={handleGuest}
                className="w-full py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy === 'guest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
                <span>Explore as a guest</span>
              </button>
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Browse guides and tools without an account. Nothing is saved to the cloud.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
