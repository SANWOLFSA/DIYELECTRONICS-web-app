/**
 * Repair hub data layer (Firestore). One-stop "iFixit-style" community content:
 *
 *   guides/{guideId}                     user-authored step-by-step guides & teardowns (draft | published | removed)
 *   guideCompletions/{guideId}_{uid}     "I fixed it" marks (one per user, batched with completedCount)
 *   guideComments/{commentId}            comments on a guide or on one of its steps (stepIndex -1 = whole guide)
 *   questions/{questionId}               Answers: questions per device
 *   answers/{answerId}                   answers (questionId field), one may be accepted by the asker
 *   questionVotes/{questionId}_{uid}     one upvote per user (batched with voteCount)
 *   answerVotes/{answerId}_{uid}         one upvote per user (batched with voteCount)
 *   discoveredDevices/{slug}             universal device pages (AI-researched with sources, or user-added pending review)
 *   discoveredComponents/{partId}        universal component pages (AI-researched with sources)
 *   deviceRequests/{requestId}           "please add this device" requests
 *
 * See firestore.rules section 7 for exactly who may write what.
 * Device keys tie content to a device: catalog models use `cat~type~brand~model`,
 * universal device pages use `dev~slug`.
 */
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, where, writeBatch, increment,
  updateDoc, deleteDoc, setDoc, addDoc, type Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { slugify } from '../data/catalog/slug';
import { storage as localStore } from './storage';
import { auditData, auditRef, type Actor } from './marketplace';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export const DIFFICULTIES = ['Easy', 'Moderate', 'Advanced', 'Expert'] as const;
export type GuideDifficulty = (typeof DIFFICULTIES)[number];
export const GUIDE_KINDS = ['repair', 'replacement', 'teardown', 'technique'] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];
export const KIND_LABELS: Record<GuideKind, string> = {
  repair: 'Repair / troubleshooting',
  replacement: 'Part replacement',
  teardown: 'Teardown',
  technique: 'Technique / skill',
};

export const LIMITS = {
  title: 140,
  summary: 2000,
  stepTitle: 120,
  stepText: 3000,
  stepImages: 6,
  steps: 80,
  listItems: 40,
  itemLen: 120,
  comment: 1000,
  question: 5000,
  questionTitle: 160,
  answer: 5000,
};

export function millis(t?: Timestamp | null): number {
  const x = t as any;
  return x && typeof x.toMillis === 'function' ? x.toMillis() : 0;
}

export function timeAgo(ms: number): string {
  if (!ms) return 'just now';
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ms).toLocaleDateString('en-ZA', { dateStyle: 'medium' });
}

export function keywordsFor(...parts: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const p of parts) {
    for (const t of String(p || '').toLowerCase().split(/[^a-z0-9]+/)) {
      if (t.length >= 2 && t.length <= 30) set.add(t);
      if (set.size >= 40) break;
    }
  }
  return [...set].slice(0, 40);
}

/** Every term must appear somewhere in the haystack. */
export function matchesQuery(hay: string, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const h = hay.toLowerCase();
  return terms.length > 0 && terms.every((t) => h.includes(t));
}

export function isHttpsUrl(v: string): boolean {
  return /^https:\/\/[^\s]{4,}$/i.test(v.trim()) && v.trim().length <= 1000;
}

export const IMAGE_UPLOAD_UNAVAILABLE =
  'Photo uploads are not available on this build. Paste an image link (https://…) instead, e.g. a Wikimedia Commons, Imgur or shared Google Photos link.';

export interface Owner {
  uid: string;
  name: string;
}

export function ownerFrom(user: { uid: string; displayName: string | null; email: string | null }): Owner {
  const p = localStore.getUserProfile() as any;
  const local = p && (p.uid === user.uid || !p.uid) && p.name && p.name !== 'Guest' ? p.name : '';
  return { uid: user.uid, name: (user.displayName || local || (user.email ? user.email.split('@')[0] : '') || 'Community member').slice(0, 80) };
}

function requireDb() {
  if (!isFirebaseConfigured) throw new Error('This needs the cloud database, which is not configured for this build.');
}

export function friendlyHubError(e: unknown, action: string): string {
  const code = String((e as any)?.code || '');
  if (code === 'permission-denied') return `You don't have permission to ${action}. Make sure you're signed in.`;
  if (code === 'unauthenticated') return `Please sign in to ${action}.`;
  if (code === 'unavailable' || code === 'deadline-exceeded') return `Couldn't reach the server to ${action}. Check your connection.`;
  if (code === 'failed-precondition') return `The database needs an index for this view; please tell an admin. (${action})`;
  const msg = e instanceof Error ? e.message : '';
  return msg && !/firebase|firestore/i.test(msg) ? msg : `Something went wrong while trying to ${action}. Please try again.`;
}

// ---------------------------------------------------------------------------
// Device keys
// ---------------------------------------------------------------------------

export interface DeviceRef {
  key: string; // cat~type~brand~model | dev~slug
  label: string;
  path: string; // page URL for the device
}

