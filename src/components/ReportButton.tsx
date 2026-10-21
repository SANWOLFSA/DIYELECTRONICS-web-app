import { useEffect, useState } from 'react';
import { Flag, Star, X, Loader2, CheckCircle2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { REPORT_REASONS, hasReported, submitReport, submitReview, useCommunityReviews, type ReportTarget } from '../lib/reports';
import { CONTENT_POLICY_SHORT } from '../config/policy';
import { requestSignIn } from '../lib/signInGate';

/** "Report" button + form (reason, details, optional star review). Reports go to admins; nothing is blocked automatically. */
export function ReportButton({ targetType, targetId, targetLabel, allowReview = true, onNeedAuth, className = '' }: {
  targetType: ReportTarget; targetId: string; targetLabel: string; allowReview?: boolean; onNeedAuth?: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const uid = auth.currentUser?.uid || null;
  useEffect(() => { if (uid) hasReported(targetType, targetId, uid).then(setDone); }, [uid, targetType, targetId]);
  if (uid && uid === targetId) return null; // you cannot report yourself
  return (
    <>
      <button type="button" onClick={() => (uid ? setOpen(true) : (onNeedAuth ? onNeedAuth() : requestSignIn('Sign in to report or review.')))}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 ${className}`}>
        <Flag className="w-3.5 h-3.5" /> {done ? 'Reported' : 'Report'}
      </button>
      {open && uid && <ReportDialog targetType={targetType} targetId={targetId} targetLabel={targetLabel} uid={uid} allowReview={allowReview} onClose={(sent) => { setOpen(false); if (sent) setDone(true); }} />}
    </>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(value === n ? 0 : n)} className="p-0.5" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          <Star className={`w-6 h-6 ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
        </button>
      ))}
    </div>
  );
}

function ReportDialog({ targetType, targetId, targetLabel, uid, allowReview, onClose }: { targetType: ReportTarget; targetId: string; targetLabel: string; uid: string; allowReview: boolean; onClose: (sent: boolean) => void }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      await submitReport({ targetType, targetId, targetLabel, reporterUid: uid, reason, details });
      if (allowReview && rating > 0) {
        await submitReview({ targetType, targetId, reviewerUid: uid, reviewerName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Member', rating, comment });
      }
      setSent(true);
    } catch (e: any) {
      setErr(/permission/i.test(String(e?.message)) ? 'You have already reported this, or you need to sign in again.' : 'Could not send the report. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && onClose(sent)}>
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-2">
          <div><p className="font-semibold text-slate-900 dark:text-white">Report {targetType === 'user' || targetType === 'seller' ? 'this person' : `this ${targetType}`}</p><p className="text-xs text-slate-500 truncate">{targetLabel}</p></div>
          <button type="button" onClick={() => onClose(sent)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        {sent ? (
          <div className="text-center py-4 space-y-2"><CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" /><p className="text-sm font-semibold">Thanks, an admin will review it.</p>{rating > 0 && <p className="text-xs text-slate-500">Your review has been posted.</p>}</div>
        ) : (
          <>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-rose-600" /> {r}</label>
              ))}
            </fieldset>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Details (what happened, where)" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[16px] sm:text-sm" />
            {allowReview && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Leave a review too (optional, shown publicly)</p>
                <StarInput value={rating} onChange={setRating} />
                {rating > 0 && <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000} placeholder="Your experience" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[16px] sm:text-sm" />}
              </div>
            )}
            <p className="text-[11px] text-slate-400">{CONTENT_POLICY_SHORT}</p>
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => onClose(false)} className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" disabled={busy} onClick={send} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />} Send report</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Community reviews for a person / seller / listing (public). */
export function CommunityReviews({ targetType, targetId, title = 'Community reviews' }: { targetType: ReportTarget; targetId: string; title?: string }) {
  const list = useCommunityReviews(targetType, targetId);
  if (!list.length) return null;
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">{title} · <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {avg.toFixed(1)} ({list.length})</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {list.map((r) => (
          <div key={r.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{r.reviewerName}</span>
              <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />)}</span>
            </div>
            {r.comment && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
