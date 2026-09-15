import { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  RotateCcw,
  Zap,
  Gauge,
  Sliders,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  Flame,
  Battery,
} from 'lucide-react';

interface PresetCircuit {
  id: string;
  name: string;
  description: string;
  voltage: number;
  resistance: number;
  switchState: boolean;
  hasCapacitor: boolean;
  capMicrofarads: number;
}

const PRESETS: PresetCircuit[] = [
  {
    id: 'p1',
    name: '1. LED Current Limiting & Ohm’s Law',
    description: 'Learn how resistor value controls current flow to prevent blowing the LED.',
    voltage: 5.0,
    resistance: 220,
    switchState: true,
    hasCapacitor: false,
    capMicrofarads: 100,
  },
  {
    id: 'p2',
    name: '2. RC Time Constant & Capacitor Charging',
    description: 'Watch the capacitor charge up exponentially following V(t) = V0(1 - e^(-t/RC)).',
    voltage: 9.0,
    resistance: 1000,
    switchState: true,
    hasCapacitor: true,
    capMicrofarads: 220,
  },
  {
    id: 'p3',
    name: '3. Voltage Divider & Sensor Bias',
    description: 'Demonstrates splitting a 12V rail into a safe 3.3V reference for microcontrollers.',
    voltage: 12.0,
    resistance: 470,
    switchState: true,
    hasCapacitor: false,
    capMicrofarads: 10,
  },
  {
    id: 'p4',
    name: '4. Short-Circuit Protection & Over-Current',
    description: 'See what happens when resistance drops to near-zero (dead short condition).',
    voltage: 5.0,
    resistance: 15,
    switchState: true,
    hasCapacitor: false,
    capMicrofarads: 10,
  },
];

