import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  History,
  Loader2,
  Package,
  ShieldCheck,
  ShieldOff,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { ThemeConfig } from '../lib/theme';
import { useAdminStatus } from '../lib/admin';
import HubModeration from './hub/HubModeration';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  STATUS_LABELS,
  docTypesFor,
  adminCloseReports,
  adminRevokeShopBadge,
  adminSetShopSuspended,
  adminSetShopPlan,
  shopPlan,
  PLAN_LABELS,
  BUSINESS_PLAN_PRICE,
  type ShopPlan,
  subscribeSellerReports,
  subscribeShops,
  useVerifiedSellers,
  type SellerProfile,
  type SellerReport,
  adminDeleteListing,
  adminLogDocumentOpened,
  adminModerateListing,
  adminSetVerificationStatus,
  formatTs,
  formatZar,
  friendlyError,
  getSellerDocUrl,
  subscribeAllListings,
  subscribeAuditLog,
  subscribeVerificationQueue,
  type Actor,
  type AuditEntry,
  type ChecklistEntry,
  type ListingDoc,
  type ListingStatus,
  type SellerVerification,
  type VerificationStatus,
} from '../lib/marketplace';
import UserManagement from './UserManagement';
import SearchAnalytics from './SearchAnalytics';
import VideoModeration from './catalog/VideoModeration';
import { AdminOrdersView } from './MarketplaceOrders';

type AdminTab = 'verifications' | 'shops' | 'orders' | 'listings' | 'videos' | 'hub' | 'audit' | 'users' | 'search';

const cardCls = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none';
const inputCls =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';
const ghostBtn =
  'px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5';

const STATUS_STYLE: Record<VerificationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  under_review: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

const QUEUE_FILTERS: { id: string; label: string; match: (s: VerificationStatus) => boolean }[] = [
  { id: 'open', label: 'To review', match: s => s === 'submitted' || s === 'under_review' },
  { id: 'approved', label: 'Approved', match: s => s === 'approved' },
  { id: 'closed', label: 'Rejected / revoked', match: s => s === 'rejected' || s === 'revoked' },
  { id: 'draft', label: 'Drafts', match: s => s === 'draft' },
  { id: 'all', label: 'All', match: () => true },
];

const EMPTY_CHECK: ChecklistEntry = { legible: false, valid: false, matchesCompany: false };

function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

function Empty({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className={`${cardCls} py-12 px-6 text-center space-y-2`}>
      <Icon className="w-9 h-9 mx-auto text-emerald-500" />
      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{body}</p>
    </div>
  );
}

