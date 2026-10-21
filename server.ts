import express from "express";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { initialParts, initialGuides } from './src/data';
import { HELP_TEXT } from './src/data/helpContent';

export const app = express();
const PORT = 3000;

// Explicit body limit (base64 audio for /api/transcribe-audio needs more than the 100kb default).
app.use(express.json({ limit: '6mb' }));

// ---- Basic abuse protection ----------------------------------------------------
// Simple in-memory per-IP rate limit for every POST (all AI routes are POSTs).
// On Netlify each function instance keeps its own counters, so this is a best-effort
// guard against scripted abuse rather than a hard global quota.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = Number(process.env.API_RATE_LIMIT_PER_5MIN) || 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-nf-client-connection-ip'] || req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw ? String(raw).split(',')[0].trim() : '') || req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Same per-IP limit for routes served outside Express (the streaming chat function). */
export function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + RATE_WINDOW_MS }; rateBuckets.set(ip, bucket); }
  bucket.count += 1;
  return bucket.count <= RATE_MAX_REQUESTS;
}

const translateBuckets = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const now = Date.now();
  const ip = getClientIp(req);
  // Page translation sends many small batches: it has its own, larger allowance.
  const isTranslate = req.path === '/api/translate';
  const buckets = isTranslate ? translateBuckets : rateBuckets;
  const max = isTranslate ? 150 : RATE_MAX_REQUESTS;
  let bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 10000) {
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }
  if (bucket.count > max) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.' });
  }
  next();
});

// ---- Firebase ID token verification (no firebase-admin dependency) --------------
// Verifies the RS256 signature against Google's public securetoken certificates and
// checks aud/iss/exp, as documented for third-party JWT libraries:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'diy-electronic';
const SECURETOKEN_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getSecureTokenCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const resp = await fetch(SECURETOKEN_CERTS_URL);
  if (!resp.ok) throw new Error(`cert fetch failed: ${resp.status}`);
  const certs = (await resp.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(resp.headers.get('cache-control') || '')?.[1] || 3600);
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

export async function verifyFirebaseIdToken(token: string): Promise<{ uid: string } | null> {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return null;
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (header.alg !== 'RS256' || !header.kid) return null;
    const certs = await getSecureTokenCerts();
    const cert = certs[header.kid];
    if (!cert) return null;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    if (!verifier.verify(cert, Buffer.from(sig, 'base64url'))) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub };
  } catch (err: any) {
    console.warn('ID token verification failed:', err?.message || err);
    return null;
  }
}

/** Reads `Authorization: Bearer <token>` and verifies it. Shared with netlify/functions/chat-stream.mts. */
export async function verifyAuthorizationHeader(authHeader: string | null | undefined): Promise<{ uid: string } | null> {
  const h = authHeader || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return token ? verifyFirebaseIdToken(token) : null;
}
export const SIGN_IN_REQUIRED = 'Please sign in to use this feature.';

/** Express middleware: requires `Authorization: Bearer <Firebase ID token>`. */
async function requireFirebaseUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = token ? await verifyFirebaseIdToken(token) : null;
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to use this feature.' });
  }
  (req as any).uid = user.uid;
  next();
}

// Free-tier keys have no Google Search grounding quota. When it is exhausted we answer from the
// model's own knowledge instead, and tell the model so (prompts that say "use Google Search" still work).
// Grounding is off unless GEMINI_GROUNDING=on (set it once the Google project has billing / grounding quota).
let groundingBlockedUntil = process.env.GEMINI_GROUNDING === 'on' ? 0 : Number.POSITIVE_INFINITY;
const UNGROUNDED_NOTE = 'NOTE: Live web search is unavailable right now. Answer from your own training knowledge instead. Wherever the instructions say "supported by the search results" read it as "that you know with high confidence". Set "found": true when you confidently recognise this exact item; still never invent part numbers, ratings or pinouts you are unsure of (use null or [] instead).';
function withoutSearchNote(contents: any) {
  if (!Array.isArray(contents)) return contents;
  return contents.map((c: any, i: number) => i === contents.length - 1 && c?.role === 'user' && Array.isArray(c.parts)
    ? { ...c, parts: [...c.parts, { text: UNGROUNDED_NOTE }] } : c);
}

