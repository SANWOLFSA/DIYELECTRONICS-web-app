import type { ReactElement } from 'react';
import type { PartShape, ProbeGuide, ProbeStep } from '../../data/meter/probeGuides';

/** Drawing of a physical part with its pins labelled and the red / black probes animated onto the right pins. */
type Pt = { x: number; y: number };
const S = { stroke: '#94a3b8', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const };

function drawPart(shape: PartShape, n: number): { body: ReactElement; pins: Pt[] } {
  const lead = (x1: number, y1: number, x2: number, y2: number, k?: string | number) => <path key={k} d={`M${x1} ${y1} L${x2} ${y2}`} {...S} />;
  switch (shape) {
    case 'axial': case 'axial-band': case 'axial-glass': {
      const body = shape === 'axial-glass'
        ? <g><rect x={130} y={98} width={100} height={34} rx={8} fill="#cbd5e1" fillOpacity={0.25} stroke="#e2e8f0" strokeWidth={2} /><rect x={124} y={96} width={18} height={38} rx={4} fill="#9ca3af" /><rect x={218} y={96} width={18} height={38} rx={4} fill="#9ca3af" /><line x1={142} y1={115} x2={218} y2={115} stroke="#e2e8f0" strokeWidth={1.5} /></g>
        : shape === 'axial-band'
          ? <g><rect x={130} y={100} width={100} height={30} rx={10} fill="#1f2937" stroke="#475569" /><rect x={208} y={100} width={10} height={30} fill="#d1d5db" /></g>
          : <g><rect x={130} y={100} width={100} height={30} rx={12} fill="#d6c7a1" stroke="#a8956a" /><rect x={150} y={100} width={7} height={30} fill="#eab308" /><rect x={165} y={100} width={7} height={30} fill="#7c3aed" /><rect x={180} y={100} width={7} height={30} fill="#dc2626" /><rect x={210} y={100} width={7} height={30} fill="#ca8a04" /></g>;
      return { body: <g>{lead(60, 200, 60, 115)}{lead(60, 115, 128, 115)}{lead(232, 115, 300, 115)}{lead(300, 115, 300, 200)}{body}</g>, pins: [{ x: 60, y: 200 }, { x: 300, y: 200 }] };
    }
    case 'radial': case 'disc': case 'crystal': case 'radial-electrolytic': case 'led': {
      const body = shape === 'radial-electrolytic'
        ? <g><rect x={140} y={40} width={80} height={110} rx={12} fill="#1e3a8a" stroke="#3b82f6" /><rect x={196} y={40} width={16} height={110} fill="#cbd5e1" fillOpacity={0.7} /><text x={204} y={100} textAnchor="middle" fontSize={18} fontWeight={800} fill="#1e3a8a">−</text><path d="M150 52 L210 52 M180 46 L180 58" stroke="#93c5fd" strokeWidth={1.5} /></g>
        : shape === 'disc'
          ? <ellipse cx={180} cy={95} rx={48} ry={44} fill="#c2410c" stroke="#fb923c" />
          : shape === 'crystal'
            ? <rect x={130} y={70} width={100} height={60} rx={28} fill="#cbd5e1" stroke="#94a3b8" />
            : shape === 'led'
              ? <g><path d="M150 140 L150 80 A30 30 0 0 1 210 80 L210 140 Z" fill="#ef4444" fillOpacity={0.75} stroke="#fca5a5" /><rect x={142} y={136} width={76} height={10} rx={2} fill="#ef4444" fillOpacity={0.6} /><line x1={212} y1={136} x2={212} y2={146} stroke="#fff" strokeWidth={2} /></g>
              : <g><rect x={135} y={50} width={90} height={95} rx={14} fill="#334155" stroke="#64748b" />{[60, 75, 90, 105, 120].map((y) => <line key={y} x1={140} y1={y} x2={220} y2={y} stroke="#b45309" strokeWidth={3} />)}</g>;
      const leftLen = shape === 'led' ? 215 : 200;
      return { body: <g>{lead(160, 145, 160, leftLen)}{lead(200, 145, 200, 200)}{body}</g>, pins: [{ x: 160, y: leftLen }, { x: 200, y: 200 }] };
    }
    case 'to92': case 'pot': {
      const xs = [140, 180, 220];
      const body = shape === 'pot'
        ? <g><rect x={120} y={60} width={120} height={80} rx={10} fill="#1d4ed8" stroke="#60a5fa" /><circle cx={180} cy={100} r={26} fill="#e2e8f0" /><rect x={176} y={78} width={8} height={30} fill="#475569" /></g>
        : <g><path d="M130 140 L130 70 A50 50 0 0 1 230 70 L230 140 Z" fill="#111827" stroke="#475569" /><text x={180} y={112} textAnchor="middle" fontSize={11} fill="#9ca3af">flat face</text></g>;
      return { body: <g>{xs.map((x, i) => lead(x, 140, x, 205, i))}{body}</g>, pins: xs.map((x) => ({ x, y: 205 })) };
    }
    case 'to220': case 'to247': {
      const xs = [140, 180, 220];
      const big = shape === 'to247';
      return {
        body: <g>{xs.map((x, i) => lead(x, 150, x, 210, i))}
          <rect x={big ? 112 : 125} y={20} width={big ? 136 : 110} height={50} rx={4} fill="#9ca3af" stroke="#cbd5e1" /><circle cx={180} cy={42} r={10} fill="#0f172a" />
          <rect x={big ? 112 : 125} y={66} width={big ? 136 : 110} height={86} rx={4} fill="#111827" stroke="#475569" /></g>,
        pins: xs.map((x) => ({ x, y: 210 })),
      };
    }
    case 'bridge': {
      const xs = [120, 160, 200, 240];
      return { body: <g>{xs.map((x, i) => lead(x, 150, x, 205, i))}<rect x={100} y={50} width={160} height={100} rx={8} fill="#111827" stroke="#475569" /><text x={120} y={80} textAnchor="middle" fill="#f87171" fontSize={16} fontWeight={800}>+</text><text x={180} y={80} textAnchor="middle" fill="#e2e8f0" fontSize={14}>~  ~</text><text x={240} y={80} textAnchor="middle" fill="#e2e8f0" fontSize={16} fontWeight={800}>−</text></g>, pins: xs.map((x) => ({ x, y: 205 })) };
    }
    case 'dip4': case 'dip8': {
      const half = n / 2;
      const step = shape === 'dip4' ? 60 : 40;
      const x0 = 180 - ((half - 1) * step) / 2;
      const bottom = Array.from({ length: half }, (_, i) => ({ x: x0 + i * step, y: 195 }));
      const top = Array.from({ length: half }, (_, i) => ({ x: x0 + (half - 1 - i) * step, y: 45 }));
      return {
        body: <g>{bottom.map((p, i) => lead(p.x, 150, p.x, p.y, `b${i}`))}{top.map((p, i) => lead(p.x, 90, p.x, p.y, `t${i}`))}
          <rect x={x0 - 30} y={88} width={(half - 1) * step + 60} height={64} rx={6} fill="#111827" stroke="#475569" /><circle cx={x0 - 14} cy={138} r={5} fill="#e2e8f0" /></g>,
        pins: [...bottom, ...top],
      };
    }
    case 'relay': {
      const xs = [100, 140, 180, 220, 260];
      return { body: <g>{xs.map((x, i) => lead(x, 150, x, 205, i))}<rect x={80} y={40} width={200} height={112} rx={8} fill="#1e3a8a" stroke="#3b82f6" /><text x={180} y={100} textAnchor="middle" fill="#bfdbfe" fontSize={13}>RELAY 12VDC</text></g>, pins: xs.map((x) => ({ x, y: 205 })) };
    }
    case 'transformer': {
      const xs = [110, 150, 210, 250];
      return { body: <g>{xs.map((x, i) => lead(x, 160, x, 210, i))}<rect x={90} y={30} width={180} height={130} rx={6} fill="#57534e" stroke="#a8a29e" /><rect x={130} y={50} width={100} height={90} fill="#b45309" fillOpacity={0.6} /><text x={130} y={152} textAnchor="middle" fill="#e7e5e4" fontSize={10}>PRI</text><text x={230} y={152} textAnchor="middle" fill="#e7e5e4" fontSize={10}>SEC</text></g>, pins: xs.map((x) => ({ x, y: 210 })) };
    }
    case 'switch': {
      const xs = [130, 180, 230];
      return { body: <g>{xs.map((x, i) => lead(x, 140, x, 205, i))}<rect x={105} y={70} width={150} height={72} rx={6} fill="#111827" stroke="#475569" /><path d="M120 70 L250 40" stroke="#cbd5e1" strokeWidth={4} /><rect x={170} y={58} width={18} height={14} fill="#ef4444" /></g>, pins: xs.map((x) => ({ x, y: 205 })) };
    }
    case 'speaker': {
      return { body: <g>{lead(150, 160, 150, 205)}{lead(210, 160, 210, 205)}<circle cx={180} cy={95} r={70} fill="#1f2937" stroke="#64748b" /><circle cx={180} cy={95} r={42} fill="#374151" /><circle cx={180} cy={95} r={14} fill="#111827" /></g>, pins: [{ x: 150, y: 205 }, { x: 210, y: 205 }] };
    }
    case 'battery': {
      return { body: <g><rect x={70} y={85} width={220} height={60} rx={10} fill="#16a34a" stroke="#4ade80" /><rect x={58} y={102} width={14} height={26} rx={3} fill="#cbd5e1" /><text x={95} y={122} fill="#fff" fontSize={20} fontWeight={800}>+</text><text x={262} y={122} fill="#fff" fontSize={20} fontWeight={800}>−</text></g>, pins: [{ x: 60, y: 140 }, { x: 290, y: 140 }] };
    }
    case 'motor': {
      return { body: <g><rect x={110} y={40} width={140} height={110} rx={50} fill="#9ca3af" stroke="#e5e7eb" /><rect x={172} y={20} width={16} height={24} fill="#6b7280" />{lead(150, 150, 150, 205)}{lead(210, 150, 210, 205)}<text x={150} y={170} fill="#f87171" fontSize={14} fontWeight={800} textAnchor="end">+ </text></g>, pins: [{ x: 150, y: 205 }, { x: 210, y: 205 }] };
    }
    case 'element': {
      return { body: <g><path d="M120 120 L120 50 A60 40 0 0 1 240 50 L240 120" stroke="#9ca3af" strokeWidth={12} fill="none" /><rect x={95} y={120} width={170} height={30} rx={4} fill="#57534e" />{lead(120, 150, 120, 205)}{lead(240, 150, 240, 205)}<circle cx={180} cy={150} r={6} fill="#22c55e" />{lead(180, 150, 180, 205)}</g>, pins: [{ x: 120, y: 205 }, { x: 240, y: 205 }, { x: 180, y: 205 }] };
    }
    case 'compressor': {
      return { body: <g><path d="M70 180 L70 100 A110 80 0 0 1 290 100 L290 180 Z" fill="#111827" stroke="#475569" /><circle cx={180} cy={120} r={44} fill="#374151" />{[[180, 95], [155, 140], [205, 140]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill="#cbd5e1" />)}</g>, pins: [{ x: 180, y: 95 }, { x: 155, y: 140 }, { x: 205, y: 140 }] };
    }
    case 'magnetron': {
      return { body: <g><rect x={90} y={40} width={180} height={130} rx={8} fill="#9ca3af" stroke="#e5e7eb" /><rect x={140} y={170} width={80} height={24} fill="#6b7280" />{lead(160, 194, 160, 215)}{lead(200, 194, 200, 215)}<circle cx={100} cy={60} r={6} fill="#22c55e" /></g>, pins: [{ x: 160, y: 215 }, { x: 200, y: 215 }, { x: 100, y: 60 }] };
    }
    default:
      return { body: <g>{lead(140, 120, 140, 200)}{lead(220, 120, 220, 200)}<rect x={120} y={80} width={120} height={40} rx={6} fill="#334155" /></g>, pins: [{ x: 140, y: 200 }, { x: 220, y: 200 }] };
  }
}

