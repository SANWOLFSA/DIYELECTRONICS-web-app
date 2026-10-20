import { useCallback, useEffect, useState } from 'react';
import { lazy, Suspense } from 'react';
import { BookOpenCheck, BookOpen, GraduationCap, Timer, Gauge, Award } from 'lucide-react';
import { RouteLink } from '../../hooks/usePathname';
import type { ThemeConfig } from '../../lib/theme';
import TheoryLibrary from './TheoryLibrary';
import ExamRoom from './ExamRoom';
import Courses from '../Courses';
const TheoryBook = lazy(() => import('./TheoryBook'));
import type { Course } from '../../types';
import { THEORY_SUBJECTS } from '../../data/theory';
import type { TheorySubjectId } from '../../data/theory';

/**
 * Theory & Courses hub (the single learning section): Theory library | Exam Room | Courses.
 * The old /studies (Courses) page redirects here (#/theory/courses).
 * and keeps them in sync with the URL hash so views are shareable:
 *   #/theory                -> library
 *   #/theory/topic/<id>     -> a topic in the library
 *   #/theory/exam           -> Exam Room
 *   #/theory/courses        -> Certified courses
 * The hash is self-contained so it coexists with any path-based router.
 */
export type TheoryRoute = { tab: 'library' | 'exam' | 'courses' | 'book'; topicId?: string; subject?: string };

export const THEORY_HASH_PREFIX = '#/theory';

export function parseTheoryHash(hash: string): TheoryRoute | null {
  if (!hash.startsWith(THEORY_HASH_PREFIX)) return null;
  const parts = hash.slice(THEORY_HASH_PREFIX.length).split('/').filter(Boolean);
  if (parts[0] === 'exam') return parts[1] ? { tab: 'exam', subject: decodeURIComponent(parts[1]) } : { tab: 'exam' };
  if (parts[0] === 'courses') return { tab: 'courses' };
  if (parts[0] === 'book') return parts[1] ? { tab: 'book', topicId: decodeURIComponent(parts[1]) } : { tab: 'book' };
  if (parts[0] === 'topic' && parts[1]) return { tab: 'library', topicId: decodeURIComponent(parts[1]) };
  return { tab: 'library' };
}

export function buildTheoryHash(route: TheoryRoute): string {
  if (route.tab === 'exam') return route.subject ? `${THEORY_HASH_PREFIX}/exam/${encodeURIComponent(route.subject)}` : `${THEORY_HASH_PREFIX}/exam`;
  if (route.tab === 'courses') return `${THEORY_HASH_PREFIX}/courses`;
  if (route.tab === 'book') return route.topicId ? `${THEORY_HASH_PREFIX}/book/${encodeURIComponent(route.topicId)}` : `${THEORY_HASH_PREFIX}/book`;
  if (route.topicId) return `${THEORY_HASH_PREFIX}/topic/${encodeURIComponent(route.topicId)}`;
  return THEORY_HASH_PREFIX;
}

export default function TheoryHub({ themeConfig, courses = [], onCourseComplete }: { themeConfig?: ThemeConfig; courses?: Course[]; onCourseComplete?: (id: string, title: string) => void }) {
  const [route, setRoute] = useState<TheoryRoute>(() => parseTheoryHash(window.location.hash) ?? { tab: 'library' });

  // Make sure the URL reflects the hub on mount, and follow back/forward navigation.
  useEffect(() => {
    if (!parseTheoryHash(window.location.hash)) {
      window.history.replaceState(null, '', buildTheoryHash(route));
    }
    const onHash = () => {
      const next = parseTheoryHash(window.location.hash);
      if (next) setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      // Leaving the hub: drop our hash so other pages don't inherit it.
      if (window.location.hash.startsWith(THEORY_HASH_PREFIX)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((next: TheoryRoute) => {
    setRoute(next);
    const hash = buildTheoryHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const primary = themeConfig?.primaryBg || 'bg-gradient-to-r from-indigo-600 to-violet-500';
  const tabs = [
    { id: 'library' as const, label: 'Theory', icon: BookOpenCheck, hint: 'A–Z study library' },
    { id: 'book' as const, label: 'Read as book', icon: BookOpen, hint: 'Chapters, glossary, find' },
    { id: 'exam' as const, label: 'Exam Room', icon: Timer, hint: 'Practice exams' },
    { id: 'courses' as const, label: 'Courses', icon: Award, hint: 'Certified courses' },
  ];

  return (
    <div className="ds-page space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ds-hero text-white px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative space-y-3 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-[11px] font-medium">
            <GraduationCap className="w-3.5 h-3.5" /> Theory &amp; courses
          </span>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight">
            Learn it A to Z. <span className="text-cobalt-300">Then prove it.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            One place for school, TVET/N1–N6 trade theory and university electrical &amp; electronic engineering, with worked
            examples, common mistakes, an AI tutor, timed practice exams and certified courses.
          </p>
        </div>
      </section>

      {/* Sub-page tabs */}
      <div role="tablist" aria-label="Theory and courses sections" className="sticky top-[4.25rem] z-20 flex gap-1 p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-xs w-full sm:w-fit overflow-x-auto no-scrollbar">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = route.tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => navigate({ tab: t.id })}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? `${primary} text-white shadow-xs` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`hidden xl:inline text-xs ${active ? 'text-white/75' : 'text-slate-400'}`}>· {t.hint}</span>
            </button>
          );
        })}
        <RouteLink to="/multimeter" className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Gauge className="w-4 h-4" /><span>Multimeter</span>
        </RouteLink>
      </div>

      {route.tab === 'book' && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] bg-slate-950 flex items-center justify-center text-sm text-slate-400">Opening the book…</div>}>
          <TheoryBook startTopicId={route.topicId} onClose={() => navigate({ tab: 'library' })} onTakeQuiz={subject => navigate({ tab: 'exam', subject })} />
        </Suspense>
      )}
      {(route.tab === 'library' || route.tab === 'book') && (
        <TheoryLibrary
          topicId={route.tab === 'library' ? route.topicId : undefined}
          onOpenTopic={id => navigate({ tab: 'library', topicId: id })}
          onCloseTopic={() => navigate({ tab: 'library' })}
          onStartExam={() => navigate({ tab: 'exam' })}
          onReadInBook={id => navigate({ tab: 'book', topicId: id })}
          primaryClass={primary}
        />
      )}
      {route.tab === 'exam' && (
        <ExamRoom key={route.subject || 'all'} initialSubject={THEORY_SUBJECTS.some(s => s.id === route.subject) ? route.subject as TheorySubjectId : undefined} onStudyTopic={id => navigate({ tab: 'library', topicId: id })} primaryClass={primary} />
      )}
      {route.tab === 'courses' && (
        <Courses courses={courses} onCourseComplete={(id, title) => onCourseComplete?.(id, title)} embedded />
      )}
    </div>
  );
}