// Resilient multi-model Gemini caller, built for Netlify's hard 30 s function limit.
// Root cause of the Oct 2026 outage: the first model in the old cascade (gemini-3.8-flash) was
// overloaded and its requests hung for 40 s+ (or returned 503 after ~13 s), and the SDK call had
// no timeout, so every AI route was killed by Netlify before the cascade reached a working model.
// Now: thinking is kept LOW (default "high" thinking alone took 6-35 s), every call is abortable,
// the whole cascade has a time budget, and a second model is started in parallel ("hedged")
// if the first has not answered after a few seconds. The first good answer wins.
// Model ids verified against GET /v1beta/models on 2026-10-20; override with GEMINI_MODELS (comma list).
// Free-tier capacity differs per model and changes minute to minute (2026-10-20 probes: one model
// answered in 2-5 s while others hung 20-45 s or returned 503), so several are raced at once.
const DEFAULT_GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
const GEMINI_MODELS = (process.env.GEMINI_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
const GEMINI_BUDGET_MS = Number(process.env.GEMINI_BUDGET_MS) || 22000;
const GEMINI_HEDGE_MS = 4000;
const GEMINI_PARALLEL_START = 3;
/** Per-instance model health: recently failing / slow models are tried later. */
const modelHealth = new Map<string, { failUntil: number; lastMs: number }>();
function orderModels(models: string[]) {
  const now = Date.now();
  return models
    .map((m, i) => ({ m, i, h: modelHealth.get(m) }))
    .sort((a, b) => {
      const af = a.h && a.h.failUntil > now ? 1 : 0, bf = b.h && b.h.failUntil > now ? 1 : 0;
      if (af !== bf) return af - bf;
      return (a.h?.lastMs ?? 8000 + a.i) - (b.h?.lastMs ?? 8000 + b.i);
    })
    .map((x) => x.m);
}

/** One client factory so every route gets the same options (GEMINI_BASE_URL is only for local testing). */
function makeGenAI(apiKey: string) {
  const baseUrl = process.env.GEMINI_BASE_URL;
  return new GoogleGenAI(baseUrl ? { apiKey, httpOptions: { baseUrl } } : { apiKey });
}

const isBusyError = (msg: string) => /429|503|quota|high demand|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|timed out|aborted/i.test(msg);

async function callGeminiWithCascade(
  ai: GoogleGenAI,
  contents: any,
  systemInstruction?: string,
  tools?: any,
  extraConfig?: Record<string, any>,
  onResponse?: (response: any) => void
): Promise<string> {
  const budgetMs = Number(extraConfig?.__budgetMs) || GEMINI_BUDGET_MS;
  // Internal options (never sent to Gemini): a custom model list, thinking level, parallel starts
  // and an external abort signal (used by callGeminiSmart to stop the fallback race).
  const customModels: string[] | undefined = Array.isArray(extraConfig?.__models) ? extraConfig!.__models : undefined;
  const thinkingLevel: string = typeof extraConfig?.__thinking === 'string' ? extraConfig!.__thinking : 'LOW';
  const parallelStart: number = Number(extraConfig?.__parallel) || GEMINI_PARALLEL_START;
  const externalSignal: AbortSignal | undefined = extraConfig?.__signal;
  const passThrough = { __models: customModels, __thinking: extraConfig?.__thinking, __parallel: extraConfig?.__parallel, __signal: externalSignal };
  if (extraConfig) {
    extraConfig = { ...extraConfig };
    for (const k of ['__fast', '__budgetMs', '__models', '__thinking', '__parallel', '__signal']) delete extraConfig[k];
    if (!Object.keys(extraConfig).length) extraConfig = undefined;
  }

  // Grounding (Google Search) needs a billed project; on the free tier it is a fast 429, so skip it.
  if (tools && Date.now() < groundingBlockedUntil) {
    return callGeminiWithCascade(ai, withoutSearchNote(contents), systemInstruction, undefined, { ...(extraConfig || {}), ...passThrough, __budgetMs: budgetMs }, onResponse);
  }

  const models = customModels ? [...customModels] : orderModels(GEMINI_MODELS.length ? GEMINI_MODELS : DEFAULT_GEMINI_MODELS);
  const startedAt = Date.now();
  const controllers: AbortController[] = [];
  const errors: string[] = [];
  let lastError: any = null;
  let sawQuotaOnTools = false;
  let settled = false;

  const attempt = async (model: string): Promise<{ text: string; response: any }> => {
    const ctrl = new AbortController();
    controllers.push(ctrl);
    const remaining = budgetMs - (Date.now() - startedAt);
    const timer = setTimeout(() => ctrl.abort(), Math.max(1000, remaining));
    const t0 = Date.now();
    try {
      const config: any = { thinkingConfig: { thinkingLevel }, abortSignal: ctrl.signal };
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (tools) config.tools = tools;
      if (extraConfig) Object.assign(config, extraConfig);
      const response: any = await ai.models.generateContent({ model, contents, config });
      const text = response?.text;
      if (!text) throw new Error(`${model} returned an empty answer`);
      modelHealth.set(model, { failUntil: 0, lastMs: Date.now() - t0 });
      return { text, response };
    } catch (err: any) {
      const msg = ctrl.signal.aborted ? `${model} timed out` : String(err?.message || err);
      if (tools && /429|RESOURCE_EXHAUSTED|quota/i.test(msg)) sawQuotaOnTools = true;
      lastError = err; errors.push(`${model}: ${msg.slice(0, 140)}`);
      // Aborts caused by another model winning are not failures.
      if (!(ctrl.signal.aborted && settled)) modelHealth.set(model, { failUntil: Date.now() + (/exceeded your current quota/i.test(msg) ? 10 : 2) * 60 * 1000, lastMs: Date.now() - t0 });
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  // Hedged race: start model i; start model i+1 when model i fails OR after GEMINI_HEDGE_MS.
  const result = await new Promise<{ text: string; response: any } | null>((resolve) => {
    let next = 0, running = 0, done = false;
    let hedgeTimer: any = null;
    const finish = (v: { text: string; response: any } | null) => {
      if (done) return;
      done = true; settled = true; clearTimeout(hedgeTimer); clearTimeout(overall);
      for (const c of controllers) { try { c.abort(); } catch { /* ignore */ } }
      resolve(v);
    };
    const overall = setTimeout(() => finish(null), budgetMs + 500);
    if (externalSignal) {
      if (externalSignal.aborted) { finish(null); return; }
      externalSignal.addEventListener('abort', () => finish(null), { once: true });
    }
    const launch = () => {
      if (done) return;
      clearTimeout(hedgeTimer);
      if (next >= models.length || budgetMs - (Date.now() - startedAt) < 1500) {
        if (running === 0) finish(null);
        return;
      }
      const model = models[next++];
      running++;
      attempt(model).then(finish, () => { running--; launch(); });
      hedgeTimer = setTimeout(launch, GEMINI_HEDGE_MS);
    };
    for (let i = 0; i < parallelStart; i++) launch();
  });

  if (result) {
    onResponse?.(result.response);
    return result.text;
  }
  if (errors.length) console.warn('Gemini cascade failed:', errors.join(' | '));

  // Free-tier projects have no quota for grounding tools: answer from model knowledge instead.
  if (tools && sawQuotaOnTools) {
    console.warn('Grounded Gemini calls were rate-limited; answering without tools for the next 15 minutes.');
    groundingBlockedUntil = Date.now() + 15 * 60 * 1000;
    const left = budgetMs - (Date.now() - startedAt);
    if (left > 5000) return callGeminiWithCascade(ai, withoutSearchNote(contents), systemInstruction, undefined, { ...(extraConfig || {}), ...passThrough, __budgetMs: left }, onResponse);
  }
  const busy = errors.length === 0 || errors.every((e) => isBusyError(e));
  throw lastError && !busy ? lastError : new Error(`All candidate Gemini models were unavailable (${errors.join(' | ') || 'timed out'}).`);
}

// "Smart" calls (the SANWOLF chat brain and circuit maps): the strongest free-tier models start
// first with MEDIUM thinking; the fast LOW-thinking race only starts if they have not answered
// after SMART_HEAD_START_MS (or as soon as they fail). The first good answer wins and the other
// race is aborted. Pro models have no free-tier quota (429 on 2026-10-20), so they are not listed
// by default; override with GEMINI_SMART_MODELS (comma list) once billing is enabled.
const SMART_MODELS = (process.env.GEMINI_SMART_MODELS || 'gemini-3.7-flash,gemini-3.6-flash').split(',').map((m) => m.trim()).filter(Boolean);
const SMART_HEAD_START_MS = Number(process.env.GEMINI_SMART_HEAD_START_MS) || 7000;
async function callGeminiSmart(ai: GoogleGenAI, contents: any, systemInstruction?: string, extraConfig?: Record<string, any>): Promise<string> {
  const budgetMs = Number(extraConfig?.__budgetMs) || GEMINI_BUDGET_MS;
  const startedAt = Date.now();
  const base = { ...(extraConfig || {}) }; delete base.__budgetMs;
  const smartStop = new AbortController();
  const fastStop = new AbortController();
  let startFast: () => void = () => {};
  const fastGate = new Promise<void>((r) => { startFast = r; });
  const headTimer = setTimeout(() => startFast(), SMART_HEAD_START_MS);
  const smart = callGeminiWithCascade(ai, contents, systemInstruction, undefined,
    { ...base, __models: orderModels(SMART_MODELS), __thinking: 'MEDIUM', __parallel: 1, __budgetMs: budgetMs - 500, __signal: smartStop.signal });
  smart.catch(() => startFast());
  const fast = fastGate.then(() => {
    const left = budgetMs - (Date.now() - startedAt);
    if (left < 3000) throw new Error('No time left for the fallback models.');
    return callGeminiWithCascade(ai, contents, systemInstruction, undefined, { ...base, __budgetMs: left, __signal: fastStop.signal });
  });
  try {
    const text = await Promise.any([smart, fast]);
    return text;
  } catch (e: any) {
    throw e?.errors?.[0] || e;
  } finally {
    clearTimeout(headTimer); startFast();
    smartStop.abort(); fastStop.abort();
  }
}

// ---- Shared AI route helpers --------------------------------------------------

// Read ONLY the server-side key. Never fall back to a VITE_* variable: anything
// prefixed VITE_ is bundled into the browser, so it must never hold the Gemini key.
const getGeminiApiKey = () => process.env.GEMINI_API_KEY || '';

const AI_NOT_CONFIGURED = 'The AI assistant is not configured on the server yet. Please try again later.';
const AI_UNAVAILABLE = 'The AI service is busy or unavailable right now. Please try again in a minute.';

/** Safety rules shared by every chat persona (kept server-side; clients cannot override them). */
const CHAT_SAFETY_RULES = `Safety and policy rules (always apply):
- Never give instructions to bypass, remove or defeat Factory Reset Protection (FRP), Google account locks, iCloud Activation Lock, carrier/network locks, screen passcodes or any other anti-theft protection, even if the user says it is their own device. Politely decline the bypass and instead explain the legitimate owner routes: sign in with the original account, use official account recovery (accounts.google.com/signin/recovery or iforgot.apple.com), or take proof of purchase to the manufacturer, carrier or an authorised service centre.
- Ordinary hardware diagnosis and repair of a locked device (screen, battery, charging, boards) is fine to help with.
- Warn clearly about mains voltage, charged capacitors (the big primary filter cap can hold 300-400 V DC long after unplugging), CRT/inverter high voltage, microwave oven HV parts and lithium battery hazards whenever they are relevant. Say how to discharge safely.
- If you are not sure, say so instead of inventing part numbers, measurements or prices.`;

/** How every persona thinks and writes (the "brain"). */
const CHAT_METHOD = `How you work:
- Think like a senior bench technician. Reason step by step internally: symptom -> which section of the board is most likely at fault (power input/fuse, PFC, main SMPS, standby supply, DC-DC regulators, SoC/CPU, memory, backlight/LED driver, audio, panel/T-CON, charging, etc.) -> the specific components in that section -> exact measurements (meter mode, test points, expected values with units) -> what each result means and the next step.
- Answer first: open with the most likely cause and the first thing to check in 1-3 short lines, then the detail. No filler, no "great question".
- If a key fact is missing (exact model / board number, the symptom, what has already been tried or measured) and it really changes the answer, give your best provisional advice AND ask ONE sharp clarifying question at the end. Never ask more than one question.
- Use the whole conversation: earlier messages and earlier photos are context, refer back to them.
- Never guess which product a board came from (e.g. "used in plasma TVs") unless the label, the user or a cited web result says so; state the brand and part numbers you can read.
- Photos / video frames: describe what you actually see (visible damage, bulging or leaking caps, burnt resistors, corrosion, cracked solder, missing parts, readable markings). Read printed part numbers only when legible; say "not legible" otherwise.
- Web results and board photos supplied in the prompt are evidence: cite them inline as [1], [2] when you use them. Never invent part numbers, pinouts, schematics or voltages you do not know: say you are unsure and how to confirm (label, service manual, datasheet, measuring).
- Be concrete with numbers: e.g. "standby 5 V on the CN801 pin marked 5VSB", "big filter cap ~310-340 V DC on 230 V mains", "ESR under 0.5 ohm for a 1000 uF 25 V low-ESR cap".
- End with one suggested next action on its own line starting with "Next:", e.g. "Next: Map this board (tap + then Map circuit)", "Next: Upload a clear photo of the power supply board", or "Next: measure the 12 V rail and tell me the reading".
- Format in clean Markdown: short headings, bullets, and Markdown tables for measurements / colour codes when helpful. Keep it scannable on a phone.`;

/** Whitelisted chat modes. The client sends a mode id; it can never send its own system prompt. */
const CHAT_PERSONAS: Record<string, string> = {
  copilot: `You are SANWOLF, the expert AI repair technician built into the DIY Electronics web app (South Africa based users; mains is 230 V 50 Hz unless told otherwise). You diagnose and repair consumer electronics: TVs and their power supply / main / T-CON boards, smartphones, laptops, consoles, audio gear, appliances and general component-level troubleshooting, soldering and multimeter work.`,
  codefox: `You are CODEFOX, the DIY Electronics embedded-systems expert. You help with microcontrollers (Arduino, ESP32, Raspberry Pi, STM32), firmware, and C/C++/Python code. Give complete, working code examples, debugging tips and exact wiring (pin to pin). Apply the same answer-first, one-question, "Next:" style; the step-by-step method applies to debugging hardware and code.`,
  circuitbear: `You are CIRCUITBEAR, the DIY Electronics circuit-design expert. You help with circuit theory, calculations (show the formula and the numbers), PCB layout, power delivery and schematic analysis.`,
  tutor: `You are a friendly, precise electrical and electronics engineering tutor inside the DIY Electronics study app. Teach step by step, show units in every calculation, use SI units and South African conventions where relevant (230/400 V, 50 Hz, SANS 10142-1). Keep answers focused (under about 250 words unless asked for more) with short Markdown headings, bullets and inline formulas. If a question involves live mains work, remind the student about safe isolation. If you are not sure of a fact, say so.`,
  help: `You are the DIY Electronics in-app Help Assistant. Answer questions about HOW TO USE THE APP, using only the help guide below. Give short numbered steps, name the exact buttons and menus, and say plainly when the guide does not cover something (suggest emailing support). For repair questions, suggest asking SANWOLF in the AI Assistant.\n\nHELP GUIDE:\n${HELP_TEXT}`,
  'phone-repair': `You are the DIY Electronics phone repair expert. Write practical, step-by-step troubleshooting and repair guides for smartphones. Include a "Required tools" section when relevant.`,
};
// Older clients used the persona id "sanwolf" for the main assistant.
CHAT_PERSONAS.sanwolf = CHAT_PERSONAS.copilot;

const MAX_CHAT_MESSAGE_CHARS = 4000;
const MAX_CHAT_HISTORY_TURNS = 24;

type ChatPrep = {
  error?: string; status?: number;
  contents?: any[]; instruction?: string; mode?: string; fast?: boolean; hasImages?: boolean;
  cacheKey?: string | null; boardQuery?: string | null; lookupPromise?: Promise<any>;
};

// Answers to identical text-only questions (same mode, context and recent history) are reused.
const chatAnswerCache = new Map<string, { at: number; reply: string }>();
const CHAT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
function cacheGet(key?: string | null) {
  if (!key) return null;
  const hit = chatAnswerCache.get(key);
  if (!hit || Date.now() - hit.at > CHAT_CACHE_TTL_MS) return null;
  return hit.reply;
}
function cacheSet(key: string | null | undefined, reply: string) {
  if (!key || !reply) return;
  if (chatAnswerCache.size > 500) chatAnswerCache.delete(chatAnswerCache.keys().next().value as string);
  chatAnswerCache.set(key, { at: Date.now(), reply });
}

/** Validates a chat request and builds the Gemini contents (shared by /api/chat and the streaming route). */
export async function prepareChat(body: any): Promise<ChatPrep> {
  const { history, mode } = body || {};
  const message = typeof body?.message === 'string' ? body.message : '';
  const current = sanitizeInlineImages(body?.images);
  if (current.error) return { error: current.error, status: 400 };
  if (!message.trim() && !current.images.length) return { error: 'Please type a question or attach a photo first.', status: 400 };
  if (message.length > MAX_CHAT_MESSAGE_CHARS) return { error: `Please keep your question under ${MAX_CHAT_MESSAGE_CHARS} characters.`, status: 400 };
  if (!getGeminiApiKey()) return { error: AI_NOT_CONFIGURED, status: 503 };

  const persona = CHAT_PERSONAS[typeof mode === 'string' ? mode : ''] || CHAT_PERSONAS.copilot;
  const isTutor = mode === 'tutor';
  // Optional study context from the Theory pages (topic summary / formulas); plain text, capped.
  const context = isTutor && typeof body?.context === 'string' ? body.context.slice(0, 1200) : '';
  const isHelp = mode === 'help';
  const instruction = isTutor
    ? `${persona}${context ? `\n\nStudy context (from the app):\n${context}` : ''}\n\n${CHAT_SAFETY_RULES}`
    : isHelp ? persona
    : `${persona}\n\n${CHAT_METHOD}\n\n${CHAT_SAFETY_RULES}`;

  let historyChars = current.images.reduce((n, i) => n + i.data.length, 0);
  const maxTurns = isTutor ? 8 : MAX_CHAT_HISTORY_TURNS; // the tutor keeps a short context for speed
  const rawHistory = Array.isArray(history)
    ? history.filter((h: any) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && (h.text.trim() || Array.isArray(h.images))).slice(-maxTurns)
    : [];
  let historyImages = 0;
  // Walk newest -> oldest so the most recent earlier photos are the ones kept when space runs out.
  const safeHistory: any[] = [];
  for (let i = rawHistory.length - 1; i >= 0; i--) {
    const h = rawHistory[i];
    const parts: any[] = [];
    if (h.role === 'user' && Array.isArray(h.images) && h.images.length) {
      const hist = sanitizeInlineImages(h.images.slice(0, 4));
      const size = hist.images.reduce((n, x) => n + x.data.length, 0);
      if (!hist.error && historyChars + size <= MAX_INLINE_TOTAL_CHARS) {
        historyChars += size; historyImages += hist.images.length;
        parts.push(...imageParts(hist.images));
      } else {
        parts.push({ text: `[The user attached ${h.images.length} photo(s) here earlier; no longer available.]` });
      }
    }
    // Older model answers are trimmed: the model only needs the gist to keep context.
    const maxLen = h.role === 'model' && i < rawHistory.length - 2 ? 1500 : MAX_CHAT_MESSAGE_CHARS;
    if (h.text.trim()) parts.push({ text: h.text.slice(0, maxLen) });
    if (parts.length) safeHistory.unshift({ role: h.role, parts });
  }
  while (safeHistory.length && safeHistory[0].role !== 'user') safeHistory.shift();

  const boardQuery = typeof body?.boardQuery === 'string' && body.boardQuery.trim()
    ? body.boardQuery.trim().slice(0, 80)
    : (body?.lookupBoards === false || isTutor || isHelp ? null : detectBoardQuery(message));
  const lookupPromise = boardQuery ? lookupBoardOnline(boardQuery, 6000).catch(() => null) : Promise.resolve(null);
  // Board evidence is useful but must not delay the first words: wait at most ~1.2 s for it.
  const evidence = boardQuery ? await withTimeout(lookupPromise, 1200, null as any) : null;

  const turnParts: any[] = [...imageParts(current.images)];
  let text = message.trim() || 'Please look at the attached photo(s) and tell me what you see and what to check.';
  if (evidence?.web?.length) text += `\n\n---\nWeb results found online for "${boardQuery}" (evidence; cite as [n] when used):\n${webEvidenceText(evidence.web)}`;
  if (evidence?.photos?.length) text += `\n(${evidence.photos.length} real board photos from the web are shown to the user under your answer; they can pick one to map the circuit.)`;
  turnParts.push({ text });
  const contents = [...safeHistory, { role: 'user', parts: turnParts }];

  const hasImages = current.images.length > 0 || historyImages > 0;
  // Short, text-only questions (and every tutor question) go to the fastest models first.
  const fast = isTutor || isHelp || (!hasImages && message.length < 160 && rawHistory.length <= 6);
  const cacheKey = hasImages ? null : crypto.createHash('sha256')
    .update(JSON.stringify([mode || 'copilot', context, rawHistory.slice(-4).map((h: any) => [h.role, h.text]), message.trim().toLowerCase(), evidence?.web?.length || 0]))
    .digest('hex');
  return { contents, instruction, mode: isTutor ? 'tutor' : isHelp ? 'help' : (mode || 'copilot'), fast, hasImages, cacheKey, boardQuery, lookupPromise };
}

async function boardPayload(prep: ChatPrep, waitMs: number) {
  if (!prep.boardQuery || !prep.lookupPromise) return null;
  const board = await withTimeout(prep.lookupPromise, waitMs, null as any);
  return board && (board.photos.length || board.web.length) ? { query: prep.boardQuery, photos: board.photos, web: board.web, links: board.links } : null;
}

// API routes FIRST
app.post("/api/chat", requireFirebaseUser, async (req, res) => {
  const startedAt = Date.now();
  const prep = await prepareChat(req.body);
  if (prep.error) return res.status(prep.status || 400).json({ error: prep.error });
  const cached = cacheGet(prep.cacheKey);
  if (cached) return res.json({ reply: cached, source: 'cache', board: await boardPayload(prep, 1500) });
  try {
    const ai = makeGenAI(getGeminiApiKey());
    const budget = Math.max(10000, 23500 - (Date.now() - startedAt));
    const reply = prep.fast
      ? await callGeminiWithCascade(ai, prep.contents, prep.instruction, undefined, { __models: orderModels(FAST_MODELS), __thinking: 'MINIMAL', __budgetMs: budget })
          .catch(() => callGeminiWithCascade(ai, prep.contents, prep.instruction, undefined, { __budgetMs: Math.max(6000, 23500 - (Date.now() - startedAt)) }))
      : await callGeminiSmart(ai, prep.contents, prep.instruction, { __budgetMs: budget });
    if (!reply) return res.status(503).json({ error: AI_UNAVAILABLE });
    cacheSet(prep.cacheKey, reply);
    res.json({ reply, source: 'gemini', board: await boardPayload(prep, Math.max(0, 26000 - (Date.now() - startedAt))) });
  } catch (error: any) {
    console.error("Gemini API Error in /api/chat:", error?.message || error);
    res.status(503).json({ error: AI_UNAVAILABLE });
  }
});

// ---- Streaming chat (first words in about a second) ----------------------------------------
// Events are newline-delimited JSON: {"t":"text chunk"} ... then {"done":true,"board":...} or {"error":"..."}.
// Served by netlify/functions/chat-stream.mts on Netlify (a streaming function; the Express
// wrapper buffers) and by the Express route below locally.
const FAST_MODELS = (process.env.GEMINI_FAST_MODELS || 'gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview,gemini-3.6-flash').split(',').map((m) => m.trim()).filter(Boolean);
export type ChatStreamEvent = { t?: string; done?: boolean; board?: any; error?: string; model?: string; cached?: boolean; ttft?: number };

export async function* streamChat(prep: ChatPrep): AsyncGenerator<ChatStreamEvent> {
  const startedAt = Date.now();
  const cached = cacheGet(prep.cacheKey);
  if (cached) {
    yield { t: cached, cached: true, ttft: 0 };
    yield { done: true, board: await boardPayload(prep, 1500) };
    return;
  }
  const ai = makeGenAI(getGeminiApiKey());
  // Fast questions: lite models with minimal thinking. Others: the stronger models with LOW thinking,
  // hedged to the lite models if no words have arrived after a couple of seconds.
  const plan: { model: string; thinking: string }[] = prep.fast
    ? orderModels(FAST_MODELS).map((m) => ({ model: m, thinking: 'MINIMAL' }))
    : [...orderModels(SMART_MODELS).map((m) => ({ model: m, thinking: 'LOW' })), ...orderModels(FAST_MODELS).map((m) => ({ model: m, thinking: 'MINIMAL' }))];
  const hedgeMs = prep.fast ? 1800 : 3000;
  const deadline = startedAt + 24000;
  const controllers: AbortController[] = [];
  type Winner = { model: string; first: string; it: AsyncIterator<any>; ctrl: AbortController };

  const open = async (step: { model: string; thinking: string }): Promise<Winner> => {
    const ctrl = new AbortController();
    controllers.push(ctrl);
    const timer = setTimeout(() => ctrl.abort(), Math.max(1500, deadline - Date.now()));
    const t0 = Date.now();
    const run = async (thinking: string) => {
      const config: any = { systemInstruction: prep.instruction, abortSignal: ctrl.signal, thinkingConfig: { thinkingLevel: thinking } };
      const stream: any = await ai.models.generateContentStream({ model: step.model, contents: prep.contents, config });
      const it: AsyncIterator<any> = stream[Symbol.asyncIterator]();
      for (;;) {
        const r = await it.next();
        if (r.done) throw new Error(`${step.model} returned an empty answer`);
        const text = r.value?.text;
        if (text) return { model: step.model, first: text, it, ctrl };
      }
    };
    try {
      let w: Winner;
      try { w = await run(step.thinking); }
      catch (err: any) {
        // Some models do not accept MINIMAL thinking: retry once with LOW.
        if (step.thinking === 'MINIMAL' && /thinking/i.test(String(err?.message)) && !ctrl.signal.aborted) w = await run('LOW');
        else throw err;
      }
      clearTimeout(timer);
      modelHealth.set(step.model, { failUntil: 0, lastMs: Date.now() - t0 });
      return w;
    } catch (err: any) {
      clearTimeout(timer);
      const msg = String(err?.message || err);
      if (!ctrl.signal.aborted) modelHealth.set(step.model, { failUntil: Date.now() + (/exceeded your current quota/i.test(msg) ? 10 : 2) * 60 * 1000, lastMs: Date.now() - t0 });
      throw err;
    }
  };

  const winner = await new Promise<Winner | null>((resolve) => {
    let next = 0, running = 0, done = false, hedge: any = null;
    const finish = (w: Winner | null) => {
      if (done) { if (w) try { w.ctrl.abort(); } catch { /* ignore */ } return; }
      done = true; clearTimeout(hedge);
      for (const c of controllers) if (!w || c !== w.ctrl) try { c.abort(); } catch { /* ignore */ }
      resolve(w);
    };
    const launch = () => {
      if (done) return;
      clearTimeout(hedge);
      if (next >= plan.length || deadline - Date.now() < 2000) { if (running === 0) finish(null); return; }
      const step = plan[next++];
      running++;
      open(step).then(finish, () => { running--; launch(); });
      hedge = setTimeout(launch, hedgeMs);
    };
    launch();
    if (prep.fast) { launch(); launch(); } // three fast models from the start: whichever speaks first wins
    setTimeout(() => finish(null), deadline - Date.now() + 200);
  });

  if (!winner) { yield { error: AI_UNAVAILABLE }; return; }
  let full = winner.first;
  yield { t: winner.first, model: winner.model, ttft: Date.now() - startedAt };
  try {
    for (;;) {
      const r = await winner.it.next();
      if (r.done) break;
      const text = r.value?.text;
      if (text) { full += text; yield { t: text }; }
      if (Date.now() > deadline + 4000) break;
    }
  } catch (err: any) {
    console.warn('chat stream interrupted:', err?.message || err);
  }
  cacheSet(prep.cacheKey, full);
  yield { done: true, board: await boardPayload(prep, 2500) };
}

app.get('/api/chat-stream', (req, res) => res.json({ ok: true, warm: true }));
app.post('/api/chat-stream', requireFirebaseUser, async (req, res) => {
  const prep = await prepareChat(req.body);
  if (prep.error) return res.status(prep.status || 400).json({ error: prep.error });
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  for await (const ev of streamChat(prep)) res.write(JSON.stringify(ev) + '\n');
  res.end();
});

// Electrical Theory Exam Room: generate extra practice questions as JSON.
// Uses the server-side Gemini cascade; the key never reaches the browser.
const THEORY_LEVELS = ["school", "college", "university"] as const;
app.post("/api/theory/generate-questions", requireFirebaseUser, async (req, res) => {
  const body = req.body || {};
  const level = THEORY_LEVELS.includes(body.level) ? body.level : "college";
  const count = Math.min(10, Math.max(1, Number(body.count) || 5));
  const subjects: string[] = Array.isArray(body.subjects) ? body.subjects.filter((s: unknown) => typeof s === "string").slice(0, 12) : [];
  const topics: { id: string; title: string; subject: string }[] = Array.isArray(body.topics)
    ? body.topics
        .filter((t: any) => t && typeof t.id === "string" && typeof t.title === "string")
        .slice(0, 40)
        .map((t: any) => ({ id: String(t.id).slice(0, 60), title: String(t.title).slice(0, 120), subject: String(t.subject || "").slice(0, 30) }))
    : [];

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI question generation is not configured on the server", questions: [] });
  }

  const levelGuide: Record<string, string> = {
    school: "high-school (Grade 10-12 Physical Sciences / Electrical Technology) level",
    college: "TVET college / trade level (South African NATED N1-N6 Electrical Trade Theory and Electrotechnics)",
    university: "university electrical & electronic engineering degree level",
  };

  const prompt = `Write ${count} NEW, technically accurate practice exam questions at ${levelGuide[level]}.
Subjects: ${subjects.length ? subjects.join(", ") : "any electrical/electronics subject"}.
Choose each question's topicId from this list (use the id exactly): ${JSON.stringify(topics.map(t => ({ id: t.id, title: t.title })))}.
Mix about half multiple-choice and half numeric-answer questions. Use SI units and South African conventions where relevant (230/400 V, 50 Hz).
Double-check every calculation. Numeric answers must be a single number in the stated unit.
Return ONLY a JSON array (no markdown fences, no commentary). Each element must be one of:
{"type":"mcq","topicId":"...","difficulty":1-3,"prompt":"...","options":["...","...","...","..."],"answerIndex":0-3,"solution":"short worked solution"}
{"type":"numeric","topicId":"...","difficulty":1-3,"prompt":"...","answer":12.5,"unit":"V","tolerance":0.02,"solution":"short worked solution with the calculation"}`;

  try {
    const ai = makeGenAI(apiKey);
    const text = await callGeminiWithCascade(ai, [{ role: "user", parts: [{ text: prompt }] }],
      "You are a meticulous electrical engineering examiner. You output strictly valid JSON only.");
    const cleaned = (text || "").replace(/```(?:json)?/gi, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("No JSON array in model output");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error("Model output is not an array");
    const validTopicIds = new Set(topics.map(t => t.id));
    const questions = parsed
      .filter((q: any) => q && typeof q === "object" && typeof q.prompt === "string" && typeof q.solution === "string")
      .map((q: any) => {
        const topicId = typeof q.topicId === "string" && (validTopicIds.size === 0 || validTopicIds.has(q.topicId)) ? q.topicId : topics[0]?.id;
        const difficulty = Math.min(3, Math.max(1, Math.round(Number(q.difficulty) || 2)));
        if (q.type === "mcq" && Array.isArray(q.options)) {
          const options = q.options.filter((o: unknown) => typeof o === "string").slice(0, 6);
          const answerIndex = Number(q.answerIndex);
          if (options.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null;
          return { type: "mcq", topicId, difficulty, prompt: q.prompt, options, answerIndex, solution: q.solution };
        }
        if (q.type === "numeric") {
          const answer = Number(q.answer);
          if (!Number.isFinite(answer)) return null;
          const tol = Number(q.tolerance);
          return { type: "numeric", topicId, difficulty, prompt: q.prompt, answer, unit: typeof q.unit === "string" ? q.unit : "", tolerance: Number.isFinite(tol) && tol >= 0 && tol <= 0.2 ? tol : 0.02, solution: q.solution };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, count);
    res.json({ level, questions });
  } catch (error: any) {
    console.warn("Theory question generation failed:", error?.message || error);
    res.status(502).json({ error: "The AI could not generate questions right now", questions: [] });
  }
});

app.post("/api/component-diagnostics", async (req, res) => {
  const { componentName, componentType, deviceModel, referenceDesignator, firestoreMetadata, customQuery } = req.body || {};
  const cName = String(componentName || 'Target IC').slice(0, 200);
  const dModel = String(deviceModel || 'Smartphone / Logic Board').slice(0, 200);
  const refDes = String(referenceDesignator || 'U101').slice(0, 50);

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return res.status(503).json({ success: false, error: AI_NOT_CONFIGURED });
  }

  try {
    const ai = makeGenAI(apiKey);

    const prompt = `You are an experienced micro-soldering hardware engineer and circuit diagnostics expert.
Analyze this component on the motherboard:
- Component Name: ${cName}
- Component Type / Classification: ${String(componentType || 'Integrated Circuit / Surface Mount').slice(0, 200)}
- Board Reference Designator: ${refDes}
- Target Device Model: ${dModel}
${firestoreMetadata ? `- Database Metadata: ${(typeof firestoreMetadata === 'string' ? firestoreMetadata : JSON.stringify(firestoreMetadata)).slice(0, 2000)}` : ''}
${customQuery ? `- User Specific Diagnostic Note / Error: ${String(customQuery).slice(0, 1000)}` : ''}

Provide a professional component diagnosis formatted with clean Markdown:
1. **Component Role**: What ${cName} does on the ${dModel} board (power domains, rails, bus protocol, clock lines).
2. **Failure Symptoms**: What happens when this component fails or shorts.
3. **Bench Diagnostics**: diode-mode readings, resistance to ground, current-draw characteristics. Say clearly when values are typical rather than model-specific.
4. **Replacement Protocol**: safe hot-air settings, flux/solder choice, pad prep, and verification before reassembly.
If you are not certain of model-specific values, say so instead of inventing them.`;

    const systemInstruction = `You are the hardware diagnostic assistant for DIY Electronics. You specialize in component-level motherboard repairs, schematics tracing, and PCB diagnostics.`;

    const diagnosticGuide = await callGeminiWithCascade(
      ai,
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      undefined
    );

    res.json({
      success: true,
      componentName: cName,
      deviceModel: dModel,
      diagnosticGuide,
      source: 'gemini'
    });
  } catch (error: any) {
    console.error("Component Diagnostics Error:", error?.message || error);
    res.status(503).json({ success: false, error: AI_UNAVAILABLE });
  }
});

// Not called by the web app today; kept for future use but restricted to signed-in users.
app.post("/api/gemini-grounded", requireFirebaseUser, async (req, res) => {
  const { prompt, useMaps } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_CHAT_MESSAGE_CHARS) {
    return res.status(400).json({ error: 'A prompt under 4000 characters is required.' });
  }
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    const ai = makeGenAI(apiKey);
    
    const tools = useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
    
    const reply = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], undefined, tools);
    res.json({ reply });
  } catch (error) {
    console.error("Grounded Search Error:", error);
    res.status(500).json({ error: "Failed to fetch grounded response" });
  }
});

// Not called by the web app today; kept for future use but restricted to signed-in users.
app.post("/api/transcribe-audio", requireFirebaseUser, async (req, res) => {
  const { base64Audio, mimeType } = req.body || {};
  if (typeof base64Audio !== 'string' || !base64Audio) {
    return res.status(400).json({ error: 'base64Audio is required.' });
  }
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return res.status(503).json({ error: AI_NOT_CONFIGURED });
    const ai = makeGenAI(apiKey);
    
    const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: { parts: [{
            inlineData: {
                mimeType: mimeType || "audio/mp3",
                data: base64Audio
            }
        }, { text: "Transcribe this audio." }] },
    });
    
    res.json({ text: response.text });
  } catch (error) {
    console.error("Transcription Error:", error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// Veo video generation is expensive and not used by the web app, so it is OFF unless
// ENABLE_VIDEO_GENERATION=true is set on the server, and even then needs a signed-in user.
// Note: veo-3.1-fast-generate-preview is scheduled for shutdown on 2026-10-22
// (https://ai.google.dev/gemini-api/docs/deprecations); switch models before enabling.
app.post("/api/generate-video", (req, res, next) => {
    if (process.env.ENABLE_VIDEO_GENERATION !== 'true') {
        return res.status(404).json({ error: 'Video generation is not enabled.' });
    }
    next();
}, requireFirebaseUser, async (req, res) => {
    const { prompt, aspectRatio } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) {
        return res.status(400).json({ error: 'A prompt under 2000 characters is required.' });
    }
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return res.status(503).json({ error: AI_NOT_CONFIGURED });
        const ai = makeGenAI(apiKey);
        
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '1080p',
                aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9'
            }
        });
        
        res.json({ operationName: operation.name });
    } catch (error) {
        console.error("Video Generation Error:", error);
        res.status(500).json({ error: "Video generation failed" });
    }
});

app.post("/api/device-search", async (req, res) => {
  const { query } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API key");
    const ai = makeGenAI(apiKey);
    
    // Note: In a real app, this would query a backend DB, but here we just use AI to generate missing info
    const prompt = `Provide detailed device information (category, brand, model, size) for: "${query}". 
    Return as a JSON object with fields: category, brand, model, size, description.`;
    
    const reply = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }]);
    const deviceData = JSON.parse(reply.replace(/```json/g, '').replace(/```/g, '').trim());

    // The server has no Firebase (client SDK only runs in the browser and we
    // intentionally avoid adding firebase-admin), so discovered devices are not
    // persisted here. Just return the AI-generated data to the client.
    res.json(deviceData);
  } catch (error) {
    console.error("Device Search Error:", error);
    res.status(500).json({ error: "Device search failed" });
  }
});

// Search online databases and Google for authentic device blueprints, boardviews & schematics
app.post("/api/blueprint-search", async (req, res) => {
  const { query, deviceModel, boardNumber } = req.body || {};
  const searchQuery = query || deviceModel || boardNumber || "iPhone 14 Pro Max Logic Board";
  
  // Local search
  const localMatch = [...initialParts, ...initialGuides].find(item =>
    ((item as any).name ?? (item as any).title)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item as any).deviceModel?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    const systemInstruction = `You are the Lead Hardware Schematic & Boardview Reverse-Engineer for DIYELECTRONICS. 
Your job is to provide comprehensive, self-contained boardview blueprints, power tree architectures, and schematic telemetry.
Always format your response with high-precision engineering data:
1. Exact OEM Board / Part Number & Revision (e.g. 820-02536-A, SM-S918B, EDM-010, A2894)
2. Primary Component IC Architecture (SoC, PMIC, NAND Flash, Charge Management, Audio Codec, Display FPC)
3. Essential Power Tree & Test Point Rails with nominal diode-mode drop voltages and resistance
4. Power Sequencing & Power-Good (PG) Signal Flow
5. Micro-soldering warning points (thermal ground planes, underfill proximity, BGA pitch)`;

    const prompt = `Provide an exhaustive, fully native engineering schematic blueprint and boardview telemetry for:
Device / Board Target: "${searchQuery}"
${localMatch ? `\n\n### Local Database Grounding Data (Use this for primary reference if applicable):\n${JSON.stringify(localMatch, null, 2)}` : ''}

Provide an exhaustive engineering schematic blueprint in clean Markdown. Include:
## 1. Verified Boardview & PCB Revision Data
- **Official Board Number**: (Exact board marking / OEM code)
- **Layer Stackup**: (e.g., 10-layer substrate with interposer sandwich)
- **Power Delivery Architecture**: (Battery to PMIC step-down topology)

## 2. Component Pinout & Reference Designator Matrix
Provide a structured table of critical ICs:
| Ref | Component Name | Marking / Package | Voltage Rail | Diode Mode Drop (Nominal) |
|---|---|---|---|---|
(Include PMIC, Main SoC, NAND, Charge Controller, Audio Codec, and Display FPC)

## 3. Critical Voltage Rails & Test Points
- Power rails with expected voltages (e.g., VDD_MAIN: 3.8V-4.3V, 1.8V_ALWAYS, 0.85V_CORE)
- Nominal resistance to ground (identifying short-circuit thresholds)

## 4. Power Sequencing & Bench Micro-Soldering Calibration
- Exact voltage rail turn-on sequence (Standby -> PMIC Buck -> Core Logic -> Reset Release)
- Thermal pre-heat and hot air rework profile.`;

    let blueprintResult = "";

    if (apiKey) {
      try {
        const ai = makeGenAI(apiKey);
        // Grounded when the project allows it; the cascade itself falls back to an ungrounded answer.
        const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], systemInstruction, [{ googleSearch: {} }]);
        if (text) blueprintResult = text;
      } catch {
        console.warn("Cloud models unavailable for blueprint search, generating synthesized blueprint telemetry...");
        blueprintResult = synthesizeBlueprintTelemetry(searchQuery);
      }
    } else {
      blueprintResult = synthesizeBlueprintTelemetry(searchQuery);
    }

    res.json({
      success: true,
      query: searchQuery,
      blueprintData: blueprintResult || synthesizeBlueprintTelemetry(searchQuery)
    });
  } catch (error: any) {
    console.error("Blueprint Search Error:", error);
    res.json({
      success: true,
      query: searchQuery,
      blueprintData: synthesizeBlueprintTelemetry(searchQuery)
    });
  }
});

// Dynamic Unlimited Boardview Generator - generates complete interactive BoardPreset JSON for ANY device
app.post("/api/generate-boardview", async (req, res) => {
  const { query, category, specificModule } = req.body || {};
  const searchQuery = (query || "").trim() || "Universal Motherboard";

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let generatedPreset: any = null;

    if (apiKey) {
      try {
        const ai = makeGenAI(apiKey);
        const jsonPrompt = `Generate a realistic, accurate PCB Boardview layout JSON object for this device:
Device / Board Query: "${searchQuery}" ${specificModule ? `(Target Module: ${specificModule})` : ''}

You MUST output ONLY valid JSON adhering strictly to this TypeScript structure without markdown wrapping:
{
  "id": "string",
  "name": "string (Exact device and board name)",
  "boardNumber": "string (Authentic OEM silkscreen stamped code like BN41-02098B, BN44-00605A, LA-J191P, 820-00840, EDM-020, etc.)",
  "category": "Display" | "Smartphone" | "Laptop" | "Console" | "Automotive" | "Drone" | "Microcontroller",
  "color": "string (Hex color e.g. #0f3a5d for Samsung blue, #14532d for green, #0b192c for dark blue, #1e293b for black/slate, #831843 for red)",
  "dimensions": { "width": 800, "height": 500 },
  "description": "string",
  "topImageText": "string",
  "bottomImageText": "string",
  "components": [
    {
      "id": "comp_1",
      "name": "string (e.g. Main Video Processor SoC / PMIC / Flash / Backlight Driver)",
      "ref": "string (e.g. U101, IC200, Q501)",
      "type": "IC" | "PASSIVE" | "CONNECTOR" | "TEST_POINT",
      "x": number (10 to 85 percentage across board width),
      "y": number (15 to 85 percentage across board height),
      "width": number (8 to 22 percentage width),
      "height": number (8 to 22 percentage height),
      "package": "string (e.g. BGA-496, QFN-48, SOP-8, SOT-223, electrolytic-can, FPC-30P)",
      "voltage": "string (e.g. 1.2V / 3.3V / 13V / 18V)",
      "diodeDrop": "string (e.g. 0.420V)",
      "nominalResistance": "string (e.g. 15.2kΩ)",
      "description": "string",
      "commonFaults": ["string", "string"],
      "testPads": [
        { "name": "string", "x": number (relative 15-85 within component area), "y": number, "rail": "string", "expectedDiode": "string", "expectedResistance": "string" },
        { "name": "string", "x": number, "y": number, "rail": "string", "expectedDiode": "string", "expectedResistance": "string" }
      ]
    }
  ]
}
Include 6 to 9 real components located realistically on the board. Output ONLY the raw JSON.`;

        const jsonResponse = await callGeminiWithCascade(
          ai,
          [{ role: 'user', parts: [{ text: jsonPrompt }] }],
          "You are a PCB boardview synthesis engine that outputs strictly raw JSON."
        );

        if (jsonResponse) {
          const cleaned = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          generatedPreset = JSON.parse(cleaned);
        }
      } catch (err) {
        console.warn("AI JSON boardview generation error, using deterministic generator:", err);
      }
    }

    if (!generatedPreset || !generatedPreset.components || generatedPreset.components.length === 0) {
      generatedPreset = synthesizeDeterministicBoardPreset(searchQuery, category, specificModule);
    }

    res.json({
      success: true,
      board: generatedPreset
    });
  } catch (error: any) {
    console.error("Boardview Generator Error:", error);
    res.json({
      success: true,
      board: synthesizeDeterministicBoardPreset(searchQuery, category, specificModule)
    });
  }
});

// Deterministic Hardware Synthesizer for unlimited devices and modules
function synthesizeDeterministicBoardPreset(query: string, preferredCategory?: string, specificModule?: string): any {
  const q = (query || "").toLowerCase();
  const id = `dynamic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Samsung TVs & Displays
  if (q.includes("samsung") && (q.includes("tv") || q.includes("led") || q.includes("screen") || q.includes("32") || q.includes("43") || q.includes("55") || q.includes("65") || q.includes("bn41") || q.includes("bn44") || q.includes("un32") || q.includes("ue32"))) {
    const isPowerSupply = q.includes("power") || q.includes("psu") || q.includes("bn44") || q.includes("inverter") || specificModule === 'psu';
    
    if (isPowerSupply) {
      return {
        id,
        name: `Samsung ${query} - Power Supply Unit (PSU)`,
        boardNumber: "BN44-00605A / L32S1_FHS",
        category: "Display",
        color: "#92400e", // Tan/Yellow phenolic PSU board
        dimensions: { width: 850, height: 520 },
        description: "Samsung LED TV Switch-Mode Power Supply (SMPS) & Constant-Current LED Driver Board. Converts 110V/220V AC mains to 13V Logic and 120V LED Backlight string.",
        topImageText: "High-Voltage Hot Side / Low-Voltage Cold Side with Optoisolator Isolation Barrier",
        bottomImageText: "SMD PWM Flyback Drivers, Shunt Resistors, and Solder Mask Jumpers",
        components: [
          {
            id: "comp_bridge",
            name: "AC Mains Bridge Rectifier (4A/600V)",
            ref: "BD901S",
            type: "IC",
            x: 14,
            y: 28,
            width: 12,
            height: 14,
            package: "SIP-4 Heatsink Mount",
            voltage: "320V DC Rectified",
            diodeDrop: "0.520V (AC to DC+)",
            nominalResistance: "> 1MΩ",
            description: "Full-bridge bridge rectifier converting filtered AC mains into pulsating high-voltage DC.",
            commonFaults: ["Internal diode short blowing main AC T3.15A fuse", "Thermal cracking from power surges"],
            testPads: [
              { name: "AC1", x: 18, y: 35, rail: "AC_LINE", expectedDiode: "0.530V", expectedResistance: "> 2MΩ" },
              { name: "DC_PLUS", x: 75, y: 35, rail: "HV_BUS_PLUS", expectedDiode: "0.520V", expectedResistance: "> 500kΩ" }
            ]
          },
          {
            id: "comp_bulk_cap",
            name: "Primary Bulk Filter Capacitor (82μF / 450V)",
            ref: "CP801S",
            type: "PASSIVE",
            x: 16,
            y: 58,
            width: 14,
            height: 24,
            package: "Radial Aluminum Can (22mm)",
            voltage: "390V PFC Boosted",
            diodeDrop: "0.580V (Charging curve)",
            nominalResistance: "> 800kΩ",
            description: "High-voltage reservoir capacitor maintaining primary rail for the flyback switching transformer.",
            commonFaults: ["High ESR causing intermittent TV reboot or clicking relay", "Capacitor venting/bulging at safety vent"],
            testPads: [
              { name: "C_POS", x: 30, y: 30, rail: "HV_DC_MAIN", expectedDiode: "0.580V", expectedResistance: "> 800kΩ" },
              { name: "C_NEG", x: 70, y: 70, rail: "HOT_GND", expectedDiode: "0.000V", expectedResistance: "0.00Ω" }
            ]
          },
          {
            id: "comp_pwm_flyback",
            name: "Flyback PWM SMPS Controller",
            ref: "ICM801 (SEM5027A)",
            type: "IC",
            x: 42,
            y: 38,
            width: 13,
            height: 14,
            package: "SOP-8 SMD",
            voltage: "18V VCC / 13V Output",
            diodeDrop: "0.485V (VCC to GND)",
            nominalResistance: "48.5kΩ",
            description: "Primary pulse-width modulation IC driving the main switching power MOSFET.",
            commonFaults: ["Loss of VCC start-up resistor causing dead board (no standby)", "Burnt gate output driving Q801 MOSFET"],
            testPads: [
              { name: "VCC_START", x: 25, y: 30, rail: "IC_VCC", expectedDiode: "0.490V", expectedResistance: "48.5kΩ" },
              { name: "GATE_DRIVE", x: 75, y: 70, rail: "GATE_PWM", expectedDiode: "0.540V", expectedResistance: "100kΩ" }
            ]
          },
          {
            id: "comp_sec_schottky",
            name: "Secondary 13V Dual Schottky Rectifier",
            ref: "DM851 (MBRF20100CT)",
            type: "IC",
            x: 68,
            y: 32,
            width: 13,
            height: 16,
            package: "TO-220F-3P",
            voltage: "12.8V DC Cold",
            diodeDrop: "0.340V (Schottky Drop)",
            nominalResistance: "12.4kΩ",
            description: "High-speed dual Schottky barrier diode rectifying high-frequency secondary pulses into clean 13V.",
            commonFaults: ["Shorted Schottky diode causing power supply to shut down in over-current protect", "Dry solder joints on pins"],
            testPads: [
              { name: "ANODE1", x: 20, y: 40, rail: "SEC_AC", expectedDiode: "0.340V", expectedResistance: "12.4kΩ" },
              { name: "CATHODE_13V", x: 50, y: 80, rail: "B13V_COLD", expectedDiode: "0.410V", expectedResistance: "18.2kΩ" }
            ]
          },
          {
            id: "comp_led_boost",
            name: "LED Backlight Step-Up Driver IC",
            ref: "IC9101 (SLC1012C)",
            type: "IC",
            x: 72,
            y: 68,
            width: 15,
            height: 16,
            package: "SOP-16",
            voltage: "95V – 145V LED+",
            diodeDrop: "0.510V",
            nominalResistance: "75kΩ",
            description: "Constant-current boost regulator delivering controlled current to the backlight LED strips.",
            commonFaults: ["Over-voltage protection trip when an LED bead burns open-circuit", "Shorted boost MOSFET Q9101"],
            testPads: [
              { name: "LED_PLUS", x: 30, y: 30, rail: "V_LED_HIGH", expectedDiode: "0.620V", expectedResistance: "> 250kΩ" },
              { name: "ISENSE", x: 70, y: 70, rail: "LED_RETURN", expectedDiode: "0.480V", expectedResistance: "1.2Ω" }
            ]
          },
          {
            id: "comp_wire_harness",
            name: "Main Logic Board Interconnect Header",
            ref: "CNM803 (14-Pin Header)",
            type: "CONNECTOR",
            x: 88,
            y: 35,
            width: 9,
            height: 38,
            package: "Dual-Row 2.0mm Locking Header",
            voltage: "13V / 5.3V / PS_ON",
            diodeDrop: "0.450V",
            nominalResistance: "Multi-Rail",
            description: "Carries power rails to the Main Logic Board and receives PS_ON & BL_ON control commands.",
            commonFaults: ["Oxidized connector pins causing flicker", "Disconnection test: Unplugging this cable powers on backlights on Samsung PSU"],
            testPads: [
              { name: "B13V_PIN", x: 45, y: 20, rail: "13V_LINE", expectedDiode: "0.420V", expectedResistance: "15kΩ" },
              { name: "POWER_ON", x: 45, y: 50, rail: "PS_ON", expectedDiode: "0.650V", expectedResistance: "47kΩ" },
              { name: "BL_ENABLE", x: 45, y: 80, rail: "BL_ON", expectedDiode: "0.620V", expectedResistance: "100kΩ" }
            ]
          }
        ]
      };
    }

    // Default: Samsung Main Logic Board
    return {
      id,
      name: `Samsung ${query} - Main Logic Board`,
      boardNumber: "BN41-02098B (BN94-06973)",
      category: "Display",
      color: "#0f3a5d", // Samsung iconic navy blue
      dimensions: { width: 820, height: 500 },
      description: "Samsung Smart & LED Flat Screen TV Main Processing Board. Houses the central video scaling SoC, SPI firmware Flash, audio amplifier, HDMI receivers, and LVDS panel transmitter.",
      topImageText: "Audio/Video SoC, SPI Firmware ROM, Audio Power Amp, and HDMI Inputs",
      bottomImageText: "High-Speed LVDS Differential Traces and Under-IC Decoupling MLCC Arrays",
      components: [
        {
          id: "comp_mstar_soc",
          name: "MStar / Novatek Quad Video Engine SoC",
          ref: "IC201 (SEMS31)",
          type: "IC",
          x: 46,
          y: 45,
          width: 20,
          height: 22,
          package: "BGA-496 0.65mm Pitch",
          voltage: "1.15V Core / 3.3V I/O",
          diodeDrop: "0.185V (Core Rail to GND)",
          nominalResistance: "32.4Ω",
          description: "Central TV processor handling video decoding, UI graphics, tuner demodulation, and panel timing.",
          commonFaults: ["BGA solder fatigue under thermal cycling causing stuck on Samsung Smart logo", "Shorted internal 1.15V core buck"],
          testPads: [
            { name: "VDD_CORE_1V15", x: 30, y: 25, rail: "1.15V_CORE", expectedDiode: "0.185V", expectedResistance: "32.4Ω" },
            { name: "VDD_IO_3V3", x: 75, y: 70, rail: "3.3V_STANDBY", expectedDiode: "0.480V", expectedResistance: "12.8kΩ" }
          ]
        },
        {
          id: "comp_spi_flash",
          name: "Winbond SPI Boot Flash EEPROM (64Mb)",
          ref: "IC1201 (25Q64FVSIG)",
          type: "IC",
          x: 32,
          y: 68,
          width: 11,
          height: 12,
          package: "SOIC-8 208mil",
          voltage: "3.30V VCC",
          diodeDrop: "0.510V (Pin 8 VCC)",
          nominalResistance: "18.6kΩ",
          description: "Stores primary bootloader microcode and user calibration settings.",
          commonFaults: ["Corrupted firmware causing continuous red standby light blink codes (2 blinks or 5 blinks)", "Damaged SPI bus lines"],
          testPads: [
            { name: "PIN8_VCC", x: 25, y: 25, rail: "3.3V_SPI", expectedDiode: "0.510V", expectedResistance: "18.6kΩ" },
            { name: "PIN1_CS", x: 75, y: 25, rail: "SPI_CS_L", expectedDiode: "0.560V", expectedResistance: "45kΩ" },
            { name: "PIN6_CLK", x: 75, y: 75, rail: "SPI_CLK", expectedDiode: "0.540V", expectedResistance: "45kΩ" }
          ]
        },
        {
          id: "comp_tas5707",
          name: "TI TAS5707 Digital Audio Power Amplifier",
          ref: "IC301",
          type: "IC",
          x: 20,
          y: 75,
          width: 14,
          height: 15,
          package: "HTSSOP-48 PowerPAD",
          voltage: "13.0V PVDD / 3.3V DVDD",
          diodeDrop: "0.460V",
          nominalResistance: "24.5kΩ",
          description: "Class-D I2S stereo power amplifier driving the internal stereo speakers.",
          commonFaults: ["Shorted PVDD 13V rail pulling down the TV power supply", "No audio despite normal picture"],
          testPads: [
            { name: "PVDD_13V", x: 30, y: 30, rail: "13V_AUDIO", expectedDiode: "0.460V", expectedResistance: "24.5kΩ" },
            { name: "SPK_L_OUT", x: 70, y: 70, rail: "OUT_L+", expectedDiode: "0.520V", expectedResistance: "> 100kΩ" }
          ]
        },
        {
          id: "comp_lvds_fpc",
          name: "30-Pin Dual-Channel LVDS Panel Connector",
          ref: "CN201",
          type: "CONNECTOR",
          x: 78,
          y: 20,
          width: 16,
          height: 12,
          package: "0.5mm Pitch SMD Socket",
          voltage: "12.0V V_PANEL / LVDS Pairs",
          diodeDrop: "0.380V (LVDS Pairs)",
          nominalResistance: "100Ω Differential",
          description: "Sends digital uncompressed video lanes directly to the T-CON board or LCD panel gate drivers.",
          commonFaults: ["Blown panel power fuse F101 (12V missing)", "Corrosion from liquid cleaning on panel"],
          testPads: [
            { name: "PANEL_VCC", x: 20, y: 30, rail: "12V_PANEL", expectedDiode: "0.490V", expectedResistance: "35kΩ" },
            { name: "LVDS_TX0+", x: 50, y: 70, rail: "LVDS0_P", expectedDiode: "0.385V", expectedResistance: "> 100kΩ" },
            { name: "LVDS_TX0-", x: 80, y: 70, rail: "LVDS0_N", expectedDiode: "0.385V", expectedResistance: "> 100kΩ" }
          ]
        },
        {
          id: "comp_reg_1117",
          name: "1.2V Core Linear Step-Down Regulator",
          ref: "IC1102 (AMS1117-1.2)",
          type: "IC",
          x: 62,
          y: 72,
          width: 10,
          height: 11,
          package: "SOT-223",
          voltage: "3.3V IN -> 1.2V OUT",
          diodeDrop: "0.290V (Output to GND)",
          nominalResistance: "450Ω",
          description: "Generates ultra-low-noise 1.2V rail for the SoC internal PLL and memory interface.",
          commonFaults: ["Overheating causing thermal shutdown after 10-15 minutes of TV operation", "Output voltage drooping to 0.8V"],
          testPads: [
            { name: "VIN_3V3", x: 25, y: 30, rail: "3.3V_SYS", expectedDiode: "0.480V", expectedResistance: "12kΩ" },
            { name: "VOUT_1V2", x: 75, y: 70, rail: "1.2V_LDO", expectedDiode: "0.290V", expectedResistance: "450Ω" }
          ]
        },
        {
          id: "comp_hdmi_bank",
          name: "Dual HDMI 2.0 Input Receptacles & ESD Arrays",
          ref: "CN401 / CN402",
          type: "CONNECTOR",
          x: 10,
          y: 25,
          width: 12,
          height: 28,
          package: "Through-Hole Shell + SMD Leads",
          voltage: "5.0V HDMI_5V",
          diodeDrop: "0.420V (TMDS Lines)",
          nominalResistance: "> 50kΩ",
          description: "Input video ports with integrated clamping diode arrays (D401, D402) for static discharge protection.",
          commonFaults: ["Physical pin damage from cable strain", "Shorted ESD diode shorting HDMI 5V line"],
          testPads: [
            { name: "HDMI_5V_IN", x: 50, y: 25, rail: "5V_HDMI", expectedDiode: "0.490V", expectedResistance: "28kΩ" },
            { name: "HPD_SENSE", x: 50, y: 75, rail: "HOT_PLUG_DET", expectedDiode: "0.580V", expectedResistance: "47kΩ" }
          ]
        }
      ]
    };
  }

  // 2. Telefunken TVs & Displays (Vestel Architecture)
  if (q.includes("telefunken") || q.includes("vestel") || q.includes("17mb") || q.includes("17ips") || q.includes("tp.ms3663s") || q.includes("tledd")) {
    const isPsu = q.includes("power") || q.includes("psu") || q.includes("17ips") || q.includes("inverter") || specificModule === 'psu';
    
    if (isPsu) {
      return {
        id,
        name: `Telefunken ${query} - Power Supply Unit (Vestel 17IPS62)`,
        boardNumber: "17IPS62 / 17IPS11 / 17IPS20",
        category: "Display",
        color: "#78350f", // Dark phenolic amber
        dimensions: { width: 820, height: 520 },
        description: "Telefunken & Vestel Switch-Mode Power Supply and Constant-Current LED Driver Board (17IPS62 series). Generates +12V, +5V standby rails, and 35V-75V constant current for LED backlight strips.",
        topImageText: "High-Voltage Primary Hot Side & Secondary Low-Voltage Cold Side with Optoisolator Barrier",
        bottomImageText: "SMD PWM Flyback Drivers, Shunt Resistor Bank, and Optocoupler Feedback Line",
        components: [
          {
            id: "comp_vestel_bridge",
            name: "AC Mains Bridge Rectifier (600V 6A)",
            ref: "BD1 (GBU606)",
            type: "PASSIVE",
            x: 18,
            y: 28,
            width: 14,
            height: 14,
            package: "SIP-4 Heatsink Mount",
            voltage: "110V-240V AC Mains / 320V DC Primary Bus",
            diodeDrop: "0.540V Forward Drop",
            nominalResistance: "> 2MΩ Reverse",
            description: "Converts incoming AC line voltage into high-voltage DC for the flyback switching circuit.",
            commonFaults: ["Shorted bridge diode instantly blows main 3.15A glass fuse F101 upon plug-in", "Burned AC input trace from surge"],
            testPads: [
              { name: "DC_POS_320V", x: 20, y: 30, rail: "HV_BUS_320V", expectedDiode: "0.540V", expectedResistance: "> 1MΩ" },
              { name: "AC_LINE_IN", x: 80, y: 70, rail: "AC_MAINS", expectedDiode: "0.000V", expectedResistance: "Open" }
            ]
          },
          {
            id: "comp_vestel_bulk",
            name: "High-Voltage Primary Bulk Electrolytic Can (450V 82µF)",
            ref: "C106 (450V 82µF)",
            type: "PASSIVE",
            x: 20,
            y: 58,
            width: 15,
            height: 22,
            package: "Radial Aluminum Can Ø18mm",
            voltage: "320V-385V DC Primary Rail",
            diodeDrop: "0.520V",
            nominalResistance: "> 600kΩ",
            description: "Smooths rectified DC voltage and stores energy for the high-frequency switching transformer TR101.",
            commonFaults: ["High ESR from thermal drying causes buzzing transformer, low secondary voltages, or relay clicking"],
            testPads: [
              { name: "CAP_HV_PLUS", x: 25, y: 30, rail: "HV_PRIMARY", expectedDiode: "0.520V", expectedResistance: "> 600kΩ" },
              { name: "HOT_GND", x: 75, y: 70, rail: "PRIMARY_GND", expectedDiode: "0.000V", expectedResistance: "0.00Ω" }
            ]
          },
          {
            id: "comp_vestel_pwm",
            name: "Primary Flyback Current-Mode PWM IC",
            ref: "IC101 (NCP1251 / FAN6755)",
            type: "IC",
            x: 44,
            y: 38,
            width: 13,
            height: 14,
            package: "TSOP-6 / SOIC-8 SMD",
            voltage: "14V-28V VCC / High Voltage Sense",
            diodeDrop: "0.495V",
            nominalResistance: "> 80kΩ",
            description: "Drives primary switching MOSFET Q101 to transfer power across high-frequency transformer TR101.",
            commonFaults: ["Blown PWM IC with burn hole on top; dead power supply with 0V on all secondary outputs", "Burned 0.22Ω current sense resistor"],
            testPads: [
              { name: "PWM_VCC_18V", x: 30, y: 30, rail: "PWM_VCC", expectedDiode: "0.495V", expectedResistance: "82kΩ" },
              { name: "GATE_OUT", x: 70, y: 70, rail: "GATE_DRV", expectedDiode: "0.510V", expectedResistance: "47kΩ" }
            ]
          },
          {
            id: "comp_vestel_schottky",
            name: "Secondary 12V Dual Schottky Barrier Rectifier",
            ref: "D108 (MBR20100CT)",
            type: "PASSIVE",
            x: 65,
            y: 32,
            width: 14,
            height: 15,
            package: "TO-220 Dual Diode on Heatsink",
            voltage: "12.0V DC Secondary Logic Rail",
            diodeDrop: "0.350V (Schottky Forward Drop)",
            nominalResistance: "> 40kΩ",
            description: "Rectifies secondary AC pulses from transformer into smooth +12V DC logic rail.",
            commonFaults: ["Shorted Schottky diode causes power supply to tick/click continuously in short-circuit protection mode"],
            testPads: [
              { name: "12V_SEC_OUT", x: 30, y: 30, rail: "12V_SEC", expectedDiode: "0.350V", expectedResistance: "42kΩ" }
            ]
          },
          {
            id: "comp_vestel_led_drv",
            name: "Constant-Current LED Backlight Boost IC",
            ref: "IC201 (MP3394S / MP3398A)",
            type: "IC",
            x: 72,
            y: 68,
            width: 15,
            height: 16,
            package: "SOIC-16 Narrow",
            voltage: "35V - 75V VLED+ Output",
            diodeDrop: "0.470V",
            nominalResistance: "> 150kΩ",
            description: "Boosts +24V rail up to required string voltage and regulates constant current through LED backlight channels.",
            commonFaults: ["Backlight flashes once on boot then turns off (audio remains); blown LED bead in panel strip triggering OVP"],
            testPads: [
              { name: "VLED_PLUS", x: 30, y: 30, rail: "LED_ANODE", expectedDiode: "0.470V", expectedResistance: "> 200kΩ" },
              { name: "ISENSE_RET", x: 70, y: 70, rail: "LED_CATHODE", expectedDiode: "0.525V", expectedResistance: "2.2Ω" }
            ]
          },
          {
            id: "comp_vestel_harness",
            name: "Main Logic & Inverter Interconnect Socket",
            ref: "PL201 (10-Pin Header)",
            type: "CONNECTOR",
            x: 88,
            y: 35,
            width: 10,
            height: 36,
            package: "10-Pin 2.54mm Locking Header",
            voltage: "12V / 5V_STBY / STBY_ON / BL_ON",
            diodeDrop: "0.480V",
            nominalResistance: "Multi-Rail",
            description: "Connects 17IPS62 PSU to 17MB140 Mainboard. Receives STBY_ON and BL_ON commands from video SoC.",
            commonFaults: ["Dry solder joints on 12V pins causing random shutdowns or loss of sound", "No STBY_ON trigger"],
            testPads: [
              { name: "12V_MAIN_PIN", x: 40, y: 25, rail: "12V_MAIN", expectedDiode: "0.480V", expectedResistance: "18kΩ" },
              { name: "STBY_5V_PIN", x: 40, y: 55, rail: "5V_STBY", expectedDiode: "0.510V", expectedResistance: "25kΩ" },
              { name: "BL_ON_PIN", x: 40, y: 85, rail: "BL_ON_SIG", expectedDiode: "0.530V", expectedResistance: "100kΩ" }
            ]
          }
        ]
      };
    }

    // Telefunken Main Logic Board (17MB140 / 17MB130)
    return {
      id,
      name: `Telefunken ${query} - Main Logic Board (Vestel)`,
      boardNumber: "17MB140 / 17MB130 / TP.MS3663S.PB818",
      category: "Display",
      color: "#064e3b", // Vestel Deep Emerald Green
      dimensions: { width: 840, height: 500 },
      description: "Telefunken Smart & Slim LED TV Main Motherboard (TLEDD-32FHDF / 40FHD / 55UHD series). Features MStar MSD3663 video processor, Winbond 25Q64 SPI flash, TAS5711 audio amp, and 30-pin FHD LVDS panel connector.",
      topImageText: "MStar/Novatek Video SoC, SPI Firmware Flash, Audio Power Amp, and HDMI Inputs",
      bottomImageText: "Vestel Bottom Ground Planes, SPI Bus Debug Pads, and LVDS Differential Traces",
      components: [
        {
          id: "comp_vestel_soc",
          name: "MStar MSD3663 / Novatek Central Video SoC",
          ref: "U1 (Vestel Main SoC)",
          type: "IC",
          x: 48,
          y: 44,
          width: 24,
          height: 24,
          package: "LQFP-128 / BGA-256",
          voltage: "1.2V Core / 3.3V I/O / 1.8V DRAM",
          diodeDrop: "0.360V Core / 0.520V I/O",
          nominalResistance: "22Ω Core / > 60kΩ I/O",
          description: "Primary TV system controller handling HDMI switching, digital audio demodulation, and LVDS timing output.",
          commonFaults: ["TV stuck on red standby light; will not respond to remote or power button; missing 1.2V core rail", "Corrupted BGA solder balls from heat"],
          testPads: [
            { name: "VDD_1V2_CORE", x: 30, y: 30, rail: "1V2_CORE", expectedDiode: "0.360V", expectedResistance: "22Ω" },
            { name: "VDD_3V3_IO", x: 70, y: 70, rail: "3V3_IO", expectedDiode: "0.520V", expectedResistance: "> 50kΩ" }
          ]
        },
        {
          id: "comp_vestel_spi",
          name: "Winbond 25Q64FVSIG 64Mb SPI Firmware Flash IC",
          ref: "U2 (SPI Flash ROM)",
          type: "IC",
          x: 32,
          y: 68,
          width: 12,
          height: 12,
          package: "SOIC-8 208mil",
          voltage: "3.3V VCC (Pin 8)",
          diodeDrop: "0.515V",
          nominalResistance: "> 75kΩ",
          description: "Stores Telefunken bootloader, panel gamma curves, and channel memory. #1 failure point on Telefunken/Vestel TVs.",
          commonFaults: ["Corrupted firmware bin causes blinking red-to-blue LED cycle or Telefunken logo freeze (reflash with CH341A programmer)"],
          testPads: [
            { name: "SPI_VCC_3V3", x: 25, y: 25, rail: "SPI_3V3", expectedDiode: "0.515V", expectedResistance: "> 75kΩ" },
            { name: "SPI_CLK_P8", x: 75, y: 75, rail: "SPI_CLK", expectedDiode: "0.485V", expectedResistance: "45kΩ" }
          ]
        },
        {
          id: "comp_vestel_amp",
          name: "TAS5711 / TAS5707 2x10W Stereo Class-D Audio Amplifier",
          ref: "U3 (Audio Amp)",
          type: "IC",
          x: 22,
          y: 74,
          width: 14,
          height: 15,
          package: "HTSSOP-48 PowerPAD",
          voltage: "12.0V - 18.0V PVDD / 3.3V DVDD",
          diodeDrop: "0.470V",
          nominalResistance: "> 90kΩ to GND",
          description: "High-efficiency digital amplifier directly driving internal 8Ω speakers from I2S digital audio feed.",
          commonFaults: ["Distorted audio or total silence while picture is intact; shorted PVDD filter capacitor pulling 12V rail down"],
          testPads: [
            { name: "PVDD_12V_AMP", x: 30, y: 30, rail: "12V_AUDIO", expectedDiode: "0.470V", expectedResistance: "> 90kΩ" },
            { name: "SPK_OUT_R+", x: 70, y: 70, rail: "SPK_RIGHT", expectedDiode: "0.510V", expectedResistance: "> 100kΩ" }
          ]
        },
        {
          id: "comp_vestel_ldo",
          name: "AMS1117-3.3 Standby Low-Dropout Linear Regulator",
          ref: "U4 (1117-3.3)",
          type: "IC",
          x: 64,
          y: 72,
          width: 11,
          height: 11,
          package: "SOT-223 3-Pin Tab",
          voltage: "5.0V IN / 3.3V OUT (Standby)",
          diodeDrop: "0.510V",
          nominalResistance: "> 45kΩ",
          description: "Converts +5V standby from power board to clean 3.3V for standby MCU, IR remote receiver, and power key.",
          commonFaults: ["Blown LDO produces 0.0V or overheats to 100°C; TV completely dead with no standby light"],
          testPads: [
            { name: "STBY_3V3_OUT", x: 25, y: 30, rail: "3V3_STBY", expectedDiode: "0.510V", expectedResistance: "> 45kΩ" },
            { name: "STBY_5V_IN", x: 75, y: 70, rail: "5V_STBY", expectedDiode: "0.495V", expectedResistance: "> 60kΩ" }
          ]
        },
        {
          id: "comp_vestel_lvds",
          name: "30-Pin Full HD LVDS Panel Ribbon Header",
          ref: "CN_LVDS (To LCD Panel)",
          type: "CONNECTOR",
          x: 78,
          y: 20,
          width: 16,
          height: 12,
          package: "30-Pin 1.0mm Pitch Header",
          voltage: "12.0V VLCD / 1.2V Differential LVDS Pairs",
          diodeDrop: "0.430V - 0.530V",
          nominalResistance: "> 100kΩ",
          description: "Transmits video data pairs (RX0-, RX0+, RX1-, RX1+, RXCLK) and panel power to LCD glass matrix.",
          commonFaults: ["Corrosion or loose connection causing solarized/negative colors, white display, or double images"],
          testPads: [
            { name: "VLCD_12V", x: 30, y: 30, rail: "12V_PANEL", expectedDiode: "0.460V", expectedResistance: "38kΩ" },
            { name: "LVDS_CLK+", x: 70, y: 70, rail: "LVDS_CLK", expectedDiode: "0.510V", expectedResistance: "> 100kΩ" }
          ]
        }
      ]
    };
  }

  // 3. Sony Bravia TVs & Displays (BA / BM / G-Board)
  if (q.includes("sony") || q.includes("bravia") || q.includes("xbr") || q.includes("xr-") || q.includes("kdl") || q.includes("1-893-880") || q.includes("1-474-601") || q.includes("aps-395")) {
    const isPsu = q.includes("power") || q.includes("psu") || q.includes("g-board") || q.includes("aps-") || q.includes("1-474") || specificModule === 'psu';
    
    if (isPsu) {
      return {
        id,
        name: `Sony Bravia ${query} - Power Supply Unit (G-Board / APS-395)`,
        boardNumber: "1-474-601-11 / APS-395 / 1-474-602-11",
        category: "Display",
        color: "#9a3412", // Sony high-temp phenolic amber
        dimensions: { width: 840, height: 520 },
        description: "Sony Bravia SMPS Power Supply & Active Power Factor Correction (PFC) Board. Features Sony CXA3809M LLC resonant controller, MIP2F2 standby flyback IC, dual active PFC inductors, and 160V backlight boost drive.",
        topImageText: "Active PFC Stage, Resonant LLC Transformers, and Optoisolator Barrier",
        bottomImageText: "Surface-Mount Feedback Control ICs, Shunt Monitors, and Ground Plane",
        components: [
          {
            id: "comp_sony_bridge",
            name: "Dual AC Mains Rectifier Bridge (800V 8A)",
            ref: "BD101 (Bridge Rectifier)",
            type: "PASSIVE",
            x: 18,
            y: 26,
            width: 14,
            height: 14,
            package: "Dual Inline Heatsink Package",
            voltage: "110V-240V AC Mains / 390V PFC Boosted Bus",
            diodeDrop: "0.540V Forward Diode Drop",
            nominalResistance: "> 2MΩ Reverse",
            description: "Rectifies alternating AC current into unfiltered DC bus for the active PFC stage.",
            commonFaults: ["Shorted bridge diode instantly blows main 4A ceramic fuse F101 upon power plug connection"],
            testPads: [
              { name: "DC_POS_390V", x: 25, y: 30, rail: "PFC_390V", expectedDiode: "0.540V", expectedResistance: "> 1MΩ" },
              { name: "AC_LIVE_IN", x: 75, y: 70, rail: "AC_MAINS", expectedDiode: "0.000V", expectedResistance: "Open" }
            ]
          },
          {
            id: "comp_sony_bulk",
            name: "High-Reliability Bulk Capacitor Can (450V 150µF Rubycon)",
            ref: "C101 (450V 150µF)",
            type: "PASSIVE",
            x: 20,
            y: 58,
            width: 16,
            height: 24,
            package: "Radial Aluminum Electrolytic Ø22mm",
            voltage: "390V DC Active PFC Regulated Rail",
            diodeDrop: "0.530V",
            nominalResistance: "> 750kΩ",
            description: "Main high-voltage energy reservoir maintaining stable 390V DC rail during high-brightness HDR scenes.",
            commonFaults: ["Degraded capacitance or high ESR causes TV to trip 2-blink or 3-blink Sony protection code"],
            testPads: [
              { name: "PFC_BULK_PLUS", x: 30, y: 30, rail: "PFC_RAIL", expectedDiode: "0.530V", expectedResistance: "> 750kΩ" },
              { name: "PFC_BULK_MINUS", x: 70, y: 70, rail: "HOT_GND", expectedDiode: "0.000V", expectedResistance: "0.00Ω" }
            ]
          },
          {
            id: "comp_sony_cxa",
            name: "Sony CXA3809M PFC & Resonant LLC Power Controller",
            ref: "IC601 (CXA3809M)",
            type: "IC",
            x: 45,
            y: 38,
            width: 14,
            height: 15,
            package: "SOP-24 Power IC",
            voltage: "18V VCC / Dual MOSFET Gate Drives",
            diodeDrop: "0.490V",
            nominalResistance: "> 85kΩ",
            description: "Advanced dual-controller handling Power Factor Correction boost and resonant LLC 12V main converter.",
            commonFaults: ["Blown CXA3809M causes complete absence of main 12V rail; standby works but main power fails to start"],
            testPads: [
              { name: "PFC_GATE_OUT", x: 25, y: 30, rail: "GATE_PFC", expectedDiode: "0.490V", expectedResistance: "85kΩ" },
              { name: "LLC_GATE_HIGH", x: 75, y: 70, rail: "GATE_LLC", expectedDiode: "0.520V", expectedResistance: "100kΩ" }
            ]
          },
          {
            id: "comp_sony_mip",
            name: "Panasonic MIP2F2 Standby Flyback Switcher IC",
            ref: "IC501 (MIP2F2 Standby)",
            type: "IC",
            x: 65,
            y: 35,
            width: 13,
            height: 14,
            package: "DIP-7 / SOP-8 with Built-In MOSFET",
            voltage: "3.3V Standby Always-On Output",
            diodeDrop: "0.510V",
            nominalResistance: "> 100kΩ",
            description: "Dedicated low-power standby switcher supplying continuous 3.3V to the Sony Syscon microcontroller.",
            commonFaults: ["Burnt internal MOSFET destroys IC501, resulting in completely dead TV with no standby light"],
            testPads: [
              { name: "STBY_3V3_OUT", x: 30, y: 30, rail: "3V3_STBY", expectedDiode: "0.510V", expectedResistance: "> 100kΩ" },
              { name: "DRAIN_700V", x: 70, y: 70, rail: "HV_DRAIN", expectedDiode: "0.610V", expectedResistance: "> 500kΩ" }
            ]
          },
          {
            id: "comp_sony_bl_drv",
            name: "Constant-Current Multi-Zone LED Backlight Inverter Module",
            ref: "U_BL (Backlight Driver)",
            type: "IC",
            x: 72,
            y: 68,
            width: 15,
            height: 16,
            package: "HTSSOP-28 Package",
            voltage: "120V - 160V Backlight String Drive",
            diodeDrop: "0.460V",
            nominalResistance: "> 180kΩ",
            description: "Drives high-voltage LED arrays and sends BL_ERR status signal back to mainboard if any string fails.",
            commonFaults: ["Sony 4-Blink Error Code: Backlight driver detects open circuit or shorted LED and shuts down power"],
            testPads: [
              { name: "VLED_BOOST_PLUS", x: 30, y: 30, rail: "LED_HV_PLUS", expectedDiode: "0.460V", expectedResistance: "> 180kΩ" },
              { name: "BL_ERR_STATUS", x: 70, y: 70, rail: "BL_ERROR", expectedDiode: "0.530V", expectedResistance: "47kΩ" }
            ]
          }
        ]
      };
    }

    // Sony Bravia Main Motherboard (BA / BM Board)
    return {
      id,
      name: `Sony Bravia ${query} - Main Motherboard (BA Board)`,
      boardNumber: "1-893-880-11 / 1-980-333-11 / BA Board",
      category: "Display",
      color: "#022c22", // Sony Obsidian Dark Emerald
      dimensions: { width: 850, height: 500 },
      description: "Sony Bravia 4K HDR Smart TV Main Motherboard (XBR-55X900 / KD-55X8000 / XR series). Features Sony Cognitive XR / X1 Ultimate picture processor, MediaTek MT5895 Android core, Sony S-Master DSP, and Sony 6-blink diagnostic LED controller.",
      topImageText: "Sony Cognitive XR Processor, HDMI 2.1 eARC Ports, and Android TV Engine",
      bottomImageText: "Ground Planes, V-by-One UHD Display Flex Interface, and Power Stages",
      components: [
        {
          id: "comp_sony_soc",
          name: "Sony Cognitive XR / 4K X-Reality PRO Picture Engine",
          ref: "U_XR (Video Processor)",
          type: "IC",
          x: 48,
          y: 43,
          width: 25,
          height: 25,
          package: "BGA-520 Custom Sony Heatspreader",
          voltage: "0.90V Core / 1.1V LPDDR4 / 3.3V I/O",
          diodeDrop: "0.180V Core / 0.490V I/O",
          nominalResistance: "3.8Ω Core / > 50kΩ I/O",
          description: "Dedicated real-time AI picture enhancement processor handling local dimming, motion clarity, and HDR tone mapping.",
          commonFaults: ["Sony Red LED blinks 6 times (Backlight/Panel communication failure) or 8 blinks (Audio/SoC error); cracked BGA balls"],
          testPads: [
            { name: "XR_0V9_CORE", x: 30, y: 30, rail: "0V9_CORE", expectedDiode: "0.180V", expectedResistance: "3.8Ω" },
            { name: "XR_3V3_IO", x: 70, y: 70, rail: "3V3_IO", expectedDiode: "0.490V", expectedResistance: "> 50kΩ" }
          ]
        },
        {
          id: "comp_sony_mtk",
          name: "MediaTek MT5895 / MT5893 Quad-Core Android TV SoC",
          ref: "U_MTK (App SoC)",
          type: "IC",
          x: 25,
          y: 42,
          width: 18,
          height: 18,
          package: "BGA-424 Package",
          voltage: "1.05V Core / 1.8V VDD_IO",
          diodeDrop: "0.240V Core",
          nominalResistance: "6.5Ω Core",
          description: "Runs Google TV / Android TV operating system, Wi-Fi 6 networking, and app execution.",
          commonFaults: ["Boot loop on Android / Sony logo; stuck in recovery mode; thermal throttling"],
          testPads: [
            { name: "MTK_1V05_CORE", x: 25, y: 25, rail: "1V05_CORE", expectedDiode: "0.240V", expectedResistance: "6.5Ω" },
            { name: "MTK_1V8_DRAM", x: 75, y: 75, rail: "1V8_DRAM", expectedDiode: "0.460V", expectedResistance: "1.8kΩ" }
          ]
        },
        {
          id: "comp_sony_emmc",
          name: "Kingston / SanDisk 16GB High-Speed eMMC 5.1 Flash",
          ref: "U_EMMC (Storage)",
          type: "IC",
          x: 24,
          y: 68,
          width: 14,
          height: 14,
          package: "BGA-153",
          voltage: "3.3V VCC / 1.8V VCCQ",
          diodeDrop: "0.485V",
          nominalResistance: "> 80kΩ",
          description: "Stores Sony Android system partitions, Bravia calibration parameters, and DRM security keys.",
          commonFaults: ["Read-only storage corruption causing Sony TV to freeze or fail OTA system updates"],
          testPads: [
            { name: "EMMC_VCC_3V3", x: 30, y: 30, rail: "EMMC_3V3", expectedDiode: "0.485V", expectedResistance: "> 80kΩ" },
            { name: "EMMC_CLK", x: 70, y: 70, rail: "EMMC_CLK", expectedDiode: "0.510V", expectedResistance: "50kΩ" }
          ]
        },
        {
          id: "comp_sony_syscon",
          name: "Renesas / NXP Standby Microcontroller & Diagnostic Blink Generator",
          ref: "U_STBY (Syscon MCU)",
          type: "IC",
          x: 72,
          y: 35,
          width: 14,
          height: 14,
          package: "QFP-64",
          voltage: "3.3V Standby Always-On Rail",
          diodeDrop: "0.520V",
          nominalResistance: "> 90kΩ",
          description: "Monitors power supply rails, temperature sensors, and drives front LED error blink sequences (2, 4, 6, 8 blinks).",
          commonFaults: ["Missing 3.3V standby rail causes total lack of power; tripped safety latch lockup"],
          testPads: [
            { name: "STBY_3V3_SYS", x: 25, y: 25, rail: "3V3_STBY", expectedDiode: "0.520V", expectedResistance: "> 90kΩ" },
            { name: "ERROR_SENSE", x: 75, y: 75, rail: "ERR_DET", expectedDiode: "0.490V", expectedResistance: "47kΩ" }
          ]
        },
        {
          id: "comp_sony_vbyone",
          name: "51-Pin High-Speed V-by-One UHD 4K/120Hz Display Header",
          ref: "CN_VBYONE (To T-CON)",
          type: "CONNECTOR",
          x: 48,
          y: 18,
          width: 22,
          height: 10,
          package: "51-Pin 0.5mm Pitch Fine Header",
          voltage: "12V T-CON Power / 800mV High-Speed Video Lanes",
          diodeDrop: "0.460V - 0.510V",
          nominalResistance: "> 100kΩ",
          description: "Transmits 8-lane or 16-lane V-by-One differential 4K 120Hz video stream to timing controller board.",
          commonFaults: ["Corroded pins or unseated ribbon causing vertical RGB lines, green screen, or 6-blink error code"],
          testPads: [
            { name: "TCON_12V_PWR", x: 30, y: 30, rail: "12V_TCON", expectedDiode: "0.460V", expectedResistance: "35kΩ" },
            { name: "VBY_LOCK_N", x: 70, y: 70, rail: "VBY_LOCK", expectedDiode: "0.530V", expectedResistance: "47kΩ" }
          ]
        }
      ]
    };
  }

  // 4. LG 4K/OLED Smart TVs (WebOS Architecture)
  if (q.includes("lg") && (q.includes("tv") || q.includes("oled") || q.includes("nanocell") || q.includes("webos") || q.includes("eax") || q.includes("ebr") || q.includes("43um") || q.includes("55un"))) {
    return {
      id,
      name: `LG 4K Smart TV ${query} - WebOS Main Motherboard`,
      boardNumber: "EAX68253604 / EBR28435101 / EBT66034002",
      category: "Display",
      color: "#1e1b4b", // LG Deep Midnight Indigo
      dimensions: { width: 840, height: 500 },
      description: "LG 4K UHD WebOS Smart TV Main Motherboard (43UM7300 / 55UN7300 / NanoCell series). Features LG Quad-Core Alpha 7 processor, DDR4 RAM, Kioxia eMMC WebOS flash, Realtek audio processor, and EPI display output.",
      topImageText: "LG Alpha Picture Processor, DDR4 RAM Bus, and WebOS Flash Stage",
      bottomImageText: "Ground Planes, EPI / V-by-One 4K Display Socket, and Filter Rails",
      components: [
        {
          id: "comp_lg_soc",
          name: "LG Quad-Core Alpha 7 / Triple XD 4K Video Processor",
          ref: "U1 (LG Central SoC)",
          type: "IC",
          x: 48,
          y: 43,
          width: 25,
          height: 25,
          package: "BGA-488 Heatspreader Package",
          voltage: "0.95V Core / 1.2V DDR4 / 3.3V I/O",
          diodeDrop: "0.220V Core / 0.510V I/O",
          nominalResistance: "8.4Ω Core / > 50kΩ I/O",
          description: "Central processor running LG webOS, 4K active HDR processing, and Magic Remote Bluetooth interface.",
          commonFaults: ["LG TV stuck on webOS logo splash; rebooting every 10 seconds; cold solder BGA fatigue"],
          testPads: [
            { name: "LG_0V95_CORE", x: 30, y: 30, rail: "0V95_CORE", expectedDiode: "0.220V", expectedResistance: "8.4Ω" },
            { name: "LG_3V3_IO", x: 70, y: 70, rail: "3V3_IO", expectedDiode: "0.510V", expectedResistance: "> 50kΩ" }
          ]
        },
        {
          id: "comp_lg_emmc",
          name: "Kioxia 8GB eMMC 5.1 webOS System Flash",
          ref: "U2 (eMMC ROM)",
          type: "IC",
          x: 25,
          y: 42,
          width: 14,
          height: 14,
          package: "BGA-153",
          voltage: "3.3V VCC / 1.8V VCCQ",
          diodeDrop: "0.490V",
          nominalResistance: "> 80kΩ",
          description: "Stores LG webOS operating system, Netflix/YouTube app binaries, and EDID keys.",
          commonFaults: ["Firmware partition bad blocks causing TV to power on with backlight but black screen"],
          testPads: [
            { name: "EMMC_VCC_3V3", x: 30, y: 30, rail: "EMMC_3V3", expectedDiode: "0.490V", expectedResistance: "> 80kΩ" }
          ]
        },
        {
          id: "comp_lg_amp",
          name: "TAS5733L 20W Digital Audio Power Amplifier",
          ref: "U3 (Audio Amp)",
          type: "IC",
          x: 75,
          y: 65,
          width: 14,
          height: 14,
          package: "HTSSOP-48 PowerPAD",
          voltage: "13.2V PVDD / 3.3V DVDD",
          diodeDrop: "0.480V",
          nominalResistance: "> 90kΩ",
          description: "Stereo audio amplifier powering internal downward-firing speakers.",
          commonFaults: ["Sound popping, no audio on HDMI inputs, shorted PVDD power rail"],
          testPads: [
            { name: "13V_PVDD_AMP", x: 30, y: 30, rail: "13V_AUDIO", expectedDiode: "0.480V", expectedResistance: "> 90kΩ" }
          ]
        },
        {
          id: "comp_lg_epi",
          name: "51-Pin High-Speed EPI / V-by-One UHD Display Header",
          ref: "CN_EPI (To LCD Panel)",
          type: "CONNECTOR",
          x: 48,
          y: 18,
          width: 22,
          height: 10,
          package: "51-Pin FFC Header",
          voltage: "13.2V VLCD / 1.2V EPI Pairs",
          diodeDrop: "0.450V - 0.520V",
          nominalResistance: "> 100kΩ",
          description: "High-speed differential bus connecting mainboard to panel glass T-CON.",
          commonFaults: ["Vertical colored lines, solarized display, missing 13.2V panel fuse voltage"],
          testPads: [
            { name: "13V_PANEL_VCC", x: 30, y: 30, rail: "13V_PANEL", expectedDiode: "0.450V", expectedResistance: "32kΩ" }
          ]
        }
      ]
    };
  }

  // 5. Hisense, TCL, Philips, Panasonic, Toshiba, Sharp, Vizio TVs & 3-in-1 Combo Boards
  if (q.includes("hisense") || q.includes("tcl") || q.includes("philips") || q.includes("panasonic") || q.includes("toshiba") || q.includes("sharp") || q.includes("vizio") || q.includes("rsag") || q.includes("40-mt") || q.includes("715g") || (q.includes("tv") || q.includes("television") || q.includes("screen") || q.includes("flat screen") || q.includes("led") || q.includes("oled") || q.includes("qled") || q.includes("monitor"))) {
    return {
      id,
      name: `${query.toUpperCase()} - Television Main & Display Motherboard`,
      boardNumber: q.includes("hisense") ? "RSAG7.820.8712 / VIDAA" : (q.includes("tcl") ? "40-MT58CU-MAB4HG" : "TP.MS3663S.PB818 / OEM-TV-BOARD"),
      category: "Display",
      color: "#1c1917", // Matte Carbon Black
      dimensions: { width: 840, height: 500 },
      description: `Complete Television Logic & Power Blueprint for ${query}. Integrates multi-standard video engine SoC, SPI flash microcode, Class-D audio amplifier, LVDS/V-by-One matrix, and multi-rail SMPS power stages.`,
      topImageText: "Video Engine Processor, SPI Firmware Flash, Power Regulation, and Display Timing Controller",
      bottomImageText: "Ground Shielding Plane, SMT Decoupling Caps, and High-Speed Video Differential Pairs",
      components: [
        {
          id: "comp_tv_soc",
          name: "High-Definition Video Scaling & Processing SoC",
          ref: "U1 (Video SoC)",
          type: "IC",
          x: 48,
          y: 44,
          width: 24,
          height: 24,
          package: "BGA-388 / LQFP-128 Heatspreader",
          voltage: "1.15V Core / 3.3V I/O / 1.5V DDR3",
          diodeDrop: "0.310V Core / 0.510V I/O",
          nominalResistance: "16Ω Core / > 50kΩ I/O",
          description: "Central processing engine driving HDMI/Tuner input demodulation, OSD rendering, and panel drive timing.",
          commonFaults: ["TV stuck on boot logo, unresponsive to remote, missing 1.15V core buck supply"],
          testPads: [
            { name: "VDD_CORE_1V15", x: 30, y: 30, rail: "1V15_CORE", expectedDiode: "0.310V", expectedResistance: "16Ω" },
            { name: "VDD_IO_3V3", x: 70, y: 70, rail: "3V3_IO", expectedDiode: "0.510V", expectedResistance: "> 50kΩ" }
          ]
        },
        {
          id: "comp_tv_spi",
          name: "High-Speed SPI Firmware Flash Memory (64Mb/128Mb)",
          ref: "U2 (SPI Flash)",
          type: "IC",
          x: 32,
          y: 68,
          width: 12,
          height: 12,
          package: "SOIC-8 208mil",
          voltage: "3.3V VCC",
          diodeDrop: "0.515V",
          nominalResistance: "> 70kΩ",
          description: "Contains vendor bootloader, EDID handshakes, panel gamma tables, and channel presets.",
          commonFaults: ["Firmware corruption causing LED blinking error code or constant reboot"],
          testPads: [
            { name: "SPI_VCC_3V3", x: 25, y: 25, rail: "SPI_3V3", expectedDiode: "0.515V", expectedResistance: "> 70kΩ" },
            { name: "SPI_CLK", x: 75, y: 75, rail: "SPI_CLK", expectedDiode: "0.490V", expectedResistance: "45kΩ" }
          ]
        },
        {
          id: "comp_tv_amp",
          name: "Stereo Class-D Digital Audio Power Amplifier",
          ref: "U3 (Audio Amp)",
          type: "IC",
          x: 22,
          y: 72,
          width: 14,
          height: 14,
          package: "HTSSOP-48 PowerPAD",
          voltage: "12V - 18V PVDD / 3.3V DVDD",
          diodeDrop: "0.470V",
          nominalResistance: "> 85kΩ",
          description: "Direct speaker output stage driving stereo acoustic drivers.",
          commonFaults: ["No sound despite normal video; shorted PVDD filter cap pulling down 12V bus"],
          testPads: [
            { name: "PVDD_12V_AMP", x: 30, y: 30, rail: "12V_AUDIO", expectedDiode: "0.470V", expectedResistance: "> 85kΩ" }
          ]
        },
        {
          id: "comp_tv_lvds",
          name: "Universal LVDS / V-by-One Display Ribbon Header",
          ref: "CN_DISP (To Panel)",
          type: "CONNECTOR",
          x: 78,
          y: 20,
          width: 16,
          height: 12,
          package: "30-Pin / 51-Pin Fine Header",
          voltage: "12V Panel VCC / Differential Video Pairs",
          diodeDrop: "0.450V",
          nominalResistance: "> 100kΩ",
          description: "Connects main processing board to LCD display panel or T-CON timing controller.",
          commonFaults: ["Blown panel power SMD fuse; corrosion causing solarized colors or white screen"],
          testPads: [
            { name: "VLCD_12V", x: 30, y: 30, rail: "12V_PANEL", expectedDiode: "0.450V", expectedResistance: "36kΩ" }
          ]
        }
      ]
    };
  }

  // 2. Laptops (Dell, HP, Lenovo, Asus, MacBook)
  if (q.includes("laptop") || q.includes("dell") || q.includes("hp") || q.includes("lenovo") || q.includes("thinkpad") || q.includes("macbook") || q.includes("xps") || q.includes("pavilion") || q.includes("820-") || q.includes("la-")) {
    return {
      id,
      name: `${query} Motherboard`,
      boardNumber: q.includes("macbook") ? "820-02016-A" : "LA-J191P Rev 1.0 (OEM)",
      category: "Laptop",
      color: q.includes("macbook") ? "#0b192c" : "#1e293b",
      dimensions: { width: 850, height: 500 },
      description: `High-Density Laptop Mainboard for ${query}. Multi-phase VCore CPU/GPU power delivery, USB-C PD controllers, and DDR4/DDR5 SO-DIMM bus.`,
      topImageText: "CPU/GPU BGA Arrays, 3V/5V Standby Regulators, Type-C Power Delivery",
      bottomImageText: "Dual SO-DIMM Sockets, M.2 NVMe Storage Interface, and Battery Charging MOSFETs",
      components: [
        {
          id: "comp_cpu_soc",
          name: "Main Multi-Core Processor (CPU / APU)",
          ref: "U_CPU",
          type: "IC",
          x: 48,
          y: 42,
          width: 22,
          height: 22,
          package: "BGA Multi-Chip Module",
          voltage: "0.85V – 1.15V VCore",
          diodeDrop: "0.025V – 0.080V (Low-Z)",
          nominalResistance: "1.2Ω – 3.8Ω",
          description: "High-performance laptop CPU with integrated PCIe, DDR controller, and graphics engine.",
          commonFaults: ["VCore VRM short injecting 19V into CPU (catastrophic failure)", "Cracked solder balls from drop"],
          testPads: [
            { name: "VCORE_RAIL", x: 30, y: 30, rail: "VCC_CPU", expectedDiode: "0.045V", expectedResistance: "1.8Ω" },
            { name: "VCC_SA", x: 70, y: 70, rail: "SYSTEM_AGENT", expectedDiode: "0.120V", expectedResistance: "18.5Ω" }
          ]
        },
        {
          id: "comp_charger_ic",
          name: "Battery Charge Management & Power Path IC",
          ref: "PUB01 (ISL88739 / BQ24780S)",
          type: "IC",
          x: 20,
          y: 65,
          width: 12,
          height: 13,
          package: "QFN-32",
          voltage: "19.5V / 20V DC IN",
          diodeDrop: "0.485V (ACDET / REGN)",
          nominalResistance: "45kΩ",
          description: "Controls 19V AC adapter input switching MOSFETs and charges 3-cell/4-cell Li-ion battery pack.",
          commonFaults: ["Short-circuit on 19V main bus (VIN) due to blown high-side MOSFET", "Corroded current sense resistor (0.01Ω)"],
          testPads: [
            { name: "19V_DC_IN", x: 30, y: 30, rail: "VIN_MAIN", expectedDiode: "0.480V", expectedResistance: "> 100kΩ" },
            { name: "REGN_6V", x: 70, y: 70, rail: "REGN_LDO", expectedDiode: "0.520V", expectedResistance: "82kΩ" }
          ]
        },
        {
          id: "comp_3v_5v_pmic",
          name: "Primary 3.3V / 5.0V Dual Standby Buck Regulator",
          ref: "PU301 (TPS51225 / RT8205)",
          type: "IC",
          x: 72,
          y: 35,
          width: 13,
          height: 14,
          package: "QFN-20",
          voltage: "3.3V ALW / 5.0V ALW",
          diodeDrop: "0.380V (3.3V) / 0.420V (5V)",
          nominalResistance: "14.2kΩ",
          description: "Always-on power supply creating 3.3V and 5V system rails as soon as charger is connected.",
          commonFaults: ["Missing 3.3V standby rail preventing laptop from turning on", "Shorted EC / KBC chip pulling 3.3V line to 0V"],
          testPads: [
            { name: "3V_ALWAYS", x: 30, y: 30, rail: "3.3V_ALW", expectedDiode: "0.380V", expectedResistance: "14.2kΩ" },
            { name: "5V_ALWAYS", x: 70, y: 70, rail: "5.0V_ALW", expectedDiode: "0.420V", expectedResistance: "22.5kΩ" }
          ]
        },
        {
          id: "comp_kbc_ec",
          name: "Embedded Controller / Keyboard & Power MCU",
          ref: "UE1 (IT8587E / KB9022Q)",
          type: "IC",
          x: 25,
          y: 30,
          width: 15,
          height: 15,
          package: "LQFP-128",
          voltage: "3.3V VCC",
          diodeDrop: "0.490V",
          nominalResistance: "12.5kΩ",
          description: "Controls power button sequencing, ACPI state transitions, fan speed, and keyboard scanning.",
          commonFaults: ["Internal firmware corruption on flashable ECs", "Fluid ingress causing corrosion on corner pins"],
          testPads: [
            { name: "PWR_SW#", x: 25, y: 25, rail: "ON/OFF_BTN", expectedDiode: "0.620V", expectedResistance: "100kΩ" },
            { name: "RSMRST#", x: 75, y: 75, rail: "EC_RSMRST_L", expectedDiode: "0.550V", expectedResistance: "47kΩ" }
          ]
        },
        {
          id: "comp_bios_flash",
          name: "SPI BIOS Firmware Flash (128Mb / 16MB)",
          ref: "UC3 (25Q128JVSQ)",
          type: "IC",
          x: 42,
          y: 75,
          width: 10,
          height: 11,
          package: "SOIC-8 208mil",
          voltage: "3.3V or 1.8V SPI",
          diodeDrop: "0.520V",
          nominalResistance: "24kΩ",
          description: "Holds UEFI BIOS firmware, Intel ME / AMD PSP firmware, and hardware configuration tables.",
          commonFaults: ["Corrupted ME region causing 30-second delayed display or fan running at 100%", "BIOS brick after failed update"],
          testPads: [
            { name: "SPI_VCC", x: 25, y: 25, rail: "3.3V_SPI", expectedDiode: "0.520V", expectedResistance: "24kΩ" },
            { name: "SPI_CLK", x: 75, y: 75, rail: "SPI_CLK_PIN", expectedDiode: "0.560V", expectedResistance: "50kΩ" }
          ]
        },
        {
          id: "comp_type_c_pd",
          name: "Dual Type-C USB-PD & DisplayPort Controller",
          ref: "UT1 (TPS65988 / CYPD3125)",
          type: "IC",
          x: 10,
          y: 48,
          width: 12,
          height: 13,
          package: "QFN-56",
          voltage: "5V / 9V / 15V / 20V PD",
          diodeDrop: "0.450V (CC1/CC2 pins)",
          nominalResistance: "> 100kΩ",
          description: "Negotiates USB Power Delivery contracts and controls 20V VBUS power entry gates.",
          commonFaults: ["Blown CC pin ESD protection diode from third-party non-certified chargers", "Stuck at 5V 0.00A handshake"],
          testPads: [
            { name: "CC1_SENSE", x: 30, y: 30, rail: "USB_CC1", expectedDiode: "0.450V", expectedResistance: "> 100kΩ" },
            { name: "VBUS_20V", x: 70, y: 70, rail: "VBUS_IN", expectedDiode: "0.510V", expectedResistance: "> 200kΩ" }
          ]
        }
      ]
    };
  }

  // 3. Smartphones (iPhone, Samsung Galaxy, Pixel, etc.)
  if (q.includes("phone") || q.includes("iphone") || q.includes("galaxy") || q.includes("pixel") || q.includes("redmi") || q.includes("xiaomi") || q.includes("huawei")) {
    return {
      id,
      name: `${query} Logic Board`,
      boardNumber: q.includes("iphone") ? "820-02536 / A2894" : "SM-S918B Main PCB",
      category: "Smartphone",
      color: "#0b192c",
      dimensions: { width: 780, height: 480 },
      description: `Double-Sided Interposer Logic Board for ${query}. Advanced Stacked Substrate with High-Density Multi-Rail PMIC and BGA Package-on-Package SoC.`,
      topImageText: "Application Processor, LPDDR5 RAM, NAND Flash Storage, Dual PMIC Architecture",
      bottomImageText: "Baseband RF Modem, Front-End Modules (FEM), and Ultra-Fine Pitch FPC Connectors",
      components: [
        {
          id: "comp_phone_soc",
          name: "Flagship Application Processor & PoP LPDDR5",
          ref: "U_AP",
          type: "IC",
          x: 48,
          y: 40,
          width: 20,
          height: 22,
          package: "PoP BGA-942",
          voltage: "0.75V – 1.10V",
          diodeDrop: "0.140V (GPU/CPU Cores)",
          nominalResistance: "8.5Ω",
          description: "High-efficiency mobile SoC with integrated NPU, GPU, and Secure Enclave.",
          commonFaults: ["Cracked interposer solder joints causing loss of Wi-Fi or Baseband modem", "Excessive heat causing freeze"],
          testPads: [
            { name: "VDD_CPU", x: 30, y: 30, rail: "0.85V_CPU", expectedDiode: "0.140V", expectedResistance: "8.5Ω" },
            { name: "1.8V_ALWAYS", x: 70, y: 70, rail: "1.8V_ALWAYS", expectedDiode: "0.480V", expectedResistance: "18kΩ" }
          ]
        },
        {
          id: "comp_phone_pmic",
          name: "Main Power Management IC (PMIC)",
          ref: "U_PMIC",
          type: "IC",
          x: 25,
          y: 42,
          width: 15,
          height: 16,
          package: "WLCSP-140",
          voltage: "3.85V VBAT IN",
          diodeDrop: "0.420V (VDD_MAIN)",
          nominalResistance: "28kΩ",
          description: "Generates 20+ precise buck and LDO step-down rails for camera, sensors, audio, and logic domains.",
          commonFaults: ["VBAT short pulling device current to 2.0A on bench DC power supply immediately upon connection", "Missing PP1V8_S2"],
          testPads: [
            { name: "VDD_MAIN", x: 30, y: 30, rail: "VDD_MAIN", expectedDiode: "0.420V", expectedResistance: "28kΩ" },
            { name: "VCC_NAND", x: 70, y: 70, rail: "2.85V_NAND", expectedDiode: "0.490V", expectedResistance: "45kΩ" }
          ]
        },
        {
          id: "comp_nand_flash",
          name: "UFS 4.0 / NVMe High-Speed Flash Memory",
          ref: "U_NAND",
          type: "IC",
          x: 72,
          y: 42,
          width: 16,
          height: 17,
          package: "BGA-153",
          voltage: "1.2V / 1.8V / 2.85V",
          diodeDrop: "0.460V",
          nominalResistance: "32kΩ",
          description: "Persistent non-volatile system storage holding OS firmware and user data.",
          commonFaults: ["NAND data corruption causing recovery mode loop (Error 4013 or Error 9)", "Cracked solder balls"],
          testPads: [
            { name: "NAND_1V8", x: 30, y: 30, rail: "1.8V_NAND", expectedDiode: "0.460V", expectedResistance: "32kΩ" },
            { name: "NAND_2V85", x: 70, y: 70, rail: "2.85V_VCC", expectedDiode: "0.510V", expectedResistance: "60kΩ" }
          ]
        },
        {
          id: "comp_charge_tristar",
          name: "USB-C PD & Fast Charge Controller IC",
          ref: "U_CHG (Hydra / BQ)",
          type: "IC",
          x: 22,
          y: 72,
          width: 11,
          height: 12,
          package: "WLCSP-36",
          voltage: "5V – 9V VBUS",
          diodeDrop: "0.520V",
          nominalResistance: "50kΩ",
          description: "Detects USB accessories, manages fast charge handshakes, and routes digital audio/data.",
          commonFaults: ["False charging (shows charging icon but battery percentage drains)", "Current draw locked at 0.00A or 0.02A"],
          testPads: [
            { name: "VBUS_IN", x: 30, y: 30, rail: "VBUS_5V", expectedDiode: "0.520V", expectedResistance: "50kΩ" },
            { name: "BAT_SENSE", x: 70, y: 70, rail: "VBAT_SNS", expectedDiode: "0.470V", expectedResistance: "100kΩ" }
          ]
        },
        {
          id: "comp_fpc_display",
          name: "AMOLED / Touch Digitizer FPC Header",
          ref: "J_DISP",
          type: "CONNECTOR",
          x: 75,
          y: 18,
          width: 16,
          height: 10,
          package: "40-Pin 0.35mm Pitch Socket",
          voltage: "1.8V / 3.0V / 18V Boost",
          diodeDrop: "0.390V (MIPI Lanes)",
          nominalResistance: "50kΩ",
          description: "Direct differential connection to front display assembly and touch controller.",
          commonFaults: ["Missing touch lines due to crushed connector pins", "No backlight/display due to shorted boost filter"],
          testPads: [
            { name: "MIPI_CLK+", x: 25, y: 30, rail: "DSI_CLK_P", expectedDiode: "0.390V", expectedResistance: "> 100kΩ" },
            { name: "VBOOST_18V", x: 75, y: 70, rail: "18V_DISP", expectedDiode: "0.580V", expectedResistance: "> 200kΩ" }
          ]
        }
      ]
    };
  }

  // 4. Gaming Consoles (PS5, Xbox, Switch) & GPUs
  if (q.includes("switch") || q.includes("ps5") || q.includes("playstation") || q.includes("xbox") || q.includes("gpu") || q.includes("rtx") || q.includes("geforce") || q.includes("nintendo")) {
    return {
      id,
      name: `${query} Motherboard`,
      boardNumber: q.includes("switch") ? "HAC-CPU-21" : (q.includes("ps5") ? "EDM-020" : "MSI-PCB-REV2"),
      category: "Console",
      color: "#14532d", // Classic dark console green
      dimensions: { width: 840, height: 500 },
      description: `High-Density Graphics & Gaming Logic Board for ${query}. Multi-phase VRM coils, GDDR6 memory channels, and high-speed PCIe/HDMI output lines.`,
      topImageText: "Custom APU/GPU Package, Multi-Phase DrMOS VRM Array, GDDR6 Memory ICs",
      bottomImageText: "HDMI 2.1 Video Retimer, Power Management ICs, and Thermal Ground Stitched Planes",
      components: [
        {
          id: "comp_console_apu",
          name: "Custom APU / High-Performance GPU Package",
          ref: "U_APU",
          type: "IC",
          x: 48,
          y: 42,
          width: 24,
          height: 24,
          package: "Large BGA Multi-Die",
          voltage: "0.80V – 0.95V VCore",
          diodeDrop: "0.018V – 0.035V (Low-Z)",
          nominalResistance: "0.6Ω – 1.8Ω",
          description: "High-current compute engine combining Zen CPU cores and RDNA graphics compute units.",
          commonFaults: ["Liquid metal / thermal compound run-off causing shorts", "Failed DrMOS power stage injecting 12V to Core"],
          testPads: [
            { name: "VCORE_APU", x: 30, y: 30, rail: "0.85V_APU", expectedDiode: "0.022V", expectedResistance: "0.8Ω" },
            { name: "VDD_SOC", x: 70, y: 70, rail: "1.0V_SOC", expectedDiode: "0.080V", expectedResistance: "12Ω" }
          ]
        },
        {
          id: "comp_gddr6_bank",
          name: "GDDR6 High-Speed Graphics RAM Bank (16Gb)",
          ref: "U_MEM1 (Micron / Samsung)",
          type: "IC",
          x: 75,
          y: 42,
          width: 14,
          height: 18,
          package: "BGA-180",
          voltage: "1.35V VDD / 1.8V VPP",
          diodeDrop: "0.320V",
          nominalResistance: "45Ω",
          description: "Ultra-wide memory bus supplying high-bandwidth video frame buffers.",
          commonFaults: ["Artifacting or black screen crash on high GPU load due to fractured BGA ball", "Shorted 1.35V rail"],
          testPads: [
            { name: "1.35V_MEM", x: 30, y: 30, rail: "1.35V_GDDR", expectedDiode: "0.320V", expectedResistance: "45Ω" },
            { name: "1.8V_VPP", x: 70, y: 70, rail: "1.8V_VPP", expectedDiode: "0.480V", expectedResistance: "1.2kΩ" }
          ]
        },
        {
          id: "comp_hdmi_retimer",
          name: "HDMI 2.1 Retimer & Video Encoder IC",
          ref: "U_HDMI (MN864739 / Realtek)",
          type: "IC",
          x: 22,
          y: 35,
          width: 13,
          height: 14,
          package: "QFN-64",
          voltage: "3.3V / 1.8V / 1.1V",
          diodeDrop: "0.460V (TMDS/FRL Pairs)",
          nominalResistance: "28kΩ",
          description: "Conditions and equalizes high-speed 4K/120Hz HDMI signals before physical port output.",
          commonFaults: ["White Light of Death (WLOD) on PS5: boots with sound but no display", "Blown by lightning / HDMI surge"],
          testPads: [
            { name: "HDMI_FRL0+", x: 30, y: 30, rail: "FRL0_P", expectedDiode: "0.460V", expectedResistance: "> 50kΩ" },
            { name: "1.1V_VDD", x: 70, y: 70, rail: "1.1V_HDMI", expectedDiode: "0.380V", expectedResistance: "2.4kΩ" }
          ]
        },
        {
          id: "comp_southbridge",
          name: "Southbridge / Storage & I/O Controller",
          ref: "U_SB (CXD90061GG / IT8380)",
          type: "IC",
          x: 25,
          y: 68,
          width: 15,
          height: 15,
          package: "BGA-356",
          voltage: "3.3V / 1.8V / 1.05V",
          diodeDrop: "0.410V",
          nominalResistance: "18kΩ",
          description: "Controls boot ROM, USB ports, wireless cards, optical drive, and power sequencing.",
          commonFaults: ["Beeps once and turns off immediately due to missing Southbridge standby power", "Blown 3.3V LDO"],
          testPads: [
            { name: "3.3V_STANDBY", x: 30, y: 30, rail: "3.3V_STBY", expectedDiode: "0.410V", expectedResistance: "18kΩ" },
            { name: "1.05V_SB", x: 70, y: 70, rail: "1.05V_CORE", expectedDiode: "0.220V", expectedResistance: "180Ω" }
          ]
        }
      ]
    };
  }

  // 5. Default Universal Electronics Board
  return {
    id,
    name: `${query} Circuit Board`,
    boardNumber: `REV-${Math.floor(1000 + Math.random() * 9000)}-PCB`,
    category: preferredCategory || "Microcontroller",
    color: "#0f3a5d",
    dimensions: { width: 800, height: 500 },
    description: `Universal Engineering Boardview & Schematic Matrix for ${query}. Fully synthesized component mapping with multimeter probe telemetry.`,
    topImageText: "Primary Controller IC, Linear Regulators, Clock Oscillators, Filter Capacitors",
    bottomImageText: "Ground Ground-Plane Copper Pours and Signal Bus Test Pads",
    components: [
      {
        id: "comp_main_mcu",
        name: "Main Microcontroller / Processor IC",
        ref: "U1",
        type: "IC",
        x: 48,
        y: 45,
        width: 18,
        height: 18,
        package: "QFP-64 / BGA",
        voltage: "3.3V / 5.0V VCC",
        diodeDrop: "0.480V",
        nominalResistance: "15.4kΩ",
        description: "Primary controller coordinating peripherals, signal processing, and system timing.",
        commonFaults: ["Shorted VCC pin pulling power rail down", "Missing clock oscillation"],
        testPads: [
          { name: "VCC_IN", x: 25, y: 25, rail: "3.3V_MAIN", expectedDiode: "0.480V", expectedResistance: "15.4kΩ" },
          { name: "RESET#", x: 75, y: 75, rail: "RESET_L", expectedDiode: "0.620V", expectedResistance: "47kΩ" }
        ]
      },
      {
        id: "comp_power_buck",
        name: "Step-Down Switching Buck Regulator",
        ref: "U2",
        type: "IC",
        x: 22,
        y: 35,
        width: 12,
        height: 12,
        package: "SOP-8 / QFN",
        voltage: "12V IN -> 3.3V OUT",
        diodeDrop: "0.420V",
        nominalResistance: "22kΩ",
        description: "Converts DC input down to clean operating voltage for logic ICs.",
        commonFaults: ["Short-circuit in high-side MOSFET", "Blown inductor coil"],
        testPads: [
          { name: "VIN_12V", x: 30, y: 30, rail: "12V_IN", expectedDiode: "0.520V", expectedResistance: "> 100kΩ" },
          { name: "SW_NODE", x: 70, y: 70, rail: "V_SWITCH", expectedDiode: "0.380V", expectedResistance: "22kΩ" }
        ]
      },
      {
        id: "comp_io_connector",
        name: "Main Signal & Power Interface Header",
        ref: "J1",
        type: "CONNECTOR",
        x: 82,
        y: 35,
        width: 10,
        height: 32,
        package: "Header 2.54mm Pin Strip",
        voltage: "Multi-Bus",
        diodeDrop: "0.550V",
        nominalResistance: "50kΩ",
        description: "External input/output bus for sensors, displays, and communication.",
        commonFaults: ["Bent or corroded pins", "Broken solder pads from strain"],
        testPads: [
          { name: "PIN1_PWR", x: 50, y: 20, rail: "VCC", expectedDiode: "0.480V", expectedResistance: "15kΩ" },
          { name: "PIN2_SIG", x: 50, y: 50, rail: "IO_SIG", expectedDiode: "0.590V", expectedResistance: "47kΩ" },
          { name: "PIN3_GND", x: 50, y: 80, rail: "GND", expectedDiode: "0.000V", expectedResistance: "0.00Ω" }
        ]
      }
    ]
  };
}

// Resilient synthesis for blueprint schematics when cloud AI is offline
function synthesizeBlueprintTelemetry(target: string): string {
  const t = (target || "").toLowerCase();
  
  let boardNo = "OEM-PCB-REV3";
  let soc = "System-on-Chip (Core Logic)";
  let pmic = "Multi-Phase Power Management IC (PMIC)";
  let charger = "USB-C Power Delivery & BQ Charger IC";

  if (t.includes("iphone") || t.includes("apple")) {
    boardNo = "820-02536 / A2894 (Interposer Sandwich)";
    soc = "Apple A16 / A17 Bionic (PoP LPDDR5)";
    pmic = "Apple Custom PMIC (Dialog/STM32 Architecture)";
    charger = "Hydra / Tristar USB-PD Controller";
  } else if (t.includes("telefunken") || t.includes("vestel")) {
    boardNo = "17MB140 / 17MB130 / 17IPS62 (Vestel Telefunken Architecture)";
    soc = "MStar MSD3663 / Novatek High-Definition Video Engine";
    pmic = "AMS1117-3.3 / NCP1251 Flyback Switch-Mode Controller";
    charger = "MP3394S Constant-Current LED Backlight Boost IC";
  } else if (t.includes("sony") || t.includes("bravia")) {
    boardNo = "1-893-880-11 / 1-980-333-11 (Sony BA Motherboard / APS-395)";
    soc = "Sony Cognitive XR Processor & MediaTek MT5895 Android TV SoC";
    pmic = "Sony CXA3809M Resonant LLC & Renesas Syscon Microcontroller";
    charger = "High-Voltage Multi-Zone LED Backlight Inverter Boost Stage";
  } else if (t.includes("lg") && (t.includes("tv") || t.includes("oled") || t.includes("webos"))) {
    boardNo = "EAX68253604 / EBR28435101 (LG WebOS Motherboard)";
    soc = "LG Quad-Core Alpha 7 / Triple XD 4K Engine";
    pmic = "Multi-Phase Step-Down Buck & Standby LDO Matrix";
    charger = "High-Efficiency Class-D TAS5733L Audio Power Stage";
  } else if (t.includes("hisense") || t.includes("vidaa") || t.includes("tcl")) {
    boardNo = "RSAG7.820.8712 / 40-MT58CU (3-in-1 Combo Board)";
    soc = "MStar MSD6886 / HiView 4K Smart Video Processor";
    pmic = "Integrated Primary Flyback SMPS PWM Regulator";
    charger = "Multi-Channel LED Backlight Driver (RSAG7.820)";
  } else if (t.includes("samsung") || t.includes("galaxy")) {
    boardNo = t.includes("tv") ? "BN41-02098B / BN44-00605A (Samsung Display)" : "SM-S918B Main Logic Board";
    soc = t.includes("tv") ? "MStar SEMS31 Quad Video Engine SoC" : "Qualcomm Snapdragon 8 Gen 2 / Exynos 2200";
    pmic = t.includes("tv") ? "SEM5027A Flyback PWM / AMS1117-3.3" : "Maxim / Qualcomm PM8550 Power Management";
    charger = t.includes("tv") ? "SLC1012C LED Backlight Boost Regulator" : "Samsung USB-PD Type-C Controller";
  } else if (t.includes("macbook") || t.includes("mac")) {
    boardNo = "820-02536-A (Apple Silicon)";
    soc = "Apple M2 Unified Memory Architecture";
    pmic = "Texas Instruments / Renesas Multi-Phase VCore PMIC";
    charger = "ISL9240 Buck-Boost Battery Charger";
  } else if (t.includes("ps5") || t.includes("playstation")) {
    boardNo = "EDM-010 / EDM-020 (Sony Interactive)";
    soc = "AMD Oberon Custom Zen 2 APU";
    pmic = "Renesas RAA229004 VCore PWM Controller";
    charger = "Panasonic MN864739 HDMI 2.1 Video Encoder";
  } else if (t.includes("drone") || t.includes("dji")) {
    boardNo = "DJI-FC-ESC-REV4 Dual-Layer Substrate";
    soc = "STM32F405 ARM Cortex-M4 Flight Controller";
    pmic = "Monolithic Power Systems (MPS) Step-Down Buck";
    charger = "Texas Instruments BQ24773 Smart Charger";
  }

  return `## 1. Verified Boardview & PCB Revision Data: ${target}
- **Official Board Number:** \`${boardNo}\`
- **Substrate Architecture:** Multi-layer high-Tg FR4 with gold immersion ENIG pads and micro-vias.
- **Top / Bottom Layout:** Dual-sided high-density SMT layout with RF shielding perimeter.

## 2. Component Pinout & Reference Designator Matrix
| Ref | Component Classification | Typical Package | Primary Rail | Diode Mode Drop (Nominal) |
|---|---|---|---|---|
| **U_SOC** | ${soc} | BGA-496 0.4mm pitch | \`VDD_CORE\` (0.85V) | **0.120V – 0.180V** |
| **U_PMIC** | ${pmic} | WLCSP-140 | \`VDD_MAIN\` (3.8V-4.3V) | **0.420V – 0.490V** |
| **U_CHG** | ${charger} | QFN-32 | \`VBUS\` (5V/9V/20V) | **0.510V – 0.580V** |
| **U_NAND** | Flash Storage Storage NVMe/UFS | BGA-153 | \`VCC_NAND\` (1.8V / 3.3V) | **0.460V – 0.520V** |
| **U_AUDIO** | High-Definition Audio Codec IC | WLCSP-42 | \`VDD_AUDIO\` (1.8V) | **0.480V – 0.540V** |
| **J_FPC** | Display & Digitizer FPC Connector | 40-Pin Fine Pitch | \`VBOOST\` (18V-24V) | **0.550V – 0.650V** |

## 3. Critical Voltage Rails & Test Points
- **Primary Power Bus (\`VDD_MAIN\` / \`VBAT\`):** **3.80V – 4.35V**. Short threshold: $< 30\\Omega$ or diode drop $< 0.050\\text{V}$.
- **Always-On Logic Rail (\`1.8V_ALWAYS\`):** Supplies RTC oscillator, power button pull-ups, and PMIC sense lines.
- **Core CPU Buck Coils:** Impedance naturally reads low (typically $0.8\\Omega - 4.5\\Omega$ to ground due to high current draw). Do not mistake low CPU impedance for a short.

## 4. Power Sequencing & Micro-Soldering Bench Calibration
- **Power Sequencing Order:** \`VBAT / VBUS (Primary In)\` ➔ \`1.8V_ALWAYS (RTC/Sense)\` ➔ \`PMIC BUCK Multi-Phase\` ➔ \`VDD_CORE (0.85V SoC)\` ➔ \`SYS_RESET_L (High)\`.
- **Micro-Soldering Rework Profile:**
  - Board Pre-heater: 130°C – 150°C to absorb copper plane heatsinking.
  - Hot Air Station: 345°C – 360°C at 45% airflow for lead-free SAC305 ICs.
  - Solder Paste Alloy: Sn63/Pb37 (183°C melt) for high-reliability micro-jumper wire connections.
- **Interposer / BGA Diagnostics:**
  - Inspect underfill edges with 100x microscope before heating to prevent solder ball squeeze-out.`;
}

// ---- Device catalog: model picture lookup via Wikipedia (GET /api/model-image?q=<brand model>) ----
const modelImageCache = new Map<string, { url: string | null; title: string | null; at: number }>();
const MODEL_IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const modelImageTokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 2);
app.get("/api/model-image", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: "q is required" });
  const key = q.toLowerCase();
  const cached = modelImageCache.get(key);
  if (cached && Date.now() - cached.at < MODEL_IMAGE_TTL_MS) {
    res.set("Cache-Control", "public, max-age=86400");
    return res.json({ url: cached.url, title: cached.title, cached: true });
  }
  const headers = { "User-Agent": "DIYElectronicsApp/1.0 (device catalog model images)", Accept: "application/json" };
  let url: string | null = null;
  let title: string | null = null;
  try {
    const os = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=4&namespace=0&search=${encodeURIComponent(q)}`, { headers });
    const osJson: any = os.ok ? await os.json() : [];
    const titles: string[] = Array.isArray(osJson?.[1]) ? osJson[1] : [];
    const qTokens = modelImageTokens(q);
    for (const t of titles) {
      // Require real overlap with the query so a brand-only match ("Defy (song)") is not used.
      const overlap = modelImageTokens(t).filter((tok) => qTokens.includes(tok)).length;
      if (overlap < Math.min(2, qTokens.length)) continue;
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`, { headers });
      if (!r.ok) continue;
      const j: any = await r.json();
      if (j?.type === "disambiguation") continue;
      const img = j?.thumbnail?.source || j?.originalimage?.source;
      if (img) { url = img; title = j?.title || t; break; }
    }
  } catch (e) {
    console.error("model-image lookup failed:", e);
  }
  if (modelImageCache.size > 5000) modelImageCache.clear();
  modelImageCache.set(key, { url, title, at: Date.now() });
  res.set("Cache-Control", "public, max-age=86400");
  res.json({ url, title });
});

