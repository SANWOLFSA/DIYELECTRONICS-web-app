/**
 * Guest preview + login wall.
 *
 * Guests (no Firebase sign-in) may browse the landing / home page, About, Help, Support and a
 * preview of the Theory book. Everything else asks them to sign in first. Pages and actions call
 * requestSignIn(); App shows the full-screen "Sign in to continue" panel and, after sign-in, the
 * user stays exactly where they were.
 *
 * When Firebase is not configured (local dev without .env) nobody can sign in, so the wall is off.
 */
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import type { UserProfile } from '../types';

export const SIGNIN_REQUIRED_EVENT = 'app:require-signin';
export const LOGIN_SUCCESS_EVENT = 'app:login-success';

/** Main tabs a guest may open. Every other tab (and every hub route) shows the login wall. */
export const GUEST_TABS = new Set(['home', 'about', 'help', 'support', 'theory', 'not_found']);

export const gateEnabled = isFirebaseConfigured;

/** True when the visitor is signed in with a real account (or the wall is off). */
export function isSignedIn(): boolean {
  return !gateEnabled || !!auth.currentUser;
}

/** Live signed-in state. `checked` turns true once Firebase has restored (or not) a session. */
export function useSignedIn(): { signedIn: boolean; checked: boolean } {
  const [state, setState] = useState(() => ({ signedIn: isSignedIn(), checked: !gateEnabled || !!auth.currentUser }));
  useEffect(() => {
    if (!gateEnabled) return;
    return onAuthStateChanged(auth, u => setState({ signedIn: !!u, checked: true }));
  }, []);
  return state;
}

export class SignInRequiredError extends Error {
  constructor(message = 'Please sign in to use this feature.') {
    super(message);
    this.name = 'SignInRequiredError';
  }
}

/** Opens the "Sign in to continue" panel. `reason` is a short line shown under the title. */
export function requestSignIn(reason?: string) {
  window.dispatchEvent(new CustomEvent(SIGNIN_REQUIRED_EVENT, { detail: { reason } }));
}

/** Use before a gated action: returns true when signed in, otherwise opens the wall. */
export function ensureSignedIn(reason?: string): boolean {
  if (isSignedIn()) return true;
  requestSignIn(reason);
  return false;
}

/** Lets the login wall hand the fresh profile to App (it owns the session state). */
export function announceLoginSuccess(profile: UserProfile) {
  window.dispatchEvent(new CustomEvent(LOGIN_SUCCESS_EVENT, { detail: { profile } }));
}

/** `Authorization: Bearer <Firebase ID token>` for the protected API routes ({} for guests). */
export async function authHeaders(): Promise<Record<string, string>> {
  const u = gateEnabled ? auth.currentUser : null;
  if (!u) return {};
  try {
    return { Authorization: `Bearer ${await u.getIdToken()}` };
  } catch {
    return {};
  }
}

/** Merges the auth header into fetch() options. */
export async function withAuth(init: RequestInit = {}): Promise<RequestInit> {
  const extra = await authHeaders();
  if (!Object.keys(extra).length) return init;
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return { ...init, headers };
}

/** fetch() for a protected route: guests get the wall (no request is sent), a 401 also opens it. */
export async function authedFetch(input: string, init: RequestInit = {}, reason?: string): Promise<Response> {
  if (!isSignedIn()) {
    requestSignIn(reason);
    throw new SignInRequiredError();
  }
  const res = await fetch(input, await withAuth(init));
  if (res.status === 401) requestSignIn(reason || 'Your session has ended. Please sign in again.');
  return res;
}