export function catalogDeviceKey(typeSlug: string, brandSlug: string, modelSlug: string): string {
  return `cat~${typeSlug}~${brandSlug}~${modelSlug}`.slice(0, 200);
}
export function universalDeviceKey(slug: string): string {
  return `dev~${slug}`.slice(0, 200);
}
export const DEVICE_KEY_RE = /^(cat|dev|gen)~[a-z0-9~-]{1,190}$/;
/** Content not tied to one device (general skills, components...). */
export const GENERAL_DEVICE: DeviceRef = { key: 'gen~general', label: 'General / any device', path: '/guides' };

export function deviceRefFromSearch(search: URLSearchParams): DeviceRef | null {
  const key = search.get('device') || '';
  if (!DEVICE_KEY_RE.test(key)) return null;
  const label = (search.get('label') || '').slice(0, 200) || key;
  const path = (search.get('path') || '').startsWith('/') ? (search.get('path') || '').slice(0, 400) : '/devices';
  return { key, label, path };
}

export function deviceQueryString(d: DeviceRef): string {
  return `device=${encodeURIComponent(d.key)}&label=${encodeURIComponent(d.label)}&path=${encodeURIComponent(d.path)}`;
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

export interface GuideStep {
  title: string;
  text: string;
  imageUrls: string[];
  caution: string;
}

export type GuideStatus = 'draft' | 'published' | 'removed';

export interface HubGuide {
  id: string;
  title: string;
  summary: string;
  kind: GuideKind;
  deviceKey: string;
  deviceLabel: string;
  devicePath: string;
  difficulty: GuideDifficulty;
  minutes: number;
  tools: string[];
  parts: string[];
  steps: GuideStep[];
  coverUrl: string;
  /** Optional teardown / guide video (Firebase Storage download URL or https link). */
  videoUrl?: string;
  keywords: string[];
  status: GuideStatus;
  ownerUid: string;
  ownerName: string;
  completedCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  moderationReason?: string;
}

export interface GuideInput {
  title: string;
  summary: string;
  kind: GuideKind;
  device: DeviceRef;
  difficulty: GuideDifficulty;
  minutes: number;
  tools: string[];
  parts: string[];
  steps: GuideStep[];
  coverUrl: string;
  videoUrl?: string;
}

const cleanList = (l: string[], max = LIMITS.listItems, len = LIMITS.itemLen) =>
  l.map((s) => s.trim()).filter(Boolean).slice(0, max).map((s) => s.slice(0, len));

export function validateGuide(g: GuideInput, publishing: boolean): string | null {
  if (!g.title.trim()) return 'Give the guide a title.';
  if (!DEVICE_KEY_RE.test(g.device.key)) return 'Choose the device this guide is for.';
  if (g.coverUrl && !isHttpsUrl(g.coverUrl)) return 'The cover image must be an https:// link.';
  if (g.videoUrl && !isHttpsUrl(g.videoUrl)) return 'The video must be an uploaded file or an https:// link.';
  for (const [i, s] of g.steps.entries()) {
    for (const u of s.imageUrls) if (u && !isHttpsUrl(u)) return `Step ${i + 1}: image links must start with https://`;
  }
  if (publishing) {
    const real = g.steps.filter((s) => s.text.trim() || s.title.trim());
    if (real.length === 0) return 'Add at least one step before publishing.';
    if (!g.summary.trim()) return 'Write a short introduction before publishing.';
    // Teardowns are photo-led: every step needs at least one photo.
    if (g.kind === 'teardown') {
      const missing = g.steps
        .map((s, i) => ({ i, real: !!(s.text.trim() || s.title.trim()), photos: s.imageUrls.filter((u) => u && isHttpsUrl(u)).length }))
        .filter((x) => x.real && x.photos === 0)
        .map((x) => x.i + 1);
      if (missing.length) return `Add at least one photo to step${missing.length > 1 ? 's' : ''} ${missing.join(', ')}. Every teardown step needs a photo.`;
    }
  }
  if (!(g.minutes > 0 && g.minutes <= 10000)) return 'Time required must be between 1 and 10000 minutes.';
  return null;
}

function guideDoc(g: GuideInput, status: 'draft' | 'published') {
  const steps = g.steps
    .filter((s) => s.title.trim() || s.text.trim() || s.imageUrls.some(Boolean))
    .slice(0, LIMITS.steps)
    .map((s) => ({
      title: s.title.trim().slice(0, LIMITS.stepTitle),
      text: s.text.trim().slice(0, LIMITS.stepText),
      imageUrls: s.imageUrls.map((u) => u.trim()).filter(isHttpsUrl).slice(0, LIMITS.stepImages),
      caution: s.caution.trim().slice(0, 500),
    }));
  return {
    title: g.title.trim().slice(0, LIMITS.title),
    summary: g.summary.trim().slice(0, LIMITS.summary),
    kind: g.kind,
    deviceKey: g.device.key,
    deviceLabel: g.device.label.slice(0, 200),
    devicePath: g.device.path.slice(0, 400),
    difficulty: g.difficulty,
    minutes: Math.round(g.minutes),
    tools: cleanList(g.tools),
    parts: cleanList(g.parts),
    steps,
    coverUrl: isHttpsUrl(g.coverUrl) ? g.coverUrl.trim() : '',
    videoUrl: g.videoUrl && isHttpsUrl(g.videoUrl) ? g.videoUrl.trim() : '',
    keywords: keywordsFor(g.title, g.device.label, g.kind, ...g.parts.slice(0, 10)),
    status,
  };
}

export async function createGuide(g: GuideInput, owner: Owner, publish: boolean): Promise<string> {
  requireDb();
  const err = validateGuide(g, publish);
  if (err) throw new Error(err);
  const ref = doc(collection(db, 'guides'));
  await setDoc(ref, {
    ...guideDoc(g, publish ? 'published' : 'draft'),
    ownerUid: owner.uid,
    ownerName: owner.name,
    completedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGuide(id: string, g: GuideInput, publish: boolean): Promise<void> {
  requireDb();
  const err = validateGuide(g, publish);
  if (err) throw new Error(err);
  await updateDoc(doc(db, 'guides', id), { ...guideDoc(g, publish ? 'published' : 'draft'), updatedAt: serverTimestamp() });
}

export async function deleteGuide(id: string): Promise<void> {
  requireDb();
  await deleteDoc(doc(db, 'guides', id));
}

function snapList<T>(snap: { forEach: (cb: (d: any) => void) => void }): T[] {
  const out: T[] = [];
  snap.forEach((d) => out.push({ ...(d.data() as T), id: d.id }));
  return out;
}

const byNewest = <T extends { createdAt?: Timestamp }>(a: T, b: T) => millis(b.createdAt) - millis(a.createdAt);

export function subscribePublishedGuides(cb: (g: HubGuide[]) => void, onError?: (e: unknown) => void, max = 300) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'guides'), where('status', '==', 'published'), limit(max)),
    (s) => cb(snapList<HubGuide>(s).sort(byNewest)), (e) => onError?.(e));
}

