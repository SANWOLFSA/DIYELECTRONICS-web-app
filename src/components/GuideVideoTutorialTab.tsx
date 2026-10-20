import { aiFetch } from '../lib/aiFetch';
import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  Wrench,
  AlertTriangle,
  Gauge,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Youtube,
  ExternalLink,
} from 'lucide-react';
import type { Guide } from '../types';
import type { AIVideoTutorial, AIVideoTutorialResponse } from '../aiRepairTypes';

interface GuideVideoTutorialTabProps {
  guide: Guide;
}

/** Same query shape the server uses, so the link works even when the AI request fails. */
function youtubeSearchFor(guide: Guide): string {
  const q = [guide.deviceModel, guide.issueType || guide.title, 'repair']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export default function GuideVideoTutorialTab({ guide }: GuideVideoTutorialTabProps) {
  const [tutorial, setTutorial] = useState<AIVideoTutorial | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>(() => youtubeSearchFor(guide));
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let isMounted = true;
    setYoutubeUrl(youtubeSearchFor(guide));
    const fetchTutorial = async () => {
      setLoading(true);
      setError(null);
      setTutorial(null);
      try {
        const res = await aiFetch('/api/repair/video-tutorial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guideId: guide.id,
            title: guide.title,
            deviceModel: guide.deviceModel,
            deviceCategory: guide.deviceCategory,
            issueType: guide.issueType,
            steps: guide.steps,
            toolsRequired: guide.toolsRequired,
          }),
        });
        const data: AIVideoTutorialResponse = await res.json().catch(() => ({ success: false }));
        if (!isMounted) return;
        const yt = data.tutorial?.youtubeSearchUrl || data.youtubeSearchUrl;
        if (yt) setYoutubeUrl(yt);
        if (!res.ok || !data.success || !data.tutorial || !Array.isArray(data.tutorial.chapters)) {
          throw new Error(
            data.error ||
              (res.status === 503
                ? 'The AI walkthrough service is unavailable right now.'
                : 'Could not load the AI walkthrough.'),
          );
        }
        setTutorial(data.tutorial);
      } catch (err: any) {
        if (!isMounted) return;
        setError(
          err instanceof TypeError
            ? 'Network error: could not reach the walkthrough service.'
            : err?.message || 'Could not load the AI walkthrough.',
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTutorial();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.id, guide.title, guide.deviceModel, guide.deviceCategory, guide.issueType, reloadKey]);

  const youtubeButton = (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shrink-0"
    >
      <Youtube className="w-4 h-4" />
      <span>Watch repair videos on YouTube</span>
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );

  const hasValue = (v?: string) => !!v && !/^not needed$/i.test(v.trim());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 text-stone-100 border border-stone-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI-written walkthrough
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {tutorial ? tutorial.title : `Walkthrough: ${guide.title}`}
          </h2>
          <p className="text-xs text-stone-300">
            A chapter-by-chapter text walkthrough generated from this guide. For video, open a YouTube search for this repair.
          </p>
        </div>
        {youtubeButton}
      </div>

      {loading ? (
        <div aria-live="polite" className="py-20 flex flex-col items-center justify-center space-y-4 rounded-3xl bg-stone-900/40 border border-stone-800 text-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-stone-200">Writing walkthrough…</p>
            <p className="text-xs text-stone-400 max-w-sm">Breaking the {guide.deviceModel} repair into chapters.</p>
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-800 dark:text-red-300">{error}</p>
              <p className="text-xs text-red-700 dark:text-red-400">
                You can still follow the written steps in this guide, or search YouTube for videos of this repair.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            <button
              type="button"
              onClick={retry}
              className="px-3 py-2 rounded-xl border border-red-300 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              Try again
            </button>
            {youtubeButton}
          </div>
        </div>
      ) : !tutorial || tutorial.chapters.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 text-center space-y-3">
          <p className="text-sm text-stone-600 dark:text-stone-400">No walkthrough is available for this guide yet.</p>
          {youtubeButton}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-stone-900 dark:text-stone-100">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Chapters ({tutorial.chapters.length})</span>
            </div>
            <ol className="space-y-3">
              {tutorial.chapters.map((chapter, idx) => (
                <li
                  key={chapter.id || idx}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800/50 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-md bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug">{chapter.title}</h3>
                      <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{chapter.actionSummary}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
                        {chapter.benchTool && (
                          <span className="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-amber-500" />
                            {chapter.benchTool}
                          </span>
                        )}
                        {chapter.multimeterMode && (
                          <span className="text-amber-700 dark:text-amber-400 font-mono">{chapter.multimeterMode}</span>
                        )}
                      </div>
                      {chapter.targetComponents && chapter.targetComponents.length > 0 && (
                        <p className="text-[11px] text-stone-500">Components: {chapter.targetComponents.join(', ')}</p>
                      )}
                      {chapter.cautionNotice && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{chapter.cautionNotice}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-stone-500">
              AI-generated. Values marked typical can differ by board revision; check the device's schematic.
            </p>
          </div>

          <div className="lg:col-span-4 space-y-4">
            {tutorial.benchSafetyProtocol && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider text-[10px] block">Safety</span>
                  <p className="text-stone-700 dark:text-stone-300">{tutorial.benchSafetyProtocol}</p>
                </div>
              </div>
            )}

            {(hasValue(tutorial.magnificationLevel) || hasValue(tutorial.hotAirReworkTemp)) && (
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-xs space-y-2">
                {hasValue(tutorial.magnificationLevel) && (
                  <p className="flex items-start gap-2 text-stone-700 dark:text-stone-300">
                    <Gauge className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span><span className="font-bold">Magnification:</span> {tutorial.magnificationLevel}</span>
                  </p>
                )}
                {hasValue(tutorial.hotAirReworkTemp) && (
                  <p className="flex items-start gap-2 text-stone-700 dark:text-stone-300">
                    <Thermometer className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span><span className="font-bold">Hot air:</span> {tutorial.hotAirReworkTemp}</span>
                  </p>
                )}
              </div>
            )}

            {tutorial.keyTakeaways && tutorial.keyTakeaways.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Key Takeaways</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                  {tutorial.keyTakeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
