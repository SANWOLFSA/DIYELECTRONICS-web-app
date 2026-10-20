// Visitor analytics with Firebase Analytics (Google Analytics 4). Loaded lazily and only where
// supported (not in browsers that block it), so it never slows the first paint or breaks the app.
// Page views are logged on every in-app route change; see the Firebase console > Analytics.
import { firebaseApp, isFirebaseConfigured } from './firebase';

type AnalyticsMod = typeof import('firebase/analytics');
let ready: Promise<{ mod: AnalyticsMod; analytics: import('firebase/analytics').Analytics } | null> | null = null;

export function initAnalytics() {
  if (ready || !isFirebaseConfigured || typeof window === 'undefined') return ready;
  ready = import('firebase/analytics')
    .then(async (mod) => {
      if (!(await mod.isSupported())) return null;
      // Automatic page_view is off: this is a single-page app, so we log page views ourselves.
      const analytics = mod.initializeAnalytics(firebaseApp, { config: { send_page_view: false } });
      return { mod, analytics };
    })
    .catch((err) => {
      console.warn('[analytics] not available:', err?.message || err);
      return null;
    });
  return ready;
}

let lastPath = '';
export function logPageView(pageTitle?: string) {
  const path = window.location.pathname + window.location.hash;
  if (path === lastPath) return;
  lastPath = path;
  void initAnalytics()?.then((a) => {
    if (!a) return;
    a.mod.logEvent(a.analytics, 'page_view', {
      page_location: window.location.href,
      page_path: path,
      page_title: pageTitle || document.title,
    });
  });
}

export function logAppEvent(name: string, params?: Record<string, string | number | boolean>) {
  void initAnalytics()?.then((a) => { if (a) a.mod.logEvent(a.analytics, name, params); });
}
