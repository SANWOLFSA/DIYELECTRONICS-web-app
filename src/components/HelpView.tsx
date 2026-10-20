import { useEffect, useRef, useState } from 'react';
import { HelpCircle, BookOpen, MessageSquare, Mail, ChevronDown, Bot, Send, Loader2, Search } from 'lucide-react';
import Markdown from 'react-markdown';
import { SUPPORT_EMAIL } from '../lib/brand';
import { HELP_TOPICS } from '../data/helpContent';
import { streamChat, prewarmAi } from '../lib/aiStream';

type Turn = { role: 'user' | 'model'; text: string };

/** AI Help Assistant: answers "how do I…" questions about the app, grounded in the help guide (server side). */
function HelpAssistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { prewarmAi(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, busy]);
  const ask = async (q: string) => {
    const message = q.trim();
    if (!message || busy) return;
    setErr(null); setInput('');
    const history = turns.slice(-6);
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setBusy(true);
    let started = false;
    try {
      await streamChat({ message, history, mode: 'help', lookupBoards: false }, (full) => {
        if (!started) { started = true; setTurns((t) => [...t, { role: 'model', text: full }]); }
        else setTurns((t) => { const c = [...t]; c[c.length - 1] = { role: 'model', text: full }; return c; });
      });
    } catch {
      setErr('The help assistant is busy right now. The guides below cover every feature.');
    } finally { setBusy(false); }
  };
  const examples = ['How do I report a seller?', 'How do I translate a video?', 'How do I map a circuit from a photo?', 'Where is my exam score saved?'];
  return (
    <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl bg-cobalt-600 text-white flex items-center justify-center"><Bot className="w-5 h-5" /></span>
        <div><h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Ask the Help Assistant</h2><p className="text-[11px] text-stone-500">AI answers about how to use the app</p></div>
      </div>
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((e) => <button key={e} type="button" onClick={() => ask(e)} className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-200 hover:bg-cobalt-50 dark:hover:bg-cobalt-500/15">{e}</button>)}
        </div>
      )}
      {turns.length > 0 && (
        <div className="max-h-[24rem] overflow-y-auto space-y-2.5 pr-1">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${t.role === 'user' ? 'bg-cobalt-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-1'}`}>
                {t.role === 'user' ? t.text : <Markdown>{t.text}</Markdown>}
              </div>
            </div>
          ))}
          {busy && turns[turns.length - 1]?.role === 'user' && <div className="flex gap-1.5 pl-1" aria-label="Typing"><span className="w-1.5 h-1.5 rounded-full bg-cobalt-500 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-cobalt-500 animate-bounce [animation-delay:120ms]" /><span className="w-1.5 h-1.5 rounded-full bg-cobalt-500 animate-bounce [animation-delay:240ms]" /></div>}
          <div ref={endRef} />
        </div>
      )}
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="How do I…?" className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-cobalt-500" aria-label="Question for the help assistant" />
        <button type="submit" disabled={busy || !input.trim()} className="shrink-0 w-11 rounded-xl bg-cobalt-600 text-white flex items-center justify-center disabled:opacity-40" aria-label="Ask">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
      </form>
    </section>
  );
}

export default function HelpView({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const topics = s ? HELP_TOPICS.filter((t) => `${t.title} ${t.steps.join(' ')}`.toLowerCase().includes(s)) : HELP_TOPICS;
  return (
    <div className="ds-page space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 pb-5 border-b border-stone-200 dark:border-stone-800">
        <div className="w-12 h-12 rounded-2xl bg-cobalt-600 text-white flex items-center justify-center font-bold shadow-lg"><HelpCircle className="w-6 h-6" /></div>
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Help &amp; how-to</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">Step-by-step help for every feature, plus an AI assistant for anything else</p>
        </div>
      </div>

      <HelpAssistant />

      <section className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help (e.g. report, review, video, exam)" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-cobalt-500" aria-label="Search help" />
        </div>
        {topics.length === 0 && <p className="text-sm text-stone-500 p-4 text-center">No help topic matches “{q}”. Try asking the Help Assistant above.</p>}
        {topics.map((t) => {
          const isOpen = open === t.id || !!s;
          return (
            <div key={t.id} id={`help-${t.id}`} className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
              <button type="button" onClick={() => setOpen(isOpen && !s ? null : t.id)} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t.title}</span>
                <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ol className="px-4 pb-4 space-y-2">
                  {t.steps.map((st, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-cobalt-100 dark:bg-cobalt-500/20 text-cobalt-700 dark:text-cobalt-200 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span><span>{st}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button type="button" onClick={() => onNavigate?.('guides')} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 text-left hover:border-cobalt-400">
          <BookOpen className="w-5 h-5 text-amber-500" /><h3 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">Repair guides</h3><p className="text-xs text-stone-500">Step-by-step repairs and teardowns.</p>
        </button>
        <button type="button" onClick={() => onNavigate?.('home')} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 text-left hover:border-cobalt-400">
          <MessageSquare className="w-5 h-5 text-amber-500" /><h3 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">Community</h3><p className="text-xs text-stone-500">Ask other repairers, or just chat.</p>
        </button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 text-left hover:border-cobalt-400 block">
          <Mail className="w-5 h-5 text-amber-500" /><h3 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">Contact support</h3><p className="text-xs text-stone-500 break-all">{SUPPORT_EMAIL}</p>
        </a>
      </div>
    </div>
  );
}
