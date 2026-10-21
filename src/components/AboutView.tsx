import { Info, ShieldCheck, Cpu, Leaf, Users, Flag } from 'lucide-react';
import { USER_CONTENT_DISCLAIMER, CONTENT_POLICY_POINTS } from '../config/policy';
import { ShieldAlert } from 'lucide-react';
import { OWNERSHIP_AGREEMENT_CLAUSES, OWNERSHIP_AGREEMENT_INTRO, OWNERSHIP_AGREEMENT_NOTICE, OWNERSHIP_AGREEMENT_TITLE } from '../lib/ownershipAgreement';

export default function AboutView() {
  return (
    <div className="ds-page space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div className="w-12 h-12 rounded-2xl bg-cobalt-600 text-white flex items-center justify-center font-bold shadow-lg">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">About DIY Electronics</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">Repair guides, AI help and a parts marketplace for technicians and makers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-500 flex items-center justify-center">
            <Leaf className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Our E-Waste Mission</h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Every year, millions of tons of electronic waste are discarded prematurely due to lack of component-level repair documentation and proprietary lockdowns. We want to make component-level repair easier to learn, with step-by-step guides, AI-assisted diagnosis and a community of people who fix things, so devices stay in use for longer.
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Parts Marketplace</h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            The marketplace lets repairers and shops list spare parts and tools. Sellers can apply for a verified badge, which our team reviews by hand. Always check a listing and talk to the seller before you pay.
          </p>
        </div>
      </div>

      <div id="user-content" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cobalt-500/10 text-cobalt-500 flex items-center justify-center"><Users className="w-5 h-5" /></div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">User content disclaimer</h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{USER_CONTENT_DISCLAIMER}</p>
        </div>
        <div id="content-policy" className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><Flag className="w-5 h-5" /></div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Content policy</h3>
          <ul className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed list-disc pl-5 space-y-1">{CONTENT_POLICY_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>

      <div id="ownership-agreement" className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-900 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></div>
        <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Terms: {OWNERSHIP_AGREEMENT_TITLE}</h3>
        <p className="text-xs text-stone-600 dark:text-stone-400">Phone Tricks, FRP / unlock / account-removal guides and videos, and AI answers about them open only after you accept this agreement. {OWNERSHIP_AGREEMENT_INTRO}</p>
        <ol className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed list-decimal pl-5 space-y-1">{OWNERSHIP_AGREEMENT_CLAUSES.map((c) => <li key={c}>{c}</li>)}</ol>
        <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">{OWNERSHIP_AGREEMENT_NOTICE}</p>
      </div>

      <div className="bg-stone-900 text-stone-100 dark:bg-stone-900 dark:border dark:border-stone-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cobalt-600 text-white flex items-center justify-center font-bold">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Platform Architecture & AI</h3>
            <p className="text-xs text-stone-400">Built with React, TypeScript, Tailwind CSS, Firebase, and Gemini AI</p>
          </div>
        </div>
        <ul className="pt-4 border-t border-stone-800 space-y-2 text-xs text-stone-300 leading-relaxed list-disc pl-5">
          <li>AI answers (diagnosis, walkthroughs, tips) are generated by Google Gemini. They are a starting point, not a guarantee: check readings against the device's schematic.</li>
          <li>Our AI assistant never explains how to bypass FRP, iCloud/Activation Lock or other anti-theft locks.</li>
          <li>Work on mains-powered or high-voltage equipment only if you are trained to. When in doubt, take it to a professional.</li>
        </ul>
      </div>
    </div>
  );
}
