// Generates the Solutions list for a leaf (type > brand > model > size) from the per-family
// issue libraries, loaded on demand so each library chunk is code-split.
import { buildEscalation } from '../../lib/escalation';
import type { CatalogBrand, CatalogDeviceType, CatalogModel, CatalogSize, FamilyId, FamilyLibrary, IssueTemplate, Solution } from '../catalog/types';

type Loader = () => Promise<FamilyLibrary>;

const L: Record<FamilyId, Loader> = {
  refrigeration: () => import('./libHomeCold').then((m) => m.refrigeration),
  laundry: () => import('./libHomeCold').then((m) => m.laundry),
  dishwasher: () => import('./libHomeCold').then((m) => m.dishwasher),
  hvac: () => import('./libHomeCold').then((m) => m.hvac),
  water_heating: () => import('./libHomeCold').then((m) => m.water_heating),
  cooking: () => import('./libKitchen').then((m) => m.cooking),
  small_heating: () => import('./libKitchen').then((m) => m.small_heating),
  coffee: () => import('./libKitchen').then((m) => m.coffee),
  motor_kitchen: () => import('./libKitchen').then((m) => m.motor_kitchen),
  floorcare: () => import('./libKitchen').then((m) => m.floorcare),
  personal_care: () => import('./libKitchen').then((m) => m.personal_care),
  sewing: () => import('./libKitchen').then((m) => m.sewing),
  display: () => import('./libAV').then((m) => m.display),
  audio: () => import('./libAV').then((m) => m.audio),
  media: () => import('./libAV').then((m) => m.media),
  gaming: () => import('./libAV').then((m) => m.gaming),
  mobile: () => import('./libComputing').then((m) => m.mobile),
  computer: () => import('./libComputing').then((m) => m.computer),
  networking: () => import('./libComputing').then((m) => m.networking),
  printing: () => import('./libComputing').then((m) => m.printing),
  printer_3d: () => import('./libComputing').then((m) => m.printer_3d),
  wearables: () => import('./libComputing').then((m) => m.wearables),
  imaging: () => import('./libComputing').then((m) => m.imaging),
  drone: () => import('./libComputing').then((m) => m.drone),
  power_backup: () => import('./libPower').then((m) => m.power_backup),
  micromobility: () => import('./libPower').then((m) => m.micromobility),
  automotive: () => import('./libPower').then((m) => m.automotive),
  workshop_power: () => import('./libPower').then((m) => m.workshop_power),
  power_tools: () => import('./libPower').then((m) => m.power_tools),
  pumps: () => import('./libPower').then((m) => m.pumps),
  test_equipment: () => import('./libPower').then((m) => m.test_equipment),
  security: () => import('./libSecurity').then((m) => m.security),
  gate_motor: () => import('./libSecurity').then((m) => m.gate_motor),
  lighting: () => import('./libSecurity').then((m) => m.lighting),
  smart_home: () => import('./libSecurity').then((m) => m.smart_home),
  medical_home: () => import('./libMedical').then((m) => m.medical_home),
};