export function subscribeDeviceGuides(deviceKey: string, cb: (g: HubGuide[]) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'guides'), where('deviceKey', '==', deviceKey), where('status', '==', 'published'), limit(100)),
    (s) => cb(snapList<HubGuide>(s).sort((a, b) => b.completedCount - a.completedCount || byNewest(a, b))), (e) => onError?.(e));
}

export function subscribeMyGuides(uid: string, cb: (g: HubGuide[]) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'guides'), where('ownerUid', '==', uid), limit(200)),
    (s) => cb(snapList<HubGuide>(s).sort(byNewest)), (e) => onError?.(e));
}

export async function getGuide(id: string): Promise<HubGuide | null> {
  requireDb();
  const s = await getDoc(doc(db, 'guides', id));
  return s.exists() ? ({ ...(s.data() as HubGuide), id: s.id }) : null;
}

export function subscribeGuide(id: string, cb: (g: HubGuide | null) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb(null); return () => {}; }
  return onSnapshot(doc(db, 'guides', id), (s) => cb(s.exists() ? ({ ...(s.data() as HubGuide), id: s.id }) : null), (e) => onError?.(e));
}

// "I fixed it" -------------------------------------------------------------
export function subscribeCompletion(guideId: string, uid: string | null, cb: (done: boolean) => void) {
  if (!uid || !isFirebaseConfigured) { cb(false); return () => {}; }
  return onSnapshot(doc(db, 'guideCompletions', `${guideId}_${uid}`), (s) => cb(s.exists()), () => cb(false));
}

export async function setCompletion(guideId: string, uid: string, done: boolean): Promise<void> {
  requireDb();
  const batch = writeBatch(db);
  const markRef = doc(db, 'guideCompletions', `${guideId}_${uid}`);
  if (done) batch.set(markRef, { guideId, uid, createdAt: serverTimestamp() });
  else batch.delete(markRef);
  batch.update(doc(db, 'guides', guideId), { completedCount: increment(done ? 1 : -1) });
  await batch.commit();
}

// Comments -----------------------------------------------------------------
export interface GuideComment {
  id: string;
  guideId: string;
  stepIndex: number;
  body: string;
  ownerUid: string;
  ownerName: string;
  createdAt?: Timestamp;
}

export function subscribeGuideComments(guideId: string, cb: (c: GuideComment[]) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'guideComments'), where('guideId', '==', guideId), limit(500)),
    (s) => cb(snapList<GuideComment>(s).sort((a, b) => millis(a.createdAt) - millis(b.createdAt))), (e) => onError?.(e));
}

export async function addGuideComment(guideId: string, stepIndex: number, body: string, owner: Owner): Promise<void> {
  requireDb();
  const text = body.trim().slice(0, LIMITS.comment);
  if (!text) throw new Error('Write a comment first.');
  await addDoc(collection(db, 'guideComments'), { guideId, stepIndex, body: text, ownerUid: owner.uid, ownerName: owner.name, createdAt: serverTimestamp() });
}

export async function deleteGuideComment(id: string): Promise<void> {
  requireDb();
  await deleteDoc(doc(db, 'guideComments', id));
}

// ---------------------------------------------------------------------------
// Answers (Q&A)
// ---------------------------------------------------------------------------

