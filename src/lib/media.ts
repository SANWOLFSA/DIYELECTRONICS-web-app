/**
 * Client-side media prep for the AI assistant: photos are resized to <= 1600 px JPEG and videos are
 * turned into a few key frames, so a whole message stays well inside Netlify's ~6 MB request limit
 * and Gemini receives plain inline images (works on the free tier, no file uploads needed).
 */
export interface PreparedImage {
  mimeType: 'image/jpeg';
  /** base64 without the data: prefix (what the API expects) */
  data: string;
  /** data URL for previews */
  dataUrl: string;
  width: number;
  height: number;
  label?: string;
}

/** Total base64 we allow per request (server cap is 5.2 MB; keep headroom for history + JSON). */
export const MAX_PAYLOAD_CHARS = 4_200_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

function drawToJpeg(source: CanvasImageSource, w: number, h: number, maxSide: number, quality: number): PreparedImage {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot process images.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(source, 0, 0, cw, ch);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl, width: cw, height: ch };
}

/** Resize + recompress a photo (camera or gallery). HEIC works where the browser can decode it (Android Chrome / iOS Safari). */
export async function compressImageFile(file: File, maxSide = 1600, quality = 0.82): Promise<PreparedImage> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) throw new Error('Please choose a photo.');
  let bitmap: ImageBitmap | null = null;
  try {
    // createImageBitmap honours EXIF orientation on modern Android Chrome.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const out = drawToJpeg(bitmap, bitmap.width, bitmap.height, maxSide, quality);
    return out;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      return drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxSide, quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    bitmap?.close?.();
  }
}

/** Re-encode an already prepared image smaller (used when a message would exceed the payload cap). */
export async function shrinkPrepared(img: PreparedImage, maxSide: number, quality: number): Promise<PreparedImage> {
  const el = await loadImage(img.dataUrl);
  return { ...drawToJpeg(el, el.naturalWidth, el.naturalHeight, maxSide, quality), label: img.label };
}

/** Load a same-origin (proxied) web image and prepare it like a photo. */
export async function prepareImageFromUrl(url: string, maxSide = 1600): Promise<PreparedImage> {
  const img = await loadImage(url);
  return drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxSide, 0.82);
}

/** Extract `count` evenly spaced key frames from a video file (client side, nothing is uploaded whole). */
export async function extractVideoFrames(file: File, count = 6, maxSide = 1024, quality = 0.72): Promise<PreparedImage[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('That video could not be opened.')), 15000);
      video.onloadedmetadata = () => { clearTimeout(t); resolve(); };
      video.onerror = () => { clearTimeout(t); reject(new Error('That video format is not supported by your browser.')); };
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const n = Math.max(1, Math.min(count, Math.ceil(duration))); // short clips: about one frame per second
    const frames: PreparedImage[] = [];
    for (let i = 0; i < n; i++) {
      const at = Math.min(duration - 0.05, (duration * (i + 0.5)) / n);
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 4000);
        video.onseeked = () => { clearTimeout(t); resolve(); };
        video.currentTime = Math.max(0, at);
      });
      if (!video.videoWidth) continue;
      const frame = drawToJpeg(video, video.videoWidth, video.videoHeight, maxSide, quality);
      frame.label = `video frame ${i + 1}/${n} at ${at.toFixed(1)} s`;
      frames.push(frame);
    }
    if (!frames.length) throw new Error('Could not read frames from that video.');
    return frames;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Small thumbnail data URL (kept in chat history so sessionStorage does not overflow). */
export async function makeThumb(img: PreparedImage, maxSide = 240): Promise<string> {
  try {
    const small = await shrinkPrepared(img, maxSide, 0.6);
    return small.dataUrl;
  } catch {
    return img.dataUrl;
  }
}

/** Make a batch fit under the payload cap by progressively shrinking. */
export async function fitToBudget(images: PreparedImage[], budget = MAX_PAYLOAD_CHARS): Promise<PreparedImage[]> {
  let list = images;
  const size = () => list.reduce((n, i) => n + i.data.length, 0);
  const steps: [number, number][] = [[1400, 0.75], [1200, 0.7], [1000, 0.65], [800, 0.6]];
  for (const [side, q] of steps) {
    if (size() <= budget) break;
    list = await Promise.all(list.map(i => (Math.max(i.width, i.height) > side || i.data.length > 300_000 ? shrinkPrepared(i, side, q) : i)));
  }
  return list;
}

/** Same-origin URL for a web image (so canvases are not tainted and hotlink blocks do not apply). */
export const proxied = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;
