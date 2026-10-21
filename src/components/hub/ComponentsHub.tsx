// Components section: /components (search + browse) and /components/:partId (any part number on Earth).
// Saved parts load from Firestore (discoveredComponents); unknown ones are researched once (Gemini + Google
// Search, cited) and saved. Datasheet / distributor links are plain searches, so they always work.
import { useEffect, useMemo, useRef, useState } from 'react';
import { WhereToBuy } from '../PartsFinderPanels';
import { Cpu, Search, FileText, Gauge, Repeat, ShoppingBag, CircuitBoard, Info, ListChecks, Share2, Check } from 'lucide-react';
import { usePathname, navigate, RouteLink } from '../../hooks/usePathname';
import {
  getDiscoveredComponent, researchComponent, saveDiscoveredComponent, componentInfoFromDoc, componentLinks, normalizePartNumber,
  subscribeDiscoveredComponents, matchesQuery, friendlyHubError, PART_ID_RE,
  type ComponentInfo, type DiscoveredComponent,
} from '../../lib/repairHub';
import { PageShell, Hero, card, btnPrimary, btnGhost, Loading, ErrorNote, Sources, BulletList, Chip, ExtLink, SignInPrompt, SectionTitle, useHubUser } from './ui';
import DeviceCommunityPanel from './DeviceCommunityPanel';

/** Basic component types and their /multimeter/test/:component pages (built in the Multimeter section). */
export const COMPONENT_TYPES: { key: string; label: string; examples: string }[] = [
  { key: 'resistor', label: 'Resistors', examples: '10kΩ, 0R, shunt' },
  { key: 'capacitor', label: 'Capacitors', examples: 'ceramic, film, X2' },
  { key: 'electrolytic-capacitor', label: 'Electrolytic capacitors', examples: '1000µF 25V' },
  { key: 'diode', label: 'Diodes', examples: '1N4007, 1N5819' },
  { key: 'zener-diode', label: 'Zener diodes', examples: 'BZX55C5V1' },
  { key: 'led', label: 'LEDs', examples: 'TV backlight LEDs' },
  { key: 'bridge-rectifier', label: 'Bridge rectifiers', examples: 'KBP307, GBU8K' },
  { key: 'bjt-transistor', label: 'Transistors (BJT)', examples: '2N2222, BC547, TIP31' },
  { key: 'mosfet', label: 'MOSFETs', examples: 'IRF540N, AO3400' },
  { key: 'igbt', label: 'IGBTs', examples: 'FGA25N120 (induction cookers)' },
  { key: 'triac', label: 'Triacs', examples: 'BTA16-600B' },
  { key: 'scr', label: 'Thyristors (SCR)', examples: 'BT151' },
  { key: 'voltage-regulator', label: 'Voltage regulators', examples: 'LM7805, AMS1117' },
  { key: 'ic', label: 'ICs', examples: 'NE555, LM358, PWM controllers' },
  { key: 'optocoupler', label: 'Optocouplers', examples: 'PC817' },
  { key: 'fuse', label: 'Fuses', examples: 'glass, SMD, thermal' },
  { key: 'varistor', label: 'Varistors (MOV)', examples: '14D471K' },
  { key: 'thermistor', label: 'Thermistors', examples: 'NTC 10k, PTC' },
  { key: 'relay', label: 'Relays', examples: 'SRD-05VDC' },
  { key: 'transformer', label: 'Transformers', examples: 'SMPS ferrite, mains' },
  { key: 'inductor', label: 'Inductors / coils', examples: 'chokes' },
  { key: 'crystal', label: 'Crystals', examples: '32.768 kHz, 16 MHz' },
  { key: 'switch', label: 'Switches', examples: 'micro, tact, reed' },
  { key: 'motor', label: 'Motors', examples: 'DC, BLDC, universal' },
  { key: 'speaker', label: 'Speakers & buzzers', examples: '8Ω, piezo' },
  { key: 'battery', label: 'Batteries', examples: '18650, CR2032, SLA' },
  { key: 'sensor', label: 'Sensors', examples: 'NTC probes, hall, PIR' },
];

