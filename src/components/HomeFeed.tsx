import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Image as ImageIcon, HelpCircle, Sparkles, X, Tag, Loader2, Cloud, HardDrive, LogIn } from 'lucide-react';
import type { ForumPost, UserProfile } from '../types';
import type { ThemeConfig } from '../lib/theme';
import { useCommunity, compressImage, type CommunityPost } from '../lib/community';
import { useMarketplaceListings, requestListingFocus, type ListingItem } from '../lib/marketplaceListings';
import { isSignedIn } from '../lib/signInGate';
import MarketplaceStories from './home/MarketplaceStories';
import CommunityPostCard from './home/CommunityPostCard';
import { RouteLink } from '../hooks/usePathname';
import { Search as SearchIcon, Smartphone, GraduationCap, ShoppingBag, Activity, Gauge, ArrowRight } from 'lucide-react';

const QUICK_LINKS = [
  { to: '/search', label: 'Search everything', sub: 'Devices, part numbers, guides, answers', icon: SearchIcon },
  { to: '/devices', label: 'Find your device', sub: 'Guides and fixes by brand and model', icon: Smartphone },
  { to: '/diagnostic', label: 'AI diagnostic', sub: 'Describe the fault, get a test plan', icon: Activity },
  { to: '/marketplace', label: 'Marketplace', sub: 'Parts and tools from local sellers', icon: ShoppingBag },
  { to: '/theory', label: 'Theory & courses', sub: 'School, TVET N1–N6, university', icon: GraduationCap },
  { to: '/multimeter', label: 'Multimeter lab', sub: 'Practise testing components', icon: Gauge },
];

