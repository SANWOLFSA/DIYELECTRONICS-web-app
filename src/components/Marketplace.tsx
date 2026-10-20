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

  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState(initialSearchQuery);
  const [category, setCategory] = useState('All');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const [buyItem, setBuyItem] = useState<ListingItem | null>(null);
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

  const filtered = listings.filter(item => {
    if (category !== 'All' && item.category !== category) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.seller.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'browse', label: 'Browse', icon: ShoppingBag },
    { id: 'sell', label: 'Sell', icon: Package },
    { id: 'requests', label: 'Requests', icon: Inbox },
  ];

  return (
    <div className="ds-page space-y-6">
      {/* Hero */}
      <div className={`${cardCls} p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden relative`}>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gradient-to-br from-indigo-400/20 via-violet-400/10 to-emerald-300/20 blur-2xl pointer-events-none" />
        <div className="space-y-2 max-w-2xl relative">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${themeConfig?.headerBadgeBg || 'bg-emerald-50 dark:bg-emerald-400/10'} ${themeConfig?.headerBadgeText || 'text-emerald-700 dark:text-emerald-300'} ${themeConfig?.headerBadgeBorder || 'border-emerald-200 dark:border-emerald-400/30'}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Repair-tech marketplace · South Africa · ZAR</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Tools, test gear & parts from fellow techs</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Buy and sell bench equipment, consumables and donor boards. Companies earn the <span className="font-bold text-emerald-600 dark:text-emerald-300">Verified</span> badge only after our team checks their CIPC registration, SARS documents and proof of address.
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 relative self-start md:self-auto">
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
                placeholder="Search oscilloscope, hot-air station, flux, donor board…"
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
          </div>

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
            <EmptyState icon={Search} title="Nothing matches" body="Try a different search or category." action={<button className={ghostBtn} onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</button>} />
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
                          <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-50">{formatZar(item.price)}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{item.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{item.description}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between gap-3">
                        <button onClick={() => setProfileUid(item.seller.uid)} className="text-left min-w-0 group">
                          <span className="text-[10px] text-slate-400 block">Seller</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate block">{item.seller.name}</span>
                          <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <SellerBadge verified={item.seller.isVerifiedCompany} type={item.seller.type} />
                            {item.seller.reviewCount > 0 && (
                              <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {item.seller.rating.toFixed(1)} ({item.seller.reviewCount})
                              </span>
                            )}
                          </span>
                        </button>
                        {mine ? (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold shrink-0">Your listing</span>
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
            No payments go through the app. "Request to buy" sends your message to the seller; agree on payment and collection or courier directly. Never pay before seeing proof of the item.
          </p>
        </div>
      )}

      {tab === 'sell' &&
        (user ? (
          <SellPanel uid={user.uid} defaultName={displayNameOf(user)} defaultEmail={user.email || ''} verifiedSellers={verifiedSellers} primary={primary} />
        ) : (
          <SignInPrompt what="sell on the marketplace" onOpenAuth={onOpenAuth} primary={primary} />
        ))}

      {tab === 'requests' &&
        (user ? (
          <RequestsPanel uid={user.uid} myName={displayNameOf(user)} reviews={reviews} primary={primary} />
        ) : (
          <SignInPrompt what="see your buy requests" onOpenAuth={onOpenAuth} primary={primary} />
        ))}

      {buyItem && user && (
        <BuyModal item={buyItem} buyer={{ uid: user.uid, name: displayNameOf(user), email: user.email || '' }} onClose={() => setBuyItem(null)} onDone={() => { setBuyItem(null); setTab('requests'); }} primary={primary} />
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
  const [message, setMessage] = useState(`Hi, is the "${item.title}" still available? I'm keen at ${formatZar(item.price)}.`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || !message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createPurchaseRequest({ id: item.id, title: item.title, price: item.price, sellerUid: item.seller.uid }, { uid: buyer.uid, name: buyer.name }, contact, message);
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
              {item.title} · <span className="font-bold">{formatZar(item.price)}</span> from {item.seller.name}
            </p>
          </div>
          <div>
            <label className={labelCls}>How should the seller reach you?</label>
            <input required value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. 082 123 4567 or you@example.co.za" className={inputCls} maxLength={200} />
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {type === 'company' ? <Building2 className="w-6 h-6" /> : name.slice(0, 1).toUpperCase()}
          </div>
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
        {verified && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3">
            This company's registration, tax and address documents were checked and approved by the DIY Electronics team.
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
                    <p className="text-[11px] font-mono text-slate-500">{formatZar(l.price)}</p>
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

// ---------------------------------------------------------------------------
// Sell tab
// ---------------------------------------------------------------------------

function SellPanel({
  uid,
  defaultName,
  defaultEmail,
  verifiedSellers,
  primary,
}: {
  uid: string;
  defaultName: string;
  defaultEmail: string;
  verifiedSellers: Map<string, unknown>;
  primary: string;
}) {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [verification, setVerification] = useState<SellerVerification | null | undefined>(undefined);
  const [myListings, setMyListings] = useState<ListingDoc[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [listingModal, setListingModal] = useState<{ listing: ListingDoc | null } | null>(null);

  useEffect(() => subscribeSellerProfile(uid, setProfile), [uid]);
  useEffect(() => subscribeMyVerification(uid, setVerification), [uid]);
  useEffect(() => subscribeMyListings(uid, setMyListings), [uid]);

  const isVerified = verifiedSellers.has(uid);

  if (profile === undefined) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your seller account…
      </div>
    );
  }

  if (!profile || editingProfile) {
    return (
      <SellerProfileForm
        uid={uid}
        existing={profile}
        defaultName={defaultName}
        primary={primary}
        onDone={() => setEditingProfile(false)}
        onCancel={profile ? () => setEditingProfile(false) : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center shrink-0">
            {profile.sellerType === 'company' ? <Building2 className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{profile.displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-500">{profile.sellerType === 'company' ? 'Company seller' : 'Individual seller'}</span>
              <SellerBadge verified={isVerified} type={profile.sellerType} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={ghostBtn} onClick={() => setEditingProfile(true)}>
            <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit profile
          </button>
          <button className={primary} onClick={() => setListingModal({ listing: null })}>
            <Plus className="w-4 h-4" /> New listing
          </button>
        </div>
      </div>

      {profile.sellerType === 'company' ? (
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
          <EmptyState icon={Package} title="No listings yet" body="List a tool, test instrument or donor board. Add a clear photo and an honest condition." action={<button className={primary} onClick={() => setListingModal({ listing: null })}><Plus className="w-4 h-4" /> New listing</button>} />
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
  primary,
  onDone,
  onCancel,
}: {
  uid: string;
  existing: SellerProfile | null;
  defaultName: string;
  primary: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [sellerType, setSellerType] = useState<SellerType>(existing?.sellerType || 'individual');
  const [displayName, setDisplayName] = useState(existing?.displayName || defaultName);
  const [location, setLocation] = useState(existing?.location || '');
  const [bio, setBio] = useState(existing?.bio || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await saveSellerProfile(uid, { displayName, sellerType, location, bio }, !!existing);
      onDone();
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  const choice = (type: SellerType, title: string, body: string, Icon: any) => (
    <button
      type="button"
      onClick={() => setSellerType(type)}
      className={`text-left p-4 rounded-2xl border-2 transition-all ${
        sellerType === type
          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm shadow-indigo-500/10'
          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${sellerType === type ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</span>
        {sellerType === type && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{body}</p>
    </button>
  );

  return (
    <form onSubmit={submit} className={`${cardCls} p-6 sm:p-8 space-y-5 max-w-3xl`}>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{existing ? 'Edit seller profile' : 'Set up your seller profile'}</h2>
        <p className="text-xs text-slate-500 mt-1">Choose how you sell. You can change this later.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {choice('individual', 'Individual', 'Selling your own tools or spares. No documents needed; listings are reviewed before going live.', UserIcon)}
        {choice('company', 'Company', 'A registered business. Submit CIPC, SARS and address documents to earn the Verified badge and list instantly.', Building2)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{sellerType === 'company' ? 'Trading name' : 'Display name'}</label>
          <input required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={sellerType === 'company' ? 'e.g. Khanyisa Electronics' : 'e.g. Thabo M.'} className={inputCls} maxLength={80} />
        </div>
        <div>
          <label className={labelCls}>Location (optional)</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Durban, KZN" className={inputCls} maxLength={80} />
        </div>
      </div>
      <div>
        <label className={labelCls}>About (optional)</label>
        <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="What you repair or stock, collection areas, courier options…" className={inputCls} maxLength={600} />
      </div>
      <ErrorNote msg={err} />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={ghostBtn}>Cancel</button>}
        <button type="submit" disabled={busy} className={primary}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save profile
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
        <p className="text-xs font-mono text-slate-500">{formatZar(listing.price)} · {listing.category}</p>
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
  const [category, setCategory] = useState(listing?.category || 'Test Equipment');
  const [price, setPrice] = useState(listing ? String(listing.price) : '');
  const [condition, setCondition] = useState(listing?.condition || 'Tested Working');
  const [description, setDescription] = useState(listing?.description || '');
  const [inStock, setInStock] = useState(listing?.inStock ?? true);
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
      setErr('Add a title and a valid price in rand.');
      return;
    }
    setBusy(true);
    setErr(null);
    const input: ListingInput = { title, category, price: p, condition, description, imageUrl: image.url, imagePath: image.path, inStock };
    try {
      if (listing) await updateListingContent(listing, profile, input, isVerified);
      else await createListing({ uid, displayName: profile.displayName, sellerType: profile.sellerType }, input, isVerified);
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
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Quick 861DW hot-air rework station, 1000 W" className={inputCls} maxLength={140} />
        </div>
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
            <label className={labelCls}>Price (ZAR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">R</span>
              <input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="1 850.00" className={`${inputCls} pl-7`} />
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
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Specs, what's included, any faults, collection in Johannesburg or courier via PAXI / The Courier Guy…" className={inputCls} maxLength={4000} />
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
// Company verification
// ---------------------------------------------------------------------------

function emptyFields(defaultEmail: string, defaultCompany: string): VerificationFields {
  return {
    companyName: defaultCompany,
    registrationNumber: '',
    vatNumber: '',
    country: 'South Africa',
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
    country: v.country || 'South Africa',
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
            <input value={fields.companyName} onChange={set('companyName')} placeholder="e.g. Khanyisa Electronics (Pty) Ltd" className={inputCls} maxLength={160} />
          </div>
          <div>
            <label className={labelCls}>CIPC registration number</label>
            <input value={fields.registrationNumber} onChange={set('registrationNumber')} placeholder="e.g. 2019/123456/07" className={inputCls} maxLength={60} />
          </div>
          <div>
            <label className={labelCls}>VAT number (if registered)</label>
            <input value={fields.vatNumber} onChange={set('vatNumber')} placeholder="e.g. 4123456789" className={inputCls} maxLength={40} />
          </div>
          <div>
            <label className={labelCls}>Country of registration</label>
            <select value={fields.country} onChange={set('country')} className={inputCls}>
              {['South Africa', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Zimbabwe', 'Mozambique', 'Other'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Registered business address</label>
          <textarea rows={2} value={fields.address} onChange={set('address')} placeholder="e.g. Unit 4, 12 Loop Street, Cape Town City Centre, 8001" className={inputCls} maxLength={400} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Contact person</label>
            <input value={fields.contactName} onChange={set('contactName')} placeholder="e.g. Nomsa Dlamini" className={inputCls} maxLength={120} />
          </div>
          <div>
            <label className={labelCls}>Contact email</label>
            <input type="email" value={fields.contactEmail} onChange={set('contactEmail')} placeholder="accounts@company.co.za" className={inputCls} maxLength={160} />
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
                  <p className="text-xs font-mono text-slate-500">{formatZar(r.price)} · {formatTs(r.createdAt)}</p>
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
