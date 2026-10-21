import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, ChevronRight, ArrowLeft, Wrench, ShieldAlert, Search, Layers, CheckCircle, Clock, Gauge, ListChecks, Package,
  Link2, BookmarkPlus, AlertTriangle, Lightbulb, Ruler, ChevronLeft, Globe2, Sparkles, X,
} from 'lucide-react';
// Firestore helpers come straight from the SDK; only db/auth come from ../lib/firebase
// (a stale src/lib/firebase.js shadows firebase.ts in Vite and only exports db/auth/storage).
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  CATALOG, CATALOG_STATS, GROUP_ORDER, findType, findBrand, findModel, findSize, searchCatalog,
  type CatalogDeviceType, type CatalogBrand, type CatalogModel, type CatalogSize, type Solution,
} from '../data/catalog';
import EscalationSolutions from './EscalationSolutions';
import { askAiPrompt } from '../lib/escalation';
import { loadSolutions } from '../data/solutions';
import { usePathname, navigate, RouteLink } from '../hooks/usePathname';
import BrandLogo from './catalog/BrandLogo';
import ModelImage from './catalog/ModelImage';
import DeviceTypeIcon from './catalog/DeviceTypeIcon';
import CommunityVideosSection from './catalog/CommunityVideos';
import MeterTestLinks from './meter/MeterTestLinks';
import type { VideoTarget } from '../lib/communityVideos';
import DeviceCommunityPanel from './hub/DeviceCommunityPanel';
import RequestDevice from './hub/RequestDevice';
import { subscribeDiscoveredDevices, matchesQuery, catalogDeviceKey, deviceSlug, normalizePartNumber, type DiscoveredDevice } from '../lib/repairHub';

// ------------------------------------------------------------------
// Route model
// /devices
// /devices/:type
// /devices/:type/:brand
// /devices/:type/:brand/:model                 (size picker, or solutions when no sizes)
// /devices/:type/:brand/:model/:size           (solutions for that size)
// .../solutions                                (explicit solutions list)
// .../solutions/:solutionId                    (single solution)
// ------------------------------------------------------------------

interface Resolved {
  type?: CatalogDeviceType;
  brand?: CatalogBrand;
  model?: CatalogModel;
  size?: CatalogSize;
  solutionsPath?: boolean;
  solutionId?: string;
  notFound?: { at: string; parent: string };
}

function resolve(segs: string[], base: string): Resolved {
  const r: Resolved = {};
  if (segs.length === 0) return r;
  r.type = findType(segs[0]);
  if (!r.type) return { notFound: { at: 'device type', parent: base } };
  const typeUrl = `${base}/${r.type.slug}`;
  if (segs.length === 1) return r;
  r.brand = findBrand(r.type, segs[1]);
  if (!r.brand) return { type: r.type, notFound: { at: 'brand', parent: typeUrl } };
  const brandUrl = `${typeUrl}/${r.brand.slug}`;
  if (segs.length === 2) return r;
  r.model = findModel(r.brand, segs[2]);
  if (!r.model) return { type: r.type, brand: r.brand, notFound: { at: 'model', parent: brandUrl } };
  const modelUrl = `${brandUrl}/${r.model.slug}`;
  let i = 3;
  if (segs[i] && segs[i] !== 'solutions') {
    r.size = findSize(r.model, segs[i]);
    if (!r.size) return { type: r.type, brand: r.brand, model: r.model, notFound: { at: 'size', parent: modelUrl } };
    i++;
  }
  if (segs[i] === 'solutions') {
    r.solutionsPath = true;
    if (segs[i + 1]) r.solutionId = decodeURIComponent(segs[i + 1]);
  } else if (segs[i]) {
    return { type: r.type, brand: r.brand, model: r.model, notFound: { at: 'page', parent: modelUrl } };
  }
  return r;
}

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  Moderate: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Advanced: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  Expert: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

const card = 'bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs';

