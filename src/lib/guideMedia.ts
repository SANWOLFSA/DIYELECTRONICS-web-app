/**
 * Photo and video uploads for community guides and teardowns (Firebase Cloud Storage).
 * Same pattern as the PCB board uploads (src/lib/boards.ts): resumable upload, progress callback,
 * public download URL stored on the Firestore guide document.
 *
 * Storage paths (see storage.rules):
 *   guideImages/{uid}/{timestamp}_{name}   step photos / cover, JPG/PNG/WebP, max 10 MB
 *   guideVideos/{uid}/{timestamp}_{name}   optional teardown video, MP4/WebM/MOV, max 150 MB
 */
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { isFirebaseConfigured, storage } from './firebase';

export const GUIDE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const GUIDE_VIDEO_MAX_BYTES = 150 * 1024 * 1024;
export const GUIDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const GUIDE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const safeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-80) || 'file';

export function checkGuideImage(f: File): string | null {
  if (!GUIDE_IMAGE_TYPES.includes(f.type)) return `${f.name}: use a JPG, PNG or WebP photo.`;
  if (f.size > GUIDE_IMAGE_MAX_BYTES) return `${f.name}: photos must be 10 MB or smaller.`;
  return null;
}

export function checkGuideVideo(f: File): string | null {
  if (!GUIDE_VIDEO_TYPES.includes(f.type)) return `${f.name}: use an MP4, WebM or MOV video.`;
  if (f.size > GUIDE_VIDEO_MAX_BYTES) return `${f.name}: videos must be 150 MB or smaller. Trim it or lower the resolution.`;
  return null;
}

function upload(path: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!isFirebaseConfigured) return Promise.reject(new Error('Uploads are not configured on this build.'));
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, cacheControl: 'public, max-age=31536000' });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress?.(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
      (e) => reject(e),
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject),
    );
  });
}

export function uploadGuideImage(uid: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const err = checkGuideImage(file);
  if (err) return Promise.reject(new Error(err));
  return upload(`guideImages/${uid}/${Date.now()}_${safeName(file.name)}`, file, onProgress);
}

export function uploadGuideVideo(uid: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const err = checkGuideVideo(file);
  if (err) return Promise.reject(new Error(err));
  return upload(`guideVideos/${uid}/${Date.now()}_${safeName(file.name)}`, file, onProgress);
}

export function friendlyUploadError(e: unknown): string {
  const code = String((e as any)?.code || '');
  if (code === 'storage/unauthorized') return 'Upload refused: sign in again, and check the file type and size.';
  if (code === 'storage/canceled') return 'Upload cancelled.';
  if (code === 'storage/quota-exceeded') return 'Storage is full right now. Please try again later.';
  if (code === 'storage/retry-limit-exceeded') return 'The connection dropped during the upload. Please try again.';
  return (e as any)?.message || 'Upload failed. Please try again.';
}
