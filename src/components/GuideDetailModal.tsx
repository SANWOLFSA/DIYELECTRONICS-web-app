import { useState } from 'react';
import {
  X,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  Lightbulb,
  Share2,
  Play,
  Pause,
  ArrowRight,
  Leaf,
  Layers,
  Sparkles,
  SidebarClose,
  SidebarOpen,
  Video,
  FileText,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';
import { RepairGuide } from '../types';
import ProTipsSidebar from './ProTipsSidebar';
import GuideVideoTutorialTab from './GuideVideoTutorialTab';

interface GuideDetailModalProps {
  guide: RepairGuide | null;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (guide: RepairGuide) => void;
  onSourcePart: (partNumber: string) => void;
  onCompleteRepair?: (eWasteKg: number) => void;
}

export default function GuideDetailModal({
  guide,
  onClose,
  isSaved,
  onToggleSave,
  onSourcePart,
  onCompleteRepair,
}: GuideDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'video'>('guide');
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);
  const [gatheredTools, setGatheredTools] = useState<string[]>([]);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showProTipsSidebar, setShowProTipsSidebar] = useState<boolean>(true);

  if (!guide) return null;

  const toggleToolGathered = (toolName: string) => {
    if (gatheredTools.includes(toolName)) {
      setGatheredTools(gatheredTools.filter((t) => t !== toolName));
    } else {
      setGatheredTools([...gatheredTools, toolName]);
    }
  };

  const markAllToolsGathered = () => {
    if (gatheredTools.length === guide.toolsRequired.length) {
      setGatheredTools([]);
    } else {
      setGatheredTools([...guide.toolsRequired]);
    }
  };

  const toggleStep = (index: number) => {
    if (completedStepIndices.includes(index)) {
      setCompletedStepIndices(completedStepIndices.filter((i) => i !== index));
    } else {
      const next = [...completedStepIndices, index];
      setCompletedStepIndices(next);
      if (next.length === guide.steps.length) {
        setShowCelebration(true);
        if (onCompleteRepair) {
          onCompleteRepair(guide.eWasteSavedKg);
        }
      }
    }
  };

  const progressPercent = Math.round((completedStepIndices.length / guide.steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[94vh] rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Sticky Header Bar */}
        <div className="sticky top-0 z-20 px-6 py-3.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-stone-950 text-amber-400 font-bold text-xs">
              {guide.deviceCategory}
            </span>
            <span className="text-xs text-stone-500 font-mono hidden sm:inline">
              Model: {guide.deviceModel}
            </span>
          </div>

          {/* Navigation Tabs (Step-by-Step Guide vs AI Video Tutorial) */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200 dark:border-stone-700/80">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'guide'
                  ? 'bg-white dark:bg-stone-900 text-stone-950 dark:text-amber-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bench Steps</span>
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'video'
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Tutorial</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Pro-Tips Sidebar button (visible in guide tab) */}
            {activeTab === 'guide' && (
              <button
                onClick={() => setShowProTipsSidebar(!showProTipsSidebar)}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  showProTipsSidebar
                    ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-amber-400'
                }`}
                title="Toggle Pro-Tips Sidebar"
              >
                <Lightbulb className={`w-4 h-4 ${showProTipsSidebar ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">
                  {showProTipsSidebar ? 'Hide Pro-Tips' : 'Show Pro-Tips'}
                </span>
              </button>
            )}

            <button
              onClick={() => onToggleSave(guide)}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isSaved
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
              title="Save for offline bench work"
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
              <span className="hidden sm:inline">{isSaved ? 'Saved Offline' : 'Save Offline'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Content Rendering */}
        {activeTab === 'video' ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <GuideVideoTutorialTab guide={guide} />
          </div>
        ) : (
          /* Main Body: Flex row containing Scrollable Guide Content and Pro-Tips Sidebar */
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

          
          {/* Scrollable Guide Content Container */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          
          {/* Title and Metadata */}
          <div className="space-y-3">
            <h1 className="text-xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 leading-tight">
              {guide.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1 font-mono font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Est. {guide.estimatedTimeMinutes} mins
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <Leaf className="w-3.5 h-3.5" />
                Diverts {guide.eWasteSavedKg} kg E-Waste
              </span>
              <span>•</span>
              <span className="font-medium">
                By <strong className="text-stone-800 dark:text-stone-200">{guide.author.name}</strong> ({guide.author.badge})
              </span>
            </div>
          </div>

          {/* Video Player & Bench Tutorial Screen */}
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-stone-950 border border-stone-800 shadow-lg group">
            {isPlayingVideo ? (
              <video
                src={guide.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="relative w-full h-full cursor-pointer" onClick={() => setIsPlayingVideo(true)}>
                <img
                  src={guide.thumbnailUrl}
                  alt={guide.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 fill-current ml-1" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                    Watch Step-by-Step Bench Video
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('video');
                    }}
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-400"
                  >
                    Or open full interactive AI Video Tutorial with Chapters →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bench Progress Checklist Bar */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-stone-800/80 border border-amber-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-xs">
                <span>Bench Repair Progress:</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">
                  {completedStepIndices.length} of {guide.steps.length} steps completed ({progressPercent}%)
                </span>
              </div>
              <div className="w-full sm:w-64 h-2 bg-stone-200 dark:bg-stone-700 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {showCelebration && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Device Repaired! E-Waste Diverted!</span>
              </div>
            )}
          </div>

          {/* Tools & Required Spare Parts Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required Bench Tools Checklist */}
            <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Required Bench Tools</span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold transition-colors ${
                    gatheredTools.length === guide.toolsRequired.length
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30'
                  }`}>
                    {gatheredTools.length}/{guide.toolsRequired.length} Ready
                  </span>
                </div>

                <button
                  type="button"
                  onClick={markAllToolsGathered}
                  className="text-[11px] font-bold text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  {gatheredTools.length === guide.toolsRequired.length ? 'Reset All' : 'Select All'}
                </button>
              </div>

              {/* Tools Checklist Progress Bar */}
              <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    gatheredTools.length === guide.toolsRequired.length
                      ? 'bg-emerald-500'
                      : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${guide.toolsRequired.length > 0 ? (gatheredTools.length / guide.toolsRequired.length) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Interactive Tool Checkboxes */}
              <div className="space-y-1.5 pt-1">
                {guide.toolsRequired.map((t, i) => {
                  const isGathered = gatheredTools.includes(t);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleToolGathered(t)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all text-left border ${
                        isGathered
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-stone-900 dark:text-emerald-200 shadow-2xs'
                          : 'bg-white dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-amber-400/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                            isGathered
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800'
                          }`}
                        >
                          {isGathered && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`truncate font-medium ${isGathered ? 'line-through text-stone-400 dark:text-stone-500' : ''}`}>
                          {t}
                        </span>
                      </div>
                      <span className={`text-[10px] uppercase font-bold shrink-0 ${
                        isGathered ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'
                      }`}>
                        {isGathered ? 'Gathered' : 'Check off'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {gatheredTools.length === guide.toolsRequired.length && (
                <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All bench tools prepared! You are ready to start teardown.</span>
                </div>
              )}
            </div>

            {/* Required Spare Parts with 1-Click Source Button */}
            <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Components & Spare Parts</span>
              </div>
              <div className="space-y-2">
                {guide.partsRequired.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900 dark:text-stone-100 block">
                        {p.name}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400">
                        P/N: {p.partNumber} ({p.priceApprox})
                      </span>
                    </div>

                    <button
                      onClick={() => onSourcePart(p.partNumber)}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <span>Source</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Steps List */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Interactive Teardown & Repair Steps
            </h3>

            <div className="space-y-4">
              {guide.steps.map((st, idx) => {
                const isCompleted = completedStepIndices.includes(idx);

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCompleted
                        ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleStep(idx)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                            isCompleted
                              ? 'bg-emerald-500 text-white'
                              : 'border-2 border-stone-300 dark:border-stone-700 hover:border-amber-400'
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div className="space-y-1">
                          <h4 className={`text-sm font-bold ${
                            isCompleted ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-stone-900 dark:text-stone-100'
                          }`}>
                            Step {st.stepNumber}: {st.title}
                          </h4>
                          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                            {st.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Multimeter Probing Card if present */}
                    {st.multimeterCheck && (
                      <div className="mt-3.5 p-3 rounded-xl bg-stone-950 text-stone-100 font-mono text-xs space-y-1.5 border border-stone-800">
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Multimeter Probing ({st.multimeterCheck.mode})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-red-400 font-bold">RED Probe: </span>
                            <span className="text-stone-300">{st.multimeterCheck.probeRed}</span>
                          </div>
                          <div>
                            <span className="text-stone-400 font-bold">BLACK Probe: </span>
                            <span className="text-stone-300">{st.multimeterCheck.probeBlack}</span>
                          </div>
                          <div>
                            <span className="text-emerald-400 font-bold">Expected: </span>
                            <span className="text-white font-bold">{st.multimeterCheck.expectedValue}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Safety Warning */}
                    {st.safetyWarning && (
                      <div className="mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span><strong>Safety:</strong> {st.safetyWarning}</span>
                      </div>
                    )}

                    {/* Pro Tip */}
                    {st.proTip && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span><strong>Pro Tip:</strong> {st.proTip}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          </div>

          {/* Pro-Tips Sidebar (Dynamically fetches common mistakes for this device model) */}
          {showProTipsSidebar && (
            <ProTipsSidebar
              deviceModel={guide.deviceModel}
              deviceCategory={guide.deviceCategory}
              issueType={guide.issueType}
            />
          )}

        </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-3.5 bg-stone-100 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
          <span className="text-stone-500">
            Support Right to Repair. Keep electronics out of toxic landfills.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-950 text-white dark:bg-amber-400 dark:text-stone-950 font-bold hover:opacity-90 transition-opacity"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