export default function DeviceDirectoryView({
  onSourcePart,
  onOpenAuth,
  basePath = '/devices',
}: {
  savedGuideIds?: string[];
  onToggleSaveGuide?: (guide: any) => void;
  onSourcePart?: (partNumber: string) => void;
  /** Opens the sign-in modal (used by community video sharing). */
  onOpenAuth?: () => void;
  basePath?: string;
}) {
  const { pathname } = usePathname();
  const base = basePath.replace(/\/+$/, '');
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const segs = rest.split('/').filter(Boolean);
  const r = useMemo(() => resolve(segs, base), [segs.join('/'), base]); // eslint-disable-line react-hooks/exhaustive-deps

  // URLs for every level
  const typeUrl = r.type ? `${base}/${r.type.slug}` : base;
  const brandUrl = r.brand ? `${typeUrl}/${r.brand.slug}` : typeUrl;
  const modelUrl = r.model ? `${brandUrl}/${r.model.slug}` : brandUrl;
  const leafUrl = r.size ? `${modelUrl}/${r.size.slug}` : modelUrl;
  const solutionsUrl = `${leafUrl}/solutions`;

  const atLeaf = !!r.model && !r.notFound && (r.size || r.model.sizes.length === 0 || r.solutionsPath);
  const showSizePicker = !!r.model && !r.notFound && !r.size && r.model.sizes.length > 0 && !r.solutionsPath;

  // ---- Solutions data for the current leaf ----
  const [solutions, setSolutions] = useState<Solution[] | null>(null);
  useEffect(() => {
    if (!atLeaf || !r.type || !r.brand || !r.model) { setSolutions(null); return; }
    let alive = true;
    setSolutions(null);
    loadSolutions({ type: r.type, brand: r.brand, model: r.model, size: r.size }).then((s) => { if (alive) setSolutions(s); });
    return () => { alive = false; };
  }, [atLeaf, r.type, r.brand, r.model, r.size]);
  const activeSolution = r.solutionId && solutions ? solutions.find((s) => s.id === r.solutionId) : undefined;

  // Community videos are keyed by the catalog slugs, so they only show for this exact brand + model (+ size).
  const videoTarget: VideoTarget | null = atLeaf && r.type && r.brand && r.model ? {
    deviceType: r.type.slug,
    brand: r.brand.slug,
    model: r.model.slug,
    size: r.size?.slug,
    deviceLabel: `${r.brand.name} ${r.model.name}${r.size ? ` · ${r.size.name}` : ''}`,
    pagePath: solutionsUrl,
  } : null;

  // ---- Breadcrumbs ----
  const crumbs: { label: string; to: string }[] = [{ label: 'All devices', to: base }];
  if (r.type) crumbs.push({ label: r.type.name, to: typeUrl });
  if (r.brand) crumbs.push({ label: r.brand.name, to: brandUrl });
  if (r.model) crumbs.push({ label: r.model.name, to: modelUrl });
  if (r.size) crumbs.push({ label: r.size.name, to: leafUrl });
  if (r.solutionId) {
    crumbs.push({ label: 'Solutions', to: solutionsUrl });
    crumbs.push({ label: activeSolution?.title || r.solutionId, to: pathname });
  } else if (atLeaf && r.model && (r.size || r.solutionsPath)) {
    if (r.solutionsPath) crumbs.push({ label: 'Solutions', to: solutionsUrl });
  }
  const parentUrl = crumbs.length > 1 ? crumbs[crumbs.length - 2].to : null;

  useEffect(() => {
    const last = crumbs[crumbs.length - 1].label;
    document.title = crumbs.length > 1 ? `${last} · Repair solutions · DIY Electronics` : 'Devices · DIY Electronics';
  }, [crumbs.map((c) => c.label).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ds-page space-y-6">
      {/* Top bar: breadcrumbs + back */}
      <div className={`${card} p-4 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400 min-w-0">
          <RouteLink to={base} className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-blue-600 hover:text-white transition-colors" title="All device types">
            <Home className="w-4 h-4" />
          </RouteLink>
          {crumbs.slice(1).map((c, i) => {
            const last = i === crumbs.length - 2;
            return (
              <React.Fragment key={c.to + i}>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                {last ? (
                  <span aria-current="page" className="font-bold text-blue-600 dark:text-blue-400 truncate max-w-[16rem]">{c.label}</span>
                ) : (
                  <RouteLink to={c.to} className="hover:underline hover:text-stone-900 dark:hover:text-stone-100 truncate max-w-[12rem]">{c.label}</RouteLink>
                )}
              </React.Fragment>
            );
          })}
          {crumbs.length === 1 && <span className="ml-2 font-bold text-stone-900 dark:text-stone-100">Device Directory</span>}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {parentUrl && (
            <button onClick={() => navigate(parentUrl)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {segs.length > 0 && <CopyLinkButton />}
        </div>
      </div>

      {r.notFound ? (
        <NotFound what={r.notFound.at} parent={r.notFound.parent} />
      ) : !r.type ? (
        <RootView base={base} />
      ) : !r.brand ? (
        <BrandsView type={r.type} typeUrl={typeUrl} />
      ) : !r.model ? (
        <ModelsView type={r.type} brand={r.brand} brandUrl={brandUrl} />
      ) : showSizePicker ? (
        <SizesView type={r.type} brand={r.brand} model={r.model} modelUrl={modelUrl} />
      ) : r.solutionId ? (
        solutions === null ? <Loading /> : activeSolution ? (
          <SolutionDetail
            solution={activeSolution} all={solutions} solutionsUrl={solutionsUrl}
            type={r.type} brand={r.brand} model={r.model} size={r.size} onSourcePart={onSourcePart}
          />
        ) : <NotFound what="solution" parent={solutionsUrl} />
      ) : (
        <SolutionsList solutions={solutions} solutionsUrl={solutionsUrl} type={r.type} brand={r.brand} model={r.model} size={r.size} />
      )}

      {atLeaf && r.type && r.brand && r.model && !r.solutionId && (
        <DeviceCommunityPanel
          device={{ key: catalogDeviceKey(r.type.slug, r.brand.slug, r.model.slug), label: `${r.brand.name} ${r.model.name}`, path: modelUrl }}
        />
      )}

      {videoTarget && (!r.solutionId || activeSolution) && (
        <CommunityVideosSection target={videoTarget} solutions={solutions} solution={activeSolution} onOpenAuth={onOpenAuth} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Level views
// ------------------------------------------------------------------

function RootView({ base }: { base: string }) {
  const { search } = usePathname();
  const [q, setQ] = useState(search.get('q') || '');
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);

  // Keep ?q= in the URL so searches are shareable (replace, not push, while typing).
  useEffect(() => {
    const t = setTimeout(() => navigate(q ? `${base}?q=${encodeURIComponent(q)}` : base, { replace: true, keepScroll: true }), 250);
    return () => clearTimeout(t);
  }, [q, base]);

  // Universal device pages (any device researched or added by the community).
  useEffect(() => subscribeDiscoveredDevices(setDiscovered), []);

  const hits = useMemo(() => searchCatalog(q), [q]);
  const discoveredHits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return discovered.filter((d) => matchesQuery(`${d.name || ''} ${d.brand || ''} ${d.model || ''} ${d.deviceType || d.category || ''}`, s)).slice(0, 12);
  }, [q, discovered]);

  const groups = GROUP_ORDER.map((g) => ({ g, types: CATALOG.filter((t) => t.group === g) })).filter((x) => x.types.length);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6 sm:p-8 ds-hero text-white shadow-xl space-y-5">
        <div className="space-y-2 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Repair workbench directory
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">What are we fixing today?</h1>
          <p className="text-sm text-blue-100/80">Pick a device type, then the brand, model and size to get step-by-step fault finding with multimeter checks, parts and safety notes.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Device types', CATALOG_STATS.deviceTypes],
            ['Brands', CATALOG_STATS.uniqueBrands],
            ['Models', CATALOG_STATS.models],
            ['Repair pages', CATALOG_STATS.leaves],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
              <div className="text-xl font-bold">{(n as number).toLocaleString()}</div>
              <div className="text-[11px] uppercase font-bold tracking-wider text-blue-100/70">{label}</div>
            </div>
          ))}
        </div>
        <div className="relative max-w-2xl">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-stone-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any device, brand or model (e.g. Defy fridge, PS5, Sunsynk 5 kW, Galaxy A15)"
            className="w-full pl-11 pr-24 py-3 rounded-2xl text-sm bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-blue-400/40"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-2.5 p-1 rounded-lg text-stone-400 hover:text-stone-700" aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {q.trim().length >= 2 ? (
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-500 flex justify-between">
            <span>Results for “{q}”</span><span>{hits.length} matches</span>
          </div>
          {q.trim().length >= 3 && (
            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500">{hits.length === 0 && discoveredHits.length === 0 ? 'Not in the catalog yet.' : 'Not the exact model?'} Every device and part on Earth can have a page:</span>
              <RouteLink to={`/device/${deviceSlug(q)}?q=${encodeURIComponent(q.trim())}`} className="px-3 py-1.5 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700">Research “{q.trim()}” device page</RouteLink>
              <RouteLink to={`/components/${encodeURIComponent(normalizePartNumber(q))}?q=${encodeURIComponent(q.trim())}`} className="px-3 py-1.5 rounded-lg font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200">Look up as part number</RouteLink>
              <RouteLink to={`/search?q=${encodeURIComponent(q.trim())}`} className="px-3 py-1.5 rounded-lg font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200">Search guides & answers</RouteLink>
            </div>
          )}
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {hits.map((h) => (
              <RouteLink key={h.kind + h.path} to={base + h.path} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                {h.kind === 'type' ? <DeviceTypeIcon type={h.type} className="w-10 h-10" iconClassName="w-5 h-5" />
                  : h.kind === 'brand' ? <BrandLogo name={h.brand!.name} domain={h.brand!.domain} simpleIconSlug={h.brand!.simpleIconSlug} />
                  : <ModelImage query={`${h.brand!.name} ${h.model!.name}`} imageUrl={h.model!.imageUrl} type={h.type} className="w-10 h-10" iconClassName="w-5 h-5" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600 truncate">{h.label}</div>
                  <div className="text-[11px] text-stone-500">{h.kind === 'type' ? 'Device type' : h.kind === 'brand' ? 'Brand' : 'Model'} · {h.sub}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-blue-600" />
              </RouteLink>
            ))}
            {discoveredHits.map((d) => (
              <RouteLink key={d.id} to={`/device/${d.slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                <Globe2 className="w-5 h-5 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600">{d.name || `${d.brand} ${d.model}`}</div>
                  <div className="text-[11px] text-stone-500">Device page · {d.deviceType || d.category}{d.summary ? ` · ${String(d.summary).slice(0, 120)}` : ''}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-blue-600" />
              </RouteLink>
            ))}
          </div>
        </div>
      ) : (
        groups.map(({ g, types }) => (
          <section key={g} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> {g} <span className="text-stone-300 dark:text-stone-600">· {types.length}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {types.map((t) => (
                <RouteLink key={t.key} to={`${base}/${t.slug}`} className={`${card} p-4 flex items-center gap-3 hover:border-blue-500 hover:shadow-md transition-all group`}>
                  <DeviceTypeIcon type={t} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600 leading-tight">{t.name}</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">{t.brands.length} brands · {t.brands.reduce((a, b) => a + b.models.length, 0)} models</div>
                  </div>
                </RouteLink>
              ))}
            </div>
          </section>
        ))
      )}
      {!q && <RequestDevice compact />}
      {!q && <OemHub />}
    </div>
  );
}

function FilterBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400 pointer-events-none" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function LevelHeader({ tier, title, subtitle, icon, children }: { tier: string; title: string; subtitle: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={`${card} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div className="flex items-center gap-4 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{tier}</div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 leading-tight">{title}</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function BrandsView({ type, typeUrl }: { type: CatalogDeviceType; typeUrl: string }) {
  const [f, setF] = useState('');
  const list = type.brands.filter((b) => b.name.toLowerCase().includes(f.toLowerCase()));
  return (
    <div className="space-y-4">
      <LevelHeader tier="Step 2 · Brand / manufacturer" title={type.name} subtitle={`${type.brands.length} brands · choose the manufacturer on the rating label`} icon={<DeviceTypeIcon type={type} className="w-14 h-14" iconClassName="w-7 h-7" />}>
        <FilterBox value={f} onChange={setF} placeholder="Filter brands…" />
      </LevelHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((b) => (
          <RouteLink key={b.slug} to={`${typeUrl}/${b.slug}`} className={`${card} p-4 flex items-center gap-3 hover:border-blue-500 hover:shadow-md transition-all group`}>
            <BrandLogo name={b.name} domain={b.domain} simpleIconSlug={b.simpleIconSlug} className="w-12 h-12" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600 truncate">{b.name}</div>
              <div className="text-[11px] text-stone-500">{b.models.length} model{b.models.length === 1 ? '' : 's'}{b.domain ? ` · ${b.domain}` : ''}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-blue-600" />
          </RouteLink>
        ))}
        {list.length === 0 && <div className="text-sm text-stone-500 p-4">No brand matches “{f}”.</div>}
      </div>
    </div>
  );
}

