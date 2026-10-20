import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { LANGUAGES, deviceLanguage, type Language } from '../lib/languages';

/** Searchable list of every supported language; the device language is pinned at the top. */
export default function LanguagePicker({ value, onChange, autoFocus = true }: { value: string; onChange: (l: Language) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const device = deviceLanguage();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = s ? LANGUAGES.filter((l) => l.name.toLowerCase().includes(s) || l.native.toLowerCase().includes(s) || l.code.toLowerCase() === s) : LANGUAGES;
    const pinned = [device, LANGUAGES.find((l) => l.code === 'en')!].filter((l, i, a) => a.findIndex((x) => x.code === l.code) === i);
    return s ? all : [...pinned, ...all.filter((l) => !pinned.some((p) => p.code === l.code))];
  }, [q, device]);
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${LANGUAGES.length} languages`} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-cobalt-500 focus:outline-none text-[16px]" aria-label="Search languages" />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Languages">
        {list.map((l) => (
          <li key={l.code}>
            <button type="button" role="option" aria-selected={l.code === value} onClick={() => onChange(l)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${l.code === value ? 'bg-cobalt-50 dark:bg-cobalt-500/15 text-cobalt-700 dark:text-cobalt-200 font-semibold' : 'text-slate-700 dark:text-slate-200'}`}>
              <span className="min-w-0 truncate">{l.native} <span className="text-xs text-slate-400 font-normal">· {l.name}{l.code === device.code ? ' (this device)' : ''}</span></span>
              {l.code === value && <Check className="w-4 h-4 shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
