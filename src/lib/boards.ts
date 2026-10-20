/**
 * Real PCB board search + community board photos.
 *
 * Firestore (named DB):
 *   boards/{n}                 aggregate: number, displayNumber, manufacturer, devices, photoCount, coverUrl, createdByUid, createdAt, updatedAt
 *   boards/{n}/photos/{id}     real photos  (Storage boardPhotos/{uid}/{n}/...) JPG/PNG/WebP <= 10 MB
 *   boards/{n}/files/{id}      schematic / boardview files (Storage boardFiles/{uid}/{n}/...) <= 25 MB
 * {n} is normalizeBoardNumber(): must stay in sync with normalizeBoardQuery() in server.ts and
 * the boardId pattern in firestore.rules / storage.rules.
 */
import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, isFirebaseConfigured, storage } from './firebase';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Boardview formats (.brd, .bdv, .bv, .cad, .fz, .tvw ...) have no registered MIME type, so they upload as octet-stream. */
export const FILE_TYPES = ['application/pdf', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'];
export const BOARD_ID_RE = /^[A-Z0-9][A-Z0-9._-]{1,63}$/;

export type BoardSide = 'top' | 'bottom' | 'other';

export interface FeaturedBoard {
  query: string;
  label: string;
  hint: string;
}

/** The boards that used to be hand-documented 3D presets, now quick searches for real photos. */
export const FEATURED_BOARDS: FeaturedBoard[] = [
  { query: 'Raspberry Pi 4', label: 'Raspberry Pi 4 Model B', hint: 'Single-board computer' },
  { query: 'Arduino Uno', label: 'Arduino UNO R3', hint: 'ATmega328P dev board' },
  { query: 'ESP32-DevKitC', label: 'ESP32-DevKitC', hint: 'Espressif dev board' },
  { query: 'iPhone X logic board', label: 'iPhone X logic board', hint: 'A1865 / A1901' },
  { query: '820-02016', label: 'MacBook Air M1 820-02016', hint: 'A2337 logic board' },
];

export const EXAMPLE_NUMBERS = ['820-02016', 'BN41-02568A', '661-07034', 'EAX67133404', '715G8709', 'MS-7B79', 'LA-H371P'];

/** Uppercase, unify dashes, spaces and slashes become '-', strip anything else. Used as the Firestore doc id. */
export function normalizeBoardNumber(raw: string): string {
  return String(raw || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^A-Z0-9._\- /]+/g, ' ')
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 64);
}

export const boardPath = (n: string) => `/blueprint-viewer/board/${encodeURIComponent(normalizeBoardNumber(n))}`;

// ---------------------------------------------------------------------------
// Server search (Commons photos + cited AI info + reference links)
// ---------------------------------------------------------------------------

export interface CommonsPhoto {
  title: string;
  thumbUrl: string;
  url: string;
  width?: number;
  height?: number;
  pageUrl: string;
  description: string;
  license: string;
  licenseUrl: string | null;
  artist: string;
  source: string;
}

export interface BoardInfo {
  found: boolean;
  boardNumber: string;
  manufacturer: string | null;
  boardType: string | null;
  devices: string[];
  keyICs: { role: string; part: string }[];
  commonFaults: string[];
  notes: string[];
  sources: { title: string; url: string }[];
  disclaimer: string;
}

export interface ReferenceLink {
  label: string;
  url: string;
  kind: string;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  image: string | null;
  kind: string;
  source: string;
}

export interface BoardSearchResponse {
  query: string;
  normalized: string;
  links: ReferenceLink[];
  web?: WebResult[];
  photos?: CommonsPhoto[];
  photosError?: string;
  info?: BoardInfo | null;
  infoError?: string;
}

export async function searchBoardsApi(q: string, include: string): Promise<BoardSearchResponse> {
  const resp = await fetch(`/api/boards/search?q=${encodeURIComponent(q)}&include=${encodeURIComponent(include)}`);
  let body: any = null;
  try { body = await resp.json(); } catch { /* non-JSON */ }
  // 503 / 429 still carry photos + links; only the info part failed.
  if (body && (resp.ok || resp.status === 503 || (resp.status === 429 && body.links))) return body as BoardSearchResponse;
  throw new Error(body?.error || `Search failed (${resp.status})`);
}

// ---------------------------------------------------------------------------
// Recent searches (this device only)
// ---------------------------------------------------------------------------
const RECENT_KEY = 'diy.boards.recent';
export function getRecentBoardSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : [];
  } catch { return []; }
}
export function addRecentBoardSearch(display: string) {
  const d = display.trim().slice(0, 80);
  if (!d) return;
  const n = normalizeBoardNumber(d);
  const next = [d, ...getRecentBoardSearches().filter((x) => normalizeBoardNumber(x) !== n)].slice(0, 10);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage full / private mode */ }
}
export function clearRecentBoardSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Community boards (Firestore)
// ---------------------------------------------------------------------------