export interface HubQuestion {
  id: string;
  title: string;
  body: string;
  deviceKey: string;
  deviceLabel: string;
  devicePath: string;
  ownerUid: string;
  ownerName: string;
  answerCount: number;
  voteCount: number;
  acceptedAnswerId: string;
  status: 'published' | 'removed';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface HubAnswer {
  id: string;
  questionId: string;
  body: string;
  ownerUid: string;
  ownerName: string;
  voteCount: number;
  status: 'published' | 'removed';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export async function askQuestion(title: string, body: string, device: DeviceRef, owner: Owner): Promise<string> {
  requireDb();
  if (!title.trim()) throw new Error('Write your question in the title.');
  if (!DEVICE_KEY_RE.test(device.key)) throw new Error('Choose the device this question is about.');
  const ref = doc(collection(db, 'questions'));
  await setDoc(ref, {
    title: title.trim().slice(0, LIMITS.questionTitle),
    body: body.trim().slice(0, LIMITS.question),
    deviceKey: device.key,
    deviceLabel: device.label.slice(0, 200),
    devicePath: device.path.slice(0, 400),
    ownerUid: owner.uid,
    ownerName: owner.name,
    answerCount: 0,
    voteCount: 0,
    acceptedAnswerId: '',
    status: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuestion(id: string, title: string, body: string): Promise<void> {
  requireDb();
  if (!title.trim()) throw new Error('The question needs a title.');
  await updateDoc(doc(db, 'questions', id), { title: title.trim().slice(0, LIMITS.questionTitle), body: body.trim().slice(0, LIMITS.question), updatedAt: serverTimestamp() });
}

export async function deleteQuestion(id: string): Promise<void> {
  requireDb();
  await deleteDoc(doc(db, 'questions', id));
}

export function subscribeQuestions(cb: (q: HubQuestion[]) => void, onError?: (e: unknown) => void, max = 300) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'questions'), where('status', '==', 'published'), limit(max)),
    (s) => cb(snapList<HubQuestion>(s).sort(byNewest)), (e) => onError?.(e));
}

export function subscribeDeviceQuestions(deviceKey: string, cb: (q: HubQuestion[]) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'questions'), where('deviceKey', '==', deviceKey), where('status', '==', 'published'), limit(100)),
    (s) => cb(snapList<HubQuestion>(s).sort(byNewest)), (e) => onError?.(e));
}

export function subscribeQuestion(id: string, cb: (q: HubQuestion | null) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb(null); return () => {}; }
  return onSnapshot(doc(db, 'questions', id), (s) => cb(s.exists() ? ({ ...(s.data() as HubQuestion), id: s.id }) : null), (e) => onError?.(e));
}

export function subscribeAnswers(questionId: string, cb: (a: HubAnswer[]) => void, onError?: (e: unknown) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'answers'), where('questionId', '==', questionId), where('status', '==', 'published'), limit(300)),
    (s) => cb(snapList<HubAnswer>(s)), (e) => onError?.(e));
}

export function subscribePublishedAnswers(cb: (a: HubAnswer[]) => void, onError?: (e: unknown) => void, max = 500) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'answers'), where('status', '==', 'published'), limit(max)),
    (s) => cb(snapList<HubAnswer>(s)), (e) => onError?.(e));
}

export async function postAnswer(questionId: string, body: string, owner: Owner): Promise<void> {
  requireDb();
  const text = body.trim().slice(0, LIMITS.answer);
  if (!text) throw new Error('Write your answer first.');
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'answers')), {
    questionId, body: text, ownerUid: owner.uid, ownerName: owner.name, voteCount: 0, status: 'published',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'questions', questionId), { answerCount: increment(1) });
  await batch.commit();
}

export async function updateAnswer(id: string, body: string): Promise<void> {
  requireDb();
  const text = body.trim().slice(0, LIMITS.answer);
  if (!text) throw new Error('An answer cannot be empty.');
  await updateDoc(doc(db, 'answers', id), { body: text, updatedAt: serverTimestamp() });
}

export async function deleteAnswer(a: HubAnswer, q: HubQuestion | null): Promise<void> {
  requireDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'answers', a.id));
  if (q) {
    batch.update(doc(db, 'questions', a.questionId), { answerCount: increment(-1) });
  }
  await batch.commit();
  if (q && q.acceptedAnswerId === a.id) {
    // Only the asker may clear the accepted answer; for anyone else this is a no-op.
    await updateDoc(doc(db, 'questions', q.id), { acceptedAnswerId: '' }).catch(() => undefined);
  }
}

export async function acceptAnswer(questionId: string, answerId: string): Promise<void> {
  requireDb();
  await updateDoc(doc(db, 'questions', questionId), { acceptedAnswerId: answerId });
}

export function subscribeVote(kind: 'question' | 'answer', targetId: string, uid: string | null, cb: (voted: boolean) => void) {
  if (!uid || !isFirebaseConfigured) { cb(false); return () => {}; }
  const col = kind === 'question' ? 'questionVotes' : 'answerVotes';
  return onSnapshot(doc(db, col, `${targetId}_${uid}`), (s) => cb(s.exists()), () => cb(false));
}

