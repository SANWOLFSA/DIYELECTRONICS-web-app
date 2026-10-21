/**
 * "Ownership Agreement" for FRP / unlock / account-removal content.
 * Before someone first watches or opens a community video or guide about FRP, bypassing, unlocking,
 * Google / iCloud account removal (or similar), they must tick the box and press "I Agree".
 * Uploaders of such content confirm it every time they share it.
 * Acceptance is kept in localStorage (with a timestamp) and, when signed in, on
 * users/{uid}.ownershipAgreementAt (the owner may write that field: see firestore.rules).
 */
import { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

export const OWNERSHIP_AGREEMENT_TITLE = 'Ownership Agreement — FRP & Unlock Guides';
export const OWNERSHIP_AGREEMENT_INTRO = 'By continuing you confirm that:';
export const OWNERSHIP_AGREEMENT_CLAUSES = [
  'You will only use these guides on a phone or device you own, or one you have the owner\'s written permission to repair.',
  'You will never use them on a lost, stolen or found device. If you have a device that isn\'t yours, return it to the owner or the police.',
  'Guides and videos are posted by community members and belong to them. DIY Electronics does not make, check or endorse them, and isn\'t responsible for how they\'re used.',
  'Misusing these guides may be a crime in your country, and you alone are responsible for your actions.',
  'We may remove content and suspend accounts that break these rules, and we co-operate with lawful requests from authorities.',
];
/** Shown under the clauses: DIY Electronics is not accountable for how the help is used. */
export const OWNERSHIP_AGREEMENT_NOTICE = 'DIY Electronics provides this help as-is and is not accountable for how you use it: any action you take on a device is your own responsibility.';
export const OWNERSHIP_AGREEMENT_CHECKBOX = 'I own this device or have the owner\'s permission, and I agree to these terms.';
export const OWNERSHIP_UPLOAD_CHECKBOX = 'I am sharing this only to help people repair devices they own or are authorised to repair.';

const KEY = 'diy_ownership_agreement_at';
const EVENT = 'app:ownership-accepted';

const STRONG = /\b(frp|factory[\s-]?reset[\s-]?protection|icloud|activation[\s-]?lock|google[\s-]?(account[\s-]?)?(lock|verification|removal|remove|bypass)|samsung[\s-]?account[\s-]?(removal|remove|bypass)|mi[\s-]?account|knox[\s-]?guard|mdm[\s-]?(bypass|removal|remove)|account[\s-]?(removal|remove|bypass|unlock)|remove[\s-]+(the[\s-]+)?(google|gmail|icloud|apple|samsung|mi)[\s-]?(id|account)|(sim|carrier|network|bootloader|pattern|pin|password|passcode|screen)[\s-]?(lock|unlock)|jailbreak)\b/i;
const WEAK = /\b(bypass(ing|ed)?|unlock(ing|ed|er)?)\b/i;
// "Bypass capacitor" and friends are ordinary electronics words, not lock bypasses.
const BENIGN = /\bbypass(ing)?[\s-]+(cap|caps|capacitor|capacitors|diode|resistor|valve|switch|mode|relay|fuse|thermostat)\b/gi;

/** True when a title / tags / summary is about FRP, unlocking, account removal or similar. */
export function isOwnershipSensitive(...texts: (string | undefined | null)[]): boolean {
  const t = texts.filter(Boolean).join(' \n ');
  if (!t) return false;
  if (STRONG.test(t)) return true;
  return WEAK.test(t.replace(BENIGN, ' '));
}

export function ownershipAcceptedAt(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function hasAcceptedOwnership(): boolean { return !!ownershipAcceptedAt(); }

/** Records acceptance on this device and, when signed in, on the user's profile. */
export async function acceptOwnershipAgreement(): Promise<void> {
  const at = new Date().toISOString();
  try { localStorage.setItem(KEY, at); } catch { /* storage full / private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { at } }));
  const u = isFirebaseConfigured ? auth.currentUser : null;
  if (u) {
    try { await setDoc(doc(db, 'users', u.uid), { ownershipAgreementAt: serverTimestamp() }, { merge: true }); }
    catch (e) { console.warn('Could not save ownershipAgreementAt:', e); }
  }
}

/** Called with users/{uid} data after sign-in: acceptance on another device counts here too. */
export function syncOwnershipFromProfile(data: Record<string, any> | undefined | null) {
  const v = data?.ownershipAgreementAt;
  if (!v || hasAcceptedOwnership()) return;
  const ms = typeof v?.toMillis === 'function' ? v.toMillis() : Date.parse(String(v));
  try { localStorage.setItem(KEY, new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString()); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Live "has accepted" flag (updates in every component when the user agrees anywhere). */
export function useOwnershipAccepted(): boolean {
  const [ok, setOk] = useState(hasAcceptedOwnership);
  useEffect(() => {
    const on = () => setOk(hasAcceptedOwnership());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return ok;
}
