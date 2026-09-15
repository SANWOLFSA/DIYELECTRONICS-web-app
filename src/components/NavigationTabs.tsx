import {
  BookOpen,
  Cpu,
  Activity,
  Layers,
  ShoppingBag,
  GraduationCap,
  MessageSquare,
  Award,
  ShieldCheck,
} from 'lucide-react';

interface NavigationTabsProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  pendingVerificationsCount: number;
}

export default function NavigationTabs({
  activeTab,
  onSelectTab,
  pendingVerificationsCount,
}: NavigationTabsProps) {
  const tabs = [
    {
      id: 'guides',
      label: 'Repair Guides',
      icon: BookOpen,
      desc: 'Step-by-step & Video',
    },
    {
      id: 'diagnostic',
      label: 'AI Diagnostic',
      icon: Activity,
      desc: 'Symptom Analyzer',
      highlight: true,
    },
    {
      id: 'circuit',
      label: 'Circuit Lab',
      icon: Cpu,
      desc: 'Interactive Simulator',
    },
    {
      id: 'parts',
      label: 'Spare Parts',
      icon: Layers,
      desc: 'Pinouts & Specs',
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: ShoppingBag,
      desc: 'Verified Suppliers',
    },
    {
      id: 'studies',
      label: 'Studies & Theory',
      icon: GraduationCap,
      desc: 'Courses & Quizzes',
    },
    {
      id: 'forum',
      label: 'Community Forum',
      icon: MessageSquare,
      desc: 'P2P Troubleshooting',
    },
    {
      id: 'progress',
      label: 'My Progress',
      icon: Award,
      desc: 'Badges & Impact',
    },
    {
      id: 'admin',
      label: 'Admin Desk',
      icon: ShieldCheck,
      desc: 'Verify Trading Papers',
      badge: pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
    },
  ];

  return (
    <nav className="w-full bg-stone-100/80 dark:bg-stone-900/60 border-b border-stone-200 dark:border-stone-800/80 sticky top-16 z-30 overflow-x-auto no-scrollbar backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 py-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-400 text-stone-950 shadow-md scale-[1.02]'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
                }`}
              >
                {/* Yellow & Black icon container */}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-stone-950 text-amber-400'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100 group-hover:bg-amber-400 group-hover:text-stone-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <span>{tab.label}</span>

                {/* Optional notification badge e.g. for pending trading papers */}
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                    {tab.badge}
                  </span>
                )}

                {tab.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
