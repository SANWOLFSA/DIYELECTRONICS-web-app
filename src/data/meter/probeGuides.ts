// Illustrated probe guides for every component in the Multimeter Lab: the physical part drawn with its
// pins labelled, and for each measurement where the RED and BLACK probes go, which dial position to use,
// a typical LCD reading and good / bad results. Pin indexes refer to `pins` (left to right as drawn).
import type { ModeId } from './types';

export type PartShape =
  | 'axial' | 'axial-band' | 'axial-glass' | 'radial' | 'radial-electrolytic' | 'disc' | 'led' | 'to92' | 'to220' | 'to247'
  | 'bridge' | 'dip4' | 'dip8' | 'relay' | 'transformer' | 'switch' | 'speaker' | 'battery' | 'crystal' | 'pot'
  | 'motor' | 'element' | 'compressor' | 'magnetron' | 'smd2';

export interface ProbeStep {
  red: number;
  black: number;
  mode: ModeId;
  /** What this placement checks. */
  caption: string;
  /** Typical LCD digits + unit for a good part. */
  lcd: [string, string];
  good: string;
  bad: string;
  /** Done with power applied (sources, regulators, ICs). */
  powered?: boolean;
}

export interface ProbeGuide {
  shape: PartShape;
  label: string;
  pins: string[];
  steps: ProbeStep[];
  /** Big / mains capacitors nearby: show the discharge step prominently. */
  discharge?: boolean;
}

const D = 'diode' as const, O = 'ohm' as const, C = 'cont' as const;

