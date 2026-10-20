// Lazy loaders for the Electrical Theory library and Exam Room question bank.
// Every content file is imported dynamically, so Vite splits it into its own chunk
// and nothing here lands in the main bundle until the Theory hub is opened.
import type { TheoryLevel, TheoryQuestion, TheoryTopic } from './types';

export * from './types';
export * from './meta';

const topicLoaders: Array<() => Promise<{ default: TheoryTopic[] }>> = [
  () => import('./topics/fundamentals'),
  () => import('./topics/dc-circuits'),
  () => import('./topics/fields'),
  () => import('./topics/ac-circuits'),
  () => import('./topics/machines'),
  () => import('./topics/power-installation'),
  () => import('./topics/measurement-electronics'),
  () => import('./topics/digital-signals'),
];

const questionLoaders: Record<TheoryLevel, () => Promise<{ default: TheoryQuestion[] }>> = {
  school: () => import('./questions/school'),
  college: () => import('./questions/college'),
  university: () => import('./questions/university'),
};

let topicsPromise: Promise<TheoryTopic[]> | null = null;

/** Loads every topic (cached after the first call), sorted A–Z by title. */
export function loadAllTopics(): Promise<TheoryTopic[]> {
  if (!topicsPromise) {
    topicsPromise = Promise.all(topicLoaders.map(load => load()))
      .then(mods => mods.flatMap(m => m.default).sort((a, b) => a.title.localeCompare(b.title)))
      .catch(err => {
        topicsPromise = null; // allow retry
        throw err;
      });
  }
  return topicsPromise;
}

let orderedPromise: Promise<TheoryTopic[]> | null = null;

/** Loads every topic in authored (teaching) order, chapter by chapter. Used by the Theory book. */
export function loadTopicsInOrder(): Promise<TheoryTopic[]> {
  if (!orderedPromise) {
    orderedPromise = Promise.all(topicLoaders.map(load => load()))
      .then(mods => mods.flatMap(m => m.default))
      .catch(err => {
        orderedPromise = null;
        throw err;
      });
  }
  return orderedPromise;
}

const questionCache: Partial<Record<TheoryLevel, Promise<TheoryQuestion[]>>> = {};

/** Loads the seeded question bank for one level (cached). */
export function loadQuestions(level: TheoryLevel): Promise<TheoryQuestion[]> {
  if (!questionCache[level]) {
    questionCache[level] = questionLoaders[level]()
      .then(m => m.default)
      .catch(err => {
        delete questionCache[level];
        throw err;
      });
  }
  return questionCache[level]!;
}

/** Checks a numeric answer against a question's tolerance. */
export function isNumericAnswerCorrect(given: number, answer: number, tolerance: number): boolean {
  if (!Number.isFinite(given)) return false;
  if (tolerance <= 0) return Math.abs(given - answer) < 1e-6 * Math.max(1, Math.abs(answer));
  if (answer === 0) return Math.abs(given) <= tolerance;
  return Math.abs(given - answer) <= Math.abs(answer) * tolerance;
}

/** Best-effort validation of untrusted question objects (e.g. from the AI route). */
export function sanitizeQuestion(raw: unknown, fallback: Pick<TheoryQuestion, 'level' | 'subject' | 'topicId'>, id: string): TheoryQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
  const solution = typeof q.solution === 'string' ? q.solution.trim() : '';
  if (!prompt || !solution) return null;
  const base = {
    id,
    level: fallback.level,
    subject: fallback.subject,
    topicId: typeof q.topicId === 'string' && q.topicId ? q.topicId : fallback.topicId,
    difficulty: typeof q.difficulty === 'number' ? Math.min(3, Math.max(1, Math.round(q.difficulty))) : 2,
    prompt,
    solution,
    aiGenerated: true,
  };
  if (q.type === 'mcq' && Array.isArray(q.options)) {
    const options = q.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).slice(0, 6);
    const answerIndex = typeof q.answerIndex === 'number' ? q.answerIndex : -1;
    if (options.length < 2 || answerIndex < 0 || answerIndex >= options.length) return null;
    return { ...base, type: 'mcq', options, answerIndex };
  }
  if (q.type === 'numeric') {
    const answer = typeof q.answer === 'number' ? q.answer : Number(q.answer);
    if (!Number.isFinite(answer)) return null;
    const tolerance = typeof q.tolerance === 'number' && q.tolerance >= 0 && q.tolerance <= 0.2 ? q.tolerance : 0.02;
    return { ...base, type: 'numeric', answer, unit: typeof q.unit === 'string' ? q.unit : '', tolerance };
  }
  return null;
}
