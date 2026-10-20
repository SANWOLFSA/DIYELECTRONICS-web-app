import { useMemo, useState } from 'react';
import { AlertTriangle, Camera, Network, X, Zap, Gauge, Info, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

/** Shape returned by POST /api/circuit-map (see server.ts sanitizeCircuitMap). */
export type Box = [number, number, number, number]; // [ymin, xmin, ymax, xmax], 0-1000
export interface CircuitBlock { id: string; label: string; type: string; description: string; voltageIn: string | null; voltageOut: string | null; keyParts: string[]; box_2d: Box | null }
export interface CircuitConnection { from: string; to: string; kind: 'power' | 'signal' | 'data' | 'control' | 'ground'; label: string; voltage: string | null }
export interface CircuitComponent { id: string; ref: string; label: string; type: string; blockId: string | null; box_2d: Box | null; check: boolean; priority: number; reason: string; measure: string; expected: string; howToTest: string }
export interface CircuitMap {
  title: string; boardType: string; confidence: 'low' | 'medium' | 'high'; summary: string;
  blocks: CircuitBlock[]; connections: CircuitConnection[]; powerFlow: string[]; components: CircuitComponent[];
  testPoints: { label: string; blockId: string | null; expected: string; how: string }[];
  failurePoints: { component: string; symptom: string; blockId: string | null }[];
  safety: string;
}
export interface CircuitMapResult { map: CircuitMap; hasPhoto: boolean; board?: string; disclaimer: string; photoSource?: string | null }

const BLOCK_COLORS: Record<string, string> = {
  input: '#f59e0b', protection: '#f97316', rectifier: '#eab308', pfc: '#a3e635', smps: '#22c55e', standby: '#14b8a6', regulator: '#06b6d4',
  soc: '#6b8afd', memory: '#818cf8', storage: '#a78bfa', backlight: '#f472b6', display: '#e879f9', audio: '#fb7185', io: '#94a3b8',
  rf: '#38bdf8', sensor: '#2dd4bf', battery: '#facc15', charger: '#fbbf24', motor: '#fb923c', other: '#94a3b8',
};
const EDGE_COLORS: Record<string, string> = { power: '#f59e0b', signal: '#6b8afd', data: '#a78bfa', control: '#22d3ee', ground: '#64748b' };

type Selection = { kind: 'block'; id: string } | { kind: 'component'; id: string } | null;

export default function CircuitMapView({ result, photoUrl }: { result: CircuitMapResult; photoUrl?: string | null }) {
  const { map } = result;
  const hasPhotoView = !!photoUrl && result.hasPhoto;
  const [tab, setTab] = useState<'photo' | 'diagram'>(hasPhotoView ? 'photo' : 'diagram');
  const [sel, setSel] = useState<Selection>(() => {
    const first = map.components.find(c => c.check && c.priority === 1) || map.components.find(c => c.check);
    return first ? { kind: 'component', id: first.id } : null;
  });
  const [expanded, setExpanded] = useState(false);
  const suspects = map.components.filter(c => c.check);
  const suspectBlocks = useMemo(() => new Set(suspects.map(c => c.blockId).filter(Boolean) as string[]), [suspects]);

  const selected = sel?.kind === 'component' ? map.components.find(c => c.id === sel.id) : null;
  const selectedBlock = sel?.kind === 'block' ? map.blocks.find(b => b.id === sel.id) : selected?.blockId ? map.blocks.find(b => b.id === selected.blockId) : null;

  const body = (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 overflow-hidden">
      {/* header */}
      <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{map.title}</p>
          <p className="text-[11px] text-stone-500">{map.boardType} · confidence {map.confidence} · <span className="text-amber-600 dark:text-amber-400 font-semibold">AI-generated, approximate</span></p>
        </div>
        <button type="button" onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0" aria-label={expanded ? 'Exit full screen' : 'Full screen'}>
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      {/* tabs */}
      <div className="px-3.5 flex gap-1 border-b border-stone-200 dark:border-stone-800">
        {hasPhotoView && (
          <button type="button" onClick={() => setTab('photo')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px ${tab === 'photo' ? 'border-cobalt-500 text-cobalt-600 dark:text-cobalt-300' : 'border-transparent text-stone-500'}`}><Camera className="w-3.5 h-3.5" /> Board photo</button>
        )}
        <button type="button" onClick={() => setTab('diagram')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px ${tab === 'diagram' ? 'border-cobalt-500 text-cobalt-600 dark:text-cobalt-300' : 'border-transparent text-stone-500'}`}><Network className="w-3.5 h-3.5" /> Block diagram &amp; power flow</button>
        {suspects.length > 0 && <span className="ml-auto self-center text-[11px] font-bold text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {suspects.length} to check</span>}
      </div>

      {tab === 'photo' && hasPhotoView && (
        <PhotoOverlay photoUrl={photoUrl!} map={map} sel={sel} onSelect={setSel} />
      )}
      {tab === 'diagram' && (
        <BlockDiagram map={map} suspectBlocks={suspectBlocks} sel={sel} onSelect={setSel} />
      )}

      {/* details */}
      <div className="px-3.5 py-3 space-y-3 border-t border-stone-200 dark:border-stone-800">
        {selected ? (
          <div className={`rounded-xl p-3 border ${selected.check ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10' : 'border-stone-200 dark:border-stone-700'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {selected.check && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle animate-pulse" />}
                {selected.label}{selected.ref ? <span className="text-stone-500 font-mono text-xs"> ({selected.ref})</span> : null}
              </p>
              <button type="button" onClick={() => setSel(null)} className="p-1 text-stone-400" aria-label="Close details"><X className="w-3.5 h-3.5" /></button>
            </div>
            {selectedBlock && <p className="text-[11px] text-stone-500 mt-0.5">In: {selectedBlock.label}</p>}
            {selected.reason && <p className="mt-2 text-xs text-stone-700 dark:text-stone-300"><span className="font-bold">Why check it:</span> {selected.reason}</p>}
            {selected.measure && <p className="mt-1 text-xs text-stone-700 dark:text-stone-300"><Gauge className="inline w-3.5 h-3.5 mr-1 -mt-0.5" /><span className="font-bold">Measure:</span> {selected.measure}</p>}
            {selected.expected && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300"><span className="font-bold">Expected:</span> {selected.expected}</p>}
            {selected.howToTest && <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{selected.howToTest}</p>}
          </div>
        ) : selectedBlock ? (
          <div className="rounded-xl p-3 border border-stone-200 dark:border-stone-700">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">{selectedBlock.label}</p>
              <button type="button" onClick={() => setSel(null)} className="p-1 text-stone-400" aria-label="Close details"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="mt-1 text-xs text-stone-700 dark:text-stone-300">{selectedBlock.description}</p>
            {(selectedBlock.voltageIn || selectedBlock.voltageOut) && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300"><Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />{selectedBlock.voltageIn || '?'} → {selectedBlock.voltageOut || '?'}</p>}
            {selectedBlock.keyParts.length > 0 && <p className="mt-1 text-[11px] text-stone-500">Key parts: {selectedBlock.keyParts.join(', ')}</p>}
            {map.testPoints.filter(t => t.blockId === selectedBlock.id).map((t, i) => <p key={i} className="mt-1 text-xs text-emerald-700 dark:text-emerald-300"><span className="font-bold">Test {t.label}:</span> {t.expected} <span className="text-stone-500">({t.how})</span></p>)}
            <div className="mt-2 flex flex-wrap gap-1">
              {map.components.filter(c => c.blockId === selectedBlock.id).map(c => (
                <button key={c.id} type="button" onClick={() => setSel({ kind: 'component', id: c.id })} className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${c.check ? 'border-red-400 text-red-600 dark:text-red-300 cm-flash' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}>{c.ref || c.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Tap a flashing red part or a block for what to measure.</p>
        )}

        {suspects.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-1.5">Check these first</p>
            <div className="flex flex-wrap gap-1.5">
              {[...suspects].sort((a, b) => a.priority - b.priority).map(c => (
                <button key={c.id} type="button" onClick={() => setSel({ kind: 'component', id: c.id })} className={`cm-flash px-2.5 py-1 rounded-lg border text-xs font-semibold text-red-700 dark:text-red-200 ${sel?.kind === 'component' && sel.id === c.id ? 'bg-red-100 dark:bg-red-500/20' : ''}`}>
                  {c.priority === 1 ? '① ' : ''}{c.label}{c.ref ? ` ${c.ref}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {map.summary && <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{map.summary}</p>}
        {map.powerFlow.length > 1 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed"><Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Power flow: {map.powerFlow.map(id => map.blocks.find(b => b.id === id)?.label || id).join(' → ')}</p>
        )}
        {map.failurePoints.length > 0 && (
          <details className="text-xs text-stone-600 dark:text-stone-400">
            <summary className="cursor-pointer font-semibold">Typical failure points ({map.failurePoints.length})</summary>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">{map.failurePoints.map((f, i) => <li key={i}><span className="font-semibold">{f.component}:</span> {f.symptom}</li>)}</ul>
          </details>
        )}
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {map.safety}</p>
        <p className="text-[10px] text-stone-400">{result.disclaimer}{result.photoSource ? <> Photo: <a href={result.photoSource} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">source <ExternalLink className="w-2.5 h-2.5" /></a></> : null}</p>
      </div>
    </div>
  );

  if (!expanded) return body;
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm overflow-y-auto p-2 sm:p-6" onClick={() => setExpanded(false)}>
      <div className="max-w-4xl mx-auto" onClick={e => e.stopPropagation()}>{body}</div>
    </div>
  );
}

function PhotoOverlay({ photoUrl, map, sel, onSelect }: { photoUrl: string; map: CircuitMap; sel: Selection; onSelect: (s: Selection) => void }) {
  const [showBlocks, setShowBlocks] = useState(true);
  const boxStyle = (b: Box) => ({ top: `${b[0] / 10}%`, left: `${b[1] / 10}%`, height: `${(b[2] - b[0]) / 10}%`, width: `${(b[3] - b[1]) / 10}%` });
  const located = map.components.filter(c => c.box_2d);
  const unlocated = map.components.filter(c => c.check && !c.box_2d);
  return (
    <div className="p-2">
      <div className="relative w-full select-none">
        <img src={photoUrl} alt="Board photo with AI markers" className="w-full h-auto rounded-lg block" draggable={false} />
        {showBlocks && map.blocks.filter(b => b.box_2d).map(b => (
          <button key={b.id} type="button" onClick={() => onSelect({ kind: 'block', id: b.id })} style={{ ...boxStyle(b.box_2d!), borderColor: BLOCK_COLORS[b.type] || '#94a3b8' }}
            className={`absolute border-2 border-dashed rounded-md bg-transparent ${sel?.kind === 'block' && sel.id === b.id ? 'bg-white/10' : ''}`} aria-label={b.label}>
            <span className="absolute -top-0 left-0 max-w-full truncate text-[9px] sm:text-[10px] font-bold px-1 rounded-br text-black" style={{ background: BLOCK_COLORS[b.type] || '#94a3b8' }}>{b.label}</span>
          </button>
        ))}
        {located.map(c => (
          <button key={c.id} type="button" onClick={() => onSelect({ kind: 'component', id: c.id })} style={boxStyle(c.box_2d!)}
            className={`absolute rounded-md border-2 ${c.check ? 'cm-flash border-red-500' : 'border-cobalt-400/80 bg-cobalt-400/5'} ${sel?.kind === 'component' && sel.id === c.id ? 'ring-2 ring-white' : ''}`}
            aria-label={`${c.label}${c.check ? ' (check this)' : ''}`}>
            <span className={`absolute left-0 top-full mt-0.5 whitespace-nowrap text-[9px] sm:text-[10px] font-bold px-1 rounded ${c.check ? 'bg-red-600 text-white' : 'bg-cobalt-600/90 text-white'}`}>{c.ref || c.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showBlocks} onChange={e => setShowBlocks(e.target.checked)} className="accent-cobalt-500" /> Show sections</label>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-2 border-red-500 cm-flash" /> check / suspect</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm border-2 border-cobalt-400" /> identified part</span>
        {unlocated.length > 0 && <span className="text-amber-600 dark:text-amber-400">{unlocated.length} suspect{unlocated.length > 1 ? 's' : ''} not located in the photo (see list below)</span>}
      </div>
    </div>
  );
}

/** Block diagram laid out in "snake" rows following the power path, with animated current flow. */
function BlockDiagram({ map, suspectBlocks, sel, onSelect }: { map: CircuitMap; suspectBlocks: Set<string>; sel: Selection; onSelect: (s: Selection) => void }) {
  const cols = typeof window !== 'undefined' && window.innerWidth < 640 ? 2 : 3;
  const W = 170, H = 70, GX = 46, GY = 58, PAD = 16;
  const order = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of map.powerFlow) if (!seen.has(id)) { seen.add(id); out.push(id); }
    for (const b of map.blocks) if (!seen.has(b.id)) { seen.add(b.id); out.push(b.id); }
    return out;
  }, [map]);
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    order.forEach((id, i) => {
      const row = Math.floor(i / cols);
      const c = i % cols;
      const col = row % 2 === 0 ? c : cols - 1 - c; // snake so consecutive power blocks stay adjacent
      m.set(id, { x: PAD + col * (W + GX), y: PAD + row * (H + GY) });
    });
    return m;
  }, [order, cols]);
  const rows = Math.ceil(order.length / cols);
  const vbW = PAD * 2 + cols * W + (cols - 1) * GX;
  const vbH = PAD * 2 + rows * H + (rows - 1) * GY + 20;
  const flowPairs = new Set(map.powerFlow.slice(1).map((id, i) => `${map.powerFlow[i]}>${id}`));
  const edges = [...map.connections];
  for (const pair of flowPairs) {
    const [from, to] = pair.split('>');
    if (!edges.some(e => e.from === from && e.to === to)) edges.push({ from, to, kind: 'power', label: '', voltage: null });
  }
  const anchor = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ac = { x: a.x + W / 2, y: a.y + H / 2 }, bc = { x: b.x + W / 2, y: b.y + H / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) * H > Math.abs(dy) * W) {
      return { x1: ac.x + Math.sign(dx) * W / 2, y1: ac.y, x2: bc.x - Math.sign(dx) * W / 2, y2: bc.y };
    }
    return { x1: ac.x, y1: ac.y + Math.sign(dy) * H / 2, x2: bc.x, y2: bc.y - Math.sign(dy) * H / 2 };
  };
  const wrap = (s: string, n: number) => {
    const words = s.split(/\s+/); const lines: string[] = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  };
  return (
    <div className="p-2 overflow-x-auto">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto min-w-[320px]" role="img" aria-label="Block diagram with power flow">
        <defs>
          {Object.entries(EDGE_COLORS).map(([k, c]) => (
            <marker key={k} id={`cm-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
          ))}
        </defs>
        {edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const { x1, y1, x2, y2 } = anchor(a, b);
          const isFlow = flowPairs.has(`${e.from}>${e.to}`) || e.kind === 'power';
          const color = EDGE_COLORS[e.kind] || '#94a3b8';
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={0.25} strokeWidth={isFlow ? 6 : 3} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={isFlow ? 2.5 : 1.5} className={isFlow ? 'cm-flow' : ''} strokeDasharray={isFlow ? undefined : e.kind === 'ground' ? '2 3' : '5 4'} markerEnd={`url(#cm-arrow-${e.kind in EDGE_COLORS ? e.kind : 'signal'})`} />
              {(e.voltage || e.label) && (
                <text x={mx} y={my - 5} textAnchor="middle" fontSize="10" fontWeight={600} fill={color} className="pointer-events-none" style={{ paintOrder: 'stroke', stroke: 'rgb(12 12 16 / 0.85)', strokeWidth: 3 }}>{(e.voltage || e.label).slice(0, 18)}</text>
              )}
            </g>
          );
        })}
        {order.map(id => {
          const b = map.blocks.find(x => x.id === id)!;
          const p = pos.get(id)!;
          const suspect = suspectBlocks.has(id);
          const active = sel?.kind === 'block' ? sel.id === id : sel?.kind === 'component' ? map.components.find(c => c.id === sel.id)?.blockId === id : false;
          const color = BLOCK_COLORS[b.type] || '#94a3b8';
          const nSus = map.components.filter(c => c.check && c.blockId === id).length;
          return (
            <g key={id} transform={`translate(${p.x},${p.y})`} onClick={() => onSelect({ kind: 'block', id })} className="cursor-pointer">
              <rect width={W} height={H} rx={12} fill="rgb(24 26 34)" stroke={suspect ? '#ef4444' : color} strokeWidth={active ? 3.5 : 2} className={suspect ? 'cm-flash-svg' : ''} />
              <rect width={6} height={H - 16} x={0} y={8} rx={3} fill={color} />
              {wrap(b.label, 20).map((ln, li) => <text key={li} x={14} y={22 + li * 14} fontSize="12.5" fontWeight={700} fill="#f1f5f9">{ln}</text>)}
              <text x={14} y={H - 10} fontSize="10" fill="#fbbf24">{[b.voltageIn, b.voltageOut].filter(Boolean).join(' → ').slice(0, 26)}</text>
              {nSus > 0 && (
                <text x={W / 2} y={H + 15} textAnchor="middle" fontSize="10.5" fontWeight={800} fill="#f87171" className="cm-flash-svg" strokeWidth={0.6}>
                  ⚠ {map.components.filter(c => c.check && c.blockId === id).map(c => c.ref || c.label).join(' · ').slice(0, 30)}
                </text>
              )}
              {nSus > 0 && (
                <g transform={`translate(${W - 14},14)`}>
                  <circle r={10} fill="#ef4444" className="cm-flash-svg" stroke="#ef4444" />
                  <text y={4} textAnchor="middle" fontSize="11" fontWeight={800} fill="#fff">{nSus}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-stone-500 px-1">
        <span className="inline-flex items-center gap-1"><span className="w-4 h-0.5 bg-amber-500" /> power (animated = current flow)</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-0.5 bg-[#6b8afd]" /> signal</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-0.5 bg-cyan-400" /> control</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> parts to check</span>
      </div>
    </div>
  );
}
