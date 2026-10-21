// On-demand AI translation for the Theory book / exams (and helpers for video subtitles).
// The rest of the app stays in English. Results are cached per language in localStorage and on the server.
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LANGUAGE_BY_CODE, deviceLanguage, type Language } from './languages';
import { isSignedIn, SignInRequiredError, withAuth } from './signInGate';

const BOOK_LANG_KEY = 'diy_book_lang';
export function getBookLanguage(): Language {
  try { const c = localStorage.getItem(BOOK_LANG_KEY); if (c && LANGUAGE_BY_CODE[c.toLowerCase()]) return LANGUAGE_BY_CODE[c.toLowerCase()]; } catch { /* ignore */ }
  return deviceLanguage();
}
export function setBookLanguage(code: string) { try { localStorage.setItem(BOOK_LANG_KEY, code); } catch { /* ignore */ } }

function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }
const memo = new Map<string, Record<string, string>>();
function cacheFor(lang: string): Record<string, string> {
  if (memo.has(lang)) return memo.get(lang)!;
  let c: Record<string, string> = {};
  try { c = JSON.parse(localStorage.getItem(`diy_tr_${lang}`) || '{}') || {}; } catch { /* ignore */ }
  memo.set(lang, c);
  return c;
}
let saveTimer: any = null;
function persist(lang: string) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const c = cacheFor(lang);
    const keys = Object.keys(c);
    if (keys.length > 6000) for (const k of keys.slice(0, keys.length - 6000)) delete c[k];
    try { localStorage.setItem(`diy_tr_${lang}`, JSON.stringify(c)); } catch { /* storage full: keep in memory */ }
  }, 800);
}

/** Translate many strings (cached; misses sent in batches). */
export async function translateTexts(texts: string[], lang: Language): Promise<string[]> {
  if (lang.code === 'en') return texts;
  const cache = cacheFor(lang.code);
  const missing = [...new Set(texts.filter((t) => cache[hash(t)] === undefined))];
  const batches: string[][] = [];
  let cur: string[] = [], size = 0;
  for (const t of missing) {
    if (cur.length >= 120 || size + t.length > 12000) { batches.push(cur); cur = []; size = 0; }
    cur.push(t); size += t.length;
  }
  if (cur.length) batches.push(cur);
  // AI translation needs an account. Guests still get anything already cached on this device; no wall
  // pops up here because the book auto-translates into the phone's language on open.
  if (batches.length && !isSignedIn()) throw new SignInRequiredError('Sign in to translate into other languages.');
  await Promise.all(batches.map(async (b) => {
    const r = await fetch('/api/translate', await withAuth({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: b, lang: lang.code, langName: lang.name }) }));
    const data = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(data?.translations)) throw new Error(data?.error || 'Translation failed.');
    b.forEach((t, i) => { if (typeof data.translations[i] === 'string') cache[hash(t)] = data.translations[i]; });
  }));
  persist(lang.code);
  return texts.map((t) => cache[hash(t)] ?? t);
}

const SKIP = '[data-notranslate],script,style,code,pre,kbd,.font-mono,input,textarea,select,svg text';
const worthTranslating = (s: string) => /\p{L}{2,}/u.test(s);

/**
 * Translates every visible text node inside `ref` into `lang` and keeps it translated as React re-renders
 * (MutationObserver). Switching back to English restores the original text.
 */
export function useDomTranslate(ref: RefObject<HTMLElement | null>, lang: Language, deps: unknown[] = []) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const originals = useRef(new WeakMap<Text, string>());
  const applied = useRef(new WeakMap<Text, string>());
  const applying = useRef(false);
  const run = useRef<() => void>(() => {});

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    const collect = () => {
      const nodes: Text[] = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        const t = n as Text;
        const parent = t.parentElement;
        if (!parent || parent.closest(SKIP)) continue;
        const val = t.nodeValue || '';
        // React may have put the English text back: treat the current value as the new original.
        if (applied.current.get(t) !== val) originals.current.set(t, val);
        if (worthTranslating(originals.current.get(t) || '')) nodes.push(t);
      }
      return nodes;
    };
    const restore = () => {
      applying.current = true;
      for (const t of collect()) { const o = originals.current.get(t); if (o !== undefined && t.nodeValue !== o) t.nodeValue = o; applied.current.delete(t); }
      applying.current = false;
    };
    const translate = async () => {
      if (lang.code === 'en') { restore(); setState({ busy: false, error: null }); return; }
      const nodes = collect();
      const texts = nodes.map((t) => (originals.current.get(t) || '').trim());
      if (!texts.length) return;
      setState((s) => ({ ...s, busy: true }));
      try {
        const out = await translateTexts(texts, lang);
        if (cancelled) return;
        applying.current = true;
        nodes.forEach((t, i) => {
          const o = originals.current.get(t) || '';
          const lead = o.match(/^\s*/)?.[0] || '', trail = o.match(/\s*$/)?.[0] || '';
          const v = lead + out[i] + trail;
          if (t.isConnected && t.nodeValue !== v) t.nodeValue = v;
          applied.current.set(t, v);
        });
        applying.current = false;
        setState({ busy: false, error: null });
      } catch (e: any) {
        applying.current = false;
        if (!cancelled) setState({ busy: false, error: e?.message || 'Translation failed.' });
      }
    };
    run.current = translate;
    let timer: any = null;
    const mo = new MutationObserver(() => { if (applying.current) return; clearTimeout(timer); timer = setTimeout(translate, 350); });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    translate();
    return () => { cancelled = true; clearTimeout(timer); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, lang.code, ...deps]);

  return { ...state, retry: () => run.current() };
}
