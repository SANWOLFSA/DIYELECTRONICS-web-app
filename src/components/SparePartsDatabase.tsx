import { useState, useMemo } from 'react';
import {
  Search,
  Layers,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Truck,
  DollarSign,
  Cpu,
  Info,
  X,
  Sparkles,
} from 'lucide-react';
import { SparePart } from '../types';
import { BRAND_MODELS_DATA } from '../data/brandModelsData';

interface SparePartsDatabaseProps {
  parts: SparePart[];
  initialSearchQuery?: string;
  onSelectMarketplace?: (partNumber: string) => void;
}

export default function SparePartsDatabase({
  parts,
  initialSearchQuery = '',
  onSelectMarketplace,
}: SparePartsDatabaseProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedPartModal, setSelectedPartModal] = useState<SparePart | null>(null);

  const categories = [
    'All',
    'IC Chip',
    'MOSFET / Transistor',
    'Capacitor',
    'Display Screen',
    'Battery',
    'Connector / Port',
  ];

  const brands = useMemo(() => {
    return ['All', ...BRAND_MODELS_DATA.map((b) => b.brand)];
  }, []);

  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      if (selectedCategory !== 'All' && part.category !== selectedCategory) {
        return false;
      }
      if (selectedBrand !== 'All') {
        const brandLower = selectedBrand.toLowerCase();
        const matchesBrand =
          part.typicalDevices.some((d) => d.toLowerCase().includes(brandLower)) ||
          part.name.toLowerCase().includes(brandLower) ||
          part.description.toLowerCase().includes(brandLower);
        if (!matchesBrand) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = part.partNumber.toLowerCase().includes(q);
        const matchName = part.name.toLowerCase().includes(q);
        const matchDesc = part.description.toLowerCase().includes(q);
        const matchDevices = part.typicalDevices.some((d) => d.toLowerCase().includes(q));
        const matchSub = part.substitutes.some((s) => s.toLowerCase().includes(q));
        if (!matchNumber && !matchName && !matchDesc && !matchDevices && !matchSub) {
          return false;
        }
      }
      return true;
    });
  }, [parts, selectedCategory, selectedBrand, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>Searchable Component Library</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Spare Parts & IC Cross-Reference Database
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Source authentic semiconductors, BGA controllers, power MOSFETs, and passives. Cross-reference pinouts and verified supplier stock to avoid counterfeit parts.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs space-y-1">
          <span className="font-bold text-stone-800 dark:text-stone-200 block">
            Verified Distributor Network
          </span>
          <p className="text-stone-500 text-[11px]">
            Companies with the gold badge have submitted certified trading licenses verified by DIYELECTRONICS admins.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        
        {/* Search & Brand Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part number (e.g. M92T36, CD3215, APL1096), footprint, or device..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-stone-950 shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Brand Filter Row */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            Device Brand:
          </span>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                selectedBrand === b
                  ? 'bg-stone-950 text-amber-400 border-stone-950 dark:bg-amber-400 dark:text-stone-950 dark:border-amber-400 font-bold shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-amber-400'
              }`}
            >
              {b === 'All' ? 'All Brands' : b}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredParts.map((part) => (
          <div
            key={part.id}
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              {/* Header: Part Number & Footprint */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                    {part.category}
                  </span>
                  <h3 className="text-lg font-black font-mono text-stone-900 dark:text-stone-100 mt-1">
                    {part.partNumber}
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  {part.packageFootprint}
                </span>
              </div>

              {/* Name & Description */}
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 line-clamp-2">
                {part.name}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                {part.description}
              </p>

              {/* Typical Devices Tag */}
              <div className="pt-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                  Commonly Found In:
                </span>
                <div className="flex flex-wrap gap-1">
                  {part.typicalDevices.map((dev, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                    >
                      {dev}
                    </span>
                  ))}
                </div>
              </div>

              {/* Verified Supplier Row */}
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {part.supplier.name}
                  </span>
                  {part.supplier.isVerifiedCompany && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded" title="Verified registered trading company">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
                <span className="font-mono text-stone-500 text-[11px] flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  {part.supplier.shippingDays}d ship
                </span>
              </div>
            </div>

            {/* Price & Action */}
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-400 block">Unit Price (Approx)</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  ${part.priceUSD.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPartModal(part)}
                  className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 text-xs font-bold transition-colors"
                >
                  Pinout & Specs
                </button>
                <button
                  onClick={() => {
                    if (onSelectMarketplace) {
                      onSelectMarketplace(part.partNumber);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black transition-all shadow-xs"
                >
                  Order
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Pinouts & Specs Modal */}
      {selectedPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 overflow-y-auto space-y-6 shadow-2xl">
            <button
              onClick={() => setSelectedPartModal(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-stone-950 uppercase tracking-wider">
                {selectedPartModal.category}
              </span>
              <h2 className="text-2xl font-black font-mono text-stone-900 dark:text-stone-100">
                {selectedPartModal.partNumber}
              </h2>
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                {selectedPartModal.name}
              </p>
            </div>

            {/* Datasheet Overview */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-stone-700 dark:text-stone-300">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Datasheet Summary & Pinout Architecture</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-mono">
                {selectedPartModal.datasheetSummary}
              </p>
            </div>

            {/* Specifications Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Technical Specifications
              </h4>
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden text-xs">
                {Object.entries(selectedPartModal.specifications).map(([key, val], idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between p-2.5 ${
                      idx % 2 === 0 ? 'bg-stone-50 dark:bg-stone-800/40' : 'bg-white dark:bg-stone-900'
                    }`}
                  >
                    <span className="font-semibold text-stone-600 dark:text-stone-400">{key}</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-Reference Substitutes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Known Cross-Reference Substitutes
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPartModal.substitutes.map((sub, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 font-mono text-xs font-bold"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                Package: <strong>{selectedPartModal.packageFootprint}</strong>
              </span>
              <button
                onClick={() => setSelectedPartModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-950 text-white dark:bg-amber-400 dark:text-stone-950 font-bold text-xs"
              >
                Close Specs
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
