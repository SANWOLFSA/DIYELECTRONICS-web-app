import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Timer, Infinity as InfinityIcon, Play, Loader2, Sparkles, Trophy, ChevronLeft, ChevronRight, Flag, CheckCircle2,
  XCircle, RotateCcw, Target, BookOpen, AlertTriangle, Clock,
} from 'lucide-react';
import {
  loadQuestions, loadAllTopics, isNumericAnswerCorrect, sanitizeQuestion, THEORY_LEVELS, THEORY_SUBJECTS, levelLabel, subjectLabel,
} from '../../data/theory';
import type { TheoryLevel, TheoryQuestion, TheorySubjectId, TheoryTopic } from '../../data/theory';
import { readBestScores, recordScore, syncBestScoresFromCloud } from '../../lib/theoryProgress';
import type { TheoryBestScore } from '../../lib/theoryProgress';

const COUNTS = [5, 10, 20, 30, 50];
const SECONDS_PER_QUESTION = 90;

type Phase = 'setup' | 'running' | 'results';
type Answer = { choice?: number; value?: string };

interface ExamConfig {
  level: TheoryLevel;
  subjects: TheorySubjectId[];
  count: number;
  timed: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreKey(cfg: Pick<ExamConfig, 'level' | 'subjects'>) {
  const subj = cfg.subjects.length ? [...cfg.subjects].sort().join(',') : 'all';
  return `${cfg.level}:${subj}`;
}

function scoreLabel(cfg: Pick<ExamConfig, 'level' | 'subjects'>) {
  const subj = cfg.subjects.length === 0 || cfg.subjects.length === THEORY_SUBJECTS.length
    ? 'All subjects'
    : cfg.subjects.length <= 2 ? cfg.subjects.map(subjectLabel).join(' + ') : `${cfg.subjects.length} subjects`;
  return `${levelLabel(cfg.level)} · ${subj}`;
}

function isCorrect(q: TheoryQuestion, a?: Answer): boolean {
  if (!a) return false;
  if (q.type === 'mcq') return a.choice === q.answerIndex;
  const v = parseFloat(String(a.value ?? '').replace(',', '.').replace(/\s/g, ''));
  return isNumericAnswerCorrect(v, q.answer, q.tolerance);
}

function isAnswered(q: TheoryQuestion, a?: Answer) {
  if (!a) return false;
  return q.type === 'mcq' ? a.choice !== undefined : String(a.value ?? '').trim() !== '';
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function fmtNum(n: number) {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(4)));
}