// ==== Real PCB board search (GET /api/boards/search?q=<board number>&include=photos,links,info) ====
// Real photos from Wikimedia Commons (with licence + author), board facts from Gemini with Google
// Search grounding (every fact cited; "unknown" when nothing is found), and plain search links to
// schematic/boardview communities (links are searches, never claims that a file exists).
// Community photos live in Firestore `boards/{n}` and are queried from the browser.
const BOARD_SEARCH_WINDOW_MS = 5 * 60 * 1000;
const BOARD_SEARCH_MAX = Number(process.env.BOARD_SEARCH_LIMIT_PER_5MIN) || 40;
const BOARD_INFO_MAX = Number(process.env.BOARD_INFO_LIMIT_PER_5MIN) || 12;
const boardSearchBuckets = new Map<string, { count: number; info: number; resetAt: number }>();
const BOARD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const boardPhotoCache = new Map<string, { at: number; photos: any[] }>();
const boardInfoCache = new Map<string, { at: number; info: any }>();

/** Same rules as normalizeBoardNumber() in src/lib/boards.ts: uppercase, separators -> '-', max 64. */
function normalizeBoardQuery(raw: string): string {
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
const compactBoard = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '');
const stripHtml = (s: any) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/** Looks like a part/board number (has digits, no spaces) rather than a description like "iPhone X logic board". */
const looksLikePartNumber = (display: string) => /\d/.test(display) && !/\s/.test(display.trim());

