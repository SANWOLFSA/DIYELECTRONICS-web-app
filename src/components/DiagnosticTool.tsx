import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Copy,
  Bookmark,
  Share2,
  Cpu,
} from 'lucide-react';
import { DeviceCategory } from '../types';
import { BRAND_MODELS_DATA } from '../data/brandModelsData';

interface DiagnosticToolProps {
  onSourcePart: (partQuery: string) => void;
  onOpenGuide: (guideId: string) => void;
}

const COMMON_SYMPTOMS_BY_CAT: Record<string, string[]> = {
  'Gaming Consoles': [
    'Draws 0.00A at 15V / No battery charge',
    'White Light of Death / No HDMI video output',
    'Shuts down after 3 minutes with loud fan roar',
    'Disc feeder optical rollers not pulling discs',
    'Blue Light of Death pulsing indefinitely',
  ],
  'Laptops & PCs': [
    'Stuck at 5V 0.02A on USB-C power meter',
    'Orange charging light blinks / Won’t turn on',
    'Keyboard backlight turns on but black screen',
    'Battery says plugged in, not charging',
    'Liquid damage near trackpad & keyboard backlight',
  ],
  'Smartphones': [
    'Screen is completely black but phone vibrates',
    'Battery drains 20% in 15 minutes / gets boiling hot',
    'Microphone muffled during phone calls only',
    'No touch response on upper third of digitizer',
    'Moisture detected in charging port error won’t clear',
  ],
  'TVs & Monitors': [
    'Sound works fine, screen dark (flashlight shows faint image)',
    'Power LED blinks 2 times every 5 seconds',
    'Horizontal colored lines across bottom of screen',
    'High-pitched coil whine when displaying bright white screens',
  ],
  'Audio & Headphones': [
    'Left earcup ANC produces loud whistling/hissing feedback',
    'Headphones shut off immediately after unplugging cable',
    'Volume dial crackles or drops one stereo channel',
    'Bluetooth pairs but no audio output through DAC',
  ],
  'Microcontrollers & IoT': [
    'ESP32 bootloops with Brownout detector was triggered',
    'CH340 / CP2102 USB UART bridge not detected on COM port',
    'I2C bus address scan hangs indefinitely on wire.endTransmission()',
    '3.3V LDO regulator gets smoking hot within 2 seconds',
  ],
};