export async function setVote(kind: 'question' | 'answer', targetId: string, uid: string, voted: boolean): Promise<void> {
  requireDb();
  const col = kind === 'question' ? 'questionVotes' : 'answerVotes';
  const parent = kind === 'question' ? 'questions' : 'answers';
  const batch = writeBatch(db);
  const v = doc(db, col, `${targetId}_${uid}`);
  if (voted) batch.set(v, { targetId, uid, createdAt: serverTimestamp() });
  else batch.delete(v);
  batch.update(doc(db, parent, targetId), { voteCount: increment(voted ? 1 : -1) });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Universal device & component pages
// ---------------------------------------------------------------------------

export interface Source { title: string; url: string }
export interface KV { label: string; value: string }
export interface WikiImage { url: string; title: string; pageUrl: string }

export interface DeviceInfo {
  found: boolean;
  query: string;
  name: string;
  brand: string | null;
  model: string | null;
  modelNumbers: string[];
  deviceType: string | null;
  releaseYear: number | null;
  summary: string;
  specs: KV[];
  identification: string[];
  commonFaults: string[];
  repairability: { score: number | null; source: string | null; notes: string[] };
  teardownNotes: string[];
  keyParts: string[];
  sources: Source[];
  image?: WikiImage | null;
  disclaimer?: string;
  aiError?: string;
  error?: string;
}

export interface ComponentInfo {
  found: boolean;
  query: string;
  partNumber: string;
  manufacturer: string | null;
  category: string | null;
  testKey: string | null;
  description: string;
  package: string | null;
  specs: KV[];
  pinout: { pin: string; name: string; function: string }[];
  equivalents: string[];
  applications: string[];
  markings: string[];
  testNotes: string[];
  sources: Source[];
  links: { label: string; url: string; kind: string }[];
  disclaimer?: string;
  aiError?: string;
  error?: string;
}

export interface DiscoveredDevice extends Omit<DeviceInfo, 'found' | 'image' | 'aiError' | 'error' | 'disclaimer'> {
  id: string;
  slug: string;
  origin: 'ai' | 'user';
  status: 'published' | 'pending' | 'removed';
  imageUrl: string;
  imageTitle: string;
  imagePageUrl: string;
  keywords: string[];
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Legacy docs (pre universal pages) may only carry these:
  category?: string;
  description?: string;
}

export interface DiscoveredComponent extends Omit<ComponentInfo, 'found' | 'aiError' | 'error' | 'disclaimer' | 'links'> {
  id: string;
  origin: 'ai' | 'user';
  status: 'published' | 'pending' | 'removed';
  keywords: string[];
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const deviceSlug = (name: string) => slugify(name);

/** Same shape as board numbers: uppercase, separators to '-', max 64. */
export function normalizePartNumber(raw: string): string {
  return String(raw || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^A-Z0-9._\- /+]+/g, ' ')
    .replace(/\+/g, 'PLUS')
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 64);
}
export const PART_ID_RE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  let body: any = null;
  try { body = await r.json(); } catch { /* not json */ }
  if (!body) throw new Error(r.status === 429 ? 'Too many lookups right now. Please wait a few minutes.' : 'The research service could not be reached.');
  if (!r.ok && !('found' in body)) throw new Error(body.error || 'Lookup failed.');
  return body as T;
}

export const researchDevice = (q: string) => getJson<DeviceInfo>(`/api/universal/device?q=${encodeURIComponent(q)}`);
export const researchComponent = (q: string) => getJson<ComponentInfo>(`/api/universal/component?q=${encodeURIComponent(q)}`);

export async function getDiscoveredDevice(slug: string): Promise<DiscoveredDevice | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const s = await getDoc(doc(db, 'discoveredDevices', slug));
    return s.exists() ? ({ ...(s.data() as DiscoveredDevice), id: s.id, slug: (s.data() as any).slug || s.id }) : null;
  } catch {
    return null;
  }
}

export async function getDiscoveredComponent(id: string): Promise<DiscoveredComponent | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const s = await getDoc(doc(db, 'discoveredComponents', id));
    return s.exists() ? ({ ...(s.data() as DiscoveredComponent), id: s.id }) : null;
  } catch {
    return null;
  }
}

const trimSources = (s: Source[]) => s.slice(0, 10).map((x) => ({ title: String(x.title).slice(0, 160), url: String(x.url).slice(0, 1000) }));