/** Cross-category faults used only to top up thin families so every leaf has substantive content. */
const UNIVERSAL: IssueTemplate[] = [
  {
    id: 'intermittent-power-cord', title: 'Cuts out when the cable or plug is moved',
    symptom: 'The {brand} {model} switches off or flickers when the cord, charger or plug is moved.',
    causes: ['Broken conductor strands at the strain relief', 'Loose or burnt plug terminal', 'Worn DC jack / USB port'],
    tests: ['Unplug. Set the multimeter to continuity and test each conductor end to end while flexing the cable along its length, especially 10 cm from each end.', 'Open the plug: check for discoloured terminals or loose screws.', 'Battery devices: measure charger output under load with a USB meter.'],
    fix: ['Replace the cord or shorten past the break and refit the strain relief.', 'Replace a burnt plug (SANS 164 plug, correct fuse if fitted).', 'Replace the charging port / DC jack.'],
    parts: ['Power cord', 'Plug', 'DC jack / USB port'], tools: ['Digital multimeter', 'Screwdrivers', 'Wire strippers'],
    difficulty: 'Easy', minutes: 30, safety: 'Unplug before opening. Never tape over a damaged mains cable — replace it.',
  },
  {
    id: 'surge-damage', title: 'Dead after load-shedding or a lightning storm',
    symptom: 'The {device} stopped working right after power returned.',
    causes: ['Blown input fuse', 'Cracked MOV / surge varistor', 'Failed switch-mode power supply (primary MOSFET, controller IC)'],
    tests: ['Visually inspect the power section for a blackened fuse, split MOV or bulging capacitors.', 'Measure the fuse (≈0 Ω good).', 'Check the bridge rectifier and primary MOSFET for shorts in diode mode.'],
    fix: ['Replace damaged parts with identical ratings; never fit a larger fuse.', 'Use a surge-protected plug or wait 2–3 minutes after power returns before switching on.'],
    parts: ['Fuse', 'MOV varistor', 'Power supply board'], tools: ['Digital multimeter', 'Soldering iron'],
    difficulty: 'Advanced', minutes: 60, safety: 'Mains capacitors can hold a lethal charge after unplugging: discharge them first.',
  },
  {
    id: 'reset-firmware', title: 'Erratic behaviour, buttons unresponsive or error lights',
    symptom: 'Controls ignore presses, the display shows an error or the {model} behaves erratically.',
    causes: ['Control firmware lock-up', 'Stuck or moisture-damaged membrane button', 'Outdated firmware (connected devices)'],
    tests: ['Power-cycle: unplug or remove the battery for 2 minutes.', 'Check each button for a click; inspect the membrane for moisture.', 'Look up the reset sequence in the {brand} manual or app.'],
    fix: ['Perform a factory reset / firmware update.', 'Dry and clean the keypad with isopropyl; replace the membrane or control panel.'],
    parts: ['Control panel / keypad membrane'], tools: ['Isopropyl alcohol', 'Screwdrivers'],
    difficulty: 'Easy', minutes: 20, safety: 'Unplug before opening the control panel.',
  },
  {
    id: 'overheating-smell', title: 'Runs hot, smells burnt or shuts down on its own',
    symptom: 'The {device} gets unusually hot, gives off a burning or fishy smell, or switches off after a while.',
    causes: ['Blocked vents / dust build-up', 'Failing electrolytic capacitor or overheating regulator', 'Overloaded output or short on a rail', 'Failed cooling fan'],
    tests: ['Stop using it and unplug immediately if you smell burning.', 'Inspect the board for brown heat marks, bulging capacitors or melted connectors.', 'With an IR thermometer or thermal camera, find the hottest component after 5 minutes of running (bench only, covers off, mains-safe setup).', 'Measure output rails against the label (e.g. 5 V / 12 V) under load.'],
    fix: ['Clean vents and heatsinks; replace the fan.', 'Replace swollen capacitors with the same capacitance and equal or higher voltage / 105 °C rating.', 'Replace burnt connectors and find the overload before returning to service.'],
    parts: ['Electrolytic capacitors', 'Cooling fan', 'Connectors'], tools: ['IR thermometer', 'Digital multimeter', 'Soldering iron'],
    difficulty: 'Moderate', minutes: 45, safety: 'A burning smell is a fire risk: unplug and do not leave it unattended until repaired.',
  },
  {
    id: 'liquid-ingress', title: 'Stopped working after water or liquid exposure',
    symptom: 'The {brand} {model} got wet (rain, spill, cleaning) and now fails or behaves oddly.',
    causes: ['Corrosion on the PCB and connectors', 'Short circuit on a power rail', 'Water trapped in switches or displays'],
    tests: ['Do not power it on. Remove batteries / unplug.', 'Open and inspect for white or green corrosion under a magnifier.', 'Measure power rails to ground for low resistance (short).'],
    fix: ['Clean the board with 99 % isopropyl and a soft brush; dry for 24–48 h.', 'Replace corroded connectors, switches or components.', 'Add a drip loop or weather cover if installed outdoors.'],
    parts: ['99 % isopropyl alcohol', 'Replacement switch / connector'], tools: ['Soft brush', 'Magnifier', 'Digital multimeter'],
    difficulty: 'Moderate', minutes: 60, safety: 'Never power a wet mains device. Lithium cells exposed to water must be replaced.',
  },
];

export interface SolutionContext {
  type: CatalogDeviceType;
  brand: CatalogBrand;
  model: CatalogModel;
  size?: CatalogSize;
}

