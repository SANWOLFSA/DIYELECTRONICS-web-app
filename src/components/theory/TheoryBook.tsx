import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trophy, Timer, X, ChevronLeft, ChevronRight, List, Search, BookA, Loader2, AlertTriangle, Sigma, ListChecks, Lightbulb, ArrowRight } from 'lucide-react';
import { loadTopicsInOrder, THEORY_SUBJECTS, subjectLabel } from '../../data/theory';
import type { TheoryTopic, TheorySubjectId } from '../../data/theory';
import { GLOSSARY_TERMS } from '../../data/theory/glossary';
import { CHAPTER_INTROS, CELLS_CHAPTER, topicQuestion } from '../../data/theory/chapters';
import type { AuthoredChapter, BookSection, QuizQuestion } from '../../data/theory/chapters';
import BookDiagram, { TOPIC_DIAGRAMS } from './BookDiagram';
import { recordScore } from '../../lib/theoryProgress';
import { LevelPills } from './LevelPills';
import { readBestScores } from '../../lib/theoryProgress';
import { getBookLanguage, setBookLanguage, useDomTranslate } from '../../lib/translate';
import LanguagePicker from '../LanguagePicker';
import { Languages, Lock } from 'lucide-react';
import { requestSignIn, useSignedIn } from '../../lib/signInGate';
import { CheckCircle2, XCircle, RotateCcw, HelpCircle, ShieldAlert, Sparkles } from 'lucide-react';

/**
 * The Theory library as a book: cover -> contents -> one chapter per subject -> two pages per topic
 * (explanation; formulas + worked example + mistakes) -> A–Z glossary / index.
 * Pages sit in a horizontal scroll-snap strip, so on Android you swipe left/right to turn pages
 * (native momentum + snap). Neighbouring pages get a small 3D "page turn" transform while
 * scrolling. Only pages near the current one are rendered. The last page read is remembered.
 */

type Page =
  | { kind: 'cover'; id: string }
  | { kind: 'toc'; id: string }
  | { kind: 'chapter'; id: string; subject: TheorySubjectId; chapterNo: number; topics: TheoryTopic[] }
  | { kind: 'topic'; id: string; topic: TheoryTopic; part: 1 | 2; chapterNo: number }
  | { kind: 'summary'; id: string; subject: TheorySubjectId; chapterNo: number; topics: TheoryTopic[] }
  | { kind: 'aopen'; id: string; chapter: AuthoredChapter; chapterNo: number }
  | { kind: 'asection'; id: string; chapter: AuthoredChapter; section: BookSection; chapterNo: number; sectionNo: number }
  | { kind: 'asummary'; id: string; chapter: AuthoredChapter; chapterNo: number }
  | { kind: 'aquiz'; id: string; chapter: AuthoredChapter; chapterNo: number }
  | { kind: 'locked'; id: string; chapterNo: number; title: string; remaining: number }
  | { kind: 'glossary'; id: string };

/** Pages a guest may read per chapter (chapter opener + the first topic's two pages). */
const PREVIEW_PAGES_PER_CHAPTER = 3;

type GlossaryEntry = { term: string; definition: string; topicId: string; kind: 'topic' | 'term'; aliases: string[]; pageId?: string };

const STORAGE_KEY = 'diyelectronics_theory_book_page';
const RENDER_RADIUS = 2;

const serif = { fontFamily: 'Georgia, "Iowan Old Style", "Noto Serif", "Times New Roman", serif' } as const;

function buildPages(topics: TheoryTopic[]): Page[] {
  const pages: Page[] = [{ kind: 'cover', id: 'cover' }, { kind: 'toc', id: 'toc' }];
  let chapterNo = 0;
  for (const s of THEORY_SUBJECTS) {
    const list = topics.filter(t => t.subject === s.id);
    if (!list.length) continue;
    chapterNo++;
    pages.push({ kind: 'chapter', id: `ch:${s.id}`, subject: s.id, chapterNo, topics: list });
    for (const t of list) {
      pages.push({ kind: 'topic', id: `t:${t.id}:1`, topic: t, part: 1, chapterNo });
      pages.push({ kind: 'topic', id: `t:${t.id}:2`, topic: t, part: 2, chapterNo });
    }
    pages.push({ kind: 'summary', id: `sum:${s.id}`, subject: s.id, chapterNo, topics: list });
    // Fully authored chapters slot in after their subject (e.g. Cells & batteries after Fundamentals).
    for (const a of [CELLS_CHAPTER].filter(c => c.after === s.id)) {
      chapterNo++;
      pages.push({ kind: 'aopen', id: `a:${a.id}:open`, chapter: a, chapterNo });
      a.sections.forEach((sec, si) => pages.push({ kind: 'asection', id: `a:${a.id}:s:${sec.id}`, chapter: a, section: sec, chapterNo, sectionNo: si + 1 }));
      pages.push({ kind: 'asummary', id: `a:${a.id}:summary`, chapter: a, chapterNo });
      pages.push({ kind: 'aquiz', id: `a:${a.id}:quiz`, chapter: a, chapterNo });
    }
  }
  pages.push({ kind: 'glossary', id: 'glossary' });
  return pages;
}

const chapterNoOf = (p: Page): number => ('chapterNo' in p ? p.chapterNo : 0);
function chapterName(p: Page): string {
  if (p.kind === 'chapter') return subjectLabel(p.subject);
  if (p.kind === 'aopen') return p.chapter.title;
  return '';
}

/**
 * Guest preview: the first PREVIEW_PAGES_PER_CHAPTER pages of every chapter (never its exam), then a
 * "sign in to keep reading" page. Cover, contents and glossary stay.
 */
function buildPreviewPages(all: Page[]): Page[] {
  const out: Page[] = [];
  let chapter = 0, kept = 0, hidden = 0, name = '';
  const closeChapter = () => {
    if (chapter && hidden) out.push({ kind: 'locked', id: `lock:${chapter}`, chapterNo: chapter, title: name, remaining: hidden });
  };
  for (const p of all) {
    const ch = chapterNoOf(p);
    if (!ch) { closeChapter(); chapter = 0; out.push(p); continue; }
    if (ch !== chapter) { closeChapter(); chapter = ch; kept = 0; hidden = 0; name = chapterName(p); }
    if (p.kind !== 'aquiz' && kept < PREVIEW_PAGES_PER_CHAPTER) { out.push(p); kept++; } else hidden++;
  }
  closeChapter();
  return out;
}