/** Save an AI-researched device (must be found with sources). Returns the slug it was stored under. */
export async function saveDiscoveredDevice(info: DeviceInfo, owner: Owner): Promise<string> {
  requireDb();
  if (!info.found) throw new Error('Only identified devices can be saved.');
  const slug = deviceSlug(info.name);
  const existing = await getDiscoveredDevice(slug);
  if (existing) return slug;
  await setDoc(doc(db, 'discoveredDevices', slug), {
    slug,
    origin: 'ai',
    status: 'published',
    query: info.query.slice(0, 100),
    name: info.name.slice(0, 120),
    brand: info.brand || '',
    model: info.model || '',
    modelNumbers: info.modelNumbers.slice(0, 12),
    deviceType: info.deviceType || '',
    releaseYear: info.releaseYear ?? 0,
    summary: info.summary.slice(0, 600),
    specs: info.specs.slice(0, 24),
    identification: info.identification.slice(0, 8),
    commonFaults: info.commonFaults.slice(0, 14),
    repairability: { score: info.repairability.score ?? -1, source: info.repairability.source || '', notes: info.repairability.notes.slice(0, 6) },
    teardownNotes: info.teardownNotes.slice(0, 10),
    keyParts: info.keyParts.slice(0, 16),
    sources: trimSources(info.sources),
    imageUrl: info.image?.url || '',
    imageTitle: info.image?.title || '',
    imagePageUrl: info.image?.pageUrl || '',
    keywords: keywordsFor(info.name, info.brand, info.model, info.deviceType, ...info.modelNumbers),
    createdByUid: owner.uid,
    createdByName: owner.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return slug;
}

export interface UserDeviceInput {
  name: string;
  brand: string;
  model: string;
  deviceType: string;
  summary: string;
  sourceUrl: string;
}

/** A device added by hand (no AI) waits for admin review before it is public. */
export async function addUserDevice(input: UserDeviceInput, owner: Owner): Promise<string> {
  requireDb();
  const name = input.name.trim();
  if (name.length < 2) throw new Error('Enter the device name.');
  if (input.sourceUrl && !isHttpsUrl(input.sourceUrl)) throw new Error('The reference link must start with https://');
  const slug = deviceSlug(name);
  if (await getDiscoveredDevice(slug)) throw new Error('A page for this device already exists.');
  await setDoc(doc(db, 'discoveredDevices', slug), {
    slug,
    origin: 'user',
    status: 'pending',
    query: name.slice(0, 100),
    name: name.slice(0, 120),
    brand: input.brand.trim().slice(0, 60),
    model: input.model.trim().slice(0, 100),
    modelNumbers: [],
    deviceType: input.deviceType.trim().slice(0, 60),
    releaseYear: 0,
    summary: input.summary.trim().slice(0, 600),
    specs: [],
    identification: [],
    commonFaults: [],
    repairability: { score: -1, source: '', notes: [] },
    teardownNotes: [],
    keyParts: [],
    sources: input.sourceUrl ? [{ title: 'Reference supplied by contributor', url: input.sourceUrl.trim().slice(0, 1000) }] : [],
    imageUrl: '',
    imageTitle: '',
    imagePageUrl: '',
    keywords: keywordsFor(name, input.brand, input.model, input.deviceType),
    createdByUid: owner.uid,
    createdByName: owner.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return slug;
}

export async function saveDiscoveredComponent(info: ComponentInfo, owner: Owner): Promise<string> {
  requireDb();
  if (!info.found) throw new Error('Only identified parts can be saved.');
  const id = normalizePartNumber(info.partNumber || info.query);
  if (!PART_ID_RE.test(id)) throw new Error('That part number cannot be stored.');
  const existing = await getDiscoveredComponent(id);
  if (existing) return id;
  await setDoc(doc(db, 'discoveredComponents', id), {
    origin: 'ai',
    status: 'published',
    query: info.query.slice(0, 100),
    partNumber: info.partNumber.slice(0, 64),
    manufacturer: info.manufacturer || '',
    category: info.category || '',
    testKey: info.testKey || '',
    description: info.description.slice(0, 600),
    package: info.package || '',
    specs: info.specs.slice(0, 30),
    pinout: info.pinout.slice(0, 64),
    equivalents: info.equivalents.slice(0, 16),
    applications: info.applications.slice(0, 12),
    markings: info.markings.slice(0, 10),
    testNotes: info.testNotes.slice(0, 8),
    sources: trimSources(info.sources),
    keywords: keywordsFor(info.partNumber, info.manufacturer, info.category, ...info.equivalents.slice(0, 10)),
    createdByUid: owner.uid,
    createdByName: owner.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export function subscribeDiscoveredDevices(cb: (d: DiscoveredDevice[]) => void, max = 300) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'discoveredDevices'), where('status', '==', 'published'), limit(max)),
    (s) => cb(snapList<DiscoveredDevice>(s).map((d) => ({ ...d, slug: d.slug || d.id })).sort(byNewest)), () => cb([]));
}

export function subscribeDiscoveredComponents(cb: (d: DiscoveredComponent[]) => void, max = 300) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'discoveredComponents'), where('status', '==', 'published'), limit(max)),
    (s) => cb(snapList<DiscoveredComponent>(s).sort(byNewest)), () => cb([]));
}

/** Discovered device -> the DeviceInfo shape the page renders. */
export function deviceInfoFromDoc(d: DiscoveredDevice): DeviceInfo {
  const score = typeof d.repairability?.score === 'number' && d.repairability.score >= 0 ? d.repairability.score : null;
  return {
    found: true,
    query: d.query || d.name,
    name: d.name || [d.brand, d.model].filter(Boolean).join(' ') || d.slug,
    brand: d.brand || null,
    model: d.model || null,
    modelNumbers: d.modelNumbers || [],
    deviceType: d.deviceType || d.category || null,
    releaseYear: d.releaseYear && d.releaseYear > 0 ? d.releaseYear : null,
    summary: d.summary || d.description || '',
    specs: d.specs || [],
    identification: d.identification || [],
    commonFaults: d.commonFaults || [],
    repairability: { score, source: score !== null ? d.repairability?.source || null : null, notes: d.repairability?.notes || [] },
    teardownNotes: d.teardownNotes || [],
    keyParts: d.keyParts || [],
    sources: d.sources || [],
    image: d.imageUrl ? { url: d.imageUrl, title: d.imageTitle || '', pageUrl: d.imagePageUrl || '' } : null,
  };
}