export const PROBE_GUIDES: Record<string, ProbeGuide> = {
  resistor: { shape: 'axial', label: '4.7 kΩ (yellow-violet-red-gold)', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Probes on each lead (polarity does not matter)', lcd: ['4.68', 'kΩ'], good: 'Within tolerance of the colour code (±5 % gold, ±1 % brown).', bad: 'OL = open (burnt); much higher than marked = drifted.' } ] },
  potentiometer: { shape: 'pot', label: '10 kΩ potentiometer', pins: ['Pin 1', 'Wiper', 'Pin 3'], steps: [
    { red: 0, black: 2, mode: O, caption: 'Outer pins: total track resistance', lcd: ['9.92', 'kΩ'], good: 'Close to the marked value (e.g. 10 kΩ = “103”).', bad: 'OL = track broken.' },
    { red: 1, black: 0, mode: O, caption: 'Wiper to one end while turning the shaft', lcd: ['4.95', 'kΩ'], good: 'Changes smoothly from ~0 to the full value.', bad: 'Jumps, drops to OL or flickers = worn track.' } ] },
  'capacitor-electrolytic': { shape: 'radial-electrolytic', label: '100 µF 25 V electrolytic', pins: ['+ (long leg)', '− (stripe)'], discharge: true, steps: [
    { red: 0, black: 1, mode: 'cap', caption: 'Red on +, black on − (stripe side), capacitor discharged', lcd: ['98.6', 'µF'], good: 'Within about −20 %/+20 % of the marked value; ESR low (see ESR table).', bad: 'Much lower than marked or reads 0 = dried out; bulged top or leaking = replace.' },
    { red: 0, black: 1, mode: O, caption: 'Ω check: reading should climb as it charges', lcd: ['1.25', 'MΩ'], good: 'Starts low and climbs towards OL.', bad: 'Stays near 0 Ω = shorted.' } ] },
  'capacitor-ceramic': { shape: 'disc', label: '100 nF ceramic (“104”)', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: 'cap', caption: 'Out of circuit; probes on each lead', lcd: ['98.2', 'nF'], good: 'Close to the code: 104 = 100 nF, 103 = 10 nF, 102 = 1 nF.', bad: '0 Ω in Ω mode = shorted (common for MLCCs on supply rails).' } ] },
  diode: { shape: 'axial-band', label: '1N4007 rectifier diode', pins: ['Anode (A)', 'Cathode (K, band)'], steps: [
    { red: 0, black: 1, mode: D, caption: 'Forward: red on anode, black on cathode (band)', lcd: ['0.578', 'V'], good: '0.5–0.7 V silicon; 0.15–0.45 V Schottky.', bad: 'OL both ways = open; ~0 V both ways = shorted.' },
    { red: 1, black: 0, mode: D, caption: 'Reverse: swap the probes', lcd: ['OL', ''], good: 'OL (no conduction in reverse).', bad: 'Any reading in reverse = leaky or shorted.' } ] },
  zener: { shape: 'axial-glass', label: '5.1 V zener (glass)', pins: ['Anode (A)', 'Cathode (K, band)'], steps: [
    { red: 0, black: 1, mode: D, caption: 'Forward: red on anode, black on cathode', lcd: ['0.712', 'V'], good: '0.6–0.8 V forward, OL in reverse.', bad: 'Shorted both ways. (The zener voltage itself needs a powered test: supply via 1 kΩ and measure VDC across it.)' } ] },
  led: { shape: 'led', label: 'Red 5 mm LED', pins: ['Anode (long leg)', 'Cathode (short leg, flat)'], steps: [
    { red: 0, black: 1, mode: D, caption: 'Red on anode (long leg), black on cathode (flat side)', lcd: ['1.82', 'V'], good: 'Red/yellow ≈1.8–2.1 V, blue/white ≈2.6–3.1 V; LED often glows faintly.', bad: 'OL both ways = open. White/blue may show OL on meters with a low test voltage.' } ] },
  'bridge-rectifier': { shape: 'bridge', label: 'Bridge rectifier (GBU / KBP)', pins: ['+', '~ AC', '~ AC', '−'], steps: [
    { red: 1, black: 0, mode: D, caption: 'Red on each ~, black on + (two diodes)', lcd: ['0.512', 'V'], good: '0.4–0.7 V on each of the 4 diodes.', bad: '0 V = shorted diode (fuse usually blown too).' },
    { red: 3, black: 1, mode: D, caption: 'Red on −, black on each ~ (other two diodes)', lcd: ['0.515', 'V'], good: '0.4–0.7 V; reverse each pair reads OL.', bad: 'OL both ways on a pair = open diode.' } ] },
  'bjt-npn': { shape: 'to92', label: 'BC547 NPN (flat face toward you: C B E)', pins: ['Collector (C)', 'Base (B)', 'Emitter (E)'], steps: [
    { red: 1, black: 2, mode: D, caption: 'Red on base, black on emitter', lcd: ['0.684', 'V'], good: '0.6–0.75 V.', bad: 'OL = open junction; ~0 V = shorted.' },
    { red: 1, black: 0, mode: D, caption: 'Red on base, black on collector', lcd: ['0.671', 'V'], good: '0.6–0.75 V (slightly lower than B-E).', bad: 'OL or 0 V.' },
    { red: 0, black: 2, mode: D, caption: 'Collector to emitter, both ways', lcd: ['OL', ''], good: 'OL both ways.', bad: 'Any reading = C-E leakage or short.' } ] },
  'bjt-pnp': { shape: 'to92', label: 'BC557 PNP (flat face toward you: C B E)', pins: ['Collector (C)', 'Base (B)', 'Emitter (E)'], steps: [
    { red: 2, black: 1, mode: D, caption: 'Black on base, red on emitter', lcd: ['0.679', 'V'], good: '0.6–0.75 V.', bad: 'OL or 0 V.' },
    { red: 0, black: 1, mode: D, caption: 'Black on base, red on collector', lcd: ['0.665', 'V'], good: '0.6–0.75 V.', bad: 'OL or 0 V.' },
    { red: 0, black: 2, mode: D, caption: 'Collector to emitter, both ways', lcd: ['OL', ''], good: 'OL both ways.', bad: 'Any reading = leakage or short.' } ] },
  'mosfet-n': { shape: 'to220', label: 'IRF540N N-MOSFET (G D S)', pins: ['Gate (G)', 'Drain (D)', 'Source (S)'], steps: [
    { red: 2, black: 1, mode: D, caption: 'Body diode: red on source, black on drain', lcd: ['0.512', 'V'], good: '0.4–0.7 V body diode; reverse (red D, black S) OL.', bad: '~0 V both ways = shorted (very common in SMPS / motor drivers).' },
    { red: 0, black: 2, mode: D, caption: 'Turn on: touch red to gate (black on source) to charge it…', lcd: ['OL', ''], good: 'Charges the gate (reading not important).', bad: '' },
    { red: 1, black: 2, mode: D, caption: '…then red on drain, black on source: now conducts', lcd: ['0.085', 'V'], good: 'Low reading = MOSFET switched on. Short G-S with a finger/probe and it returns to OL.', bad: 'Stays OL = gate dead; always low = shorted.' } ] },
  'mosfet-p': { shape: 'to220', label: 'IRF9540 P-MOSFET (G D S)', pins: ['Gate (G)', 'Drain (D)', 'Source (S)'], steps: [
    { red: 1, black: 2, mode: D, caption: 'Body diode: red on drain, black on source', lcd: ['0.520', 'V'], good: '0.4–0.7 V; reverse reads OL.', bad: '~0 V both ways = shorted.' },
    { red: 2, black: 0, mode: D, caption: 'Turn on: black on gate, red on source', lcd: ['OL', ''], good: 'Charges the gate negative.', bad: '' },
    { red: 2, black: 1, mode: D, caption: 'Then red on source, black on drain: conducts', lcd: ['0.090', 'V'], good: 'Low reading = switched on.', bad: 'Stays OL or always low.' } ] },
  igbt: { shape: 'to247', label: 'IGBT e.g. FGA25N120 (G C E)', pins: ['Gate (G)', 'Collector (C)', 'Emitter (E)'], discharge: true, steps: [
    { red: 2, black: 1, mode: D, caption: 'Built-in diode: red on emitter, black on collector', lcd: ['0.452', 'V'], good: '0.3–0.6 V; reverse OL.', bad: '0 V C-E = shorted (induction cooker fuse blown).' },
    { red: 0, black: 2, mode: O, caption: 'Gate to emitter, both ways', lcd: ['OL', ''], good: 'OL (very high).', bad: 'Any low reading = gate damaged.' } ] },
  scr: { shape: 'to220', label: 'SCR e.g. BT151 (K A G)', pins: ['Cathode (K)', 'Anode (A)', 'Gate (G)'], steps: [
    { red: 2, black: 0, mode: D, caption: 'Red on gate, black on cathode (G-K junction)', lcd: ['0.640', 'V'], good: '0.5–0.8 V (a diode).', bad: 'OL or 0 V.' },
    { red: 1, black: 0, mode: O, caption: 'Anode to cathode, both ways', lcd: ['OL', ''], good: 'OL both ways when not triggered.', bad: 'Low reading = shorted.' } ] },
  triac: { shape: 'to220', label: 'TRIAC e.g. BTA16 (MT1 MT2 G)', pins: ['MT1', 'MT2', 'Gate (G)'], steps: [
    { red: 2, black: 0, mode: O, caption: 'Gate to MT1', lcd: ['48.2', 'Ω'], good: 'Low tens of ohms (both ways).', bad: 'OL = open gate.' },
    { red: 1, black: 0, mode: O, caption: 'MT2 to MT1, both ways', lcd: ['OL', ''], good: 'OL.', bad: 'Low = shorted (motor/heater stays on).' } ] },
  'regulator-78xx': { shape: 'to220', label: '7805 regulator (IN GND OUT)', pins: ['Input', 'GND', 'Output'], steps: [
    { red: 0, black: 1, mode: 'vdc', caption: 'Powered: black on GND, red on input', lcd: ['12.04', 'V'], good: 'At least ~2 V above the output (7–35 V for a 7805).', bad: 'No input = problem is before the regulator.', powered: true },
    { red: 2, black: 1, mode: 'vdc', caption: 'Powered: black on GND, red on output', lcd: ['5.01', 'V'], good: '4.8–5.2 V for a 7805 (12 V for a 7812).', bad: '0 V with good input = regulator dead or output shorted; equals input = regulator shorted.', powered: true } ] },
  'regulator-ldo': { shape: 'to220', label: 'AMS1117-3.3 (GND OUT IN)', pins: ['GND / ADJ', 'Output (tab)', 'Input'], steps: [
    { red: 2, black: 0, mode: 'vdc', caption: 'Powered: input', lcd: ['5.02', 'V'], good: '≥ 4.5 V.', bad: 'Missing = upstream fault.', powered: true },
    { red: 1, black: 0, mode: 'vdc', caption: 'Powered: output', lcd: ['3.30', 'V'], good: '3.25–3.35 V.', bad: '0 V = shorted load or dead LDO (check the rail resistance to ground with power off).', powered: true } ] },
  fuse: { shape: 'axial-glass', label: 'T2A glass fuse', pins: ['End cap 1', 'End cap 2'], steps: [
    { red: 0, black: 1, mode: C, caption: 'Out of the holder; probes on the end caps', lcd: ['0.2', 'Ω'], good: 'Beeps, under ~1 Ω.', bad: 'OL = blown. Blackened glass = something shorted downstream: find it before replacing.' } ] },
  'thermal-fuse': { shape: 'axial', label: 'Thermal fuse (TCO) e.g. 184 °C', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: C, caption: 'Power off; probes on the two leads', lcd: ['0.1', 'Ω'], good: 'Beeps (closed).', bad: 'OL = tripped; replace with the same temperature rating and find why it overheated.' } ] },
  'thermistor-ntc': { shape: 'disc', label: 'NTC inrush thermistor e.g. 5D-11', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Cold, out of circuit', lcd: ['5.1', 'Ω'], good: 'Near the marked cold value (5D = 5 Ω); falls when warmed.', bad: 'OL = cracked/open (common in TV and PC power supplies).' } ] },
  'thermistor-ptc': { shape: 'disc', label: 'PTC / polyfuse', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Cold', lcd: ['0.45', 'Ω'], good: 'Low when cold; rises sharply when hot.', bad: 'OL when cold = open.' } ] },
  mov: { shape: 'disc', label: 'Varistor e.g. 14D471K', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Out of circuit, both ways', lcd: ['OL', ''], good: 'OL (megaohms).', bad: 'Low resistance or visibly cracked/burnt = failed (blows the mains fuse).' } ] },
  inductor: { shape: 'radial', label: 'Choke / coil', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Probes on the two leads', lcd: ['0.3', 'Ω'], good: 'Low: fractions of an ohm to a few ohms (depends on turns).', bad: 'OL = broken winding. Shorted turns need an LCR meter or ring tester.' } ] },
  transformer: { shape: 'transformer', label: 'Mains transformer', pins: ['Primary 1', 'Primary 2', 'Secondary 1', 'Secondary 2'], discharge: true, steps: [
    { red: 0, black: 1, mode: O, caption: 'Unplugged: primary winding', lcd: ['385', 'Ω'], good: 'Tens to hundreds of ohms (small transformers higher).', bad: 'OL = open primary (often an internal thermal fuse).' },
    { red: 2, black: 3, mode: O, caption: 'Secondary winding', lcd: ['1.8', 'Ω'], good: 'A few ohms or less.', bad: 'OL = open.' },
    { red: 0, black: 2, mode: O, caption: 'Primary to secondary (isolation)', lcd: ['OL', ''], good: 'OL.', bad: 'Any reading = insulation breakdown: dangerous, replace.' } ] },
  relay: { shape: 'relay', label: '12 V relay (coil, COM, NO, NC)', pins: ['Coil 1', 'Coil 2', 'COM', 'NO', 'NC'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Coil resistance', lcd: ['400', 'Ω'], good: '12 V relays ≈ 200–400 Ω; 5 V ≈ 50–100 Ω.', bad: 'OL = open coil.' },
    { red: 2, black: 4, mode: C, caption: 'COM to NC (relay off)', lcd: ['0.1', 'Ω'], good: 'Beeps.', bad: 'No beep = burnt contact.' },
    { red: 2, black: 3, mode: C, caption: 'COM to NO: open, beeps when the coil is energised', lcd: ['OL', ''], good: 'OL off; beeps with coil powered.', bad: 'Beeps when off = welded contacts.' } ] },
  switch: { shape: 'switch', label: 'Micro switch (COM, NO, NC)', pins: ['COM', 'NO', 'NC'], steps: [
    { red: 0, black: 1, mode: C, caption: 'COM to NO, press the lever', lcd: ['0.1', 'Ω'], good: 'Beeps only while pressed.', bad: 'Never beeps / crackles = worn contacts.' },
    { red: 0, black: 2, mode: C, caption: 'COM to NC, released', lcd: ['0.1', 'Ω'], good: 'Beeps released, opens when pressed.', bad: 'Stays open.' } ] },
  motor: { shape: 'motor', label: 'DC motor / fan', pins: ['Terminal +', 'Terminal −'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Winding resistance; turn the shaft slowly', lcd: ['12.6', 'Ω'], good: 'Low ohms, steady as the shaft turns (brushed motors flicker slightly).', bad: 'OL = open winding or worn brushes; 0 Ω = shorted.' } ] },
  speaker: { shape: 'speaker', label: '8 Ω speaker', pins: ['+', '−'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Across the terminals', lcd: ['6.8', 'Ω'], good: 'A little below the rating (8 Ω speaker ≈ 6–7 Ω DC); you may hear a click.', bad: 'OL = open voice coil.' } ] },
  crystal: { shape: 'crystal', label: '16 MHz crystal (HC-49)', pins: ['Lead 1', 'Lead 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Out of circuit', lcd: ['OL', ''], good: 'OL. (Oscillation needs a frequency counter or scope; Hz mode on the pins may read the frequency in circuit.)', bad: 'Any low reading = shorted.' } ] },
  optocoupler: { shape: 'dip4', label: 'PC817 optocoupler', pins: ['1 Anode', '2 Cathode', '3 Emitter', '4 Collector'], steps: [
    { red: 0, black: 1, mode: D, caption: 'LED side: red pin 1 (dot), black pin 2', lcd: ['1.08', 'V'], good: '1.0–1.2 V; reverse OL.', bad: 'OL both ways = LED open (SMPS will not regulate).' },
    { red: 3, black: 2, mode: O, caption: 'Transistor side: pin 4 to pin 3, LED off', lcd: ['OL', ''], good: 'OL (drops when the LED is powered with 5 V via 1 kΩ).', bad: 'Low = shorted transistor.' } ] },
  battery: { shape: 'battery', label: 'AA cell / Li-ion 18650', pins: ['+ terminal', '− terminal'], steps: [
    { red: 0, black: 1, mode: 'vdc', caption: 'Red on +, black on −', lcd: ['1.56', 'V'], good: 'AA alkaline 1.5–1.6 V new; Li-ion 3.6–4.2 V; 12 V lead-acid 12.6–12.8 V rested.', bad: 'AA < 1.2 V, Li-ion < 3.0 V, lead-acid < 12.0 V = flat. Check again under load.', powered: true } ] },
  'hall-sensor': { shape: 'to92', label: 'Hall sensor (VCC GND OUT)', pins: ['VCC', 'GND', 'OUT'], steps: [
    { red: 2, black: 1, mode: 'vdc', caption: 'Powered: output while moving a magnet past it', lcd: ['4.96', 'V'], good: 'Switches between ~0 V and supply as the magnet passes.', bad: 'Stuck high or low = failed.', powered: true } ] },
  'ic-power-rails': { shape: 'dip8', label: '8-pin IC (pin 8 VCC, pin 4 GND typical)', pins: ['1', '2', '3', '4 GND', '5', '6', '7', '8 VCC'], steps: [
    { red: 7, black: 3, mode: 'vdc', caption: 'Powered: black on GND pin, red on VCC pin', lcd: ['5.02', 'V'], good: 'The datasheet supply voltage (e.g. 5 V or 3.3 V).', bad: 'Missing = check the regulator/supply; low = overloaded rail.', powered: true },
    { red: 7, black: 3, mode: O, caption: 'Unpowered: VCC to GND resistance', lcd: ['2.45', 'kΩ'], good: 'Hundreds of ohms or more (rises as caps charge).', bad: 'Under ~10 Ω = shorted rail (find the hot part with power limited).' } ] },
  'heating-element': { shape: 'element', label: 'Kettle / geyser element', pins: ['Terminal 1', 'Terminal 2', 'Sheath (earth)'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Isolated, wires removed: terminal to terminal', lcd: ['24.5', 'Ω'], good: 'R = V²/P: 2 kW at 230 V ≈ 26 Ω; 3 kW ≈ 18 Ω.', bad: 'OL = open element.' },
    { red: 0, black: 2, mode: O, caption: 'Terminal to sheath (earth leakage)', lcd: ['OL', ''], good: 'OL (megaohms).', bad: 'Any reading = element leaking to earth: trips the earth leakage.' } ] },
  magnetron: { shape: 'magnetron', label: 'Microwave magnetron', pins: ['Filament F', 'Filament FA', 'Case'], discharge: true, steps: [
    { red: 0, black: 1, mode: O, caption: 'HV capacitor discharged! Filament terminals', lcd: ['0.3', 'Ω'], good: 'Under 1 Ω.', bad: 'OL = open filament.' },
    { red: 0, black: 2, mode: O, caption: 'Filament to case', lcd: ['OL', ''], good: 'OL.', bad: 'Any reading = shorted to case.' } ] },
  'hv-diode': { shape: 'axial', label: 'Microwave HV diode', pins: ['Anode', 'Cathode'], discharge: true, steps: [
    { red: 0, black: 1, mode: O, caption: 'HV cap discharged; Ω on 20 MΩ range (diode mode cannot forward-bias it)', lcd: ['OL', ''], good: 'OL one way, high MΩ the other way only with a 9 V battery in series; usually OL both ways on a meter.', bad: 'Low ohms in both directions = shorted.' } ] },
  compressor: { shape: 'compressor', label: 'Compressor terminals (C S R)', pins: ['C (common)', 'S (start)', 'R (run)'], steps: [
    { red: 0, black: 2, mode: O, caption: 'C to R (run winding)', lcd: ['12.5', 'Ω'], good: 'Low ohms; C-S higher; S-R = C-S + C-R.', bad: 'OL = open winding.' },
    { red: 0, black: 1, mode: O, caption: 'C to S (start winding)', lcd: ['18.0', 'Ω'], good: 'Highest of C-R and C-S.', bad: 'OL = open.' } ] },
  'ptc-starter': { shape: 'disc', label: 'Fridge PTC starter', pins: ['Pin 1', 'Pin 2'], steps: [
    { red: 0, black: 1, mode: O, caption: 'Cold, removed from the compressor', lcd: ['22.0', 'Ω'], good: 'Low (about 3–50 Ω) when cold.', bad: 'OL = failed; rattles inside = cracked pill.' } ] },
};

/** Fallback for any component without a specific drawing. */
export const GENERIC_GUIDE: ProbeGuide = { shape: 'axial', label: 'Component', pins: ['Lead 1', 'Lead 2'], steps: [] };
