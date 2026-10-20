// Universal search: /search?q=  — devices (catalog + universal pages), components, community guides,
// Answers, repair videos, PCB boards, built-in guides and parts. Anything not found can be researched
// on demand into a permanent device or component page.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, Smartphone, Globe2, Cpu, BookOpen, MessageSquare, Video, CircuitBoard, Sparkles, ChevronRight, Package, Layers } from 'lucide-react';
import { usePathname, navigate, RouteLink } from '../../hooks/usePathname';
import { searchCatalog } from '../../data/catalog';
import { initialGuides, initialParts } from '../../data';
import {
  subscribeDiscoveredDevices, subscribeDiscoveredComponents, subscribePublishedGuides, subscribeQuestions, fetchPublishedVideos,
  matchesQuery, deviceSlug, normalizePartNumber, KIND_LABELS,
  type DiscoveredDevice, type DiscoveredComponent, type HubGuide, type HubQuestion,
} from '../../lib/repairHub';
import { findCommunityBoards, boardPath, searchBoardsApi, type CommunityBoard, type WebResult } from '../../lib/boards';
import { PageShell, card, Chip } from './ui';
import RequestDevice from './RequestDevice';

type Row = { key: string; to: string; icon: ReactNode; title: string; sub: string; external?: boolean };

function Group({ title, icon, rows, more }: { title: string; icon: ReactNode; rows: Row[]; more?: { to: string; label: string } }) {
  if (!rows.length) return null;
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-2">{icon}{title} · {rows.length}</span>
        {more && <RouteLink to={more.to} className="normal-case tracking-normal text-indigo-600 hover:underline">{more.label}</RouteLink>}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.slice(0, 12).map((r) => {
          const inner = (
            <>
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">{r.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 truncate">{r.title}</div>
                <div className="text-[11px] text-slate-500 truncate">{r.sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
            </>
          );
          const cls = 'flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 group';
          return r.external
            ? <a key={r.key} href={r.to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            : <RouteLink key={r.key} to={r.to} className={cls}>{inner}</RouteLink>;
        })}
      </div>
    </section>
  );
}