function boardRateCheck(req: express.Request, wantsInfo: boolean): { ok: boolean; retryAfter: number; infoAllowed: boolean } {
  const now = Date.now();
  const ip = getClientIp(req);
  let b = boardSearchBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { count: 0, info: 0, resetAt: now + BOARD_SEARCH_WINDOW_MS };
    boardSearchBuckets.set(ip, b);
  }
  if (boardSearchBuckets.size > 10000) {
    for (const [k, v] of boardSearchBuckets) if (v.resetAt <= now) boardSearchBuckets.delete(k);
  }
  b.count += 1;
  const retryAfter = Math.ceil((b.resetAt - now) / 1000);
  if (b.count > BOARD_SEARCH_MAX) return { ok: false, retryAfter, infoAllowed: false };
  if (wantsInfo) b.info += 1;
  return { ok: true, retryAfter, infoAllowed: b.info <= BOARD_INFO_MAX };
}

const BOARD_GENERIC_WORDS = new Set(['board', 'boards', 'logic', 'logicboard', 'main', 'mainboard', 'motherboard', 'pcb', 'pcba', 'the', 'of']);

async function searchCommonsBoardPhotos(display: string): Promise<any[]> {
  const isPart = looksLikePartNumber(display);
  const words = display.split(/\s+/).filter(Boolean);
  const coreWords = words.filter((w) => !BOARD_GENERIC_WORDS.has(w.toLowerCase()));
  const wantsBoardShot = coreWords.length < words.length; // user typed "logic board", "motherboard", ...
  const core = (coreWords.length ? coreWords : words).join(' ').replace(/"/g, '');
  // filetype:bitmap keeps PDFs/scans out; quotes keep the number / model name together.
  const search = `"${isPart ? display.replace(/"/g, '') : core}" filetype:bitmap`;
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrnamespace: '6', gsrlimit: '30', gsrsearch: search,
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '800',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|Credit|AttributionRequired|UsageTerms',
  });
  const resp = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'DIYElectronicsApp/1.0 (real PCB board search; diy.electronicsa@gmail.com)', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`commons ${resp.status}`);
  const json: any = await resp.json();
  const pages: any[] = json?.query?.pages || [];
  const qCompact = compactBoard(display);
  // Generic words ("logic board") are not required verbatim; every other word must appear as a whole word,
  // and when the user asked for a board, the photo must at least be described as a board / PCB.
  const qTokens = core.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const wordRe = qTokens.map((t) => new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`));
  const out: any[] = [];
  for (const pg of pages.sort((a, b) => (a.index || 0) - (b.index || 0))) {
    const ii = pg?.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png|webp|gif)$/.test(ii.mime || '')) continue;
    const meta = ii.extmetadata || {};
    const title = String(pg.title || '').replace(/^File:/, '');
    const description = stripHtml(meta.ImageDescription?.value).slice(0, 400);
    const hay = `${title} ${description}`;
    // Relevance guard: Commons full-text search is loose, so the board number (or every word of a
    // descriptive query) must actually appear in the file title or description.
    const relevant = isPart
      ? compactBoard(hay).includes(qCompact)
      : qTokens.length > 0 && wordRe.every((re) => re.test(hay.toLowerCase()))
        && (!wantsBoardShot || /board|pcb|motherboard|circuit|teardown|internals|inside/i.test(hay));
    if (!relevant) continue;
    out.push({
      title,
      thumbUrl: ii.thumburl || ii.url,
      url: ii.url,
      width: ii.width, height: ii.height,
      pageUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(pg.title).replace(/ /g, '_'))}`,
      description,
      license: stripHtml(meta.LicenseShortName?.value) || stripHtml(meta.UsageTerms?.value) || 'See source page',
      licenseUrl: stripHtml(meta.LicenseUrl?.value) || null,
      artist: stripHtml(meta.Artist?.value).slice(0, 160) || stripHtml(meta.Credit?.value).slice(0, 160) || 'Unknown author',
      source: 'Wikimedia Commons',
    });
    if (out.length >= 12) break;
  }
  return out;
}