export function componentInfoFromDoc(d: DiscoveredComponent, links: ComponentInfo['links']): ComponentInfo {
  return {
    found: true, query: d.query || d.partNumber, partNumber: d.partNumber || d.id, manufacturer: d.manufacturer || null,
    category: d.category || null, testKey: d.testKey || null, description: d.description || '', package: d.package || null,
    specs: d.specs || [], pinout: d.pinout || [], equivalents: d.equivalents || [], applications: d.applications || [],
    markings: d.markings || [], testNotes: d.testNotes || [], sources: d.sources || [], links,
  };
}

/** Datasheet / shop / equivalents links built on the client too, so they work even when the AI is down. */
export function componentLinks(pn: string, manufacturer?: string | null): ComponentInfo['links'] {
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const links = [
    { label: 'Alldatasheet', url: `https://www.alldatasheet.com/view.jsp?Searchword=${encodeURIComponent(pn)}`, kind: 'datasheet' },
    { label: 'Octopart (stock, prices, datasheets)', url: `https://octopart.com/search?q=${encodeURIComponent(pn)}`, kind: 'datasheet' },
    { label: 'Datasheet PDF search', url: g(`"${pn}" datasheet filetype:pdf`), kind: 'datasheet' },
    { label: 'Datasheet Archive', url: `https://www.datasheetarchive.com/search?q=${encodeURIComponent(pn)}`, kind: 'datasheet' },
    { label: 'LCSC', url: `https://www.lcsc.com/search?q=${encodeURIComponent(pn)}`, kind: 'shop' },
    { label: 'Mouser', url: `https://www.mouser.com/c/?q=${encodeURIComponent(pn)}`, kind: 'shop' },
    { label: 'DigiKey', url: `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(pn)}`, kind: 'shop' },
    { label: 'Equivalents / substitutes search', url: g(`"${pn}" equivalent OR replacement OR substitute`), kind: 'equivalent' },
    { label: 'YouTube: how to test', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to test ${pn}`)}`, kind: 'video' },
  ];
  if (manufacturer) links.splice(3, 0, { label: `${manufacturer} official datasheet`, url: g(`${manufacturer} "${pn}" datasheet`), kind: 'datasheet' });
  return links;
}

/** Shopping searches for parts of a device (never claims stock). */
export function partSearchLinks(term: string): { label: string; url: string }[] {
  const t = encodeURIComponent(term);
  return [
    { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${t}` },
    { label: 'eBay', url: `https://www.ebay.com/sch/i.html?_nkw=${t}` },
    { label: 'AliExpress', url: `https://www.aliexpress.com/wholesale?SearchText=${t}` },
    { label: 'Takealot', url: `https://www.takealot.com/all?qsearch=${t}` },
    { label: 'iFixit parts', url: `https://www.ifixit.com/Search?query=${t}` },
  ];
}

// Device requests ----------------------------------------------------------
export interface DeviceRequest {
  id: string;
  name: string;
  deviceType: string;
  notes: string;
  ownerUid: string;
  ownerName: string;
  status: 'open' | 'done' | 'rejected';
  resolvedPath?: string;
  createdAt?: Timestamp;
}

export async function requestDevice(name: string, deviceType: string, notes: string, owner: Owner): Promise<void> {
  requireDb();
  if (name.trim().length < 2) throw new Error('Enter the device name.');
  await addDoc(collection(db, 'deviceRequests'), {
    name: name.trim().slice(0, 120), deviceType: deviceType.trim().slice(0, 60), notes: notes.trim().slice(0, 1000),
    ownerUid: owner.uid, ownerName: owner.name, status: 'open', createdAt: serverTimestamp(),
  });
}

export function subscribeOpenRequests(cb: (r: DeviceRequest[]) => void, max = 100) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(query(collection(db, 'deviceRequests'), where('status', '==', 'open'), limit(max)),
    (s) => cb(snapList<DeviceRequest>(s).sort(byNewest)), () => cb([]));
}

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------

export type ModeratedCollection = 'guides' | 'questions' | 'answers' | 'discoveredDevices' | 'discoveredComponents';

export async function adminSetStatus(col: ModeratedCollection, id: string, status: string, actor: Actor, label: string, reason = ''): Promise<void> {
  requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, col, id), { status, moderatedBy: actor.uid, moderatedAt: serverTimestamp(), moderationReason: reason.slice(0, 1000) });
  batch.set(auditRef(), auditData(actor, `${col}.${status}`, col, id, label, reason));
  await batch.commit();
}