function fill(text: string, ctx: SolutionContext): string {
  const device = ctx.type.name.split(/[\/(]/)[0].trim().toLowerCase();
  return text
    .replace(/\{brand\}/g, ctx.brand.name)
    .replace(/\{model\}/g, ctx.size ? `${ctx.model.name} (${ctx.size.name})` : ctx.model.name)
    .replace(/\{size\}/g, ctx.size?.name || '')
    .replace(/\{device\}/g, device);
}

function brandNotesFor(lib: FamilyLibrary, brand: CatalogBrand): Record<string, string> | undefined {
  if (!lib.brandNotes) return undefined;
  const candidates = [
    brand.slug.replace(/-/g, '_'),
    brand.name.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[^a-z0-9]+/g, '_'),
    brand.name.toLowerCase().split(/[\s(/-]+/)[0].replace(/[^a-z0-9]/g, ''),
  ];
  for (const c of candidates) if (lib.brandNotes[c]) return lib.brandNotes[c];
  return undefined;
}

function applies(issue: IssueTemplate, typeKey: string) {
  if (issue.only && !issue.only.includes(typeKey)) return false;
  if (issue.not && issue.not.includes(typeKey)) return false;
  return true;
}

function toSolution(issue: IssueTemplate, ctx: SolutionContext, lib: FamilyLibrary, notes?: Record<string, string>): Solution {
  const f = (s: string) => fill(s, ctx);
  const brandNote = notes ? (notes[issue.id] || notes['*'] || '').trim() : '';
  const sizeNote = ctx.size && lib.sizeNote ? lib.sizeNote(ctx.size.name, ctx.type.key, issue.id) : undefined;
  return {
    id: issue.id,
    title: f(issue.title),
    symptom: f(issue.symptom),
    causes: issue.causes.map(f),
    tests: issue.tests.map(f),
    fix: issue.fix.map(f),
    parts: issue.parts,
    tools: issue.tools,
    difficulty: issue.difficulty,
    minutes: issue.minutes,
    safety: issue.safety,
    brandNote: brandNote || undefined,
    sizeNote,
    source: 'library',
    escalation: buildEscalation({ causes: issue.causes.map(f), tests: issue.tests.map(f), fix: issue.fix.map(f) }),
  };
}

const MIN_SOLUTIONS = 6;

export async function loadSolutions(ctx: SolutionContext): Promise<Solution[]> {
  const lib = await L[ctx.type.family]();
  const notes = brandNotesFor(lib, ctx.brand);
  const out: Solution[] = [];

  const legacy = ctx.model.legacy;
  if (legacy && (legacy.steps.length || legacy.commonIssues.length)) {
    out.push({
      id: 'model-field-notes',
      title: `${ctx.brand.name} ${ctx.model.name}: known faults & bench notes`,
      symptom: legacy.commonIssues.length ? legacy.commonIssues.join(' • ') : `Model-specific diagnostic notes for the ${ctx.model.name}.`,
      causes: legacy.commonIssues,
      tests: legacy.steps,
      fix: ['Confirm the fault with the checks above, then follow the matching detailed solution below for the full repair procedure and parts list.'],
      parts: [],
      tools: legacy.tools,
      difficulty: 'Moderate',
      minutes: 45,
      safety: 'Unplug and discharge before opening. Follow the detailed safety notes in each solution below.',
      brandNote: notes?.['*'] || undefined,
      source: 'model-notes',
      escalation: buildEscalation({ causes: legacy.commonIssues, tests: legacy.steps, fix: [] }),
    });
  }

  for (const issue of lib.issues) if (applies(issue, ctx.type.key)) out.push(toSolution(issue, ctx, lib, notes));

  // Medical devices only get their own (deliberately conservative) library, never generic board-level fixes.
  if (out.length < MIN_SOLUTIONS && ctx.type.family !== 'medical_home') {
    for (const issue of UNIVERSAL) {
      if (out.length >= MIN_SOLUTIONS) break;
      out.push(toSolution(issue, ctx, { issues: [] }, undefined));
    }
  }
  return out;
}

/** Count library solutions for a type without building them (for stats/badges). */
export async function countSolutionsForType(type: CatalogDeviceType): Promise<number> {
  const lib = await L[type.family]();
  const n = lib.issues.filter((i) => applies(i, type.key)).length;
  return type.family === 'medical_home' ? n : Math.max(MIN_SOLUTIONS, n);
}