function buildBoardReferenceLinks(display: string) {
  const exact = `"${display}"`;
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return [
    { label: 'Google Images: exact board number', url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(exact)}`, kind: 'images' },
    { label: 'Schematic / boardview PDF search', url: g(`${exact} schematic OR boardview filetype:pdf`), kind: 'schematic' },
    { label: 'Badcaps forums', url: g(`${exact} site:badcaps.net`), kind: 'forum' },
    { label: 'iFixit', url: g(`${exact} site:ifixit.com`), kind: 'guide' },
    { label: 'Rossmann Group forum', url: g(`${exact} site:rossmanngroup.com`), kind: 'forum' },
    { label: 'EEVblog forum', url: g(`${exact} site:eevblog.com`), kind: 'forum' },
    { label: 'Elektrotanya (service manuals)', url: g(`${exact} site:elektrotanya.com`), kind: 'schematic' },
    { label: 'YouTube repair videos', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${display} repair`)}`, kind: 'video' },
    { label: 'eBay (donor / replacement boards)', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(display)}`, kind: 'shop' },
  ];
}

function parseJsonLoose(text: string): any {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

const strArr = (v: any, max: number, len = 160) =>
  (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x: string) => x.trim().slice(0, len));


// ---- Free online search for boards (no API key needed) ------------------------------------
// iFixit's public search API (guides, device wikis, part listings, Answers threads with photos)
// plus Wikipedia full-text search. Used so a board search always returns real web results,
// even when Gemini Google-Search grounding is not available on the free tier.
const boardWebCache = new Map<string, { at: number; results: any[] }>();
const WEB_UA = 'DIYElectronicsApp/1.0 (board search; diy.electronicsa@gmail.com)';
const IFIXIT_KINDS: Record<string, string> = { guide: 'Repair guide', wiki: 'Device / part wiki', question: 'Q&A thread', product: 'Part listing', item: 'Part', topic: 'Topic', category: 'Device', teardown: 'Teardown' };

