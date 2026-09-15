import { useState } from 'react';
import {
  Award,
  Leaf,
  CheckCircle2,
  Bookmark,
  TrendingUp,
  ShieldCheck,
  Cpu,
  Trash2,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { UserProfile, RepairGuide } from '../types';

interface ProgressDashboardProps {
  currentUser: UserProfile;
  savedGuides: RepairGuide[];
  onOpenGuide: (guide: RepairGuide) => void;
  onRemoveSavedGuide: (guideId: string) => void;
  onNavigateToGuides: () => void;
}

export default function ProgressDashboard({
  currentUser,
  savedGuides,
  onOpenGuide,
  onRemoveSavedGuide,
  onNavigateToGuides,
}: ProgressDashboardProps) {
  // Ecological calculation equivalents
  const co2PreventedKg = (currentUser.eWasteDivertedKg * 18.5).toFixed(1);
  const toxicChemicalsAvoidedGrams = (currentUser.eWasteDivertedKg * 42).toFixed(0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Profile Header & Reputation */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-amber-400 shadow-md"
            />
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-stone-950 text-amber-400 text-[10px] font-black uppercase border border-amber-400/50">
              Lvl 4
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-black text-stone-900 dark:text-stone-100">
                {currentUser.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-bold text-xs">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-mono">
              {currentUser.email} • Joined DIYELECTRONICS
            </p>
            <div className="flex items-center gap-3 pt-1 text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                ★ {currentUser.reputationPoints} Rep Points
              </span>
              <span className="text-stone-400">•</span>
              <span className="font-bold text-stone-700 dark:text-stone-300">
                {currentUser.repairsCompleted} Successful Bench Fixes
              </span>
            </div>
          </div>
        </div>

        {/* E-Waste Diversion Trophy Box */}
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between max-w-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
            <Leaf className="w-4 h-4 text-emerald-600" />
            <span>Ecological Footprint Prevented</span>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">
            {currentUser.eWasteDivertedKg.toFixed(1)} kg
          </div>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
            Equivalent to avoiding <strong>{co2PreventedKg} kg CO₂</strong> and <strong>{toxicChemicalsAvoidedGrams}g</strong> of heavy metals leaching into soil.
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
            Devices Restored
          </span>
          <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
            {currentUser.repairsCompleted} Units
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Saved approx. $1,840 in replacement costs
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
            Offline Saved Guides
          </span>
          <div className="text-3xl font-black font-mono text-amber-500">
            {savedGuides.length} Guides
          </div>
          <span className="text-[11px] text-stone-500">
            Cached for offline workbench continuity
          </span>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-1">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
            Forum Helpful Marks
          </span>
          <div className="text-3xl font-black font-mono text-stone-900 dark:text-stone-100">
            28 Upvotes
          </div>
          <span className="text-[11px] text-stone-500">
            Recognized by peer electronics technicians
          </span>
        </div>
      </div>

      {/* Earned Badges Section */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Technician Mastery Badges</span>
          </h3>
          <span className="text-xs text-stone-500 font-medium">
            {currentUser.badges.length} Badges Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {currentUser.badges.map((b, i) => (
            <div
              key={b.id || i}
              className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">{b.name}</h4>
                <span className="text-[10px] text-stone-400 font-medium">{b.description}</span>
              </div>
            </div>
          ))}

          {/* Locked Badge Teaser */}
          <div className="p-4 rounded-2xl border border-dashed border-stone-300 dark:border-stone-800 flex items-center gap-3 opacity-60">
            <div className="w-10 h-10 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-500 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">BGA Master</h4>
              <span className="text-[10px] text-stone-400">Reball 3 APUs to unlock</span>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Saved Guides Manager */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-amber-500" />
              <span>Offline Workbench Library</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              These guides are cached in your browser storage for access when working without Wi-Fi.
            </p>
          </div>

          <button
            onClick={onNavigateToGuides}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <span>Explore More Guides</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {savedGuides.length > 0 ? (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {savedGuides.map((guide) => (
              <div
                key={guide.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={guide.thumbnailUrl}
                    alt={guide.title}
                    className="w-16 h-12 rounded-xl object-cover"
                  />
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 uppercase">
                      {guide.deviceCategory}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 hover:text-amber-500 transition-colors cursor-pointer" onClick={() => onOpenGuide(guide)}>
                      {guide.title}
                    </h4>
                    <span className="text-[11px] text-stone-400 font-mono">
                      {guide.steps.length} Steps • Model: {guide.deviceModel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenGuide(guide)}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs transition-colors shadow-xs"
                  >
                    Open Guide
                  </button>

                  <button
                    onClick={() => onRemoveSavedGuide(guide.id)}
                    className="p-1.5 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    title="Remove from offline cache"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-stone-400">
            No guides cached yet. Click the bookmark icon on any guide card to save it for offline bench work.
          </div>
        )}
      </div>

    </div>
  );
}
