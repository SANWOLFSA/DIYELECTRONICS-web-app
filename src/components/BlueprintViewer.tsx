import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Flame,
  Globe2,
  Image as ImageIcon,
  Link2,
  Loader2,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { usePathname, navigate, RouteLink } from '../hooks/usePathname';
import { useAdminStatus, useAuthUser } from '../lib/admin';
import { isFirebaseConfigured } from '../lib/firebase';
import { defaultUser } from '../lib/storage';
import type { ThemeConfig } from '../lib/theme';
import type { UserProfile } from '../types';
import {
  EXAMPLE_NUMBERS,
  FEATURED_BOARDS,
  addRecentBoardSearch,
  boardPath,
  clearRecentBoardSearches,
  deleteBoardFile,
  deleteBoardPhoto,
  findCommunityBoards,
  friendlyBoardError,
  getCommunityBoard,
  getRecentBoardSearches,
  listBoardFiles,
  listBoardPhotos,
  normalizeBoardNumber,
  popularCommunityBoards,
  searchBoardsApi,
  type BoardInfo,
  type BoardSearchResponse,
  type CommunityBoard,
  type CommunityFile,
  type CommunityPhoto,
} from '../lib/boards';
import PhotoLightbox, { type LightboxItem } from './boards/PhotoLightbox';
import UploadBoardDialog from './boards/UploadBoardDialog';

const card = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs';
const primaryBtn = 'bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white';
const chip = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors';

/** Real PCB board search. Routes: /blueprint-viewer and /blueprint-viewer/board/<NUMBER> (also under /3d-viewer, /social-annotator). */
export default function BlueprintViewer({
  currentUser = defaultUser,
  onOpenAuth,
}: {
  themeConfig?: ThemeConfig;
  currentUser?: UserProfile;
  initialView?: 'boardview' | 'annotator';
  onOpenAuth?: () => void;
}) {
  const { pathname } = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const base = `/${parts[0] || 'blueprint-viewer'}`;
  const boardParam = parts[1] === 'board' && parts[2] ? decodeURIComponent(parts.slice(2).join('/')) : '';

  return boardParam ? (
    <BoardResultPage key={boardParam} display={boardParam} base={base} currentUser={currentUser} onOpenAuth={onOpenAuth} />
  ) : (
    <BoardSearchHome base={base} />
  );
}