export interface CommunityBoard {
  id: string;
  number: string;
  displayNumber: string;
  manufacturer: string;
  devices: string[];
  photoCount: number;
  coverUrl: string;
  createdAt?: Timestamp | null;
}

export interface CommunityPhoto {
  id: string;
  ownerUid: string;
  ownerName: string;
  url: string;
  storagePath: string;
  side: BoardSide;
  caption: string;
  title: string;
  device: string;
  brand: string;
  model: string;
  notes: string;
  contentType: string;
  size: number;
  createdAt?: Timestamp | null;
}

export interface CommunityFile {
  id: string;
  ownerUid: string;
  ownerName: string;
  url: string;
  storagePath: string;
  fileName: string;
  fileKind: 'schematic' | 'boardview' | 'other';
  contentType: string;
  size: number;
  title: string;
  notes: string;
  createdAt?: Timestamp | null;
}

function toBoard(id: string, d: any): CommunityBoard {
  return {
    id,
    number: d.number || id,
    displayNumber: d.displayNumber || d.number || id,
    manufacturer: d.manufacturer || '',
    devices: Array.isArray(d.devices) ? d.devices : [],
    photoCount: typeof d.photoCount === 'number' ? d.photoCount : 0,
    coverUrl: d.coverUrl || '',
    createdAt: d.createdAt || null,
  };
}

/** Prefix match on the normalized board number ("820-02" finds 820-02016, 820-02020, ...). */
export async function findCommunityBoards(prefix: string, max = 24): Promise<CommunityBoard[]> {
  if (!isFirebaseConfigured) return [];
  const n = normalizeBoardNumber(prefix);
  if (n.length < 2) return [];
  const snap = await getDocs(query(collection(db, 'boards'), orderBy('number'), startAt(n), endAt(n + '\uf8ff'), limit(max)));
  return snap.docs.map((d) => toBoard(d.id, d.data()));
}

export async function popularCommunityBoards(max = 8): Promise<CommunityBoard[]> {
  if (!isFirebaseConfigured) return [];
  const snap = await getDocs(query(collection(db, 'boards'), orderBy('photoCount', 'desc'), limit(max)));
  return snap.docs.map((d) => toBoard(d.id, d.data())).filter((b) => b.photoCount > 0);
}

export async function getCommunityBoard(n: string): Promise<CommunityBoard | null> {
  if (!isFirebaseConfigured || !BOARD_ID_RE.test(n)) return null;
  const s = await getDoc(doc(db, 'boards', n));
  return s.exists() ? toBoard(s.id, s.data()) : null;
}

