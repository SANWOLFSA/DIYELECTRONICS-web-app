import { useEffect, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, ShieldAlert, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { PROBE_GUIDES } from '../../data/meter/probeGuides';
import { MODE_BY_ID } from '../../data/meter/modes';
import type { MeterComponent } from '../../data/meter/types';
import MeterFace from './MeterFace';
import ProbeDiagram from './ProbeDiagram';

/** "See it": the meter dial set to the right position + the part with the probes on the right pins, step by step. */
export default function ProbeGuidePanel({ c }: { c: MeterComponent }) {
  const guide = PROBE_GUIDES[c.id];
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const steps = guide?.steps || [];
  useEffect(() => { setI(0); setPlaying(true); }, [c.id]);
  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % steps.length), 5000);
    return () => clearTimeout(t);
  }, [playing, i, steps.length]);
  if (!guide || !steps.length) return null;
  const step = steps[Math.min(i, steps.length - 1)];
  const mode = MODE_BY_ID[step.mode];

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">See it: dial setting &amp; probe placement</h3>
        {steps.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setPlaying(false); setI((i - 1 + steps.length) % steps.length); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Previous step"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-bold tabular-nums text-slate-500">{i + 1}/{steps.length}</span>
            <button type="button" onClick={() => { setPlaying(false); setI((i + 1) % steps.length); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Next step"><ChevronRight className="w-4 h-4" /></button>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
          </div>
        )}
      </div>

      {/* Step 0: safety */}
      <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${step.powered ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-900' : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900'}`}>
        {step.powered ? <Zap className="w-4 h-4 shrink-0 mt-0.5" /> : <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />}
        <span>{step.powered
          ? 'This measurement is done WITH power on. Keep fingers behind the probe guards, black probe on ground first, and never switch the dial while the probes are connected.'
          : `Power OFF and unplug first.${guide.discharge ? ' This part sits near high-voltage capacitors: discharge them with a 1–2 kΩ 5 W resistor (or a bulb) and confirm 0 V on DCV before touching.' : ' Discharge any large capacitors (check 0 V on DCV) before measuring resistance, continuity or diodes.'}`}</span>
      </p>

      <div className="grid sm:grid-cols-[minmax(0,200px)_1fr] gap-3 items-start">
        <div className="flex flex-col items-center">
          <MeterFace mode={step.mode} red={mode.redJack} black="com" digits={step.lcd[0]} unit={step.lcd[1]} beep={step.mode === 'cont' && step.lcd[0] !== 'OL'} onMode={() => undefined} onJack={() => undefined} placing="red" className="max-w-[200px] pointer-events-none" />
          <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center">Dial: {mode.dial.trim()} · {mode.label}</p>
          <p className="text-[11px] text-slate-500 text-center">Red lead in {mode.redJack === 'vohm' ? 'VΩ' : mode.redJack === 'a10' ? '10A' : 'mA'}, black in COM</p>
        </div>
        <div className="space-y-2 min-w-0">
          <ProbeDiagram guide={guide} step={step} stepKey={`${c.id}-${i}`} />
          <ol className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">{guide.pins.map((p, pi) => <li key={pi}><span className="font-bold">{pi + 1}</span> {p}</li>)}</ol>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.caption}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <p className="flex gap-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-2.5 py-2"><CheckCircle2 className="w-4 h-4 shrink-0" /><span><b>Good:</b> {step.good}</span></p>
            {step.bad && <p className="flex gap-1.5 text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2.5 py-2"><XCircle className="w-4 h-4 shrink-0" /><span><b>Bad:</b> {step.bad}</span></p>}
          </div>
        </div>
      </div>
    </section>
  );
}
