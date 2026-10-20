import { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, LayoutGrid, ListOrdered, ChevronRight, Timer, AlertTriangle } from 'lucide-react';
import { loadAllTopics, THEORY_LEVELS, THEORY_SUBJECTS, levelLabel, subjectLabel } from '../../data/theory';
import type { TheoryLevel, TheorySubjectId, TheoryTopic } from '../../data/theory';
import TopicDetail from './TopicDetail';
import { LevelPills } from './LevelPills';

type View = 'subjects' | 'az';

function normalise(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export default function TheoryLibrary({
  topicId,
  onOpenTopic,
  onCloseTopic,
  onStartExam,
  onReadInBook,
  primaryClass,
}: {
  topicId?: string;
  onOpenTopic: (id: string) => void;
  onCloseTopic: () => void;
  onStartExam: () => void;
  onReadInBook?: (topicId: string) => void;
  primaryClass: string;
}) {
  const [topics, setTopics] = useState<TheoryTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<TheoryLevel | 'all'>('all');
  const [subject, setSubject] = useState<TheorySubjectId | 'all'>('all');
  const [view, setView] = useState<View>('subjects');

  useEffect(() => {
    let alive = true;
    loadAllTopics()
      .then(t => alive && setTopics(t))
      .catch(() => alive && setError('The theory library could not be loaded. Check your connection and refresh.'));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = normalise(query.trim());
    const terms = q.split(/\s+/).filter(Boolean);
    return topics.filter(t => {
      if (level !== 'all' && !t.levels.includes(level)) return false;
      if (subject !== 'all' && t.subject !== subject) return false;
      if (!terms.length) return true;
      const hay = normalise(`${t.title} ${t.summary} ${t.keywords} ${subjectLabel(t.subject)} ${t.formulas.map(f => f.expr).join(' ')}`);
      return terms.every(term => hay.includes(term));
    });
  }, [topics, query, level, subject]);

  const byLetter = useMemo(() => {
    const map = new Map<string, TheoryTopic[]>();
    for (const t of filtered) {
      const ch = /[a-z]/i.test(t.title[0]) ? t.title[0].toUpperCase() : '#';
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const bySubject = useMemo(
    () => THEORY_SUBJECTS.map(s => ({ meta: s, items: filtered.filter(t => t.subject === s.id) })).filter(g => g.items.length),
    [filtered],
  );

  const selected = topicId && topics ? topics.find(t => t.id === topicId) : undefined;

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-5 text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }

  if (!topics) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> Loading the theory library…
      </div>
    );
  }

  if (topicId) {
    if (!selected) {
      return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-600 dark:text-slate-300 space-y-3">
          <p>That topic link isn’t in the library any more.</p>
          <button onClick={onCloseTopic} className="text-indigo-600 dark:text-indigo-300 font-bold">← Back to all topics</button>
        </div>
      );
    }
    return <TopicDetail topic={selected} allTopics={topics} onBack={onCloseTopic} onOpenTopic={onOpenTopic} onStartExam={onStartExam} onReadInBook={onReadInBook} primaryClass={primaryClass} />;
  }

  const levelCounts = (l: TheoryLevel) => topics.filter(t => t.levels.includes(l)).length;
  const hasFilters = query || level !== 'all' || subject !== 'all';

  const TopicCard = ({ t }: { t: TheoryTopic }) => (
    <button
      onClick={() => onOpenTopic(t.id)}
      className="group text-left w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-md hover:shadow-indigo-500/5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{t.title}</h3>
        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.summary}</p>
      <div className="mt-2"><LevelPills levels={t.levels} /></div>
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Level cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {THEORY_LEVELS.map(l => {
          const active = level === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setLevel(active ? 'all' : l.id)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                active
                  ? 'border-indigo-400 bg-indigo-50/80 dark:bg-indigo-500/10 dark:border-indigo-400/60 ring-2 ring-indigo-400/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{l.label}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{levelCounts(l.id)} topics</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{l.description}</p>
              <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 leading-snug">{l.curricula}</p>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search topics, formulas or keywords — e.g. thevenin, power factor, KVL"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              aria-label="Search theory topics"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </label>
          <div className="flex gap-2">
            <select
              value={subject}
              onChange={e => setSubject(e.target.value as TheorySubjectId | 'all')}
              className="flex-1 sm:w-56 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100"
              aria-label="Filter by subject"
            >
              <option value="all">All subjects</option>
              {THEORY_SUBJECTS.map(s => (
                <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
              ))}
            </select>
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
              <button onClick={() => setView('subjects')} className={`px-3 flex items-center gap-1 text-xs font-bold ${view === 'subjects' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`} aria-pressed={view === 'subjects'}>
                <LayoutGrid className="w-3.5 h-3.5" /><span className="hidden sm:inline">Subjects</span>
              </button>
              <button onClick={() => setView('az')} className={`px-3 flex items-center gap-1 text-xs font-bold ${view === 'az' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`} aria-pressed={view === 'az'}>
                <ListOrdered className="w-3.5 h-3.5" /><span className="hidden sm:inline">A–Z</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'school', 'college', 'university'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                level === l ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {l === 'all' ? 'All levels' : levelLabel(l)}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {filtered.length} of {topics.length} topics
            {hasFilters && (
              <button onClick={() => { setQuery(''); setLevel('all'); setSubject('all'); }} className="ml-2 font-bold text-indigo-600 dark:text-indigo-300">Reset</button>
            )}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          No topics match that search. Try a broader term like “motor” or “capacitor”.
        </div>
      ) : view === 'az' ? (
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-1" aria-label="Jump to letter">
            {byLetter.map(([ch]) => (
              <a key={ch} href={`#theory-az-${ch}`} onClick={e => { e.preventDefault(); document.getElementById(`theory-az-${ch}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                {ch}
              </a>
            ))}
          </nav>
          {byLetter.map(([ch, items]) => (
            <section key={ch} id={`theory-az-${ch}`} className="scroll-mt-48">
              <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-300 mb-2">{ch}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {items.map(t => <TopicCard key={t.id} t={t} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {bySubject.map(({ meta, items }) => (
            <section key={meta.id}>
              <div className="flex items-end justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{meta.emoji} {meta.label}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{meta.blurb}</p>
                </div>
                <span className="text-[11px] font-bold text-slate-400 shrink-0">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {items.map(t => <TopicCard key={t.id} t={t} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-4 sm:p-5 border border-emerald-200 dark:border-emerald-400/20 bg-emerald-50/70 dark:bg-emerald-400/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm">Ready to test yourself?</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Timed or relaxed practice exams with worked solutions and a weak-spot report.</p>
        </div>
        <button onClick={onStartExam} className={`${primaryClass} text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20`}>
          <Timer className="w-4 h-4" /> Open the Exam Room
        </button>
      </div>
    </div>
  );
}
