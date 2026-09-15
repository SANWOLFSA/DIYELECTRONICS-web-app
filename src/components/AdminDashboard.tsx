import { useState } from 'react';
import {
  ShieldCheck,
  Building,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  Eye,
  X,
  FileText,
  Filter,
} from 'lucide-react';
import { CompanyVerificationRequest } from '../types';

interface AdminDashboardProps {
  verifications: CompanyVerificationRequest[];
  onApproveVerification: (id: string) => void;
  onRejectVerification: (id: string, reason: string) => void;
}

export default function AdminDashboard({
  verifications,
  onApproveVerification,
  onRejectVerification,
}: AdminDashboardProps) {
  const [selectedDocReq, setSelectedDocReq] = useState<CompanyVerificationRequest | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Pending Review' | 'Approved (Verified)' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRequests = verifications.filter((r) => {
    if (activeFilter !== 'All' && r.status !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.companyName.toLowerCase().includes(q);
      const matchReg = r.registrationNumber.toLowerCase().includes(q);
      const matchCountry = r.countryOfRegistration.toLowerCase().includes(q);
      if (!matchName && !matchReg && !matchCountry) return false;
    }
    return true;
  });

  const pendingCount = verifications.filter((r) => r.status === 'Pending Review').length;
  const approvedCount = verifications.filter((r) => r.status === 'Approved (Verified)').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>DIYELECTRONICS Trust & Safety Portal</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Admin Compliance & Company Verification Desk
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Verify official trading papers, corporate registrations, and business licenses. Legitimate suppliers receive the Golden Verified Badge on marketplace components to protect technicians from counterfeit chips.
          </p>
        </div>

        {/* Quick Metric Badges */}
        <div className="flex gap-3">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-center min-w-[110px]">
            <span className="text-[10px] uppercase font-bold text-amber-900 dark:text-amber-300 block">
              Pending Audit
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {pendingCount}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-center min-w-[110px]">
            <span className="text-[10px] uppercase font-bold text-emerald-900 dark:text-emerald-300 block">
              Verified Traders
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {approvedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-1.5">
          {(['All', 'Pending Review', 'Approved (Verified)', 'Rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeFilter === tab
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, country, or registration #..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Verification Requests List */}
      <div className="space-y-4">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs hover:border-amber-400/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100">
                  {req.companyName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  req.status === 'Approved (Verified)'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    : req.status === 'Pending Review'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse'
                    : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                }`}>
                  {req.status}
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  Submitted: {req.submittedDate}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-stone-600 dark:text-stone-400">
                <div>
                  <span className="text-stone-400">Reg #: </span>
                  <strong className="text-stone-800 dark:text-stone-200">{req.registrationNumber}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Country: </span>
                  <strong className="text-stone-800 dark:text-stone-200">{req.countryOfRegistration}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Tax/VAT: </span>
                  <strong className="text-stone-800 dark:text-stone-200">{req.vatTaxNumber || 'N/A'}</strong>
                </div>
              </div>

              <p className="text-xs text-stone-500 dark:text-stone-400">
                <strong className="text-stone-700 dark:text-stone-300">Auditor Notes: </strong>
                {req.reviewerNotes}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedDocReq(req)}
                className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-4 h-4 text-amber-500" />
                <span>Inspect License Paper</span>
              </button>

              {req.status === 'Pending Review' && (
                <>
                  <button
                    onClick={() => onApproveVerification(req.id)}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Bestow Badge</span>
                  </button>

                  <button
                    onClick={() => onRejectVerification(req.id, 'Discrepancy in commercial registration number with official state register.')}
                    className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-red-100 hover:text-red-600 text-stone-600 dark:text-stone-400 font-bold text-xs transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Document Inspector Modal */}
      {selectedDocReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 space-y-6 shadow-2xl">
            <button
              onClick={() => setSelectedDocReq(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-stone-950 uppercase">
                Official Government Filing
              </span>
              <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
                {selectedDocReq.companyName}
              </h2>
              <p className="text-xs font-mono text-stone-500">
                Official Business Certificate #{selectedDocReq.registrationNumber} ({selectedDocReq.countryOfRegistration})
              </p>
            </div>

            {/* Document Mock Viewer */}
            <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center mx-auto shadow-md">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Trading License & Incorporation Seal
                </h4>
                <p className="text-xs text-stone-500 font-mono mt-1">
                  Issued by Ministry of Commerce & Chamber of Trading
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-left text-xs font-mono space-y-1">
                <div>Corporate Name: {selectedDocReq.companyName}</div>
                <div>Reg No: {selectedDocReq.registrationNumber}</div>
                <div>Headquarters: {selectedDocReq.officialAddress}</div>
                <div>Authorized Trade: Wholesale Semiconductor Supply, BGA Rework</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-stone-500">
                Status: <strong>{selectedDocReq.status}</strong>
              </span>

              {selectedDocReq.status === 'Pending Review' ? (
                <button
                  onClick={() => {
                    onApproveVerification(selectedDocReq.id);
                    setSelectedDocReq(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs"
                >
                  Approve Application
                </button>
              ) : (
                <button
                  onClick={() => setSelectedDocReq(null)}
                  className="px-4 py-2 rounded-xl bg-stone-950 text-white dark:bg-stone-800 text-xs font-bold"
                >
                  Close Document
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