function pageText(p: Page): { title: string; text: string } {
  switch (p.kind) {
    case 'cover': return { title: 'Cover', text: 'Electrical theory book' };
    case 'toc': return { title: 'Contents', text: '' };
    case 'chapter': {
      const s = THEORY_SUBJECTS.find(x => x.id === p.subject);
      const ci = CHAPTER_INTROS.find(c => c.subject === p.subject);
      return { title: `Chapter ${p.chapterNo}: ${s?.label ?? p.subject}`, text: `${s?.blurb ?? ''} ${(ci?.intro || []).join(' ')} ${ci?.question || ''} ${ci?.answer || ''} ${p.topics.map(t => t.title).join(' · ')}` };
    }
    case 'topic': {
      const t = p.topic;
      if (p.part === 1) return { title: t.title, text: `${topicQuestion(t.title)} ${t.summary} ${t.explanation.join(' ')} ${t.keywords}` };
      return { title: `${t.title} (formulas & example)`, text: `${t.formulas.map(f => `${f.expr} ${f.desc}`).join(' · ')} ${t.example.problem} ${t.example.steps.join(' ')} ${t.example.answer} ${t.mistakes.join(' ')}` };
    }
    case 'summary': return { title: `Chapter ${p.chapterNo} summary: ${subjectLabel(p.subject)}`, text: (CHAPTER_INTROS.find(c => c.subject === p.subject)?.summary || []).join(' ') };
    case 'aopen': return { title: `Chapter ${p.chapterNo}: ${p.chapter.title}`, text: `${p.chapter.intro.join(' ')} ${p.chapter.question} ${p.chapter.answer}` };
    case 'asection': return { title: `${p.section.heading} (${p.chapter.title})`, text: `${p.section.question || ''} ${p.section.body.join(' ')} ${(p.section.bullets || []).join(' ')} ${(p.section.table?.rows || []).map(r => r.join(' ')).join(' ')} ${p.section.note?.text || ''}` };
    case 'asummary': return { title: `Chapter ${p.chapterNo} summary: ${p.chapter.title}`, text: p.chapter.summary.join(' ') };
    case 'aquiz': return { title: `Chapter ${p.chapterNo} exam: ${p.chapter.title}`, text: p.chapter.quiz.map(q => q.prompt).join(' ') };
    case 'locked': return { title: `Chapter ${p.chapterNo}: sign in to keep reading`, text: p.title };
    case 'glossary': return { title: 'Glossary & index', text: '' };
  }
}

// ---- fuzzy search ----------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const wordsOf = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function within1(a: string, b: string): boolean {
  // Levenshtein distance <= 1 (insert / delete / substitute), cheap check.
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

type Hit = { index: number; score: number; title: string; snippet: string; matched: string[] };

function searchPages(index: { title: string; text: string; words: string[]; titleWords: string[] }[], query: string): Hit[] {
  const q = wordsOf(query).filter(w => w.length > 1 || /\d/.test(w));
  if (!q.length) return [];
  const hits: Hit[] = [];
  index.forEach((p, i) => {
    let score = 0;
    const matched: string[] = [];
    for (const t of q) {
      let best = 0, bestWord = '';
      for (const w of p.titleWords) {
        const s = w === t ? 6 : w.startsWith(t) ? 4 : t.length >= 4 && within1(w, t) ? 2.5 : 0;
        if (s > best) { best = s; bestWord = w; }
      }
      for (const w of p.words) {
        if (best >= 3) break;
        const s = w === t ? 3 : w.startsWith(t) ? 2 : t.length >= 4 && within1(w, t) ? 1 : 0;
        if (s > best) { best = s; bestWord = w; }
      }
      if (!best) return; // every query word must match somewhere
      score += best;
      matched.push(bestWord);
    }
    const lower = norm(p.text);
    const at = Math.max(0, lower.indexOf(matched[0]));
    const start = Math.max(0, at - 50);
    const snippet = (start > 0 ? '…' : '') + p.text.slice(start, start + 160) + (start + 160 < p.text.length ? '…' : '');
    hits.push({ index: i, score, title: p.title, snippet, matched });
  });
  return hits.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 40);
}

