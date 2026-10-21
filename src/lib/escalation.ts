/**
 * Step-by-step escalation format used for every fix the app shows:
 *   Solution A (easiest / most likely) -> If A didn't work: Solution B -> If B didn't work: Solution C
 *   -> Still not fixed? Ask the AI technician.
 * Each step has a short bold action title and one or two plain sentences: what to do, where to
 * touch, what you should see, and why.
 */
export interface EscalationStep { title: string; detail: string }
export interface EscalationStage {
  label: 'A' | 'B' | 'C';
  /** What this solution targets (e.g. the likely cause). */
  heading: string;
  steps: EscalationStep[];
}

export const STAGE_LABELS = ['A', 'B', 'C'] as const;

/** "Solution A" / "If A didn't work: Solution B" / "If B didn't work: Solution C". */
export function stageTitle(label: EscalationStage['label']): string {
  if (label === 'A') return 'Solution A';
  return `If ${label === 'B' ? 'A' : 'B'} didn't work: Solution ${label}`;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Short bold action title from an instruction sentence ("Check the fuse: …" -> "Check the fuse"). */
export function actionTitle(sentence: string): string {
  const s = clean(sentence);
  const colon = s.indexOf(':');
  if (colon > 3 && colon <= 60) return s.slice(0, colon).trim();
  const firstSentence = s.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, '');
  if (firstSentence.length <= 56) return firstSentence;
  const clause = firstSentence.split(/[,;(—–]| - | then /)[0].trim();
  if (clause.length >= 8 && clause.length <= 56) return clause;
  const words = firstSentence.split(' ');
  return words.slice(0, 7).join(' ') + (words.length > 7 ? '…' : '');
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'its', 'are', 'was', 'not', 'one', 'all', 'any', 'off', 'out', 'use', 'replace', 'check', 'fault', 'failed', 'failing', 'faulty', 'broken', 'worn', 'board', 'same', 'new']);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };
const plainCause = (c: string) => lowerFirst(c.replace(/\s*\([^)]*\)/g, '').replace(/\.$/, '').trim());
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/**
 * Turns a fault's causes (most likely first), tests and fixes into Solutions A, B and C.
 * Solution n checks cause n (test n) and then fixes it with the fix steps that best match that cause
 * (word overlap, falling back to order). Each step gets a plain "why / what next" line. Extra tests
 * go to the last solution; a solution with no matching fix gets a "repair what the check found" step.
 */
export function buildEscalation(input: { causes: string[]; tests: string[]; fix: string[] }): EscalationStage[] {
  const causes = input.causes.map(clean).filter(Boolean);
  const tests = input.tests.map(clean).filter(Boolean);
  const fixes = input.fix.map(clean).filter(Boolean);
  const n = Math.min(3, Math.max(causes.length, fixes.length, tests.length ? 1 : 0));
  if (!n) return [];
  // Assign each fix to the stage whose cause (and test) it shares most words with; ties keep list order.
  const stageWords = Array.from({ length: n }, (_, i) => new Set([...words(causes[i] || ''), ...words(tests[i] || '')]));
  const fixesFor: string[][] = Array.from({ length: n }, () => []);
  fixes.forEach((f, fi) => {
    const fw = words(f);
    let best = Math.min(fi, n - 1), bestScore = -1;
    for (let i = 0; i < n; i++) {
      const score = overlap(fw, stageWords[i]) * 10 - Math.abs(i - fi);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (overlap(fw, stageWords[best]) === 0) best = Math.min(fi, n - 1);
    fixesFor[best].push(f);
  });
  const stages: EscalationStage[] = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const cause = causes[i];
    const myTests = last ? tests.slice(i) : tests.slice(i, i + 1);
    const steps: EscalationStep[] = [];
    for (const t of myTests) {
      steps.push({
        title: actionTitle(t),
        detail: `${sentence(t)} ${cause ? `Why: this shows whether the fault is ${plainCause(cause)}.` : 'Why: this shows where the fault is before you replace anything.'}`,
      });
    }
    for (const f of fixesFor[i]) {
      steps.push({ title: actionTitle(f), detail: `${sentence(f)} Then put it back together, switch on and test: if it works normally, you are done.` });
    }
    if (!fixesFor[i].length && myTests.length) {
      steps.push({ title: 'Repair what the check found', detail: 'If the check above shows this is the fault, replace or repair that part with one of exactly the same rating (see Parts on this page). Then switch on and test: if it works normally, you are done.' });
    }
    if (!steps.length) continue;
    stages.push({ label: STAGE_LABELS[stages.length], heading: cause || (i === 0 ? 'Most likely fix' : 'Next most likely fix'), steps });
  }
  return stages;
}

/** In-app link that opens the AI technician chat with the problem typed in (the user presses send). */
export function askAiUrl(problem: string): string {
  return `/ai-assistant?ask=${encodeURIComponent(problem.slice(0, 1500))}`;
}

/** Plain-text prompt for the AI technician describing a fault and what was already tried. */
export function askAiPrompt(opts: { device?: string; problem: string; tried?: EscalationStage[] }): string {
  const tried = opts.tried?.length ? ` I already tried: ${opts.tried.map((s) => `Solution ${s.label} (${s.heading})`).join(', ')}, and it is still not fixed.` : '';
  return `${opts.device ? `${opts.device}: ` : ''}${opts.problem}.${tried} What should I do next? Please guide me step by step.`;
}