export async function listBoardPhotos(n: string): Promise<CommunityPhoto[]> {
  if (!isFirebaseConfigured || !BOARD_ID_RE.test(n)) return [];
  const snap = await getDocs(query(collection(db, 'boards', n, 'photos'), orderBy('createdAt', 'desc'), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as CommunityPhoto);
}

export async function listBoardFiles(n: string): Promise<CommunityFile[]> {
  if (!isFirebaseConfigured || !BOARD_ID_RE.test(n)) return [];
  const snap = await getDocs(query(collection(db, 'boards', n, 'files'), orderBy('createdAt', 'desc'), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as CommunityFile);
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'file';
const clip = (s: string | undefined, n: number) => String(s || '').trim().slice(0, n);

export function validatePhotoFile(f: File): string | null {
  if (!PHOTO_TYPES.includes(f.type)) return `${f.name}: use a JPG, PNG or WebP photo.`;
  if (f.size > MAX_PHOTO_BYTES) return `${f.name}: photos must be 10 MB or smaller.`;
  return null;
}
export function boardFileContentType(f: File): string {
  if (f.type === 'application/pdf' || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') return f.type;
  return 'application/octet-stream';
}
export function validateBoardFile(f: File): string | null {
  if (f.size > MAX_FILE_BYTES) return `${f.name}: schematic / boardview files must be 25 MB or smaller.`;
  if (/\.(exe|bat|cmd|msi|js|html?|svg|apk|dmg|sh)$/i.test(f.name)) return `${f.name}: this file type is not allowed.`;
  return null;
}

function upload(path: string, file: File, contentType: string, onProgress?: (pct: number) => void): Promise<string> {
  const task = uploadBytesResumable(ref(storage, path), file, { contentType });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress?.(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
      (e) => reject(e),
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject),
    );
  });
}

export interface UploadMeta {
  displayNumber: string;
  title: string;
  device: string;
  brand: string;
  model: string;
  notes: string;
  manufacturer: string;
}

/** Board aggregate write: create on first upload, otherwise bump the counter. */
async function boardAggregateOps(n: string, uid: string, meta: UploadMeta, photoDelta: number, coverUrl: string | null) {
  const boardRef = doc(db, 'boards', n);
  const existing = await getDoc(boardRef);
  if (!existing.exists()) {
    const devices = [meta.device || [meta.brand, meta.model].filter(Boolean).join(' ')].map((s) => clip(s, 120)).filter(Boolean);
    return {
      ref: boardRef,
      create: true,
      data: {
        number: n,
        displayNumber: clip(meta.displayNumber || n, 80),
        manufacturer: clip(meta.manufacturer || meta.brand, 80),
        devices,
        photoCount: photoDelta,
        coverUrl: coverUrl || '',
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    };
  }
  const cur = existing.data() as any;
  const update: Record<string, any> = { updatedAt: serverTimestamp() };
  if (photoDelta) update.photoCount = increment(photoDelta);
  if (coverUrl && !cur.coverUrl) update.coverUrl = coverUrl;
  return { ref: boardRef, create: false, data: update };
}

export async function uploadBoardPhoto(opts: {
  n: string; uid: string; ownerName: string; file: File; side: BoardSide; caption: string; meta: UploadMeta;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { n, uid, file } = opts;
  if (!BOARD_ID_RE.test(n)) throw new Error('That board number cannot be used. Use letters, numbers, dot, dash or underscore.');
  const err = validatePhotoFile(file);
  if (err) throw new Error(err);
  const path = `boardPhotos/${uid}/${n}/${Date.now()}_${safeName(file.name)}`;
  const url = await upload(path, file, file.type, opts.onProgress);
  const photoRef = doc(collection(db, 'boards', n, 'photos'));
  const agg = await boardAggregateOps(n, uid, opts.meta, 1, url);
  const batch = writeBatch(db);
  if (agg.create) batch.set(agg.ref, agg.data);
  else batch.update(agg.ref, agg.data);
  batch.set(photoRef, {
    ownerUid: uid,
    ownerName: clip(opts.ownerName || 'Technician', 80),
    url,
    storagePath: path,
    side: opts.side,
    caption: clip(opts.caption, 300),
    title: clip(opts.meta.title, 120),
    device: clip(opts.meta.device, 120),
    brand: clip(opts.meta.brand, 60),
    model: clip(opts.meta.model, 80),
    notes: clip(opts.meta.notes, 2000),
    contentType: file.type,
    size: file.size,
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (e) {
    await deleteObject(ref(storage, path)).catch(() => undefined);
    throw e;
  }
}

export async function uploadBoardFile(opts: {
  n: string; uid: string; ownerName: string; file: File; fileKind: CommunityFile['fileKind']; meta: UploadMeta;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { n, uid, file } = opts;
  if (!BOARD_ID_RE.test(n)) throw new Error('That board number cannot be used.');
  const err = validateBoardFile(file);
  if (err) throw new Error(err);
  const contentType = boardFileContentType(file);
  const path = `boardFiles/${uid}/${n}/${Date.now()}_${safeName(file.name)}`;
  const url = await upload(path, file, contentType, opts.onProgress);
  const agg = await boardAggregateOps(n, uid, opts.meta, 0, null);
  const batch = writeBatch(db);
  if (agg.create) batch.set(agg.ref, agg.data);
  else batch.update(agg.ref, agg.data);
  batch.set(doc(collection(db, 'boards', n, 'files')), {
    ownerUid: uid,
    ownerName: clip(opts.ownerName || 'Technician', 80),
    url,
    storagePath: path,
    fileName: clip(file.name, 120),
    fileKind: opts.fileKind,
    contentType,
    size: file.size,
    title: clip(opts.meta.title, 120),
    notes: clip(opts.meta.notes, 2000),
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (e) {
    await deleteObject(ref(storage, path)).catch(() => undefined);
    throw e;
  }
}

export async function deleteBoardPhoto(n: string, p: CommunityPhoto): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'boards', n, 'photos', p.id));
  batch.update(doc(db, 'boards', n), { photoCount: increment(-1), updatedAt: serverTimestamp() });
  await batch.commit();
  await deleteObject(ref(storage, p.storagePath)).catch(() => undefined);
}

export async function deleteBoardFile(n: string, f: CommunityFile): Promise<void> {
  await deleteDoc(doc(db, 'boards', n, 'files', f.id));
  await deleteObject(ref(storage, f.storagePath)).catch(() => undefined);
}

export function friendlyBoardError(e: any): string {
  const code = String(e?.code || '');
  if (code.includes('permission-denied') || code.includes('unauthorized')) return 'You do not have permission to do that (are you signed in?).';
  if (code.includes('quota') || code.includes('retry-limit')) return 'Upload failed. Please check your connection and try again.';
  if (code.includes('unavailable')) return 'The community database is offline right now.';
  return e?.message || 'Something went wrong.';
}