function ModelsView({ type, brand, brandUrl }: { type: CatalogDeviceType; brand: CatalogBrand; brandUrl: string }) {
  const [f, setF] = useState('');
  const list = brand.models.filter((m) => m.name.toLowerCase().includes(f.toLowerCase()));
  return (
    <div className="space-y-4">
      <LevelHeader tier="Step 3 · Model / series" title={`${brand.name} ${type.name}`} subtitle={`${brand.models.length} models · match the model number on the label or box`}
        icon={<BrandLogo name={brand.name} domain={brand.domain} simpleIconSlug={brand.simpleIconSlug} className="w-14 h-14" />}>
        <FilterBox value={f} onChange={setF} placeholder="Filter models…" />
      </LevelHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((m) => {
          const to = m.sizes.length ? `${brandUrl}/${m.slug}` : `${brandUrl}/${m.slug}/solutions`;
          return (
            <RouteLink key={m.slug} to={to} className={`${card} p-4 flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all group`}>
              <ModelImage query={`${brand.name} ${m.name}`} imageUrl={m.imageUrl} type={type} className="w-16 h-16" iconClassName="w-7 h-7" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600">{m.name}</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {m.sizes.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">{m.sizes.length} sizes</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">Solutions</span>
                  )}
                  {m.legacy?.commonIssues?.[0] && <span className="text-[11px] text-stone-500 truncate max-w-[16rem]">⚠ {m.legacy.commonIssues[0]}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-blue-600" />
            </RouteLink>
          );
        })}
        {list.length === 0 && <div className="text-sm text-stone-500 p-4">No model matches “{f}”.</div>}
      </div>
    </div>
  );
}