function SearchBox({ initial = '', autoFocus = false, compact = false }: { initial?: string; autoFocus?: boolean; compact?: boolean }) {
  const [q, setQ] = useState(initial);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.replace(/\s+/g, ' ').trim();
    if (normalizeBoardNumber(v).length < 2) return;
    navigate(boardPathFor(v));
  };
  return (
    <form onSubmit={submit} role="search" className="flex items-stretch gap-2 w-full">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          aria-label="Board or part number"
          placeholder="Board / part number, e.g. 820-02016, BN41-02568A, MS-7B79"
          className={`w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3 ${compact ? 'py-2.5' : 'py-3.5'} text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
        />
      </div>
      <button type="submit" className={`${primaryBtn} rounded-2xl px-4 sm:px-5 text-sm font-bold flex items-center gap-1.5 shadow-sm`}>
        <Search className="w-4 h-4" /><span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );
}

/** Keeps the readable form in the URL (spaces become '-'), the page re-normalizes it. */
function boardPathFor(display: string) {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const base = parts[0] && parts[0] !== 'board' ? `/${parts[0]}` : '/blueprint-viewer';
  return base === '/blueprint-viewer' ? boardPath(display) : `${base}/board/${encodeURIComponent(normalizeBoardNumber(display))}`;
}

// ---------------------------------------------------------------------------
// Home: search, featured, recent, popular community boards
// ---------------------------------------------------------------------------

function BoardSearchHome({ base }: { base: string }) {
  const [recent, setRecent] = useState<string[]>(() => getRecentBoardSearches());
  const [popular, setPopular] = useState<CommunityBoard[]>([]);
  const [popularState, setPopularState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let live = true;
    popularCommunityBoards(8)
      .then((b) => { if (live) { setPopular(b); setPopularState('ok'); } })
      .catch(() => { if (live) setPopularState('error'); });
    return () => { live = false; };
  }, []);

  const to = (q: string) => `${base}/board/${encodeURIComponent(normalizeBoardNumber(q))}`;

  return (
    <div className="flex flex-col gap-5 w-full">
      <section className={`${card} p-5 sm:p-7 relative overflow-hidden`}>
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <Camera className="w-3.5 h-3.5" /> Real board photos
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Find any PCB by its board number</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Type the number printed on the board. You get real photos (Wikimedia Commons and the community), cited info on ICs and common faults, and links to schematic and boardview searches. If nobody has shared your board yet, upload the first photo.
          </p>
          <SearchBox autoFocus />
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Try</span>
            {EXAMPLE_NUMBERS.map((n) => (
              <RouteLink key={n} to={to(n)} className={`${chip} font-mono border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300`}>{n}</RouteLink>
            ))}
          </div>
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-500" /> Featured boards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {FEATURED_BOARDS.map((f) => (
            <RouteLink key={f.query} to={to(f.query)} className="group rounded-2xl border border-slate-200 dark:border-slate-800 p-3 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><Cpu className="w-4 h-4" /><span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{f.label}</span></div>
              <p className="text-[11px] text-slate-500 mt-1">{f.hint}</p>
            </RouteLink>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Your recent searches</h2>
            {recent.length > 0 && <button onClick={() => { clearRecentBoardSearches(); setRecent([]); }} className="text-[11px] font-semibold text-slate-500 hover:text-rose-500">Clear</button>}
          </div>
          {recent.length ? (
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <RouteLink key={r} to={to(r)} className={`${chip} border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400`}>{r}</RouteLink>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">Searches you make on this device show up here.</p>}
        </section>

        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Flame className="w-4 h-4 text-emerald-500" /> Popular community boards</h2>
          {popularState === 'loading' && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>}
          {popularState === 'error' && <p className="text-xs text-slate-500">Community boards are unavailable right now.</p>}
          {popularState === 'ok' && (popular.length ? (
            <div className="grid grid-cols-2 gap-2">
              {popular.map((b) => <CommunityBoardTile key={b.id} b={b} to={to(b.number)} />)}
            </div>
          ) : <p className="text-xs text-slate-500">No community photos yet. Search your board number and be the first to upload one.</p>)}
        </section>
      </div>

      <PcbNumberGuide />
    </div>
  );
}

function CommunityBoardTile({ b, to }: { b: CommunityBoard; to: string }) {
  return (
    <RouteLink to={to} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition-colors block">
      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
        {b.coverUrl ? <img src={b.coverUrl} alt={`Board ${b.displayNumber}`} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="w-6 h-6" /></div>}
      </div>
      <div className="p-2">
        <p className="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">{b.displayNumber}</p>
        <p className="text-[10px] text-slate-500 truncate">{[b.manufacturer, b.devices[0]].filter(Boolean).join(' · ') || 'Community board'} · {b.photoCount} photo{b.photoCount === 1 ? '' : 's'}</p>
      </div>
    </RouteLink>
  );
}

/** "RASPBERRY-PI-4" -> "RASPBERRY PI 4"; part numbers like "BN41-02568A" or "HAC-CPU-01" stay as they are. */
function boardSearchText(raw: string): string {
  const t = raw.trim();
  if (/\s/.test(t)) return t;
  const segs = t.split('-');
  return segs.length > 1 && segs.some((x) => /^[A-Za-z]{4,}$/.test(x)) ? segs.join(' ') : t;
}

// ---------------------------------------------------------------------------
// Result page for one board number
// ---------------------------------------------------------------------------

type Side = 'all' | 'top' | 'bottom';

function BoardResultPage({ display, base, currentUser, onOpenAuth }: { display: string; base: string; currentUser: UserProfile; onOpenAuth?: () => void }) {
  const n = normalizeBoardNumber(display);
  const authUser = useAuthUser();
  const { isAdmin } = useAdminStatus();

  const [photosResp, setPhotosResp] = useState<BoardSearchResponse | null>(null);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosErr, setPhotosErr] = useState<string | null>(null);
  const [info, setInfo] = useState<BoardInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoErr, setInfoErr] = useState<string | null>(null);

  const [board, setBoard] = useState<CommunityBoard | null>(null);
  const [community, setCommunity] = useState<CommunityPhoto[]>([]);
  const [files, setFiles] = useState<CommunityFile[]>([]);
  const [related, setRelated] = useState<CommunityBoard[]>([]);
  const [communityErr, setCommunityErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [side, setSide] = useState<Side>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // URL segments are normalized ("IPHONE-X-LOGIC-BOARD"); turn word-style queries back into words for search.
  const searchText = boardSearchText(display);
  const titleNumber = board?.displayNumber || searchText;

  useEffect(() => { addRecentBoardSearch(board?.displayNumber || searchText); }, [searchText, board?.displayNumber]);

  // Commons photos + links (fast), then cited info (slower, AI + Google Search).
  useEffect(() => {
    let live = true;
    const q = searchText;
    setPhotosLoading(true); setInfoLoading(true); setPhotosErr(null); setInfoErr(null); setInfo(null);
    searchBoardsApi(q, 'photos,links,web')
      .then((r) => { if (live) { setPhotosResp(r); setPhotosErr(r.photosError || null); } })
      .catch((e) => { if (live) setPhotosErr(e.message); })
      .finally(() => { if (live) setPhotosLoading(false); });
    searchBoardsApi(q, 'info')
      .then((r) => { if (live) { setInfo(r.info || null); setInfoErr(r.infoError || null); } })
      .catch((e) => { if (live) setInfoErr(e.message); })
      .finally(() => { if (live) setInfoLoading(false); });
    return () => { live = false; };
  }, [searchText]);

  useEffect(() => {
    let live = true;
    if (!isFirebaseConfigured) { setCommunityErr('Community uploads are not configured on this build.'); return; }
    Promise.all([getCommunityBoard(n), listBoardPhotos(n), listBoardFiles(n), findCommunityBoards(n, 13)])
      .then(([b, p, f, rel]) => {
        if (!live) return;
        setBoard(b); setCommunity(p); setFiles(f); setRelated(rel.filter((r) => r.id !== n).slice(0, 12)); setCommunityErr(null);
      })
      .catch((e) => { if (live) setCommunityErr(friendlyBoardError(e)); });
    return () => { live = false; };
  }, [n, reload]);

  const commonsPhotos = photosResp?.photos || [];
  const links = photosResp?.links || [];
  const webResults = photosResp?.web || [];

  const lightboxItems: LightboxItem[] = useMemo(() => {
    const comm = community
      .filter((p) => side === 'all' || p.side === side)
      .map((p) => ({ src: p.url, alt: `${titleNumber} ${p.side === 'other' ? 'detail' : p.side + ' side'} · community photo`, caption: <>{p.caption || p.title || 'Community photo'} · uploaded by {p.ownerName}</>, sourceUrl: p.url }));
    const wiki = side === 'all' ? commonsPhotos.map((p) => ({ src: p.url, alt: p.title, caption: <>{p.title} · {p.artist} · {p.license} · Wikimedia Commons</>, sourceUrl: p.pageUrl })) : [];
    return [...comm, ...wiki];
  }, [community, commonsPhotos, side, titleNumber]);

  const filteredCommunity = community.filter((p) => side === 'all' || p.side === side);
  const counts = { top: community.filter((p) => p.side === 'top').length, bottom: community.filter((p) => p.side === 'bottom').length };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Board ${titleNumber}`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };

  const openUpload = () => {
    if (!authUser) { onOpenAuth?.(); setToast('Sign in to upload photos of this board.'); return; }
    setShowUpload(true);
  };

  const removePhoto = async (p: CommunityPhoto) => {
    if (!window.confirm('Delete this photo?')) return;
    try { await deleteBoardPhoto(n, p); setReload((x) => x + 1); } catch (e) { setToast(friendlyBoardError(e)); }
  };
  const removeFile = async (f: CommunityFile) => {
    if (!window.confirm(`Delete ${f.fileName}?`)) return;
    try { await deleteBoardFile(n, f); setReload((x) => x + 1); } catch (e) { setToast(friendlyBoardError(e)); }
  };

  const noPhotos = !photosLoading && commonsPhotos.length === 0 && community.length === 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2">
        <RouteLink to={base} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" aria-label="Back to board search"><ArrowLeft className="w-4 h-4" /></RouteLink>
        <div className="flex-1"><SearchBox initial={board?.displayNumber || searchText} compact /></div>
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">Board number</span>
              {info?.boardType && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">{info.boardType}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white break-all">{titleNumber}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {[info?.manufacturer || board?.manufacturer, (info?.devices?.length ? info.devices : board?.devices || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ') || 'Real photos, cited info and schematic searches for this board.'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={share} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> {copied ? 'Link copied' : 'Share'}
            </button>
            <button onClick={openUpload} className={`${primaryBtn} px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5`}>
              <Camera className="w-3.5 h-3.5" /> Upload a photo of this board
            </button>
          </div>
        </div>
      </section>

      {toast && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2" role="status">
          <span>{toast}</span><button aria-label="Dismiss" onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Photo gallery */}
      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Real photos</h2>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl" role="tablist" aria-label="Board side">
            {(['all', 'top', 'bottom'] as Side[]).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`px-3 py-1 rounded-lg text-xs font-bold capitalize ${side === s ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
                {s === 'all' ? 'All' : `${s}${counts[s] ? ` (${counts[s]})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {/* Community photos */}
        {filteredCommunity.length > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> From the community</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {filteredCommunity.map((p, i) => {
                const canDelete = !!authUser && (authUser.uid === p.ownerUid || isAdmin);
                return (
                  <figure key={p.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                    <button className="block w-full aspect-[4/3]" onClick={() => setLightbox(i)} aria-label={`Open photo ${i + 1}`}>
                      <img src={p.url} alt={`${titleNumber} ${p.side} side`} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                    <figcaption className="p-2 text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900">
                      <span className="font-bold capitalize text-slate-800 dark:text-slate-200">{p.side === 'other' ? 'Detail' : `${p.side} side`}</span>
                      {p.caption ? ` · ${p.caption}` : ''}<br />by {p.ownerName}
                    </figcaption>
                    {canDelete && (
                      <button onClick={() => removePhoto(p)} aria-label="Delete photo" className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </figure>
                );
              })}
            </div>
          </>
        )}

        {/* Wikimedia Commons photos */}
        {side === 'all' && (
          photosLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
            </div>
          ) : commonsPhotos.length > 0 ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">From Wikimedia Commons</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {commonsPhotos.map((p, i) => (
                  <figure key={p.pageUrl} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                    <button className="block w-full aspect-[4/3]" onClick={() => setLightbox(filteredCommunity.length + i)} aria-label={`Open ${p.title}`}>
                      <img src={p.thumbUrl} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                    <figcaption className="p-2 text-[10px] leading-snug text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900">
                      <a href={p.pageUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 line-clamp-1">{p.title}</a>
                      <span className="line-clamp-1">{p.artist}</span>
                      {p.licenseUrl ? <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{p.license}</a> : <span>{p.license}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          ) : null
        )}

        {photosErr && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{photosErr}</p>}

        {(noPhotos || (side !== 'all' && filteredCommunity.length === 0)) && (
          <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900 p-6 text-center">
            <Camera className="w-7 h-7 mx-auto text-indigo-400 mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">{side === 'all' ? 'No openly licensed photos of this board yet' : `No ${side}-side photos yet`}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Got this board on your bench? Upload a clear photo with the number visible. Check the image search below for photos elsewhere on the web.</p>
            <button onClick={openUpload} className={`${primaryBtn} mt-3 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5`}><Camera className="w-3.5 h-3.5" /> Upload a photo of this board</button>
          </div>
        )}
      </section>


      {/* Online results (iFixit guides, part wikis, Q&A + Wikipedia), always available without AI */}
      <section className={`${card} p-5`}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1"><Search className="w-4 h-4 text-indigo-500" /> Online results</h2>
        <p className="text-[11px] text-slate-500 mb-3">Repair guides, board listings and Q&amp;A threads found on the web for this search.</p>
        {photosLoading ? (
          <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching online…</p>
        ) : webResults.length ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {webResults.map((w) => (
              <li key={w.url}>
                <a href={w.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 h-full">
                  {w.image ? <img src={w.image} alt="" loading="lazy" className="w-16 h-12 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-800" /> : <span className="w-16 h-12 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Globe2 className="w-4 h-4 text-slate-400" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white line-clamp-2">{w.title}</span>
                    <span className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{w.source} · {w.kind}</span>
                    {w.snippet && <span className="block text-[11px] text-slate-500 line-clamp-2">{w.snippet}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No direct matches online yet. Try the schematic and image searches below, or a shorter number.</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3"><InfoCard info={info} loading={infoLoading} error={infoErr} /></div>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1"><Link2 className="w-4 h-4 text-emerald-500" /> Find schematics & boardviews</h2>
            <p className="text-[11px] text-slate-500 mb-3">Searches on repair sites for this exact number. Results are not checked by us.</p>
            <ul className="space-y-1">
              {(links.length ? links : []).map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300">
                    <span>{l.label}</span><ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </a>
                </li>
              ))}
              {!links.length && photosLoading && <li className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</li>}
            </ul>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-violet-500" /> Community files</h2>
            {files.length ? (
              <ul className="space-y-2">
                {files.map((f) => {
                  const canDelete = !!authUser && (authUser.uid === f.ownerUid || isAdmin);
                  return (
                    <li key={f.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{f.title || f.fileName}</p>
                        <p className="text-[10px] text-slate-500 truncate capitalize">{f.fileKind} · {(f.size / 1048576).toFixed(1)} MB · by {f.ownerName}</p>
                      </a>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label="Download" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><Download className="w-4 h-4" /></a>
                      {canDelete && <button onClick={() => removeFile(f)} aria-label="Delete file" className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"><Trash2 className="w-4 h-4" /></button>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-xs text-slate-500">No schematic or boardview files shared for this board yet.</p>}
            {communityErr && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{communityErr}</p>}
          </section>

          {related.length > 0 && (
            <section className={`${card} p-5`}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-indigo-500" /> Similar board numbers</h2>
              <div className="grid grid-cols-2 gap-2">
                {related.map((b) => <CommunityBoardTile key={b.id} b={b} to={`${base}/board/${encodeURIComponent(b.number)}`} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {lightbox !== null && lightboxItems.length > 0 && (
        <PhotoLightbox items={lightboxItems} index={Math.min(lightbox, lightboxItems.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}

      {showUpload && authUser && (
        <UploadBoardDialog
          initialNumber={board?.displayNumber || display}
          uid={authUser.uid}
          ownerName={authUser.displayName || currentUser?.name || 'Technician'}
          defaultSide={side === 'bottom' ? 'bottom' : 'top'}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); setReload((x) => x + 1); setToast('Thanks! Your upload is live.'); }}
        />
      )}
    </div>
  );
}

function InfoCard({ info, loading, error }: { info: BoardInfo | null; loading: boolean; error: string | null }) {
  return (
    <section className={`${card} p-5 h-full`}>
      <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-violet-500" /> Board info <span className="text-[10px] font-semibold text-slate-400">with sources</span></h2>
      {loading ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching the web for this board…</p>
          {[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${90 - i * 18}%` }} />)}
        </div>
      ) : !info ? (
        <p className="text-xs text-slate-500 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> {error || 'Board info is unavailable right now.'} Photos and search links still work.</p>
      ) : !info.found ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> We could not confirm details for this exact board number from web sources, so nothing is shown rather than a guess. Check the number on the board, or try the schematic searches.</p>
          <Sources sources={info.sources} />
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
            <dt className="font-bold text-slate-500">Number</dt><dd className="font-mono font-semibold text-slate-900 dark:text-white">{info.boardNumber}</dd>
            {info.manufacturer && <><dt className="font-bold text-slate-500">Maker</dt><dd className="text-slate-900 dark:text-white">{info.manufacturer}</dd></>}
            {info.boardType && <><dt className="font-bold text-slate-500">Type</dt><dd className="text-slate-900 dark:text-white">{info.boardType}</dd></>}
          </dl>
          {info.devices.length > 0 && <InfoList title="Used in" icon={<Cpu className="w-3.5 h-3.5 text-indigo-500" />} items={info.devices} />}
          {info.keyICs.length > 0 && (
            <div>
              <p className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-500" /> Key ICs</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {info.keyICs.map((ic, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{ic.role}</p>
                    <p className="font-mono text-slate-900 dark:text-white break-words">{ic.part}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {info.commonFaults.length > 0 && <InfoList title="Common faults" icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />} items={info.commonFaults} />}
          {info.notes.length > 0 && <InfoList title="Notes" icon={<BookOpen className="w-3.5 h-3.5 text-violet-500" />} items={info.notes} />}
          <Sources sources={info.sources} />
          <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" /> {info.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

function InfoList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div>
      <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">{icon} {title}</p>
      <ul className="list-disc pl-5 space-y-0.5 text-slate-700 dark:text-slate-300">{items.map((d, i) => <li key={i}>{d}</li>)}</ul>
    </div>
  );
}

function Sources({ sources }: { sources: { title: string; url: string }[] }) {
  if (!sources.length) return null;
  return (
    <div>
      <p className="font-bold text-slate-900 dark:text-white mb-1 text-xs">Sources</p>
      <ol className="list-decimal pl-5 space-y-0.5 text-[11px]">
        {sources.map((s) => (
          <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline break-all">{s.title}</a></li>
        ))}
      </ol>
    </div>
  );
}

function PcbNumberGuide() {
  const rows: [string, string, string][] = [
    ['Apple MacBook', '820-xxxxx printed in white on the logic board', '820-02016'],
    ['Apple iPhone', 'Model number on the back (A1865); board marking near the SoC shield', 'A1901'],
    ['Samsung TV', 'Main board BN41-xxxxx, sticker BN94-xxxxx, power BN44-xxxxx', 'BN41-02568A'],
    ['LG TV', 'Main board EAX…, assembly EBU…', 'EAX67133404'],
    ['TPV / Philips / AOC', 'Power/main board 715Gxxxx', '715G8709'],
    ['MSI / desktop', 'MS-xxxx near the PCIe slots', 'MS-7B79'],
    ['Laptop ODM (Compal)', 'LA-xxxxP on the motherboard edge', 'LA-H371P'],
  ];
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-amber-500" /> Where to find the board number</h2>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(([who, where, ex]) => (
          <div key={who} className="py-2 grid grid-cols-1 sm:grid-cols-[160px,1fr,auto] gap-1 sm:gap-3 text-xs items-center">
            <span className="font-bold text-slate-900 dark:text-white">{who}</span>
            <span className="text-slate-600 dark:text-slate-400">{where}</span>
            <RouteLink to={boardPath(ex)} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline">{ex}</RouteLink>
          </div>
        ))}
      </div>
    </section>
  );
}