/** Wraps every occurrence of the given words (accent/case-insensitive prefix) in <mark>. */
function highlight(text: string, words: string[]): ReactNode {
  const ws = words.filter(w => w.length > 1);
  if (!ws.length) return text;
  const esc = ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${esc.join('|')})`, 'giu');
  const parts = text.split(re);
  return parts.map((part, i) => (i % 2 === 1
    ? <mark key={i} className="bg-amber-300/80 dark:bg-amber-400/40 text-inherit rounded-sm px-0.5">{part}</mark>
    : <Fragment key={i}>{part}</Fragment>));
}

// ---- glossary term linking ----------------------------------------------------------------
const ALIAS_SKIP = new Set(['y', 'z', 'ω', 'ρ', 'τ', 'tau', 'unit', 'amp', 'amps', 'coil', 'hz', 'va', 'bjt']);

export default function TheoryBook({ startTopicId, onClose, onTakeQuiz }: { startTopicId?: string; onClose: () => void; onTakeQuiz?: (subject: TheorySubjectId) => void }) {
  const [topics, setTopics] = useState<TheoryTopic[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [panel, setPanel] = useState<null | 'toc' | 'search' | 'glossary' | 'lang'>(null);
  const [lang, setLang] = useState(() => getBookLanguage());
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [glossQuery, setGlossQuery] = useState('');
  const [mark, setMark] = useState<{ page: number; words: string[] } | null>(null);
  const [termCard, setTermCard] = useState<GlossaryEntry | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const rafRef = useRef(0);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    loadTopicsInOrder().then(setTopics).catch(() => setLoadError(true));
  }, []);

  // The book (pages, glossary, exams) is translated into the reader's language on demand.
  const tr = useDomTranslate(rootRef, lang, [topics ? 1 : 0]);

  // Guests read a preview (first pages of each chapter); members get the whole book.
  const { signedIn } = useSignedIn();
  const fullPages = useMemo(() => (topics ? buildPages(topics) : []), [topics]);
  const pages = useMemo(() => (signedIn ? fullPages : buildPreviewPages(fullPages)), [fullPages, signedIn]);
  const pageIndexById = useMemo(() => new Map(pages.map((p, i) => [p.id, i])), [pages]);
  const topicFirstPage = useCallback((topicId: string) => {
    const idx = pageIndexById.get(`t:${topicId}:1`);
    if (idx !== undefined) return idx;
    // Preview: a topic past the free pages opens its chapter's "sign in to keep reading" page.
    const full = fullPages.find(p => p.id === `t:${topicId}:1`);
    return (full && pageIndexById.get(`lock:${chapterNoOf(full)}`)) ?? 0;
  }, [pageIndexById, fullPages]);
  const entryPage = useCallback((e: { topicId: string; pageId?: string }) => (e.pageId && pageIndexById.has(e.pageId) ? pageIndexById.get(e.pageId)! : topicFirstPage(e.topicId)), [pageIndexById, topicFirstPage]);

  const searchIndex = useMemo(() => pages.map(p => {
    const { title, text } = pageText(p);
    return { title, text: text || title, words: wordsOf(text), titleWords: wordsOf(title) };
  }), [pages]);

  const glossary: GlossaryEntry[] = useMemo(() => {
    if (!topics) return [];
    const ids = new Set(topics.map(t => t.id));
    const list: GlossaryEntry[] = [
      ...topics.map(t => ({ term: t.title, definition: t.summary, topicId: t.id, kind: 'topic' as const, aliases: [] })),
      ...GLOSSARY_TERMS.filter(g => ids.has(g.topicId)).map(g => ({ term: g.term, definition: g.definition, topicId: g.topicId, kind: 'term' as const, aliases: g.aliases || [], pageId: g.pageId })),
    ];
    return list.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  }, [topics]);

  // One regex for all linkable key terms (longest first so "Ohm’s law" wins over "Ohm").
  const termMatcher = useMemo(() => {
    const byKey = new Map<string, GlossaryEntry>();
    for (const g of glossary) {
      if (g.kind !== 'term') continue;
      for (const k of [g.term, ...g.aliases]) {
        if (k.length < 2 || ALIAS_SKIP.has(k.toLowerCase())) continue;
        byKey.set(k.toLowerCase(), g);
      }
    }
    const keys = [...byKey.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!keys.length) return null;
    return { re: new RegExp(`(?<![\\p{L}\\p{N}])(${keys.join('|')})(?![\\p{L}\\p{N}])`, 'giu'), byKey };
  }, [glossary]);

  /** Renders text with tappable glossary terms (first use per page) and search highlights. */
  const renderText = useCallback((text: string, pageIdx: number, used: Set<string>): ReactNode => {
    const words = mark && mark.page === pageIdx ? mark.words : [];
    // Translated book: keep sentences whole (no inline term buttons) so the AI translates them well.
    if (!termMatcher || lang.code !== 'en') return lang.code !== 'en' ? text : highlight(text, words);
    const out: ReactNode[] = [];
    let last = 0;
    termMatcher.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = termMatcher.re.exec(text))) {
      const entry = termMatcher.byKey.get(m[1].toLowerCase());
      if (!entry || used.has(entry.term)) continue;
      used.add(entry.term);
      out.push(<Fragment key={k++}>{highlight(text.slice(last, m.index), words)}</Fragment>);
      out.push(
        <button key={k++} type="button" onClick={(e) => { e.stopPropagation(); setTermCard(entry); }}
          className="inline p-0 m-0 bg-transparent text-inherit underline decoration-dotted decoration-cobalt-400 underline-offset-4 hover:text-cobalt-600 dark:hover:text-cobalt-300 cursor-help"
          aria-label={`${m[1]}: show glossary definition`}>
          {highlight(m[1], words)}
        </button>,
      );
      last = m.index + m[1].length;
    }
    out.push(<Fragment key={k++}>{highlight(text.slice(last), words)}</Fragment>);
    return out;
  }, [termMatcher, mark, lang.code]);

  // ---- page turning ------------------------------------------------------------------------
  const applyTurnEffect = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const pos = el.scrollLeft / w;
    pageRefs.current.forEach((node, i) => {
      const offset = Math.max(-1, Math.min(1, i - pos));
      if (reduceMotion || Math.abs(offset) < 0.001) {
        node.style.transform = '';
        node.style.setProperty('--shade', '0');
        return;
      }
      node.style.transformOrigin = offset < 0 ? 'right center' : 'left center';
      node.style.transform = `perspective(1600px) rotateY(${offset * -22}deg) scale(${1 - Math.abs(offset) * 0.05})`;
      node.style.setProperty('--shade', String(Math.abs(offset) * 0.55));
    });
  }, [reduceMotion]);

  const onScroll = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollLeft / (el.clientWidth || 1));
      setCurrent(c => (c === idx ? c : idx));
      applyTurnEffect();
    });
  };

  const goTo = useCallback((idx: number, smooth = true) => {
    const el = scrollerRef.current;
    if (!el || !pages.length) return;
    const i = Math.max(0, Math.min(pages.length - 1, idx));
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reduceMotion && Math.abs(i - current) <= 3 ? 'smooth' : 'auto' });
    setCurrent(i);
  }, [pages.length, current, reduceMotion]);

  // Initial page: the topic asked for, else the last page read.
  useLayoutEffect(() => {
    if (!pages.length) return;
    let idx = 0;
    if (startTopicId && (pageIndexById.has(`t:${startTopicId}:1`) || !signedIn)) idx = topicFirstPage(startTopicId);
    else {
      try { const saved = localStorage.getItem(STORAGE_KEY); if (saved && pageIndexById.has(saved)) idx = pageIndexById.get(saved)!; } catch { /* ignore */ }
    }
    const el = scrollerRef.current;
    if (el) el.scrollLeft = idx * el.clientWidth;
    setCurrent(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  // Remember the page; keep the page aligned when the phone rotates.
  useEffect(() => {
    if (!pages[current]) return;
    try { localStorage.setItem(STORAGE_KEY, pages[current].id); } catch { /* ignore */ }
  }, [current, pages]);
  useEffect(() => {
    const onResize = () => { const el = scrollerRef.current; if (el) el.scrollLeft = current * el.clientWidth; };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [current]);
  useEffect(() => { applyTurnEffect(); }, [current, applyTurnEffect]);

  // Keyboard: arrows turn pages, Esc closes panels / the book. Body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') { if (e.key === 'Escape') setPanel(null); return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(current + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(current - 1);
      else if (e.key === 'Escape') { if (termCard) setTermCard(null); else if (panel) setPanel(null); else onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo, panel, termCard, onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const hits = useMemo(() => (query.trim() ? searchPages(searchIndex, query) : []), [searchIndex, query]);
  const glossFiltered = useMemo(() => {
    const q = norm(glossQuery.trim());
    if (!q) return glossary;
    return glossary.filter(g => norm(`${g.term} ${g.aliases.join(' ')}`).includes(q) || norm(g.definition).includes(q)
      || wordsOf(g.term).some(w => q.length >= 4 && within1(w, q)));
  }, [glossary, glossQuery]);

  const openTopic = (topicId: string) => { setPanel(null); setTermCard(null); goTo(topicFirstPage(topicId)); };
  const openEntry = (e: GlossaryEntry) => { setPanel(null); setTermCard(null); goTo(entryPage(e)); };

  const page = pages[current];
  const chapterOf = (p?: Page) => (p && 'chapterNo' in p ? p.chapterNo : 0);
  const chapterTitle = !page ? 'Electrical Theory'
    : page.kind === 'topic' ? `Ch. ${page.chapterNo} · ${subjectLabel(page.topic.subject)}`
    : page.kind === 'chapter' || page.kind === 'summary' ? `Ch. ${page.chapterNo} · ${subjectLabel(page.subject)}`
    : page.kind === 'aopen' || page.kind === 'asection' || page.kind === 'asummary' || page.kind === 'aquiz' ? `Ch. ${page.chapterNo} · ${page.chapter.title}`
    : page.kind === 'locked' ? `Ch. ${page.chapterNo} · ${page.title}`
    : page.kind === 'glossary' ? 'Glossary & index' : 'Electrical Theory';
  const progress = pages.length ? ((current + 1) / pages.length) * 100 : 0;

  // ---- page renderers ----------------------------------------------------------------------
  const renderPage = (p: Page, i: number) => {
    const used = new Set<string>();
    const pageNo = <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-6 pb-2 tabular-nums">— {i + 1} —</p>;
    if (p.kind === 'cover') {
      return (
        <div className="min-h-full flex flex-col items-center justify-center text-center gap-5 px-6 py-10">
          <span className="w-16 h-16 rounded-2xl bg-cobalt-600 text-white flex items-center justify-center shadow-lg"><BookA className="w-8 h-8" /></span>
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">DIY Electronics</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white" style={serif}>Electrical Theory</h1>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-sm" style={serif}>From Ohm’s law to power systems: {topics?.length ?? 0} topics in {THEORY_SUBJECTS.length + 1} chapters, with worked examples and an A–Z glossary.</p>
          <button type="button" onClick={() => goTo(1)} className="ds-btn-primary px-5 py-2.5 text-sm">Open contents <ArrowRight className="w-4 h-4" /></button>
          <p className="text-xs text-slate-400">Swipe left or right to turn pages · tap dotted words for definitions</p>
        </div>
      );
    }
    if (p.kind === 'toc') {
      return (
        <div className="px-1 py-6">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4" style={serif}>Contents</h2>
          <ol className="space-y-1">
            {pages.map((x, xi) => x.kind === 'aopen' ? (
              <li key={x.id}>
                <button type="button" onClick={() => goTo(xi)} className="w-full flex items-baseline gap-2 py-2.5 text-left border-b border-slate-200/70 dark:border-slate-800 hover:text-cobalt-600 dark:hover:text-cobalt-300">
                  <span className="text-xs font-semibold text-cobalt-600 dark:text-cobalt-300 w-7 shrink-0">{x.chapterNo}</span>
                  <span className="flex-1 text-[15px] text-slate-800 dark:text-slate-100" style={serif}>{x.chapter.emoji} {x.chapter.title}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{xi + 1}</span>
                </button>
              </li>
            ) : x.kind === 'chapter' ? (
              <li key={x.id}>
                <button type="button" onClick={() => goTo(xi)} className="w-full flex items-baseline gap-2 py-2.5 text-left border-b border-slate-200/70 dark:border-slate-800 hover:text-cobalt-600 dark:hover:text-cobalt-300">
                  <span className="text-xs font-semibold text-cobalt-600 dark:text-cobalt-300 w-7 shrink-0">{x.chapterNo}</span>
                  <span className="flex-1 text-[15px] text-slate-800 dark:text-slate-100" style={serif}>{THEORY_SUBJECTS.find(s => s.id === x.subject)?.emoji} {subjectLabel(x.subject)}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{xi + 1}</span>
                </button>
              </li>
            ) : null)}
            <li>
              <button type="button" onClick={() => goTo(pages.length - 1)} className="w-full flex items-baseline gap-2 py-2.5 text-left hover:text-cobalt-600">
                <span className="w-7 shrink-0" /><span className="flex-1 text-[15px] text-slate-800 dark:text-slate-100" style={serif}>Glossary &amp; index (A–Z)</span>
                <span className="text-xs text-slate-400 tabular-nums">{pages.length}</span>
              </button>
            </li>
          </ol>
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'chapter') {
      const s = THEORY_SUBJECTS.find(x => x.id === p.subject);
      return (
        <div className="py-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" style={serif}>{s?.emoji} {s?.label}</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-slate-600 dark:text-slate-300" style={serif}>{s?.blurb}</p>
          {(() => {
            const ci = CHAPTER_INTROS.find(c => c.subject === p.subject);
            if (!ci) return null;
            return (
              <>
                <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Introduction</h3>
                <div className="space-y-4 text-[17px] leading-[1.75] text-slate-800 dark:text-slate-200" style={serif}>{ci.intro.map((para, pi) => <p key={pi}>{renderText(para, i, used)}</p>)}</div>
                <QuestionBox question={ci.question}>{renderText(ci.answer, i, used)}</QuestionBox>
                {ci.diagram && <BookDiagram k={ci.diagram} />}
                <Outcomes items={ci.outcomes} />
              </>
            );
          })()}
          {onTakeQuiz && (() => {
            const bests = Object.values(readBestScores()).filter(b => b.key.endsWith(`:${p.subject}`));
            const top = bests.sort((a, b) => b.percent - a.percent)[0];
            return (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onTakeQuiz(p.subject)} className="ds-btn-primary px-4 py-2 text-sm"><Timer className="w-4 h-4" /> Take the chapter quiz</button>
                {top && <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Trophy className="w-3.5 h-3.5 text-amber-500" /> Best: {top.correct}/{top.total} ({top.percent}%)</span>}
              </div>
            );
          })()}
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sub-topics</h3>
          <ol className="mt-2 space-y-0.5">
            {p.topics.map((t, ti) => (
              <li key={t.id}>
                <button type="button" onClick={() => goTo(topicFirstPage(t.id))} className="w-full flex items-baseline gap-2 py-2 text-left border-b border-dashed border-slate-200 dark:border-slate-800 hover:text-cobalt-600 dark:hover:text-cobalt-300">
                  <span className="text-xs text-slate-400 w-10 shrink-0 tabular-nums">{p.chapterNo}.{ti + 1}</span>
                  <span className="flex-1 text-[15px] text-slate-800 dark:text-slate-100">{highlight(t.title, mark?.page === i ? mark.words : [])}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{topicFirstPage(t.id) + 1}</span>
                </button>
              </li>
            ))}
          </ol>
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'topic') {
      const t = p.topic;
      const sectionNo = `${p.chapterNo}.${(pages.filter(x => x.kind === 'topic' && x.chapterNo === p.chapterNo && x.part === 1).findIndex(x => x.kind === 'topic' && x.topic.id === t.id)) + 1}`;
      if (p.part === 1) {
        return (
          <div className="py-6">
            <p className="text-xs font-semibold text-cobalt-600 dark:text-cobalt-300 tabular-nums">§ {sectionNo}</p>
            <h2 className="mt-1 text-[1.65rem] leading-tight font-semibold tracking-tight text-slate-900 dark:text-white" style={serif}>{highlight(t.title, mark?.page === i ? mark.words : [])}</h2>
            <div className="mt-3"><LevelPills levels={t.levels} /></div>
            <QuestionBox question={topicQuestion(t.title)}>{renderText(t.summary, i, used)}</QuestionBox>
            <h3 className="mt-6 mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Lightbulb className="w-4 h-4 text-amber-500" /> Explanation</h3>
            <div className="space-y-4 text-[17px] leading-[1.75] text-slate-800 dark:text-slate-200" style={serif}>
              {t.explanation.map((para, pi) => <p key={pi} className={pi === 0 ? 'first-letter:text-4xl first-letter:font-semibold first-letter:float-left first-letter:mr-1.5 first-letter:leading-[0.9] first-letter:text-cobalt-600 dark:first-letter:text-cobalt-300' : ''}>{renderText(para, i, used)}</p>)}
            </div>
            {TOPIC_DIAGRAMS[t.id] && <BookDiagram k={TOPIC_DIAGRAMS[t.id]} />}
            <p className="mt-6 text-sm text-slate-400 flex items-center gap-1">Formulas &amp; worked example on the next page <ChevronRight className="w-4 h-4" /></p>
            {pageNo}
          </div>
        );
      }
      return (
        <div className="py-6">
          <p className="text-xs font-semibold text-cobalt-600 dark:text-cobalt-300 tabular-nums">§ {sectionNo} · {t.title}</p>
          <h3 className="mt-3 mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Sigma className="w-4 h-4 text-cobalt-500" /> Key formulas</h3>
          <ul className="space-y-2">
            {t.formulas.map((f, fi) => (
              <li key={fi} className="rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5">
                <p className="font-mono text-[15px] font-semibold text-slate-900 dark:text-slate-100 break-words">{highlight(f.expr, mark?.page === i ? mark.words : [])}</p>
                {f.desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{highlight(f.desc, mark?.page === i ? mark.words : [])}</p>}
              </li>
            ))}
          </ul>
          <h3 className="mt-6 mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><ListChecks className="w-4 h-4 text-cobalt-500" /> Worked example</h3>
          <p className="text-[16px] leading-relaxed font-semibold text-slate-800 dark:text-slate-100" style={serif}>{renderText(t.example.problem, i, used)}</p>
          <ol className="mt-3 space-y-2">
            {t.example.steps.map((st, si) => (
              <li key={si} className="flex gap-2.5 text-slate-700 dark:text-slate-300">
                <span className="w-5 h-5 shrink-0 rounded-full bg-cobalt-100 dark:bg-cobalt-500/20 text-cobalt-700 dark:text-cobalt-200 text-[11px] font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                <span className="font-mono text-[14px] leading-relaxed break-words min-w-0">{highlight(st, mark?.page === i ? mark.words : [])}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/30 text-sm font-bold text-emerald-800 dark:text-emerald-200">Answer: {t.example.answer}</p>
          {t.mistakes.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><AlertTriangle className="w-4 h-4 text-rose-500" /> Common mistakes</h3>
              <ul className="space-y-2 text-[16px] leading-relaxed text-slate-700 dark:text-slate-300" style={serif}>
                {t.mistakes.map((m, mi) => <li key={mi} className="flex gap-2"><span className="text-rose-500 font-bold">✗</span><span>{renderText(m, i, used)}</span></li>)}
              </ul>
            </>
          )}
          {t.related.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-400 w-full">See also</span>
              {t.related.map(id => topics?.find(x => x.id === id)).filter(Boolean).map(r => (
                <button key={r!.id} type="button" onClick={() => goTo(topicFirstPage(r!.id))} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-cobalt-600">{r!.title} · p.{topicFirstPage(r!.id) + 1}</button>
              ))}
            </div>
          )}
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'summary') {
      const ci = CHAPTER_INTROS.find(c => c.subject === p.subject);
      const ids = new Set(p.topics.map(x => x.id));
      const terms = glossary.filter(g => g.kind === 'term' && ids.has(g.topicId) && !g.pageId);
      const bests = Object.values(readBestScores()).filter(b => b.key.endsWith(`:${p.subject}`)).sort((a, b) => b.percent - a.percent);
      return (
        <div className="py-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo} · Summary</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white" style={serif}>{subjectLabel(p.subject)}: key points</h2>
          <ul className="mt-4 space-y-2.5 text-[17px] leading-[1.7] text-slate-800 dark:text-slate-200" style={serif}>
            {(ci?.summary || p.topics.map(x => `${x.title}: ${x.summary}`)).map((s, si) => <li key={si} className="flex gap-2"><span className="text-cobalt-500 font-bold">•</span><span>{renderText(s, i, used)}</span></li>)}
          </ul>
          {terms.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key terms</h3>
              <div className="flex flex-wrap gap-1.5">{terms.map(g => <button key={g.term} type="button" onClick={() => setTermCard(g)} className="px-2.5 py-1 rounded-lg bg-cobalt-50 dark:bg-cobalt-500/15 text-xs font-semibold text-cobalt-700 dark:text-cobalt-200">{g.term}</button>)}</div>
            </div>
          )}
          {onTakeQuiz && (
            <div className="mt-8 rounded-2xl border border-cobalt-200 dark:border-cobalt-500/30 bg-cobalt-50/60 dark:bg-cobalt-500/10 p-4">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Timer className="w-4 h-4 text-cobalt-500" /> Chapter exam</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Answer every question, then see your score with the correct answer and a worked explanation for each one. Retake as often as you like; your best score is saved.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onTakeQuiz(p.subject)} className="ds-btn-primary px-4 py-2 text-sm">Start the chapter exam <ArrowRight className="w-4 h-4" /></button>
                {bests[0] && <span className="text-xs text-slate-500 flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-500" /> Best: {bests[0].correct}/{bests[0].total} ({bests[0].percent}%)</span>}
              </div>
            </div>
          )}
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'aopen') {
      const a = p.chapter;
      return (
        <div className="py-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" style={serif}>{a.emoji} {a.title}</h2>
          <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Introduction</h3>
          <div className="space-y-4 text-[17px] leading-[1.75] text-slate-800 dark:text-slate-200" style={serif}>{a.intro.map((para, pi) => <p key={pi}>{renderText(para, i, used)}</p>)}</div>
          <QuestionBox question={a.question}>{renderText(a.answer, i, used)}</QuestionBox>
          <Outcomes items={a.outcomes} />
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sections</h3>
          <ol className="mt-2 space-y-0.5">
            {a.sections.map((sec, si) => (
              <li key={sec.id}>
                <button type="button" onClick={() => goTo(pageIndexById.get(`a:${a.id}:s:${sec.id}`) ?? i)} className="w-full flex items-baseline gap-2 py-2 text-left border-b border-dashed border-slate-200 dark:border-slate-800 hover:text-cobalt-600">
                  <span className="text-xs text-slate-400 w-10 shrink-0 tabular-nums">{p.chapterNo}.{si + 1}</span>
                  <span className="flex-1 text-[15px] text-slate-800 dark:text-slate-100">{sec.heading}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{(pageIndexById.get(`a:${a.id}:s:${sec.id}`) ?? 0) + 1}</span>
                </button>
              </li>
            ))}
          </ol>
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'asection') {
      const sec = p.section;
      return (
        <div className="py-6">
          <p className="text-xs font-semibold text-cobalt-600 dark:text-cobalt-300 tabular-nums">§ {p.chapterNo}.{p.sectionNo} · {p.chapter.title}</p>
          <h2 className="mt-1 text-[1.65rem] leading-tight font-semibold tracking-tight text-slate-900 dark:text-white" style={serif}>{highlight(sec.heading, mark?.page === i ? mark.words : [])}</h2>
          {sec.question ? (
            <QuestionBox question={sec.question}>{renderText(sec.body[0], i, used)}</QuestionBox>
          ) : null}
          <div className="mt-4 space-y-4 text-[17px] leading-[1.75] text-slate-800 dark:text-slate-200" style={serif}>
            {(sec.question ? sec.body.slice(1) : sec.body).map((para, pi) => <p key={pi}>{renderText(para, i, used)}</p>)}
          </div>
          {sec.bullets && <ul className="mt-4 space-y-2 text-[16px] leading-relaxed text-slate-800 dark:text-slate-200" style={serif}>{sec.bullets.map((b, bi) => <li key={bi} className="flex gap-2"><span className="text-cobalt-500 font-bold">•</span><span>{renderText(b, i, used)}</span></li>)}</ul>}
          {sec.table && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/80"><tr>{sec.table.head.map(h => <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{sec.table.rows.map((r, ri) => <tr key={ri} className="border-t border-slate-200 dark:border-slate-800">{r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top">{highlight(c, mark?.page === i ? mark.words : [])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {sec.diagram && <BookDiagram k={sec.diagram} />}
          {sec.note && (
            <p className={`mt-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[15px] leading-relaxed ${sec.note.kind === 'safety' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-500/30'}`}>
              {sec.note.kind === 'safety' ? <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" /> : <Lightbulb className="w-5 h-5 shrink-0 mt-0.5" />}
              <span><span className="font-semibold">{sec.note.kind === 'safety' ? 'Safety: ' : 'Practical tip: '}</span>{sec.note.text}</span>
            </p>
          )}
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'asummary') {
      const a = p.chapter;
      return (
        <div className="py-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo} · Summary</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white" style={serif}>{a.title}: key points</h2>
          <ul className="mt-4 space-y-2.5 text-[17px] leading-[1.7] text-slate-800 dark:text-slate-200" style={serif}>
            {a.summary.map((s, si) => <li key={si} className="flex gap-2"><span className="text-cobalt-500 font-bold">•</span><span>{renderText(s, i, used)}</span></li>)}
          </ul>
          <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key terms</h3>
          <div className="flex flex-wrap gap-1.5">
            {a.keyTerms.map(k => { const g = glossary.find(x => x.term.toLowerCase() === k.toLowerCase()); return <button key={k} type="button" disabled={!g} onClick={() => g && setTermCard(g)} className="px-2.5 py-1 rounded-lg bg-cobalt-50 dark:bg-cobalt-500/15 text-xs font-semibold text-cobalt-700 dark:text-cobalt-200">{k}</button>; })}
          </div>
          <button type="button" onClick={() => goTo(i + 1)} className="mt-8 ds-btn-primary px-4 py-2 text-sm"><Timer className="w-4 h-4" /> Go to the chapter exam</button>
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'locked') {
      return (
        <div className="min-h-full flex flex-col items-center justify-center text-center gap-4 px-4 py-10">
          <span className="w-14 h-14 rounded-2xl bg-cobalt-600 text-white flex items-center justify-center shadow-lg"><Lock className="w-7 h-7" /></span>
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo} · Preview ends here</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white" style={serif}>Sign in to keep reading</h2>
          <p className="text-[15px] text-slate-600 dark:text-slate-300 max-w-sm" style={serif}>
            {p.remaining} more page{p.remaining === 1 ? '' : 's'} of {p.title || `chapter ${p.chapterNo}`}, the chapter exam, translations and the AI tutor are free with an account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => requestSignIn('Sign in to read the whole Theory book and take the chapter exams. It is free.')} className="ds-btn-primary px-4 py-2 text-sm">Sign in to continue <ArrowRight className="w-4 h-4" /></button>
            {i + 1 < pages.length && <button type="button" onClick={() => goTo(i + 1)} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800">Next chapter preview</button>}
          </div>
          {pageNo}
        </div>
      );
    }
    if (p.kind === 'aquiz') {
      return (
        <div className="py-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cobalt-600 dark:text-cobalt-300 font-semibold">Chapter {p.chapterNo} · Exam</p>
          <h2 className="mt-2 mb-4 text-2xl font-semibold text-slate-900 dark:text-white" style={serif}>{p.chapter.title} exam</h2>
          <BookQuiz chapter={p.chapter} />
          {pageNo}
        </div>
      );
    }
    return (
      <div className="py-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white" style={serif}>Glossary &amp; index</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">Every topic and key term, A–Z. Tap one to jump to its page.</p>
        <GlossaryList entries={glossary} pageOf={entryPage} onOpen={openEntry} />
        {pageNo}
      </div>
    );
  };

  // ---- shell -------------------------------------------------------------------------------
  return (
    <div ref={rootRef} lang={lang.code} className="fixed inset-0 z-[70] flex flex-col bg-[#f6f3ec] dark:bg-slate-950 text-slate-900 dark:text-slate-100" role="dialog" aria-modal="true" aria-label="Electrical Theory book">
      {/* Top bar */}
      <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-[#f6f3ec]/95 dark:bg-slate-950/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-12 px-2 sm:px-4 flex items-center gap-1">
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800" aria-label="Close book"><X className="w-5 h-5" /></button>
          <p className="flex-1 min-w-0 truncate text-sm font-medium text-slate-600 dark:text-slate-300 px-1">{chapterTitle}</p>
          {tr.busy && <Loader2 className="w-4 h-4 animate-spin text-cobalt-500 shrink-0" aria-label="Translating" />}
          <button type="button" onClick={() => (signedIn ? setPanel('lang') : requestSignIn('Sign in to read the Theory book in other languages.'))} className="px-2 py-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center gap-1 text-xs font-bold" aria-label={`Book language: ${lang.name}`} data-notranslate>
            <Languages className="w-5 h-5" /><span className="uppercase">{lang.code.split('-')[0]}</span>
          </button>
          <button type="button" onClick={() => setPanel('search')} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800" aria-label="Find in book"><Search className="w-5 h-5" /></button>
          <button type="button" onClick={() => setPanel('glossary')} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800" aria-label="Glossary"><BookA className="w-5 h-5" /></button>
          <button type="button" onClick={() => setPanel('toc')} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800" aria-label="Table of contents"><List className="w-5 h-5" /></button>
        </div>
        <div className="h-1 bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuemin={1} aria-valuemax={pages.length || 1} aria-valuenow={current + 1} aria-label="Reading progress">
          <div className="h-full bg-cobalt-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Pages */}
      {!topics ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 gap-2">
          {loadError ? <><AlertTriangle className="w-4 h-4" /> Could not load the book. Check your connection.</> : <><Loader2 className="w-4 h-4 animate-spin" /> Opening the book…</>}
        </div>
      ) : (
        <div ref={scrollerRef} onScroll={onScroll} className="book-scroller flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar overscroll-x-contain">
          {pages.map((p, i) => (
            <section key={p.id} className="w-full h-full shrink-0 snap-center snap-always relative" aria-label={`Page ${i + 1}`}>
              {Math.abs(i - current) <= RENDER_RADIUS ? (
                <div ref={(n) => { if (n) pageRefs.current.set(i, n); else pageRefs.current.delete(i); }} className="book-page h-full overflow-y-auto overscroll-y-contain will-change-transform">
                  <div dir={lang.rtl ? 'rtl' : 'ltr'} className="max-w-[40rem] mx-auto px-5 sm:px-8">{renderPage(p, i)}</div>
                  <div className="book-shade pointer-events-none absolute inset-0" aria-hidden />
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f3ec]/95 dark:bg-slate-950/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="h-12 px-2 sm:px-4 flex items-center gap-2">
          <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="w-5 h-5" /></button>
          <input type="range" min={1} max={pages.length || 1} value={current + 1} onChange={(e) => goTo(Number(e.target.value) - 1, false)} className="flex-1 accent-cobalt-500" aria-label="Go to page" />
          <span className="text-xs tabular-nums text-slate-500 w-20 text-center">{current + 1} / {pages.length || '…'}</span>
          <button type="button" onClick={() => goTo(current + 1)} disabled={current >= pages.length - 1} className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-30" aria-label="Next page"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Side panels */}
      {panel && (
        <div className="absolute inset-0 z-10 flex" onClick={() => setPanel(null)}>
          <div className="flex-1 bg-black/40" />
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="h-12 shrink-0 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <p className="font-semibold text-sm">{panel === 'toc' ? 'Contents' : panel === 'search' ? 'Find in book' : panel === 'lang' ? 'Book language' : 'Glossary & index'}</p>
              <button type="button" onClick={() => setPanel(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close panel"><X className="w-4 h-4" /></button>
            </div>
            {panel === 'lang' && (
              <div className="flex-1 min-h-0 flex flex-col" data-notranslate>
                <p className="px-3 pt-3 text-xs text-slate-500">The book, glossary and chapter exams are translated by AI into the language you choose (it starts with your phone’s language). Translations are saved on this device, so pages you have read open instantly next time.</p>
                {tr.error && <p className="px-3 pt-2 text-xs text-rose-600">{tr.error} <button type="button" className="underline" onClick={tr.retry}>Try again</button></p>}
                <div className="flex-1 min-h-0"><LanguagePicker value={lang.code} onChange={(l) => { setLang(l); setBookLanguage(l.code); setPanel(null); }} /></div>
              </div>
            )}
            {panel === 'toc' && (
              <div className="flex-1 overflow-y-auto p-2">
                {pages.map((x, xi) => {
                  if (x.kind === 'chapter') return (
                    <button key={x.id} type="button" onClick={() => { setPanel(null); goTo(xi); }} className="w-full mt-3 first:mt-0 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-cobalt-600 dark:text-cobalt-300 flex justify-between">
                      <span>{x.chapterNo}. {subjectLabel(x.subject)}</span><span className="tabular-nums">{xi + 1}</span>
                    </button>
                  );
                  if (x.kind === 'aopen') return (
                    <button key={x.id} type="button" onClick={() => { setPanel(null); goTo(xi); }} className="w-full mt-3 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-cobalt-600 dark:text-cobalt-300 flex justify-between">
                      <span>{x.chapterNo}. {x.chapter.title}</span><span className="tabular-nums">{xi + 1}</span>
                    </button>
                  );
                  if (x.kind === 'asection' || x.kind === 'aquiz' || x.kind === 'summary') return (
                    <button key={x.id} type="button" onClick={() => { setPanel(null); goTo(xi); }} className={`w-full px-2 py-1.5 rounded-lg text-left text-sm flex justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${current === xi ? 'bg-cobalt-50 dark:bg-cobalt-500/15 text-cobalt-700 dark:text-cobalt-200 font-medium' : 'text-slate-700 dark:text-slate-200'} ${x.kind !== 'asection' ? 'italic' : ''}`}>
                      <span className="truncate">{x.kind === 'asection' ? x.section.heading : x.kind === 'aquiz' ? 'Chapter exam' : 'Summary & chapter exam'}</span><span className="text-xs text-slate-400 tabular-nums">{xi + 1}</span>
                    </button>
                  );
                  if (x.kind === 'topic' && x.part === 1) return (
                    <button key={x.id} type="button" onClick={() => { setPanel(null); goTo(xi); }} className={`w-full px-2 py-1.5 rounded-lg text-left text-sm flex justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${(current === xi || current === xi + 1) ? 'bg-cobalt-50 dark:bg-cobalt-500/15 text-cobalt-700 dark:text-cobalt-200 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                      <span className="truncate">{x.topic.title}</span><span className="text-xs text-slate-400 tabular-nums">{xi + 1}</span>
                    </button>
                  );
                  return null;
                })}
                <button type="button" onClick={() => { setPanel(null); goTo(pages.length - 1); }} className="w-full mt-3 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-cobalt-600 dark:text-cobalt-300 flex justify-between"><span>Glossary &amp; index</span><span>{pages.length}</span></button>
              </div>
            )}
            {panel === 'search' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, terms, formulas…" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-cobalt-500 focus:outline-none text-[16px]" aria-label="Search the book" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">{query.trim() ? `${hits.length} matching page${hits.length === 1 ? '' : 's'}` : 'Typos are fine: “capasitor”, “thevenin”, “kirchoff”.'}</p>
                </div>
                <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {hits.map(h => (
                    <li key={h.index}>
                      <button type="button" onClick={() => { setMark({ page: h.index, words: h.matched }); setPanel(null); goTo(h.index); }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <span className="flex justify-between gap-2 text-sm font-semibold text-slate-900 dark:text-white"><span className="truncate">{highlight(h.title, h.matched)}</span><span className="text-xs text-slate-400 font-normal tabular-nums shrink-0">p.{h.index + 1}</span></span>
                        <span className="block mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{highlight(h.snippet, h.matched)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {panel === 'glossary' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoFocus value={glossQuery} onChange={(e) => setGlossQuery(e.target.value)} placeholder={`Search ${glossary.length} topics & terms`} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-cobalt-500 focus:outline-none text-[16px]" aria-label="Search the glossary" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                  <GlossaryList entries={glossFiltered} pageOf={entryPage} onOpen={openEntry} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Glossary definition card (tapped key term) */}
      {termCard && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setTermCard(null)}>
          <div className="w-full sm:max-w-sm m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-cobalt-600 dark:text-cobalt-300 font-semibold">Glossary</p>
                <p className="text-lg font-semibold" style={serif}>{termCard.term}{termCard.aliases.length ? <span className="text-sm font-normal text-slate-400"> ({termCard.aliases.slice(0, 3).join(', ')})</span> : null}</p>
              </div>
              <button type="button" onClick={() => setTermCard(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close definition"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200" style={serif}>{termCard.definition}</p>
            <button type="button" onClick={() => openEntry(termCard)} className="mt-3 ds-btn-primary px-3.5 py-2 text-sm">
              Read: {pageText(pages[entryPage(termCard)] ?? pages[0]).title} · p.{entryPage(termCard) + 1} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GlossaryList({ entries, pageOf, onOpen }: { entries: GlossaryEntry[]; pageOf: (e: GlossaryEntry) => number; onOpen: (e: GlossaryEntry) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, GlossaryEntry[]>();
    for (const e of entries) {
      const ch = norm(e.term).charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(ch) ? ch : '#';
      if (!m.has(letter)) m.set(letter, []);
      m.get(letter)!.push(e);
    }
    return [...m.entries()];
  }, [entries]);
  const listRef = useRef<HTMLDivElement>(null);
  if (!entries.length) return <p className="py-6 text-sm text-slate-500 text-center">No matching topics or terms.</p>;
  return (
    <div ref={listRef}>
      <div className="sticky top-0 z-[1] -mx-1 px-1 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-b-lg flex flex-wrap gap-1">
        {groups.map(([l]) => (
          <button key={l} type="button" onClick={() => listRef.current?.querySelector(`[data-letter="${l}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-7 h-7 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-cobalt-100 dark:hover:bg-cobalt-500/20">{l}</button>
        ))}
      </div>
      {groups.map(([l, list]) => (
        <div key={l} data-letter={l} className="scroll-mt-12">
          <p className="mt-3 mb-1 text-xs font-bold text-cobalt-600 dark:text-cobalt-300">{l}</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map(e => (
              <li key={`${e.kind}:${e.term}`}>
                <button type="button" onClick={() => onOpen(e)} className="w-full text-left py-2 group">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-cobalt-600 dark:group-hover:text-cobalt-300">
                      {e.term}
                      <span className={`ml-1.5 align-middle text-[10px] font-medium px-1.5 py-0.5 rounded ${e.kind === 'topic' ? 'bg-cobalt-100 text-cobalt-700 dark:bg-cobalt-500/20 dark:text-cobalt-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{e.kind === 'topic' ? 'Topic' : 'Term'}</span>
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">p.{pageOf(e) + 1}</span>
                  </span>
                  <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{e.definition}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function QuestionBox({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border-l-4 border-cobalt-500 bg-cobalt-50/80 dark:bg-cobalt-500/10 px-4 py-3">
      <p className="flex items-start gap-2 text-[1.15rem] font-semibold text-cobalt-700 dark:text-cobalt-200" style={serif}><HelpCircle className="w-5 h-5 shrink-0 mt-0.5" /> {question}</p>
      <div className="mt-1.5 text-[17px] leading-[1.75] text-slate-800 dark:text-slate-100" style={serif}>{children}</div>
    </div>
  );
}

function Outcomes({ items }: { items: string[] }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Sparkles className="w-4 h-4 text-cobalt-500" /> In this chapter you will learn to</h3>
      <ul className="space-y-1.5 text-[16px] leading-relaxed text-slate-700 dark:text-slate-300" style={serif}>
        {items.map((o, i) => <li key={i} className="flex gap-2"><span className="text-cobalt-500 font-bold">✓</span><span>{o}</span></li>)}
      </ul>
    </div>
  );
}

const QUIZ_KEY = (id: string) => `book:${id}`;

/** In-book chapter exam: answer every question, then see the score and a full answer review. */
function BookQuiz({ chapter }: { chapter: AuthoredChapter }) {
  const shuffle = (qs: QuizQuestion[]) => [...qs].sort(() => Math.random() - 0.5);
  const [questions, setQuestions] = useState(() => chapter.quiz);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [best, setBest] = useState(() => readBestScores()[QUIZ_KEY(chapter.id)]);
  const answered = questions.filter(q => answers[q.id] !== undefined).length;
  const correct = questions.filter(q => answers[q.id] === q.answerIndex).length;
  const percent = Math.round((correct / questions.length) * 100);
  const finish = () => {
    setDone(true);
    const improved = recordScore({ key: QUIZ_KEY(chapter.id), label: `Book · ${chapter.title}`, percent, correct, total: questions.length, timed: false, date: new Date().toISOString() });
    setNewBest(improved);
    setBest(readBestScores()[QUIZ_KEY(chapter.id)]);
  };
  const retake = () => { setQuestions(shuffle(chapter.quiz)); setAnswers({}); setDone(false); setNewBest(false); };
  return (
    <div className="space-y-4">
      {done && (
        <div className="rounded-2xl p-4 bg-cobalt-600 text-white flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/15 border-4 border-white/40 flex flex-col items-center justify-center shrink-0 leading-none">
            <span className="text-xl font-bold">{correct}/{questions.length}</span><span className="text-xs mt-1 text-white/85">{percent}%</span>
          </div>
          <div className="space-y-1">
            {newBest && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300 text-amber-950 text-[11px] font-bold"><Trophy className="w-3 h-3" /> New best score</span>}
            <p className="font-semibold">{percent >= 80 ? 'Excellent!' : percent >= 60 ? 'Good, a few gaps to close.' : 'Keep going: review the answers below and retake.'}</p>
            {best && <p className="text-xs text-white/80">Best: {best.correct}/{best.total} ({best.percent}%)</p>}
            <button type="button" onClick={retake} className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-cobalt-700 text-xs font-bold"><RotateCcw className="w-3.5 h-3.5" /> Retake</button>
          </div>
        </div>
      )}
      {!done && best && <p className="text-xs text-slate-500 flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-500" /> Your best: {best.correct}/{best.total} ({best.percent}%)</p>}
      <ol className="space-y-3">
        {questions.map((q, qi) => {
          const a = answers[q.id];
          const ok = a === q.answerIndex;
          return (
            <li key={q.id} className={`rounded-xl border p-3 ${done ? (ok ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/5') : 'border-slate-200 dark:border-slate-800'}`}>
              <p className="text-[15px] font-semibold text-slate-900 dark:text-white flex gap-2">
                {done && (ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-500 shrink-0" />)}
                <span><span className="text-slate-400 mr-1">{qi + 1}.</span>{q.prompt}</span>
              </p>
              {!done ? (
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((o, oi) => (
                    <label key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${a === oi ? 'border-cobalt-500 bg-cobalt-50 dark:bg-cobalt-500/15' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="radio" name={q.id} checked={a === oi} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))} className="accent-cobalt-500" />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-700 dark:text-slate-300"><span className="font-semibold">Your answer:</span> {a !== undefined ? q.options[a] : '— not answered —'} <span className={ok ? 'text-emerald-600 dark:text-emerald-300 font-semibold' : 'text-rose-600 dark:text-rose-300 font-semibold'}>({ok ? 'correct' : 'incorrect'})</span></p>
                  <p className="text-emerald-700 dark:text-emerald-300"><span className="font-semibold">Correct answer:</span> {q.options[q.answerIndex]}</p>
                  <p className="text-slate-600 dark:text-slate-400 text-[13px] leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!done && (
        <div className="flex items-center gap-3">
          <button type="button" disabled={answered < questions.length} onClick={finish} className="ds-btn-primary px-4 py-2 text-sm disabled:opacity-40">Finish &amp; see results</button>
          <span className="text-xs text-slate-500">{answered}/{questions.length} answered</span>
        </div>
      )}
    </div>
  );
}
