import {
  GraduationCap, Home, Smartphone, BookOpen, ShoppingBag, Bot, Settings, Info, HelpCircle, ShieldCheck,
  FileText, Heart, Search, Microchip, ScanSearch, Award, Activity, Cpu, Gauge, LogOut, LogIn, Lock, Moon, Sun, TrendingUp, Wrench, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  /** Mobile drawer open state. */
  isOpen: boolean;
  onCloseMobile: () => void;
  /** Desktop: icon-only rail. */
  collapsed?: boolean;
  currentUser: UserProfile;
  /** Not signed in: gated items show a lock and the footer offers "Sign in". */
  isGuest?: boolean;
  isTabLocked?: (id: string) => boolean;
  /** From useAdminStatus().isAdmin; never decided by email here. */
  isAdmin?: boolean;
  pendingVerificationsCount?: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAccount: () => void;
  onSignOut: () => void;
}

type Item = { id: string; label: string; icon: LucideIcon; badge?: number; match?: string[] };
type Group = { title: string; items: Item[] };

export default function Sidebar({
  activeTab, onSelectTab, isOpen, onCloseMobile, collapsed = false, currentUser, isAdmin = false,
  pendingVerificationsCount, darkMode, onToggleDarkMode, onOpenAccount, onSignOut, isGuest = false, isTabLocked,
}: SidebarProps) {
  const groups: Group[] = [
    {
      title: 'Discover',
      items: [
        { id: 'home', label: 'Community feed', icon: Home },
        { id: 'search', label: 'Search', icon: Search },
      ],
    },
    {
      title: 'Repair',
      items: [
        { id: 'devices', label: 'Devices', icon: Smartphone },
        { id: 'phones', label: 'Phone Tricks', icon: Wrench },
        { id: 'guides', label: 'Repair guides', icon: BookOpen },
        { id: 'teardowns', label: 'Teardowns', icon: ScanSearch },
        { id: 'answers', label: 'Answers', icon: HelpCircle },
        { id: 'diagnostic', label: 'AI diagnostic', icon: Activity },
        { id: 'ai_assistant', label: 'SANWOLF AI', icon: Bot },
        { id: 'blueprint_viewer', label: 'Boardview & blueprints', icon: FileText, match: ['3d_viewer', 'social_annotator'] },
      ],
    },
    {
      title: 'Parts & tools',
      items: [
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
        { id: 'components', label: 'Components', icon: Microchip },
        { id: 'multimeter', label: 'Multimeter lab', icon: Gauge },
        { id: 'circuit', label: 'Circuit lab', icon: Cpu },
      ],
    },
    {
      title: 'Learn',
      items: [{ id: 'theory', label: 'Theory & courses', icon: GraduationCap }],
    },
    {
      title: 'You',
      items: [
        { id: 'progress', label: 'My progress', icon: TrendingUp },
        { id: 'contributors', label: 'Top fixers', icon: Award },
        ...(isAdmin
          ? [{
              id: 'admin', label: 'Admin desk', icon: ShieldCheck,
              badge: pendingVerificationsCount && pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
            }]
          : []),
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'help', label: 'Help', icon: HelpCircle },
        { id: 'about', label: 'About', icon: Info },
        { id: 'support', label: 'Support the app', icon: Heart },
      ],
    },
  ];

  const go = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  // On mobile the drawer is always full width; "collapsed" only applies from lg up.
  const c = collapsed;
  const rowBase = 'w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors text-left';
  const rowPad = c ? 'px-3 py-2 lg:justify-center lg:px-0' : 'px-3 py-2';
  const hideWhenCollapsed = c ? 'lg:hidden' : '';

  return (
    <>
      {isOpen && (
        <div onClick={onCloseMobile} className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-[45] lg:hidden" aria-hidden />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed lg:sticky top-0 lg:top-14 left-0 z-50 lg:z-30 h-[100dvh] lg:h-[calc(100dvh-3.5rem)] shrink-0 w-[272px] ${c ? 'lg:w-[68px]' : 'lg:w-[248px]'} bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-[transform,width] duration-200 ease-out ${isOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Mobile drawer header */}
        <div className="lg:hidden h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-slate-950 dark:bg-white flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white dark:text-slate-950" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-white">DIY Electronics</span>
          </span>
          <button type="button" onClick={onCloseMobile} className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-4">
          {groups.map(group => (
            <div key={group.title} className="space-y-0.5">
              <div className={`px-3 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 ${hideWhenCollapsed}`}>{group.title}</div>
              {c && <div className="hidden lg:block mx-3 mb-1 border-t border-slate-100 dark:border-slate-800/70 first:hidden" />}
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id || (item.match?.includes(activeTab) ?? false);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    title={c ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`${rowBase} ${rowPad} relative ${
                      active
                        ? 'bg-slate-100 text-slate-950 dark:bg-slate-800/80 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-cobalt-600 dark:text-cobalt-400' : ''}`} strokeWidth={1.9} />
                    <span className={`truncate flex-1 ${hideWhenCollapsed}`}>{item.label}</span>
                    {isTabLocked?.(item.id) && <Lock className={`w-3.5 h-3.5 shrink-0 text-slate-400 ${hideWhenCollapsed}`} aria-label="Sign in required" />}
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-semibold ${c ? 'lg:absolute lg:top-0.5 lg:right-1' : ''}`}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: account, appearance, sign out (always last) */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-0.5">
          <button type="button" onClick={() => { onOpenAccount(); onCloseMobile(); }} title={c ? currentUser.name : undefined}
            className={`${rowBase} ${rowPad} text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900`}>
            <img src={currentUser.avatar} alt="" className="w-[22px] h-[22px] rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700" />
            <span className={`flex-1 min-w-0 ${hideWhenCollapsed}`}>
              <span className="block truncate font-medium">{currentUser.name}</span>
            </span>
          </button>
          <button type="button" onClick={onToggleDarkMode} title={c ? (darkMode ? 'Light mode' : 'Dark mode') : undefined} aria-pressed={darkMode}
            className={`${rowBase} ${rowPad} text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white`}>
            {darkMode ? <Sun className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} /> : <Moon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />}
            <span className={`flex-1 ${hideWhenCollapsed}`}>{darkMode ? 'Light mode' : 'Dark mode'}</span>
          </button>
          {isGuest ? (
          <button type="button" onClick={() => { onCloseMobile(); onOpenAccount(); }} title={c ? 'Sign in' : undefined}
            className={`${rowBase} ${rowPad} text-cobalt-700 dark:text-cobalt-300 hover:bg-cobalt-50 dark:hover:bg-cobalt-500/10`}>
            <LogIn className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
            <span className={`flex-1 ${hideWhenCollapsed}`}>Sign in</span>
          </button>
          ) : (
          <button type="button" onClick={() => { onCloseMobile(); onSignOut(); }} title={c ? 'Sign out' : undefined}
            className={`${rowBase} ${rowPad} text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400`}>
            <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
            <span className={`flex-1 ${hideWhenCollapsed}`}>Sign out</span>
          </button>
          )}
        </div>
      </aside>
    </>
  );
}