function Probe({ at, color, side }: { at: Pt; color: 'red' | 'black'; side: 'left' | 'right' }) {
  const fromAbove = at.y < 100;
  const angle = fromAbove ? (side === 'left' ? 155 : -155) : (side === 'left' ? 28 : -28);
  const fill = color === 'red' ? '#dc2626' : '#111827';
  const edge = color === 'red' ? '#fecaca' : '#9ca3af';
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
      <g className={side === 'left' ? 'probe-in-left' : 'probe-in-right'}>
        <line x1={0} y1={0} x2={0} y2={20} stroke="#e5e7eb" strokeWidth={2.5} />
        <rect x={-6} y={20} width={12} height={8} rx={2} fill={edge} />
        <rect x={-7} y={28} width={14} height={44} rx={6} fill={fill} stroke={edge} strokeWidth={1.5} />
        <path d="M0 72 C 0 90, 6 100, 4 120" stroke={fill} strokeWidth={5} fill="none" />
      </g>
    </g>
  );
}

export default function ProbeDiagram({ guide, step, stepKey }: { guide: ProbeGuide; step: ProbeStep; stepKey: string }) {
  const { body, pins } = drawPart(guide.shape, guide.pins.length);
  const redPt = pins[step.red] || pins[0];
  const blackPt = pins[step.black] || pins[1] || pins[0];
  const redLeft = redPt.x <= blackPt.x;
  return (
    <svg key={stepKey} viewBox="0 0 360 290" className="w-full h-auto" role="img" aria-label={`${guide.label}: red probe on ${guide.pins[step.red]}, black probe on ${guide.pins[step.black]}`}>
      <rect x={0} y={0} width={360} height={290} rx={14} fill="#0b1220" />
      {body}
      {pins.map((p, i) => {
        const isRed = i === step.red, isBlack = i === step.black;
        const above = p.y < 100;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={isRed || isBlack ? 6 : 4} fill={isRed ? '#ef4444' : isBlack ? '#e5e7eb' : '#64748b'} stroke={isBlack ? '#111827' : 'none'} />
            <text x={p.x + 9} y={above ? p.y - 8 : p.y - 6} fontSize={10} fontWeight={800} fill={isRed ? '#fca5a5' : isBlack ? '#f1f5f9' : '#94a3b8'}>{i + 1}</text>
          </g>
        );
      })}
      <Probe at={redPt} color="red" side={redLeft ? 'left' : 'right'} />
      <Probe at={blackPt} color="black" side={redLeft ? 'right' : 'left'} />
      <text x={14} y={20} fontSize={11} fontWeight={700} fill="#cbd5e1">{guide.label}</text>
      <g fontSize={11} fontWeight={800}>
        <rect x={14} y={272} width={10} height={10} rx={2} fill="#dc2626" /><text x={30} y={281} fill="#fca5a5" style={{ paintOrder: 'stroke', stroke: '#0b1220', strokeWidth: 3 }}>RED → {guide.pins[step.red]}</text>
        <rect x={196} y={272} width={10} height={10} rx={2} fill="#111827" stroke="#9ca3af" /><text x={212} y={281} fill="#e5e7eb" style={{ paintOrder: 'stroke', stroke: '#0b1220', strokeWidth: 3 }}>BLACK → {guide.pins[step.black]}</text>
      </g>
    </svg>
  );
}
