import type { ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, ShieldAlert, CircuitBoard, ListOrdered, Target, FlaskConical, Pin, Link2 } from 'lucide-react';
import { RouteLink } from '../../hooks/usePathname';
import { COMPONENT_BY_ID, METER_COMPONENTS, MODE_BY_ID } from '../../data/meter';
import ComponentSymbol from './ComponentSymbol';
import ProbeGuidePanel from './ProbeGuidePanel';

function Box({ icon, title, children, tone = 'plain' }: { icon: ReactNode; title: string; children: ReactNode; tone?: 'plain' | 'good' | 'bad' | 'danger' }) {
  const tones = {
    plain: 'border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80',
    good: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30',
    bad: 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30',
    danger: 'border-red-300 dark:border-red-900 bg-red-50/80 dark:bg-red-950/30',
  };
  return <section className={`rounded-2xl border p-4 space-y-2 ${tones[tone]}`}><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">{icon}{title}</h3>{children}</section>;
}

export default function ComponentDetail({ id }: { id: string }) {
  const c = COMPONENT_BY_ID[id];
  if (!c) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-slate-500">No test guide for “{id}”.</p>
        <RouteLink to="/multimeter/test" className="text-sm font-bold text-emerald-600 hover:underline">Browse all components</RouteLink>
      </div>
    );
  }
  const idx = METER_COMPONENTS.indexOf(c);
  const prev = METER_COMPONENTS[idx - 1], next = METER_COMPONENTS[idx + 1];
  const copyLink = () => { navigator.clipboard?.writeText(window.location.origin + `/multimeter/test/${c.id}`).catch(() => undefined); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <RouteLink to="/multimeter/test" className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />All components</RouteLink>
        <button onClick={copyLink} className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />Copy link</button>
      </div>

      <header className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
        <div className="shrink-0 w-full sm:w-44 h-24 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center"><ComponentSymbol symbol={c.symbol} className="w-40 h-20" /></div>
        <div className="space-y-2 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{c.category}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">How to test: {c.name}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{c.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {c.modes.map((m) => <span key={m} className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">{MODE_BY_ID[m].dial.trim()} · {MODE_BY_ID[m].label}</span>)}
            <RouteLink to={`/multimeter/practice/${c.id}`} className="px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 text-white text-[11px] font-bold flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" />Practise this test</RouteLink>
          </div>
        </div>
      </header>

      <ProbeGuidePanel c={c} />

      {c.safety.length > 0 && (
        <Box icon={<ShieldAlert className="w-4 h-4 text-red-500" />} title="Safety first" tone={c.danger ? 'danger' : 'bad'}>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-800 dark:text-slate-200">{c.safety.map((s) => <li key={s}>{s}</li>)}</ul>
        </Box>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Box icon={<ListOrdered className="w-4 h-4 text-indigo-500" />} title="Step by step">
            <ol className="space-y-2">
              {c.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span><span>{s}</span>
                </li>
              ))}
            </ol>
          </Box>
          <div className="grid sm:grid-cols-2 gap-4">
            <Box icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} title="Expected (good part)" tone="good">
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-800 dark:text-slate-200">{c.expected.map((s) => <li key={s}>{s}</li>)}</ul>
            </Box>
            <Box icon={<XCircle className="w-4 h-4 text-amber-600" />} title="Failure signs (bad part)" tone="bad">
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-800 dark:text-slate-200">{c.failureSigns.map((s) => <li key={s}>{s}</li>)}</ul>
            </Box>
          </div>
        </div>
        <div className="space-y-4">
          <Box icon={<Pin className="w-4 h-4 text-violet-500" />} title="Pinout">
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">{c.pinout.map((s) => <li key={s}>{s}</li>)}</ul>
          </Box>
          <Box icon={<Target className="w-4 h-4 text-red-500" />} title="Probe placement">
            <p className="text-xs text-slate-700 dark:text-slate-300">{c.probes}</p>
          </Box>
          <Box icon={<CircuitBoard className="w-4 h-4 text-teal-500" />} title="In-circuit vs out-of-circuit">
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{c.inCircuit}</p>
          </Box>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs font-bold">
        {prev ? <RouteLink to={`/multimeter/test/${prev.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[45%]">← {prev.name}</RouteLink> : <span />}
        {next ? <RouteLink to={`/multimeter/test/${next.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[45%] text-right">{next.name} →</RouteLink> : <span />}
      </div>
      <p className="text-[11px] text-slate-400">Typical values are standard reference figures. Always prefer the part's datasheet, the service manual, or a known-good part for comparison.</p>
    </div>
  );
}
