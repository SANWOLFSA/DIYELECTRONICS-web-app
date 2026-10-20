import { useState } from 'react';
import { Heart, Server, Bot, ExternalLink, Gift } from 'lucide-react';
import { DONATION_PRESETS_USD, PAYPAL_DONATE_URL, donateUrl } from '../config/support';
import { logAppEvent } from '../lib/analytics';

/** Optional donations page. No popups, no paywall: every feature stays free. */
export default function SupportView() {
  const [custom, setCustom] = useState('');
  const customAmount = Number(custom.replace(',', '.'));
  const enabled = Boolean(PAYPAL_DONATE_URL);
  const open = (amount?: number) => {
    const url = donateUrl(amount);
    if (!url) return;
    logAppEvent('donate_click', { amount: amount || 0 });
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="ds-page max-w-2xl mx-auto space-y-5">
      <section className="ds-hero rounded-2xl px-5 py-6 sm:px-8 sm:py-8 text-white">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-slate-200"><Heart className="w-3.5 h-3.5 text-rose-300" /> Optional</span>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">Support the app</h1>
        <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">DIY Electronics is free for everyone and it will stay that way. Every guide, the AI assistant, the theory book and the exams are free to use. If the app has helped you fix something or pass an exam, you can chip in to keep it running. It is entirely your choice.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Where donations go</h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-2"><Bot className="w-4 h-4 text-cobalt-500 shrink-0 mt-0.5" /> AI costs: the repair assistant, circuit maps and tutor run on Google Gemini.</li>
          <li className="flex gap-2"><Server className="w-4 h-4 text-cobalt-500 shrink-0 mt-0.5" /> Hosting, storage for photos and videos, and the database.</li>
          <li className="flex gap-2"><Gift className="w-4 h-4 text-cobalt-500 shrink-0 mt-0.5" /> New guides, chapters and features.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Donate with PayPal</h2>
        {enabled ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {DONATION_PRESETS_USD.map(a => (
                <button key={a} type="button" onClick={() => open(a)} className="rounded-xl border border-slate-200 dark:border-slate-700 py-3 text-lg font-semibold text-slate-900 dark:text-white hover:border-cobalt-500 hover:bg-cobalt-50 dark:hover:bg-cobalt-500/10 transition-colors">${a}</button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (customAmount > 0) open(customAmount); }}>
              <label htmlFor="donate-custom" className="sr-only">Custom amount in US dollars</label>
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input id="donate-custom" inputMode="decimal" value={custom} onChange={e => setCustom(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Other amount" className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[16px] focus:outline-none focus:ring-2 focus:ring-cobalt-500" />
              </div>
              <button type="submit" disabled={!(customAmount > 0)} className="ds-btn-primary px-4 py-2.5 text-sm disabled:opacity-40">Donate</button>
            </form>
            <button type="button" onClick={() => open()} className="text-xs text-slate-500 hover:text-cobalt-600 inline-flex items-center gap-1">Or choose any amount / currency on PayPal <ExternalLink className="w-3 h-3" /></button>
            <p className="text-[11px] text-slate-400">Opens PayPal in a new tab; payment goes directly to the app owner. Amounts are in US dollars and PayPal converts from your currency.</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Donations are not set up yet. Thank you for thinking of it!</p>
        )}
      </section>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400"><Heart className="inline w-4 h-4 text-rose-500 -mt-0.5" /> Thank you. Whether you donate or not, we are glad you are here. Happy fixing!</p>
    </div>
  );
}
