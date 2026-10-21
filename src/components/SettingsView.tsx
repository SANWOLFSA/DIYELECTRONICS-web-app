import { useState } from 'react';
import { Moon, Sun, User, CheckCircle2, Heart, Palette, HardDrive, LogOut, Scale, ChevronRight, Store } from 'lucide-react';
import { navigate } from '../hooks/usePathname';

interface SettingsViewProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser: any;
  onUpdateUser?: (user: any) => void;
  /** "Offline vault": show only guides saved on this device. */
  isOfflineMode?: boolean;
  onToggleOfflineMode?: () => void;
  savedGuidesCount?: number;
  onSignOut?: () => void;
}

const AVAILABLE_BRANDS = [
  'Apple', 'Samsung', 'Sony', 'LG', 'Dyson', 'Philips', 'Nintendo', 'Microsoft', 'Dell', 'HP', 'Lenovo', 'Asus', 'Panasonic',
];

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs';

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-cobalt-600' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SettingsView({
  darkMode,
  onToggleDarkMode,
  currentUser,
  onUpdateUser,
  isOfflineMode = false,
  onToggleOfflineMode,
  savedGuidesCount = 0,
  onSignOut,
}: SettingsViewProps) {
  const [savedMessage, setSavedMessage] = useState(false);
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(currentUser?.favoriteBrands || []);

  const toggleBrand = (brand: string) => {
    const next = favoriteBrands.includes(brand) ? favoriteBrands.filter(b => b !== brand) : [...favoriteBrands, brand];
    setFavoriteBrands(next);
    onUpdateUser?.({ ...currentUser, favoriteBrands: next });
    setSavedMessage(true);
    window.setTimeout(() => setSavedMessage(false), 2000);
  };

  return (
    <div className="ds-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Appearance, offline guides, favourite brands and your account.</p>
        </div>
        {savedMessage && (
          <div role="status" className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section icon={<Palette className="w-[18px] h-[18px]" />} title="Appearance" subtitle="Graphite & Cobalt theme, in light or dark.">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Colour mode">
            {[
              { id: false, label: 'Light', icon: <Sun className="w-4 h-4" /> },
              { id: true, label: 'Dark', icon: <Moon className="w-4 h-4" /> },
            ].map(opt => {
              const selected = darkMode === opt.id;
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => { if (!selected) onToggleDarkMode(); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-cobalt-500 ring-4 ring-cobalt-500/15' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                >
                  <div className={`h-16 rounded-lg mb-3 border ${opt.id ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} p-2 flex gap-1.5`}>
                    <div className={`w-6 rounded ${opt.id ? 'bg-slate-900' : 'bg-white border border-slate-200'}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-2 w-3/4 rounded ${opt.id ? 'bg-slate-700' : 'bg-slate-300'}`} />
                      <div className={`h-2 w-1/2 rounded ${opt.id ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      <div className="h-3 w-10 rounded bg-cobalt-500" />
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">{opt.icon}{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section icon={<HardDrive className="w-[18px] h-[18px]" />} title="Offline vault" subtitle="Guides you save are cached on this device.">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Show saved guides only</p>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{savedGuidesCount} guide{savedGuidesCount === 1 ? '' : 's'} saved. Turn on when you are working without a connection.</p>
            </div>
            <Toggle on={isOfflineMode} onClick={onToggleOfflineMode} label="Show saved guides only" />
          </div>
        </Section>

        <Section icon={<Heart className="w-[18px] h-[18px]" />} title="Favourite brands" subtitle="Saved to your profile on this device.">
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_BRANDS.map(brand => {
              const isSelected = favoriteBrands.includes(brand);
              return (
                <button
                  key={brand}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleBrand(brand)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                    isSelected
                      ? 'bg-cobalt-600 text-white border-cobalt-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </Section>

        <Section icon={<User className="w-[18px] h-[18px]" />} title="Account" subtitle="Your profile on DIY Electronics.">
          <dl className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-slate-500 dark:text-slate-400">Name</dt>
              <dd className="font-medium text-slate-900 dark:text-white truncate">{currentUser?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="font-medium text-slate-900 dark:text-white truncate">{currentUser?.email || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="font-medium text-slate-900 dark:text-white truncate">{currentUser?.role || '—'}</dd>
            </div>
          </dl>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </Section>
        <Section icon={<Store className="w-[18px] h-[18px]" />} title="Spare parts & shops" subtitle="Find parts and tools near you, or list your own shop.">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { label: 'Find parts & tools near you', hint: 'Marketplace, nearest shops first', path: '/marketplace?near=1' },
              { label: 'List your shop', hint: 'Shops & suppliers worldwide; individuals list free', path: '/marketplace?shop=1' },
              { label: 'How it works', hint: 'Step-by-step help', path: '/help' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.path}
                onClick={(e) => { e.preventDefault(); navigate(item.path); }}
                className="flex items-center justify-between gap-3 py-3 group"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white group-hover:text-cobalt-600">{item.label}</span>
                  <span className="block text-[13px] text-slate-500 dark:text-slate-400">{item.hint}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </Section>
        <Section icon={<Scale className="w-[18px] h-[18px]" />} title="Legal" subtitle="The rules for using DIY Electronics.">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { label: 'Terms of Use', hint: 'Safety, AI answers, uploads and responsibility', path: '/terms' },
              { label: 'Privacy summary', hint: 'What data the app uses and your rights', path: '/terms#privacy' },
              { label: 'About DIY Electronics', hint: 'Who we are and the ownership agreement', path: '/about' },
            ].map((item) => (
              <a
                key={item.label}
                href={item.path}
                onClick={(e) => { e.preventDefault(); navigate(item.path); }}
                className="flex items-center justify-between gap-3 py-3 group"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white group-hover:text-cobalt-600">{item.label}</span>
                  <span className="block text-[13px] text-slate-500 dark:text-slate-400">{item.hint}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
