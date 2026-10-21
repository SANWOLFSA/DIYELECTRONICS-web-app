import { useEffect } from 'react';
import { ScrollText, ShieldAlert } from 'lucide-react';
import { TERMS_PLAIN_SUMMARY, TERMS_SECTIONS, TERMS_UPDATED, TERMS_VERSION } from '../config/terms';
import { OWNERSHIP_AGREEMENT_NOTICE } from '../lib/ownershipAgreement';

/** Terms of Use (/terms). Public: guests can read it before signing up. */
export default function TermsView() {
  // Deep links like /terms#privacy jump to the section.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, []);
  return (
    <div className="ds-page max-w-3xl mx-auto space-y-5">
      <header className="flex items-center gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
        <span className="w-12 h-12 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center"><ScrollText className="w-6 h-6" /></span>
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Terms of Use</h1>
          <p className="text-xs text-stone-500">Last updated {TERMS_UPDATED} · version {TERMS_VERSION}</p>
        </div>
      </header>

      <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5 text-amber-950 dark:text-amber-50">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide"><ShieldAlert className="w-5 h-5" /> In plain words</h2>
        <ul className="mt-2 space-y-1.5 list-disc pl-5 text-sm font-bold leading-relaxed">
          {TERMS_PLAIN_SUMMARY.map((l) => <li key={l}>{l}</li>)}
          <li>{OWNERSHIP_AGREEMENT_NOTICE}</li>
        </ul>
        <p className="mt-2 text-xs">This summary is for convenience; the full numbered sections below are the binding terms.</p>
      </div>

      <nav aria-label="Sections" className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {TERMS_SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); window.history.replaceState(window.history.state, '', `#${s.id}`); }} className="text-cobalt-700 dark:text-cobalt-300 hover:underline">{s.n}. {s.title}</a></li>
          ))}
        </ol>
      </nav>

      {TERMS_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 space-y-2">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">{s.n}. {s.title}</h2>
          {s.body.map((p, i) => <p key={i} className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{p}</p>)}
          {s.bullets && <ul className="list-disc pl-5 space-y-1 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </section>
      ))}
    </div>
  );
}