export const multimeterTestPath = (key: string) => `/multimeter/test/${encodeURIComponent(key)}`;

export default function ComponentsHub({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { pathname } = usePathname();
  const id = decodeURIComponent(pathname.split('/')[2] || '');
  return id ? <ComponentPage rawId={id} onOpenAuth={onOpenAuth} /> : <ComponentsHome />;
}

function ComponentsHome() {
  const [q, setQ] = useState('');
  const [parts, setParts] = useState<DiscoveredComponent[]>([]);
  useEffect(() => subscribeDiscoveredComponents(setParts), []);
  const filtered = useMemo(() => (q.trim().length >= 2 ? parts.filter((p) => matchesQuery(`${p.partNumber} ${p.manufacturer} ${p.category} ${(p.equivalents || []).join(' ')}`, q)) : parts).slice(0, 48), [q, parts]);
  const go = () => { const n = normalizePartNumber(q); if (n) navigate(`/components/${encodeURIComponent(n)}?q=${encodeURIComponent(q.trim())}`); };
  useEffect(() => { document.title = 'Electronic components · DIY Electronics'; }, []);

  return (
    <PageShell>
      <Hero eyebrow="Every component, any part number" title="Component pages" subtitle="Type any part number (ICs, transistors, MOSFETs, regulators, diodes, modules, connectors). We research it from datasheets and cite every source: specs, pinout, equivalents, datasheet links and how to test it.">
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part number, e.g. IRF540N, LM7805, TPS54331, STM32F103C8T6" className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-cobalt-500/30" />
          </div>
          <button className={btnPrimary} disabled={normalizePartNumber(q).length < 2}>Look up</button>
        </form>
        <p className="text-[11px] text-indigo-100/70">PCB / logic-board numbers (e.g. 820-02016, BN41-02568A) have their own <RouteLink to="/blueprint-viewer" className="underline">board library</RouteLink>.</p>
      </Hero>

      <SectionTitle icon={<Gauge className="w-4 h-4" />} title="How to test each component type" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {COMPONENT_TYPES.map((t) => (
          <RouteLink key={t.key} to={multimeterTestPath(t.key)} className={`${card} p-3 hover:border-emerald-500 transition-colors`}>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.label}</div>
            <div className="text-[11px] text-slate-500">{t.examples}</div>
          </RouteLink>
        ))}
      </div>

      <SectionTitle icon={<Cpu className="w-4 h-4" />} title={`Component pages${parts.length ? ` · ${parts.length}` : ''}`} />
      {parts.length === 0 ? (
        <p className="text-sm text-slate-500">No component pages saved yet. Look up a part number above and it becomes a permanent page.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((p) => (
            <RouteLink key={p.id} to={`/components/${encodeURIComponent(p.id)}`} className={`${card} p-3 flex items-center gap-3 hover:border-indigo-500 transition-colors`}>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0"><Cpu className="w-5 h-5 text-indigo-500" /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.partNumber}</div>
                <div className="text-[11px] text-slate-500 truncate">{[p.manufacturer, p.category, p.package].filter(Boolean).join(' · ')}</div>
              </div>
            </RouteLink>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ComponentPage({ rawId, onOpenAuth }: { rawId: string; onOpenAuth?: () => void }) {
  const { search } = usePathname();
  const id = normalizePartNumber(rawId);
  const q = (search.get('q') || rawId).trim();
  const { owner } = useHubUser();
  const [saved, setSaved] = useState<DiscoveredComponent | null>(null);
  const [info, setInfo] = useState<ComponentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const researched = useRef('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setInfo(null); setSaved(null); setSaveState('idle');
    (async () => {
      const d = PART_ID_RE.test(id) ? await getDiscoveredComponent(id) : null;
      if (!alive) return;
      if (d) {
        setSaved(d);
        setInfo(componentInfoFromDoc(d, componentLinks(d.partNumber, d.manufacturer)));
        setLoading(false);
        return;
      }
      if (researched.current === q) { setLoading(false); return; }
      researched.current = q;
      try {
        const r = await researchComponent(q);
        if (alive) setInfo({ ...r, links: r.links?.length ? r.links : componentLinks(q) });
      } catch (e) {
        if (alive) { setError(friendlyHubError(e, 'look up this part')); setInfo(null); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, q]);

  useEffect(() => { document.title = `${info?.found ? info.partNumber : q} · Components · DIY Electronics`; }, [info, q]);

  useEffect(() => {
    if (!info?.found || saved || !owner || saveState !== 'idle') return;
    setSaveState('saving');
    saveDiscoveredComponent(info, owner)
      .then((sid) => { setSaveState('saved'); if (sid !== id) navigate(`/components/${encodeURIComponent(sid)}`, { replace: true }); })
      .catch(() => setSaveState('error'));
  }, [info, saved, owner, saveState, id]);

  if (loading) return <PageShell><Loading label={`Looking up ${q} in datasheets and distributor listings…`} /></PageShell>;

  const links = info?.links?.length ? info.links : componentLinks(q);
  const datasheetLinks = links.filter((l) => l.kind === 'datasheet');
  const otherLinks = links.filter((l) => l.kind !== 'datasheet');
  const testKey = info?.testKey || '';
  const panelKey = `gen~part-${id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 120)}`;

  return (
    <PageShell>
      <div className={`${card} p-5 sm:p-6 space-y-3`}>
        <div className="flex flex-wrap gap-1.5">
          <Chip className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Cpu className="w-3 h-3" /> Component</Chip>
          {info?.category && <Chip>{info.category}</Chip>}
          {info?.package && <Chip>{info.package}</Chip>}
          {info?.manufacturer && <Chip>{info.manufacturer}</Chip>}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{info?.found ? info.partNumber : q}</h1>
        {info?.found && info.description && <p className="text-sm text-slate-600 dark:text-slate-300">{info.description}</p>}
        {error && <ErrorNote message={error} />}
        {info?.aiError && <ErrorNote message={`${info.aiError} The datasheet and distributor links below still work.`} />}
        {info && !info.found && !info.aiError && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
            <Info className="w-4 h-4 shrink-0" /> We could not confirm this exact part number from reliable sources, so no specs are shown. Check the marking (SMD codes differ from part numbers) or use the datasheet searches below.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <RouteLink to={testKey ? multimeterTestPath(testKey) : '/multimeter'} className={btnPrimary}><Gauge className="w-3.5 h-3.5" /> How to test {testKey ? `a ${COMPONENT_TYPES.find((t) => t.key === testKey)?.label.replace(/s$/, '').toLowerCase() || testKey}` : 'it with a multimeter'}</RouteLink>
          <RouteLink to={`/marketplace?q=${encodeURIComponent(info?.partNumber || q)}&near=1`} className={btnGhost}><ShoppingBag className="w-3.5 h-3.5" /> Find it in the Marketplace</RouteLink>
          <RouteLink to={`/blueprint-viewer/board/${encodeURIComponent(id)}`} className={btnGhost}><CircuitBoard className="w-3.5 h-3.5" /> It's a PCB number</RouteLink>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }} className={btnGhost}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Share'}
          </button>
        </div>
        {info?.found && !saved && (
          saveState === 'saving' ? <p className="text-[11px] text-slate-500">Saving this component page…</p>
            : saveState === 'saved' ? <p className="text-[11px] text-emerald-600 font-bold">Saved as a permanent component page.</p>
            : saveState === 'error' ? <p className="text-[11px] text-rose-600">Could not save right now; the page is shown from live research.</p>
            : !owner ? <SignInPrompt action="save this part as a permanent page" onOpenAuth={onOpenAuth} /> : null
        )}
      </div>

      <WhereToBuy text={[info?.partNumber || '', q].join('\n')} max={4} />

      <div className="grid lg:grid-cols-2 gap-4">
        <section className={`${card} p-5 space-y-3`}>
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100"><FileText className="w-4 h-4 text-indigo-500" /> Datasheets</h2>
          <div className="flex flex-wrap gap-1.5">{datasheetLinks.map((l) => <ExtLink key={l.url} href={l.url}>{l.label}</ExtLink>)}</div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-2">Buy & compare</h3>
          <div className="flex flex-wrap gap-1.5">{otherLinks.map((l) => <ExtLink key={l.url} href={l.url}>{l.label}</ExtLink>)}</div>
          <p className="text-[11px] text-slate-500">These open searches; availability is not checked by us.</p>
        </section>
        {info?.found && info.specs.length > 0 && (
          <section className={`${card} p-5 space-y-3`}>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100"><ListChecks className="w-4 h-4 text-indigo-500" /> Key specifications</h2>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {info.specs.map((s, i) => <div key={i} className="py-1.5 grid grid-cols-3 gap-2"><dt className="text-slate-500 text-xs font-bold">{s.label}</dt><dd className="col-span-2 text-slate-800 dark:text-slate-200">{s.value}</dd></div>)}
            </dl>
          </section>
        )}
        {info?.found && info.pinout.length > 0 && (
          <section className={`${card} p-5 space-y-3 overflow-x-auto`}>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100"><Cpu className="w-4 h-4 text-emerald-500" /> Pinout</h2>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2">Pin</th><th className="py-1 pr-2">Name</th><th className="py-1">Function</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {info.pinout.map((p, i) => <tr key={i}><td className="py-1 pr-2 font-bold">{p.pin}</td><td className="py-1 pr-2 font-bold text-indigo-600 dark:text-indigo-400">{p.name}</td><td className="py-1 text-slate-600 dark:text-slate-300">{p.function}</td></tr>)}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500">Confirm against the datasheet for your exact package before soldering.</p>
          </section>
        )}
        {info?.found && info.equivalents.length > 0 && (
          <section className={`${card} p-5 space-y-3`}>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100"><Repeat className="w-4 h-4 text-amber-500" /> Equivalents / substitutes</h2>
            <div className="flex flex-wrap gap-1.5">
              {info.equivalents.map((e) => {
                const pn = normalizePartNumber(e.split(/[\s(]/)[0] || e);
                return pn ? <RouteLink key={e} to={`/components/${encodeURIComponent(pn)}`} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 hover:bg-amber-100" title={e}>{e}</RouteLink> : null;
              })}
            </div>
            <p className="text-[11px] text-slate-500">Check voltage, current, package and pinout before substituting.</p>
          </section>
        )}
        {info?.found && (info.applications.length > 0 || info.markings.length > 0) && (
          <section className={`${card} p-5 space-y-3`}>
            {info.applications.length > 0 && <><h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Typical applications</h2><BulletList items={info.applications} /></>}
            {info.markings.length > 0 && <><h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-2">Marking codes</h3><div className="flex flex-wrap gap-1">{info.markings.map((m) => <Chip key={m}>{m}</Chip>)}</div></>}
          </section>
        )}
        {info?.found && info.testNotes.length > 0 && (
          <section className={`${card} p-5 space-y-3`}>
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100"><Gauge className="w-4 h-4 text-emerald-500" /> Testing notes</h2>
            <BulletList items={info.testNotes} />
          </section>
        )}
        {info?.found && <section className={`${card} p-5`}><Sources sources={info.sources} disclaimer={info.disclaimer || 'Summarised by AI from the cited sources. Always confirm ratings and pinout in the official datasheet.'} /></section>}
      </div>

      {info?.found && <DeviceCommunityPanel device={{ key: panelKey, label: info.partNumber, path: `/components/${encodeURIComponent(id)}` }} keyParts={[info.partNumber]} />}
    </PageShell>
  );
}