export default function ExamRoom({ onStudyTopic, primaryClass, initialSubject }: { onStudyTopic: (topicId: string) => void; primaryClass: string; initialSubject?: TheorySubjectId }) {
  const [phase, setPhase] = useState<Phase>('setup');
  // A chapter quiz from the Theory book opens with that chapter (subject) preselected.
  const [cfg, setCfg] = useState<ExamConfig>({ level: 'college', subjects: initialSubject ? [initialSubject] : [], count: 10, timed: !initialSubject });
  const [bank, setBank] = useState<TheoryQuestion[] | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [aiPool, setAiPool] = useState<TheoryQuestion[]>([]);
  const [aiState, setAiState] = useState<{ busy: boolean; msg?: string; error?: boolean }>({ busy: false });
  const [topics, setTopics] = useState<TheoryTopic[]>([]);
  const [best, setBest] = useState<Record<string, TheoryBestScore>>(() => readBestScores());

  const [exam, setExam] = useState<TheoryQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all');
  const submittedRef = useRef(false);

  useEffect(() => {
    loadAllTopics().then(setTopics).catch(() => undefined);
    syncBestScoresFromCloud().then(setBest).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setBank(null);
    setBankError(null);
    loadQuestions(cfg.level)
      .then(q => alive && setBank(q))
      .catch(() => alive && setBankError('Could not load the question bank. Check your connection and try again.'));
    return () => {
      alive = false;
    };
  }, [cfg.level]);

  const topicTitle = useCallback((id: string) => topics.find(t => t.id === id)?.title ?? id, [topics]);

  const pool = useMemo(() => {
    const all = [...(bank ?? []), ...aiPool.filter(q => q.level === cfg.level)];
    return cfg.subjects.length ? all.filter(q => cfg.subjects.includes(q.subject)) : all;
  }, [bank, aiPool, cfg.level, cfg.subjects]);

  const subjectCounts = useMemo(() => {
    const counts: Partial<Record<TheorySubjectId, number>> = {};
    for (const q of [...(bank ?? []), ...aiPool.filter(q => q.level === cfg.level)]) counts[q.subject] = (counts[q.subject] ?? 0) + 1;
    return counts;
  }, [bank, aiPool, cfg.level]);

  const toggleSubject = (id: TheorySubjectId) =>
    setCfg(c => ({ ...c, subjects: c.subjects.includes(id) ? c.subjects.filter(s => s !== id) : [...c.subjects, id] }));

  const start = () => {
    const n = Math.min(cfg.count, pool.length);
    if (!n) return;
    const picked = shuffle(pool).slice(0, n);
    setExam(picked);
    setAnswers({});
    setFlags({});
    setCurrent(0);
    setSecondsLeft(n * SECONDS_PER_QUESTION);
    setStartedAt(Date.now());
    setNewBest(false);
    setReviewFilter('all');
    submittedRef.current = false;
    setPhase('running');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const correct = exam.filter(q => isCorrect(q, answers[q.id])).length;
    const total = exam.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    setElapsed(Math.round((Date.now() - startedAt) / 1000));
    const improved = recordScore({ key: scoreKey(cfg), label: scoreLabel(cfg), percent, correct, total, timed: cfg.timed, date: new Date().toISOString() });
    setNewBest(improved);
    setBest(readBestScores());
    setPhase('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [exam, answers, startedAt, cfg]);

  // Countdown for timed exams; auto-submits at zero.
  useEffect(() => {
    if (phase !== 'running' || !cfg.timed) return;
    const id = window.setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase, cfg.timed]);

  useEffect(() => {
    if (phase === 'running' && cfg.timed && secondsLeft === 0 && exam.length) submit();
  }, [secondsLeft, phase, cfg.timed, exam.length, submit]);

  const generateWithAi = async () => {
    if (aiState.busy) return;
    setAiState({ busy: true, msg: 'Asking the AI for fresh questions…' });
    const subjects = cfg.subjects.length ? cfg.subjects : THEORY_SUBJECTS.map(s => s.id);
    const topicList = topics
      .filter(t => subjects.includes(t.subject) && t.levels.includes(cfg.level))
      .slice(0, 40)
      .map(t => ({ id: t.id, title: t.title, subject: t.subject }));
    try {
      const res = await fetch('/api/theory/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: cfg.level, subjects, topics: topicList, count: 5 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`);
      const raw: unknown[] = Array.isArray(data?.questions) ? data.questions : [];
      const stamp = Date.now().toString(36);
      const fresh = raw
        .map((r, i) => {
          const rec = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
          const topicId = typeof rec.topicId === 'string' && topicList.some(t => t.id === rec.topicId) ? rec.topicId : topicList[0]?.id ?? 'ohms-law';
          const subject = topics.find(t => t.id === topicId)?.subject ?? subjects[0];
          return sanitizeQuestion(r, { level: cfg.level, subject, topicId }, `ai-${stamp}-${i}`);
        })
        .filter((q): q is TheoryQuestion => Boolean(q));
      if (!fresh.length) throw new Error('The AI did not return usable questions.');
      setAiPool(p => [...p, ...fresh]);
      setAiState({ busy: false, msg: `Added ${fresh.length} AI-generated question${fresh.length === 1 ? '' : 's'} to this session’s pool.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      setAiState({ busy: false, error: true, msg: `Couldn’t generate questions right now (${msg}). The seeded bank still works.` });
    }
  };

  const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm';

  /* ---------------------------- SETUP ---------------------------- */
  if (phase === 'setup') {
    const available = pool.length;
    const bestEntries = Object.values(best).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const currentBest = best[scoreKey(cfg)];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} lg:col-span-2 p-4 sm:p-6 space-y-6`}>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Set up your practice exam</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Multiple-choice and numeric questions with worked solutions after you submit.</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">1 · Level</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {THEORY_LEVELS.map(l => (
                <button key={l.id} onClick={() => setCfg(c => ({ ...c, level: l.id }))}
                  className={`text-left rounded-xl border p-3 transition-all ${cfg.level === l.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-indigo-400/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>
                  <span className="block font-bold text-sm text-slate-900 dark:text-white">{l.label}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{l.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">2 · Subjects <span className="normal-case font-medium">(none selected = all)</span></legend>
            <div className="flex flex-wrap gap-1.5">
              {THEORY_SUBJECTS.map(s => {
                const n = subjectCounts[s.id] ?? 0;
                const on = cfg.subjects.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSubject(s.id)} disabled={!n && !on}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors disabled:opacity-35 ${on ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {s.emoji} {s.label} <span className={on ? 'text-white/80' : 'text-slate-400'}>· {n}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">3 · Number of questions</legend>
              <div className="flex flex-wrap gap-1.5">
                {COUNTS.map(n => (
                  <button key={n} onClick={() => setCfg(c => ({ ...c, count: n }))}
                    className={`w-12 py-2 rounded-xl border text-sm font-bold ${cfg.count === n ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">4 · Mode</legend>
              <div className="flex gap-1.5">
                <button onClick={() => setCfg(c => ({ ...c, timed: true }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-bold ${cfg.timed ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                  <Timer className="w-4 h-4" /> Timed
                </button>
                <button onClick={() => setCfg(c => ({ ...c, timed: false }))} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-bold ${!cfg.timed ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                  <InfinityIcon className="w-4 h-4" /> Untimed
                </button>
              </div>
              {cfg.timed && <p className="text-[11px] text-slate-500 mt-1.5">{SECONDS_PER_QUESTION} s per question · {fmtTime(Math.min(cfg.count, available) * SECONDS_PER_QUESTION)} total</p>}
            </fieldset>
          </div>

          {bankError && <p className="text-sm text-rose-600 dark:text-rose-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {bankError}</p>}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button onClick={start} disabled={!bank || !available}
              className={`${primaryClass} flex-1 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 disabled:opacity-50`}>
              {!bank && !bankError ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start exam · {Math.min(cfg.count, available)} question{Math.min(cfg.count, available) === 1 ? '' : 's'}
            </button>
            <button onClick={generateWithAi} disabled={aiState.busy || !topics.length}
              className="sm:w-auto px-4 py-3 rounded-xl border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50">
              {aiState.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate more with AI
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            {available} question{available === 1 ? '' : 's'} available for this selection{aiPool.length ? ` (incl. ${aiPool.filter(q => q.level === cfg.level).length} AI-generated)` : ''}.
            {cfg.count > available && available > 0 && ' The exam will use all of them.'}
          </p>
          {aiState.msg && <p className={`text-xs ${aiState.error ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{aiState.msg}</p>}
        </div>

        <aside className={`${card} p-4 sm:p-5 space-y-3 h-fit`}>
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Trophy className="w-4 h-4 text-amber-500" /> Best scores</h3>
          {currentBest && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 p-3">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">This selection</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentBest.percent}%</p>
              <p className="text-[11px] text-slate-500">{currentBest.correct}/{currentBest.total} · {new Date(currentBest.date).toLocaleDateString()}</p>
            </div>
          )}
          {bestEntries.length === 0 ? (
            <p className="text-xs text-slate-500">No exams yet. Your best result for each level and subject mix is saved on this device{' '}(and to your account when you’re signed in).</p>
          ) : (
            <ul className="space-y-1.5">
              {bestEntries.map(b => (
                <li key={b.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{b.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{b.percent}%</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    );
  }

  /* ---------------------------- RUNNING ---------------------------- */
  if (phase === 'running') {
    const q = exam[current];
    const a = answers[q.id];
    const answeredCount = exam.filter(x => isAnswered(x, answers[x.id])).length;
    const lowTime = cfg.timed && secondsLeft <= 60;
    const setAnswer = (ans: Answer) => setAnswers(prev => ({ ...prev, [q.id]: ans }));
    return (
      <div className="space-y-3">
        <div className={`${card} p-3 sm:p-4 flex flex-wrap items-center gap-3`}>
          <span className="text-xs font-bold text-slate-500">Question {current + 1} / {exam.length}</span>
          <div className="flex-1 min-w-[8rem] h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all" style={{ width: `${(answeredCount / exam.length) * 100}%` }} />
          </div>
          {cfg.timed ? (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums ${lowTime ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200 animate-pulse' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
              <Clock className="w-4 h-4" /> {fmtTime(secondsLeft)}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><InfinityIcon className="w-4 h-4" /> Untimed</span>
          )}
        </div>

        <div className={`${card} p-4 sm:p-6 space-y-4`}>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{subjectLabel(q.subject)}</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-200">{topicTitle(q.topicId)}</span>
            {q.aiGenerated && <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200">AI</span>}
            <button onClick={() => setFlags(f => ({ ...f, [q.id]: !f[q.id] }))} className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg ${flags[q.id] ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Flag className="w-3.5 h-3.5" /> {flags[q.id] ? 'Flagged' : 'Flag'}
            </button>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">{q.prompt}</p>

          {q.type === 'mcq' ? (
            <div className="grid gap-2" role="radiogroup">
              {q.options.map((opt, i) => {
                const selected = a?.choice === i;
                return (
                  <button key={i} role="radio" aria-checked={selected} onClick={() => setAnswer({ choice: i })}
                    className={`flex items-start gap-3 text-left w-full rounded-xl border p-3 text-sm transition-all ${selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 ring-2 ring-indigo-400/30 text-slate-900 dark:text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-200 dark:hover:border-indigo-500/40'}`}>
                    <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{String.fromCharCode(65 + i)}</span>
                    <span className="pt-0.5">{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  inputMode="decimal"
                  value={a?.value ?? ''}
                  onChange={e => setAnswer({ value: e.target.value })}
                  placeholder="Your answer"
                  className="flex-1 px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  aria-label="Numeric answer"
                />
                {q.unit && <span className="text-sm font-bold text-slate-500 dark:text-slate-300">{q.unit}</span>}
              </div>
              <p className="text-[11px] text-slate-500">Enter a number{q.unit ? ` in ${q.unit}` : ''}. {q.tolerance > 0 ? `Answers within ±${Math.round(q.tolerance * 100)} % are accepted.` : 'Exact value required.'}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {current < exam.length - 1 ? (
              <button onClick={() => setCurrent(c => Math.min(exam.length - 1, c + 1))} className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => { if (answeredCount < exam.length && !window.confirm(`You have ${exam.length - answeredCount} unanswered question(s). Submit anyway?`)) return; submit(); }}
                className={`${primaryClass} text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/25`}>
                Submit exam
              </button>
            )}
          </div>
        </div>

        <div className={`${card} p-3 sm:p-4`}>
          <div className="flex flex-wrap gap-1.5">
            {exam.map((x, i) => {
              const done = isAnswered(x, answers[x.id]);
              return (
                <button key={x.id} onClick={() => setCurrent(i)} aria-label={`Go to question ${i + 1}`}
                  className={`relative w-9 h-9 rounded-lg text-xs font-bold border ${i === current ? 'border-indigo-500 ring-2 ring-indigo-400/40' : 'border-transparent'} ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {i + 1}
                  {flags[x.id] && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">{answeredCount} answered · {Object.values(flags).filter(Boolean).length} flagged</span>
            <button onClick={() => { if (window.confirm('Submit the exam now?')) submit(); }} className="text-xs font-bold text-indigo-600 dark:text-indigo-300">Submit now</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------- RESULTS ---------------------------- */
  const correctCount = exam.filter(q => isCorrect(q, answers[q.id])).length;
  const percent = exam.length ? Math.round((correctCount / exam.length) * 100) : 0;
  const byTopic = new Map<string, { right: number; total: number }>();
  for (const q of exam) {
    const e = byTopic.get(q.topicId) ?? { right: 0, total: 0 };
    e.total += 1;
    if (isCorrect(q, answers[q.id])) e.right += 1;
    byTopic.set(q.topicId, e);
  }
  const topicStats = [...byTopic.entries()].map(([id, s]) => ({ id, ...s, pct: s.right / s.total })).sort((a, b) => a.pct - b.pct || b.total - a.total);
  const weak = topicStats.filter(t => t.pct < 0.7);
  const verdict = percent >= 80 ? 'Excellent work!' : percent >= 60 ? 'Solid — a few gaps to close.' : percent >= 40 ? 'Getting there. Review the weak spots below.' : 'Keep going — study the topics below and try again.';
  const reviewList = exam.map((q, i) => ({ q, i })).filter(({ q }) => reviewFilter === 'all' || !isCorrect(q, answers[q.id]));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 text-white shadow-lg shadow-indigo-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white/15 border-4 border-white/40 flex items-center justify-center shrink-0">
            <span className="flex flex-col items-center leading-none"><span className="text-2xl font-bold">{correctCount}/{exam.length}</span><span className="text-sm font-semibold text-white/85 mt-1">{percent}%</span></span>
          </div>
          <div className="space-y-1">
            {newBest && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-300 text-amber-950 text-[11px] font-bold"><Trophy className="w-3.5 h-3.5" /> New best score</span>}
            <h2 className="text-xl sm:text-2xl font-bold">{verdict}</h2>
            <p className="text-sm text-white/85">{correctCount} of {exam.length} correct · {scoreLabel(cfg)} · {cfg.timed ? 'Timed' : 'Untimed'} · {fmtTime(elapsed)} taken</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={start} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-indigo-700 text-sm font-bold"><RotateCcw className="w-4 h-4" /> Retake (new questions)</button>
          <button onClick={() => setPhase('setup')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 border border-white/30 text-sm font-bold">Change settings</button>
        </div>
      </div>

      <section className={`${card} p-4 sm:p-5`}>
        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-3"><Target className="w-4 h-4 text-rose-500" /> Weak-spot summary</h3>
        {weak.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No weak spots in this paper — every topic scored 70 % or more. 🎉</p>
        ) : (
          <p className="text-xs text-slate-500 mb-2">Topics below 70 % — tap one to study it.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topicStats.map(t => (
            <button key={t.id} onClick={() => onStudyTopic(t.id)} className="text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{topicTitle(t.id)}</span>
                <span className={`text-xs font-bold ${t.pct >= 0.7 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{t.right}/{t.total}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${t.pct >= 0.7 ? 'bg-emerald-400' : t.pct >= 0.4 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.max(6, t.pct * 100)}%` }} />
              </div>
              <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300"><BookOpen className="w-3 h-3" /> Study topic</span>
            </button>
          ))}
        </div>
      </section>

      <section className={`${card} p-4 sm:p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white">Review & worked solutions</h3>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold">
            <button onClick={() => setReviewFilter('all')} className={`px-3 py-1.5 ${reviewFilter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>All</button>
            <button onClick={() => setReviewFilter('wrong')} className={`px-3 py-1.5 ${reviewFilter === 'wrong' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>Incorrect only</button>
          </div>
        </div>
        {reviewList.length === 0 && <p className="text-sm text-slate-500">Nothing to show — all correct!</p>}
        {reviewList.map(({ q, i }) => {
          const ans = answers[q.id];
          const ok = isCorrect(q, ans);
          const yours = q.type === 'mcq'
            ? (ans?.choice !== undefined ? q.options[ans.choice] : '— not answered —')
            : (String(ans?.value ?? '').trim() ? `${ans?.value} ${q.unit}` : '— not answered —');
          const right = q.type === 'mcq' ? q.options[q.answerIndex] : `${fmtNum(q.answer)} ${q.unit}`;
          return (
            <div key={q.id} className={`rounded-xl border p-3.5 ${ok ? 'border-emerald-200 dark:border-emerald-400/30 bg-emerald-50/40 dark:bg-emerald-400/5' : 'border-rose-200 dark:border-rose-400/30 bg-rose-50/40 dark:bg-rose-400/5'}`}>
              <div className="flex items-start gap-2">
                {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                <div className="space-y-1.5 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white"><span className="text-slate-400 mr-1">Q{i + 1}.</span>{q.prompt}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-bold">Your answer:</span> {yours}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300"><span className="font-bold">Correct answer:</span> {right}</p>
                  <p className={`text-[11px] font-bold ${ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{ok ? 'Correct' : ans && isAnswered(q, ans) ? 'Incorrect' : 'Not answered'}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 rounded-lg px-2.5 py-2 font-mono leading-relaxed">{q.solution}</p>
                  <button onClick={() => onStudyTopic(q.topicId)} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">Study: {topicTitle(q.topicId)} →</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
