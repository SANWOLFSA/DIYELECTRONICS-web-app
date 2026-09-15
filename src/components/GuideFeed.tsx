import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Bookmark,
  BookmarkCheck,
  Play,
  Clock,
  Eye,
  ThumbsUp,
  Leaf,
  WifiOff,
  ChevronDown,
  Layers,
  Wrench,
  Sparkles,
  Cpu,
  Laptop,
  Smartphone,
  Gamepad2,
  Tv,
  Radio,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { RepairGuide, DeviceCategory, DifficultyLevel } from '../types';
import { BRAND_MODELS_DATA, BrandModelDef } from '../data/brandModelsData';

interface GuideFeedProps {
  guides: RepairGuide[];
  savedGuideIds: string[];
  onToggleSaveGuide: (guide: RepairGuide) => void;
  onSelectGuide: (guide: RepairGuide) => void;
  isOfflineOnly: boolean;
  onToggleOfflineOnly: () => void;
  initialSearchQuery?: string;
  onNavigateToDiagnostic: () => void;
}

export default function GuideFeed({
  guides,
  savedGuideIds,
  onToggleSaveGuide,
  onSelectGuide,
  isOfflineOnly,
  onToggleOfflineOnly,
  initialSearchQuery = '',
  onNavigateToDiagnostic,
}: GuideFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedModel, setSelectedModel] = useState<string>('All');
  const [showBrandExplorer, setShowBrandExplorer] = useState<boolean>(true);
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const categories: string[] = [
    'All',
    'Gaming Consoles',
    'Laptops & PCs',
    'Audio & Headphones',
    'TVs & Monitors',
    'Smartphones',
    'Microcontrollers & IoT',
    'Drones & Robotics',
  ];

  // List of distinct brands
  const brands = useMemo(() => {
    return ['All', ...BRAND_MODELS_DATA.map((b) => b.brand)];
  }, []);

  // Models available for current selected brand
  const availableModels = useMemo(() => {
    if (selectedBrand === 'All') return [];
    const brandObj = BRAND_MODELS_DATA.find((b) => b.brand === selectedBrand);
    return brandObj ? brandObj.models : [];
  }, [selectedBrand]);

  // Filtering
  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      // Offline filter
      if (isOfflineOnly && !savedGuideIds.includes(guide.id)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'All' && guide.deviceCategory !== selectedCategory) {
        return false;
      }
      // Difficulty filter
      if (selectedDifficulty !== 'All' && guide.difficulty !== selectedDifficulty) {
        return false;
      }
      // Brand filter
      if (selectedBrand !== 'All') {
        const titleLower = guide.title.toLowerCase();
        const modelLower = guide.deviceModel.toLowerCase();
        const brandLower = selectedBrand.toLowerCase();
        if (!titleLower.includes(brandLower) && !modelLower.includes(brandLower)) {
          return false;
        }
      }
      // Specific Model filter
      if (selectedModel !== 'All') {
        const guideModel = guide.deviceModel.toLowerCase();
        const targetModel = selectedModel.toLowerCase();
        if (!guideModel.includes(targetModel) && !guide.title.toLowerCase().includes(targetModel)) {
          return false;
        }
      }
      // Search filter (title, model, issue, tools, parts)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = guide.title.toLowerCase().includes(q);
        const matchModel = guide.deviceModel.toLowerCase().includes(q);
        const matchIssue = guide.issueType.toLowerCase().includes(q);
        const matchParts = guide.partsRequired.some((p) => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q));
        if (!matchTitle && !matchModel && !matchIssue && !matchParts) {
          return false;
        }
      }
      return true;
    });
  }, [guides, isOfflineOnly, savedGuideIds, selectedCategory, selectedDifficulty, selectedBrand, selectedModel, searchQuery]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredGuides.length && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => prev + 3);
            setIsLoadingMore(false);
          }, 350);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [filteredGuides.length, visibleCount, isLoadingMore]);

  const displayedGuides = filteredGuides.slice(0, visibleCount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Hero Welcome & Eco Metric Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Sustainable Right-to-Repair Movement</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Categorized Electronics Repair Guides
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Step-by-step interactive teardowns, high-resolution oscilloscope/multimeter probe guides, and video walk-throughs to restore devices and slash electronic waste.
          </p>
        </div>

        {/* Quick Diagnostic Callout */}
        <div className="shrink-0 p-5 rounded-2xl bg-amber-400 text-stone-950 flex flex-col justify-between shadow-md max-w-xs space-y-3">
          <div>
            <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Stuck on a Repair?</span>
            </div>
            <p className="text-xs font-medium mt-1 leading-snug">
              Input device symptoms to get instant multimeter checkpoints and schematic test guidance.
            </p>
          </div>
          <button
            onClick={onNavigateToDiagnostic}
            className="py-2 px-3 rounded-xl bg-stone-950 text-amber-400 font-bold text-xs hover:bg-stone-900 transition-colors self-start shadow-xs"
          >
            Launch AI Diagnostic →
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="space-y-4">
        
        {/* Category Scrollable Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(6);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Brand Selector Bar */}
        <div className="bg-stone-100 dark:bg-stone-900/80 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>Filter Solutions by Brand & Model</span>
            </div>

            {(selectedBrand !== 'All' || selectedModel !== 'All') && (
              <button
                onClick={() => {
                  setSelectedBrand('All');
                  setSelectedModel('All');
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                <X className="w-3 h-3" />
                <span>Clear Brand Filter</span>
              </button>
            )}
          </div>

          {/* Brand Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {brands.map((b) => {
              const isSelected = selectedBrand === b;
              return (
                <button
                  key={b}
                  onClick={() => {
                    setSelectedBrand(b);
                    setSelectedModel('All');
                    setVisibleCount(6);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-stone-950 text-amber-400 border-stone-950 dark:bg-amber-400 dark:text-stone-950 dark:border-amber-400 shadow-sm'
                      : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400'
                  }`}
                >
                  {b === 'All' ? 'All Brands' : b}
                </button>
              );
            })}
          </div>

          {/* If Brand selected, show its Models */}
          {selectedBrand !== 'All' && availableModels.length > 0 && (
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0">
                {selectedBrand} Models:
              </span>
              <button
                onClick={() => setSelectedModel('All')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-all ${
                  selectedModel === 'All'
                    ? 'bg-amber-400 text-stone-950 border-amber-400 font-bold'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                All {selectedBrand} Models
              </button>
              {availableModels.map((m) => {
                const isModelSelected = selectedModel === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => {
                      setSelectedModel(m.name);
                      setVisibleCount(6);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-all ${
                      isModelSelected
                        ? 'bg-amber-400 text-stone-950 border-amber-400 font-bold'
                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-amber-400'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Secondary Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(6);
              }}
              placeholder="Filter by device model, chip (e.g. CD3215, M92T36), or symptom..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Difficulty Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500 font-medium">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none"
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

            {/* Offline Saved Filter Toggle */}
            <button
              onClick={onToggleOfflineOnly}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                isOfflineOnly
                  ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isOfflineOnly ? 'fill-current' : ''}`} />
              <span>Saved for Offline ({savedGuideIds.length})</span>
            </button>
          </div>
        </div>

      </div>

      {/* Infinite Scrolling Feed Grid */}
      {displayedGuides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {displayedGuides.map((guide) => {
            const isSaved = savedGuideIds.includes(guide.id);

            return (
              <div
                key={guide.id}
                className="group bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Video Preview */}
                  <div className="relative aspect-video w-full overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer" onClick={() => onSelectGuide(guide)}>
                    <img
                      src={guide.thumbnailUrl}
                      alt={guide.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Category & Difficulty Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-stone-950/90 text-amber-400 font-bold text-[10px] tracking-wider uppercase backdrop-blur-xs">
                        {guide.deviceCategory}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-white font-bold text-[10px] tracking-wider uppercase backdrop-blur-xs ${
                        guide.difficulty === 'Beginner'
                          ? 'bg-emerald-600/90'
                          : guide.difficulty === 'Intermediate'
                          ? 'bg-blue-600/90'
                          : guide.difficulty === 'Advanced'
                          ? 'bg-amber-600/90'
                          : 'bg-purple-600/90'
                      }`}>
                        {guide.difficulty}
                      </span>
                    </div>

                    {/* Offline Bookmark Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaveGuide(guide);
                      }}
                      className={`absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isSaved
                          ? 'bg-amber-400 text-stone-950 shadow-md'
                          : 'bg-stone-950/70 text-white hover:bg-stone-950'
                      }`}
                      title={isSaved ? 'Saved offline' : 'Save for offline repair work'}
                    >
                      {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                    </button>

                    {/* Bottom Metadata inside thumbnail */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-mono font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {guide.estimatedTimeMinutes} min
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono font-medium">
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          {guide.steps.length} Steps
                        </span>
                      </div>

                      {/* Video indicator */}
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold">
                        <Play className="w-3 h-3 fill-current" />
                        <span>Interactive Video</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 cursor-pointer" onClick={() => onSelectGuide(guide)}>
                    <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                      {guide.deviceModel}
                    </div>

                    <h3 className="text-base font-black text-stone-900 dark:text-stone-100 group-hover:text-amber-500 transition-colors leading-snug">
                      {guide.title}
                    </h3>

                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                      <strong className="text-stone-700 dark:text-stone-300">Symptom: </strong>
                      {guide.issueType}
                    </p>

                    {/* Parts & Tools Pill Summary */}
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {guide.partsRequired.slice(0, 2).map((p, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                        >
                          Part: {p.partNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Author & E-Waste Saved Metric */}
                <div className="px-5 py-3.5 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={guide.author.avatar}
                      alt={guide.author.name}
                      className="w-6 h-6 rounded-full object-cover border border-amber-400/50"
                    />
                    <div className="text-left">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                        {guide.author.name}
                      </span>
                      <span className="text-[10px] text-stone-400 block">
                        {guide.author.badge}
                      </span>
                    </div>
                  </div>

                  {/* E-Waste Diversion Contribution */}
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <Leaf className="w-3.5 h-3.5" />
                    <span>+{guide.eWasteSavedKg} kg saved</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 text-stone-900 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Wrench className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            No Repair Guides Matched Your Search
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Try resetting your filters, searching for alternate chip numbers, or launch the AI Diagnostic Tool to generate custom test points.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSelectedDifficulty('All');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Infinite Scroll Dynamic Trigger */}
      <div ref={loaderRef} className="py-6 flex justify-center">
        {isLoadingMore ? (
          <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading more repair guides from cache...</span>
          </div>
        ) : visibleCount < filteredGuides.length ? (
          <button
            onClick={() => setVisibleCount((prev) => prev + 4)}
            className="px-6 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Load More Guides ({filteredGuides.length - visibleCount} remaining)</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : null}
      </div>

    </div>
  );
}