export default function GlobalSearch({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { search } = usePathname();
  const urlQ = search.get('q') || '';
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => {
    const t = setTimeout(() => { if (q !== urlQ) navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { replace: true, keepScroll: true }); }, 300);
    return () => clearTimeout(t);
  }, [q, urlQ]);
  useEffect(() => { document.title = `${urlQ ? `${urlQ} · ` : ''}Search · DIY Electronics`; }, [urlQ]);

  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [components, setComponents] = useState<DiscoveredComponent[]>([]);
  const [guides, setGuides] = useState<HubGuide[]>([]);
  const [questions, setQuestions] = useState<HubQuestion[]>([]);
  const [videos, setVideos] = useState<{ id: string; title: string; deviceLabel: string; pagePath: string }[]>([]);
  const [boards, setBoards] = useState<CommunityBoard[]>([]);
  useEffect(() => subscribeDiscoveredDevices(setDevices), []);
  useEffect(() => subscribeDiscoveredComponents(setComponents), []);
  useEffect(() => subscribePublishedGuides(setGuides, () => setGuides([])), []);
  useEffect(() => subscribeQuestions(setQuestions, () => setQuestions([])), []);
  useEffect(() => { fetchPublishedVideos().then(setVideos).catch(() => setVideos([])); }, []);

  const term = urlQ.trim();
  const partLike = /\d/.test(term) && term.length >= 2 && term.length <= 64;
  useEffect(() => {
    if (!partLike) { setBoards([]); return; }
    let alive = true;
    findCommunityBoards(term, 8).then((b) => alive && setBoards(b)).catch(() => alive && setBoards([]));
    return () => { alive = false; };
  }, [term, partLike]);

  // Live online results (iFixit + Wikipedia via the server) so a search never comes back empty.
  const [web, setWeb] = useState<WebResult[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  useEffect(() => {
    if (term.length < 2) { setWeb([]); return; }
    let alive = true;
    setWebLoading(true);
    const t = setTimeout(() => {
      searchBoardsApi(term, 'web')
        .then((r) => alive && setWeb(r.web || []))
        .catch(() => alive && setWeb([]))
        .finally(() => alive && setWebLoading(false));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [term]);
  const boardLike = partLike || /\b(board|motherboard|mainboard|logic|pcb)\b/i.test(term);

  const res = useMemo(() => {
    if (term.length < 2) return null;
    const catalog: Row[] = searchCatalog(term, 40).map((h) => ({
      key: `c${h.path}`, to: `/devices${h.path}`, title: h.label, sub: `${h.kind === 'type' ? 'Device type' : h.kind === 'brand' ? 'Brand' : 'Model'} · ${h.sub}`,
      icon: <Smartphone className="w-4 h-4 text-indigo-500" />,
    }));
    const universal: Row[] = devices.filter((d) => matchesQuery(`${d.name} ${d.brand} ${d.model} ${d.deviceType} ${(d.modelNumbers || []).join(' ')}`, term)).map((d) => ({
      key: `d${d.id}`, to: `/device/${d.slug}`, title: d.name, sub: `Device page · ${d.deviceType || 'device'}`, icon: <Globe2 className="w-4 h-4 text-emerald-500" />,
    }));
    const comps: Row[] = components.filter((c) => matchesQuery(`${c.partNumber} ${c.manufacturer} ${c.category} ${(c.equivalents || []).join(' ')}`, term)).map((c) => ({
      key: `p${c.id}`, to: `/components/${encodeURIComponent(c.id)}`, title: c.partNumber, sub: [c.manufacturer, c.category, c.package].filter(Boolean).join(' · ') || 'Component', icon: <Cpu className="w-4 h-4 text-indigo-500" />,
    }));
    const hubGuides: Row[] = guides.filter((g) => matchesQuery(`${g.title} ${g.deviceLabel} ${g.summary} ${g.parts.join(' ')}`, term)).map((g) => ({
      key: `g${g.id}`, to: `/guides/view/${g.id}`, title: g.title, sub: `${KIND_LABELS[g.kind]} · ${g.deviceLabel} · ${g.difficulty}`, icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
    }));
    const seedGuides: Row[] = initialGuides.filter((g) => matchesQuery(`${g.title} ${g.deviceModel} ${g.deviceCategory} ${g.issueType}`, term)).map((g) => ({
      key: `s${g.id}`, to: `/guides?q=${encodeURIComponent(g.title)}`, title: g.title, sub: `Built-in guide · ${g.deviceModel}`, icon: <BookOpen className="w-4 h-4 text-slate-400" />,
    }));
    const qs: Row[] = questions.filter((x) => matchesQuery(`${x.title} ${x.body} ${x.deviceLabel}`, term)).map((x) => ({
      key: `q${x.id}`, to: `/answers/q/${x.id}`, title: x.title, sub: `${x.answerCount} answers${x.acceptedAnswerId ? ' · solved' : ''} · ${x.deviceLabel}`, icon: <MessageSquare className="w-4 h-4 text-indigo-500" />,
    }));
    const vids: Row[] = videos.filter((v) => matchesQuery(`${v.title} ${v.deviceLabel}`, term)).map((v) => ({
      key: `v${v.id}`, to: v.pagePath, title: v.title, sub: `Repair video · ${v.deviceLabel}`, icon: <Video className="w-4 h-4 text-rose-500" />,
    }));
    const parts: Row[] = initialParts.filter((p) => matchesQuery(`${p.partNumber} ${p.name} ${p.category} ${p.typicalDevices.join(' ')}`, term)).map((p) => ({
      key: `sp${p.id}`, to: `/components/${encodeURIComponent(p.partNumber)}`, title: `${p.partNumber} · ${p.name}`, sub: `Spare part · ${p.category}`, icon: <Package className="w-4 h-4 text-amber-500" />,
    }));
    const brd: Row[] = boards.map((b) => ({
      key: `b${b.id}`, to: boardPath(b.number), title: b.displayNumber, sub: `PCB board · ${b.photoCount} photos${b.manufacturer ? ` · ${b.manufacturer}` : ''}`, icon: <CircuitBoard className="w-4 h-4 text-emerald-500" />,
    }));
    const online: Row[] = web.map((w) => ({
      key: `w${w.url}`, to: w.url, external: true, title: w.title, sub: `${w.source} · ${w.kind}${w.snippet ? ` · ${w.snippet}` : ''}`,
      icon: w.image ? <img src={w.image} alt="" loading="lazy" className="w-8 h-8 object-cover" /> : <Globe2 className="w-4 h-4 text-slate-400" />,
    }));
    return { catalog, universal, comps, guides: [...hubGuides, ...seedGuides], qs, vids, parts, brd, online };
  }, [term, devices, components, guides, questions, videos, boards, web]);

  const total = res ? Object.values(res).reduce((a, l) => a + l.length, 0) : 0;
  const slug = deviceSlug(term);
  const pn = normalizePartNumber(term);
  const hasExactDevice = res?.universal.some((r) => r.to === `/device/${slug}`);

  return (
    <PageShell>
      <div className="rounded-3xl p-6 ds-hero text-white shadow-xl space-y-4">
        <h1 className="text-2xl font-bold">Search everything electronic</h1>
        <p className="text-sm text-indigo-100/80">Devices, models, part numbers, PCB boards, guides, teardowns, answers and videos. If it exists, we can build a page for it.</p>
        <div className="relative max-w-3xl">
          <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Galaxy A15 charging port, LG F4J6 washer, IRF540N, 820-02016, Omron M3"
            className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-cobalt-500/30" />
        </div>
      </div>

      {!res ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/devices', icon: <Layers className="w-5 h-5 text-indigo-500" />, t: 'All devices', d: 'Browse every category' },
            { to: '/components', icon: <Cpu className="w-5 h-5 text-indigo-500" />, t: 'Components', d: 'Any part number' },
            { to: '/answers', icon: <MessageSquare className="w-5 h-5 text-indigo-500" />, t: 'Answers', d: 'Ask the community' },
            { to: '/teardowns', icon: <Sparkles className="w-5 h-5 text-indigo-500" />, t: 'Teardowns', d: 'See inside devices' },
          ].map((x) => (
            <RouteLink key={x.to} to={x.to} className={`${card} p-4 flex items-center gap-3 hover:border-indigo-500`}>{x.icon}<div><div className="text-sm font-bold">{x.t}</div><div className="text-[11px] text-slate-500">{x.d}</div></div></RouteLink>
          ))}
        </div>
      ) : (
        <>
          <div className={`${card} p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between`}>
            <div className="text-sm text-slate-600 dark:text-slate-300"><b>{total}</b> results for “{term}”. {total === 0 ? 'Nothing saved yet, but we can research it now:' : 'Not what you need? Research it directly:'}</div>
            <div className="flex flex-wrap gap-2">
              {!hasExactDevice && <RouteLink to={`/device/${slug}?q=${encodeURIComponent(term)}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"><Globe2 className="w-3.5 h-3.5" /> Device page for “{term}”</RouteLink>}
              {pn.length >= 2 && <RouteLink to={`/components/${encodeURIComponent(pn)}?q=${encodeURIComponent(term)}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"><Cpu className="w-3.5 h-3.5" /> Component “{pn}”</RouteLink>}
              {boardLike && <RouteLink to={boardPath(term)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"><CircuitBoard className="w-3.5 h-3.5" /> PCB board “{pn}”</RouteLink>}
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Group title="Devices (catalog)" icon={<Smartphone className="w-4 h-4" />} rows={res.catalog} more={{ to: `/devices?q=${encodeURIComponent(term)}`, label: 'Open in directory' }} />
            <Group title="Device pages" icon={<Globe2 className="w-4 h-4" />} rows={res.universal} />
            <Group title="Components" icon={<Cpu className="w-4 h-4" />} rows={res.comps} more={{ to: '/components', label: 'All components' }} />
            <Group title="Guides & teardowns" icon={<BookOpen className="w-4 h-4" />} rows={res.guides} more={{ to: '/guides', label: 'All guides' }} />
            <Group title="Answers" icon={<MessageSquare className="w-4 h-4" />} rows={res.qs} more={{ to: '/answers', label: 'All questions' }} />
            <Group title="Repair videos" icon={<Video className="w-4 h-4" />} rows={res.vids} />
            <Group title="PCB boards" icon={<CircuitBoard className="w-4 h-4" />} rows={res.brd} />
            <Group title="Spare parts" icon={<Package className="w-4 h-4" />} rows={res.parts} />
            <Group title="Online results" icon={<Globe2 className="w-4 h-4" />} rows={res.online} more={boardLike ? { to: boardPath(term), label: 'Full board page' } : undefined} />
          </div>
          {webLoading && !web.length && <p className="text-xs text-slate-500">Searching online…</p>}
          {total === 0 && !webLoading && <RequestDevice initialName={term} onOpenAuth={onOpenAuth} compact />}
          <p className="text-[11px] text-slate-500 flex items-center gap-1"><Chip>Tip</Chip> Model numbers from the rating label (e.g. SM-A156B, UA55AU7000) give the most accurate device pages.</p>
        </>
      )}
    </PageShell>
  );
}
