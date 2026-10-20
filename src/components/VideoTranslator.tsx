import { useEffect, useRef, useState } from 'react';
import { Languages, Loader2, X } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { deviceLanguage, type Language } from '../lib/languages';
import LanguagePicker from './LanguagePicker';

/** Stable short key for a video URL (Firestore doc id safe). */
function videoKey(url: string) {
  const clean = url.split('?')[0];
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < clean.length; i++) { const c = clean.charCodeAt(i); h1 = ((h1 << 5) + h1 + c) | 0; h2 = ((h2 << 5) + h2 ^ c) | 0; }
  return `v${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function LangSheet({ value, onPick, onClose, title }: { value: string; onPick: (l: Language | null) => void; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md h-[75dvh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <p className="text-sm font-semibold">{title}</p>
          <div className="flex items-center gap-1">
            {value && <button type="button" onClick={() => onPick(null)} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Subtitles off</button>}
            <button type="button" onClick={onClose} className="p-2" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0"><LanguagePicker value={value} onChange={(l) => onPick(l)} /></div>
      </div>
    </div>
  );
}

/** Uploaded video with AI subtitles in any language (Gemini transcribes + translates to WebVTT; cached). */
export function TranslatableVideo({ src, title, className = '' }: { src: string; title?: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Language | null>(null);
  const [track, setTrack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => () => { if (track) URL.revokeObjectURL(track); }, [track]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !track) return;
    const t = setTimeout(() => { for (const tt of Array.from(v.textTracks)) tt.mode = 'showing'; }, 50);
    return () => clearTimeout(t);
  }, [track]);

  const load = async (l: Language | null) => {
    setOpen(false); setErr(null);
    if (!l) { setLang(null); setTrack(null); return; }
    setLang(l); setBusy(true);
    const key = videoKey(src);
    const lsKey = `diy_vtt_${key}_${l.code}`;
    try {
      let vtt: string | null = null;
      try { vtt = localStorage.getItem(lsKey); } catch { /* ignore */ }
      if (!vtt && isFirebaseConfigured) {
        try { const snap = await getDoc(doc(db, 'videoCaptions', `${key}_${l.code}`)); if (snap.exists()) vtt = String(snap.data().vtt || ''); } catch { /* not cached */ }
      }
      if (!vtt) {
        const r = await fetch('/api/video-captions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: src, lang: l.code, langName: l.name }) });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.vtt) throw new Error(data?.error || 'Could not make subtitles right now.');
        vtt = data.vtt as string;
        const uid = auth.currentUser?.uid;
        if (uid && isFirebaseConfigured) {
          setDoc(doc(db, 'videoCaptions', `${key}_${l.code}`), { videoKey: key, lang: l.code, vtt: vtt.slice(0, 300000), createdBy: uid, createdAt: serverTimestamp() }).catch(() => undefined);
        }
      }
      try { localStorage.setItem(lsKey, vtt); } catch { /* full */ }
      setTrack(URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })));
    } catch (e: any) {
      setErr(e?.message || 'Could not make subtitles right now.');
      setLang(null);
    } finally { setBusy(false); }
  };

  return (
    <div className={`relative ${className}`}>
      <video ref={videoRef} src={src} controls preload="metadata" playsInline className="w-full h-full object-contain bg-black" aria-label={title}>
        {track && lang && <track key={track} kind="subtitles" src={track} srcLang={lang.code} label={lang.name} default />}
      </video>
      <button type="button" onClick={() => setOpen(true)} className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/65 hover:bg-black/80 text-white text-[11px] font-semibold backdrop-blur">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />} {busy ? 'Making subtitles…' : lang ? lang.native : 'Translate'}
      </button>
      {err && <p className="absolute bottom-12 left-2 right-2 text-[11px] text-white bg-rose-600/90 rounded-lg px-2 py-1">{err}</p>}
      {open && <LangSheet title="Subtitles language" value={lang?.code || ''} onPick={load} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** YouTube embed URL with captions on, auto-translated to `lang` where YouTube offers it. */
export function youtubeWithCaptions(url: string, lang: string) {
  const base = lang.split('-')[0] === 'zh' ? lang : lang.split('-')[0];
  return `${url}${url.includes('?') ? '&' : '?'}cc_load_policy=1&cc_lang_pref=${encodeURIComponent(base)}&hl=${encodeURIComponent(base)}`;
}

/** Small language button for linked (YouTube) videos. */
export function YouTubeCaptionPicker({ lang, onChange }: { lang: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/65 hover:bg-black/80 text-white text-[11px] font-semibold">
        <Languages className="w-3.5 h-3.5" /> {lang ? `Captions: ${lang}` : 'Translate'}
      </button>
      {open && <LangSheet title="Caption language (YouTube)" value={lang} onPick={(l) => { onChange(l ? l.code : ''); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

export const defaultCaptionLanguage = () => deviceLanguage().code;