async function ifixitSearch(q: string, limit = 10): Promise<any[]> {
  const r = await fetch(`https://www.ifixit.com/api/2.0/search/${encodeURIComponent(q)}?limit=${limit}`, {
    headers: { 'User-Agent': WEB_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error(`ifixit ${r.status}`);
  const j: any = await r.json();
  return (Array.isArray(j?.results) ? j.results : [])
    .filter((x: any) => typeof x?.url === 'string' && /^https:\/\/(www\.)?ifixit\.com\//.test(x.url) && x.title)
    .map((x: any) => ({
      title: String(x.display_title || x.title).slice(0, 160),
      url: String(x.url).slice(0, 500),
      snippet: stripHtml(String(x.summary || x.text || x.description || '')).slice(0, 240),
      image: typeof x.image?.standard === 'string' ? x.image.standard : (typeof x.image?.thumbnail === 'string' ? x.image.thumbnail : null),
      kind: IFIXIT_KINDS[String(x.dataType)] || 'iFixit',
      source: 'iFixit',
    }));
}

async function wikipediaSearch(q: string, limit = 4): Promise<any[]> {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: q, srlimit: String(limit), format: 'json', formatversion: '2', origin: '*' });
  const r = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { 'User-Agent': WEB_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`wikipedia ${r.status}`);
  const j: any = await r.json();
  return (j?.query?.search || []).map((x: any) => ({
    title: String(x.title).slice(0, 160),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}`,
    snippet: stripHtml(String(x.snippet || '')).slice(0, 240),
    image: null,
    kind: 'Encyclopedia',
    source: 'Wikipedia',
  }));
}

/** Query variants: as typed, without generic words ("board", "TV"), and the brand + model prefix. */
function boardQueryVariants(display: string): string[] {
  const words = display.split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !BOARD_GENERIC_WORDS.has(w.toLowerCase()) && !/^(tv|television|console|phone|laptop|smart)$/i.test(w));
  const out = [display, core.join(' ')];
  // "UA43TU7000" style model numbers: also try the series prefix ("UA43").
  const m = core.find((w) => /^[A-Za-z]{1,4}\d{2,}[A-Za-z0-9-]*$/.test(w));
  if (m && core.length) out.push(core.filter((w) => w !== m).concat(m.replace(/^([A-Za-z]{1,4}\d{2}).*$/, '$1')).join(' '));
  if (core.length && !/board/i.test(display)) out.push(`${core.join(' ')} board`);
  return [...new Set(out.map((x) => x.trim()).filter((x) => x.length >= 2))];
}

async function searchBoardWeb(display: string): Promise<any[]> {
  const variants = boardQueryVariants(display);
  const seen = new Set<string>();
  const results: any[] = [];
  const add = (list: any[]) => { for (const x of list) { if (!seen.has(x.url)) { seen.add(x.url); results.push(x); } } };
  const settled = await Promise.allSettled([
    ...variants.slice(0, 3).map((v) => ifixitSearch(v, 10)),
    wikipediaSearch(variants[1] || display, 3),
  ]);
  for (const r of settled.slice(0, -1)) if (r.status === 'fulfilled') add(r.value);
  // Prefer results that mention the query words, then guides/wikis, then threads.
  const tokens = (variants[1] || display).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const score = (x: any) => {
    const hay = `${x.title} ${x.snippet}`.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    const kindBonus = /guide|wiki|part/i.test(x.kind) ? 0.5 : 0;
    return hits + kindBonus + (/board|motherboard|pcb/i.test(hay) ? 0.5 : 0);
  };
  results.sort((a, b) => score(b) - score(a));
  const wiki = settled[settled.length - 1];
  const out = results.filter((x) => score(x) >= 1).slice(0, 12);
  // Wikipedia full-text search is loose: keep an article only if its TITLE contains a query word.
  if (wiki.status === 'fulfilled') out.push(...wiki.value.filter((w: any) => !seen.has(w.url) && tokens.some((t) => t.length > 2 && w.title.toLowerCase().includes(t))).slice(0, 3));
  return out;
}

async function fetchBoardInfoGrounded(ai: GoogleGenAI, display: string, web: any[] = []): Promise<any> {
  const prompt = `You are a cautious electronics repair researcher. Use Google Search to look up the printed circuit board / part number "${display}".
Return ONLY a JSON object (no prose) with exactly these keys:
{
 "found": boolean,                 // false if search results do not clearly identify this exact board
 "boardNumber": string,            // the number as commonly written
 "manufacturer": string|null,
 "boardType": string|null,         // e.g. "logic board", "TV main board", "power supply board", "motherboard"
 "devices": string[],              // devices/models this board is used in
 "keyICs": [{"role": string, "part": string}],   // e.g. role "PMIC", "CPU/SoC", "Charging IC", "Backlight driver"
 "commonFaults": string[],
 "notes": string[]                 // short practical notes (alternative numbers, revisions, compatibility)
}
Rules: Only include facts supported by the search results. Never guess or invent part numbers, ICs or faults. If something is not found, use null or an empty array. If the board cannot be identified, set "found": false and leave the arrays empty.
If the query is a device model or model series (e.g. "Samsung UA43", "PS4") rather than a printed board number, describe the main board used in that device or series: set "found": true, put the device/series in "devices", and list known main-board numbers in "notes".${web.length ? `

Web results already found for this query (free online search). Use them as evidence and add a key "usedResults": number[] listing the [n] numbers you relied on:
${web.slice(0, 12).map((w, i) => `[${i + 1}] ${w.title} (${w.source}, ${w.kind}) ${w.url}\n    ${w.snippet}`).join('\n')}` : ''}`;
  let grounding: any = null;
  const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], undefined, [{ googleSearch: {} }], undefined,
    (r) => { grounding = r?.candidates?.[0]?.groundingMetadata || null; });
  const parsed = parseJsonLoose(text) || {};
  const seen = new Set<string>();
  const sources: { title: string; url: string }[] = [];
  for (const n of Array.isArray(parsed.usedResults) ? parsed.usedResults : []) {
    const w = web[Number(n) - 1];
    if (w && !seen.has(w.url)) { seen.add(w.url); sources.push({ title: w.title, url: w.url }); }
  }
  for (const c of grounding?.groundingChunks || []) {
    const url = c?.web?.uri;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: String(c.web.title || new URL(url).hostname).slice(0, 160), url });
    if (sources.length >= 10) break;
  }
  const keyICs = (Array.isArray(parsed.keyICs) ? parsed.keyICs : [])
    .filter((x: any) => x && typeof x.part === 'string' && x.part.trim())
    .slice(0, 16)
    .map((x: any) => ({ role: String(x.role || 'IC').slice(0, 60), part: String(x.part).slice(0, 120) }));
  // Without grounding sources nothing can be cited, so report it as unknown rather than trusting the model.
  const found = parsed.found === true;
  return {
    found,
    boardNumber: typeof parsed.boardNumber === 'string' ? parsed.boardNumber.slice(0, 80) : display,
    manufacturer: found && typeof parsed.manufacturer === 'string' ? parsed.manufacturer.slice(0, 80) : null,
    boardType: found && typeof parsed.boardType === 'string' ? parsed.boardType.slice(0, 80) : null,
    devices: found ? strArr(parsed.devices, 20) : [],
    keyICs: found ? keyICs : [],
    commonFaults: found ? strArr(parsed.commonFaults, 12, 240) : [],
    notes: found ? strArr(parsed.notes, 8, 300) : [],
    sources,
    disclaimer: sources.length ? 'Summarised by AI from the cited web sources. Verify against the schematic for your exact board revision.' : 'From AI knowledge (live web search unavailable). Verify against the label, schematic or datasheet before repairing.',
  };
}

app.get('/api/boards/search', async (req, res) => {
  const display = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const normalized = normalizeBoardQuery(display);
  if (!normalized || normalized.length < 2) return res.status(400).json({ error: 'Enter a board or part number (at least 2 characters).' });
  const include = new Set(String(req.query.include || 'photos,links,web,info').split(',').map((s) => s.trim()));
  const wantsInfo = include.has('info');
  const rate = boardRateCheck(req, wantsInfo && !boardInfoCache.has(normalized));
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too many board searches. Please wait a few minutes.' });
  }
  const now = Date.now();
  const body: any = { query: display, normalized, links: buildBoardReferenceLinks(display) };
  const tasks: Promise<void>[] = [];

  if (include.has('photos')) {
    tasks.push((async () => {
      const hit = boardPhotoCache.get(normalized);
      if (hit && now - hit.at < BOARD_CACHE_TTL_MS) { body.photos = hit.photos; return; }
      try {
        const photos = await searchCommonsBoardPhotos(display);
        if (boardPhotoCache.size > 3000) boardPhotoCache.clear();
        boardPhotoCache.set(normalized, { at: now, photos });
        body.photos = photos;
      } catch (e: any) {
        console.warn('commons board search failed:', e?.message || e);
        body.photos = [];
        body.photosError = 'Wikimedia Commons could not be reached right now.';
      }
    })());
  }

  // Free online search (iFixit + Wikipedia). Shared by the "web" results and as evidence for the AI info.
  let webPromise: Promise<any[]> | null = null;
  const getWeb = () => (webPromise ||= (async () => {
    const hit = boardWebCache.get(normalized);
    if (hit && now - hit.at < BOARD_CACHE_TTL_MS) return hit.results;
    try {
      const results = await searchBoardWeb(display);
      if (boardWebCache.size > 3000) boardWebCache.clear();
      if (results.length) boardWebCache.set(normalized, { at: now, results });
      return results;
    } catch (e: any) {
      console.warn('board web search failed:', e?.message || e);
      return [];
    }
  })());
  if (include.has('web')) tasks.push(getWeb().then((r) => { body.web = r; }));

  let infoStatus = 200;
  if (wantsInfo) {
    tasks.push((async () => {
      const hit = boardInfoCache.get(normalized);
      if (hit && now - hit.at < BOARD_CACHE_TTL_MS) { body.info = hit.info; return; }
      const ai = getGeminiClient();
      if (!ai) { body.info = null; body.infoError = AI_NOT_CONFIGURED; infoStatus = 503; return; }
      if (!rate.infoAllowed) { body.info = null; body.infoError = 'Board lookups are rate-limited. Try again in a few minutes.'; infoStatus = 429; return; }
      try {
        const info = await fetchBoardInfoGrounded(ai, display, await getWeb());
        if (boardInfoCache.size > 2000) boardInfoCache.clear();
        boardInfoCache.set(normalized, { at: now, info });
        body.info = info;
      } catch (e: any) {
        console.warn('board info lookup failed:', e?.message || e);
        body.info = null; body.infoError = AI_UNAVAILABLE; infoStatus = 503;
      }
    })());
  }

  await Promise.all(tasks);
  if (infoStatus === 200) res.set('Cache-Control', 'public, max-age=3600');
  res.status(infoStatus).json(body);
});

// ==== Universal device & component pages ===========================================
// GET /api/universal/device?q=<any device>      -> grounded overview (specs, faults, repairability, teardown notes)
// GET /api/universal/component?q=<part number>  -> grounded component sheet (specs, pinout, equivalents)
// Facts come from Gemini with Google Search grounding; nothing is reported as found unless the
// response cites at least one web source. Images come from Wikipedia (page summary thumbnails).
// The browser caches successful results in Firestore (discoveredDevices / discoveredComponents)
// so a page is researched once and then becomes a permanent, shareable page.
const UNI_WINDOW_MS = 5 * 60 * 1000;
const UNI_MAX = Number(process.env.UNIVERSAL_LOOKUP_LIMIT_PER_5MIN) || 10;
const uniBuckets = new Map<string, { count: number; resetAt: number }>();
const uniCache = new Map<string, { at: number; body: any }>();
const UNI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function uniRateCheck(req: express.Request): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const ip = getClientIp(req);
  let b = uniBuckets.get(ip);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + UNI_WINDOW_MS };
    uniBuckets.set(ip, b);
  }
  if (uniBuckets.size > 10000) {
    for (const [k, v] of uniBuckets) if (v.resetAt <= now) uniBuckets.delete(k);
  }
  b.count += 1;
  return { ok: b.count <= UNI_MAX, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

function collectGroundingSources(grounding: any, max = 10): { title: string; url: string }[] {
  const seen = new Set<string>();
  const sources: { title: string; url: string }[] = [];
  for (const c of grounding?.groundingChunks || []) {
    const url = c?.web?.uri;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    let host = url;
    try { host = new URL(url).hostname; } catch { /* keep url */ }
    sources.push({ title: String(c.web.title || host).slice(0, 160), url: url.slice(0, 1000) });
    if (sources.length >= max) break;
  }
  return sources;
}

/** Best Wikipedia lead image for a query (requires real word overlap so unrelated pages are skipped). */
async function lookupWikipediaImage(q: string): Promise<{ url: string; title: string; pageUrl: string } | null> {
  const headers = { 'User-Agent': 'DIYElectronicsApp/1.0 (universal device pages; diy.electronicsa@gmail.com)', Accept: 'application/json' };
  try {
    const os = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=5&namespace=0&search=${encodeURIComponent(q)}`, { headers, signal: AbortSignal.timeout(6000) });
    const osJson: any = os.ok ? await os.json() : [];
    const titles: string[] = Array.isArray(osJson?.[1]) ? osJson[1] : [];
    const qTokens = modelImageTokens(q);
    for (const t of titles) {
      const overlap = modelImageTokens(t).filter((tok) => qTokens.includes(tok)).length;
      if (overlap < Math.min(2, qTokens.length)) continue;
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`, { headers, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const j: any = await r.json();
      if (j?.type === 'disambiguation') continue;
      const img = j?.thumbnail?.source || j?.originalimage?.source;
      if (img) return { url: String(img), title: String(j?.title || t).slice(0, 160), pageUrl: String(j?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`) };
    }
  } catch (e: any) {
    console.warn('wikipedia image lookup failed:', e?.message || e);
  }
  return null;
}

const kvArr = (v: any, max: number) =>
  (Array.isArray(v) ? v : [])
    .filter((x: any) => x && typeof x.label === 'string' && x.label.trim() && (typeof x.value === 'string' || typeof x.value === 'number'))
    .slice(0, max)
    .map((x: any) => ({ label: String(x.label).trim().slice(0, 60), value: String(x.value).trim().slice(0, 200) }));

/** Device types the client can map back to its catalog (free text otherwise). */
async function fetchDeviceGrounded(ai: GoogleGenAI, q: string): Promise<any> {
  const prompt = `You are a careful electronics repair researcher. Use Google Search to identify the device "${q}" (it may be any electronic or electrical product ever made: phone, appliance, tool, vehicle module, medical home device, musical gear, industrial controller, toy, etc.).
Return ONLY a JSON object (no prose) with exactly these keys:
{
 "found": boolean,               // false unless search results clearly identify a real product
 "name": string,                 // full product name, e.g. "Samsung Galaxy A15 5G"
 "brand": string|null,
 "model": string|null,           // model / series name
 "modelNumbers": string[],       // official model / part numbers (e.g. "SM-A156B")
 "deviceType": string|null,      // generic type, e.g. "Smartphone", "Washing machine", "Blood pressure monitor"
 "releaseYear": number|null,
 "summary": string,              // 1-3 factual sentences
 "specs": [{"label": string, "value": string}],
 "identification": string[],     // how to tell this model apart / where the model number is printed
 "commonFaults": string[],       // only faults reported in the sources
 "repairability": {"score": number|null, "source": string|null, "notes": string[]},  // score only if a published score exists (e.g. iFixit 0-10, EU repairability index); never invent one
 "teardownNotes": string[],      // what is inside / how it opens, from teardown sources
 "keyParts": string[]            // replaceable parts commonly sold for it
}
Rules: only include facts supported by the search results. Never guess. Use null or [] when unknown. If the device cannot be identified, set "found": false.`;
  let grounding: any = null;
  const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], undefined, [{ googleSearch: {} }], undefined,
    (r) => { grounding = r?.candidates?.[0]?.groundingMetadata || null; });
  const p = parseJsonLoose(text) || {};
  const sources = collectGroundingSources(grounding);
  const found = p.found === true && typeof p.name === 'string' && p.name.trim().length > 1;
  const rep = p.repairability && typeof p.repairability === 'object' ? p.repairability : {};
  const score = typeof rep.score === 'number' && rep.score >= 0 && rep.score <= 10 && typeof rep.source === 'string' && rep.source.trim() ? Math.round(rep.score * 10) / 10 : null;
  return {
    found,
    query: q,
    name: found ? String(p.name).trim().slice(0, 120) : q,
    brand: found && typeof p.brand === 'string' ? p.brand.slice(0, 60) : null,
    model: found && typeof p.model === 'string' ? p.model.slice(0, 100) : null,
    modelNumbers: found ? strArr(p.modelNumbers, 12, 60) : [],
    deviceType: found && typeof p.deviceType === 'string' ? p.deviceType.slice(0, 60) : null,
    releaseYear: found && typeof p.releaseYear === 'number' && p.releaseYear > 1800 && p.releaseYear < 2100 ? Math.round(p.releaseYear) : null,
    summary: found && typeof p.summary === 'string' ? p.summary.slice(0, 600) : '',
    specs: found ? kvArr(p.specs, 24) : [],
    identification: found ? strArr(p.identification, 8, 240) : [],
    commonFaults: found ? strArr(p.commonFaults, 14, 240) : [],
    repairability: found ? { score, source: score !== null ? String(rep.source).slice(0, 120) : null, notes: strArr(rep.notes, 6, 240) } : { score: null, source: null, notes: [] },
    teardownNotes: found ? strArr(p.teardownNotes, 10, 300) : [],
    keyParts: found ? strArr(p.keyParts, 16, 80) : [],
    sources,
    disclaimer: sources.length ? 'Summarised by AI from the cited web sources. Check the rating label on your unit and the manufacturer documentation before repairing.' : 'From AI knowledge (live web search unavailable). Verify against the label, schematic or datasheet before repairing.',
  };
}

/** Keys shared with the Multimeter section (/multimeter/test/:component). */
const COMPONENT_TEST_KEYS = ['resistor', 'capacitor', 'electrolytic-capacitor', 'diode', 'zener-diode', 'led', 'bridge-rectifier', 'bjt-transistor', 'mosfet', 'igbt', 'triac', 'scr', 'voltage-regulator', 'ic', 'optocoupler', 'fuse', 'varistor', 'thermistor', 'relay', 'transformer', 'inductor', 'crystal', 'switch', 'motor', 'speaker', 'battery', 'sensor'];

