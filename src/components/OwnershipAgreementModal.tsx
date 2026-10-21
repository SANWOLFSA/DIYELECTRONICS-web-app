import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ShieldAlert, Lock, X } from 'lucide-react';
import {
  OWNERSHIP_AGREEMENT_CHECKBOX, OWNERSHIP_AGREEMENT_CLAUSES, OWNERSHIP_AGREEMENT_NOTICE, OWNERSHIP_AGREEMENT_INTRO, OWNERSHIP_AGREEMENT_TITLE,
  OWNERSHIP_UPLOAD_CHECKBOX, acceptOwnershipAgreement, hasAcceptedOwnership, isOwnershipSensitive, useOwnershipAccepted,
} from '../lib/ownershipAgreement';

export type OwnershipMode = 'view' | 'upload' | 'ai';

/** The agreement itself: five clauses, the not-accountable notice, a checkbox (two for uploads) and "Agree & Continue". */
export function OwnershipAgreementModal({ mode = 'view', onAgree, onCancel }: { mode?: OwnershipMode; onAgree: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState(false);
  const [uploadChecked, setUploadChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = checked && (mode !== 'upload' || uploadChecked);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const agree = async () => {
    if (!ok || busy) return;
    setBusy(true);
    await acceptOwnershipAgreement();
    setBusy(false);
    onAgree();
  };
  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ownership-title" onClick={onCancel}>
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-2xl text-slate-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCancel} className="absolute top-3 right-3 p-2 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3 mb-3 pr-8">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-amber-500 text-white flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></span>
          <h2 id="ownership-title" className="text-lg font-extrabold leading-tight">{OWNERSHIP_AGREEMENT_TITLE}</h2>
        </div>
        <p className="text-sm font-semibold">{OWNERSHIP_AGREEMENT_INTRO}</p>
        <ol className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300 list-decimal pl-5">
          {OWNERSHIP_AGREEMENT_CLAUSES.map((c, i) => <li key={i} className="leading-relaxed">{c}</li>)}
        </ol>
        <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">{OWNERSHIP_AGREEMENT_NOTICE}</p>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-5 h-5 accent-cobalt-600 shrink-0" />
          <span className="text-sm font-semibold">{OWNERSHIP_AGREEMENT_CHECKBOX} <span className="font-normal text-slate-500 dark:text-slate-400">(including the <a href="/terms" target="_blank" rel="noopener" className="underline font-semibold">Terms of Use</a>)</span></span>
        </label>
        {mode === 'upload' && (
          <label className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
            <input type="checkbox" checked={uploadChecked} onChange={(e) => setUploadChecked(e.target.checked)} className="mt-0.5 w-5 h-5 accent-cobalt-600 shrink-0" />
            <span className="text-sm font-semibold">{OWNERSHIP_UPLOAD_CHECKBOX}</span>
          </label>
        )}
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">This agreement is part of our <a href="/terms" target="_blank" rel="noopener" className="underline font-semibold">Terms of Use</a>.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
          <button type="button" onClick={agree} disabled={!ok || busy} className="flex-1 py-2.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white text-sm font-bold disabled:opacity-40">Agree &amp; Continue</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based gate: `const ok = await gate('upload')`. View / AI requests resolve at once when the
 * agreement was already accepted; uploads always ask (the uploader confirms each sensitive upload).
 * Render `modal` somewhere in the component.
 */
export function useOwnershipGate() {
  const [req, setReq] = useState<{ mode: OwnershipMode } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const gate = useCallback((mode: OwnershipMode = 'view') => {
    if (mode !== 'upload' && hasAcceptedOwnership()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; setReq({ mode }); });
  }, []);
  const finish = (ok: boolean) => { resolver.current?.(ok); resolver.current = null; setReq(null); };
  const modal = req ? <OwnershipAgreementModal mode={req.mode} onAgree={() => finish(true)} onCancel={() => finish(false)} /> : null;
  return { gate, modal };
}

/** Hides FRP / unlock content until the viewer has accepted the agreement. */
export function OwnershipGuard({ texts, children, compact = false }: { texts: (string | undefined | null)[]; children: ReactNode; compact?: boolean }) {
  const accepted = useOwnershipAccepted();
  const [open, setOpen] = useState(false);
  if (accepted || !isOwnershipSensitive(...texts)) return <>{children}</>;
  return (
    <>
      <div className={`w-full ${compact ? 'aspect-video' : 'py-10'} rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center gap-2 text-center px-4`}>
        <Lock className="w-6 h-6 text-amber-400" />
        <p className="text-sm font-bold">FRP / unlock content</p>
        <p className="text-xs text-white/75 max-w-xs">Accept the Ownership Agreement to watch or read this. It is only for devices you own or are allowed to repair.</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-1 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">Read &amp; accept</button>
      </div>
      {open && <OwnershipAgreementModal onAgree={() => setOpen(false)} onCancel={() => setOpen(false)} />}
    </>
  );
}
