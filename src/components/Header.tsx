import { useState, useEffect, useCallback, useRef } from 'react';
import { Wrench, Search, Menu, PanelLeft, Heart } from 'lucide-react';
import { initialGuides, initialParts } from '../data';
import { navigate } from '../hooks/usePathname';

/**
 * Minimal top bar: sidebar toggle, logo/title and universal search.
 * Everything else (account, appearance, offline vault, sign out) lives in the left sidebar.
 */
export default function Header({
  searchQuery,
  onSearchChange,
  onSelectTab,
  onToggleSidebar,
  onToggleCollapse,
  logSearch,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectTab: (t: string) => void;
  /** Mobile: opens the sidebar drawer. */
  onToggleSidebar?: () => void;
  /** Desktop: collapses / expands the sidebar rail. */
  onToggleCollapse?: () => void;
  logSearch?: (query: string, resultsCount: number) => Promise<void>;
}) {
  const [suggestions, setSuggestions] = useState<{ type: 'guide' | 'part'; title: string }[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filterData = useCallback((query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const guideMatches = initialGuides
      .filter(g => g.title.toLowerCase().includes(q) || g.deviceModel?.toLowerCase().includes(q))
      .slice(0, 3)
      .map(g => ({ type: 'guide' as const, title: g.title }));
    const partMatches = initialParts
      .filter(p => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({ type: 'part' as const, title: p.name }));
    setSuggestions([...guideMatches, ...partMatches]);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => filterData(searchQuery), 200);
    return () => clearTimeout(handler);
  }, [searchQuery, filterData]);

  // "/" focuses search, like Linear / GitHub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && t && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runSearch = (q: string) => {
    const query = q.trim();
    if (!query) return;
    void logSearch?.(query, suggestions.length);
    setFocused(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
      <div className="w-full h-full px-3 sm:px-4 lg:px-5 flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex p-2 -ml-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Collapse or expand sidebar"
            title="Toggle sidebar"
          >
            <PanelLeft className="w-[18px] h-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-label="DIY Electronics home"
          className="flex items-center gap-2.5 shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500"
        >
          <span className="w-8 h-8 rounded-lg bg-slate-950 dark:bg-white flex items-center justify-center shadow-xs">
            <Wrench className="w-4 h-4 text-white dark:text-slate-950 stroke-[2.25]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-white">
            DIY Electronics
          </span>
        </button>

        <div className="flex-1" />

        {/* Desktop / tablet search */}
        <div className="hidden sm:block relative w-full max-w-sm md:max-w-md">
          <form
            role="search"
            onSubmit={e => {
              e.preventDefault();
              runSearch(searchQuery);
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Search devices, parts, guides, symptoms…"
              aria-label="Search everything"
              className="w-full h-9 pl-9 pr-10 rounded-lg text-sm bg-slate-100 dark:bg-slate-900 border border-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-slate-300 dark:focus:border-slate-700 focus:ring-4 focus:ring-cobalt-500/15 transition-all"
            />
            <kbd className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 h-5 min-w-5 px-1.5 items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-400 bg-white dark:bg-slate-950">
              /
            </kbd>
          </form>
          {focused && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 p-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onSearchChange(s.title);
                    runSearch(s.title);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.type === 'guide' ? 'bg-cobalt-500' : 'bg-amber-500'}`} />
                  <span className="truncate">{s.title}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{s.type === 'guide' ? 'Guide' : 'Part'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Small, optional "Support" link (never a popup) */}
        <button
          type="button"
          onClick={() => navigate('/support')}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Support the app"
        >
          <Heart className="w-3.5 h-3.5" /> Support
        </button>

        {/* Mobile: search opens the universal search page */}
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="sm:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