export default function AdminDesk({ themeConfig }: { themeConfig?: ThemeConfig } = {}) {
  const admin = useAdminStatus();
  const [tab, setTab] = useState<AdminTab>('verifications');
  const actor: Actor | null = admin.uid ? { uid: admin.uid, email: admin.email } : null;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'verifications', label: 'Verifications' },
    { id: 'shops', label: 'Shops' },
    { id: 'orders', label: 'Orders' },
    { id: 'listings', label: 'Listings' },
    { id: 'videos', label: 'Videos' },
    { id: 'hub', label: 'Repair hub' },
    { id: 'audit', label: 'Audit log' },
    { id: 'users', label: 'Users' },
    { id: 'search', label: 'Search' },
  ];

  const titles: Record<AdminTab, [string, string]> = {
    verifications: ['Seller verification queue', 'Open each company document, tick the checklist, then approve, reject with a reason, or revoke a badge. Every action is written to the audit log.'],
    shops: ['Shops & suppliers', 'Every registered shop with its Business plan status (USD $20/month, set by hand; no payments in the app) and open reports. Suspend a shop (hides it and takes its listings down), restore it, or revoke its Verified badge. Every action is written to the audit log.'],
    orders: ['Orders & receipts', 'Every Marketplace order with its receipt: items, prices, delivery fee, total, payment method, payment reference and status history. Receipts can\'t be edited; you can add a note (it goes in the audit log).'],
    listings: ['Listing moderation', 'Listings from individuals and unverified companies wait here until approved. Remove anything that breaks the rules.'],
    videos: ['Community video moderation', 'Reported videos appear first. Remove (hide) a video, restore it, or delete it permanently. Every action is written to the audit log.'],
    hub: ['Repair hub moderation', 'Approve or remove community device pages, AI-researched component pages, guides and Answers, and work through device requests. Every action is written to the audit log.'],
    audit: ['Admin audit log', 'Who did what, and when. Entries cannot be edited or deleted.'],
    users: ['User database management', 'Manage registered platform users, monitor reputation, and view repair statistics.'],
    search: ['Search analytics', 'Common search queries and frequently searched devices that return zero results.'],
  };

  return (
    <div className="ds-page space-y-6">
      <div className={`${cardCls} p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6`}>
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Desk{admin.email ? ` · ${admin.email}` : ''}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{titles[tab][0]}</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{titles[tab][1]}</p>
        </div>
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 gap-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === t.id
                  ? themeConfig?.activeNavBg || 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {admin.bootstrapOnly && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <p className="font-bold flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-amber-500" /> Finish admin setup: your actions will be rejected until you do</p>
          <p>You can see this desk because your email is listed in <code className="font-mono">VITE_ADMIN_EMAILS</code>, but the security rules don't recognise you as an admin yet. Do one of these in the Firebase console:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Firestore: create a document <code className="font-mono">admins/{admin.uid}</code> (any fields, e.g. <code className="font-mono">email: "{admin.email}"</code>), <b>or</b> set <code className="font-mono">role: "admin"</code> on <code className="font-mono">users/{admin.uid}</code>.</li>
            <li>Storage (to open seller documents): add your uid <code className="font-mono select-all">{admin.uid}</code> to <code className="font-mono">adminUids()</code> in <code className="font-mono">storage.rules</code>, or give your account the custom claim <code className="font-mono">admin: true</code>.</li>
            <li>Deploy the rules: <code className="font-mono">firebase deploy --only firestore:rules,storage</code>, then reload this page.</li>
          </ol>
        </div>
      )}

      {!isFirebaseConfigured && (tab === 'verifications' || tab === 'shops' || tab === 'orders' || tab === 'listings' || tab === 'videos' || tab === 'hub' || tab === 'audit') ? (
        <Empty icon={AlertTriangle} title="Cloud database not configured" body="Add the VITE_FIREBASE_* settings to this build to review verifications, moderate listings and read the audit log." />
      ) : tab === 'verifications' ? (
        <VerificationQueue actor={actor} />
      ) : tab === 'shops' ? (
        <ShopsModeration actor={actor} />
      ) : tab === 'orders' ? (
        <AdminOrdersView actor={actor} />
      ) : tab === 'listings' ? (
        <ListingModeration actor={actor} />
      ) : tab === 'videos' ? (
        <VideoModeration actor={actor} />
      ) : tab === 'hub' ? (
        <HubModeration actor={actor} />
      ) : tab === 'audit' ? (
        <AuditLogView />
      ) : tab === 'users' ? (
        <UserManagement />
      ) : (
        <SearchAnalytics />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verification queue
// ---------------------------------------------------------------------------

function VerificationQueue({ actor }: { actor: Actor | null }) {
  const [apps, setApps] = useState<SellerVerification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('open');
  const [openUid, setOpenUid] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeVerificationQueue(
        a => {
          setApps(a);
          setErr(null);
        },
        e => {
          setApps([]);
          setErr(friendlyError(e));
        }
      ),
    []
  );

  const f = QUEUE_FILTERS.find(q => q.id === filter) || QUEUE_FILTERS[0];
  const visible = (apps || []).filter(a => f.match(a.status));
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of QUEUE_FILTERS) m[q.id] = (apps || []).filter(a => q.match(a.status)).length;
    return m;
  }, [apps]);

  if (apps === null) return <div className="py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading queue…</div>;

  return (
    <div className="space-y-4">
      <ErrorNote msg={err} />
      <div className="flex flex-wrap gap-1.5">
        {QUEUE_FILTERS.map(q => (
          <button
            key={q.id}
            onClick={() => setFilter(q.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === q.id ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {q.label} <span className="opacity-70">({counts[q.id] || 0})</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Empty icon={CheckCircle2} title={filter === 'open' ? 'Queue is clear' : 'Nothing here'} body={filter === 'open' ? 'No company applications are waiting for review.' : 'No applications match this filter.'} />
      ) : (
        <div className="space-y-4">
          {visible.map(app => (
            <VerificationCard key={app.uid} app={app} actor={actor} expanded={openUid === app.uid} onToggle={() => setOpenUid(openUid === app.uid ? null : app.uid)} />
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationCard({ app, actor, expanded, onToggle }: { app: SellerVerification; actor: Actor | null; expanded: boolean; onToggle: () => void }) {
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntry>>(() => app.checklist || {});
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<null | 'reject' | 'revoke'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    setChecklist(app.checklist || {});
  }, [app.reviewedAt?.toMillis?.()]); // eslint-disable-line react-hooks/exhaustive-deps

  const isShopApp = app.kind === 'shop';
  const docTypes = docTypesFor(app);
  const docs = docTypes.filter(d => app.documents?.[d.key]);
  const requiredDocs = docTypes.filter(d => d.required);
  const phoneChecked = !!checklist.phone?.valid;
  const requiredChecked = requiredDocs.every(d => {
    const c = checklist[d.key];
    return app.documents?.[d.key] && c?.legible && c?.valid && c?.matchesCompany;
  }) && (!isShopApp || phoneChecked);

  const toggle = (key: string, field: keyof ChecklistEntry) =>
    setChecklist(c => ({ ...c, [key]: { ...EMPTY_CHECK, ...c[key], [field]: !(c[key]?.[field] ?? false) } }));

  const openDoc = async (key: string) => {
    const d = app.documents?.[key];
    if (!d) return;
    setOpening(key);
    setErr(null);
    try {
      const url = await getSellerDocUrl(d.path);
      window.open(url, '_blank', 'noopener,noreferrer');
      if (actor) adminLogDocumentOpened(app, key, actor);
    } catch (ex) {
      setErr(`Couldn't open the document: ${friendlyError(ex)} If you're a new admin, add your uid to storage.rules.`);
    } finally {
      setOpening(null);
    }
  };

  const act = async (status: 'under_review' | 'approved' | 'rejected' | 'revoked') => {
    if (!actor) {
      setErr('Sign in again to act on this application.');
      return;
    }
    if ((status === 'rejected' || status === 'revoked') && !reason.trim()) {
      setErr('Give the seller a reason.');
      return;
    }
    if (status === 'approved' && !window.confirm(`Approve ${app.companyName || 'this company'} and grant the Verified badge?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await adminSetVerificationStatus(app, status, actor, { reason, checklist });
      setMode(null);
      setReason('');
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  const reviewable = app.status === 'submitted' || app.status === 'under_review';

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left bg-slate-50/80 dark:bg-slate-800/40 px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {isShopApp && <span className="mr-2 align-middle px-2 py-0.5 rounded-full bg-cobalt-100 dark:bg-cobalt-500/20 text-cobalt-700 dark:text-cobalt-200 text-[10px] font-bold">Shop</span>}
            {app.companyName || 'Unnamed company'}
          </h4>
          <p className="text-[11px] text-slate-500 font-mono">
            {app.registrationNumber || 'no reg. no.'} · submitted {formatTs(app.submittedAt)} · #{app.submissionCount || 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{docs.length}/{docTypes.length} docs</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[app.status]}`}>{STATUS_LABELS[app.status]}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              ['Business registration no.', app.registrationNumber],
              ['VAT number', app.vatNumber || 'Not supplied'],
              ['Country', app.country],
              ['Address', app.address],
              ['Contact', [app.contactName, app.contactEmail, app.contactPhone].filter(Boolean).join(' · ')],
              ['Seller uid', app.uid],
            ].map(([k, v]) => (
              <div key={k}>
                <span className="text-slate-400 block">{k}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 break-words">{v || '—'}</span>
              </div>
            ))}
          </div>

          {(app.rejectionReason && (app.status === 'rejected' || app.status === 'revoked')) && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-300">
              Last reason: {app.rejectionReason} {app.reviewerEmail ? `(by ${app.reviewerEmail}, ${formatTs(app.reviewedAt)})` : ''}
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Document checklist</h5>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <tr>
                    <th className="text-left p-2.5 font-bold">Document</th>
                    <th className="p-2.5 font-bold">Open</th>
                    <th className="p-2.5 font-bold">Legible</th>
                    <th className="p-2.5 font-bold">Valid / current</th>
                    <th className="p-2.5 font-bold">Matches company</th>
                  </tr>
                </thead>
                <tbody>
                  {docTypes.map(d => {
                    const stored = app.documents?.[d.key];
                    const c = checklist[d.key] || EMPTY_CHECK;
                    return (
                      <tr key={d.key} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{d.label}</span>
                          {d.required && <span className="text-red-500"> *</span>}
                          <span className="block text-[10px] text-slate-400 truncate max-w-[220px]">{stored ? `${stored.name} · ${(stored.size / 1024).toFixed(0)} KB` : 'Not uploaded'}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          {stored ? (
                            <button onClick={() => openDoc(d.key)} disabled={opening === d.key} className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 font-bold">
                              {opening === d.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} View <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        {(['legible', 'valid', 'matchesCompany'] as (keyof ChecklistEntry)[]).map(field => (
                          <td key={field} className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              disabled={!stored || !reviewable}
                              checked={!!c[field]}
                              onChange={() => toggle(d.key, field)}
                              className="w-4 h-4 rounded accent-emerald-500"
                              aria-label={`${d.label}: ${field}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isShopApp && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1.5">
                <p className="text-slate-600 dark:text-slate-300">Verified Shop check: 1) search the registration number on the official company register for <span className="font-bold">{app.country || 'its country'}</span> (e.g. <a href="https://bizportal.gov.za" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-300 underline">CIPC / BizPortal</a> South Africa, <a href="https://find-and-update.company-information.service.gov.uk" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-300 underline">Companies House</a> UK, <a href="https://search.cac.gov.ng" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 dark:text-indigo-300 underline">CAC</a> Nigeria, the state business registry in the US) and confirm the name matches; 2) open the shopfront photo; 3) phone <span className="font-bold font-mono">{app.contactPhone || '—'}</span> and confirm it answers as this shop.</p>
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                  <input type="checkbox" disabled={!reviewable} checked={phoneChecked} onChange={() => setChecklist(c => ({ ...c, phone: phoneChecked ? EMPTY_CHECK : { legible: true, valid: true, matchesCompany: true } }))} className="w-4 h-4 rounded accent-emerald-500" />
                  I phoned the shop and it answered as {app.companyName || 'this shop'}
                </label>
              </div>
            )}
            {reviewable && !requiredChecked && <p className="text-[11px] text-slate-500">Tick all three checks on every required document{isShopApp ? ' and the phone check' : ''} to enable Approve.</p>}
          </div>

          {mode && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {mode === 'reject' ? 'Reason for rejection (shown to the seller)' : 'Reason for revoking the badge (shown to the seller)'}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={mode === 'reject' ? 'e.g. Proof of address is older than 3 months. Please upload a recent municipal bill or bank letter.' : 'e.g. The company register shows the company as deregistered.'}
                className={inputCls}
                maxLength={1000}
              />
            </div>
          )}

          <ErrorNote msg={err} />

          <div className="flex flex-wrap gap-2 pt-1">
            {app.status === 'submitted' && (
              <button disabled={busy} onClick={() => act('under_review')} className={ghostBtn}>
                <FileText className="w-4 h-4" /> Start review
              </button>
            )}
            {reviewable && !mode && (
              <>
                <button
                  disabled={busy || !requiredChecked}
                  onClick={() => act('approved')}
                  className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 font-bold text-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />} Approve & verify
                </button>
                <button disabled={busy} onClick={() => setMode('reject')} className={`${ghostBtn} !text-red-600`}>
                  <Ban className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            {app.status === 'approved' && !mode && (
              <button disabled={busy} onClick={() => setMode('revoke')} className={`${ghostBtn} !text-red-600`}>
                <ShieldOff className="w-4 h-4" /> Revoke badge
              </button>
            )}
            {mode && (
              <>
                <button disabled={busy} onClick={() => act(mode === 'reject' ? 'rejected' : 'revoked')} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Confirm {mode === 'reject' ? 'rejection' : 'revocation'}
                </button>
                <button disabled={busy} onClick={() => { setMode(null); setReason(''); }} className={ghostBtn}>Cancel</button>
              </>
            )}
          </div>
          {app.reviewerEmail && <p className="text-[10px] text-slate-400">Last reviewed by {app.reviewerEmail} · {formatTs(app.reviewedAt)}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shops (spare-parts businesses): reports, suspend / restore, revoke badge
// ---------------------------------------------------------------------------

function ShopsModeration({ actor }: { actor: Actor | null }) {
  const [shops, setShops] = useState<SellerProfile[] | null>(null);
  const [reports, setReports] = useState<SellerReport[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'reported' | 'all' | 'suspended'>('all');
  const verified = useVerifiedSellers();
  useEffect(() => subscribeShops(s => { setShops(s); setErr(null); }, e => { setShops([]); setErr(friendlyError(e)); }), []);
  useEffect(() => subscribeSellerReports(setReports, () => setReports([])), []);
  const openByShop = useMemo(() => {
    const m = new Map<string, SellerReport[]>();
    reports.filter(r => r.status === 'open').forEach(r => m.set(r.targetId, [...(m.get(r.targetId) || []), r]));
    return m;
  }, [reports]);
  if (shops === null) return <div className="py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading shops…</div>;
  const visible = shops.filter(s => filter === 'all' || (filter === 'suspended' ? s.suspended : openByShop.has(s.uid)));
  return (
    <div className="space-y-4">
      <ErrorNote msg={err} />
      <div className="flex flex-wrap gap-1.5">
        {([['all', `All (${shops.length})`], ['reported', `Reported (${shops.filter(s => openByShop.has(s.uid)).length})`], ['suspended', `Suspended (${shops.filter(s => s.suspended).length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === id ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Empty icon={CheckCircle2} title="Nothing here" body={filter === 'reported' ? 'No shop has an open report.' : 'No shops match this filter.'} />
      ) : (
        <div className="space-y-3">
          {visible.map(s => <ShopRow key={s.uid} shop={s} reports={openByShop.get(s.uid) || []} verified={verified.has(s.uid)} actor={actor} />)}
        </div>
      )}
    </div>
  );
}

function ShopRow({ shop, reports, verified, actor }: { shop: SellerProfile; reports: SellerReport[]; verified: boolean; actor: Actor | null }) {
  const [mode, setMode] = useState<null | 'suspend' | 'revoke'>(null);
  const [reason, setReason] = useState('');
  const [planNote, setPlanNote] = useState(shop.planNote || '');
  const plan = shopPlan(shop);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    if (!actor) { setErr('Sign in again to act on this shop.'); return; }
    setBusy(true); setErr(null);
    try { await fn(); setMode(null); setReason(''); } catch (ex) { setErr(friendlyError(ex)); } finally { setBusy(false); }
  };
  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {shop.shopfrontUrl ? <img src={shop.shopfrontUrl} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" /> : <div className="w-16 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
              {shop.displayName}
              {verified && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">Verified</span>}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${plan === 'active' ? 'bg-emerald-100 text-emerald-800' : plan === 'expired' ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'}`}>{PLAN_LABELS[plan]}</span>
              {shop.suspended && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 text-[10px] font-bold">Suspended</span>}
              {reports.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">{reports.length} open report{reports.length === 1 ? '' : 's'}</span>}
            </p>
            <p className="text-[11px] text-slate-500">{[shop.address, shop.town, shop.province, shop.country].filter(Boolean).join(', ')}</p>
            <p className="text-[11px] text-slate-500 font-mono">{[shop.phone, shop.whatsapp && `WA ${shop.whatsapp}`, shop.registrationNumber && `Reg ${shop.registrationNumber}`].filter(Boolean).join(' · ')}</p>
            {shop.suspended && shop.suspendedReason && <p className="text-[11px] text-red-600">Reason: {shop.suspendedReason}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {shop.suspended ? (
            <button disabled={busy} onClick={() => run(() => adminSetShopSuspended(shop, false, actor!))} className={ghostBtn}><CheckCircle2 className="w-4 h-4" /> Restore shop</button>
          ) : (
            <button disabled={busy} onClick={() => setMode('suspend')} className={`${ghostBtn} !text-red-600`}><Ban className="w-4 h-4" /> Suspend</button>
          )}
          {verified && <button disabled={busy} onClick={() => setMode('revoke')} className={`${ghostBtn} !text-red-600`}><ShieldOff className="w-4 h-4" /> Revoke badge</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
        <span className="font-bold text-slate-700 dark:text-slate-200">Business plan ({BUSINESS_PLAN_PRICE}):</span>
        {(['trial', 'active', 'expired'] as ShopPlan[]).map(p => (
          <button key={p} disabled={busy || p === plan} onClick={() => run(() => adminSetShopPlan(shop, p, actor!, planNote))}
            className={`px-2.5 py-1 rounded-lg font-bold ${p === plan ? (p === 'active' ? 'bg-emerald-600 text-white' : p === 'expired' ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white') : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {PLAN_LABELS[p]}
          </button>
        ))}
        <input value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="Note for the shop (optional), e.g. Paid until 30 Nov" className="flex-1 min-w-[12rem] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700" maxLength={300} />
        <span className="w-full text-[10px] text-slate-400">No payment is taken in the app. Set "Business plan active" after the shop has paid you, "Plan expired" when it lapses (the shop then drops out of "Where to buy"). Individual sellers never need a plan.</span>
      </div>
      {reports.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-xs space-y-1">
          {reports.slice(0, 6).map(r => <p key={r.id} className="break-words"><span className="font-bold">{r.reason}</span>{r.details ? `: ${r.details}` : ''} <span className="text-slate-400">({formatTs(r.createdAt)})</span></p>)}
          <button disabled={busy} onClick={() => run(() => adminCloseReports(reports.map(r => r.id), actor!, shop.displayName, shop.uid))} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">Mark reports as reviewed</button>
        </div>
      )}
      {mode && (
        <div className="space-y-2">
          <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder={mode === 'suspend' ? 'Reason (shown to the shop owner), e.g. Several buyers reported fake listings.' : 'Reason (shown to the shop owner), e.g. The company register shows the company as deregistered.'} className={inputCls} maxLength={1000} />
          <div className="flex gap-2">
            <button disabled={busy || !reason.trim()} onClick={() => run(() => (mode === 'suspend' ? adminSetShopSuspended(shop, true, actor!, reason) : adminRevokeShopBadge(shop.uid, actor!, reason)))} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Confirm {mode === 'suspend' ? 'suspension' : 'revocation'}
            </button>
            <button disabled={busy} onClick={() => { setMode(null); setReason(''); }} className={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
      <ErrorNote msg={err} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listing moderation
// ---------------------------------------------------------------------------

function ListingModeration({ actor }: { actor: Actor | null }) {
  const [listings, setListings] = useState<ListingDoc[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListingStatus | 'all'>('pending');

  useEffect(
    () =>
      subscribeAllListings(
        l => {
          setListings(l);
          setErr(null);
        },
        e => {
          setListings([]);
          setErr(friendlyError(e));
        }
      ),
    []
  );

  if (listings === null) return <div className="py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading listings…</div>;
  const visible = filter === 'all' ? listings : listings.filter(l => l.status === filter);
  const count = (s: ListingStatus) => listings.filter(l => l.status === s).length;

  return (
    <div className="space-y-4">
      <ErrorNote msg={err} />
      <div className="flex flex-wrap gap-1.5">
        {([['pending', `Awaiting review (${count('pending')})`], ['active', `Live (${count('active')})`], ['removed', `Removed (${count('removed')})`], ['all', `All (${listings.length})`]] as [ListingStatus | 'all', string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === id ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Empty icon={Package} title="Nothing here" body={filter === 'pending' ? 'No listings are waiting for approval.' : 'No listings match this filter.'} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map(l => <ModerationRow key={l.id} listing={l} actor={actor} />)}
        </div>
      )}
    </div>
  );
}

function ModerationRow({ listing, actor }: { listing: ListingDoc; actor: Actor | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');

  const run = async (fn: (a: Actor) => Promise<void>) => {
    if (!actor) return setErr('Sign in again to moderate.');
    setBusy(true);
    setErr(null);
    try {
      await fn(actor);
      setRemoving(false);
      setReason('');
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardCls} !rounded-2xl p-3 flex gap-3`}>
      {listing.imageUrl ? (
        <img src={listing.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-[10px] text-slate-400">No photo</div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{listing.title}</p>
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">{formatZar(listing.price, listing.currency)}</span>
        </div>
        <p className="text-[11px] text-slate-500">
          {listing.sellerName} ({listing.sellerType}) · {listing.category} · {listing.condition} · {formatTs(listing.createdAt)}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{listing.description || <i>No description</i>}</p>
        {listing.status === 'removed' && listing.moderationReason && <p className="text-[11px] text-red-600">Removed: {listing.moderationReason}</p>}
        {removing && (
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (shown to the seller), e.g. counterfeit item, prohibited goods" className={`${inputCls} !text-xs`} maxLength={1000} />
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {listing.status !== 'active' && !removing && (
            <button disabled={busy} onClick={() => run(a => adminModerateListing(listing, 'active', a))} className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {listing.status !== 'removed' && !removing && (
            <button disabled={busy} onClick={() => setRemoving(true)} className={`${ghostBtn} !text-red-600 !py-1.5`}>
              <Ban className="w-3.5 h-3.5" /> Remove
            </button>
          )}
          {removing && (
            <>
              <button disabled={busy || !reason.trim()} onClick={() => run(a => adminModerateListing(listing, 'removed', a, reason))} className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-50">Confirm remove</button>
              <button disabled={busy} onClick={() => setRemoving(false)} className={`${ghostBtn} !py-1.5`}>Cancel</button>
            </>
          )}
          {listing.status === 'removed' && (
            <button
              disabled={busy}
              onClick={() => window.confirm(`Permanently delete "${listing.title}"?`) && run(a => adminDeleteListing(listing, a, 'Deleted after removal'))}
              className={`${ghostBtn} !py-1.5`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
        <ErrorNote msg={err} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  'verification.start_review': 'Started review',
  'verification.approve': 'Approved company',
  'verification.reject': 'Rejected application',
  'verification.revoke': 'Revoked badge',
  'verification.open_document': 'Opened document',
  'listing.approve': 'Approved listing',
  'listing.remove': 'Removed listing',
  'listing.set_pending': 'Sent listing back to review',
  'listing.delete': 'Deleted listing',
};

function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(
    () =>
      subscribeAuditLog(
        a => {
          setEntries(a);
          setErr(null);
        },
        e => {
          setEntries([]);
          setErr(friendlyError(e));
        }
      ),
    []
  );
  if (entries === null) return <div className="py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading audit log…</div>;
  return (
    <div className="space-y-3">
      <ErrorNote msg={err} />
      {entries.length === 0 ? (
        <Empty icon={History} title="No admin actions yet" body="Approvals, rejections, revocations, document views and listing moderation will be recorded here." />
      ) : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
              <tr>
                <th className="text-left p-3 font-bold">When</th>
                <th className="text-left p-3 font-bold">Admin</th>
                <th className="text-left p-3 font-bold">Action</th>
                <th className="text-left p-3 font-bold">Target</th>
                <th className="text-left p-3 font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="p-3 whitespace-nowrap text-slate-500">{formatTs(e.at)}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{e.actorEmail || e.actorUid}</td>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{ACTION_LABELS[e.action] || e.action}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{e.targetLabel || e.targetId}<span className="block text-[10px] text-slate-400">{e.targetType}</span></td>
                  <td className="p-3 text-slate-500 max-w-xs break-words">{e.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
