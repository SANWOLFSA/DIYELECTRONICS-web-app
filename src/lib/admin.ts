/**
 * Admin detection for the UI.
 *
 * REAL authority lives in firestore.rules / storage.rules. This module only
 * decides whether admin UI is rendered at all. A user counts as admin in the
 * UI when (with a real Firebase Auth session):
 *   - their ID token has the custom claim `admin: true`, or
 *   - a Firestore doc exists at `admins/{uid}`, or
 *   - `users/{uid}.role === 'admin'` (lower-case; users cannot set this — rules)
 * Bootstrap: an email listed in VITE_ADMIN_EMAILS also sees the admin UI, but
 * every admin write will be rejected by the rules until one of the above is
 * true. AdminDesk shows the exact setup steps in that case.
 */
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

export interface AdminStatus {
  /** Render admin UI (rules admin OR bootstrap email). */
  isAdmin: boolean;
  /** Confirmed by a claim / admins doc / users.role — rules will accept writes. */
  rulesAdmin: boolean;
  /** Only VITE_ADMIN_EMAILS matched: UI shows, but rules will deny. */
  bootstrapOnly: boolean;
  uid: string | null;
  email: string | null;
  loading: boolean;
}

const NOT_ADMIN: AdminStatus = {
  isAdmin: false,
  rulesAdmin: false,
  bootstrapOnly: false,
  uid: null,
  email: null,
  loading: false,
};

/** Owner accounts that always see the admin UI (merged with VITE_ADMIN_EMAILS). */
export const DEFAULT_ADMIN_EMAILS = ['sbheko1@gmail.com', 'diy.electronicsa@gmail.com', 'sanwolfza@gmail.com'];

function bootstrapEmails(): string[] {
  const raw = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || '';
  const fromEnv = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv])];
}

async function checkRulesAdmin(user: User): Promise<boolean> {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch {
    /* ignore */
  }
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    if (adminDoc.exists()) return true;
  } catch {
    /* permission denied / offline → not confirmed */
  }
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data()?.role === 'admin') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Live Firebase Auth user (null for signed-out / demo sessions). */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(() => (isFirebaseConfigured ? auth.currentUser : null));
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);
  return user;
}

export function useAdminStatus(): AdminStatus {
  const user = useAuthUser();
  const [status, setStatus] = useState<AdminStatus>(NOT_ADMIN);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStatus(NOT_ADMIN);
      return;
    }
    const email = (user.email || '').toLowerCase();
    const isBootstrap = !!email && bootstrapEmails().includes(email);
    setStatus({ ...NOT_ADMIN, uid: user.uid, email: user.email, loading: true });
    checkRulesAdmin(user).then(rulesAdmin => {
      if (cancelled) return;
      setStatus({
        isAdmin: rulesAdmin || isBootstrap,
        rulesAdmin,
        bootstrapOnly: !rulesAdmin && isBootstrap,
        uid: user.uid,
        email: user.email,
        loading: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return status;
}