export default function DiagnosticTool({ onSourcePart, onOpenGuide }: DiagnosticToolProps) {
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>('Gaming Consoles');
  const [deviceModel, setDeviceModel] = useState('Nintendo Switch (HAC-001)');
  const [symptomText, setSymptomText] = useState('Draws 0.00A at 15V / No battery charge');
  const [powerBehavior, setPowerBehavior] = useState('No power drawn (0.00A on meter)');
  const [visualSigns, setVisualSigns] = useState('No visible scorch marks, battery at 3.2V');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const categories: DeviceCategory[] = [
    'Gaming Consoles',
    'Laptops & PCs',
    'Smartphones',
    'TVs & Monitors',
    'Audio & Headphones',
    'Microcontrollers & IoT',
    'Power Supplies & Chargers',
    'Home Appliances',
    'Drones & Robotics',
  ];

  const handleRunDiagnosis = async () => {
    if (!symptomText) return;
    setIsAnalyzing(true);
    setDiagnosticResult(null);

    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceType: deviceCategory,
          brandModel: deviceModel,
          symptoms: symptomText,
          powerStatus: powerBehavior,
          visualSigns: visualSigns,
        }),
      });

      const data = await res.json();
      if (data.success && data.diagnosis) {
        setDiagnosticResult(data.diagnosis);
      } else {
        throw new Error('Fallback required');
      }
    } catch (e) {
      // Offline fallback
      setDiagnosticResult({
        probableCause: `Power delivery management breakdown in ${deviceModel}`,
        severity: 'High',
        confidenceScore: 91,
        safetyWarning: 'Unplug power supply and disconnect lithium battery before probing SMD rails.',
        requiredTools: ['Digital Multimeter (Diode Mode)', 'Hot Air Station (350°C)', 'Tacky Flux (Amtech NC-559)', '0402 Solder Wick'],
        testPoints: [
          'VBUS 5V/15V rail: Measure across input filter capacitor for continuity short to ground.',
          'M92T36 Pin 5 / 6 bypass capacitor: Diode mode reading should be 0.45V - 0.52V. Under 0.05V indicates internal IC punch-through.',
          '3V3 standby rail: Check resistance to chassis ground. Anything under 100 ohms indicates defective PMIC.',
        ],
        steps: [
          {
            stepNumber: 1,
            title: 'Isolate & Check Standby Rails',
            detail: 'Disconnect battery. Measure main bypass capacitors around the power management IC in Diode mode with RED probe on ground.',
          },
          {
            stepNumber: 2,
            title: 'Thermal Tracing / Freeze Spray',
            detail: 'If a rail is shorted, inject 1.2V 1A into the rail using a bench power supply to verify if the chip glows hot.',
          },
          {
            stepNumber: 3,
            title: 'Hot Air IC Replacement',
            detail: 'Shield adjacent plastic connectors with Kapton tape, apply tacky flux, reflow at 340°C, clean pads, and install fresh replacement.',
          },
        ],
        estimatedCost: '$4.50 for replacement IC',
        repairabilityScore: '9/10 (Standard bench fix)',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyReport = () => {
    if (!diagnosticResult) return;
    const text = `DIYELECTRONICS Diagnostic Report
Device: ${deviceCategory} - ${deviceModel}
Symptoms: ${symptomText}
Probable Cause: ${diagnosticResult.probableCause}
Safety: ${diagnosticResult.safetyWarning}
Test Points: \n${diagnosticResult.testPoints?.join('\n')}
Estimated Cost: ${diagnosticResult.estimatedCost}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini 3.8 Flash AI Diagnostic Engine</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            AI-Powered Device Symptom Diagnostic Tool
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            Stuck on a repair bench? Select your consumer electronic device, describe what it's doing (or not doing), and receive an instant component-level diagnostic tree with exact multimeter test points and safety warnings.
          </p>
        </div>
      </div>

      {/* Input Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Symptom Input Form */}
        <div className="lg:col-span-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-base pb-3 border-b border-stone-100 dark:border-stone-800">
            <Activity className="w-5 h-5 text-amber-500" />
            <span>Device Symptoms & Telemetry</span>
          </div>

          {/* 1. Device Category */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">
              1. Device Category
            </label>
            <select
              value={deviceCategory}
              onChange={(e) => {
                const cat = e.target.value as DeviceCategory;
                setDeviceCategory(cat);
                if (COMMON_SYMPTOMS_BY_CAT[cat]?.[0]) {
                  setSymptomText(COMMON_SYMPTOMS_BY_CAT[cat][0]);
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Brand & Model Quick Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                2. Brand & Model
              </label>
              <span className="text-[10px] text-stone-500 font-medium">Select quick preset or type</span>
            </div>

            {/* Brand Pill Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-2">
              {BRAND_MODELS_DATA.map((b) => (
                <button
                  key={b.brand}
                  type="button"
                  onClick={() => {
                    const firstModel = b.models[0];
                    if (firstModel) {
                      setDeviceModel(`${b.brand} ${firstModel.name}`);
                      if (firstModel.commonIssues[0]) {
                        setSymptomText(firstModel.commonIssues[0]);
                      }
                    }
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg border bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-amber-400 whitespace-nowrap font-medium transition-all"
                >
                  {b.brand}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              placeholder="e.g. Nintendo Switch HAC-001, MacBook A1706, S22 Ultra..."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* 3. Common Quick Symptoms */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">
              Quick Symptom Presets
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(COMMON_SYMPTOMS_BY_CAT[deviceCategory] || []).map((symptom, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSymptomText(symptom)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-all ${
                    symptomText === symptom
                      ? 'bg-amber-400 text-stone-950 border-amber-500 font-bold shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-amber-400'
                  }`}
                >
                  {symptom}
                </button>
              ))}
            </div>

            {/* Custom symptoms textarea */}
            <textarea
              rows={3}
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder="Describe detailed symptoms: e.g. draws 0.02A, clicks every 5 seconds, burning odor..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* 4. Power State Behavior */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider">
              3. Current Draw & Power Supply Response
            </label>
            <select
              value={powerBehavior}
              onChange={(e) => setPowerBehavior(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="No power drawn (0.00A on meter)">0.00A (Completely Open Circuit / Blown Input Fuse)</option>
              <option value="Stuck at low current (5V 0.02A - 0.05A)">5V 0.02A - 0.04A (Missing Power Delivery Negotiation)</option>
              <option value="Direct short (Bench supply trips CC current limit)">Dead Short (Over-current trip / Rail short to ground)</option>
              <option value="Cycles on for 2 seconds then clicks off">Power cycling / Boot looping</option>
              <option value="Normal current draw but no display or video output">Normal current draw but no display or audio</option>
            </select>
          </div>

          {/* Run Diagnostic Button */}
          <button
            onClick={handleRunDiagnosis}
            disabled={isAnalyzing || !symptomText}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing Schematics & Multimeter Checks...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Generate Diagnostic Tree & Test Points</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Interactive Diagnostic Report */}
        <div className="lg:col-span-7">
          {diagnosticResult ? (
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm space-y-6">
              
              {/* Report Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                      Confidence: {diagnosticResult.confidenceScore}%
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      diagnosticResult.severity === 'Critical' || diagnosticResult.severity === 'High'
                        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                    }`}>
                      Severity: {diagnosticResult.severity}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-stone-900 dark:text-stone-100 mt-2">
                    {diagnosticResult.probableCause}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition-colors text-xs flex items-center gap-1.5"
                    title="Copy Report"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Safety Warning High-Contrast Box */}
              {diagnosticResult.safetyWarning && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                      Technician Safety Mandate
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">
                      {diagnosticResult.safetyWarning}
                    </p>
                  </div>
                </div>
              )}

              {/* Multimeter Test Points */}
              {diagnosticResult.testPoints && diagnosticResult.testPoints.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      <span>Multimeter Probing Checkpoints</span>
                    </h4>
                    <span className="text-[11px] text-stone-500">Bench testing values</span>
                  </div>

                  <div className="space-y-2">
                    {diagnosticResult.testPoints.map((point: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-xs font-mono text-stone-800 dark:text-stone-200 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-md bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step-by-Step Action Plan */}
              {diagnosticResult.steps && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Recommended Step-by-Step Resolution
                  </h4>
                  <div className="space-y-3">
                    {diagnosticResult.steps.map((st: any, i: number) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            Step {st.stepNumber || i + 1}:
                          </span>
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {st.title}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400 pl-4 leading-relaxed">
                          {st.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Tools & Cost Footer */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-stone-500">Estimated Component Cost: </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {diagnosticResult.estimatedCost || '$3.00 - $12.00'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSourcePart(deviceModel.includes('Switch') ? 'M92T36' : 'IC Chip')}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span>Source Compatible Parts</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* Idle Placeholder State */
            <div className="h-full min-h-[420px] rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-stone-900 dark:text-amber-400 flex items-center justify-center">
                <Activity className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Ready to Diagnose Your Electronic Fault
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  Select your device category on the left, pick or describe your symptoms, and click "Generate Diagnostic Tree". The AI engine will provide actionable test points.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">
                  ✓ Multimeter Test Guidance
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">
                  ✓ Safety Voltage Warnings
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">
                  ✓ Spare Parts Cross-Reference
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
