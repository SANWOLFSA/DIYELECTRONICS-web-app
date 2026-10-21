import { useEffect } from 'react';
import { ArrowLeft, Lock, Wrench, BookOpen, Info, HelpCircle, Heart } from 'lucide-react';
import type { UserProfile } from '../types';
import AuthPanel from './AuthPanel';
import { announceLoginSuccess } from '../lib/signInGate';
import { navigate } from '../hooks/usePathname';

const PENDING_KEY = 'diy_signin_wall_open';

/** True after a page reload that happened while the wall was open (Google redirect sign-in on mobile). */
export function signInWallWasOpen(): boolean {
  try { return sessionStorage.getItem(PENDING_KEY) === '1'; } catch { return false; }
}

/**
 * Full-screen "Sign in to continue" panel shown to guests on gated pages and actions.
 * Same frosted-glass look as the landing page. Sign-in happens in place, so the user stays on
 * the page they wanted (the URL never changes); Back returns them to where they came from.
 */
export default function LoginWall({
  reason,
  onBack,
  onDismiss,
  onLoginSuccess,
}: {
  reason?: string | null;
  onBack: () => void;
  /** Closes the panel without navigating (used before jumping to a free preview page). */
  onDismiss?: () => void;
  onLoginSuccess?: (user: UserProfile) => void;
}) {
  const bgImage = '/background.jpg';

  // Remember the wall is open so a redirect-based Google sign-in can finish here after the reload.
  useEffect(() => {
    try { sessionStorage.setItem(PENDING_KEY, '1'); } catch { /* ignore */ }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => {
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onBack]);

  const openPreview = (path: string) => {
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
    onDismiss?.();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto text-white font-sans"
      style={{ backgroundImage: `url("${bgImage}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0d0b0a' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-wall-title"
    >
      <div className="absolute inset-0 bg-stone-950/45 backdrop-blur-[2px] pointer-events-none" />

      <header className="relative z-10 w-full px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/25 bg-black/30 backdrop-blur text-xs font-semibold text-white hover:bg-black/45 transition-colors shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight drop-shadow">
          <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md"><Wrench className="w-4 h-4 text-slate-950" /></span>
          DIY Electronics
        </span>
      </header>

      <main className="relative z-10 flex items-start sm:items-center justify-center px-4 pb-10 pt-2 sm:py-8 min-h-[calc(100dvh-4.5rem)]">
        <div className="w-full max-w-md">
          <div className="dark bg-black/30 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/30 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-md mb-3">
                <Lock className="w-6 h-6 text-slate-950" />
              </div>
              <h1 id="login-wall-title" className="text-2xl font-extrabold tracking-tight">Sign in to continue</h1>
              <p className="mt-1.5 text-sm text-white/80 max-w-xs">
                {reason || 'This part of DIY Electronics is for members. It is free: sign in or create an account and you will be taken right back here.'}
              </p>
            </div>
            <AuthPanel
              showGuest={false}
              customBackground={bgImage}
              onLoginSuccess={(user) => {
                announceLoginSuccess(user);
                onLoginSuccess?.(user);
              }}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-black/30 backdrop-blur-sm border border-white/15 p-3">
            <p className="text-[11px] text-white/75 text-center mb-2">Free to browse without an account</p>
            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <button type="button" onClick={() => openPreview('/theory#/theory/book')} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-white/10"><BookOpen className="w-4 h-4" />Theory preview</button>
              <button type="button" onClick={() => openPreview('/help')} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-white/10"><HelpCircle className="w-4 h-4" />Help</button>
              <button type="button" onClick={() => openPreview('/about')} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-white/10"><Info className="w-4 h-4" />About</button>
              <button type="button" onClick={() => openPreview('/support')} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 hover:bg-white/10"><Heart className="w-4 h-4" />Support</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
