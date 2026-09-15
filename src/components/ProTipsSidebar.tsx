import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Gauge,
  Thermometer,
  ChevronRight,
  Info,
  Wrench,
} from 'lucide-react';
import { ProTipsResponse, ProTipMistake } from '../types';

interface ProTipsSidebarProps {
  deviceModel: string;
  deviceCategory: string;
  issueType: string;
}

export default function ProTipsSidebar({
  deviceModel,
  deviceCategory,
  issueType,
}: ProTipsSidebarProps) {
  const [data, setData] = useState<ProTipsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMistakeTab, setActiveMistakeTab] = useState<string | null>(null);

  const fetchProTips = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/repair/pro-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceModel, deviceCategory, issueType }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (json.commonMistakes && json.commonMistakes.length > 0) {
          setActiveMistakeTab(json.commonMistakes[0].id);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch pro-tips');
      }
    } catch (err: any) {
      console.error('Error fetching pro-tips:', err);
      setError('Could not load dynamic tips.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProTips();
  }, [deviceModel, deviceCategory, issueType]);

  const getRiskBadge = (level: ProTipMistake['riskLevel']) => {
    switch (level) {
      case 'Critical Damage':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800';
      case 'High Risk':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700';
    }
  };

  return (
    <aside
      id="pro-tips-sidebar"
      className="w-full lg:w-84 xl:w-96 shrink-0 flex flex-col bg-stone-50 dark:bg-stone-900/90 border-t lg:border-t-0 lg:border-l border-stone-200 dark:border-stone-800 p-5 space-y-5 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center font-bold">
            <Lightbulb className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-tight">
              Bench Pro-Tips
            </h3>
            <p className="text-[10px] text-stone-500 font-medium truncate max-w-[190px]">
              Model-specific pitfalls & specs
            </p>
          </div>
        </div>

        <button
          onClick={fetchProTips}
          disabled={isLoading}
          title="Refresh model tips"
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="h-28 rounded-2xl bg-stone-200 dark:bg-stone-800" />
          <div className="h-24 rounded-2xl bg-stone-200 dark:bg-stone-800" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Telemetry Error</span>
          </div>
          <p className="text-[11px]">{error}</p>
          <button
            onClick={fetchProTips}
            className="text-[11px] font-bold underline hover:no-underline text-red-700 dark:text-red-300"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && data && (
        <div className="space-y-5">
          {/* Executive Risk Summary */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[10px]">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Target: {data.deviceModel}</span>
            </div>
            <p className="text-stone-700 dark:text-stone-300 text-xs leading-relaxed font-medium">
              {data.summary}
            </p>
          </div>

          {/* Torque / Temp Specs Badge Card */}
          {data.torqueOrTempSpecs && data.torqueOrTempSpecs.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Bench Parameters & Limits
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {data.torqueOrTempSpecs.map((spec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 text-xs"
                  >
                    <span className="text-stone-600 dark:text-stone-300 font-medium">
                      {spec.label}
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {spec.spec}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Mistakes Specific to Model */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Common Model Mistakes ({data.commonMistakes.length})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                Critical
              </span>
            </div>

            <div className="space-y-2.5">
              {data.commonMistakes.map((m) => {
                const isOpen = activeMistakeTab === m.id;

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800/80 overflow-hidden shadow-xs transition-all"
                  >
                    <button
                      onClick={() => setActiveMistakeTab(isOpen ? null : m.id)}
                      className="w-full text-left p-3 flex items-start justify-between gap-2 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getRiskBadge(
                              m.riskLevel
                            )}`}
                          >
                            {m.riskLevel}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {m.componentOrArea}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug">
                          {m.mistakeTitle}
                        </h4>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-stone-400 shrink-0 mt-1 transition-transform ${
                          isOpen ? 'rotate-90' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-stone-100 dark:border-stone-700 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block">
                            Why Techs Fail:
                          </span>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                            {m.whyItHappens}
                          </p>
                        </div>

                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Prevention Rule:</span>
                          </div>
                          <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium leading-relaxed">
                            {m.preventionTip}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Do's & Don'ts */}
          {data.benchDoAndDonts && data.benchDoAndDonts.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Bench Do's & Don'ts
              </span>
              <div className="space-y-2">
                {data.benchDoAndDonts.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-[11px] space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="leading-snug font-medium text-stone-800 dark:text-stone-200">
                        {rule.doTip}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400 pt-1 border-t border-stone-100 dark:border-stone-700/60">
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="leading-snug text-stone-600 dark:text-stone-400">
                        {rule.dontMistake}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Attribution */}
          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>AI & Bench Verified</span>
            </span>
            <span className="font-mono">{data.source}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
