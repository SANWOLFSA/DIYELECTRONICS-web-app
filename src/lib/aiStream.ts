/**
 * Streaming AI chat client. Words appear as soon as the model produces them (first words in about
 * a second): POST /api/chat-stream returns newline-delimited JSON events. Falls back to the
 * buffered /api/chat route if streaming is unavailable. Identical text-only questions are answered
 * instantly from a small localStorage cache.
 */
import { aiFetch } from './aiFetch';

export interface ChatRequestBody {
  message: string;
  history?: { role: 'user' | 'model'; text: string; images?: { mimeType: string; data: string }[] }[];
  mode?: string;
  context?: string;
  images?: { mimeType: string; data: string; label?: string }[];
  lookupBoards?: boolean;
  boardQuery?: string;
}
export interface ChatResult { text: string; board?: any; ttftMs?: number; cached?: boolean; model?: string }

const CACHE_KEY = 'diy_ai_answer_cache_v1';
const CACHE_MAX = 60;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function cacheKeyFor(body: ChatRequestBody): string | null {
  const hasImages = (body.images?.length || 0) > 0 || (body.history || []).some(h => h.images?.length);
  if (hasImages) return null;
  return hash(JSON.stringify([body.mode || '', body.context || '', (body.history || []).slice(-4).map(h => [h.role, h.text]), body.message.trim().toLowerCase()]));
}
function readCache(): Record<string, { t: string; at: number; board?: any }> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; }
}
function writeCache(key: string, text: string, board?: any) {
  try {
    const all = readCache();
    all[key] = { t: text, at: Date.now(), board: board || undefined };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    for (const k of keys.slice(CACHE_MAX)) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* storage full */ }
}

let warmed = false;
/** Wakes the streaming function (cold start) while the user is still typing. */
export function prewarmAi() {
  if (warmed) return;
  warmed = true;
  fetch('/api/chat-stream', { method: 'GET', cache: 'no-store' }).catch(() => { warmed = false; });
}

export async function streamChat(body: ChatRequestBody, onText: (full: string) => void, signal?: AbortSignal): Promise<ChatResult> {
  const key = cacheKeyFor(body);
  if (key) {
    const hit = readCache()[key];
    if (hit && Date.now() - hit.at < 7 * 24 * 3600 * 1000) { onText(hit.t); return { text: hit.t, board: hit.board, cached: true, ttftMs: 0 }; }
  }
  const t0 = performance.now();
  let res: Response | null = null;
  try {
    res = await fetch('/api/chat-stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    res = null;
  }
  const isStream = res && res.ok && res.body && /ndjson/.test(res.headers.get('content-type') || '');
  if (!isStream) {
    if (res && !res.ok && res.status !== 404 && res.status !== 502 && res.status !== 504) {
      let msg = '';
      try { msg = (await res.json())?.error || ''; } catch { /* ignore */ }
      if (res.status === 400 || res.status === 429) throw new Error(msg || `The AI service returned an error (${res.status}).`);
    }
    // Fallback: buffered route.
    const r = await aiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    let data: any = null;
    try { data = await r.json(); } catch { /* non-JSON */ }
    if (!r.ok || !data?.reply) throw new Error(data?.error || `The AI service returned an error (${r.status}). Please try again shortly.`);
    onText(data.reply);
    if (key) writeCache(key, data.reply, data.board);
    return { text: data.reply, board: data.board, ttftMs: Math.round(performance.now() - t0) };
  }

  const reader = res!.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '', board: any = null, ttft: number | undefined, model: string | undefined, error = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev: any;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.t) {
        if (ttft === undefined) { ttft = Math.round(performance.now() - t0); model = ev.model; }
        full += ev.t;
        onText(full);
      }
      if (ev.error) error = ev.error;
      if (ev.done) board = ev.board || null;
    }
  }
  if (!full) throw new Error(error || 'The AI service is busy right now. Please try again in a minute.');
  if (key) writeCache(key, full, board);
  return { text: full, board, ttftMs: ttft, model };
}
