import { ReportButton, CommunityReviews } from './ReportButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ImagePlus,
  LocateFixed,
  MapPin,
  Store,
  Truck,
  Wrench,
  Sparkles,
  Inbox,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Upload,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import type { ThemeConfig } from '../lib/theme';
import { useAuthUser } from '../lib/admin';
import { isFirebaseConfigured } from '../lib/firebase';
import { consumeListingFocus, useMarketplaceState, PLACEHOLDER_IMAGE, type ListingItem } from '../lib/marketplaceListings';
import { usePathname } from '../hooks/usePathname';
import {
  COUNTRIES, CURRENCIES, PHONE_HELP, REGISTRATION_HINT, countryName, currencyForCountry, currentPosition, formatKm, geocodeAddress, guessCountry, hasCoords,
  haversineKm, listingMatchesQuery, osmEmbedUrl, rankNearest, setUserArea, shipsToCountry, splitList, toE164, useShopProfiles, useUserLocation, type ListingGroup,
} from '../lib/partsFinder';
import { ShopActions, UseMyLocationButton, VerifiedShopBadge } from './PartsFinderPanels';
import { OrderModal, OrdersSection } from './MarketplaceOrders';
import {
  EMPTY_BANK, PAY_LABELS, PAY_SHORT, bankDetailsComplete, getBankDetails, normalisePaypalMe, saveBankDetails, shopPayMethods, useOrderShops,
  type BankDetails, type PayMethod,
} from '../lib/orders';
import {
  ALL_CATEGORIES,
  BUSINESS_CATEGORIES,
  CONDITIONS,
  REQUIRED_DOC_KEYS,
  STATUS_LABELS,
  VERIFICATION_DOC_TYPES,
  cancelRequest,
  createListing,
  createPurchaseRequest,
  createReview,
  deleteListing,
  formatTs,
  formatZar,
  friendlyError,
  getSellerDocUrl,
  missingRequiredDocs,
  respondToRequest,
  saveSellerProfile,
  saveVerification,
  setListingStock,
  submitShopVerification,
  BUSINESS_PLAN_PRICE,
  PLAN_LABELS,
  shopPlan,
  syncListingLocations,
  uploadShopImage,
  subscribeMyListings,
  subscribeMyVerification,
  subscribeRequests,
  subscribeReviews,
  subscribeSellerProfile,
  updateListingContent,
  uploadListingImage,
  uploadSellerDoc,
  useVerifiedSellers,
  type ListingDoc,
  type ListingInput,
  type PurchaseRequest,
  type PurchaseStatus,
  type Review,
  type SellerProfile,
  type SellerType,
  type StockType,
  type SellerVerification,
  type StoredDoc,
  type VerificationFields,
  type VerificationStatus,
} from '../lib/marketplace';

type Tab = 'browse' | 'sell' | 'requests';

// ---------------------------------------------------------------------------
// Shared styling (Circuit Mint defaults, overridable by the active theme)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60';
const labelCls = 'block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1';
const cardCls = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none';
const ghostBtn =
  'px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors disabled:opacity-50';

function usePrimary(themeConfig?: ThemeConfig) {
  const bg = themeConfig?.primaryBg || 'bg-gradient-to-r from-indigo-600 to-violet-500';
  const hover = themeConfig?.primaryHover || 'hover:from-indigo-500 hover:to-violet-400';
  const text = themeConfig?.primaryText || 'text-white';
  return `${bg} ${hover} ${text} px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5`;
}

const STATUS_STYLE: Record<VerificationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  under_review: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

const REQUEST_STYLE: Record<PurchaseStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  accepted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
};

function displayNameOf(user: { displayName: string | null; email: string | null } | null) {
  if (!user) return '';
  return (user.displayName || (user.email ? user.email.split('@')[0] : '') || 'Member').slice(0, 80);
}

function SellerBadge({ verified, type }: { verified: boolean; type: SellerType }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold" title="Company documents checked and approved by DIY Electronics">
        <BadgeCheck className="w-3 h-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
      {type === 'company' ? 'Unverified company' : 'Unverified individual'}
    </span>
  );
}