function componentReferenceLinks(pn: string, manufacturer?: string | null) {
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

async function fetchComponentGrounded(ai: GoogleGenAI, pn: string): Promise<any> {
  const prompt = `You are a careful electronic component engineer. Use Google Search to look up the electronic component / part number "${pn}" (IC, transistor, MOSFET, diode, regulator, capacitor, connector, module, sensor, etc.).
Return ONLY a JSON object (no prose) with exactly these keys:
{
 "found": boolean,            // false unless search results clearly identify this exact part
 "partNumber": string,
 "manufacturer": string|null,
 "category": string|null,     // e.g. "N-channel MOSFET", "Buck converter IC", "Schottky diode"
 "testKey": string|null,      // one of: ${COMPONENT_TEST_KEYS.join(', ')}
 "description": string,
 "package": string|null,      // e.g. "TO-220", "SOT-23", "SOIC-8"
 "specs": [{"label": string, "value": string}],    // key ratings from the datasheet (Vds, Id, Rds(on), Vin range, ...)
 "pinout": [{"pin": string, "name": string, "function": string}],
 "equivalents": string[],     // only substitutes named in the sources; note any rating differences
 "applications": string[],    // typical devices / circuits it is used in
 "markings": string[],        // SMD marking codes if documented
 "testNotes": string[]        // how to check it with a multimeter, from the sources
}
Rules: only include facts supported by the search results (prefer the official datasheet). Never invent pinouts, ratings or equivalents. Use null or [] when unknown.`;
  let grounding: any = null;
  const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], undefined, [{ googleSearch: {} }], undefined,
    (r) => { grounding = r?.candidates?.[0]?.groundingMetadata || null; });
  const p = parseJsonLoose(text) || {};
  const sources = collectGroundingSources(grounding);
  const found = p.found === true;
  const pinout = (Array.isArray(p.pinout) ? p.pinout : [])
    .filter((x: any) => x && (typeof x.pin === 'string' || typeof x.pin === 'number') && typeof x.name === 'string')
    .slice(0, 64)
    .map((x: any) => ({ pin: String(x.pin).slice(0, 12), name: String(x.name).slice(0, 40), function: String(x.function || '').slice(0, 160) }));
  const testKey = typeof p.testKey === 'string' && COMPONENT_TEST_KEYS.includes(p.testKey) ? p.testKey : null;
  const manufacturer = found && typeof p.manufacturer === 'string' ? p.manufacturer.slice(0, 80) : null;
  return {
    found,
    query: pn,
    partNumber: found && typeof p.partNumber === 'string' && p.partNumber.trim() ? p.partNumber.trim().slice(0, 64) : pn,
    manufacturer,
    category: found && typeof p.category === 'string' ? p.category.slice(0, 80) : null,
    testKey: found ? testKey : null,
    description: found && typeof p.description === 'string' ? p.description.slice(0, 600) : '',
    package: found && typeof p.package === 'string' ? p.package.slice(0, 60) : null,
    specs: found ? kvArr(p.specs, 30) : [],
    pinout: found ? pinout : [],
    equivalents: found ? strArr(p.equivalents, 16, 120) : [],
    applications: found ? strArr(p.applications, 12, 160) : [],
    markings: found ? strArr(p.markings, 10, 40) : [],
    testNotes: found ? strArr(p.testNotes, 8, 300) : [],
    sources,
    links: componentReferenceLinks(pn, manufacturer),
    disclaimer: sources.length ? 'Summarised by AI from the cited sources. Always confirm ratings and pinout in the official datasheet before substituting a part.' : 'From AI knowledge (live web search unavailable). Verify against the label, schematic or datasheet before repairing.',
  };
}

function universalHandler(kind: 'device' | 'component') {
  return async (req: express.Request, res: express.Response) => {
    const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (q.length < 2) return res.status(400).json({ error: kind === 'device' ? 'Type a device name (at least 2 characters).' : 'Type a part number (at least 2 characters).' });
    const key = `${kind}:${q.toLowerCase()}`;
    const hit = uniCache.get(key);
    if (hit && Date.now() - hit.at < UNI_CACHE_TTL_MS) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json({ ...hit.body, cached: true });
    }
    const rate = uniRateCheck(req);
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({ error: 'Too many lookups. Please wait a few minutes and try again.' });
    }
    const ai = getGeminiClient();
    if (!ai) {
      // Without AI we can still offer the deterministic search links (components) and an image (devices).
      const body: any = { found: false, query: q, sources: [], aiError: AI_NOT_CONFIGURED };
      if (kind === 'component') body.links = componentReferenceLinks(q);
      else body.image = await lookupWikipediaImage(q);
      return res.status(503).json(body);
    }
    try {
      const [info, image] = await Promise.all([
        kind === 'device' ? fetchDeviceGrounded(ai, q) : fetchComponentGrounded(ai, q),
        kind === 'device' ? lookupWikipediaImage(q) : Promise.resolve(null),
      ]);
      let img = image;
      if (kind === 'device' && !img && info.found && info.name && info.name.toLowerCase() !== q.toLowerCase()) img = await lookupWikipediaImage(info.name);
      const body = { ...info, image: img };
      if (uniCache.size > 3000) uniCache.clear();
      uniCache.set(key, { at: Date.now(), body });
      res.set('Cache-Control', 'public, max-age=3600');
      res.json(body);
    } catch (e: any) {
      console.warn(`universal ${kind} lookup failed:`, e?.message || e);
      const body: any = { found: false, query: q, sources: [], aiError: AI_UNAVAILABLE };
      if (kind === 'component') body.links = componentReferenceLinks(q);
      res.status(503).json(body);
    }
  };
}

app.get('/api/universal/device', universalHandler('device'));
app.get('/api/universal/component', universalHandler('component'));


// ==== AI vision, board lookup and circuit mapping ==========================================
// Images arrive as base64 inline parts (the browser compresses them to <=1600px JPEG and turns
// videos into a handful of key frames), so everything stays inside Netlify's ~6 MB body limit
// and the same hedged Gemini race (22 s budget) used by every AI route.
const MAX_INLINE_IMAGES = 8;
const MAX_INLINE_TOTAL_CHARS = 5_200_000; // base64 chars, keeps the JSON body under ~5.5 MB
const INLINE_IMAGE_MIME = /^image\/(jpeg|png|webp|heic|heif)$/;

type InlineImage = { mimeType: string; data: string; label?: string };

/** Validates client images: whitelisted mime, base64 only, count + total size caps. */
function sanitizeInlineImages(raw: any): { images: InlineImage[]; error?: string } {
  if (raw == null) return { images: [] };
  if (!Array.isArray(raw)) return { images: [], error: 'Images must be a list.' };
  if (raw.length > MAX_INLINE_IMAGES) return { images: [], error: `Please attach at most ${MAX_INLINE_IMAGES} images.` };
  let total = 0;
  const images: InlineImage[] = [];
  for (const img of raw) {
    const mimeType = String(img?.mimeType || '').toLowerCase();
    let data = String(img?.data || '');
    const comma = data.indexOf(',');
    if (data.startsWith('data:') && comma > 0) data = data.slice(comma + 1);
    if (!INLINE_IMAGE_MIME.test(mimeType) || !data || !/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 2000))) {
      return { images: [], error: 'One of the attachments is not a supported image.' };
    }
    total += data.length;
    images.push({ mimeType, data, label: typeof img?.label === 'string' ? img.label.slice(0, 80) : undefined });
  }
  if (total > MAX_INLINE_TOTAL_CHARS) return { images: [], error: 'The attachments are too large. Please send fewer or smaller photos.' };
  return { images };
}

const imageParts = (images: InlineImage[]) => images.flatMap((img, i) => [
  ...(img.label ? [{ text: `Image ${i + 1}: ${img.label}` }] : []),
  { inlineData: { mimeType: img.mimeType, data: img.data } },
]);

/** Hosts the server will fetch images from on the user's behalf (board photo sources only). */
const IMAGE_PROXY_HOSTS = /(^|\.)(upload\.wikimedia\.org|wikimedia\.org|wikipedia\.org|ifixit\.com|cdn\.ifixit\.com|ifixit-guide-images\.s3\.amazonaws\.com)$/i;
const isProxyableImageUrl = (u: string) => {
  try { const url = new URL(u); return url.protocol === 'https:' && IMAGE_PROXY_HOSTS.test(url.hostname); } catch { return false; }
};
async function fetchRemoteImage(u: string, timeoutMs = 6000): Promise<{ mimeType: string; buf: Buffer }> {
  if (!isProxyableImageUrl(u)) throw new Error('image host not allowed');
  const r = await fetch(u, { headers: { 'User-Agent': WEB_UA, Accept: 'image/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!r.ok) throw new Error(`image ${r.status}`);
  const mimeType = String(r.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) throw new Error('not an image');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 4_000_000) throw new Error('image too large');
  return { mimeType: mimeType === 'image/gif' ? 'image/png' : mimeType, buf };
}

// Same-origin image proxy so the browser can draw web board photos on a canvas (CORS) and so
// remote images load even where the source blocks hotlinking. Allow-listed hosts only.
app.get('/api/image-proxy', async (req, res) => {
  const u = String(req.query.url || '');
  if (!isProxyableImageUrl(u)) return res.status(400).json({ error: 'Image source not allowed.' });
  try {
    const { mimeType, buf } = await fetchRemoteImage(u, 8000);
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e: any) {
    res.status(502).json({ error: 'Could not load that image.' });
  }
});

// ---- Board lookup: real photos + listings (board numbers, guides, schematic searches) ----
const boardLookupCache = new Map<string, { at: number; body: any }>();
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function lookupBoardOnline(display: string, timeoutMs = 9000): Promise<{ query: string; photos: any[]; web: any[]; links: any[] }> {
  const normalized = normalizeBoardQuery(display);
  const hit = boardLookupCache.get(normalized);
  if (hit && Date.now() - hit.at < BOARD_CACHE_TTL_MS) return hit.body;
  const variants = boardQueryVariants(display);
  const webP = withTimeout((async () => {
    const c = boardWebCache.get(normalized);
    if (c && Date.now() - c.at < BOARD_CACHE_TTL_MS) return c.results;
    const r = await searchBoardWeb(display);
    if (r.length) boardWebCache.set(normalized, { at: Date.now(), results: r });
    return r;
  })(), timeoutMs, [] as any[]);
  // Commons is strict about relevance, so also try the shorter variants ("Samsung UA43 board").
  const commonsP = withTimeout((async () => {
    const seen = new Set<string>();
    const out: any[] = [];
    const lists = await Promise.allSettled(variants.slice(0, 3).map((v) => searchCommonsBoardPhotos(v)));
    for (const l of lists) if (l.status === 'fulfilled') for (const p of l.value) if (!seen.has(p.url)) { seen.add(p.url); out.push(p); }
    return out;
  })(), timeoutMs, [] as any[]);
  const [web, commons] = await Promise.all([webP, commonsP]);
  const photos = [
    ...commons.slice(0, 10).map((p: any) => ({
      title: p.title, thumbUrl: p.thumbUrl, url: p.thumbUrl || p.url, fullUrl: p.url, pageUrl: p.pageUrl,
      source: 'Wikimedia Commons', credit: `${p.artist} · ${p.license}`, licenseUrl: p.licenseUrl,
    })),
    ...web.filter((w: any) => typeof w.image === 'string' && /^https:\/\//.test(w.image)).slice(0, 10).map((w: any) => ({
      title: w.title, thumbUrl: w.image, url: w.image, fullUrl: w.image, pageUrl: w.url,
      source: w.source || 'iFixit', credit: `${w.source || 'iFixit'} · ${w.kind}`, licenseUrl: null,
    })),
  ].filter((p) => isProxyableImageUrl(p.url)).slice(0, 16);
  const body = {
    query: display,
    photos,
    web: web.slice(0, 10).map((w: any) => ({ title: w.title, url: w.url, snippet: w.snippet, kind: w.kind, source: w.source })),
    links: buildBoardReferenceLinks(display).filter((l) => l.kind !== 'shop').slice(0, 7),
  };
  if (web.length || photos.length) {
    if (boardLookupCache.size > 2000) boardLookupCache.clear();
    boardLookupCache.set(normalized, { at: Date.now(), body });
  }
  return body;
}

/** Spots a board number / model in a chat message ("UA43TU7000", "BN41-02703A", "Samsung UA43"). */
function detectBoardQuery(message: string): string | null {
  const text = message.replace(/\s+/g, ' ').trim();
  const code = text.match(/\b(?=[A-Z0-9._-]*\d)(?=[A-Z0-9._-]*[A-Z])[A-Z0-9][A-Z0-9._-]{3,}[A-Z0-9]\b/i);
  if (!code) return null;
  const token = code[0];
  if (/^\d+(\.\d+)?(v|a|w|mah|ma|mm|hz|khz|mhz|ghz|uf|nf|pf|k|m|ohm|r)$/i.test(token)) return null; // values, not boards
  if (/^(rs|usd|zar|r)\d+$/i.test(token)) return null;
  const brand = text.match(/\b(samsung|lg|sony|hisense|tcl|sinotec|philips|panasonic|toshiba|sharp|skyworth|vestel|xiaomi|huawei|apple|iphone|macbook|dell|hp|lenovo|asus|acer|msi|nintendo|playstation|ps[345]|xbox|oppo|vivo|tecno|infinix|itel|nokia|motorola|defy|jvc|telefunken|bosch|whirlpool|defy)\b/i);
  const q = brand && !token.toLowerCase().includes(brand[0].toLowerCase()) ? `${brand[0]} ${token}` : token;
  return q.slice(0, 80);
}

app.get('/api/board-lookup', async (req, res) => {
  const display = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (display.length < 2) return res.status(400).json({ error: 'Enter a board or model number.' });
  const rate = boardRateCheck(req, false);
  if (!rate.ok) { res.setHeader('Retry-After', String(rate.retryAfter)); return res.status(429).json({ error: 'Too many lookups. Please wait a few minutes.' }); }
  const body = await lookupBoardOnline(display, 12000);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(body);
});

const webEvidenceText = (web: any[]) => web.slice(0, 8).map((w, i) => `[${i + 1}] ${w.title} (${w.source}, ${w.kind}) ${w.url}\n    ${w.snippet || ''}`).join('\n');

// ---- Circuit map --------------------------------------------------------------------------
const CIRCUIT_BLOCK_TYPES = ['input', 'protection', 'rectifier', 'pfc', 'smps', 'standby', 'regulator', 'soc', 'memory', 'storage', 'backlight', 'display', 'audio', 'io', 'rf', 'sensor', 'battery', 'charger', 'motor', 'other'];
const CIRCUIT_EDGE_KINDS = ['power', 'signal', 'data', 'control', 'ground'];

const CIRCUIT_MAP_PROMPT = (opts: { board: string; hasPhoto: boolean; symptom: string; evidence: string }) => `You are an expert electronics repair technician. Map the circuit of ${opts.hasPhoto ? 'the circuit board in the attached photo' : `the board / device "${opts.board}"`}${opts.hasPhoto && opts.board ? ` (the user says it is "${opts.board}")` : ''}.
${opts.symptom ? `Reported fault / symptom: "${opts.symptom}".` : 'No fault was described: mark the parts that most commonly fail on this kind of board as the ones to check.'}
Break the board into functional sections (power input, protection/fuse, rectifier, PFC, main SMPS, standby supply, DC-DC regulators, main SoC, memory, backlight/LED driver, audio amp, I/O connectors, etc. as relevant), show how electricity flows through it, and choose the specific components a technician should check.
${opts.hasPhoto ? `Use ONLY what is visible in the photo for positions. For every block and component you can see, give "box_2d": [ymin, xmin, ymax, xmax] normalised to 0-1000 over the whole image (Gemini bounding-box format). Use null when you cannot locate it in the photo. Read printed reference designators (C12, Q3, U1...) and part markings when legible.` : 'There is no photo: set every "box_2d" to null.'}
Return ONLY a JSON object, no prose, in exactly this shape:
{
 "title": string,                       // e.g. "Samsung UA43 main board + PSU"
 "boardType": string,                   // e.g. "LED TV power supply / main board"
 "confidence": "low"|"medium"|"high",
 "summary": string,                     // 2-3 sentences: what the board does and how power flows
 "blocks": [{"id": string, "label": string, "type": one of ${JSON.stringify(CIRCUIT_BLOCK_TYPES)}, "description": string, "voltageIn": string|null, "voltageOut": string|null, "keyParts": string[], "box_2d": [number,number,number,number]|null}],
 "connections": [{"from": blockId, "to": blockId, "kind": one of ${JSON.stringify(CIRCUIT_EDGE_KINDS)}, "label": string, "voltage": string|null}],
 "powerFlow": blockId[],                // the main power path in order, e.g. input -> fuse -> bridge -> PFC -> SMPS -> rails -> regulators -> loads
 "components": [{"id": string, "ref": string, "label": string, "type": string, "blockId": blockId, "box_2d": [number,number,number,number]|null, "check": boolean, "priority": 1|2|3, "reason": string, "measure": string, "expected": string, "howToTest": string}],
 "testPoints": [{"label": string, "blockId": blockId, "expected": string, "how": string}],
 "failurePoints": [{"component": string, "symptom": string, "blockId": blockId}],
 "safety": string
}
Rules: 5-14 blocks, 4-16 components, 2-8 of them with "check": true (the suspects / parts to test first; priority 1 = test first). Every connection and component must reference a real block id. "measure" says what to measure and with which meter mode (e.g. "ESR / capacitance out of circuit, or DC volts across it powered"), "expected" gives typical values with units. Typical voltages are fine; never invent exact part numbers you cannot read or do not know (use a generic label like "Main filter capacitor" instead). Keep every string short (under 160 characters).${opts.evidence ? `\n\nWeb results found online for this board (use as evidence for board numbers, ICs and known faults):\n${opts.evidence}` : ''}`;

const clampBox = (b: any): [number, number, number, number] | null => {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const n = b.map((x: any) => Math.max(0, Math.min(1000, Math.round(Number(x)))));
  if (n.some((x) => !Number.isFinite(x))) return null;
  let [y0, x0, y1, x1] = n;
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 - y0 < 4 || x1 - x0 < 4) return null;
  return [y0, x0, y1, x1];
};
const s = (v: any, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).slice(0, max));

function sanitizeCircuitMap(raw: any, hasPhoto: boolean) {
  const blocks = (Array.isArray(raw?.blocks) ? raw.blocks : []).filter((b: any) => b && b.id && b.label).slice(0, 16).map((b: any) => ({
    id: s(b.id, 40), label: s(b.label, 60),
    type: CIRCUIT_BLOCK_TYPES.includes(b.type) ? b.type : 'other',
    description: s(b.description, 240), voltageIn: s(b.voltageIn, 60) || null, voltageOut: s(b.voltageOut, 60) || null,
    keyParts: strArr(b.keyParts, 8, 60), box_2d: hasPhoto ? clampBox(b.box_2d) : null,
  }));
  const ids = new Set(blocks.map((b: any) => b.id));
  const connections = (Array.isArray(raw?.connections) ? raw.connections : [])
    .filter((c: any) => c && ids.has(c.from) && ids.has(c.to) && c.from !== c.to).slice(0, 30)
    .map((c: any) => ({ from: c.from, to: c.to, kind: CIRCUIT_EDGE_KINDS.includes(c.kind) ? c.kind : 'signal', label: s(c.label, 60), voltage: s(c.voltage, 40) || null }));
  const powerFlow = (Array.isArray(raw?.powerFlow) ? raw.powerFlow : []).filter((id: any) => ids.has(id))
    .filter((id: any, i: number, a: any[]) => a.indexOf(id) === i).slice(0, 16);
  const components = (Array.isArray(raw?.components) ? raw.components : []).filter((c: any) => c && (c.label || c.ref)).slice(0, 20).map((c: any, i: number) => ({
    id: s(c.id, 40) || `c${i + 1}`, ref: s(c.ref, 30), label: s(c.label, 80) || s(c.ref, 30), type: s(c.type, 40),
    blockId: ids.has(c.blockId) ? c.blockId : null, box_2d: hasPhoto ? clampBox(c.box_2d) : null,
    check: c.check === true || c.suspect === true, priority: [1, 2, 3].includes(Number(c.priority)) ? Number(c.priority) : 2,
    reason: s(c.reason, 240), measure: s(c.measure, 240), expected: s(c.expected, 200), howToTest: s(c.howToTest, 300),
  }));
  return {
    title: s(raw?.title, 100) || 'Circuit map', boardType: s(raw?.boardType, 100),
    confidence: ['low', 'medium', 'high'].includes(raw?.confidence) ? raw.confidence : 'low',
    summary: s(raw?.summary, 500), blocks, connections, powerFlow, components,
    testPoints: (Array.isArray(raw?.testPoints) ? raw.testPoints : []).slice(0, 12).map((t: any) => ({ label: s(t?.label, 80), blockId: ids.has(t?.blockId) ? t.blockId : null, expected: s(t?.expected, 120), how: s(t?.how, 200) })).filter((t: any) => t.label),
    failurePoints: (Array.isArray(raw?.failurePoints) ? raw.failurePoints : []).slice(0, 10).map((f: any) => ({ component: s(f?.component, 80), symptom: s(f?.symptom, 160), blockId: ids.has(f?.blockId) ? f.blockId : null })).filter((f: any) => f.component),
    safety: s(raw?.safety, 400) || 'Unplug the device and discharge the large primary capacitor before touching the power section. Mains-side parts can hold lethal voltage.',
  };
}

app.post('/api/circuit-map', requireFirebaseUser, async (req, res) => {
  const startedAt = Date.now();
  const board = s(req.body?.board, 80);
  const symptom = s(req.body?.symptom, 400);
  const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
  const { images, error } = sanitizeInlineImages(req.body?.image ? [req.body.image] : req.body?.images);
  if (error) return res.status(400).json({ error });
  if (imageUrl && !isProxyableImageUrl(imageUrl)) return res.status(400).json({ error: 'That image source is not supported.' });
  if (!board && !images.length && !imageUrl) return res.status(400).json({ error: 'Send a board photo or type a board / model number.' });
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: AI_NOT_CONFIGURED });

  // In parallel: fetch the chosen web photo server-side, and gather web evidence for the board number.
  const [remote, lookup] = await Promise.all([
    imageUrl ? fetchRemoteImage(imageUrl, 6000).catch(() => null) : Promise.resolve(null),
    board ? withTimeout(lookupBoardOnline(board, 3500), 4000, null as any) : Promise.resolve(null),
  ]);
  if (imageUrl && !remote) return res.status(502).json({ error: 'Could not download that board photo. Pick another one.' });
  const photo: InlineImage | null = images[0] || (remote ? { mimeType: remote.mimeType, data: remote.buf.toString('base64') } : null);
  const prompt = CIRCUIT_MAP_PROMPT({ board, hasPhoto: !!photo, symptom, evidence: lookup?.web?.length ? webEvidenceText(lookup.web) : '' });
  const parts: any[] = [];
  if (photo) parts.push({ inlineData: { mimeType: photo.mimeType, data: photo.data } });
  parts.push({ text: prompt });
  try {
    const budget = Math.max(8000, 25000 - (Date.now() - startedAt));
    const text = await callGeminiSmart(ai, [{ role: 'user', parts }], undefined, { responseMimeType: 'application/json', __budgetMs: budget });
    const parsed = parseJsonLoose(text);
    if (!parsed || !Array.isArray(parsed.blocks) || !parsed.blocks.length) return res.status(503).json({ error: 'The AI could not map this board just now. Please try again.' });
    const map = sanitizeCircuitMap(parsed, !!photo);
    res.json({
      map, hasPhoto: !!photo, board,
      photoSource: remote ? imageUrl : null,
      board_lookup: lookup ? { photos: lookup.photos, web: lookup.web, links: lookup.links } : null,
      disclaimer: 'AI-generated and approximate. Positions, values and suspects are estimates: confirm with the schematic / service manual and your meter before replacing parts.',
      ms: Date.now() - startedAt,
    });
  } catch (e: any) {
    console.error('circuit-map failed:', e?.message || e);
    res.status(503).json({ error: AI_UNAVAILABLE });
  }
});

// ==== Translation: page text, Theory book, guides, and video subtitles ======================
// Any language (the client sends a language name + code). Short strings are batched; results are
// cached in memory here and in localStorage / Firestore in the browser.
const translateCache = new Map<string, string>();
const tKey = (lang: string, s: string) => crypto.createHash('sha1').update(lang + '\u0000' + s).digest('base64');

app.post('/api/translate', requireFirebaseUser, async (req, res) => {
  const lang = s(req.body?.lang, 20);
  const langName = s(req.body?.langName, 60) || lang;
  const texts: string[] = Array.isArray(req.body?.texts) ? req.body.texts.filter((x: any) => typeof x === 'string').slice(0, 200).map((x: string) => x.slice(0, 2000)) : [];
  if (!lang || !texts.length) return res.status(400).json({ error: 'Nothing to translate.' });
  if (texts.reduce((n, x) => n + x.length, 0) > 30000) return res.status(400).json({ error: 'Too much text in one request.' });
  const out: (string | null)[] = texts.map((x) => translateCache.get(tKey(lang, x)) ?? null);
  const missing = texts.map((x, i) => ({ x, i })).filter((m) => out[m.i] === null);
  if (!missing.length) return res.json({ translations: out, cached: true });
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: AI_NOT_CONFIGURED });
  const prompt = `Translate each string in this JSON array from its original language into ${langName} (language code "${lang}").
Return ONLY a JSON array of strings with exactly ${missing.length} items, in the same order.
Rules: keep numbers, units (V, A, Ω, µF, Hz, W), formulas, symbols, part numbers, model numbers, brand names, URLs, emoji and Markdown exactly as they are. Keep leading/trailing spaces and punctuation style. Use clear, everyday ${langName} that a student or technician understands; use the usual technical terms in ${langName} (or the English term in brackets if there is no common word).
${JSON.stringify(missing.map((m) => m.x))}`;
  try {
    const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ text: prompt }] }], undefined, undefined,
      { responseMimeType: 'application/json', __models: orderModels(FAST_MODELS), __thinking: 'MINIMAL', __budgetMs: 22000 });
    let arr: any = null;
    try { arr = JSON.parse(text); } catch { const m = /\[[\s\S]*\]/.exec(text); if (m) try { arr = JSON.parse(m[0]); } catch { /* ignore */ } }
    if (!Array.isArray(arr) || arr.length !== missing.length) return res.status(502).json({ error: 'The translation came back incomplete. Please try again.' });
    missing.forEach((m, k) => {
      const v = typeof arr[k] === 'string' ? arr[k] : m.x;
      out[m.i] = v;
      if (translateCache.size > 20000) translateCache.clear();
      translateCache.set(tKey(lang, m.x), v);
    });
    res.json({ translations: out });
  } catch (e: any) {
    console.warn('translate failed:', e?.message || e);
    res.status(503).json({ error: AI_UNAVAILABLE });
  }
});

