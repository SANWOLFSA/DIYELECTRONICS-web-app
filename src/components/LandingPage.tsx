import { useEffect, useState } from 'react';
import { Moon, Sun, Wrench, BookOpen, Leaf } from 'lucide-react';
import type { UserProfile } from '../types';
import AuthPanel from './AuthPanel';
import { SESSION_EXPIRED_MESSAGE, clearSessionExpiredNotice, peekSessionExpiredNotice } from '../lib/session';

export default function LandingPage({
  onLoginSuccess,
  darkMode,
  onToggleDarkMode
}: {
  onLoginSuccess: (user: UserProfile) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  // Hardcoded permanent background image
  const bgImage = "/background.jpg";

  // Friendly notice after an automatic sign-out (session time limit reached).
  const [expiredNotice] = useState(() => (peekSessionExpiredNotice() ? SESSION_EXPIRED_MESSAGE : null));
  useEffect(() => {
    clearSessionExpiredNotice();
  }, []);

  // Compute background style properties dynamically to prevent excessive zoom and stretching
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url("${bgImage}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center center",
    backgroundColor: "#0d0b0a", // Deep matching charcoal background color
    backgroundSize: "cover"
  };

  return (
    <div
      className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300"
      style={bgStyle}
    >
      {/* Extremely light overlay to keep the background bright and fully visible */}
      <div className="absolute inset-0 bg-stone-950/20 dark:bg-stone-950/40 transition-colors duration-200 pointer-events-none" />

      
      <header className="relative z-10 w-full px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-white flex items-center justify-center shadow-md">
            <Wrench className="w-4.5 h-4.5 text-slate-950" />
          </div>
          <div className="min-w-0">
            <span className="block text-[15px] font-semibold tracking-tight text-white leading-none drop-shadow">DIY Electronics</span>
            <span className="block text-[11px] font-medium text-white/70 mt-1 drop-shadow">Repair bench</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/30 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-md"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          {/* Frosted, see-through panel so the background picture shows through. The "dark" class makes the
              form inside use its light-on-dark styles (white text) regardless of the app theme. */}
          <div className="dark bg-black/30 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/30 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-950 dark:bg-white flex items-center justify-center shadow-md">
                <Wrench className="w-6 h-6 text-white dark:text-slate-950" />
              </div>
            </div>
            <AuthPanel onLoginSuccess={onLoginSuccess} customBackground={bgImage} notice={expiredNotice} />
          </div>

          <ul className="mt-4 grid grid-cols-3 gap-2 text-[11px] sm:text-xs text-white/90">
            <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl bg-black/30 backdrop-blur-sm px-2 py-2 text-center">
              <BookOpen className="w-4 h-4 text-white/80" />
              <span>Repair guides</span>
            </li>
            <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl bg-black/30 backdrop-blur-sm px-2 py-2 text-center">
              <Wrench className="w-4 h-4 text-white/80" />
              <span>Diagnostics</span>
            </li>
            <li className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl bg-black/30 backdrop-blur-sm px-2 py-2 text-center">
              <Leaf className="w-4 h-4 text-white/80" />
              <span>Less e-waste</span>
            </li>
          </ul>
        </div>
      </main>

      <footer className="relative z-10 py-4 px-4 text-center text-[11px] text-white/80 bg-black/20 backdrop-blur-sm">
        © {new Date().getFullYear()} DIY Electronics · Right to Repair
      </footer>
    </div>
  );
}
