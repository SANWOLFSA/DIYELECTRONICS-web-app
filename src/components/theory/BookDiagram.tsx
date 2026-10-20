import type { ReactElement } from 'react';
import type { DiagramKey } from '../../data/theory/chapters';

/** Simple, accurate line diagrams for the Theory book (SVG, theme-aware via currentColor). */
const stroke = { stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const label = { fill: 'currentColor', fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' };

function Cell({ x, y, plusLeft = true }: { x: number; y: number; plusLeft?: boolean }) {
  // long thin line = +, short thick line = −
  const lx = plusLeft ? x : x + 12, sx = plusLeft ? x + 12 : x;
  return (
    <g>
      <line x1={lx} y1={y - 18} x2={lx} y2={y + 18} stroke="currentColor" strokeWidth={2} />
      <line x1={sx} y1={y - 9} x2={sx} y2={y + 9} stroke="currentColor" strokeWidth={5} />
    </g>
  );
}

function Resistor({ x, y, w = 50 }: { x: number; y: number; w?: number }) {
  return <rect x={x} y={y - 9} width={w} height={18} rx={2} {...stroke} />;
}

const DIAGRAMS: Record<DiagramKey, { title: string; vb: string; body: ReactElement }> = {
  'cell-symbols': {
    title: 'Circuit symbols: a cell (left) and a battery of cells (right). Long thin line = positive (+), short thick line = negative (−).',
    vb: '0 0 360 120',
    body: (
      <g>
        <line x1={20} y1={55} x2={70} y2={55} {...stroke} /><Cell x={70} y={55} /><line x1={82} y1={55} x2={130} y2={55} {...stroke} />
        <text x={64} y={28} {...label} className="font-bold">+</text><text x={80} y={28} {...label}>−</text>
        <text x={75} y={100} textAnchor="middle" {...label}>Cell</text>
        <line x1={190} y1={55} x2={220} y2={55} {...stroke} /><Cell x={220} y={55} />
        <line x1={232} y1={55} x2={246} y2={55} {...stroke} strokeDasharray="3 4" />
        <Cell x={246} y={55} /><line x1={258} y1={55} x2={272} y2={55} {...stroke} strokeDasharray="3 4" />
        <Cell x={272} y={55} /><line x1={284} y1={55} x2={330} y2={55} {...stroke} />
        <text x={214} y={28} {...label}>+</text><text x={282} y={28} {...label}>−</text>
        <text x={255} y={100} textAnchor="middle" {...label}>Battery (e.g. 3 × 1.5 V = 4.5 V)</text>
      </g>
    ),
  },
  'cell-inside': {
    title: 'Inside a cell: two electrodes in an electrolyte, kept apart by a separator. Electrons flow through the external circuit; ions move through the electrolyte.',
    vb: '0 0 360 200',
    body: (
      <g>
        <rect x={70} y={60} width={220} height={120} rx={10} {...stroke} />
        <rect x={95} y={45} width={26} height={120} rx={3} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={2} />
        <rect x={239} y={45} width={26} height={120} rx={3} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={2} />
        <line x1={180} y1={70} x2={180} y2={172} {...stroke} strokeDasharray="5 5" />
        <text x={108} y={190} textAnchor="middle" {...label}>− electrode</text>
        <text x={252} y={190} textAnchor="middle" {...label}>+ electrode</text>
        <text x={180} y={196} textAnchor="middle" {...label} fontSize={10}>separator</text>
        <text x={150} y={130} textAnchor="middle" {...label} fontSize={11}>electrolyte</text>
        <path d="M150 112 L212 112" {...stroke} markerEnd="url(#bd-arrow)" />
        <text x={182} y={104} textAnchor="middle" {...label} fontSize={10}>ions</text>
        <path d="M108 45 L108 18 L252 18 L252 45" {...stroke} />
        <circle cx={180} cy={18} r={11} {...stroke} /><path d="M172 10 L188 26 M188 10 L172 26" {...stroke} strokeWidth={1.5} />
        <path d="M130 12 L160 12" {...stroke} markerEnd="url(#bd-arrow)" /><text x={145} y={8} textAnchor="middle" {...label} fontSize={10}>e⁻</text>
        <text x={210} y={40} {...label} fontSize={10}>lamp (load)</text>
      </g>
    ),
  },
  'cells-series-parallel': {
    title: 'Left: three 1.5 V cells in series give 4.5 V (same capacity). Right: three cells in parallel give 1.5 V with three times the capacity.',
    vb: '0 0 380 170',
    body: (
      <g>
        <text x={85} y={20} textAnchor="middle" {...label} className="font-semibold">Series</text>
        <line x1={10} y1={80} x2={30} y2={80} {...stroke} /><Cell x={30} y={80} /><line x1={42} y1={80} x2={70} y2={80} {...stroke} />
        <Cell x={70} y={80} /><line x1={82} y1={80} x2={110} y2={80} {...stroke} /><Cell x={110} y={80} /><line x1={122} y1={80} x2={160} y2={80} {...stroke} />
        <text x={85} y={130} textAnchor="middle" {...label}>1.5 + 1.5 + 1.5 = 4.5 V</text>
        <text x={290} y={20} textAnchor="middle" {...label} className="font-semibold">Parallel</text>
        {[50, 90, 130].map(y => <g key={y}><line x1={230} y1={y} x2={284} y2={y} {...stroke} /><Cell x={284} y={y} /><line x1={296} y1={y} x2={350} y2={y} {...stroke} /></g>)}
        <line x1={230} y1={50} x2={230} y2={130} {...stroke} /><line x1={350} y1={50} x2={350} y2={130} {...stroke} />
        <text x={290} y={160} textAnchor="middle" {...label}>1.5 V, capacity × 3</text>
      </g>
    ),
  },
  'simple-circuit': {
    title: 'A simple circuit: a cell drives current through a switch and a lamp. Conventional current flows from + through the load back to −.',
    vb: '0 0 320 170',
    body: (
      <g>
        <path d="M60 40 L260 40 L260 130 L60 130 Z" {...stroke} />
        <rect x={52} y={70} width={16} height={30} fill="var(--book-bg, #0b0d12)" />
        <Cell x={46} y={85} />
        <rect x={252} y={70} width={16} height={30} fill="var(--book-bg, #0b0d12)" />
        <circle cx={260} cy={85} r={14} {...stroke} /><path d="M250 75 L270 95 M270 75 L250 95" {...stroke} strokeWidth={1.5} />
        <rect x={140} y={32} width={40} height={16} fill="var(--book-bg, #0b0d12)" />
        <circle cx={142} cy={40} r={3} fill="currentColor" /><circle cx={178} cy={40} r={3} fill="currentColor" /><line x1={142} y1={40} x2={174} y2={26} {...stroke} />
        <text x={20} y={90} {...label}>E</text><text x={282} y={90} {...label}>Lamp</text><text x={160} y={20} textAnchor="middle" {...label}>Switch</text>
        <path d="M100 140 L150 140" {...stroke} markerEnd="url(#bd-arrow)" /><text x={125} y={160} textAnchor="middle" {...label} fontSize={11}>I (conventional)</text>
      </g>
    ),
  },
  'series-resistors': {
    title: 'Resistors in series: the same current flows through each; R_T = R₁ + R₂ + R₃ and the supply voltage divides across them.',
    vb: '0 0 360 150',
    body: (
      <g>
        <path d="M40 40 L330 40 L330 120 L40 120 Z" {...stroke} />
        {[70, 160, 250].map((x, i) => <g key={x}><rect x={x - 2} y={30} width={54} height={20} fill="var(--book-bg, #0b0d12)" /><Resistor x={x} y={40} /><text x={x + 25} y={70} textAnchor="middle" {...label}>R{i + 1}</text></g>)}
        <rect x={32} y={64} width={16} height={34} fill="var(--book-bg, #0b0d12)" /><Cell x={28} y={80} />
        <text x={185} y={142} textAnchor="middle" {...label}>V_S = V₁ + V₂ + V₃</text>
      </g>
    ),
  },
  'parallel-resistors': {
    title: 'Resistors in parallel: each has the full supply voltage; the branch currents add and 1/R_T = 1/R₁ + 1/R₂ + 1/R₃.',
    vb: '0 0 360 170',
    body: (
      <g>
        <line x1={60} y1={30} x2={300} y2={30} {...stroke} /><line x1={60} y1={150} x2={300} y2={150} {...stroke} />
        <line x1={60} y1={30} x2={60} y2={70} {...stroke} /><line x1={60} y1={100} x2={60} y2={150} {...stroke} />
        <g transform="rotate(90 60 85)"><Cell x={54} y={85} /></g>
        {[150, 225, 300].map((x, i) => <g key={x}><line x1={x} y1={30} x2={x} y2={65} {...stroke} /><rect x={x - 9} y={65} width={18} height={50} rx={2} {...stroke} /><line x1={x} y1={115} x2={x} y2={150} {...stroke} /><text x={x + 14} y={95} {...label}>R{i + 1}</text></g>)}
        <text x={180} y={20} textAnchor="middle" {...label}>I_T = I₁ + I₂ + I₃</text>
      </g>
    ),
  },
  'sine-wave': {
    title: 'An AC sine wave: peak value Vp, RMS value Vp/√2 and period T (f = 1/T). 230 V RMS mains has a peak of about 325 V and T = 20 ms at 50 Hz.',
    vb: '0 0 360 170',
    body: (
      <g>
        <line x1={30} y1={85} x2={340} y2={85} {...stroke} strokeOpacity={0.5} /><line x1={30} y1={15} x2={30} y2={155} {...stroke} strokeOpacity={0.5} />
        <path d={Array.from({ length: 121 }, (_, i) => `${i ? 'L' : 'M'}${30 + i * 2.5} ${85 - 60 * Math.sin((i / 120) * 4 * Math.PI)}`).join(' ')} stroke="#6b8afd" strokeWidth={2.5} fill="none" />
        <line x1={30} y1={25} x2={340} y2={25} stroke="currentColor" strokeDasharray="4 4" strokeOpacity={0.6} />
        <line x1={30} y1={42.6} x2={340} y2={42.6} stroke="#f59e0b" strokeDasharray="4 4" />
        <text x={36} y={20} {...label} fontSize={11}>Vp</text><text x={300} y={38} {...label} fontSize={11} fill="#f59e0b">Vrms</text>
        <path d="M30 160 L180 160" {...stroke} markerEnd="url(#bd-arrow)" /><text x={105} y={152} textAnchor="middle" {...label} fontSize={11}>T (one cycle)</text>
      </g>
    ),
  },
  transformer: {
    title: 'A transformer: two coils on an iron core. V₁/V₂ = N₁/N₂. It only works with AC.',
    vb: '0 0 360 160',
    body: (
      <g>
        <rect x={120} y={25} width={120} height={110} rx={6} {...stroke} strokeWidth={8} strokeOpacity={0.35} />
        {[0, 1, 2, 3, 4].map(i => <path key={`p${i}`} d={`M108 ${45 + i * 16} q 24 8 0 16`} {...stroke} />)}
        {[0, 1, 2].map(i => <path key={`s${i}`} d={`M252 ${55 + i * 18} q -24 9 0 18`} {...stroke} />)}
        <line x1={40} y1={45} x2={108} y2={45} {...stroke} /><line x1={40} y1={125} x2={108} y2={125} {...stroke} />
        <line x1={252} y1={55} x2={320} y2={55} {...stroke} /><line x1={252} y1={109} x2={320} y2={109} {...stroke} />
        <text x={30} y={90} {...label}>V₁ (N₁)</text><text x={290} y={90} {...label}>V₂ (N₂)</text><text x={180} y={152} textAnchor="middle" {...label}>iron core</text>
      </g>
    ),
  },
  diode: {
    title: 'Diode symbol: current flows from anode (A) to cathode (K, the bar). A silicon diode drops about 0.6–0.7 V when conducting.',
    vb: '0 0 360 110',
    body: (
      <g>
        <line x1={40} y1={55} x2={150} y2={55} {...stroke} />
        <path d="M150 30 L150 80 L195 55 Z" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={2} />
        <line x1={195} y1={30} x2={195} y2={80} stroke="currentColor" strokeWidth={3} />
        <line x1={195} y1={55} x2={320} y2={55} {...stroke} />
        <text x={150} y={100} textAnchor="middle" {...label}>A (anode)</text><text x={200} y={100} textAnchor="start" {...label}>K (cathode)</text>
        <path d="M80 40 L120 40" stroke="#22c55e" strokeWidth={2} markerEnd="url(#bd-arrow)" /><text x={100} y={32} textAnchor="middle" {...label} fontSize={11}>I</text>
      </g>
    ),
  },
};

export default function BookDiagram({ k }: { k: DiagramKey }) {
  const d = DIAGRAMS[k];
  if (!d) return null;
  return (
    <figure className="my-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-3 text-slate-800 dark:text-slate-200 [--book-bg:#ffffff] dark:[--book-bg:#0f172a]">
      <svg viewBox={d.vb} className="w-full h-auto max-h-56" role="img" aria-label={d.title}>
        <defs><marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker></defs>
        {d.body}
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{d.title}</figcaption>
    </figure>
  );
}

/** Topic pages that get a diagram. */
export const TOPIC_DIAGRAMS: Record<string, DiagramKey> = {
  'series-circuits': 'series-resistors',
  'parallel-circuits': 'parallel-resistors',
  'alternating-current': 'sine-wave',
  transformers: 'transformer',
  diodes: 'diode',
  batteries: 'cells-series-parallel',
  'ohms-law': 'simple-circuit',
};