export default function CircuitSimulator() {
  const [voltage, setVoltage] = useState<number>(5.0);
  const [resistance, setResistance] = useState<number>(220);
  const [switchClosed, setSwitchClosed] = useState<boolean>(true);
  const [hasCapacitor, setHasCapacitor] = useState<boolean>(false);
  const [capMicrofarads, setCapMicrofarads] = useState<number>(100);
  const [capChargeVolt, setCapChargeVolt] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>('p1');
  const [meterMode, setMeterMode] = useState<'voltage' | 'current' | 'power'>('voltage');

  // Realistic LED parameters: Forward voltage Vf = 2.0V (Standard Amber/Yellow LED)
  const forwardVoltage = 2.0;
  
  // Calculate current based on switch and resistance
  // When switch is open, I = 0
  // When switch closed: I = (V - Vf) / R
  let currentAmps = 0;
  if (switchClosed && voltage > forwardVoltage && resistance > 0) {
    currentAmps = (voltage - forwardVoltage) / resistance;
  }
  const currentMilliAmps = Math.max(0, currentAmps * 1000);
  const powerWatts = currentAmps * voltage;
  const isBlown = currentMilliAmps > 35; // Overcurrent threshold
  const isLit = switchClosed && currentMilliAmps >= 2 && !isBlown;

  // Capacitor charging simulation loop
  useEffect(() => {
    let interval: any;
    if (hasCapacitor) {
      interval = setInterval(() => {
        setCapChargeVolt((prev) => {
          if (!switchClosed) {
            // Discharge through internal leakage
            return Math.max(0, prev * 0.95);
          }
          // RC charging: target is voltage
          const diff = voltage - prev;
          const tau = (resistance * (capMicrofarads * 1e-6)) * 20; // scaled for responsive UI
          const step = diff * 0.1;
          return Math.min(voltage, prev + step);
        });
      }, 100);
    } else {
      setCapChargeVolt(0);
    }
    return () => clearInterval(interval);
  }, [hasCapacitor, switchClosed, voltage, resistance, capMicrofarads]);

  const applyPreset = (preset: PresetCircuit) => {
    setActivePreset(preset.id);
    setVoltage(preset.voltage);
    setResistance(preset.resistance);
    setSwitchClosed(preset.switchState);
    setHasCapacitor(preset.hasCapacitor);
    setCapMicrofarads(preset.capMicrofarads);
    setCapChargeVolt(0);
  };

  // Resistor 4-band color calculation
  const getResistorColors = (ohms: number) => {
    // 1st digit, 2nd digit, multiplier
    const digits = Math.round(ohms).toString();
    const d1 = parseInt(digits[0] || '1', 10);
    const d2 = parseInt(digits[1] || '0', 10);
    const multExp = digits.length - 2;

    const COLOR_MAP: Record<number, { name: string; bg: string }> = {
      0: { name: 'Black', bg: '#000000' },
      1: { name: 'Brown', bg: '#8B4513' },
      2: { name: 'Red', bg: '#DC2626' },
      3: { name: 'Orange', bg: '#EA580C' },
      4: { name: 'Yellow', bg: '#EAB308' },
      5: { name: 'Green', bg: '#16A34A' },
      6: { name: 'Blue', bg: '#2563EB' },
      7: { name: 'Violet', bg: '#7C3AED' },
      8: { name: 'Gray', bg: '#6B7280' },
      9: { name: 'White', bg: '#F3F4F6' },
    };

    return {
      band1: COLOR_MAP[d1] || COLOR_MAP[1],
      band2: COLOR_MAP[d2] || COLOR_MAP[0],
      band3: COLOR_MAP[Math.max(0, multExp)] || COLOR_MAP[1],
      tolerance: { name: 'Gold (5%)', bg: '#D4AF37' },
    };
  };

  const resistorBands = getResistorColors(resistance);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold mb-2">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span>Interactive Electronics Bench</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100">
            Live Interactive Circuit Simulation Lab
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Build, probe, and test circuit behaviors in real-time. Practice Ohm's Law, diagnose shorts, and prevent fried components.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === p.id
                  ? 'bg-amber-400 text-stone-950 shadow-sm scale-102'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              {p.name.split('.')[0]}. Preset
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Circuit Controls */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* DC Power Supply Box */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
                <Battery className="w-4 h-4 text-amber-500" />
                <span>Bench Power Supply (V_IN)</span>
              </div>
              <span className="text-sm font-mono font-black text-amber-600 dark:text-amber-400">
                {voltage.toFixed(1)} V
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={voltage}
              onChange={(e) => setVoltage(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-stone-400 font-mono">
              <span>0V (GND)</span>
              <span>3.3V (Logic)</span>
              <span>5.0V (USB)</span>
              <span>12V</span>
              <span>24V (Max)</span>
            </div>
          </div>

          {/* Resistor Controls with Color Bands */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100 text-sm">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span>Current Limiting Resistor (R1)</span>
              </div>
              <span className="text-sm font-mono font-black text-amber-600 dark:text-amber-400">
                {resistance >= 1000 ? `${(resistance / 1000).toFixed(1)} kΩ` : `${resistance} Ω`}
              </span>
            </div>

            <input
              type="range"
              min="10"
              max="2000"
              step="10"
              value={resistance}
              onChange={(e) => setResistance(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400 cursor-pointer"
            />

            {/* Visual Resistor Body with Color Bands */}
            <div className="p-3 bg-stone-100 dark:bg-stone-800/60 rounded-xl flex items-center justify-center gap-2">
              <div className="w-8 h-0.5 bg-stone-400" />
              <div className="relative w-24 h-7 bg-[#d2b48c] rounded-md shadow-xs flex items-center justify-around px-2 border border-stone-400">
                <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band1.bg }} title={resistorBands.band1.name} />
                <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band2.bg }} title={resistorBands.band2.name} />
                <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band3.bg }} title={resistorBands.band3.name} />
                <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.tolerance.bg }} title="Gold (5%)" />
              </div>
              <div className="w-8 h-0.5 bg-stone-400" />
            </div>
            <p className="text-[10px] text-center text-stone-500">
              Bands: {resistorBands.band1.name} - {resistorBands.band2.name} - {resistorBands.band3.name} - Gold
            </p>
          </div>

          {/* Switch & Capacitor Toggles */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Circuit Knife Switch (SW1)</span>
              <button
                onClick={() => setSwitchClosed(!switchClosed)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  switchClosed
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {switchClosed ? 'CLOSED (ON)' : 'OPEN (OFF)'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Add Electrolytic Capacitor (C1)</span>
              <button
                onClick={() => setHasCapacitor(!hasCapacitor)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  hasCapacitor
                    ? 'bg-amber-400 text-stone-950 font-black'
                    : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {hasCapacitor ? '100 µF Added' : 'None'}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Visual Schematic Board & Multimeter */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Breadboard Visual Canvas */}
          <div className="relative bg-stone-900 rounded-3xl border border-stone-800 p-6 sm:p-8 overflow-hidden min-h-[360px] flex flex-col justify-between">
            {/* Background Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(#facc15 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Top Bar: Live Circuit State Banner */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${switchClosed ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs font-mono text-stone-300 font-bold">
                  {switchClosed ? 'CIRCUIT ENERGIZED' : 'CIRCUIT DISCONNECTED'}
                </span>
              </div>

              {isBlown && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-700 text-red-300 text-xs font-black animate-bounce">
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                  <span>OVERCURRENT! LED BLOWN ({currentMilliAmps.toFixed(1)} mA)</span>
                </div>
              )}
            </div>

            {/* Visual Schematic Components Layout */}
            <div className="relative z-10 py-8 flex flex-col sm:flex-row items-center justify-around gap-6">
              
              {/* Component 1: Power Source */}
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-20 rounded-xl bg-stone-800 border-2 border-amber-400 flex flex-col items-center justify-center p-2 shadow-lg">
                  <span className="text-[10px] font-black text-amber-400 uppercase">DC V_IN</span>
                  <span className="text-xs font-mono font-bold text-white">{voltage.toFixed(1)}V</span>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs font-bold text-red-400">+</span>
                    <span className="text-xs font-bold text-stone-400">-</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-stone-400">Power Source</span>
              </div>

              {/* Wire with current animation */}
              <div className="relative w-12 h-1 bg-stone-700 overflow-hidden hidden sm:block">
                {switchClosed && currentMilliAmps > 0 && (
                  <div className="absolute inset-0 bg-amber-400 animate-pulse" />
                )}
              </div>

              {/* Component 2: Switch */}
              <div className="flex flex-col items-center space-y-2">
                <div 
                  onClick={() => setSwitchClosed(!switchClosed)}
                  className="w-14 h-14 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center cursor-pointer hover:border-amber-400 transition-colors"
                >
                  <div className={`w-8 h-2 rounded transition-transform ${switchClosed ? 'bg-emerald-400 rotate-0' : 'bg-red-400 -rotate-30 origin-left'}`} />
                </div>
                <span className="text-[11px] font-mono text-stone-400">
                  Switch ({switchClosed ? 'Closed' : 'Open'})
                </span>
              </div>

              {/* Wire */}
              <div className="relative w-12 h-1 bg-stone-700 hidden sm:block" />

              {/* Component 3: Resistor */}
              <div className="flex flex-col items-center space-y-2">
                <div className="w-20 h-10 bg-[#d2b48c] rounded-md border border-stone-500 flex items-center justify-around px-2 shadow-md">
                  <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band1.bg }} />
                  <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band2.bg }} />
                  <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.band3.bg }} />
                  <div className="w-1.5 h-full" style={{ backgroundColor: resistorBands.tolerance.bg }} />
                </div>
                <span className="text-[11px] font-mono text-stone-400">
                  R1: {resistance} Ω
                </span>
              </div>

              {/* Wire */}
              <div className="relative w-12 h-1 bg-stone-700 hidden sm:block" />

              {/* Component 4: LED */}
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${
                    isBlown
                      ? 'bg-stone-950 border-red-600 shadow-red-500/50 shadow-lg'
                      : isLit
                      ? 'bg-amber-400 border-amber-300 shadow-[0_0_35px_rgba(250,204,21,0.9)] scale-110'
                      : 'bg-stone-800 border-stone-700 opacity-60'
                  }`}
                >
                  {isBlown ? (
                    <Flame className="w-6 h-6 text-red-500 animate-bounce" />
                  ) : (
                    <Zap className={`w-6 h-6 ${isLit ? 'text-stone-950' : 'text-stone-500'}`} />
                  )}
                </div>
                <span className="text-[11px] font-mono text-stone-400">
                  LED: {isBlown ? 'FRIED!' : isLit ? 'GLOWING' : 'OFF'}
                </span>
              </div>

              {/* Optional Capacitor */}
              {hasCapacitor && (
                <>
                  <div className="relative w-12 h-1 bg-stone-700 hidden sm:block" />
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-16 rounded-lg bg-blue-950 border-2 border-blue-400 flex flex-col items-center justify-center p-1 text-[10px] font-mono text-blue-300">
                      <span>C1</span>
                      <span className="text-[9px]">{capChargeVolt.toFixed(1)}V</span>
                      <div className="w-6 h-1 bg-white/20 rounded mt-1 overflow-hidden">
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: `${(capChargeVolt / Math.max(1, voltage)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-stone-400">100 µF Cap</span>
                  </div>
                </>
              )}

            </div>

            {/* Bottom Real-Time Telemetry Multimeter Bar */}
            <div className="relative z-10 bg-stone-950/80 rounded-2xl p-4 border border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Loop Current</span>
                <p className={`text-base font-black ${isBlown ? 'text-red-400' : 'text-amber-400'}`}>
                  {currentMilliAmps.toFixed(2)} mA
                </p>
                <span className="text-[10px] text-stone-400">Ideal: 15-20 mA</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Resistor Drop</span>
                <p className="text-base font-black text-stone-200">
                  {switchClosed ? Math.max(0, voltage - forwardVoltage).toFixed(2) : '0.00'} V
                </p>
                <span className="text-[10px] text-stone-400">V_R = V_IN - V_LED</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Power Dissipation</span>
                <p className="text-base font-black text-stone-200">
                  {(powerWatts * 1000).toFixed(1)} mW
                </p>
                <span className="text-[10px] text-stone-400">P = V × I</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">Circuit Health</span>
                <p className={`text-base font-black ${isBlown ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isBlown ? 'CRITICAL' : isLit ? 'OPTIMAL' : 'STANDBY'}
                </p>
                <span className="text-[10px] text-stone-400">{switchClosed ? 'Ohm’s Law Verified' : 'Open Loop'}</span>
              </div>
            </div>

          </div>

          {/* Educational Quick Note */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-stone-900 border border-amber-200 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                Ohm's Law Masterclass Tip:
              </span>{' '}
              When troubleshooting an unknown board, if an input voltage rail sags close to 0V while current spikes, you have encountered a low-resistance short to ground (such as a punctured MLCC capacitor).
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
