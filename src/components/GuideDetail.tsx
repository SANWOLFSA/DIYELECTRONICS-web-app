import { useState, useMemo, useCallback } from 'react';
import { WhereToBuy } from './PartsFinderPanels';
import { 
  X, Clock, Leaf, ArrowLeft, ArrowRight, 
  CheckCircle, ShieldAlert, Award, Bookmark, BookmarkCheck,
  Volume2
} from 'lucide-react';
import VideoTutorial from './VideoTutorial';
import AiProTipsPanel from './AiProTipsPanel';
import GuideVideoTutorialTab from './GuideVideoTutorialTab';
import { useBenchSpeech, playBenchBeep, speakBenchText } from '../hooks/useBenchSpeech';
import HandsFreeBenchHUD from './HandsFreeBenchHUD';
import type { Guide } from '../types';

export default function GuideDetail({ 
  guide, 
  onClose, 
  onCompleteRepair, 
  onSourcePart, 
  onToggleSaveGuide, 
  isSaved 
}: { 
  guide: Guide; 
  onClose: () => void; 
  onCompleteRepair: (eWasteSaved: number) => void; 
  onSourcePart: (pn: string) => void; 
  onToggleSaveGuide: (g: Guide) => void; 
  isSaved: boolean; 
}) {
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showAiWalkthrough, setShowAiWalkthrough] = useState(false);
  const [multimeterChecked, setMultimeterChecked] = useState<boolean | null>(null);
  const [repairLogged, setRepairLogged] = useState(false);

  const activeStep = guide.steps[activeStepIdx];

  const handleNextStep = useCallback(() => {
    if (activeStepIdx < guide.steps.length - 1) {
      setActiveStepIdx(prev => prev + 1);
      setMultimeterChecked(null);
      playBenchBeep('step');
    }
  }, [activeStepIdx, guide.steps.length]);

  const handlePrevStep = useCallback(() => {
    if (activeStepIdx > 0) {
      setActiveStepIdx(prev => prev - 1);
      setMultimeterChecked(null);
      playBenchBeep('step');
    }
  }, [activeStepIdx]);

  const handleLogRepairComplete = useCallback(() => {
    onCompleteRepair(guide.eWasteSavedKg);
    setRepairLogged(true);
    playBenchBeep('pass');
  }, [guide.eWasteSavedKg, onCompleteRepair]);

  // Voice Commands Configuration for Bench Hands-Free Operation
  const voiceCommands = useMemo(() => [
    {
      keywords: ['next step', 'next', 'forward', 'proceed', 'continue'],
      description: 'Advance to Next Step',
      action: () => handleNextStep()
    },
    {
      keywords: ['previous step', 'previous', 'back', 'prior step', 'go back'],
      description: 'Go to Previous Step',
      action: () => handlePrevStep()
    },
    {
      keywords: ['read step', 'read', 'speak step', 'explain step', 'what step', 'instructions'],
      description: 'Read Current Step Out Loud',
      action: () => {
        const text = `Step ${activeStep.stepNumber} of ${guide.steps.length}: ${activeStep.title}. ${activeStep.description}. ${activeStep.safetyWarning ? `Warning: ${activeStep.safetyWarning}` : ''} ${activeStep.multimeterCheck ? `Multimeter check: Probe mode is ${activeStep.multimeterCheck.mode}. Expected target value is ${activeStep.multimeterCheck.expectedValue}.` : ''}`;
        speakBenchText(text);
      }
    },
    {
      keywords: ['safety warning', 'warning', 'danger', 'caution'],
      description: 'Read Safety Warning',
      action: () => {
        if (activeStep.safetyWarning) {
          speakBenchText(`Safety Warning: ${activeStep.safetyWarning}`);
        } else {
          speakBenchText("No specific safety warning for this step.");
        }
      }
    },
    {
      keywords: ['pro tip', 'tip', 'bench tip', 'advice'],
      description: 'Read Pro-Tip',
      action: () => {
        if (activeStep.proTip) {
          speakBenchText(`Bench Pro-Tip: ${activeStep.proTip}`);
        } else {
          speakBenchText("No pro-tip listed for this step.");
        }
      }
    },
    {
      keywords: ['read multimeter', 'multimeter', 'test point', 'meter check', 'probe check', 'expected value'],
      description: 'Read Multimeter Target',
      action: () => {
        if (activeStep.multimeterCheck) {
          speakBenchText(`Multimeter mode: ${activeStep.multimeterCheck.mode}. Place Red probe on ${activeStep.multimeterCheck.probeRed}, Black probe on ${activeStep.multimeterCheck.probeBlack}. Expected target value is ${activeStep.multimeterCheck.expectedValue}.`);
        } else {
          speakBenchText("No multimeter check required for this step.");
        }
      }
    },
    {
      keywords: ['multimeter yes', 'yes', 'pass', 'passed', 'good reading', 'target matches', 'voltage matches', 'good'],
      description: 'Confirm Multimeter Reading (Pass)',
      action: () => {
        setMultimeterChecked(true);
        playBenchBeep('pass');
        speakBenchText("Multimeter reading confirmed good.");
      }
    },
    {
      keywords: ['multimeter no', 'no', 'fail', 'failed', 'bad reading', 'short circuit', 'shorted', 'wrong reading', 'bad'],
      description: 'Flag Multimeter Reading (Fail)',
      action: () => {
        setMultimeterChecked(false);
        playBenchBeep('fail');
        speakBenchText("Multimeter check flagged as failed. Component requires desoldering or IC replacement.");
      }
    },
    {
      keywords: ['play video', 'pause video', 'video', 'watch video', 'tutorial video'],
      description: 'Toggle Tutorial Video',
      action: () => {
        setIsVideoPlaying(prev => !prev);
      }
    },
    {
      keywords: ['log repair', 'complete repair', 'finish repair', 'done repair', 'job done'],
      description: 'Log Successful Repair',
      action: () => {
        handleLogRepairComplete();
        speakBenchText("Congratulations! Successful repair logged to your profile.");
      }
    },
    {
      keywords: ['close guide', 'exit guide', 'close modal', 'back to guides'],
      description: 'Close Guide',
      action: () => {
        onClose();
      }
    }
  ], [activeStep, guide.steps.length, handleNextStep, handlePrevStep, handleLogRepairComplete, onClose]);

  const {
    isListening,
    isSupported,
    lastTranscript,
    matchedCommand,
    isSpeaking,
    isTtsEnabled,
    setIsTtsEnabled,
    micPermissionDenied,
    toggleListening,
    speakText,
    stopSpeaking,
    simulateVoiceCommand
  } = useBenchSpeech({ commands: voiceCommands });

  const cheatSheetCommands = [
    { phrase: 'next step', action: 'Advance to next teardown step' },
    { phrase: 'previous step', action: 'Go back one step' },
    { phrase: 'read step', action: 'Speak current instructions aloud' },
    { phrase: 'safety warning', action: 'Hear high-voltage / thermal cautions' },
    { phrase: 'multimeter check', action: 'Hear expected diode drop / voltage' },
    { phrase: 'yes / pass', action: 'Mark multimeter probe passed' },
    { phrase: 'no / fail', action: 'Mark multimeter probe shorted / failed' },
    { phrase: 'toggle video', action: 'Play or pause bench walkthrough' },
    { phrase: 'log repair', action: 'Save completed repair & e-waste points' },
    { phrase: 'close guide', action: 'Exit back to guides' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[95vh] rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 overflow-y-auto space-y-6 shadow-2xl flex flex-col justify-between">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6 flex-1">
          {/* Hands-Free Bench Voice HUD */}
          <HandsFreeBenchHUD
            isListening={isListening}
            isSupported={isSupported}
            isSpeaking={isSpeaking}
            isTtsEnabled={isTtsEnabled}
            lastTranscript={lastTranscript}
            matchedCommand={matchedCommand}
            micPermissionDenied={micPermissionDenied}
            availableCommands={cheatSheetCommands}
            onToggleListening={toggleListening}
            onToggleTts={() => setIsTtsEnabled(!isTtsEnabled)}
            onStopSpeaking={stopSpeaking}
            onSimulateCommand={simulateVoiceCommand}
            benchContextTitle={`Step ${activeStep.stepNumber}/${guide.steps.length} • Hands-Free Active`}
          />

          <div className="space-y-3 pb-4 border-b border-stone-200 dark:border-stone-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider">{guide.deviceCategory}</span>
                <span className="text-stone-500 font-medium">Model: {guide.deviceModel}</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 leading-tight">{guide.title}</h1>
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-1">
                <span className="flex items-center gap-1 font-mono"><Clock className="w-4 h-4 text-amber-500" /> {guide.estimatedTimeMinutes} Min</span>
                <span className="flex items-center gap-1 font-mono"><Leaf className="w-4 h-4 text-emerald-500" /> {guide.eWasteSavedKg} Kg E-waste saved</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">Difficulty: {guide.difficulty}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => onToggleSaveGuide(guide)} 
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isSaved ? 'bg-cobalt-600 text-white shadow-md' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'}`}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                <span>{isSaved ? "Saved Offline" : "Bookmark Offline"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Required Tools & Consumables</h3>
                <ul className="space-y-1.5 text-xs">
                  {guide.toolsRequired.map((t, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">▪</span>
                      <span className="text-stone-700 dark:text-stone-300 font-medium">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {guide.partsRequired && guide.partsRequired.length > 0 && (
                <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Spare Parts Needed</h3>
                  <div className="space-y-2">
                    {guide.partsRequired.map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-stone-800 dark:text-stone-200 block">{p.name}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{p.partNumber}</span>
                        </div>
                        <button 
                          onClick={() => onSourcePart(p.partNumber)}
                          className="px-2.5 py-1.5 rounded-lg bg-cobalt-600 text-white font-bold text-[10px]"
                        >
                          Source
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guide.partsRequired && guide.partsRequired.length > 0 && (
                <WhereToBuy text={guide.partsRequired.map(p => `${p.name} ${p.partNumber}`).join('\n')} />
              )}

              <AiProTipsPanel
                deviceModel={guide.deviceModel}
                deviceCategory={guide.deviceCategory}
                issueType={guide.issueType}
              />
            </div>

            <div className="lg:col-span-8 space-y-6">
              {guide.videoUrl && isVideoPlaying ? (
                <div className="rounded-2xl overflow-hidden aspect-video relative bg-stone-950 border border-stone-800">
                  <VideoTutorial videoUrl={guide.videoUrl} onClose={() => setIsVideoPlaying(false)} />
                </div>
              ) : guide.videoUrl ? (
                <div className="rounded-2xl overflow-hidden aspect-video relative bg-stone-950 border border-stone-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <img src={guide.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 filter blur-xs" />
                  <button
                    type="button"
                    onClick={() => setIsVideoPlaying(true)}
                    aria-label="Play guide video"
                    className="relative z-10 w-14 h-14 rounded-full bg-cobalt-600 hover:bg-cobalt-500 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-6 h-6 fill-current pl-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 4l12 6-12 6V4z"/></svg>
                  </button>
                  <span className="relative z-10 text-xs text-stone-200 font-bold">Watch guide video</span>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden aspect-video relative bg-stone-950 border border-stone-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <img src={guide.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 filter blur-xs" />
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${guide.deviceModel} ${guide.issueType || guide.title} repair`.slice(0, 200))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 6-12 6V4z"/></svg>
                    <span>Find repair videos on YouTube</span>
                  </a>
                  <span className="relative z-10 text-[11px] text-stone-300">We don't host a video for this guide yet. This opens a YouTube search.</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAiWalkthrough(v => !v)}
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/50"
              >
                {showAiWalkthrough ? 'Hide AI Chaptered Walkthrough' : 'Show AI Chaptered Walkthrough'}
              </button>
              {showAiWalkthrough && <GuideVideoTutorialTab guide={guide} />}

              <div className="p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4">
                <div className="flex justify-between items-center pb-2.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">STEP {activeStep.stepNumber} OF {guide.steps.length}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const text = `Step ${activeStep.stepNumber} of ${guide.steps.length}: ${activeStep.title}. ${activeStep.description}. ${activeStep.safetyWarning ? `Warning: ${activeStep.safetyWarning}` : ''} ${activeStep.multimeterCheck ? `Multimeter mode: ${activeStep.multimeterCheck.mode}. Target: ${activeStep.multimeterCheck.expectedValue}.` : ''}`;
                        speakText(text);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                      title="Read this step out loud"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Read Aloud</span>
                    </button>
                    <span className="text-[10px] text-stone-400 uppercase font-bold">Guided Flow</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">{activeStep.title}</h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed font-normal">{activeStep.description}</p>
                </div>

                {activeStep.safetyWarning && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 flex gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Technician Safety Warning:</span>
                      <p className="mt-0.5 leading-relaxed font-normal">{activeStep.safetyWarning}</p>
                    </div>
                  </div>
                )}

                {activeStep.proTip && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/30 text-xs text-emerald-900 dark:text-emerald-300 flex gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Bench Pro-Tip:</span>
                      <p className="mt-0.5 leading-relaxed font-normal">{activeStep.proTip}</p>
                    </div>
                  </div>
                )}

                {activeStep.multimeterCheck && (
                  <div className="p-5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 space-y-3">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Multimeter Diagnostic Validation</span>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-stone-400 block text-[9px] uppercase font-bold">Multimeter Mode</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">{activeStep.multimeterCheck.mode}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[9px] uppercase font-bold">Probing Strategy</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">Red: {activeStep.multimeterCheck.probeRed}</span>
                        <span className="block text-stone-500 text-[10px]">Black: {activeStep.multimeterCheck.probeBlack}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-stone-900 rounded-lg text-xs font-mono text-center">
                      <span className="text-stone-400 text-[10px] block uppercase font-bold">Expected Target Value</span>
                      <span className="text-sm font-bold text-amber-400">{activeStep.multimeterCheck.expectedValue}</span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
                      <span className="font-bold text-stone-700 dark:text-stone-300">Are you reading the expected value?</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setMultimeterChecked(true)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${multimeterChecked === true ? "bg-emerald-500 border-emerald-500 text-white font-bold" : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-850 hover:border-emerald-400 text-stone-600 dark:text-stone-300"}`}
                        >
                          Yes (Move to Next Step)
                        </button>
                        <button 
                          onClick={() => setMultimeterChecked(false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${multimeterChecked === false ? "bg-red-500 border-red-500 text-white font-bold" : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-850 hover:border-red-400 text-stone-600 dark:text-stone-300"}`}
                        >
                          No (Requires desoldering/IC swap)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
          <button 
            disabled={activeStepIdx === 0}
            onClick={handlePrevStep}
            className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-cobalt-400 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          {activeStepIdx < guide.steps.length - 1 ? (
            <button 
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              disabled={repairLogged}
              onClick={handleLogRepairComplete}
              className="px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Award className="w-4 h-4" />
              <span>{repairLogged ? "Repair Logged Successfully!" : "Log Successful Repair"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
