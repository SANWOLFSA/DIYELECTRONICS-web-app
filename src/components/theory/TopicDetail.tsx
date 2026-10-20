import { aiFetch } from '../../lib/aiFetch';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { ArrowLeft, Bot, Lightbulb, Sigma, AlertTriangle, Link2, Send, Loader2, Share2, Check, Timer, X, ListChecks } from 'lucide-react';
import { subjectLabel, THEORY_SUBJECTS } from '../../data/theory';
import type { TheoryTopic } from '../../data/theory';
import { LevelPills } from './LevelPills';

type ChatTurn = { role: 'user' | 'model'; text: string };

const TUTOR_PROMPTS = [
  'Explain this more simply, like I’m new to it',
  'Give me another worked example with different numbers',
  'Quiz me with 3 short questions on this topic',
  'How is this used in real equipment or repairs?',
];

function tutorInstruction(topic: TheoryTopic) {
  return [
    'You are a friendly, precise electrical and electronics engineering tutor inside the DIY Electronics study app.',
    `The student is studying the topic "${topic.title}" (${subjectLabel(topic.subject)}; levels: ${topic.levels.join(', ')}).`,
    `Topic summary: ${topic.summary}`,
    `Key formulas: ${topic.formulas.map(f => f.expr).join(' ; ')}`,
    'Teach step by step, show units in every calculation, use SI units and South African conventions where relevant (230/400 V, 50 Hz, SANS 10142-1).',
    'Keep answers focused and under about 250 words unless asked for more. Use short Markdown headings, bullet points and inline formulas.',
    'If a question involves working on live mains, remind the student about safe isolation and that installation work needs a registered person.',
    'If you are not sure of a fact, say so rather than guessing.',
  ].join('\n');
}

