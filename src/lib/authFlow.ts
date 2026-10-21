import type { User as FirebaseUser } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { TERMS_VERSION } from '../config/terms';
import { auth, db, isFirebaseConfigured } from './firebase';
import { startSession } from './session';
import type { UserProfile } from '../types';

// Neutral silhouette rather than a stock photo of a real person.
import { NEUTRAL_AVATAR } from './avatar';
export const DEFAULT_AVATAR = NEUTRAL_AVATAR;

/** Role given to every self-registered account. Admin is never self-assigned. */
export const DEFAULT_ROLE = 'Technician';
export const GUEST_ROLE = 'Guest';
export const GUEST_PROVIDER = 'Guest';

export function isGuestProfile(p: Pick<UserProfile, 'authProvider'> | null | undefined): boolean {
  return !!p && p.authProvider === GUEST_PROVIDER;
}

/**
 * Load users/{uid}; create a minimal Technician profile if it is missing.
 * Firestore problems never block sign-in: we fall back to a local profile.
 */
export async function loadOrCreateProfile(
  fbUser: FirebaseUser,
  opts: { name?: string; provider: string; customBackground?: string }
): Promise<UserProfile> {
  const fallback: UserProfile = {
    id: fbUser.uid,
    name: opts.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'Technician',
    email: fbUser.email || '',
    authProvider: opts.provider,
    avatar: fbUser.photoURL || DEFAULT_AVATAR,
    role: DEFAULT_ROLE,
    repairsCompleted: 0,
    eWasteDivertedKg: 0,
    co2SavedKg: 0,
    reputationPoints: 100,
    badges: [],
    completedCourseIds: [],
    savedGuideIds: [],
    ...(opts.customBackground ? { customBackground: opts.customBackground } : {})
  };

  const ref = doc(db, 'users', fbUser.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      // Signing in = accepting the current Terms of Use ("By continuing you agree…"): record the version.
      if (snap.data()?.termsVersion !== TERMS_VERSION) {
        setDoc(ref, { termsVersion: TERMS_VERSION, termsAcceptedAt: serverTimestamp() }, { merge: true })
          .catch((err) => console.warn('[auth] Could not record terms acceptance.', err));
      }
      return { ...fallback, ...(snap.data() as Partial<UserProfile>), id: fbUser.uid };
    }
  } catch (err) {
    console.warn('[auth] Could not read user profile, continuing with a local profile.', err);
    return fallback;
  }

  try {
    // New account: store which Terms of Use version was accepted at sign-up, and when.
    await setDoc(ref, { ...fallback, termsVersion: TERMS_VERSION, termsAcceptedAt: serverTimestamp() });
  } catch (err) {
    console.warn('[auth] Could not save new user profile to Firestore.', err);
  }
  return fallback;
}

/** A limited, local-only guest session. Never an admin, nothing synced to the cloud. */
export function createGuestProfile(customBackground?: string): UserProfile {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `guest_${suffix}`,
    name: 'Guest Technician',
    email: '',
    authProvider: GUEST_PROVIDER,
    avatar: DEFAULT_AVATAR,
    role: GUEST_ROLE,
    repairsCompleted: 0,
    eWasteDivertedKg: 0,
    co2SavedKg: 0,
    reputationPoints: 0,
    badges: [],
    completedCourseIds: [],
    savedGuideIds: [],
    ...(customBackground ? { customBackground } : {})
  };
}

/** Turn Firebase auth errors into short, friendly sentences. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return "That email and password don't match. Check them and try again, or reset your password.";
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password: at least 6 characters.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return "We couldn't reach the server. Check your internet connection and try again.";
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already linked to a different sign-in method. Use the method you signed up with.';
    case 'auth/unauthorized-domain':
      return "Sign-in isn't enabled for this web address yet. Please use the official site or continue as a guest.";
    case 'auth/operation-not-allowed':
      return "This sign-in method isn't switched on yet. Please use another option or continue as a guest.";
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return 'Online sign-in is temporarily unavailable. You can still continue as a guest.';
    default:
      return 'Something went wrong while signing in. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Sign-in actions shared by the welcome page and the in-app auth modal.
// Each successful action records a fresh session start (see session.ts).
// ---------------------------------------------------------------------------

export type SocialProvider = 'google' | 'facebook';

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google SSO',
  facebook: 'Facebook SSO'
};

export async function signInWithEmail(email: string, password: string, customBackground?: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await loadOrCreateProfile(cred.user, { provider: 'Email Credentials', customBackground });
  startSession();
  return profile;
}

export async function signUpWithEmail(name: string, email: string, password: string, customBackground?: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    await updateProfile(cred.user, { displayName: name.trim() });
  } catch {
    /* display name is cosmetic */
  }
  const profile = await loadOrCreateProfile(cred.user, {
    name: name.trim(),
    provider: 'Email Credentials',
    customBackground
  });
  startSession();
  return profile;
}

/**
 * Popup sign-in. If the browser blocks popups (common on mobile) we fall back to a
 * full-page redirect; the result is picked up by completeRedirectSignIn() on return.
 * Returns null when a redirect was started.
 */
export async function signInWithSocial(which: SocialProvider, customBackground?: string) {
  const provider = which === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
  if (which === 'google') provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    const profile = await loadOrCreateProfile(cred.user, { provider: PROVIDER_LABEL[which], customBackground });
    startSession();
    return profile;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/** Finish a redirect-based social sign-in, if one is pending. */
export async function completeRedirectSignIn(customBackground?: string) {
  if (!isFirebaseConfigured) return null;
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const providerId = result.providerId || '';
  const label = providerId.includes('facebook') ? PROVIDER_LABEL.facebook : PROVIDER_LABEL.google;
  const profile = await loadOrCreateProfile(result.user, { provider: label, customBackground });
  startSession();
  return profile;
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Start a limited local guest session (signs out any lingering Firebase user first). */
export async function enterAsGuest(customBackground?: string) {
  if (isFirebaseConfigured && auth.currentUser) {
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
  }
  const profile = createGuestProfile(customBackground);
  startSession();
  return profile;
}