function SizesView({ type, brand, model, modelUrl }: { type: CatalogDeviceType; brand: CatalogBrand; model: CatalogModel; modelUrl: string }) {
  return (
    <div className="space-y-4">
      <LevelHeader tier={`Step 4 · ${type.sizeLabel || 'Size'}`} title={`${brand.name} ${model.name}`} subtitle="Choose the size printed on the rating label so the size-specific notes are correct."
        icon={<ModelImage query={`${brand.name} ${model.name}`} imageUrl={model.imageUrl} type={type} className="w-16 h-16" iconClassName="w-7 h-7" />}>
        <RouteLink to={`${modelUrl}/solutions`} className="text-xs font-bold text-blue-600 hover:underline">Skip — show all solutions</RouteLink>
      </LevelHeader>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {model.sizes.map((s) => (
          <RouteLink key={s.slug} to={`${modelUrl}/${s.slug}`} className={`${card} p-5 text-center hover:border-blue-500 hover:shadow-md transition-all group`}>
            <Ruler className="w-5 h-5 mx-auto text-stone-400 group-hover:text-blue-600" />
            <div className="mt-2 text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600">{s.name}</div>
          </RouteLink>
        ))}
      </div>
    </div>
  );
}

function SolutionsList({ solutions, solutionsUrl, type, brand, model, size }: {
  solutions: Solution[] | null; solutionsUrl: string; type: CatalogDeviceType; brand: CatalogBrand; model: CatalogModel; size?: CatalogSize;
}) {
  const [f, setF] = useState('');
  const [diff, setDiff] = useState<string>('All');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const save = async () => {
    setSaved('saving');
    try {
      const uid = auth.currentUser?.uid || 'guest_user';
      await setDoc(doc(db, 'user_saved_devices', `${uid}_${Date.now()}`), {
        userId: uid,
        categoryName: type.name,
        brandName: brand.name,
        modelOrSizeName: size ? `${model.name} (${size.name})` : model.name,
        path: window.location.pathname,
        addedAt: serverTimestamp(),
        solutionTitles: (solutions || []).map((s) => s.title),
      });
      setSaved('done');
      setTimeout(() => setSaved('idle'), 3000);
    } catch (e) {
      console.error('Error saving device to database:', e);
      setSaved('error');
    }
  };

  const list = (solutions || []).filter((s) =>
    (diff === 'All' || s.difficulty === diff) &&
    `${s.title} ${s.symptom} ${s.causes.join(' ')}`.toLowerCase().includes(f.toLowerCase()));

  return (
    <div className="space-y-4">
      <LevelHeader tier="Solutions" title={`${brand.name} ${model.name}${size ? ` · ${size.name}` : ''}`}
        subtitle={solutions ? `${solutions.length} repair & troubleshooting solutions for this ${type.name.toLowerCase()}` : 'Loading solutions…'}
        icon={<ModelImage query={`${brand.name} ${model.name}`} imageUrl={model.imageUrl} type={type} className="w-16 h-16" iconClassName="w-7 h-7" />}>
        <button onClick={save} disabled={saved === 'saving'} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 ${saved === 'done' ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-60`}>
          {saved === 'done' ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {saved === 'done' ? 'Saved to workbench' : saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Retry save' : 'Save to workbench'}
        </button>
      </LevelHeader>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <FilterBox value={f} onChange={setF} placeholder="Filter by symptom (e.g. no power, leaking)…" />
        <div className="flex gap-1.5 flex-wrap">
          {['All', 'Easy', 'Moderate', 'Advanced', 'Expert'].map((d) => (
            <button key={d} onClick={() => setDiff(d)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${diff === d ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}>{d}</button>
          ))}
        </div>
      </div>

      {solutions === null ? <Loading /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((s, i) => (
            <RouteLink key={s.id} to={`${solutionsUrl}/${s.id}`} className={`${card} p-5 hover:border-blue-500 hover:shadow-md transition-all group flex flex-col gap-2`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-stone-400">#{String(i + 1).padStart(2, '0')}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${DIFF_STYLE[s.difficulty]}`}>{s.difficulty}</span>
                <span className="text-[11px] text-stone-500 flex items-center gap-1"><Clock className="w-3 h-3" />~{s.minutes} min</span>
                {s.source === 'model-notes' && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Model notes</span>}
                {s.brandNote && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{brand.name} codes</span>}
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-blue-600">{s.title}</h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">{s.symptom}</p>
              <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-auto">Open fix guide <ChevronRight className="w-3.5 h-3.5" /></div>
            </RouteLink>
          ))}
          {list.length === 0 && <div className="text-sm text-stone-500 p-4">No solution matches that filter.</div>}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={`${card} p-5 space-y-3`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

const METER = /(multimeter|Ω|ohm|\bV\b|V DC|V AC|µF|kΩ|MΩ|continuity|diode)/i;

function SolutionDetail({ solution: s, all, solutionsUrl, type, brand, model, size, onSourcePart }: {
  solution: Solution; all: Solution[]; solutionsUrl: string; type: CatalogDeviceType; brand: CatalogBrand; model: CatalogModel; size?: CatalogSize; onSourcePart?: (p: string) => void;
}) {
  const idx = all.findIndex((x) => x.id === s.id);
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx < all.length - 1 ? all[idx + 1] : undefined;
  return (
    <div className="space-y-4">
      <div className={`${card} p-5 sm:p-6 space-y-3`}>
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${DIFF_STYLE[s.difficulty]}`}>{s.difficulty}</span>
          <span className="text-stone-500 flex items-center gap-1"><Clock className="w-3 h-3" />~{s.minutes} min</span>
          <span className="text-stone-400">Solution {idx + 1} of {all.length}</span>
        </div>
        <div className="flex items-start gap-4">
          <ModelImage query={`${brand.name} ${model.name}`} imageUrl={model.imageUrl} type={type} className="w-16 h-16 hidden sm:block" iconClassName="w-7 h-7" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 leading-tight">{s.title}</h1>
            <p className="text-xs text-stone-500 mt-1">{brand.name} {model.name}{size ? ` · ${size.name}` : ''} · {type.name}</p>
          </div>
        </div>
        <p className="text-sm text-stone-700 dark:text-stone-300"><span className="font-bold">Symptom: </span>{s.symptom}</p>
      </div>

      <div className="rounded-2xl p-4 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed"><span className="font-bold uppercase">Safety: </span>{s.safety}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {s.escalation && s.escalation.length > 0 && (
            <Section icon={<Wrench className="w-4 h-4 text-emerald-600" />} title="Fix it step by step">
              <EscalationSolutions
                stages={s.escalation}
                meterHint={METER}
                askPrompt={askAiPrompt({ device: `${brand.name} ${model.name}${size ? ` (${size.name})` : ''} ${type.name}`, problem: `${s.title}. ${s.symptom}`, tried: s.escalation })}
              />
            </Section>
          )}
          {!s.escalation?.length && s.causes.length > 0 && (
            <Section icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} title="Likely causes">
              <ul className="space-y-1.5">{s.causes.map((c, i) => <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex gap-2"><span className="text-amber-500 font-bold">•</span>{c}</li>)}</ul>
            </Section>
          )}
          {!s.escalation?.length && (<>
          <Section icon={<Gauge className="w-4 h-4 text-blue-600" />} title="Test & diagnose">
            <ol className="space-y-2.5">
              {s.tests.map((t, i) => (
                <li key={i} className="flex gap-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{t}{METER.test(t) && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">Meter</span>}</span>
                </li>
              ))}
            </ol>
          </Section>
          <Section icon={<Wrench className="w-4 h-4 text-emerald-600" />} title="Fix">
            <ol className="space-y-2.5">
              {s.fix.map((t, i) => (
                <li key={i} className="flex gap-3 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">{i + 1}</span><span>{t}</span>
                </li>
              ))}
            </ol>
          </Section>
          </>)}
          {(s.brandNote || s.sizeNote) && (
            <Section icon={<Lightbulb className="w-4 h-4 text-teal-600" />} title={`${brand.name}${size ? ` · ${size.name}` : ''} specifics`}>
              {s.brandNote && <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{s.brandNote}</p>}
              {s.sizeNote && <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed"><span className="font-bold">Size note: </span>{s.sizeNote}</p>}
            </Section>
          )}
        </div>
        <div className="space-y-4">
          {s.parts.length > 0 && (
            <Section icon={<Package className="w-4 h-4 text-violet-600" />} title="Parts">
              <ul className="space-y-1.5">
                {s.parts.map((p) => (
                  <li key={p} className="flex items-center justify-between gap-2 text-xs text-stone-700 dark:text-stone-300">
                    <span>{p}</span>
                    {onSourcePart && <button onClick={() => onSourcePart(`${brand.name} ${model.name} ${p}`)} className="text-[10px] font-bold text-blue-600 hover:underline shrink-0">Find part</button>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <MeterTestLinks text={[s.title, s.symptom, ...s.causes, ...s.tests, ...s.parts].join(' ')} />
          {s.tools.length > 0 && (
            <Section icon={<ListChecks className="w-4 h-4 text-stone-600" />} title="Tools">
              <ul className="space-y-1.5">{s.tools.map((t) => <li key={t} className="text-xs text-stone-700 dark:text-stone-300 flex gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />{t}</li>)}</ul>
            </Section>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {prev ? <RouteLink to={`${solutionsUrl}/${prev.id}`} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline max-w-[45%] truncate"><ChevronLeft className="w-4 h-4 shrink-0" />{prev.title}</RouteLink> : <span />}
        <RouteLink to={solutionsUrl} className="text-xs font-bold text-stone-500 hover:underline">All solutions</RouteLink>
        {next ? <RouteLink to={`${solutionsUrl}/${next.id}`} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline max-w-[45%] truncate justify-end">{next.title}<ChevronRight className="w-4 h-4 shrink-0" /></RouteLink> : <span />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Small pieces
// ------------------------------------------------------------------

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
      }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200"
      title="Copy a shareable link to this page"
    >
      {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />} {copied ? 'Copied' : 'Share'}
    </button>
  );
}

function Loading() {
  return <div className={`${card} p-8 text-center text-sm text-stone-500 animate-pulse`}>Loading repair solutions…</div>;
}

function NotFound({ what, parent }: { what: string; parent: string }) {
  return (
    <div className={`${card} p-8 text-center space-y-3`}>
      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
      <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">We couldn't find that {what}</h2>
      <p className="text-xs text-stone-500">The link may be old or mistyped.</p>
      <RouteLink to={parent} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"><ArrowLeft className="w-4 h-4" /> Go back a level</RouteLink>
    </div>
  );
}

function OemHub() {
  const rows = [
    ['Utsave / Utsav', 'TP.V56.PB801 / T.V53', '12V 3A barrel adapters, universal 3-button keypads', 'Standby lockup / DC barrel contact wear'],
    ['Condere', 'CV338H-U42 / TP.MS338', 'Winbond 25Q64 flash, 6V LED backlight strips', 'Stuck on boot splash logo'],
    ['Harwa / Sonic', 'T.V53.03 / SPHE8202', 'PAM8406 audio amplifiers, SF-HD850 optical pickups', '12V vehicle voltage drop restart / DVD jam'],
    ['Sceptre / Onn.', 'RTD28xx / MT5659', 'Roku/Android Wi-Fi modules, T-Con level shifters', 'Backlight OVP trip / Wi-Fi dropouts'],
    ['Akai / Blaupunkt', 'TP.SK506S / CV9632', 'OB3350CP LED drivers, 1.1V core buck converters', 'Red standby LED blink / dark segment'],
  ];
  return (
    <details className={`${card} p-5 group`}>
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100 flex items-center gap-2">
        <Layers className="w-4 h-4 text-blue-600" /> Universal OEM chassis cross-reference (budget & import brands)
      </summary>
      <p className="text-xs text-stone-500 mt-3">Most imported 24–55" TVs share Shenzhen combo boards and standard 3 V / 6 V backlight strips, so parts are sourced by board code rather than brand.</p>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400 uppercase font-bold"><th className="py-2 px-3">Brand</th><th className="py-2 px-3">OEM chassis / board</th><th className="py-2 px-3">Shared parts</th><th className="py-2 px-3">Common symptom</th></tr></thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-300">
            {rows.map((r) => <tr key={r[0]}><td className="py-2 px-3 font-bold">{r[0]}</td><td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400">{r[1]}</td><td className="py-2 px-3">{r[2]}</td><td className="py-2 px-3 text-stone-500">{r[3]}</td></tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}
