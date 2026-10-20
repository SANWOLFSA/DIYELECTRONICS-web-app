import { aiFetch } from '../lib/aiFetch';
import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Smartphone, Zap, Search, AlertTriangle, Sparkles, CheckCircle2, ChevronDown, Wand2, FileText } from 'lucide-react';
import Markdown from 'react-markdown';
import type { ThemeConfig } from '../lib/theme';

const BRANDS = [
  "Apple iPhone",
  "Samsung Galaxy",
  "Google Pixel",
  "Xiaomi / Redmi",
  "Huawei",
  "OnePlus",
  "Motorola",
  "Other Android"
];

const COMMON_ISSUES = [
  "Hard Reset / Factory Wipe",
  "Locked Out (owner account recovery)",
  "No Power / Dead Phone",
  "Screen Flickering / Ghost Touch",
  "Mic Not Working",
  "Battery Draining Fast",
  "Overheating",
  "Stuck in Bootloop"
];

export default function PhonesPage({ themeConfig, onNavigateTo3D }: { themeConfig?: ThemeConfig; onNavigateTo3D?: () => void }) {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedIssue, setSelectedIssue] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) {
      setError("Please select a Phone Brand/Model.");
      return;
    }
    
    const issueToSearch = customSymptom.trim() || selectedIssue;
    if (!issueToSearch) {
      setError("Please select an issue or type a custom symptom.");
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);
    setIsAiGenerated(false);

    try {
      // 1. Check for a curated (admin-reviewed) answer first. Entries that were
      //    auto-cached from AI output in the past are ignored, because they can't be trusted.
      const docId = `${selectedBrand}-${issueToSearch}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
      let curatedContent: string | null = null;
      try {
        const docSnap = await getDoc(doc(db, 'repairTricks', docId));
        const data = docSnap.exists() ? docSnap.data() : null;
        if (data?.content && data?.source === 'curated') curatedContent = data.content;
      } catch (dbErr) {
        console.warn("Curated repair lookup unavailable:", dbErr);
      }

      if (curatedContent) {
        setResult(curatedContent);
        setIsAiGenerated(false);
      } else {
        // 2. Otherwise ask the AI (server-side; the prompt persona lives on the server).
        setIsAiGenerated(true);
        const prompt = `Write a step-by-step repair guide and troubleshooting steps for:
Brand/Model: ${selectedBrand}
Issue: ${issueToSearch}`;

        const res = await aiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, mode: 'phone-repair' })
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // non-JSON error page
        }
        if (!res.ok || !data?.reply) {
          throw new Error(data?.error || "The AI service isn't reachable right now. Please try again shortly.");
        }
        setResult(data.reply);
        // AI answers are no longer written back to Firestore from the browser:
        // a client-writable cache let anyone poison answers for every other user.
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong while fetching the repair guide. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ds-page">
      {/* Header Section - Themed Telemetry Banner */}
      <div className={`${themeConfig?.cardBannerBg || 'bg-slate-900 border-slate-800'} rounded-2xl p-7 md:p-8 mb-6 text-white shadow-xs border relative overflow-hidden`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md ${themeConfig?.headerBadgeBg || 'bg-slate-800/90'} ${themeConfig?.headerBadgeBorder || 'border-slate-700'} ${themeConfig?.headerBadgeText || 'text-slate-300'} border text-[11px] font-semibold tracking-wider uppercase mb-3`}>
              <Smartphone className="w-3.5 h-3.5" />
              <span>{themeConfig?.bannerTag || 'Phone repair & diagnostics'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
              Phones Diagnostics & Solution Matrix
            </h1>
            <p className="text-slate-300 dark:text-slate-400 text-sm max-w-2xl font-normal leading-relaxed">
              Pick your phone and the problem (or type the symptom or error code) to get step-by-step troubleshooting from curated answers or the AI repair assistant.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 shrink-0">
            {onNavigateTo3D && (
              <button
                type="button"
                onClick={onNavigateTo3D}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Boardview & Blueprints</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSearch} className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-xs border border-slate-200/80 dark:border-slate-800 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Brand Selector */}
          <div>
            <label htmlFor="phone-brand" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Device Brand / Model
            </label>
            <div className="relative">
              <select
                id="phone-brand"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-all cursor-pointer"
              >
                <option value="">Select device platform...</option>
                {BRANDS.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Common Issues Selector */}
          <div>
            <label htmlFor="phone-issue" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Primary Symptom / Failure Code
            </label>
            <div className="relative">
              <select
                id="phone-issue"
                value={selectedIssue}
                onChange={(e) => {
                  setSelectedIssue(e.target.value);
                  setCustomSymptom("");
                }}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-all cursor-pointer"
              >
                <option value="">Select common fault condition...</option>
                {COMMON_ISSUES.map(issue => (
                  <option key={issue} value={issue}>{issue}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Or describe your own symptom</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
        </div>

        {/* Custom Symptom Search Bar */}
        <div className="mb-6">
          <label htmlFor="phone-custom-symptom" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Custom Diagnostic Symptom or Error Code
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="phone-custom-symptom"
                value={customSymptom}
              onChange={(e) => {
                setCustomSymptom(e.target.value);
                setSelectedIssue("");
              }}
              placeholder="e.g. NAND error 4013, bootloop after drop, thermal shutdown on PMIC rail..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 font-medium text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full sm:w-auto px-6 py-3 ${themeConfig?.primaryBg || 'bg-blue-600'} ${themeConfig?.primaryHover || 'hover:bg-blue-500'} ${themeConfig?.primaryText || 'text-white'} rounded-xl font-semibold text-xs uppercase tracking-wider transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {loading ? (
            <>
              <Zap className="w-4 h-4 animate-spin text-slate-400" />
              <span>Thinking…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Query Solution Matrix</span>
            </>
          )}
        </button>
      </form>

      {/* Results Section */}
      {result && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in duration-300">
          <div className={`px-5 py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 ${isAiGenerated ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
            <div className="flex items-center gap-2">
              {isAiGenerated ? (
                <>
                  <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">AI-generated answer: double-check before you open the device</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Curated answer</span>
                </>
              )}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {selectedBrand}
            </span>
          </div>
          
          <div className="p-6 md:p-8 prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-xl prose-h2:text-slate-900 dark:prose-h2:text-white prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:text-sm prose-li:text-sm prose-strong:text-slate-900 dark:prose-strong:text-white">
            <Markdown>{result}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