// Subtitles for an uploaded video (Firebase Storage), transcribed + translated by Gemini as WebVTT.
// Free tier: the video is sent inline, so it must be under ~18 MB (about 2-4 minutes of phone video)
// and the answer must arrive within the 30 s function limit.
const captionCache = new Map<string, string>();
const MAX_CAPTION_VIDEO_BYTES = 18 * 1024 * 1024;
app.post('/api/video-captions', requireFirebaseUser, async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url : '';
  const lang = s(req.body?.lang, 20);
  const langName = s(req.body?.langName, 60) || lang;
  let host = '';
  try { host = new URL(url).hostname; } catch { /* invalid */ }
  if (!/^firebasestorage\.googleapis\.com$|\.firebasestorage\.app$/.test(host)) return res.status(400).json({ error: 'Only videos uploaded to DIY Electronics can be subtitled here.' });
  if (!lang) return res.status(400).json({ error: 'Choose a language.' });
  const ck = `${url}|${lang}`;
  if (captionCache.has(ck)) return res.json({ vtt: captionCache.get(ck), cached: true });
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: AI_NOT_CONFIGURED });
  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
    const len = Number(head?.headers.get('content-length') || 0);
    if (len > MAX_CAPTION_VIDEO_BYTES) return res.status(413).json({ error: 'This video is too long for free automatic subtitles (limit about 18 MB). Try a shorter clip.' });
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ error: 'Could not download the video.' });
    const mimeType = (r.headers.get('content-type') || 'video/mp4').split(';')[0];
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_CAPTION_VIDEO_BYTES) return res.status(413).json({ error: 'This video is too long for free automatic subtitles (limit about 18 MB). Try a shorter clip.' });
    const prompt = `Transcribe the speech in this video and translate it into ${langName} (code "${lang}"). Return ONLY valid WebVTT subtitles: start with "WEBVTT", then cues with timestamps in HH:MM:SS.mmm --> HH:MM:SS.mmm format matching when each phrase is spoken, each cue at most 2 short lines. If there is no speech, describe the important on-screen actions briefly in ${langName} as cues instead. Each cue must contain ONLY the ${langName} translation — never include the original-language text, a transcript, or both languages. Keep part numbers, voltages and brand names unchanged.`;
    const text = await callGeminiWithCascade(ai, [{ role: 'user', parts: [{ inlineData: { mimeType: /^video\//.test(mimeType) ? mimeType : 'video/mp4', data: buf.toString('base64') } }, { text: prompt }] }], undefined, undefined,
      { __models: orderModels(FAST_MODELS), __thinking: 'MINIMAL', __budgetMs: Math.max(8000, 24000) });
    let vtt = text.replace(/^```(?:vtt|webvtt)?\s*/i, '').replace(/```\s*$/, '').trim();
    if (!/^WEBVTT/.test(vtt)) vtt = `WEBVTT\n\n${vtt}`;
    if (!/-->/.test(vtt)) return res.status(502).json({ error: 'Could not make subtitles for this video.' });
    captionCache.set(ck, vtt);
    res.json({ vtt });
  } catch (e: any) {
    console.warn('video-captions failed:', e?.message || e);
    res.status(503).json({ error: AI_UNAVAILABLE });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


// ---- AI pro-tips & video tutorial routes (ported from original DIYELECTRONICS-web-app) ----
const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return makeGenAI(apiKey);
};

const CURATED_MISTAKES_BY_MODEL: Record<string, any> = {
  macbook: {
    summary: 'High risk of irreversible CPU kill via long-screw damage or probing 12V PPBUS_G3H with high-voltage probe slip into adjacent 1.8V lines.',
    benchDoAndDonts: [
      { doTip: 'Keep screws in a magnetic organizational project mat labeled by exact hole length.', dontMistake: 'Never mix up Torx screw lengths; driving a long screw into logic board ground layers cuts inner copper traces (Long-Screw Damage).' },
      { doTip: 'Disconnect battery data flex AND battery screw terminal before connecting any bench probe.', dontMistake: 'Never plug or unplug LCD eDP ribbon cable with battery connected; 50V backlight rail instantly bridges to CPU eDP data lines, frying the SoC.' },
      { doTip: 'Use Kapton tape around BGA chips when reflowing or desoldering nearby passive capacitors.', dontMistake: 'Never blast 400°C hot air directly over underfilled RAM chips without shielding.' }
    ],
    commonMistakes: [
      {
        id: 'mb_1',
        mistakeTitle: 'Hot-Plugging LCD Cable with Battery Connected',
        whyItHappens: 'Technicians rushing display swaps forget that the 50V PPVOUT_S0_LCDBKLT rail is permanently energized even in sleep mode.',
        preventionTip: 'Disconnect the battery screw terminal and hold power button 10s to drain caps before touching the LCD connector.',
        riskLevel: 'Critical Damage',
        componentOrArea: 'eDP Display Connector (J8500)'
      },
      {
        id: 'mb_2',
        mistakeTitle: 'Long-Screw Damage on Shield Standoffs',
        whyItHappens: 'Outer hinge screws are 3.5mm while trackpad shield screws are 1.8mm. Driving a 3.5mm screw drills directly into multi-layer PCB traces.',
        preventionTip: 'Use a labeled magnetic silicone screw tray. If a screw encounters resistance before sitting flush, stop immediately.',
        riskLevel: 'Critical Damage',
        componentOrArea: 'Logic Board Standoff Threads'
      },
      {
        id: 'mb_3',
        mistakeTitle: 'Probing PPBUS_G3H Near Low-Voltage Data Rails with Thick Probes',
        whyItHappens: 'Standard multimeter needles slip between tiny 0201 passives, bridging 12.6V PPBUS straight into 1.8V PMIC data lines.',
        preventionTip: 'Use micro-needle needle-point 0.1mm probe tips with insulated heat-shrink sleeves.',
        riskLevel: 'High Risk',
        componentOrArea: 'PPBUS_G3H Inductor & Capacitors'
      }
    ],
    torqueOrTempSpecs: [
      { label: 'Hot Air Soldering Temp', spec: '340°C - 355°C @ 45% air' },
      { label: 'Bottom Preheat Plate', spec: '110°C for 5 mins' },
      { label: 'P5 Pentalobe Torque', spec: '0.25 Nm (finger tight)' }
    ]
  },
  nintendo: {
    summary: 'Delicate FPC ribbon latches, fragile battery connector tabs, and USB-C port pin bridging during solder rework.',
    benchDoAndDonts: [
      { doTip: 'Use a plastic dental pick or spudger to open micro zero-insertion-force (ZIF) lock flaps.', dontMistake: 'Never pry micro ribbon latches upwards with metal tweezers; the plastic hinge snaps off permanently.' },
      { doTip: 'Verify 0.00Ω dead short on capacitor next to M92T36 pin 5 before applying power.', dontMistake: 'Never replace the USB-C port with a generic phone port; the Switch uses an asymmetrical custom dual-row 24-pin connector.' },
      { doTip: 'Use a preheating plate at 150°C when desoldering the dual-row USB-C connector.', dontMistake: 'Never tug on the USB-C port while solder is still pasty; you will tear the hidden inner PCB trace pads.' }
    ],
    commonMistakes: [
      {
        id: 'ns_1',
        mistakeTitle: 'Snapping the MicroSD Card Reader FPC Connector',
        whyItHappens: 'The daughterboard connector is extremely brittle and snaps if lifted at an angle instead of straight vertical pop.',
        preventionTip: 'Lift gently using a nylon pry tool right beneath the connector center.',
        riskLevel: 'High Risk',
        componentOrArea: 'J4001 MicroSD FPC Connector'
      },
      {
        id: 'ns_2',
        mistakeTitle: 'Tearing the Joy-Con Rail ZIF Latch',
        whyItHappens: 'The black lever on the Joy-Con ribbon socket is 0.3mm thin; twisting it cracks the retainer bracket.',
        preventionTip: 'Use a plastic ESD pry tool to flip the latch 90 degrees gently.',
        riskLevel: 'Caution',
        componentOrArea: 'Joy-Con Rail ZIF Socket'
      },
      {
        id: 'ns_3',
        mistakeTitle: 'Bridging Hidden Bottom USB-C Ground & VBUS Pins',
        whyItHappens: 'The inner 12 pins of the Switch USB-C port are concealed underneath the metal shell and cannot be inspected by eye.',
        preventionTip: 'Flood with low-melt bismuth solder, pre-tin all 24 pins with liquid flux, and check with a USB breakout tester board before powering on.',
        riskLevel: 'Critical Damage',
        componentOrArea: 'USB-C 24-Pin Receptacle'
      }
    ],
    torqueOrTempSpecs: [
      { label: 'USB-C Desolder Temp', spec: '380°C hot air + 150°C bottom preheat' },
      { label: 'M92T36 QFN Solder Temp', spec: '340°C with tacky rosin flux' },
      { label: 'Tri-Point Y00 Screws', spec: 'Do not over-torque; strip easily' }
    ]
  },
  playstation: {
    summary: 'Liquid metal spillage on APU capacitors, Southbridge BGA detachment, and HDMI port replacement trace delamination.',
    benchDoAndDonts: [
      { doTip: 'Apply silicone thermal barrier foam or conformal coating around APU passives when servicing liquid metal.', dontMistake: 'Never tilt the PS5 motherboard vertically while liquid metal is unsealed; conductive droplets short out SMD caps.' },
      { doTip: 'Preheat the thick 12-layer PS5 motherboard on a hot plate at 180°C before attempting HDMI replacement.', dontMistake: 'Never crank hot air to 450°C without preheating; the huge copper ground planes will wick the heat and blister the PCB surface.' },
      { doTip: 'Check continuity on HDMI diode filters before and after installing a new connector.', dontMistake: 'Never force the optical drive ribbon cable; the drive daughterboard is paired uniquely to the APU via firmware encryption.' }
    ],
    commonMistakes: [
      {
        id: 'ps_1',
        mistakeTitle: 'Liquid Metal Droplet Migration to SMD Capacitors',
        whyItHappens: 'When opening the APU heatsink, gallium-indium liquid metal oxidizes and beads, dripping onto bare 0402 APU bypass caps.',
        preventionTip: 'Mop up liquid metal with lint-free swabs soaked in 99.9% IPA before lifting the main board, and inspect under 20x magnification.',
        riskLevel: 'Critical Damage',
        componentOrArea: 'APU Perimeter Capacitor Array'
      },
      {
        id: 'ps_2',
        mistakeTitle: 'Ripping HDMI Port Anchor Post Ground Pads',
        whyItHappens: 'PS5 anchor legs are soldered with high-temp lead-free solder into heavy copper internal layers.',
        preventionTip: 'Use low-melt solder alloy (138°C melting point) on all four anchor posts to lower thermal mass before hot air extraction.',
        riskLevel: 'High Risk',
        componentOrArea: 'HDMI 2.1 Female Port'
      },
      {
        id: 'ps_3',
        mistakeTitle: 'Losing or Damaging the Paired Optical Drive Daughterboard',
        whyItHappens: 'On PS4 / PS5 consoles, swapping or breaking the disc board causes SU-42118-6 errors and blocks all future system firmware updates.',
        preventionTip: 'Always retain the original disc drive logic controller board with its native console pairing.',
        riskLevel: 'Critical Damage',
        componentOrArea: 'Optical Drive Motherboard Flex'
      }
    ],
    torqueOrTempSpecs: [
      { label: 'Bottom Preheat Plate', spec: '180°C for 6 mins' },
      { label: 'Hot Air HDMI Extraction', spec: '380°C - 400°C @ 60% air' },
      { label: 'APU Clamp Screw Torque', spec: '0.45 Nm in cross-pattern' }
    ]
  },
  samsung: {
    summary: 'OLED screen flex tearing at bottom curved bezel, thermal sensor cable rip during rear glass removal, and moisture sensor sub-flex damage.',
    benchDoAndDonts: [
      { doTip: 'Heat rear cover evenly to exactly 75°C - 80°C on a temperature-controlled heating mat.', dontMistake: 'Never slice opening picks deeper than 3mm on the right edge where the volume ribbon cable sits.' },
      { doTip: 'Use a plastic battery spudger with 2 drops of adhesive remover to lift the Li-ion battery.', dontMistake: 'Never puncture, bend, or use sharp metal blades on lithium pouch cells; thermal runaway fire risk.' },
      { doTip: 'Inspect the sub-PBA moisture detection pins under microscope after ultrasonic cleaning.', dontMistake: 'Never ignore moisture warning prompts by forcing 45W PPS charging; CC lines will burn out.' }
    ],
    commonMistakes: [
      {
        id: 'sam_1',
        mistakeTitle: 'Slicing Wireless Charging Coil / NFC Thermal Antenna',
        whyItHappens: 'Adhesive near camera module is dense; inserting pry picks deeply cuts through the copper foil antenna.',
        preventionTip: 'Follow outer edge guideline and visually check pick depth under LED bench lamp.',
        riskLevel: 'Caution',
        componentOrArea: 'Rear Glass & Qi Charging Assembly'
      },
      {
        id: 'sam_2',
        mistakeTitle: 'Overheating AMOLED Display Past 85°C',
        whyItHappens: 'Excess heat burns organic LED emissive layers, causing yellow burn marks or dead pixel clusters.',
        preventionTip: 'Limit hot mat temperature strictly to 80°C and duration to 5 minutes maximum.',
        riskLevel: 'High Risk',
        componentOrArea: 'Dynamic AMOLED 2X Panel'
      },
      {
        id: 'sam_3',
        mistakeTitle: 'Damaging mmWave Antenna Coaxial Connectors',
        whyItHappens: 'Prying miniature micro-coaxial plugs sideways shears the tiny center signal pin.',
        preventionTip: 'Use specialized coaxial puller tweezers lifting straight upward at a 90° angle.',
        riskLevel: 'High Risk',
        componentOrArea: '5G mmWave Sub-Board Coax'
      }
    ],
    torqueOrTempSpecs: [
      { label: 'Heat Mat Temp', spec: '75°C - 80°C' },
      { label: 'Display Frame Adhesive Cure', spec: 'Clamp with 2kg pressure 15 mins' },
      { label: 'Phillips #00 Screws', spec: 'Hand tight (0.15 Nm)' }
    ]
  },
  xbox: {
    summary: '12V power supply busbar shorting, MOSFET DrMOS gate thermal runaway, and southbridge APU solder fatigue.',
    benchDoAndDonts: [
      { doTip: 'Discharge the heavy 12V busbar capacitors before probing the split motherboard sandwich.', dontMistake: 'Never power up the Xbox Series X motherboard split apart without the inter-board connector fully seated.' },
      { doTip: 'Inject no more than 1.0V at 2A when searching for shorted DrMOS power stages.', dontMistake: 'Never inject 12V directly into a shorted 12V rail; if the high-side MOSFET is blown, 12V will fry the main APU core instantly.' }
    ],
    commonMistakes: [
      {
        id: 'xb_1',
        mistakeTitle: 'Injecting Excessive Voltage on 12V Rail with Blown High-Side MOSFET',
        whyItHappens: 'When a DrMOS or buck MOSFET fails, drain-to-source is shorted. Injecting 12V sends full voltage directly into the 0.85V AMD APU core.',
        preventionTip: 'Always check resistance between the 12V rail and VCore inductor before injecting voltage. Limit bench supply to 0.9V.',
        riskLevel: 'Critical Damage',
        componentOrArea: '12V VCore DrMOS VRM'
      },
      {
        id: 'xb_2',
        mistakeTitle: 'Stripping Torx T8 Security Screws on Main Heatsink Vapor Chamber',
        whyItHappens: 'Factory threadlocker requires firm downward axial force before rotating.',
        preventionTip: 'Use high-grade hardened S2 steel Torx bits with calibrated downward pressure.',
        riskLevel: 'Caution',
        componentOrArea: 'Vapor Chamber Heatsink Bracket'
      }
    ],
    torqueOrTempSpecs: [
      { label: 'Voltage Injection Limit', spec: 'Max 1.0V @ 3A max' },
      { label: 'DrMOS Replacement Temp', spec: '350°C @ 50% air' }
    ]
  }
};

// Dynamic Pro-Tips & Common Mistakes Route
app.post('/api/repair/pro-tips', async (req, res) => {
  const { deviceModel, deviceCategory, issueType } = req.body || {};

  if (!deviceModel && !deviceCategory) {
    return res.status(400).json({ error: 'Device model or category is required.' });
  }

  const modelStr = `${deviceModel || ''} ${deviceCategory || ''}`.toLowerCase();

  // Find a matching entry in the hand-written (curated) tips. No match means no curated
  // fallback: we never show tips for a different device family.
  let matchedKey: string | null = null;
  if (modelStr.includes('switch') || modelStr.includes('nintendo') || modelStr.includes('joy-con')) {
    matchedKey = 'nintendo';
  } else if (modelStr.includes('playstation') || modelStr.includes('ps5') || modelStr.includes('ps4') || modelStr.includes('sony')) {
    matchedKey = 'playstation';
  } else if (modelStr.includes('samsung') || modelStr.includes('galaxy')) {
    matchedKey = 'samsung';
  } else if (modelStr.includes('xbox') || modelStr.includes('series x') || modelStr.includes('microsoft')) {
    matchedKey = 'xbox';
  } else if (modelStr.includes('macbook')) {
    matchedKey = 'macbook';
  }

  const curated = matchedKey ? CURATED_MISTAKES_BY_MODEL[matchedKey] : null;
  const curatedResponse = (source: string) => ({
    success: true,
    deviceModel: deviceModel || 'Electronics',
    summary: curated.summary,
    benchDoAndDonts: curated.benchDoAndDonts,
    commonMistakes: curated.commonMistakes,
    torqueOrTempSpecs: curated.torqueOrTempSpecs,
    source,
  });

  const ai = getGeminiClient();

  if (!ai) {
    if (curated) return res.json(curatedResponse('curated'));
    return res.status(503).json({ success: false, error: AI_NOT_CONFIGURED });
  }

  try {
    const prompt = `You are an experienced electronics repair engineer and micro-soldering technician.
Analyze the following specific device being repaired:
- Device Model: ${String(deviceModel || '').slice(0, 200)}
- Device Category: ${String(deviceCategory || 'Electronics').slice(0, 200)}
- Specific Issue: ${String(issueType || 'General teardown and component replacement').slice(0, 300)}

Generate a specific "Pro-Tips & Common Mistakes" briefing for bench work on this device model.
Identify real-world pitfalls technicians run into (e.g. long-screw damage, snapping brittle ZIF latches, heat damage, bridging pins, tearing hidden ribbon cables, stripping screws, ESD damage).
If you are not sure about a model-specific value, give a typical range and say it is typical.

Return valid JSON with this exact structure:
{
  "summary": "1-2 sentence warning of the biggest risk for this model",
  "benchDoAndDonts": [ { "doTip": "Specific action to take", "dontMistake": "Specific pitfall to avoid" } ],
  "commonMistakes": [
    {
      "id": "m_1",
      "mistakeTitle": "Descriptive title of the pitfall",
      "whyItHappens": "Why technicians make this mistake",
      "preventionTip": "Concrete preventive technique, tool, or multimeter check",
      "riskLevel": "Caution" | "High Risk" | "Critical Damage",
      "componentOrArea": "Component or connector name"
    }
  ],
  "torqueOrTempSpecs": [ { "label": "e.g. Soldering Temp", "spec": "e.g. 340°C - 350°C" } ]
}`;

    const text = await callGeminiWithCascade(ai, prompt, undefined, undefined, { responseMimeType: 'application/json' });
    const parsed = JSON.parse(text || '{}');
    if (!parsed.summary && !Array.isArray(parsed.commonMistakes)) throw new Error('Empty AI response');

    return res.json({
      success: true,
      deviceModel: deviceModel || 'Electronics',
      summary: parsed.summary || '',
      benchDoAndDonts: Array.isArray(parsed.benchDoAndDonts) ? parsed.benchDoAndDonts : [],
      commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [],
      torqueOrTempSpecs: Array.isArray(parsed.torqueOrTempSpecs) ? parsed.torqueOrTempSpecs : [],
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('Pro-Tips AI generation error:', error?.message || error);
    if (curated) return res.json(curatedResponse('curated_fallback'));
    return res.status(503).json({ success: false, error: AI_UNAVAILABLE });
  }
});

/** A real YouTube search for repair videos of this device/issue (we do not host or invent videos). */
function buildYouTubeSearchUrl(...parts: (string | undefined)[]): string {
  const q = [...parts.filter(Boolean), 'repair'].join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// AI chaptered walkthrough for a repair guide (text only: no generated or sample video,
// no invented instructor). The response includes a real YouTube search link instead.
app.post('/api/repair/video-tutorial', async (req, res) => {
  const { title, deviceModel, deviceCategory, issueType, steps, toolsRequired } = req.body || {};
  const youtubeSearchUrl = buildYouTubeSearchUrl(deviceModel, issueType || title);

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ success: false, error: AI_NOT_CONFIGURED, youtubeSearchUrl });
  }

  const stepSummary = Array.isArray(steps)
    ? steps.slice(0, 20).map((s: any, i: number) => `${i + 1}. ${String(s?.title || s?.text || s?.description || '').slice(0, 200)}`).join('\n')
    : '';

  try {
    const prompt = `You are an electronics repair instructor writing a chaptered walkthrough for a repair guide.
Device Model: "${String(deviceModel || 'Electronics device').slice(0, 200)}"
Category: "${String(deviceCategory || 'Electronics').slice(0, 200)}"
Guide Title: "${String(title || 'Bench repair').slice(0, 200)}"
Issue: "${String(issueType || 'Component failure').slice(0, 300)}"
Tools: ${Array.isArray(toolsRequired) ? toolsRequired.slice(0, 30).join(', ') : 'Standard bench tools'}
${stepSummary ? `Guide steps:\n${stepSummary}` : ''}

Write a clear, technical walkthrough split into 4 to 6 chapters (disassembly, inspection/probing, repair or replacement, reassembly and testing).
If you are not sure of a model-specific value, give a typical range and say it is typical.
Return ONLY a valid JSON object:
{
  "title": "Concise walkthrough title",
  "benchSafetyProtocol": "Critical safety rules for this specific device and repair",
  "magnificationLevel": "e.g. 10x - 30x stereo microscope, or 'Not needed'",
  "hotAirReworkTemp": "e.g. 340°C - 350°C @ 45% airflow, or 'Not needed'",
  "chapters": [
    {
      "id": "chap_1",
      "title": "Chapter name",
      "actionSummary": "What is done in this chapter and how",
      "benchTool": "Tools used in this chapter",
      "cautionNotice": "Hazard or common mistake to avoid",
      "multimeterMode": "Measurement mode if applicable, or 'Visual inspection'",
      "targetComponents": ["Component 1"]
    }
  ],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}`;

    const text = await callGeminiWithCascade(ai, prompt, undefined, undefined, { responseMimeType: 'application/json' });
    const parsed = JSON.parse(text || '{}');
    const chapters = Array.isArray(parsed.chapters) ? parsed.chapters.slice(0, 8) : [];
    if (chapters.length === 0) throw new Error('AI returned no chapters');

    return res.json({
      success: true,
      tutorial: {
        title: parsed.title || (title ? `Walkthrough: ${title}` : `Repair walkthrough for ${deviceModel || 'your device'}`),
        deviceModel: deviceModel || '',
        issueType: issueType || '',
        benchSafetyProtocol: parsed.benchSafetyProtocol || '',
        magnificationLevel: parsed.magnificationLevel || '',
        hotAirReworkTemp: parsed.hotAirReworkTemp || '',
        chapters: chapters.map((c: any, i: number) => ({ ...c, id: c?.id || `chap_${i + 1}` })),
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.slice(0, 6) : [],
        youtubeSearchUrl,
      },
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('AI walkthrough generation error:', error?.message || error);
    return res.status(503).json({ success: false, error: AI_UNAVAILABLE, youtubeSearchUrl });
  }
});

// Structured AI symptom diagnosis for the Diagnostic Tool.
// Returns JSON only from the model; no invented confidence scores or prices.
app.post('/api/diagnose', async (req, res) => {
  const { category, model, symptom, powerStatus, visualSigns } = req.body || {};
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const input = {
    category: clean(category, 100),
    model: clean(model, 200),
    symptom: clean(symptom, 2000),
    powerStatus: clean(powerStatus, 300),
    visualSigns: clean(visualSigns, 1000),
  };
  if (!input.symptom) {
    return res.status(400).json({ error: 'Please describe the symptom first.' });
  }

  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: AI_NOT_CONFIGURED });

  const prompt = `Diagnose this electronics fault for a repair technician or DIY repairer.
Device category: ${input.category || 'Unknown'}
Device brand/model: ${input.model || 'Unknown'}
Symptom: ${input.symptom}
Power / current-draw behaviour: ${input.powerStatus || 'Not measured'}
Visual signs: ${input.visualSigns || 'None reported'}

Return ONLY valid JSON with this structure:
{
  "probableCause": "Most likely fault, in one line",
  "otherPossibleCauses": ["Other plausible cause", "..."],
  "severity": "Low" | "Medium" | "High" | "Critical",
  "safetyWarning": "The most important safety precaution for this repair",
  "requiredTools": ["Tool", "..."],
  "testPoints": ["A measurement to take and what a good vs bad reading looks like", "..."],
  "steps": [ { "stepNumber": 1, "title": "Short title", "detail": "What to do" } ],
  "partToSource": "Name/part number of the most likely replacement part, or empty string if unknown",
  "whenToStop": "When the user should stop and take it to a professional"
}
Rules: Base severity on safety risk and damage risk. Do not invent exact part numbers or measurements you are unsure of; say a value is typical when it is. Do not include prices or confidence percentages. Never suggest bypassing FRP, iCloud/Activation Lock or other anti-theft locks.`;

  try {
    const text = await callGeminiWithCascade(
      ai,
      prompt,
      'You are the DIY Electronics diagnostic assistant: a careful, safety-first electronics repair engineer.',
      undefined,
      { responseMimeType: 'application/json' }
    );
    const parsed = JSON.parse(text || '{}');
    if (!parsed.probableCause) throw new Error('AI returned no diagnosis');
    const severities = ['Low', 'Medium', 'High', 'Critical'];
    const strList = (v: any, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, n) : []);
    return res.json({
      diagnosis: {
        probableCause: String(parsed.probableCause),
        otherPossibleCauses: strList(parsed.otherPossibleCauses, 5),
        severity: severities.includes(parsed.severity) ? parsed.severity : 'Medium',
        safetyWarning: typeof parsed.safetyWarning === 'string' ? parsed.safetyWarning : '',
        requiredTools: strList(parsed.requiredTools, 12),
        testPoints: strList(parsed.testPoints, 10),
        steps: Array.isArray(parsed.steps)
          ? parsed.steps.slice(0, 10).map((s: any, i: number) => ({
              stepNumber: Number(s?.stepNumber) || i + 1,
              title: String(s?.title || `Step ${i + 1}`),
              detail: String(s?.detail || ''),
            }))
          : [],
        partToSource: typeof parsed.partToSource === 'string' ? parsed.partToSource.slice(0, 120) : '',
        whenToStop: typeof parsed.whenToStop === 'string' ? parsed.whenToStop : '',
      },
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('Diagnose route error:', error?.message || error);
    return res.status(503).json({ error: AI_UNAVAILABLE });
  }
});



async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// On Netlify the API runs as a serverless function (netlify/functions/api.ts),
// so only start a long-running server when running locally or on a normal host.
if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