function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
      ))}
    </span>
  );
}

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: any; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className={`${cardCls} py-14 px-6 text-center space-y-3`}>
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-emerald-100 dark:from-indigo-950/60 dark:to-emerald-950/40 flex items-center justify-center">
        <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{body}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Marketplace({
  initialSearchQuery = '',
  themeConfig,
  onOpenAuth,
}: {
  /** Kept for backward compatibility with older App.tsx call sites. */
  parts?: any[];
  initialSearchQuery?: string;
  onRequestVerification?: (req: any) => void;
  onSelectPartDetail?: (pn: string) => void;
  themeConfig?: ThemeConfig;
  onOpenAuth?: () => void;
}) {
  const primary = usePrimary(themeConfig);
  const user = useAuthUser();
  const { listings, loaded, configured, error: listingsError } = useMarketplaceState();
  const verifiedSellers = useVerifiedSellers();
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => subscribeReviews(setReviews), []);

  const { search: urlParams } = usePathname();
  const [tab, setTab] = useState<Tab>(() => (urlParams.get('tab') === 'sell' || urlParams.get('shop') === '1' ? 'sell' : ['requests', 'orders'].includes(urlParams.get('tab') || '') ? 'requests' : 'browse'));
  const [shopSignup, setShopSignup] = useState(() => urlParams.get('shop') === '1');
  const [search, setSearch] = useState(initialSearchQuery);
  const [category, setCategory] = useState(() => urlParams.get('cat') || 'All');
  // Spare-parts finder filters (also set by deep links: ?group=tools&cond=used&verified=1&near=1)
  const [group, setGroup] = useState<'all' | ListingGroup>(() => (['parts', 'tools'].includes(urlParams.get('group') || '') ? (urlParams.get('group') as ListingGroup) : 'all'));
  const [cond, setCond] = useState<'all' | 'new' | 'used'>(() => (['new', 'used'].includes(urlParams.get('cond') || '') ? (urlParams.get('cond') as 'new' | 'used') : 'all'));
  const [verifiedOnly, setVerifiedOnly] = useState(() => urlParams.get('verified') === '1');
  const [nearest, setNearest] = useState(() => urlParams.get('near') === '1');
  const [shipsToMe, setShipsToMe] = useState(false);
  const userLoc = useUserLocation();
  const paramKey = urlParams.toString();
  useEffect(() => {
    const g = urlParams.get('group');
    if (g === 'parts' || g === 'tools') setGroup(g);
    const c = urlParams.get('cond');
    if (c === 'new' || c === 'used') setCond(c);
    if (urlParams.get('verified') === '1') setVerifiedOnly(true);
    if (urlParams.get('near') === '1') setNearest(true);
    if (urlParams.get('cat')) setCategory(urlParams.get('cat')!);
    if (urlParams.get('shop') === '1') { setShopSignup(true); setTab('sell'); }
    else if (urlParams.get('tab') === 'sell') setTab('sell');
    else if (urlParams.get('tab') === 'orders' || urlParams.get('tab') === 'requests') setTab('requests');
  }, [paramKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const [buyItem, setBuyItem] = useState<ListingItem | null>(null);
  const [orderItem, setOrderItem] = useState<ListingItem | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);

  useEffect(() => setSearch(initialSearchQuery), [initialSearchQuery]);

  // Arriving from a Home story: scroll to and briefly highlight that listing.
  useEffect(() => {
    const id = consumeListingFocus();
    if (!id) return;
    pendingFocus.current = id;
    setTab('browse');
    // The story passes the item title as the search; clear it so the card is
    // guaranteed to be rendered even if the title has odd characters.
    setSearch('');
    setCategory('All');
  }, []);

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id || tab !== 'browse') return;
    if (!listings.some(l => l.id === id)) return;
    pendingFocus.current = null;
    setFocusedId(id);
    const raf = requestAnimationFrame(() => {
      document.getElementById(`listing-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const t = window.setTimeout(() => setFocusedId(null), 3500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [listings, tab]);

  const categories = useMemo(() => {
    const used = new Set(listings.map(l => l.category));
    return ['All', ...ALL_CATEGORIES.filter(c => used.has(c)), ...[...used].filter(c => !ALL_CATEGORIES.includes(c))];
  }, [listings]);

  const matching = listings.filter(item => {
    if (category !== 'All' && item.category !== category) return false;
    if (group !== 'all' && item.group !== group) return false;
    if (cond === 'new' && !item.isNew) return false;
    if (cond === 'used' && item.isNew) return false;
    if (verifiedOnly && !item.seller.isVerifiedCompany) return false;
    // "Available to me": local listings in my country, or suppliers that ship here.
    if (shipsToMe && userLoc.country && item.country && item.country !== userLoc.country && !shipsToCountry(item, userLoc.country)) return false;
    return listingMatchesQuery(item, search);
  });
  // Nearest first: verified shops first, then distance (or your country / area), then price.
  // Otherwise newest first, with verified sellers ahead when searching.
  const ranked: { item: ListingItem; km: number | null }[] = nearest
    ? rankNearest(matching, userLoc)
    : [...matching]
        .sort((a, b) => (search.trim() ? Number(b.seller.isVerifiedCompany) - Number(a.seller.isVerifiedCompany) : 0))
        .map(item => ({ item, km: userLoc.coords && hasCoords(item) ? haversineKm(userLoc.coords, item) : null }));
  const filtered = ranked.map(r => r.item);
  const kmById = new Map(ranked.map(r => [r.item.id, r.km]));
  const shopProfiles = useShopProfiles(filtered.filter(i => i.businessId).slice(0, 60).map(i => i.seller.uid));
  // Shops that take orders in the app (delivery / collect + card, PayPal or bank transfer).
  const orderShops = useOrderShops(filtered.filter(i => i.businessId).slice(0, 60).map(i => i.seller.uid));
  const filtersActive = category !== 'All' || group !== 'all' || cond !== 'all' || verifiedOnly || shipsToMe || !!search.trim();
  const clearFilters = () => { setSearch(''); setCategory('All'); setGroup('all'); setCond('all'); setVerifiedOnly(false); setShipsToMe(false); };
  const openShopSignup = () => { setShopSignup(true); setTab('sell'); };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'browse', label: 'Browse', icon: ShoppingBag },
    { id: 'sell', label: 'Sell', icon: Package },
    { id: 'requests', label: 'Orders', icon: Inbox },
  ];

  return (
    <div className="ds-page space-y-6">
      {/* Hero */}
      <div className={`${cardCls} p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden relative`}>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gradient-to-br from-indigo-400/20 via-violet-400/10 to-emerald-300/20 blur-2xl pointer-events-none" />
        <div className="space-y-2 max-w-2xl relative">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${themeConfig?.headerBadgeBg || 'bg-emerald-50 dark:bg-emerald-400/10'} ${themeConfig?.headerBadgeText || 'text-emerald-700 dark:text-emerald-300'} ${themeConfig?.headerBadgeBorder || 'border-emerald-200 dark:border-emerald-400/30'}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Repair-tech marketplace · worldwide</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Spare parts, tools & test gear near you</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Find the exact part you need (new or used: screens, T-con and power boards, capacitors, donor boards) and the tools to fit it, from shops and fellow techs. Search a part number, then tap <span className="font-bold">Nearest first</span>. Shops earn the <span className="font-bold text-emerald-600 dark:text-emerald-300">Verified</span> badge only after our team checks their business registration.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 relative self-start md:self-auto">
        <button type="button" onClick={openShopSignup} className={`${primary} justify-center`}>
          <Store className="w-4 h-4" /> List your shop
        </button>
        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                  active
                    ? themeConfig?.activeNavBg || 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {!configured && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          <p className="leading-relaxed">
            The marketplace needs the cloud database, which isn't set up in this build. Listings, selling and verification will appear once the Firebase settings are added.
          </p>
        </div>
      )}

      {tab === 'browse' && (
        <div className="space-y-5">
          <div className={`${cardCls} !rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-3`}>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search a part number or tool: 6870C-0442B, 470uF 25V, multimeter…"
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    category === cat
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="w-full flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              {([['all', 'Everything'], ['parts', 'Parts'], ['tools', 'Tools & meters']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setGroup(id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 ${group === id ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {id === 'tools' ? <Wrench className="w-3.5 h-3.5" /> : id === 'parts' ? <Package className="w-3.5 h-3.5" /> : null}{label}
                </button>
              ))}
              <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              {([['all', 'New & used'], ['new', 'New'], ['used', 'Used / salvage']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setCond(id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${cond === id ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{label}</button>
              ))}
              <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <label className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="rounded accent-emerald-600" /> <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified only
              </label>
              <button type="button" onClick={() => setNearest(n => !n)} className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 ${nearest ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                <MapPin className="w-3.5 h-3.5" /> Nearest first
              </button>
              <button type="button" onClick={() => setShipsToMe(v => !v)} title={userLoc.country ? `Shops in ${countryName(userLoc.country)} and suppliers that ship there` : 'Choose your country under Nearest first'} className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 ${shipsToMe ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                <Truck className="w-3.5 h-3.5" /> {userLoc.country ? `Available in ${countryName(userLoc.country)}` : 'Ships to me'}
              </button>
            </div>
            {nearest && (
              <div className="w-full flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {userLoc.coords ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold"><LocateFixed className="w-3.5 h-3.5" /> Sorted by distance from you</span>
                ) : (
                  <>
                    <UseMyLocationButton />
                    <span>or sort by area:</span>
                    <select value={userLoc.country} onChange={e => setUserArea({ country: e.target.value })} className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs max-w-[11rem]" aria-label="Your country">
                      <option value="">Choose your country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <input value={userLoc.region} onChange={e => setUserArea({ region: e.target.value })} placeholder="Town or region" className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs w-32" aria-label="Your town or region" maxLength={60} />
                  </>
                )}
              </div>
            )}
          </div>

          {!filtersActive && <ListYourShopCard onStart={openShopSignup} primary={primary} />}

          {listingsError && <ErrorNote msg={`Couldn't load listings: ${listingsError}`} />}

          {!loaded ? (
            <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading listings…
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No listings yet"
              body={configured ? 'Be the first to list a scope, soldering station or donor board. Listings from individuals are checked by our team before they go live.' : 'Listings will show here once the marketplace database is connected.'}
              action={configured ? <button className={primary} onClick={() => setTab('sell')}><Plus className="w-4 h-4" /> Sell an item</button> : undefined}
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title="Nothing matches" body={group === 'tools' || /meter/i.test(search) ? 'No shop near you lists this tool yet. Try "Everything", clear the filters, or check again soon as shops join.' : 'No shop lists this part yet. Try fewer words, only the part number, or clear the filters.'} action={<button className={ghostBtn} onClick={clearFilters}>Clear filters</button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map(item => {
                const mine = !!user && item.seller.uid === user.uid;
                return (
                  <div
                    key={item.id}
                    id={`listing-${item.id}`}
                    className={`${cardCls} overflow-hidden flex flex-col sm:flex-row hover:shadow-md transition-all ${focusedId === item.id ? 'ring-4 ring-emerald-400/70 shadow-lg shadow-emerald-500/20' : ''}`}
                  >
                    <div className="sm:w-2/5 relative h-48 sm:h-auto bg-slate-100 dark:bg-slate-800">
                      <img
                        src={item.image}
                        alt={item.hasPhoto ? item.title : ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                        }}
                      />
                      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-slate-950/75 text-white text-[10px] font-bold uppercase tracking-wider">{item.condition}</span>
                      {!item.inStock && <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold uppercase">Sold out</span>}
                    </div>
                    <div className="sm:w-3/5 p-5 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${themeConfig?.accentText || 'text-emerald-600 dark:text-emerald-300'}`}>{item.category}</span>
                          <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-50">{formatZar(item.price, item.currency)}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{item.title}</h3>
                        {item.partNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.partNumbers.slice(0, 4).map(pn => <span key={pn} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">{pn}</span>)}
                          </div>
                        )}
                        {item.fits.length > 0 && <p className="text-[11px] text-slate-500 line-clamp-1">Fits: {item.fits.join(', ')}</p>}
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{item.description}</p>
                        {(kmById.get(item.id) != null || item.town) && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{kmById.get(item.id) != null ? `${formatKm(kmById.get(item.id)!)} away` : ''}{kmById.get(item.id) != null && item.town ? ' · ' : ''}{[item.town, item.province, item.country && item.country !== userLoc.country ? countryName(item.country) : ''].filter(Boolean).join(', ')}</p>
                        )}
                        {item.shipsTo.length > 0 && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><Truck className="w-3 h-3" />
                            {userLoc.country && item.country !== userLoc.country && shipsToCountry(item, userLoc.country) ? `Ships to ${countryName(userLoc.country)}${item.country ? ` from ${countryName(item.country)}` : ''}` : item.shipsTo.includes('WORLDWIDE') ? 'Ships worldwide' : `Ships to ${item.shipsTo.slice(0, 4).map(countryName).join(', ')}${item.shipsTo.length > 4 ? '…' : ''}`}
                          </p>
                        )}
                        {item.businessId && shopProfiles.get(item.seller.uid) && !mine && (
                          <ShopActions shop={shopProfiles.get(item.seller.uid)!} partName={item.partNumbers[0] ? `${item.title} (${item.partNumbers[0]})` : item.title} compact />
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between gap-3">
                        <button onClick={() => setProfileUid(item.seller.uid)} className="text-left min-w-0 group">
                          <span className="text-[10px] text-slate-400 block">Seller</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate block">{item.seller.name}</span>
                          <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.businessId && !item.seller.isVerifiedCompany && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold"><Store className="w-3 h-3" /> Shop</span>}
                            {item.businessId && item.seller.isVerifiedCompany ? <VerifiedShopBadge /> : <SellerBadge verified={item.seller.isVerifiedCompany} type={item.seller.type} />}
                            {item.seller.reviewCount > 0 && (
                              <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {item.seller.rating.toFixed(1)} ({item.seller.reviewCount})
                              </span>
                            )}
                          </span>
                        </button>
                        {mine ? (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold shrink-0">Your listing</span>
                        ) : item.businessId && orderShops.has(item.seller.uid) ? (
                          <button
                            disabled={!item.inStock}
                            onClick={() => {
                              if (!user) {
                                onOpenAuth?.();
                                return;
                              }
                              setOrderItem(item);
                            }}
                            className={`${primary} shrink-0`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" /> Buy
                          </button>
                        ) : (
                          <button
                            disabled={!item.inStock}
                            onClick={() => {
                              if (!user) {
                                onOpenAuth?.();
                                return;
                              }
                              setBuyItem(item);
                            }}
                            className={`${primary} shrink-0`}
                          >
                            <Send className="w-3.5 h-3.5" /> Request to buy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            "Buy" (shops) lets you choose delivery or collection and pay the shop directly by card (through PayPal), PayPal or bank transfer. The app never sees your card number. "Request to buy" sends your message to the seller so you can agree on payment and collection. Never pay before you trust the seller.
          </p>
        </div>
      )}

      {tab === 'sell' &&
        (user ? (
          <SellPanel uid={user.uid} defaultName={displayNameOf(user)} defaultEmail={user.email || ''} verifiedSellers={verifiedSellers} primary={primary} startAsShop={shopSignup} onShopStarted={() => setShopSignup(false)} />
        ) : (
          <SignInPrompt what={shopSignup ? 'register your shop' : 'sell on the marketplace'} onOpenAuth={onOpenAuth} primary={primary} />
        ))}

      {tab === 'requests' &&
        (user ? (
          <div className="space-y-8">
            <OrdersSection uid={user.uid} primary={primary} />
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Messages from "Request to buy"</h3>
              <RequestsPanel uid={user.uid} myName={displayNameOf(user)} reviews={reviews} primary={primary} />
            </div>
          </div>
        ) : (
          <SignInPrompt what="see your orders" onOpenAuth={onOpenAuth} primary={primary} />
        ))}

      {buyItem && user && (
        <BuyModal item={buyItem} buyer={{ uid: user.uid, name: displayNameOf(user), email: user.email || '' }} onClose={() => setBuyItem(null)} onDone={() => { setBuyItem(null); setTab('requests'); }} primary={primary} />
      )}

      {orderItem && user && orderShops.get(orderItem.seller.uid) && (
        <OrderModal item={orderItem} shop={orderShops.get(orderItem.seller.uid)!} buyer={{ uid: user.uid, name: displayNameOf(user) }} onClose={() => setOrderItem(null)} onViewOrders={() => { setOrderItem(null); setTab('requests'); }} primary={primary} />
      )}

      {profileUid && (
        <SellerProfileModal
          uid={profileUid}
          listings={listings.filter(l => l.seller.uid === profileUid)}
          reviews={reviews.filter(r => r.sellerUid === profileUid)}
          verified={verifiedSellers.has(profileUid)}
          companyName={verifiedSellers.get(profileUid)?.companyName}
          onClose={() => setProfileUid(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "List your shop" card (partner options)
// ---------------------------------------------------------------------------

function ListYourShopCard({ onStart, primary }: { onStart: () => void; primary: string }) {
  const options: { title: string; price?: string; body: string; soon?: boolean }[] = [
    { title: 'Individuals', price: 'Free forever', body: 'Selling your own item, like one soldering iron or a kettle? Listing is always free. No plan, no fees.' },
    { title: 'Business plan', price: BUSINESS_PLAN_PRICE, body: 'For shops and suppliers (local or overseas): shop profile, map pin, WhatsApp and call buttons, shipping countries, and a place in the AI\'s "Where to buy". New shops start on a trial; no payment is taken in the app yet, our team contacts you about the plan.' },
    { title: 'Featured listing', body: 'Show your shop at the top of searches in your area.', soon: true },
    { title: 'Guide sponsor', body: 'Your shop on repair guides that use the parts you sell.', soon: true },
  ];
  return (
    <div className={`${cardCls} !rounded-2xl p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-xl">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Store className="w-5 h-5 text-emerald-600" /> Sell spare parts or tools? List your shop</h2>
          <p className="text-xs text-slate-500 leading-relaxed">New and used / salvage sellers welcome, from a local shop to an overseas supplier that ships worldwide: donor boards, screens, T-con and power boards, components, meters and soldering gear. People who need that exact part find you and contact you on WhatsApp or by phone.</p>
        </div>
        <button type="button" onClick={onStart} className={primary}><Plus className="w-4 h-4" /> Register your shop</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {options.map(o => (
          <div key={o.title} className={`rounded-xl border p-3 ${o.soon ? 'border-dashed border-slate-200 dark:border-slate-700 opacity-75' : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20'}`}>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {o.soon ? <Sparkles className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />} {o.title}
              {o.soon && <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold uppercase">Coming soon</span>}
            </p>
            {o.price && <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">{o.price}</p>}
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{o.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignInPrompt({ what, onOpenAuth, primary }: { what: string; onOpenAuth?: () => void; primary: string }) {
  return (
    <EmptyState
      icon={UserIcon}
      title="Sign in to continue"
      body={isFirebaseConfigured ? `Sign in with your DIY Electronics account to ${what}.` : `The cloud database isn't set up in this build, so you can't ${what} yet.`}
      action={isFirebaseConfigured && onOpenAuth ? <button className={primary} onClick={onOpenAuth}>Sign in</button> : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Request to buy
// ---------------------------------------------------------------------------

function BuyModal({
  item,
  buyer,
  onClose,
  onDone,
  primary,
}: {
  item: ListingItem;
  buyer: { uid: string; name: string; email: string };
  onClose: () => void;
  onDone: () => void;
  primary: string;
}) {
  const [contact, setContact] = useState(buyer.email);
  const [message, setMessage] = useState(`Hi, is the "${item.title}" still available? I'm keen at ${formatZar(item.price, item.currency)}.`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || !message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createPurchaseRequest({ id: item.id, title: item.title, price: item.price, currency: item.currency, sellerUid: item.seller.uid }, { uid: buyer.uid, name: buyer.name }, contact, message);
      setSent(true);
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      {sent ? (
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Request sent</h2>
          <p className="text-xs text-slate-500">{item.seller.name} will see your message and reply in the Requests tab.</p>
          <button className={primary} onClick={onDone}>View my requests</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pr-8">Request to buy</h2>
            <p className="text-xs text-slate-500 mt-1">
              {item.title} · <span className="font-bold">{formatZar(item.price, item.currency)}</span> from {item.seller.name}
            </p>
          </div>
          <div>
            <label className={labelCls}>How should the seller reach you?</label>
            <input required value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. +44 7700 900123 or you@example.com" className={inputCls} maxLength={200} />
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)} className={inputCls} maxLength={2000} />
          </div>
          <p className="text-[11px] text-slate-400">No payment is taken here. Your contact details are only shared with this seller.</p>
          <CommunityReviews targetType="listing" targetId={item.id} title="Reviews of this listing" />
          <div className="flex justify-start"><ReportButton targetType="listing" targetId={item.id} targetLabel={`${item.title} (${item.seller.name})`} /></div>
          <ErrorNote msg={err} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send request
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Seller profile modal
// ---------------------------------------------------------------------------

function SellerProfileModal({
  uid,
  listings,
  reviews,
  verified,
  companyName,
  onClose,
}: {
  uid: string;
  listings: ListingItem[];
  reviews: Review[];
  verified: boolean;
  companyName?: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  useEffect(() => subscribeSellerProfile(uid, setProfile), [uid]);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const name = companyName || profile?.displayName || listings[0]?.seller.name || 'Seller';
  const type: SellerType = profile?.sellerType || listings[0]?.seller.type || 'individual';

  return (
    <Modal onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-start gap-4 pr-8">
          {profile?.logoUrl ? (
            <img src={profile.logoUrl} alt={`${name} logo`} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" referrerPolicy="no-referrer" />
          ) : (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {profile?.isShop ? <Store className="w-6 h-6" /> : type === 'company' ? <Building2 className="w-6 h-6" /> : name.slice(0, 1).toUpperCase()}
          </div>
          )}
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <SellerBadge verified={verified} type={type} />
              {profile?.location && <span className="text-[11px] text-slate-500">{profile.location}</span>}
            </div>
            {reviews.length > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <Stars value={avg} /> <span className="font-bold">{avg.toFixed(1)}</span> · {reviews.length} review{reviews.length === 1 ? '' : 's'}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No reviews yet</p>
            )}
          </div>
        </div>

        <div className="flex justify-end -mt-3"><ReportButton targetType="seller" targetId={uid} targetLabel={name} /></div>
        {profile?.bio && <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{profile.bio}</p>}
        {profile?.isShop && <ShopDetails shop={profile} />}
        {verified && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3">
            {profile?.isShop ? "This shop's business registration, phone number and shopfront were checked and approved by the DIY Electronics team." : "This company's registration, tax and address documents were checked and approved by the DIY Electronics team."}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reviews</h3>
          {reviews.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
              No reviews yet. Reviews come only from buyers whose request this seller accepted.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {reviews.map(r => (
                <div key={r.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{r.reviewerName}</span>
                    <Stars value={r.rating} size="w-3 h-3" />
                  </div>
                  {r.comment && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{r.comment}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">{formatTs(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <CommunityReviews targetType="seller" targetId={uid} />

        {listings.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Listings ({listings.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {listings.slice(0, 6).map(l => (
                <div key={l.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <img src={l.image} alt="" className="w-full h-20 object-cover" referrerPolicy="no-referrer" />
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{l.title}</p>
                    <p className="text-[11px] font-mono text-slate-500">{formatZar(l.price, l.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Public shop details: shopfront, address + map, hours, delivery, contact buttons. */
function ShopDetails({ shop }: { shop: SellerProfile }) {
  const stock = shop.stockType === 'new' ? 'New parts' : shop.stockType === 'used' ? 'Used / salvage parts' : 'New and used parts';
  return (
    <div className="space-y-3">
      {shop.shopfrontUrl && <img src={shop.shopfrontUrl} alt={`${shop.displayName} shopfront`} className="w-full max-h-56 object-cover rounded-2xl border border-slate-200 dark:border-slate-800" referrerPolicy="no-referrer" loading="lazy" />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200"><MapPin className="w-4 h-4 shrink-0 text-slate-400" />{[shop.address, shop.town, shop.province, countryName(shop.country || '')].filter(Boolean).join(', ')}</p>
        {shop.hours && <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200"><Clock className="w-4 h-4 shrink-0 text-slate-400" />{shop.hours}</p>}
        <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200"><Package className="w-4 h-4 shrink-0 text-slate-400" />{stock}</p>
        <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200"><Truck className="w-4 h-4 shrink-0 text-slate-400" />
          {!shop.delivery && !shop.shipsInternationally
            ? "We don't deliver: collect at the shop"
            : `Delivers${shop.deliveryMaxKm ? ` up to ${shop.deliveryMaxKm} km` : ' locally'}${shop.shipsInternationally && shop.shipsTo?.length ? (shop.shipsTo.includes('WORLDWIDE') ? ', ships worldwide' : `, ships to ${shop.shipsTo.map(countryName).join(', ')}`) : ''}${typeof shop.deliveryFee === 'number' && shop.delivery ? ` · fee ${formatZar(shop.deliveryFee, shop.currency || 'USD')}` : ''}`}
        </p>
        {shopPayMethods(shop).length > 0 && (
          <p className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200"><ShoppingBag className="w-4 h-4 shrink-0 text-slate-400" />Pay by {shopPayMethods(shop).map(m => PAY_SHORT[m]).join(', ')}</p>
        )}
        {shop.email && <a href={`mailto:${shop.email}`} className="flex items-start gap-1.5 text-cobalt-600 dark:text-cobalt-300 font-bold break-all">✉ {shop.email}</a>}
      </div>
      <ShopActions shop={shop} partName="a part" />
      {hasCoords(shop) && (
        <iframe title={`Map of ${shop.displayName}`} src={osmEmbedUrl(shop)} className="w-full h-48 rounded-2xl border border-slate-200 dark:border-slate-800" loading="lazy" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sell tab
// ---------------------------------------------------------------------------

function SellPanel({
  uid,
  defaultName,
  defaultEmail,
  verifiedSellers,
  primary,
  startAsShop = false,
  onShopStarted,
}: {
  uid: string;
  defaultName: string;
  defaultEmail: string;
  verifiedSellers: Map<string, unknown>;
  primary: string;
  /** Opened from "List your shop": go straight to the shop registration form. */
  startAsShop?: boolean;
  onShopStarted?: () => void;
}) {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [verification, setVerification] = useState<SellerVerification | null | undefined>(undefined);
  const [myListings, setMyListings] = useState<ListingDoc[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [shopMode, setShopMode] = useState(false);
  const [listingModal, setListingModal] = useState<{ listing: ListingDoc | null } | null>(null);

  useEffect(() => subscribeSellerProfile(uid, p => setProfile(p ? { ...p, uid } : p)), [uid]);
  useEffect(() => subscribeMyVerification(uid, setVerification), [uid]);
  useEffect(() => subscribeMyListings(uid, setMyListings), [uid]);

  // "List your shop": open the shop form (new sellers, or sellers who are not a shop yet).
  useEffect(() => {
    if (!startAsShop || profile === undefined) return;
    if (!profile?.isShop) { setShopMode(true); setEditingProfile(true); }
    onShopStarted?.();
  }, [startAsShop, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep listings' location in step with the shop's address / map pin.
  useEffect(() => {
    if (profile?.isShop && !profile.suspended && myListings.length) syncListingLocations(profile, myListings).catch(() => undefined);
  }, [profile, myListings]);

  const isVerified = verifiedSellers.has(uid);

  if (profile === undefined) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your seller account…
      </div>
    );
  }

  if (profile?.suspended) {
    return (
      <EmptyState icon={AlertTriangle} title="This seller account is suspended" body={`An admin suspended this account${profile.suspendedReason ? `: ${profile.suspendedReason}` : '.'} Your listings are hidden. To appeal, email support with your shop name.`} />
    );
  }

  if (!profile || editingProfile) {
    return (
      <SellerProfileForm
        uid={uid}
        existing={profile}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
        startAsShop={shopMode || !!profile?.isShop}
        primary={primary}
        onDone={() => { setEditingProfile(false); setShopMode(false); }}
        onCancel={profile ? () => { setEditingProfile(false); setShopMode(false); } : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3 min-w-0">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
          ) : (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0">
            {profile.isShop ? <Store className="w-5 h-5" /> : profile.sellerType === 'company' ? <Building2 className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
          </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{profile.displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-500">{profile.isShop ? `Shop · ${[profile.town, countryName(profile.country || '')].filter(Boolean).join(', ')}` : profile.sellerType === 'company' ? 'Company seller' : 'Individual seller'}</span>
              {profile.isShop && isVerified ? <VerifiedShopBadge /> : <SellerBadge verified={isVerified} type={profile.sellerType} />}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={ghostBtn} onClick={() => setEditingProfile(true)}>
            <Pencil className="w-3.5 h-3.5 inline mr-1" /> {profile.isShop ? 'Edit shop' : 'Edit profile'}
          </button>
          {!profile.isShop && (
            <button className={ghostBtn} onClick={() => { setShopMode(true); setEditingProfile(true); }}>
              <Store className="w-3.5 h-3.5" /> Register as a shop
            </button>
          )}
          <button className={primary} onClick={() => setListingModal({ listing: null })}>
            <Plus className="w-4 h-4" /> New listing
          </button>
        </div>
      </div>

      {profile.isShop && <BusinessPlanCard profile={profile} />}

      {profile.isShop ? (
        <ShopVerificationPanel profile={profile} verification={verification ?? null} loading={verification === undefined} defaultEmail={defaultEmail} isVerified={isVerified} primary={primary} />
      ) : profile.sellerType === 'company' ? (
        <VerificationPanel uid={uid} verification={verification ?? null} loading={verification === undefined} defaultEmail={defaultEmail} defaultCompany={profile.displayName} primary={primary} />
      ) : (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0 text-indigo-500" />
          <p className="leading-relaxed">
            You're selling as an individual. Your listings are checked by our team before they go live and show as "Unverified individual". Registered businesses can switch to a company profile and apply for the Verified badge.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">My listings ({myListings.length})</h3>
        {myListings.length === 0 ? (
          <EmptyState icon={Package} title="No listings yet" body={profile.isShop ? 'Add each part or tool you stock. Type its part numbers (e.g. 6870C-0442B, 470uF 25V) so people searching for that exact part find you.' : 'List a tool, test instrument or donor board. Add a clear photo and an honest condition.'} action={<button className={primary} onClick={() => setListingModal({ listing: null })}><Plus className="w-4 h-4" /> New listing</button>} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {myListings.map(l => (
              <MyListingRow key={l.id} listing={l} onEdit={() => setListingModal({ listing: l })} />
            ))}
          </div>
        )}
      </div>

      {listingModal && (
        <ListingFormModal
          uid={uid}
          profile={profile}
          isVerified={isVerified}
          listing={listingModal.listing}
          onClose={() => setListingModal(null)}
          primary={primary}
        />
      )}
    </div>
  );
}

function SellerProfileForm({
  uid,
  existing,
  defaultName,
  defaultEmail = '',
  startAsShop = false,
  primary,
  onDone,
  onCancel,
}: {
  uid: string;
  existing: SellerProfile | null;
  defaultName: string;
  defaultEmail?: string;
  startAsShop?: boolean;
  primary: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  type Kind = SellerType | 'shop';
  const [kind, setKind] = useState<Kind>(startAsShop || existing?.isShop ? 'shop' : existing?.sellerType || 'individual');
  const [displayName, setDisplayName] = useState(existing?.displayName || (startAsShop ? '' : defaultName));
  const [location, setLocation] = useState(existing?.location || '');
  const [bio, setBio] = useState(existing?.bio || '');
  // Shop fields
  const [address, setAddress] = useState(existing?.address || '');
  const [town, setTown] = useState(existing?.town || '');
  const [province, setProvince] = useState(existing?.province || '');
  const [country, setCountry] = useState(existing?.country || guessCountry());
  const [currency, setCurrency] = useState(existing?.currency || currencyForCountry(existing?.country || guessCountry()));
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(hasCoords(existing) ? { lat: existing!.lat as number, lng: existing!.lng as number } : null);
  const [pinNote, setPinNote] = useState<string | null>(null);
  const [locating, setLocating] = useState<'gps' | 'address' | null>(null);
  const [hours, setHours] = useState(existing?.hours || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp || '');
  const [email, setEmail] = useState(existing?.email || defaultEmail);
  const [delivery, setDelivery] = useState(!!existing?.delivery || !!existing?.shipsInternationally);
  const [deliveryFee, setDeliveryFee] = useState(typeof existing?.deliveryFee === 'number' ? String(existing.deliveryFee) : '');
  const [deliveryMaxKm, setDeliveryMaxKm] = useState(typeof existing?.deliveryMaxKm === 'number' ? String(existing.deliveryMaxKm) : '');
  const [payMethods, setPayMethods] = useState<PayMethod[]>(() => (existing?.payMethods || []).filter((m): m is PayMethod => ['card', 'paypal', 'bank'].includes(m)));
  const [paypalEmail, setPaypalEmail] = useState(existing?.paypalEmail || '');
  const [paypalMe, setPaypalMe] = useState(existing?.paypalMe || '');
  const [bank, setBank] = useState<BankDetails>(EMPTY_BANK);
  useEffect(() => {
    if (!existing?.isShop) return;
    getBankDetails(uid).then(b => { if (b) setBank(b); }).catch(() => undefined);
  }, [uid, existing?.isShop]);
  const togglePay = (m: PayMethod) => setPayMethods(cur => (cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m]));
  const [shipsInternationally, setShipsInternationally] = useState(!!existing?.shipsInternationally);
  const [shipsTo, setShipsTo] = useState<string[]>(existing?.shipsTo?.length ? existing.shipsTo : ['WORLDWIDE']);
  const [stockType, setStockType] = useState<StockType>(existing?.stockType || 'both');
  const [registrationNumber, setRegistrationNumber] = useState(existing?.registrationNumber || '');
  const [logo, setLogo] = useState<{ url: string; path: string }>({ url: existing?.logoUrl || '', path: existing?.logoPath || '' });
  const [shopfront, setShopfront] = useState<{ url: string; path: string }>({ url: existing?.shopfrontUrl || '', path: existing?.shopfrontPath || '' });
  const [uploading, setUploading] = useState<{ kind: 'logo' | 'shopfront'; pct: number } | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isShop = kind === 'shop';

  const onImage = async (which: 'logo' | 'shopfront', file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setUploading({ kind: which, pct: 0 });
    try {
      const res = await uploadShopImage(uid, which, file, pct => setUploading({ kind: which, pct }));
      (which === 'logo' ? setLogo : setShopfront)({ url: res.url, path: res.path });
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setUploading(null);
    }
  };

  const useGps = async () => {
    setLocating('gps'); setPinNote(null);
    try {
      const p = await currentPosition(15000);
      setPin(p);
      setPinNote('Pin set to where this phone is now. Do this while standing in the shop.');
    } catch (ex: any) { setPinNote(ex?.message || 'Could not get your location.'); }
    finally { setLocating(null); }
  };
  const findAddress = async () => {
    setLocating('address'); setPinNote(null);
    try {
      const r = await geocodeAddress([address, town, province, countryName(country)].filter(Boolean).join(', '), country);
      if (r) { setPin({ lat: r.lat, lng: r.lng }); setPinNote(`Found: ${r.label}. Check the pin on the map below.`); }
      else setPinNote('That address was not found on the map. Check the spelling, or stand in the shop and tap "Use my current location".');
    } catch (ex: any) { setPinNote(ex?.message || 'The map lookup failed.'); }
    finally { setLocating(null); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const fee = Number(deliveryFee || 0);
      const maxKm = deliveryMaxKm.trim() ? Number(deliveryMaxKm) : null;
      if (isShop && delivery && (!Number.isFinite(fee) || fee < 0)) throw new Error('Type the delivery fee as a number, e.g. 5 or 0 for free delivery.');
      if (isShop && delivery && maxKm !== null && (!Number.isFinite(maxKm) || maxKm <= 0)) throw new Error('Type the max delivery distance in km, or leave it empty for no limit.');
      const meLink = normalisePaypalMe(paypalMe);
      if (isShop && paypalMe.trim() && !meLink) throw new Error('Check the PayPal.me link. It looks like paypal.me/yourname.');
      if (isShop && payMethods.includes('bank')) {
        if (!bankDetailsComplete(bank)) throw new Error('For bank transfer, add the account name, the bank name and the account number (or IBAN).');
        await saveBankDetails(uid, bank);
      }
      await saveSellerProfile(
        uid,
        isShop
          ? {
              displayName, sellerType: 'company', bio, isShop: true,
              logoUrl: logo.url, logoPath: logo.path, shopfrontUrl: shopfront.url, shopfrontPath: shopfront.path,
              address, town, province, country, currency, lat: pin?.lat ?? null, lng: pin?.lng ?? null,
              hours, phone, whatsapp, email, delivery, stockType, registrationNumber,
              shipsInternationally: delivery && shipsInternationally, shipsTo: delivery && shipsInternationally ? shipsTo : [],
              deliveryFee: delivery ? fee : 0, deliveryMaxKm: delivery ? maxKm : null,
              payMethods, paypalEmail: paypalEmail.trim(), paypalMe: meLink,
            }
          : { displayName, sellerType: kind as SellerType, location, bio, isShop: false },
        !!existing
      );
      onDone();
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  const choice = (type: Kind, title: string, body: string, Icon: any) => (
    <button
      type="button"
      onClick={() => setKind(type)}
      className={`text-left p-4 rounded-2xl border-2 transition-all ${
        kind === type
          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm shadow-indigo-500/10'
          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${kind === type ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</span>
        {kind === type && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{body}</p>
    </button>
  );

  const imagePicker = (which: 'logo' | 'shopfront', label: string, hint: string, value: { url: string }, onClear: () => void, inputRef: React.RefObject<HTMLInputElement | null>) => (
    <div className="flex gap-3 items-start">
      <button type="button" onClick={() => inputRef.current?.click()} className={`relative ${which === 'logo' ? 'w-20 h-20' : 'w-32 h-20'} rounded-2xl overflow-hidden border-2 border-dashed border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/30 shrink-0 flex items-center justify-center`}>
        {value.url ? <img src={value.url} alt={label} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 flex flex-col items-center gap-1"><ImagePlus className="w-5 h-5" /> Add</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { onImage(which, e.target.files?.[0]); e.target.value = ''; }} />
      <div className="text-[11px] text-slate-500 space-y-1 min-w-0">
        <p className="font-bold text-slate-700 dark:text-slate-200">{label}</p>
        <p>{hint}</p>
        {uploading?.kind === which && <div className="space-y-1"><ProgressBar pct={uploading.pct} /><span>Uploading… {uploading.pct}%</span></div>}
        {value.url && !uploading && <button type="button" className="text-red-600 font-bold" onClick={onClear}>Remove</button>}
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className={`${cardCls} p-6 sm:p-8 space-y-5 max-w-3xl`}>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{existing ? (isShop ? 'Edit your shop' : 'Edit seller profile') : isShop ? 'Register your shop' : 'Set up your seller profile'}</h2>
        <p className="text-xs text-slate-500 mt-1">{isShop ? 'Fill in where you are and how to reach you. People who need a part you stock will see your shop with Directions, WhatsApp and Call buttons.' : 'Choose how you sell. You can change this later.'}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {choice('individual', 'Individual', 'Selling your own tools or spares. No documents needed; listings are reviewed before going live.', UserIcon)}
        {choice('shop', 'Shop / supplier', `A shop or supplier (local or overseas) selling parts or tools. Address, map pin, WhatsApp, call and shipping. Business plan ${BUSINESS_PLAN_PRICE}, starting with a trial.`, Store)}
        {choice('company', 'Company', 'A registered business. Submit registration, tax and address documents to earn the Verified badge and list instantly.', Building2)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{isShop ? 'Shop name' : kind === 'company' ? 'Trading name' : 'Display name'}</label>
          <input required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={isShop ? 'e.g. City TV Spares' : kind === 'company' ? 'e.g. Bright Electronics Ltd' : 'e.g. Sam K.'} className={inputCls} maxLength={80} />
        </div>
        {!isShop && (
          <div>
            <label className={labelCls}>Location (optional)</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Nairobi, Kenya" className={inputCls} maxLength={80} />
          </div>
        )}
        {isShop && (
          <div>
            <label className={labelCls}>What do you sell?</label>
            <select value={stockType} onChange={e => setStockType(e.target.value as StockType)} className={inputCls}>
              <option value="both">New and used parts</option>
              <option value="new">New parts only</option>
              <option value="used">Used / salvage parts only (donor boards, screens…)</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className={labelCls}>{isShop ? 'Description' : 'About (optional)'}</label>
        <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder={isShop ? 'What you stock (e.g. TV power boards, T-con boards, LED strips, phone screens), brands, and services' : 'What you repair or stock, collection areas, courier options…'} className={inputCls} maxLength={600} />
      </div>

      {isShop && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {imagePicker('logo', 'Logo (optional)', 'Square image, JPG, PNG or WebP, up to 5 MB.', logo, () => setLogo({ url: '', path: '' }), logoRef)}
            {imagePicker('shopfront', 'Shopfront photo', 'The shop entrance with its name visible. Needed for the Verified badge.', shopfront, () => setShopfront({ url: '', path: '' }), frontRef)}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Where is the shop?</h3>
            <div>
              <label className={labelCls}>Street address</label>
              <input required value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Shop 4, 12 Main Road" className={inputCls} maxLength={300} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Town / city</label>
                <input required value={town} onChange={e => setTown(e.target.value)} placeholder="e.g. Lagos, Leeds, Durban" className={inputCls} maxLength={80} />
              </div>
              <div>
                <label className={labelCls}>State / province / region</label>
                <input value={province} onChange={e => setProvince(e.target.value)} placeholder="Optional" className={inputCls} maxLength={80} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select required value={country} onChange={e => { const c = e.target.value; setCountry(c); if (!existing?.currency) setCurrency(currencyForCountry(c)); }} className={inputCls}>
                  <option value="">Choose a country</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={findAddress} disabled={!!locating || address.trim().length < 4} className={ghostBtn}>
                {locating === 'address' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find this address on the map
              </button>
              <button type="button" onClick={useGps} disabled={!!locating} className={ghostBtn}>
                {locating === 'gps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />} Use my current location (I'm at the shop)
              </button>
              {pin && <button type="button" onClick={() => { setPin(null); setPinNote(null); }} className={`${ghostBtn} !text-red-600`}>Remove pin</button>}
            </div>
            {pinNote && <p className="text-[11px] text-slate-500">{pinNote}</p>}
            {pin ? (
              <iframe title="Shop location" src={osmEmbedUrl(pin)} className="w-full h-48 rounded-2xl border border-slate-200 dark:border-slate-800" loading="lazy" />
            ) : (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">No map pin yet. Without it customers are sorted by country and town only, and Directions use the address text.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">How customers reach you</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => { const v = toE164(phone); if (v) setPhone(v); }} placeholder="+<country code> number" className={inputCls} maxLength={30} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp number</label>
                <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} onBlur={() => { const v = toE164(whatsapp); if (v) setWhatsapp(v); }} placeholder="+<country code> number" className={inputCls} maxLength={30} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="shop@example.com" className={inputCls} maxLength={160} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 -mt-1">{PHONE_HELP}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Opening hours</label>
                <input value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. Mon–Fri 8:00–17:00, Sat 8:00–13:00" className={inputCls} maxLength={200} />
              </div>
              <div>
                <label className={labelCls}>Business registration number (optional)</label>
                <input value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} placeholder="Your official company number" className={inputCls} maxLength={40} />
                <p className="text-[10px] text-slate-400 mt-1">{REGISTRATION_HINT}. Needed to apply for the Verified Shop badge.</p>
              </div>
            </div>
            <div className="sm:w-1/2">
              <label className={labelCls}>Currency for your prices</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                {[...new Set([currency, ...CURRENCIES])].filter(Boolean).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Delivery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([[true, 'We deliver', 'Buyers can choose "Deliver to me" and pay your delivery fee.'], [false, "We don't deliver", 'Buyers collect from the shop.']] as const).map(([v, title, body]) => (
                <button key={title} type="button" onClick={() => setDelivery(v)} className={`text-left p-3 rounded-2xl border-2 ${delivery === v ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">{title}{delivery === v && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}</span>
                  <span className="block text-[11px] text-slate-500 mt-1">{body}</span>
                </button>
              ))}
            </div>
            {delivery && (
              <div className="space-y-3 pl-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Delivery fee ({currency || 'your currency'})</label>
                    <input type="number" min={0} step="0.01" inputMode="decimal" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="e.g. 5 (0 = free)" className={inputCls} />
                    <p className="text-[10px] text-slate-400 mt-1">One flat fee per order, added to the item price.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Max distance for local delivery, km (optional)</label>
                    <input type="number" min={1} step="1" inputMode="numeric" value={deliveryMaxKm} onChange={e => setDeliveryMaxKm(e.target.value)} placeholder="Empty = no limit" className={inputCls} />
                    <p className="text-[10px] text-slate-400 mt-1">Measured from your map pin to the buyer's pin.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={shipsInternationally} onChange={e => setShipsInternationally(e.target.checked)} className="rounded accent-indigo-600" /> We ship to other countries (e.g. an overseas supplier)
                </label>
                {shipsInternationally && (
                  <div className="pl-6 space-y-2">
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <label className="inline-flex items-center gap-1.5"><input type="radio" checked={shipsTo.includes('WORLDWIDE')} onChange={() => setShipsTo(['WORLDWIDE'])} className="accent-indigo-600" /> Worldwide</label>
                      <label className="inline-flex items-center gap-1.5"><input type="radio" checked={!shipsTo.includes('WORLDWIDE')} onChange={() => setShipsTo([])} className="accent-indigo-600" /> Only to these countries</label>
                    </div>
                    {!shipsTo.includes('WORLDWIDE') && (
                      <>
                        <select value="" onChange={e => { const c = e.target.value; if (c && !shipsTo.includes(c)) setShipsTo([...shipsTo, c].slice(0, 60)); }} className={inputCls} aria-label="Add a country you ship to">
                          <option value="">Tap to add a country you ship to…</option>
                          {COUNTRIES.filter(c => !shipsTo.includes(c.code)).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-1.5">
                          {shipsTo.map(c => (
                            <button key={c} type="button" onClick={() => setShipsTo(shipsTo.filter(x => x !== c))} className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">{countryName(c)} <X className="w-3 h-3" /></button>
                          ))}
                          {shipsTo.length === 0 && <span className="text-[11px] text-amber-700 dark:text-amber-300">Add at least one country, or choose Worldwide.</span>}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> How buyers pay you</h3>
            <p className="text-[11px] text-slate-500 -mt-1">Tick the ways you accept. Money goes straight to you. The app never asks for or keeps card numbers. Tick at least one to get a "Buy" button on your listings.</p>
            <div className="space-y-2">
              {(['card', 'paypal', 'bank'] as PayMethod[]).map(m => (
                <label key={m} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={payMethods.includes(m)} onChange={() => togglePay(m)} className="mt-0.5 rounded accent-indigo-600" />
                  <span><b>{PAY_LABELS[m]}</b><span className="block text-[11px] text-slate-500">
                    {m === 'card' ? 'Buyers pay with Visa or Mastercard on PayPal\'s page, no PayPal account needed. Needs your PayPal email. In PayPal, turn on "PayPal account optional" so buyers can pay by card.'
                      : m === 'paypal' ? 'Buyers pay from their PayPal account. Needs your PayPal email or PayPal.me link.'
                      : 'Buyers pay into your bank account. Your bank details are shown only to buyers after they place an order.'}
                  </span></span>
                </label>
              ))}
            </div>
            {(payMethods.includes('card') || payMethods.includes('paypal')) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>PayPal email{payMethods.includes('card') ? '' : ' (or use PayPal.me)'}</label>
                  <input type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="the email of your PayPal account" className={inputCls} maxLength={160} />
                </div>
                <div>
                  <label className={labelCls}>PayPal.me link (optional)</label>
                  <input value={paypalMe} onChange={e => setPaypalMe(e.target.value)} placeholder="paypal.me/yourshop" className={inputCls} maxLength={100} />
                </div>
              </div>
            )}
            {payMethods.includes('bank') && (
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                <p className="text-[11px] text-slate-500">Bank details for transfers. Kept private: only you, our admins, and buyers who placed an order with you can see them. Never type passwords or bank logins here.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ['accountName', 'Account name', 'Name on the account'],
                    ['bankName', 'Bank name', 'e.g. City Bank'],
                    ['accountNumber', 'Account number', ''],
                    ['branchCode', 'Branch / sort / routing code (optional)', ''],
                    ['iban', 'IBAN (optional)', ''],
                    ['swift', 'SWIFT / BIC (optional, for overseas buyers)', ''],
                  ] as [keyof BankDetails, string, string][]).map(([k, label, ph]) => (
                    <div key={k}>
                      <label className={labelCls}>{label}</label>
                      <input value={bank[k]} onChange={e => setBank({ ...bank, [k]: e.target.value })} placeholder={ph} className={inputCls} maxLength={k === 'accountName' || k === 'bankName' ? 120 : 60} autoComplete="off" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className={labelCls}>Note for buyers (optional)</label>
                  <input value={bank.extra} onChange={e => setBank({ ...bank, extra: e.target.value })} placeholder="e.g. Send proof of payment on WhatsApp" className={inputCls} maxLength={300} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">Shops and suppliers are on the Business plan ({BUSINESS_PLAN_PRICE}). You start on a trial; no payment is taken in the app. Our team will contact you about the plan. Selling just your own item? Choose Individual instead: it is free forever.</p>
          </div>
        </>
      )}

      <ErrorNote msg={err} />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={ghostBtn}>Cancel</button>}
        <button type="submit" disabled={busy || !!uploading} className={primary}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {isShop ? (existing?.isShop ? 'Save shop' : 'Register shop') : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

function MyListingRow({ listing, onEdit }: { listing: ListingDoc; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const statusChip =
    listing.status === 'active'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      : listing.status === 'pending'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
  const statusLabel = listing.status === 'active' ? 'Live' : listing.status === 'pending' ? 'Awaiting review' : 'Removed by moderator';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardCls} !rounded-2xl p-3 flex gap-3`}>
      <img src={listing.imageUrl || PLACEHOLDER_IMAGE} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-100" referrerPolicy="no-referrer" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{listing.title}</p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusChip}`}>{statusLabel}</span>
        </div>
        <p className="text-xs font-mono text-slate-500">{formatZar(listing.price, listing.currency)} · {listing.category}</p>
        {listing.status === 'removed' && listing.moderationReason && <p className="text-[11px] text-red-600 dark:text-red-400">Reason: {listing.moderationReason}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {listing.status !== 'removed' && (
            <>
              <button disabled={busy} onClick={onEdit} className={ghostBtn}>Edit</button>
              <button disabled={busy} onClick={() => run(() => setListingStock(listing.id, !listing.inStock))} className={ghostBtn}>
                {listing.inStock ? 'Mark sold out' : 'Mark in stock'}
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete "${listing.title}"? This can't be undone.`)) run(() => deleteListing(listing.id));
            }}
            className={`${ghostBtn} !text-red-600`}
          >
            <Trash2 className="w-3.5 h-3.5 inline" /> Delete
          </button>
        </div>
        <ErrorNote msg={err} />
      </div>
    </div>
  );
}

function ListingFormModal({
  uid,
  profile,
  isVerified,
  listing,
  onClose,
  primary,
}: {
  uid: string;
  profile: SellerProfile;
  isVerified: boolean;
  listing: ListingDoc | null;
  onClose: () => void;
  primary: string;
}) {
  const [title, setTitle] = useState(listing?.title || '');
  const [category, setCategory] = useState(listing?.category || (profile.isShop ? 'Spare Parts' : 'Test Equipment'));
  const [price, setPrice] = useState(listing ? String(listing.price) : '');
  const [condition, setCondition] = useState(listing?.condition || 'Tested Working');
  const [description, setDescription] = useState(listing?.description || '');
  const [inStock, setInStock] = useState(listing?.inStock ?? true);
  const [partNumbers, setPartNumbers] = useState((listing?.partNumbers || []).join(', '));
  const [fits, setFits] = useState((listing?.fits || []).join(', '));
  const [town, setTown] = useState(listing?.town || profile.location || '');
  const [currency, setCurrency] = useState(listing?.currency || profile.currency || currencyForCountry(profile.country || guessCountry()));
  const [image, setImage] = useState<{ url: string; path: string }>({ url: listing?.imageUrl || '', path: listing?.imagePath || '' });
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setUploadPct(0);
    try {
      const res = await uploadListingImage(uid, file, setUploadPct);
      setImage(res);
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setUploadPct(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price);
    if (!title.trim() || !Number.isFinite(p) || p < 0) {
      setErr('Add a title and a valid price.');
      return;
    }
    setBusy(true);
    setErr(null);
    const input: ListingInput = {
      title, category, price: p, condition, description, imageUrl: image.url, imagePath: image.path, inStock,
      partNumbers: splitList(partNumbers, 20, 60), fits: splitList(fits, 20, 80), town, currency,
    };
    try {
      if (listing) await updateListingContent(listing, { ...profile, uid }, input, isVerified);
      else await createListing({ ...profile, uid }, input, isVerified);
      onClose();
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="pr-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{listing ? 'Edit listing' : 'New listing'}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {isVerified ? 'As a verified company, your listing goes live straight away.' : 'Your listing will be reviewed by our team before it goes live.'}
          </p>
        </div>

        <div className="flex gap-4 items-start">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-dashed border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/30 shrink-0 flex items-center justify-center group">
            {image.url ? (
              <img src={image.url} alt="Listing photo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 flex flex-col items-center gap-1">
                <ImagePlus className="w-6 h-6" /> Add photo
              </span>
            )}
            {image.url && <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-1 opacity-0 group-hover:opacity-100 transition-opacity">Change</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="flex-1 space-y-2 text-[11px] text-slate-500">
            <p>JPG, PNG or WebP, up to 5 MB. A real photo of the actual item sells faster.</p>
            {uploadPct !== null && (
              <div className="space-y-1">
                <ProgressBar pct={uploadPct} />
                <span>Uploading… {uploadPct}%</span>
              </div>
            )}
            {image.url && uploadPct === null && (
              <button type="button" className="text-red-600 font-bold" onClick={() => setImage({ url: '', path: '' })}>Remove photo</button>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Title</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder={profile.isShop ? 'e.g. LG 42" T-con board 6870C-0442B (used, tested)' : 'e.g. Quick 861DW hot-air rework station, 1000 W'} className={inputCls} maxLength={140} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Part numbers / other names</label>
            <input value={partNumbers} onChange={e => setPartNumbers(e.target.value)} placeholder="e.g. 6870C-0442B, T-con, C12, 470uF 25V" className={inputCls} maxLength={800} />
            <p className="text-[10px] text-slate-400 mt-1">Separate with commas. Type every number printed on the part: this is how people (and the AI's "Where to buy") find it.</p>
          </div>
          <div>
            <label className={labelCls}>Fits brands / models</label>
            <input value={fits} onChange={e => setFits(e.target.value)} placeholder="e.g. LG 42LB5600, LG 42LN5400" className={inputCls} maxLength={1200} />
            <p className="text-[10px] text-slate-400 mt-1">Optional. Separate with commas.</p>
          </div>
        </div>
        {!profile.isShop && (
          <div>
            <label className={labelCls}>Town (optional)</label>
            <input value={town} onChange={e => setTown(e.target.value)} placeholder="e.g. Pietermaritzburg" className={inputCls} maxLength={80} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              {ALL_CATEGORIES.map(c => {
                const locked = BUSINESS_CATEGORIES.includes(c) && !isVerified;
                return (
                  <option key={c} value={c} disabled={locked}>
                    {c}{locked ? ' (verified companies only)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className={labelCls}>Price</label>
            <div className="flex gap-1.5">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={`${inputCls} !w-24 shrink-0`} aria-label="Currency">
                {[...new Set([currency, ...CURRENCIES])].filter(Boolean).map(c => <option key={c}>{c}</option>)}
              </select>
              <input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Condition</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Specs, what's included, any faults, collection or courier options…" className={inputCls} maxLength={4000} />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} className="rounded accent-indigo-600" /> In stock
        </label>
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy || uploadPct !== null} className={primary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {listing ? 'Save changes' : isVerified ? 'Publish listing' : 'Submit for review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Business plan status (USD $20 / month for shops; set by admins, no payments in the app)
// ---------------------------------------------------------------------------

function BusinessPlanCard({ profile }: { profile: SellerProfile }) {
  const plan = shopPlan(profile);
  const tone = plan === 'active' ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20' : plan === 'expired' ? 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20' : 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20';
  return (
    <div className={`rounded-2xl border p-4 text-xs space-y-1 ${tone}`}>
      <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"><Store className="w-4 h-4" /> Business plan: {PLAN_LABELS[plan]} <span className="font-normal text-slate-500">({BUSINESS_PLAN_PRICE})</span></p>
      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
        {plan === 'active' ? 'Your shop is fully listed, including "Where to buy" under AI answers, circuit maps and guides.'
          : plan === 'expired' ? 'Your plan has expired, so your shop no longer appears in "Where to buy". Your listings stay in the Marketplace. Email support to renew.'
          : 'You are on a trial with every Business feature. No payment is taken in the app: our team will contact you about the plan.'}
      </p>
      {profile.planNote && <p className="text-slate-500">Note from our team: {profile.planNote}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verified Shop badge (business registration number + phone + shopfront photo)
// ---------------------------------------------------------------------------

function ShopVerificationPanel({
  profile,
  verification,
  loading,
  defaultEmail,
  isVerified,
  primary,
}: {
  profile: SellerProfile;
  verification: SellerVerification | null;
  loading: boolean;
  defaultEmail: string;
  isVerified: boolean;
  primary: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (loading) return null;
  const status = verification?.status;
  const checks = [
    { ok: (profile.registrationNumber || '').trim().length >= 4, label: 'Business registration number' },
    { ok: !!toE164(profile.phone || ''), label: 'Shop phone number (with country code)' },
    { ok: !!profile.shopfrontUrl, label: 'Shopfront photo' },
  ];
  const ready = checks.every(c => c.ok);
  const apply = async () => {
    setBusy(true); setErr(null);
    try { await submitShopVerification(profile, defaultEmail, verification); }
    catch (ex) { setErr(friendlyError(ex)); }
    finally { setBusy(false); }
  };
  return (
    <div className={`${cardCls} p-5 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-emerald-600" /> Verified Shop badge</h3>
          <p className="text-xs text-slate-500 max-w-xl">Verified shops show first in searches and in the AI's "Where to buy", and their listings go live straight away. Our team checks your business registration number on your country's official company register, phones your shop number and looks at your shopfront photo.</p>
        </div>
        {status && <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[status]}`}>{isVerified ? 'Verified' : STATUS_LABELS[status]}</span>}
      </div>
      {isVerified || status === 'approved' ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Your shop is verified.</p>
      ) : status === 'submitted' || status === 'under_review' ? (
        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Thanks. Our team will check your details and may phone the shop. You will see the badge here when approved.</p>
      ) : (
        <>
          {(status === 'rejected' || status === 'revoked') && verification?.rejectionReason && (
            <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-xl p-3">Reason: {verification.rejectionReason}. Fix it in your shop details, then apply again.</p>
          )}
          <ul className="space-y-1">
            {checks.map(c => (
              <li key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>
                {c.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-slate-300" />} {c.label}{!c.ok && ' (add it with Edit shop)'}
              </li>
            ))}
          </ul>
          <ErrorNote msg={err} />
          <button type="button" disabled={!ready || busy} onClick={apply} className={primary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Apply for the Verified badge
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company verification
// ---------------------------------------------------------------------------

function emptyFields(defaultEmail: string, defaultCompany: string): VerificationFields {
  return {
    companyName: defaultCompany,
    registrationNumber: '',
    vatNumber: '',
    country: countryName(guessCountry()),
    address: '',
    contactName: '',
    contactEmail: defaultEmail,
    contactPhone: '',
    documents: {},
  };
}

function fieldsFrom(v: SellerVerification): VerificationFields {
  return {
    companyName: v.companyName || '',
    registrationNumber: v.registrationNumber || '',
    vatNumber: v.vatNumber || '',
    country: v.country || '',
    address: v.address || '',
    contactName: v.contactName || '',
    contactEmail: v.contactEmail || '',
    contactPhone: v.contactPhone || '',
    documents: v.documents || {},
  };
}

function VerificationPanel({
  uid,
  verification,
  loading,
  defaultEmail,
  defaultCompany,
  primary,
}: {
  uid: string;
  verification: SellerVerification | null;
  loading: boolean;
  defaultEmail: string;
  defaultCompany: string;
  primary: string;
}) {
  const [fields, setFields] = useState<VerificationFields>(() => (verification ? fieldsFrom(verification) : emptyFields(defaultEmail, defaultCompany)));
  const [dirty, setDirty] = useState(false);
  const [uploads, setUploads] = useState<Record<string, { pct: number | null; error?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const syncKey = verification ? `${verification.status}:${verification.updatedAt?.toMillis?.() ?? ''}` : 'none';
  useEffect(() => {
    if (dirty) return;
    setFields(verification ? fieldsFrom(verification) : emptyFields(defaultEmail, defaultCompany));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading verification…</div>;
  }

  const status: VerificationStatus | null = verification?.status ?? null;
  const locked = status === 'approved' || status === 'under_review';
  const canResubmit = status === 'rejected' || status === 'revoked';
  const missing = missingRequiredDocs(fields.documents);
  const anyUploading = Object.values(uploads).some(u => u.pct !== null);

  const set = (k: keyof Omit<VerificationFields, 'documents'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFields(f => ({ ...f, [k]: e.target.value }));
    setDirty(true);
  };

  const onFile = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploads(u => ({ ...u, [key]: { pct: 0 } }));
    try {
      const stored: StoredDoc = await uploadSellerDoc(uid, key, file, pct => setUploads(u => ({ ...u, [key]: { pct } })));
      setFields(f => ({ ...f, documents: { ...f.documents, [key]: stored } }));
      setDirty(true);
      setUploads(u => ({ ...u, [key]: { pct: null } }));
    } catch (ex) {
      setUploads(u => ({ ...u, [key]: { pct: null, error: friendlyError(ex) } }));
    }
  };

  const openDoc = async (d: StoredDoc) => {
    try {
      const url = await getSellerDocUrl(d.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (ex) {
      setErr(friendlyError(ex));
    }
  };

  const save = async (submit: boolean) => {
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      await saveVerification(uid, fields, submit, verification);
      setDirty(false);
      setNotice(submit ? 'Application submitted. The result will show here once a reviewer has checked it.' : 'Draft saved.');
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  const StatusIcon = status === 'approved' ? BadgeCheck : status === 'rejected' || status === 'revoked' ? XCircle : status ? Clock : FileText;

  return (
    <div className={`${cardCls} p-6 sm:p-8 space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Company verification
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Upload your company documents for a manual check. Approved companies get the Verified badge, list without waiting for review, and can use the business-only categories.
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${status ? STATUS_STYLE[status] : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          <StatusIcon className="w-3.5 h-3.5" /> {status ? STATUS_LABELS[status] : 'Not started'}
        </span>
      </div>

      {(status === 'rejected' || status === 'revoked') && verification?.rejectionReason && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-800 dark:text-red-300 space-y-1">
          <p className="font-bold">{status === 'revoked' ? 'Your Verified badge was revoked' : 'Your application was not approved'}</p>
          <p className="leading-relaxed">Reason: {verification.rejectionReason}</p>
          <p>Fix the issue below, upload new documents if needed, and resubmit.</p>
        </div>
      )}
      {status === 'under_review' && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
          A reviewer is checking your documents now. The form is locked until they finish.
        </div>
      )}
      {status === 'approved' && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-200">
          Approved{verification?.approvedAt ? ` on ${formatTs(verification.approvedAt)}` : ''}. Your listings show the Verified badge.
        </div>
      )}
      {status === 'submitted' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300">
          Submitted{verification?.submittedAt ? ` on ${formatTs(verification.submittedAt)}` : ''}. You can still correct details and resubmit until a reviewer picks it up.
        </div>
      )}

      <fieldset disabled={locked} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Registered company name</label>
            <input value={fields.companyName} onChange={set('companyName')} placeholder="e.g. Bright Electronics Ltd" className={inputCls} maxLength={160} />
          </div>
          <div>
            <label className={labelCls}>Business registration number</label>
            <input value={fields.registrationNumber} onChange={set('registrationNumber')} placeholder={REGISTRATION_HINT} className={inputCls} maxLength={60} />
          </div>
          <div>
            <label className={labelCls}>VAT number (if registered)</label>
            <input value={fields.vatNumber} onChange={set('vatNumber')} placeholder="e.g. 4123456789" className={inputCls} maxLength={40} />
          </div>
          <div>
            <label className={labelCls}>Country of registration</label>
            <select value={fields.country} onChange={set('country')} className={inputCls}>
              <option value="">Choose a country</option>
              {[...new Set([fields.country, ...COUNTRIES.map(c => c.name)])].filter(Boolean).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Registered business address</label>
          <textarea rows={2} value={fields.address} onChange={set('address')} placeholder="Street, town, postcode, country" className={inputCls} maxLength={400} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Contact person</label>
            <input value={fields.contactName} onChange={set('contactName')} placeholder="e.g. Nomsa Dlamini" className={inputCls} maxLength={120} />
          </div>
          <div>
            <label className={labelCls}>Contact email</label>
            <input type="email" value={fields.contactEmail} onChange={set('contactEmail')} placeholder="accounts@company.com" className={inputCls} maxLength={160} />
          </div>
          <div>
            <label className={labelCls}>Contact phone</label>
            <input type="tel" value={fields.contactPhone} onChange={set('contactPhone')} placeholder="+27 82 123 4567" className={inputCls} maxLength={40} />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Documents · PDF, JPG or PNG, up to 10 MB each</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {VERIFICATION_DOC_TYPES.map(d => {
              const stored = fields.documents[d.key];
              const up = uploads[d.key];
              return (
                <div key={d.key} className={`p-3 rounded-2xl border ${stored ? 'border-emerald-300/70 dark:border-emerald-700/50 bg-emerald-50/40 dark:bg-emerald-950/15' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {d.label} {d.required ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500">{d.hint}</p>
                    </div>
                    {stored && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  {stored && (
                    <button type="button" onClick={() => openDoc(stored)} className="mt-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1 max-w-full">
                      <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{stored.name}</span> <ExternalLink className="w-3 h-3 shrink-0" />
                    </button>
                  )}
                  {up?.pct != null && (
                    <div className="mt-2 space-y-1">
                      <ProgressBar pct={up.pct} />
                      <span className="text-[10px] text-slate-500">Uploading… {up.pct}%</span>
                    </div>
                  )}
                  {up?.error && <p className="mt-1 text-[11px] text-red-600">{up.error}</p>}
                  {!locked && (
                    <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:border-indigo-400">
                      <Upload className="w-3.5 h-3.5" /> {stored ? 'Replace' : 'Upload'}
                      <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { onFile(d.key, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {!locked && missing.length > 0 && (
            <p className="text-[11px] text-slate-500">Still needed to submit: {missing.map(m => m.label).join(', ')}.</p>
          )}
        </div>
      </fieldset>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Your documents are stored privately and only visible to you and the DIY Electronics review team. Submitting false documents leads to a permanent ban.
      </p>

      <ErrorNote msg={err} />
      {notice && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-300">{notice}</p>}
      {dirty && !locked && <p className="text-[11px] text-amber-600">You have unsaved changes.</p>}

      {!locked && (
        <div className="flex flex-wrap justify-end gap-2">
          {status !== 'submitted' && (
            <button type="button" disabled={busy || anyUploading} onClick={() => save(false)} className={ghostBtn}>Save draft</button>
          )}
          <button type="button" disabled={busy || anyUploading || missing.length > 0 || REQUIRED_DOC_KEYS.length === 0} onClick={() => save(true)} className={primary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {canResubmit ? 'Resubmit for review' : status === 'submitted' ? 'Update submission' : 'Submit for review'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests tab
// ---------------------------------------------------------------------------

function RequestsPanel({ uid, myName, reviews, primary }: { uid: string; myName: string; reviews: Review[]; primary: string }) {
  const [incoming, setIncoming] = useState<PurchaseRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PurchaseRequest[]>([]);
  const [reviewFor, setReviewFor] = useState<PurchaseRequest | null>(null);
  useEffect(() => subscribeRequests(uid, 'seller', setIncoming), [uid]);
  useEffect(() => subscribeRequests(uid, 'buyer', setOutgoing), [uid]);
  const reviewed = useMemo(() => new Set(reviews.map(r => r.id)), [reviews]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Requests on my listings ({incoming.length})</h3>
        {incoming.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests yet" body="When a buyer taps Request to buy on one of your listings, it shows up here." />
        ) : (
          incoming.map(r => <IncomingRequest key={r.id} req={r} primary={primary} />)
        )}
      </section>
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">My requests ({outgoing.length})</h3>
        {outgoing.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="You haven't requested anything" body="Find an item in Browse and tap Request to buy to message the seller." />
        ) : (
          outgoing.map(r => (
            <div key={r.id} className={`${cardCls} !rounded-2xl p-4 space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{r.listingTitle}</p>
                  <p className="text-xs font-mono text-slate-500">{formatZar(r.price, r.currency)} · {formatTs(r.createdAt)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0 ${REQUEST_STYLE[r.status]}`}>{r.status}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">You: {r.message}</p>
              {r.sellerReply && <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-2">Seller: {r.sellerReply}</p>}
              <div className="flex flex-wrap gap-2">
                {(r.status === 'pending' || r.status === 'accepted') && (
                  <button className={ghostBtn} onClick={() => cancelRequest(r.id).catch(() => {})}>Cancel request</button>
                )}
                {(r.status === 'accepted' || r.status === 'completed') &&
                  (reviewed.has(r.id) ? (
                    <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Reviewed</span>
                  ) : (
                    <button className={primary} onClick={() => setReviewFor(r)}><Star className="w-3.5 h-3.5" /> Review seller</button>
                  ))}
              </div>
            </div>
          ))
        )}
      </section>
      {reviewFor && <ReviewModal req={reviewFor} myName={myName} onClose={() => setReviewFor(null)} primary={primary} />}
    </div>
  );
}

function IncomingRequest({ req, primary }: { req: PurchaseRequest; primary: string }) {
  const [reply, setReply] = useState(req.sellerReply || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const respond = async (status: PurchaseStatus) => {
    setBusy(true);
    setErr(null);
    try {
      await respondToRequest(req.id, status, reply);
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };
  const open = req.status === 'pending' || req.status === 'accepted';
  return (
    <div className={`${cardCls} !rounded-2xl p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{req.listingTitle}</p>
          <p className="text-xs text-slate-500">{req.buyerName} · {formatTs(req.createdAt)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0 ${REQUEST_STYLE[req.status]}`}>{req.status}</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{req.message}</p>
      <p className="text-[11px] text-slate-500">Contact: <span className="font-bold text-slate-700 dark:text-slate-200 select-all">{req.buyerContact}</span></p>
      {open && (
        <>
          <textarea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to the buyer (optional), e.g. collection times or courier cost" className={inputCls} maxLength={2000} />
          <div className="flex flex-wrap gap-2">
            {req.status === 'pending' && <button disabled={busy} className={primary} onClick={() => respond('accepted')}>Accept</button>}
            {req.status === 'accepted' && <button disabled={busy} className={primary} onClick={() => respond('completed')}>Mark sold</button>}
            <button disabled={busy} className={ghostBtn} onClick={() => respond('declined')}>Decline</button>
          </div>
        </>
      )}
      {!open && req.sellerReply && <p className="text-xs text-indigo-700 dark:text-indigo-300">Your reply: {req.sellerReply}</p>}
      <ErrorNote msg={err} />
    </div>
  );
}

function ReviewModal({ req, myName, onClose, primary }: { req: PurchaseRequest; myName: string; onClose: () => void; primary: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createReview(req, myName, rating, comment);
      onClose();
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="pr-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Review this seller</h2>
          <p className="text-xs text-slate-500 mt-1">{req.listingTitle}</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i} star${i > 1 ? 's' : ''}`}>
              <Star className={`w-7 h-7 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
            </button>
          ))}
        </div>
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="How did it go? Item as described, communication, delivery…" className={inputCls} maxLength={1000} />
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy} className={primary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Post review</button>
        </div>
      </form>
    </Modal>
  );
}