/** Right-hand rail on wide screens: quick ways into the rest of the app. */
function HomeRail() {
  return (
    <aside className="hidden xl:block sticky top-[4.75rem] space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs">
        <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-slate-400">Jump in</div>
        {QUICK_LINKS.map(l => {
          const Icon = l.icon;
          return (
            <RouteLink key={l.to} to={l.to} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:text-cobalt-600 dark:group-hover:text-cobalt-400"><Icon className="w-4 h-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{l.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{l.sub}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </RouteLink>
          );
        })}
      </div>
    </aside>
  );
}

const CATEGORIES = ['Smartphones', 'Laptops & PCs', 'Gaming Consoles', 'TVs & Monitors', 'Audio & Headphones', 'Tablets', 'Home Appliances', 'Other'];
const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Google', 'Sony', 'Nintendo', 'Microsoft', 'LG', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'JBL', 'Bose', 'Hisense', 'Defy'];

type FeedFilter = 'all' | 'open' | 'solved' | 'mine';

export default function HomeFeed({
  posts,
  currentUser,
  themeConfig,
  onOpenAuth,
  onSelectMarketplace
}: {
  /** Seeded/starter posts (shown below community posts). */
  posts: ForumPost[];
  currentUser: UserProfile;
  /** Legacy props kept for API compatibility; the Home feed now manages its own persistence. */
  onAddPost?: (post: ForumPost) => void;
  onAddReply?: (postId: string, content: string) => void;
  onToggleLike?: (postId: string) => void;
  themeConfig?: ThemeConfig;
  /** Opens the existing AuthModal. */
  onOpenAuth?: () => void;
  /** Switches to the Marketplace view with a search query (App's handleSelectMarketplace). */
  onSelectMarketplace?: (query: string) => void;
}) {
  const api = useCommunity(posts, currentUser);
  const listings = useMarketplaceListings();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const promptSignIn = (msg = 'Sign in to post, like and comment') => {
    showToast(msg);
    onOpenAuth?.();
  };

  /** Gate for any write action. */
  const requireAuth = (post?: CommunityPost) => {
    if (!api.signedIn || !isSignedIn()) {
      promptSignIn();
      return false;
    }
    if (post?.source === 'firestore' && !api.canWriteRemote) {
      showToast('Sign in with your DIY Electronics account to join cloud threads');
      onOpenAuth?.();
      return false;
    }
    return true;
  };

  const openCreate = () => {
    if (!requireAuth()) return;
    setIsCreateOpen(true);
  };

  const handleViewItem = (item: ListingItem) => {
    requestListingFocus(item.id);
    onSelectMarketplace?.(item.title);
  };

  const visible = api.posts.filter(p => {
    if (filter === 'open') return !p.isSolved;
    if (filter === 'solved') return p.isSolved;
    if (filter === 'mine') return api.isMine(p.authorUid);
    return true;
  });

  const firstName = currentUser.name?.split(' ')[0] || 'there';

  return (
    <div className="ds-page grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
    <div className="space-y-5 min-w-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Community</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Ask for help with a repair, share a fix, and see what is new in the marketplace.</p>
      </div>
      {/* Marketplace Stories */}
      <MarketplaceStories listings={listings} onViewItem={handleViewItem} onOpenMarketplace={onSelectMarketplace ? () => onSelectMarketplace('') : undefined} />

      {/* Composer */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm shadow-slate-200/50 dark:shadow-none space-y-3">
        <div className="flex items-center gap-3">
          <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-900/50" referrerPolicy="no-referrer" />
          <button
            onClick={openCreate}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/70 transition-colors text-sm"
          >
            {api.signedIn ? `Stuck on a repair, ${firstName}? Ask the community…` : 'Sign in to ask the community for help…'}
          </button>
        </div>
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1 text-center">
          <button onClick={openCreate} className="flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            Photo
          </button>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
            <Tag className="w-4 h-4 text-violet-500" />
            Tag device
          </button>
          <button onClick={openCreate} className="flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            Ask help
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ['all', 'All'],
              ['open', 'Needs help'],
              ['solved', 'Solved'],
              ['mine', 'My posts']
            ] as [FeedFilter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                filter === id
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span
          title={api.backend === 'firestore' ? 'Synced live with the cloud' : 'Saved on this device'}
          className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 shrink-0"
        >
          {api.backend === 'firestore' ? <Cloud className="w-3.5 h-3.5 text-emerald-500" /> : <HardDrive className="w-3.5 h-3.5" />}
          {api.backend === 'firestore' ? 'Live' : 'On this device'}
        </span>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {visible.map(post => (
            <CommunityPostCard key={post.id} post={post} api={api} currentUser={currentUser} requireAuth={requireAuth} onToast={showToast} />
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <div className="text-center py-10 px-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500">
            {filter === 'mine' ? "You haven't posted yet." : 'Nothing here yet.'}{' '}
            <button onClick={openCreate} className="text-indigo-600 dark:text-indigo-400 font-bold">Start a thread</button>
          </div>
        )}
      </div>
    </div>

      <HomeRail />

      <AnimatePresence>
        {isCreateOpen && (
          <CreatePostModal
            currentUser={currentUser}
            themeConfig={themeConfig}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={async input => {
              await api.createPost(input);
              setIsCreateOpen(false);
              setFilter('all');
              showToast('Posted — the community will chime in soon');
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[80] w-max max-w-[90vw] px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xl flex items-center gap-2"
            role="status"
          >
            {!api.signedIn && <LogIn className="w-3.5 h-3.5" />}
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreatePostModal({
  currentUser,
  themeConfig,
  onClose,
  onSubmit
}: {
  currentUser: UserProfile;
  themeConfig?: ThemeConfig;
  onClose: () => void;
  onSubmit: (input: { title: string; content: string; imageUrl: string | null; deviceCategory: string; brand: string; deviceModel: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Smartphones');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      setImage(await compressImage(file));
    } catch {
      setError('Could not read that image.');
    } finally {
      setProcessing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), imageUrl: image, deviceCategory: category, brand: brand.trim(), deviceModel: model.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" /> Ask the community
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
            <p className="text-[11px] text-slate-400">Posting to the Home feed</p>
          </div>
        </div>

        <div>
          <label className={label}>Title</label>
          <input required autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Galaxy S21 boot-loops after screen swap" className={field} />
        </div>

        <div>
          <label className={label}>What's going on?</label>
          <textarea required rows={4} value={content} onChange={e => setContent(e.target.value)} maxLength={5000} placeholder="Symptoms, what you've measured, what you've tried…" className={field} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Device type</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={field}>
              {CATEGORIES.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Brand</label>
            <input list="community-brands" value={brand} onChange={e => setBrand(e.target.value)} maxLength={40} placeholder="e.g. Samsung" className={field} />
            <datalist id="community-brands">
              {BRANDS.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label}>Model / IC</label>
            <input value={model} onChange={e => setModel(e.target.value)} maxLength={60} placeholder="e.g. SM-G991B" className={field} />
          </div>
        </div>

        {/* Photo */}
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          {image ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <img src={image} alt="Attachment preview" className="w-full max-h-64 object-cover" />
              <button type="button" onClick={() => setImage(null)} aria-label="Remove photo" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-xs font-semibold text-slate-500 flex items-center justify-center gap-2 transition-colors"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-emerald-500" />}
              {processing ? 'Preparing photo…' : 'Add a photo (optional)'}
            </button>
          )}
          {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || processing || !title.trim() || !content.trim()}
            className={`px-5 py-2.5 rounded-xl ${themeConfig?.primaryBg || 'bg-indigo-600'} ${themeConfig?.primaryText || 'text-white'} text-sm font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Post
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
