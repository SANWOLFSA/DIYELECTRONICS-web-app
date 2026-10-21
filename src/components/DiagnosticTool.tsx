import { aiFetch } from '../lib/aiFetch';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Activity, Sparkles, ShieldAlert, Wrench, Copy, ArrowRight, Volume2, AlertTriangle } from 'lucide-react';
import { useBenchSpeech, playBenchBeep, speakBenchText } from '../hooks/useBenchSpeech';
import HandsFreeBenchHUD from './HandsFreeBenchHUD';
import EscalationSolutions from './EscalationSolutions';
import { askAiPrompt, type EscalationStage } from '../lib/escalation';

const PRESETS: Record<string, string[]> = {
  "Gaming Consoles": [
    "Draws 0.00A at 15V / No battery charge",
    "White Light of Death / No HDMI video output",
    "Shuts down after 3 minutes with loud fan roar",
    "Disc feeder optical rollers not pulling discs",
    "Blue Light of Death pulsing indefinitely"
  ],
  "Laptops & PCs": [
    "Stuck at 5V 0.02A on USB-C power meter",
    "Orange charging light blinks / Won’t turn on",
    "Keyboard backlight turns on but black screen",
    "Battery says plugged in, not charging",
    "Liquid damage near trackpad & keyboard backlight"
  ],
  "Smartphones": [
    "Screen is completely black but phone vibrates",
    "Battery drains 20% in 15 minutes / gets boiling hot",
    "Microphone muffled during phone calls only",
    "No touch response on upper third of digitizer",
    "Moisture detected in charging port error won’t clear"
  ],
  "TVs & Monitors": [
    "Sound works fine, screen dark (flashlight shows faint image)",
    "Power LED blinks 2 times every 5 seconds",
    "Horizontal colored lines across bottom of screen",
    "High-pitched coil whine when displaying bright white screens"
  ],
  "Audio & Headphones": [
    "Left earcup ANC produces loud whistling/hissing feedback",
    "Headphones shut off immediately after unplugging cable",
    "Volume dial crackles or drops one stereo channel",
    "Bluetooth pairs but no audio output through DAC"
  ],
  "Microcontrollers & IoT": [
    "ESP32 bootloops with Brownout detector was triggered",
    "CH340 / CP2102 USB UART bridge not detected on COM port",
    "I2C bus address scan hangs indefinitely on wire.endTransmission()",
    "3.3V LDO regulator gets smoking hot within 2 seconds"
  ]
};

const CATEGORIES = [
  "Gaming Consoles",
  "Laptops & PCs",
  "Smartphones",
  "TVs & Monitors",
  "Audio & Headphones",
  "Microcontrollers & IoT",
  "Power Supplies & Chargers",
  "Home Appliances",
  "Drones & Robotics"
];

const BRANDS = ["Apple", "Sony", "Nintendo", "Samsung", "Dell", "Microsoft", "Lenovo", "Asus", "DJI", "LG"];

interface DiagnosisStep { stepNumber: number; title: string; detail: string }
interface DiagnosisResult {
  probableCause: string;
  otherPossibleCauses: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  safetyWarning: string;
  requiredTools: string[];
  testPoints: string[];
  steps: DiagnosisStep[];
  /** Solution A -> B -> C (newer server responses). */
  solutions?: EscalationStage[];
  partToSource: string;
  whenToStop: string;
}