function AiTutor({ topic, onClose }: { topic: TheoryTopic; onClose: () => void }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, busy]);

  const ask = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setErr(null);
    const history = turns.slice(-8);
    setTurns(t => [...t, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);
    try {
      const res = await aiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, systemInstruction: tutorInstruction(topic) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = typeof data?.reply === 'string' && data.reply.trim() ? data.reply : 'Sorry — I could not come up with an answer just now.';
      setTurns(t => [...t, { role: 'model', text: reply }]);
    } catch {
      setErr('The AI tutor is unavailable right now. Please try again in a moment.');
      setTurns(t => t.slice(0, -1));
      setInput(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-500/10 dark:to-slate-900 p-4 space-y-3 shadow-sm" aria-label="AI tutor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center"><Bot className="w-4 h-4" /></span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">AI tutor</p>
            <p className="text-[11px] text-slate-500">Ask anything about {topic.title}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close tutor"><X className="w-4 h-4" /></button>
      </div>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {TUTOR_PROMPTS.map(p => (
            <button key={p} onClick={() => ask(p)} disabled={busy} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-left">
              {p}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="max-h-[26rem] overflow-y-auto space-y-2.5 pr-1">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                t.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
              }`}>
                {t.role === 'user' ? t.text : (
                  <div className="space-y-2 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:px-1 [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-700">
                    <Markdown>{t.text}</Markdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tutor is thinking…</div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {err && <p className="text-xs text-rose-600 dark:text-rose-300">{err}</p>}

      <form onSubmit={e => { e.preventDefault(); ask(input); }} className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your question…"
          className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          aria-label="Question for the AI tutor"
        />
        <button type="submit" disabled={busy || !input.trim()} className="px-3.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40" aria-label="Send">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
      <p className="text-[10px] text-slate-400">AI answers can be wrong — check important values against the worked material and your syllabus.</p>
    </section>
  );
}

export default function TopicDetail({
  topic,
  allTopics,
  onBack,
  onOpenTopic,
  onStartExam,
  primaryClass,
}: {
  topic: TheoryTopic;
  allTopics: TheoryTopic[];
  onBack: () => void;
  onOpenTopic: (id: string) => void;
  onStartExam: () => void;
  primaryClass: string;
}) {
  const [tutorOpen, setTutorOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const related = topic.related.map(id => allTopics.find(t => t.id === id)).filter((t): t is TheoryTopic => Boolean(t));
  const subject = THEORY_SUBJECTS.find(s => s.id === topic.subject);

  // Previous / next within the same subject for easy sequential study.
  const siblings = allTopics.filter(t => t.subject === topic.subject);
  const idx = siblings.findIndex(t => t.id === topic.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;

  useEffect(() => {
    setTutorOpen(false);
  }, [topic.id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm';

  return (
    <article className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300">
          <ArrowLeft className="w-4 h-4" /> All topics
        </button>
        <button onClick={share} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />} {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>

      <header className={`${card} space-y-3`}>
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-300">{subject?.emoji} {subject?.label}</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{topic.title}</h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{topic.summary}</p>
        <div className="flex flex-wrap items-center gap-2">
          <LevelPills levels={topic.levels} />
          <button onClick={() => setTutorOpen(o => !o)} className={`${primaryClass} ml-auto text-white px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-500/20`}>
            <Bot className="w-4 h-4" /> Ask AI tutor
          </button>
        </div>
      </header>

      {tutorOpen && <AiTutor topic={topic} onClose={() => setTutorOpen(false)} />}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <section className={card}>
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Explanation</h2>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {topic.explanation.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>

          <section className={card}>
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3"><ListChecks className="w-4 h-4 text-indigo-500" /> Worked example</h2>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{topic.example.problem}</p>
            <ol className="mt-3 space-y-2">
              {topic.example.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="font-mono text-[13px] leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/30 text-sm font-bold text-emerald-800 dark:text-emerald-200">Answer: {topic.example.answer}</p>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <section className={card}>
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3"><Sigma className="w-4 h-4 text-violet-500" /> Key formulas</h2>
            <ul className="space-y-2">
              {topic.formulas.map((f, i) => (
                <li key={i} className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3 py-2">
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">{f.expr}</p>
                  {f.desc && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{f.desc}</p>}
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2"><AlertTriangle className="w-4 h-4 text-rose-500" /> Common mistakes</h2>
            <ul className="space-y-1.5">
              {topic.mistakes.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"><span className="text-rose-500 font-bold">✗</span><span>{m}</span></li>
              ))}
            </ul>
          </section>

          {related.length > 0 && (
            <section className={card}>
              <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-2"><Link2 className="w-4 h-4 text-emerald-500" /> Related topics</h2>
              <div className="flex flex-wrap gap-1.5">
                {related.map(r => (
                  <button key={r.id} onClick={() => onOpenTopic(r.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200">
                    {r.title}
                  </button>
                ))}
              </div>
            </section>
          )}

          <button onClick={onStartExam} className="w-full rounded-2xl border border-emerald-200 dark:border-emerald-400/30 bg-emerald-50 dark:bg-emerald-400/10 p-3.5 text-left flex items-center gap-3 hover:shadow-md transition-shadow">
            <Timer className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">Practise {subjectLabel(topic.subject)}</span>
              <span className="block text-[11px] text-slate-500">Open the Exam Room</span>
            </span>
          </button>
        </div>
      </div>

      <nav className="flex justify-between gap-2" aria-label="Topic navigation">
        {prev ? (
          <button onClick={() => onOpenTopic(prev.id)} className="flex-1 sm:flex-none text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            <span className="block text-slate-400">← Previous</span><span className="font-bold text-slate-800 dark:text-slate-100">{prev.title}</span>
          </button>
        ) : <span />}
        {next ? (
          <button onClick={() => onOpenTopic(next.id)} className="flex-1 sm:flex-none text-right px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            <span className="block text-slate-400">Next →</span><span className="font-bold text-slate-800 dark:text-slate-100">{next.title}</span>
          </button>
        ) : <span />}
      </nav>
    </article>
  );
}