export async function adminResolveRequest(id: string, status: 'done' | 'rejected', actor: Actor, label: string, resolvedPath = ''): Promise<void> {
  requireDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'deviceRequests', id), { status, resolvedPath: resolvedPath.slice(0, 400), moderatedBy: actor.uid, moderatedAt: serverTimestamp() });
  batch.set(auditRef(), auditData(actor, `deviceRequests.${status}`, 'deviceRequests', id, label, resolvedPath));
  await batch.commit();
}

export async function adminDelete(col: ModeratedCollection | 'guideComments' | 'deviceRequests', id: string): Promise<void> {
  requireDb();
  await deleteDoc(doc(db, col, id));
}

/** Admin lists (any status). */
export async function adminList(col: ModeratedCollection | 'deviceRequests', status?: string, max = 200): Promise<any[]> {
  requireDb();
  const q = status ? query(collection(db, col), where('status', '==', status), limit(max)) : query(collection(db, col), limit(max));
  const s = await getDocs(q);
  return snapList<any>(s).sort(byNewest);
}

// ---------------------------------------------------------------------------
// Reputation (computed from real activity; nothing is stored or self-reported)
// ---------------------------------------------------------------------------

export interface Contributor {
  uid: string;
  name: string;
  guides: number;
  teardowns: number;
  completionsReceived: number;
  answers: number;
  accepted: number;
  votesReceived: number;
  questions: number;
  videos: number;
  points: number;
  badges: { id: string; label: string; description: string }[];
}

export const POINTS = { guide: 30, completion: 10, answer: 5, accepted: 15, vote: 2, question: 1, video: 10 };

export function computeContributors(
  guides: HubGuide[],
  questions: HubQuestion[],
  answers: HubAnswer[],
  videos: { ownerUid: string; ownerName: string }[],
): Contributor[] {
  const map = new Map<string, Contributor>();
  const get = (uid: string, name: string) => {
    let c = map.get(uid);
    if (!c) {
      c = { uid, name, guides: 0, teardowns: 0, completionsReceived: 0, answers: 0, accepted: 0, votesReceived: 0, questions: 0, videos: 0, points: 0, badges: [] };
      map.set(uid, c);
    }
    if (!c.name && name) c.name = name;
    return c;
  };
  const acceptedIds = new Set(questions.map((q) => q.acceptedAnswerId).filter(Boolean));
  for (const g of guides) {
    const c = get(g.ownerUid, g.ownerName);
    if (g.kind === 'teardown') c.teardowns++; else c.guides++;
    c.completionsReceived += Math.max(0, g.completedCount || 0);
  }
  for (const q of questions) {
    const c = get(q.ownerUid, q.ownerName);
    c.questions++;
    c.votesReceived += Math.max(0, q.voteCount || 0);
  }
  for (const a of answers) {
    const c = get(a.ownerUid, a.ownerName);
    c.answers++;
    c.votesReceived += Math.max(0, a.voteCount || 0);
    if (acceptedIds.has(a.id)) c.accepted++;
  }
  for (const v of videos) get(v.ownerUid, v.ownerName).videos++;
  for (const c of map.values()) {
    c.points = (c.guides + c.teardowns) * POINTS.guide + c.completionsReceived * POINTS.completion + c.answers * POINTS.answer
      + c.accepted * POINTS.accepted + c.votesReceived * POINTS.vote + c.questions * POINTS.question + c.videos * POINTS.video;
    const b = c.badges;
    if (c.guides + c.teardowns >= 1) b.push({ id: 'author', label: 'Guide author', description: 'Published a repair guide' });
    if (c.guides + c.teardowns >= 5) b.push({ id: 'manual-master', label: 'Manual master', description: '5+ published guides' });
    if (c.teardowns >= 1) b.push({ id: 'demolitionist', label: 'Teardown artist', description: 'Published a teardown' });
    if (c.completionsReceived >= 10) b.push({ id: 'fixer-magnet', label: 'Fixer magnet', description: '10+ people fixed something with their guides' });
    if (c.answers >= 1) b.push({ id: 'helper', label: 'Helper', description: 'Answered a question' });
    if (c.answers >= 10) b.push({ id: 'oracle', label: 'Oracle', description: '10+ answers' });
    if (c.accepted >= 1) b.push({ id: 'solver', label: 'Problem solver', description: 'Had an answer accepted' });
    if (c.accepted >= 5) b.push({ id: 'master-solver', label: 'Master solver', description: '5+ accepted answers' });
    if (c.videos >= 1) b.push({ id: 'videographer', label: 'Videographer', description: 'Shared a repair video' });
    if (c.votesReceived >= 25) b.push({ id: 'respected', label: 'Respected', description: '25+ upvotes received' });
  }
  return [...map.values()].filter((c) => c.points > 0).sort((a, b) => b.points - a.points);
}

/** Published community videos (for search and reputation). */
export async function fetchPublishedVideos(max = 300): Promise<{ id: string; title: string; deviceLabel: string; pagePath: string; ownerUid: string; ownerName: string }[]> {
  if (!isFirebaseConfigured) return [];
  const s = await getDocs(query(collection(db, 'communityVideos'), where('status', '==', 'published'), limit(max)));
  return snapList<any>(s);
}