export default function DiagnosticTool({ onSourcePart }: { onSourcePart: (p: string) => void; onOpenGuide?: (id: string) => void }) {
  const [category, setCategory] = useState("Gaming Consoles");
  const [model, setModel] = useState("");
  const [symptom, setSymptom] = useState("");
  const [powerStatus, setPowerStatus] = useState("");
  const [visualSigns, setVisualSigns] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-fill first preset when category changes
  // When the category changes, only replace the symptom if it was empty or one of the canned presets
  useEffect(() => {
    const list = PRESETS[category] || [];
    setSymptom(prev => {
      const isPreset = !prev.trim() || Object.values(PRESETS).some(arr => arr.includes(prev));
      return isPreset ? (list[0] || '') : prev;
    });
  }, [category]);

  const handleDiagnose = useCallback(async () => {
    if (!symptom.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    playBenchBeep('step');
    try {
      const response = await aiFetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, model, symptom, powerStatus, visualSigns }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.diagnosis) {
        throw new Error(data?.error || (response.status === 503
          ? 'The AI diagnostic service is unavailable right now. Please try again in a moment.'
          : 'Could not get a diagnosis. Please try again.'));
      }
      setResult(data.diagnosis as DiagnosisResult);
      playBenchBeep('pass');
    } catch (err: any) {
      const msg = err instanceof TypeError
        ? 'Network error: could not reach the diagnostic service. Check your connection and try again.'
        : (err?.message || 'Could not get a diagnosis. Please try again.');
      setError(msg);
      playBenchBeep('fail');
    } finally {
      setLoading(false);
    }
  }, [category, model, symptom, powerStatus, visualSigns, loading]);

  const handleCopyReport = useCallback(() => {
    if (!result) return;
    const reportText = `DIY ELECTRONICS DIAGNOSTIC REPORT
Device Model: ${model}
Symptom: ${symptom}
Probable Cause: ${result.probableCause}
Safety Warning: ${result.safetyWarning}
Test Points:
${result.testPoints.map((tp: string, idx: number) => ` ${idx + 1}. ${tp}`).join('\n')}
${result.partToSource ? `Part to source: ${result.partToSource}\n` : ''}${result.whenToStop ? `When to stop: ${result.whenToStop}\n` : ''}Generated by AI. Verify measurements against the device's schematic before replacing parts.`;

    navigator.clipboard?.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setError('Could not copy to the clipboard in this browser.'));
  }, [model, result, symptom]);

  // Voice Commands Configuration for Diagnostic Tool
  const voiceCommands = useMemo(() => [
    {
      keywords: ['run diagnosis', 'diagnose', 'start diagnosis', 'diagnose symptom', 'analyze fault', 'test board'],
      description: 'Run Diagnostic Tree',
      action: () => {
        handleDiagnose();
      }
    },
    {
      keywords: ['category gaming', 'gaming consoles', 'consoles'],
      description: 'Select Gaming Consoles',
      action: () => {
        setCategory("Gaming Consoles");
        speakBenchText("Category set to Gaming Consoles.");
      }
    },
    {
      keywords: ['category laptops', 'laptops and pcs', 'laptops', 'computers'],
      description: 'Select Laptops & PCs',
      action: () => {
        setCategory("Laptops & PCs");
        speakBenchText("Category set to Laptops and PCs.");
      }
    },
    {
      keywords: ['category smartphones', 'smartphones', 'phones', 'mobile'],
      description: 'Select Smartphones',
      action: () => {
        setCategory("Smartphones");
        speakBenchText("Category set to Smartphones.");
      }
    },
    {
      keywords: ['category tvs', 'monitors', 'tvs and monitors', 'displays'],
      description: 'Select TVs & Monitors',
      action: () => {
        setCategory("TVs & Monitors");
        speakBenchText("Category set to TVs and Monitors.");
      }
    },
    {
      keywords: ['category audio', 'headphones', 'sound'],
      description: 'Select Audio & Headphones',
      action: () => {
        setCategory("Audio & Headphones");
        speakBenchText("Category set to Audio and Headphones.");
      }
    },
    {
      keywords: ['category iot', 'microcontrollers', 'esp32', 'arduino'],
      description: 'Select Microcontrollers & IoT',
      action: () => {
        setCategory("Microcontrollers & IoT");
        speakBenchText("Category set to Microcontrollers and IoT.");
      }
    },
    {
      keywords: ['read diagnosis', 'read results', 'speak diagnosis', 'what is the issue', 'diagnosis summary'],
      description: 'Read Full Diagnostic Results',
      action: () => {
        if (result) {
          const text = `Diagnostic result for ${model}: Probable cause is ${result.probableCause}. Severity is ${result.severity}. Safety mandate: ${result.safetyWarning}. First test point: ${result.testPoints?.[0] || 'See screen'}.`;
          speakBenchText(text);
        } else {
          speakBenchText("No diagnostic report generated yet. Say 'run diagnosis' to start.");
        }
      }
    },
    {
      keywords: ['read test points', 'multimeter test points', 'probe checkpoints', 'test points'],
      description: 'Read Multimeter Test Points',
      action: () => {
        if (result && result.testPoints) {
          const points = result.testPoints.join('. ');
          speakBenchText(`Multimeter Checkpoints: ${points}`);
        } else {
          speakBenchText("No test points available. Run diagnosis first.");
        }
      }
    },
    {
      keywords: ['read steps', 'repair steps', 'resolution steps', 'fix steps'],
      description: 'Read Repair Resolution Steps',
      action: () => {
        if (result && result.steps) {
          const stepsText = result.steps.map((s: any, idx: number) => `Step ${idx + 1}: ${s.title}. ${s.detail}`).join('. ');
          speakBenchText(`Recommended steps: ${stepsText}`);
        } else {
          speakBenchText("No resolution steps available yet.");
        }
      }
    },
    {
      keywords: ['safety warning', 'warning', 'safety mandate'],
      description: 'Read Safety Warning',
      action: () => {
        if (result && result.safetyWarning) {
          speakBenchText(`Safety Warning: ${result.safetyWarning}`);
        } else {
          speakBenchText("Always isolate lithium batteries and disconnect power before probing.");
        }
      }
    },
    {
      keywords: ['copy report', 'copy diagnostic', 'copy text'],
      description: 'Copy Report to Clipboard',
      action: () => {
        handleCopyReport();
        speakBenchText("Diagnostic report copied to clipboard.");
      }
    },
    {
      keywords: ['source parts', 'buy part', 'find part'],
      description: 'Source Replacement Component',
      action: () => {
        if (result?.partToSource) {
          onSourcePart(result.partToSource);
          speakBenchText("Opening spare parts search.");
        } else {
          speakBenchText("No specific part identified yet. Run a diagnosis first.");
        }
      }
    }
  ], [handleDiagnose, handleCopyReport, model, onSourcePart, result]);

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

  // Auto-announce diagnostic result when complete if voice enabled
  useEffect(() => {
    if (result && isListening && isTtsEnabled) {
      speakText(`Diagnosis complete. Probable cause: ${result.probableCause}. Severity: ${result.severity}.`);
    }
  }, [result, isListening, isTtsEnabled, speakText]);

  const cheatSheetCommands = [
    { phrase: 'run diagnosis', action: 'Trigger AI schematic diagnostic tree' },
    { phrase: 'category [gaming / laptops / phones]', action: 'Select target device archetype' },
    { phrase: 'read diagnosis', action: 'Speak diagnosed probable cause and severity' },
    { phrase: 'read test points', action: 'Speak multimeter probe checks out loud' },
    { phrase: 'read steps', action: 'Speak step-by-step resolution walk' },
    { phrase: 'copy report', action: 'Copy diagnostic report to clipboard' },
    { phrase: 'source parts', action: 'Search spare parts for the suggested component' }
  ];

  return (
    <div className="ds-page space-y-6">
      {/* Hands-Free Voice Control HUD */}
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
        benchContextTitle="Hardware Diagnostic Bench • Hands-Free Voice Control"
      />

      <div className="ds-hero text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>AI Diagnostic Assistant</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">AI-Powered Device Symptom Diagnostic Tool</h1>
          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Stuck on a repair bench? Select your consumer electronic device, describe what it's doing (or not doing), and get likely causes, multimeter test points, and safety warnings from AI. Always confirm readings against the device's schematic.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-base pb-3 border-b border-stone-100 dark:border-stone-800">
            <Activity className="w-5 h-5 text-amber-500" />
            <span>Device & Symptoms</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="diag-category" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">1. Device Category</label>
              <select id="diag-category"
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt-500 font-medium"
              >
                {CATEGORIES.map(cat => <option key={tabIndexKey(cat)} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="diag-model" className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">2. Brand & Model</label>
                <span className="text-[10px] text-stone-500 font-medium">Tap a brand to start</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-2">
                {BRANDS.map(brand => (
                  <button 
                    key={brand}
                    type="button" 
                    onClick={() => {
                      setModel(`${brand} `);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg border bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-cobalt-400 whitespace-nowrap font-medium transition-all"
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <input 
                id="diag-model"
                type="text" 
                value={model} 
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. Nintendo Switch HAC-001, MacBook A1706, S22 Ultra..."
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cobalt-500"
              />
            </div>

            <div>
              <label htmlFor="diag-symptom" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">Symptoms <span className="normal-case font-medium text-stone-500">(pick a common one or describe your own)</span></label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(PRESETS[category] || []).map((p, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    onClick={() => setSymptom(p)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-all ${symptom === p ? "bg-cobalt-600 text-white border-amber-500 font-bold shadow-xs" : "bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-cobalt-400"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <textarea 
                id="diag-symptom"
                rows={3} 
                value={symptom} 
                onChange={e => setSymptom(e.target.value)}
                placeholder="Describe detailed symptoms: e.g. draws 0.02A, clicks every 5 seconds, burning odor..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-cobalt-500"
              />
            </div>

            <div>
              <label htmlFor="diag-power" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">3. Current Draw & Power Supply Response</label>
              <select id="diag-power"
                value={powerStatus} 
                onChange={e => setPowerStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-cobalt-500"
              >
                <option value="">Not measured / don't know</option>
                <option value="No power drawn (0.00A on meter)">0.00A (Completely Open Circuit / Blown Input Fuse)</option>
                <option value="Stuck at low current (5V 0.02A - 0.05A)">5V 0.02A - 0.04A (Missing Power Delivery Negotiation)</option>
                <option value="Direct short (Bench supply trips CC current limit)">Dead Short (Over-current trip / Rail short to ground)</option>
                <option value="Cycles on for 2 seconds then clicks off">Power cycling / Boot looping</option>
                <option value="Normal current draw but no display or video output">Normal current draw but no display or audio</option>
              </select>
            </div>

            <div>
              <label htmlFor="diag-visual" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">4. Visual Signs <span className="normal-case font-medium text-stone-500">(optional)</span></label>
              <input
                id="diag-visual"
                type="text"
                value={visualSigns}
                onChange={e => setVisualSigns(e.target.value)}
                placeholder="e.g. scorch mark near charge port, swollen battery, corrosion"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-cobalt-500"
              />
            </div>

            <button 
              onClick={handleDiagnose} 
              type="button"
              disabled={loading || !symptom.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                  <span>Diagnosing…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>Generate Diagnostic Tree & Test Points</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7">
          {error && !loading && (
            <div role="alert" className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                <button type="button" onClick={handleDiagnose} className="text-xs font-bold text-red-700 dark:text-red-300 underline">Try again</button>
              </div>
            </div>
          )}
          {loading ? (
            <div aria-live="polite" className="h-full min-h-[420px] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-stone-600 dark:text-stone-400">Working out likely causes and test points…</p>
            </div>
          ) : result ? (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold">AI-generated</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${result.severity === "Critical" || result.severity === "High" ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"}`}>Severity: {result.severity}</span>
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-2">{result.probableCause}</h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Diagnostic result for ${model}: Probable cause is ${result.probableCause}. Severity is ${result.severity}. Safety warning: ${result.safetyWarning}. Test point 1: ${result.testPoints?.[0] || 'none'}.`;
                      speakText(text);
                    }}
                    className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 transition-colors text-xs flex items-center gap-1.5 font-bold"
                    title="Read Results Aloud"
                  >
                    <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Read Aloud</span>
                  </button>
                  <button 
                    onClick={handleCopyReport}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition-colors text-xs flex items-center gap-1.5"
                    title="Copy Report"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied ? "Copied!" : "Copy Report"}</span>
                  </button>
                </div>
              </div>

              {result.safetyWarning && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Safety First</h4>
                    <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">{result.safetyWarning}</p>
                  </div>
                </div>
              )}

              {result.testPoints && result.testPoints.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <span>Multimeter Probing Checkpoints</span>
                    </h4>
                    <span className="text-[11px] text-stone-500">Typical values; confirm with the schematic</span>
                  </div>
                  <div className="space-y-2">
                    {result.testPoints.map((tp: string, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-xs font-mono text-stone-800 dark:text-stone-200 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">{idx + 1}</span>
                        <span className="leading-relaxed">{tp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.solutions && result.solutions.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">Fix it step by step</h4>
                  <EscalationSolutions
                    stages={result.solutions}
                    askPrompt={askAiPrompt({ device: [category, model].filter(Boolean).join(' '), problem: `${symptom}${result.probableCause ? ` (the diagnostic tool suggested: ${result.probableCause})` : ''}`, tried: result.solutions })}
                  />
                </div>
              ) : result.steps && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">Recommended Step-by-Step Resolution</h4>
                  <div className="space-y-3">
                    {result.steps.map((step: any, idx: number) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step {step.stepNumber || idx + 1}:</span>
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{step.title}</span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400 pl-4 leading-relaxed">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.otherPossibleCauses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">Other Possible Causes</h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-stone-600 dark:text-stone-400">
                    {result.otherPossibleCauses.map((c, idx) => <li key={idx}>{c}</li>)}
                  </ul>
                </div>
              )}

              {result.requiredTools.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">Tools You'll Need</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.requiredTools.map((t, idx) => (
                      <span key={idx} className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.whenToStop && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                  <span className="font-bold">When to stop: </span>{result.whenToStop}
                </div>
              )}

              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <p className="text-stone-500 max-w-sm">AI-generated guidance. Check readings against the device's schematic before replacing parts.</p>
                {result.partToSource && (
                  <button
                    type="button"
                    onClick={() => onSourcePart(result.partToSource)}
                    className="px-4 py-2 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span>Find "{result.partToSource}" in Spare Parts</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[420px] rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-stone-900 dark:text-amber-400 flex items-center justify-center">
                <Activity className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Ready to Diagnose Your Electronic Fault</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  Select your device category on the left, pick or describe your symptoms, and click "Generate Diagnostic Tree". You'll get likely causes and test points to check.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">✓ Multimeter Test Guidance</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">✓ Safety Voltage Warnings</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">✓ Parts to Look For</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tabIndexKey(str: string) {
  return str.replace(/\s+/g, '-').toLowerCase();
}
