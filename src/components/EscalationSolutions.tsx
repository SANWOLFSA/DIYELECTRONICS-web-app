import { Bot, ArrowDown, CheckCircle2 } from 'lucide-react';
import { RouteLink } from '../hooks/usePathname';
import { askAiUrl, stageTitle, type EscalationStage } from '../lib/escalation';

/**
 * Renders fixes in the escalation format: Solution A -> If A didn't work: Solution B ->
 * If B didn't work: Solution C -> Still not fixed? Ask the AI technician (button opens the AI chat
 * with the problem already typed in).
 */
export default function EscalationSolutions({ stages, askPrompt, meterHint }: {
  stages: EscalationStage[];
  /** Text typed into the AI chat by the "Ask AI" button. */
  askPrompt: string;
  /** Optional badge test for steps that need a multimeter. */
  meterHint?: RegExp;
}) {
  return (
    <div className="space-y-3">
      {stages.map((st, si) => (
        <div key={st.label}>
          {si > 0 && <div className="flex justify-center -mt-1 mb-2" aria-hidden><ArrowDown className="w-4 h-4 text-stone-400" /></div>}
          <section className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 sm:p-5 space-y-3" aria-label={stageTitle(st.label)}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 shrink-0 rounded-xl text-white font-extrabold flex items-center justify-center ${st.label === 'A' ? 'bg-emerald-600' : st.label === 'B' ? 'bg-amber-500' : 'bg-rose-600'}`}>{st.label}</span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">{stageTitle(st.label)}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">{si === 0 ? 'Easiest and most likely fix. Try this first. ' : ''}Target: {st.heading}</p>
              </div>
            </div>
            <ol className="space-y-2.5">
              {st.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  <span className="w-6 h-6 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>
                    <strong className="block text-stone-900 dark:text-stone-100">{step.title}</strong>
                    {step.detail}
                    {meterHint?.test(step.detail) && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">Meter</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ))}
      <div className="flex justify-center -mt-1" aria-hidden><ArrowDown className="w-4 h-4 text-stone-400" /></div>
      <section className="rounded-2xl border border-cobalt-200 dark:border-cobalt-500/30 bg-cobalt-50 dark:bg-cobalt-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-cobalt-600" /> Still not fixed? Ask the AI technician</h3>
          <p className="text-xs text-stone-600 dark:text-stone-300">Tell it what happened at each step (or send a photo) and it will guide you, or tell you when a professional repair is the safer choice.</p>
        </div>
        <RouteLink to={askAiUrl(askPrompt)} className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white text-xs font-bold">
          <Bot className="w-4 h-4" /> Ask AI
        </RouteLink>
      </section>
    </div>
  );
}
