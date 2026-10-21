import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TranslatableVideo, YouTubeCaptionPicker, youtubeWithCaptions } from '../VideoTranslator';
import { USER_CONTENT_NOTE, CONTENT_POLICY_POINTS } from '../../config/policy';
import {
  AlertTriangle, CheckCircle, Film, Flag, Link2, Loader2, LogIn, Pencil, Play, Plus, ThumbsUp, Trash2, Upload, Video, X, ShieldOff,
} from 'lucide-react';
import { useAdminStatus, useAuthUser } from '../../lib/admin';
import { isFirebaseConfigured } from '../../lib/firebase';
import { storage as localStore } from '../../lib/storage';
import { RouteLink } from '../../hooks/usePathname';
import type { Solution } from '../../data/catalog';
import {
  ALLOWED_VIDEO_TYPES, DESCRIPTION_MAX, TITLE_MAX,
  adminSetVideoStatus, createLinkVideo, createUploadVideo, deleteVideo, friendlyError, hasReported, parseVideoLink,
  reportVideo, subscribeModelVideos, subscribeMyVideos, toggleHelpful, updateVideoDetails, useHelpfulMark, validateVideoFile, videoMillis,
  type CommunityVideo, type OwnerInfo, type UploadHandle, type VideoTarget,
} from '../../lib/communityVideos';
import { OwnershipGuard, useOwnershipGate } from '../OwnershipAgreementModal';
import { isOwnershipSensitive } from '../../lib/ownershipAgreement';

// Circuit Mint styling: indigo/violet primary, mint (emerald) accents.
const card = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm';
const primaryBtn = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-colors';
const ghostBtn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors';
const dangerBtn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors';
const inputCls = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400';

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ms).toLocaleDateString('en-ZA', { dateStyle: 'medium' });
}

function ownerInfo(user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): OwnerInfo {
  const p = localStore.getUserProfile() as any;
  const local = p && (p.uid === user.uid || !p.uid) && p.name && p.name !== 'Guest' ? p.name : '';
  const name = user.displayName || local || (user.email ? user.email.split('@')[0] : '') || 'Community member';
  return { uid: user.uid, name, photo: user.photoURL || undefined };
}

// ------------------------------------------------------------------
// Section shown on a model / size solutions page and on a single solution
// ------------------------------------------------------------------

export default function CommunityVideosSection({
  target, solutions, solution, onOpenAuth,
}: {
  target: VideoTarget;
  solutions: Solution[] | null;
  /** When set, only videos for this solution are shown and new ones are tagged with it. */
  solution?: Solution;
  onOpenAuth?: () => void;
}) {
  const user = useAuthUser();
  const admin = useAdminStatus();
  const [videos, setVideos] = useState<CommunityVideo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [needSignIn, setNeedSignIn] = useState(false);

  useEffect(() => {
    setVideos(null);
    setErr(null);
    return subscribeModelVideos(target, v => { setVideos(v); setErr(null); }, e => { setVideos([]); setErr(friendlyError(e)); });
  }, [target.deviceType, target.brand, target.model]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the sign-in nudge once the user signs in.
  useEffect(() => { if (user && needSignIn) { setNeedSignIn(false); setSharing(true); } }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => (videos || []).filter(v =>
    (!target.size || !v.size || v.size === target.size) &&
    (!solution || v.solutionId === solution.id)), [videos, target.size, solution]);

  const solutionTitle = (id?: string) => (id && solutions ? solutions.find(s => s.id === id)?.title : undefined);

  const onShare = () => {
    if (!isFirebaseConfigured) { setErr('Video sharing needs the cloud database, which is not configured for this build.'); return; }
    if (!user) { setNeedSignIn(true); onOpenAuth?.(); return; }
    setSharing(true);
  };

  return (
    <section aria-labelledby="community-videos-h" className={`${card} p-5 space-y-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="community-videos-h" className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center"><Film className="w-4 h-4" /></span>
            Community video tutorials
            {videos && visible.length > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">{visible.length}</span>}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {solution ? `Repair videos for “${solution.title}” on the ${target.deviceLabel}.` : `Fixes filmed by other repairers for the ${target.deviceLabel}.`}
          </p>
        </div>
        <button onClick={onShare} className={`${primaryBtn} shrink-0`}><Plus className="w-4 h-4" /> Share a repair video</button>
      </div>

      {needSignIn && !user && (
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-800 dark:text-indigo-200 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><LogIn className="w-4 h-4 shrink-0" /> Sign in to share a video. Anyone can watch without an account.</span>
          {onOpenAuth && <button onClick={onOpenAuth} className={primaryBtn}>Sign in</button>}
        </div>
      )}
      {err && <ErrorNote msg={err} />}

      {videos === null ? (
        <div className="py-8 text-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading videos…</div>
      ) : visible.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Video className="w-8 h-8 mx-auto text-emerald-500" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No community videos yet — be the first to share a fix</p>
          <p className="text-xs text-slate-500">Upload a clip (MP4, WebM or MOV up to 200 MB) or paste a YouTube or Vimeo link.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(v => (
            <VideoCard key={v.id} video={v} uid={user?.uid || null} canModerate={admin.isAdmin}
              actor={admin.uid ? { uid: admin.uid, email: admin.email } : null}
              solutionTitle={v.solutionTitle || solutionTitle(v.solutionId)}
              solutionHref={!solution && v.solutionId ? `${target.pagePath}/${encodeURIComponent(v.solutionId)}` : undefined}
              onNeedAuth={() => { setNeedSignIn(true); onOpenAuth?.(); }} />
          ))}
        </div>
      )}

      {sharing && user && (
        <ShareVideoModal target={target} solutions={solutions} fixedSolution={solution} owner={ownerInfo(user)} onClose={() => setSharing(false)} />
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// Video card + lazy player
// ------------------------------------------------------------------

function VideoPlayer({ video }: { video: CommunityVideo }) {
  const [play, setPlay] = useState(false);
  const [ytLang, setYtLang] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (video.kind !== 'upload' || inView) return;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setInView(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [video.kind, inView]);

  return (
    <div ref={boxRef} className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950">
      {video.kind === 'youtube' && <YouTubeCaptionPicker lang={ytLang} onChange={(c) => { setYtLang(c); setPlay(true); }} />}
      {video.kind === 'upload' ? (
        inView ? (
          <TranslatableVideo src={video.url} title={video.title} className="w-full h-full" />
        ) : <div className="w-full h-full" />
      ) : play ? (
        <iframe
          key={ytLang}
          src={ytLang && video.kind === 'youtube' ? youtubeWithCaptions(`${video.url}${video.url.includes('?') ? '&' : '?'}autoplay=1`, ytLang) : `${video.url}${video.url.includes('?') ? '&' : '?'}autoplay=1`}
          title={video.title}
          className="w-full h-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button onClick={() => setPlay(true)} className="group w-full h-full flex items-center justify-center" aria-label={`Play ${video.title}`}>
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="absolute inset-0 ds-hero" />
          )}
          <span className="relative w-14 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 group-hover:scale-105 transition-transform">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </span>
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold uppercase">{video.kind === 'youtube' ? 'YouTube' : 'Vimeo'}</span>
        </button>
      )}
    </div>
  );
}

function VideoCard({ video: v, uid, canModerate, actor, solutionTitle, solutionHref, onNeedAuth, showDevice }: {
  video: CommunityVideo; uid: string | null; canModerate: boolean; actor: { uid: string; email: string | null } | null;
  solutionTitle?: string; solutionHref?: string; onNeedAuth?: () => void; showDevice?: boolean;
}) {
  const isOwner = !!uid && uid === v.ownerUid;
  const marked = useHelpfulMark(v.id, uid);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { if (uid && !isOwner) hasReported(v.id, uid).then(setReported); }, [v.id, uid, isOwner]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 flex flex-col gap-3">
      <OwnershipGuard compact texts={[v.title, v.description, v.solutionTitle]}><VideoPlayer video={v} /></OwnershipGuard>
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">{v.title}</h3>
          {v.status === 'removed' && <span className="shrink-0 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold uppercase">Removed</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
          {v.ownerPhoto ? <img src={v.ownerPhoto} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">{(v.ownerName || '?').charAt(0).toUpperCase()}</span>}
          <span className="font-bold text-slate-700 dark:text-slate-300">{isOwner ? 'You' : v.ownerName}</span>
          <span>· {timeAgo(videoMillis(v))}</span>
          {v.size && <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px] font-bold uppercase">{v.size}</span>}
        </div>
        {showDevice && <RouteLink to={v.pagePath} className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate">{v.deviceLabel}</RouteLink>}
        {solutionTitle && (
          solutionHref
            ? <RouteLink to={solutionHref} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:underline">Fixes: {solutionTitle}</RouteLink>
            : <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">Fixes: {solutionTitle}</span>
        )}
        {v.description && (
          <p className={`text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line break-words ${expanded ? '' : 'line-clamp-3'}`}>
            {v.description}
          </p>
        )}
        {v.description && v.description.length > 180 && <button onClick={() => setExpanded(x => !x)} className="text-[11px] font-bold text-indigo-600 hover:underline">{expanded ? 'Show less' : 'Show more'}</button>}
      </div>

      {err && <ErrorNote msg={err} />}

      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
        {!isOwner && v.status === 'published' && (
          <button
            disabled={busy || marked === null}
            onClick={() => { if (!uid) return onNeedAuth?.(); run(() => toggleHelpful(v, uid, !!marked)); }}
            className={`${marked ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 disabled:opacity-50' : ghostBtn}`}
            aria-pressed={!!marked}
          >
            <ThumbsUp className="w-3.5 h-3.5" /> Helpful{v.helpfulCount > 0 ? ` · ${v.helpfulCount}` : ''}
          </button>
        )}
        {isOwner && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 flex items-center gap-1 px-1"><ThumbsUp className="w-3.5 h-3.5" /> {v.helpfulCount || 0} found it helpful</span>}
        {!isOwner && v.status === 'published' && (
          reported
            ? <span className="text-[11px] text-slate-400 flex items-center gap-1 px-1"><Flag className="w-3.5 h-3.5" /> Reported</span>
            : <button disabled={busy} onClick={() => { if (!uid) return onNeedAuth?.(); setReporting(true); }} className={ghostBtn}><Flag className="w-3.5 h-3.5" /> Report</button>
        )}
        <div className="flex-1" />
        {isOwner && v.status === 'published' && <button disabled={busy} onClick={() => setEditing(true)} className={ghostBtn}><Pencil className="w-3.5 h-3.5" /> Edit</button>}
        {(isOwner || canModerate) && <button disabled={busy} onClick={() => setConfirmDelete(true)} className={`${ghostBtn} !text-rose-600`}><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
        {canModerate && !isOwner && v.status === 'published' && actor && (
          <button disabled={busy} onClick={() => run(() => adminSetVideoStatus(v, 'removed', actor, 'Removed from solutions page'))} className={ghostBtn} title="Hide this video (admin)"><ShieldOff className="w-3.5 h-3.5" /> Remove</button>
        )}
      </div>

      <p className="text-[10px] leading-snug text-slate-400">{USER_CONTENT_NOTE}</p>
      {editing && <EditVideoModal video={v} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this video?"
          body={isOwner ? 'Your video and its file will be permanently deleted. This can’t be undone.' : `As an admin you are permanently deleting “${v.title}” by ${v.ownerName}. This is recorded in the audit log.`}
          confirmLabel="Delete video"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { await deleteVideo(v, isOwner ? null : actor); }}
        />
      )}
      {reporting && uid && (
        <ReportDialog onCancel={() => setReporting(false)} onSubmit={async (reason) => { await reportVideo(v, uid, reason); setReported(true); setReporting(false); }} />
      )}
    </article>
  );
}

// ------------------------------------------------------------------
// Dialogs
// ------------------------------------------------------------------

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`${card} w-full ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={title} onClose={() => !busy && onCancel()}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{body}</p>
      {err && <ErrorNote msg={err} />}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className={ghostBtn}>Cancel</button>
        <button disabled={busy} className={dangerBtn} onClick={async () => {
          setBusy(true); setErr(null);
          try { await onConfirm(); onCancel(); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
        }}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {confirmLabel}</button>
      </div>
    </Modal>
  );
}

// Repair videos are never removed for the repair method; only inappropriate pictures/video (or spam) are reported.
const REPORT_REASONS = ['Sexual or nude content', 'Violence, assault or gore', 'Hate or threats', 'Spam or advertising', 'Other'];

function ReportDialog({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Report this video" onClose={() => !busy && onCancel()}>
      <div className="space-y-2">
        {REPORT_REASONS.map(r => (
          <label key={r} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-indigo-600" /> {r}
          </label>
        ))}
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={400} rows={2} placeholder="Anything moderators should know? (optional)" className={inputCls} />
      </div>
      {err && <ErrorNote msg={err} />}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className={ghostBtn}>Cancel</button>
        <button disabled={busy} className={primaryBtn} onClick={async () => {
          setBusy(true); setErr(null);
          try { await onSubmit(note.trim() ? `${reason}: ${note.trim()}` : reason); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
        }}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />} Send report</button>
      </div>
    </Modal>
  );
}

function EditVideoModal({ video, onClose }: { video: CommunityVideo; onClose: () => void }) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Edit video details" onClose={() => !busy && onClose()}>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Title *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={TITLE_MAX} className={inputCls} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={4} className={inputCls} />
      </label>
      {err && <ErrorNote msg={err} />}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className={ghostBtn}>Cancel</button>
        <button disabled={busy || !title.trim()} className={primaryBtn} onClick={async () => {
          setBusy(true); setErr(null);
          try { await updateVideoDetails(video.id, { title, description }); onClose(); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
        }}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Save</button>
      </div>
    </Modal>
  );
}

function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function ShareVideoModal({ target, solutions, fixedSolution, owner, onClose }: {
  target: VideoTarget; solutions: Solution[] | null; fixedSolution?: Solution; owner: OwnerInfo; onClose: () => void;
}) {
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [solutionId, setSolutionId] = useState(fixedSolution?.id || '');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { gate, modal: ownershipModal } = useOwnershipGate();
  const handle = useRef<UploadHandle | null>(null);

  const parsed = link.trim() ? parseVideoLink(link) : null;
  const fileErr = file ? validateVideoFile(file) : null;
  const canSubmit = !!title.trim() && !busy && (mode === 'upload' ? !!file && !fileErr : !!parsed);
  const solTitle = solutionId ? (fixedSolution?.id === solutionId ? fixedSolution.title : solutions?.find(s => s.id === solutionId)?.title) : undefined;

  const close = () => {
    if (handle.current && busy) handle.current.task.cancel();
    onClose();
  };

  const submit = async () => {
    // FRP / unlock / account-removal content: the uploader confirms the Ownership Agreement first.
    if (isOwnershipSensitive(title, description, solTitle) && !(await gate('upload'))) {
      setErr('Upload cancelled: FRP and unlock videos can only be shared after accepting the Ownership Agreement.');
      return;
    }
    setErr(null); setBusy(true);
    const fields = { title, description, solutionId: solutionId || undefined, solutionTitle: solTitle };
    try {
      if (mode === 'link') {
        await createLinkVideo(target, fields, owner, link);
      } else if (file) {
        setProgress(0);
        handle.current = createUploadVideo(target, fields, owner, file, setProgress);
        await handle.current.done;
      }
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr((e as Error).message || friendlyError(e));
      setProgress(null);
      setBusy(false);
    } finally {
      handle.current = null;
    }
  };

  return (
    <Modal title="Share a repair video" onClose={close} wide>
      <p className="text-xs text-slate-500 -mt-2">For the <span className="font-bold text-slate-700 dark:text-slate-300">{target.deviceLabel}</span>. It will appear under this model’s solutions.</p>
      {ownershipModal}

      <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 gap-1" role="tablist">
        {([['upload', 'Upload a file', Upload], ['link', 'YouTube / Vimeo link', Link2]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={mode === id} disabled={busy} onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold ${mode === id ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div className="space-y-2">
          <label className={`flex flex-col items-center justify-center gap-1 p-5 rounded-2xl border-2 border-dashed cursor-pointer text-center ${file ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-400/5' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400'}`}>
            <Upload className="w-6 h-6 text-indigo-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 break-all">{file ? file.name : 'Choose a video'}</span>
            <span className="text-[11px] text-slate-500">{file ? formatBytes(file.size) : 'MP4, WebM or MOV · under 200 MB'}</span>
            <input type="file" accept={ALLOWED_VIDEO_TYPES.join(',')} className="sr-only" disabled={busy}
              onChange={e => { setFile(e.target.files?.[0] || null); setErr(null); }} />
          </label>
          {fileErr && <ErrorNote msg={fileErr} />}
          {progress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300"><span>Uploading…</span><span>{progress}%</span></div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input value={link} onChange={e => setLink(e.target.value)} disabled={busy} placeholder="https://youtu.be/… or https://vimeo.com/…" className={inputCls} inputMode="url" />
          {link.trim() && !parsed && <p className="text-[11px] text-rose-600">That doesn’t look like a YouTube or Vimeo video link.</p>}
          {parsed && (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              {parsed.thumbnailUrl
                ? <img src={parsed.thumbnailUrl} alt="" className="w-24 aspect-video rounded-lg object-cover" referrerPolicy="no-referrer" />
                : <div className="w-24 aspect-video rounded-lg ds-hero flex items-center justify-center"><Play className="w-5 h-5 text-white" /></div>}
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {parsed.kind === 'youtube' ? 'YouTube' : 'Vimeo'} video found</span>
            </div>
          )}
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Title *</span>
        <input value={title} onChange={e => setTitle(e.target.value)} disabled={busy} maxLength={TITLE_MAX} placeholder="e.g. Replacing the power board capacitors" className={inputCls} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Which fault does it fix?</span>
        {fixedSolution ? (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 text-xs font-bold text-emerald-700 dark:text-emerald-300">{fixedSolution.title}</div>
        ) : (
          <select value={solutionId} onChange={e => setSolutionId(e.target.value)} disabled={busy} className={inputCls}>
            <option value="">General / not one listed</option>
            {(solutions || []).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} disabled={busy} maxLength={DESCRIPTION_MAX} rows={3} placeholder="Tools used, part numbers, safety tips…" className={inputCls} />
      </label>

      <p className="text-[11px] text-slate-500">Only share videos you filmed or have the right to share. You can edit or delete it any time from the video or from My videos in Progress.</p>
      <details className="text-[11px] text-slate-500 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5">
        <summary className="font-semibold cursor-pointer">Content policy</summary>
        <ul className="mt-1.5 list-disc pl-4 space-y-0.5">{CONTENT_POLICY_POINTS.map(p => <li key={p}>{p}</li>)}</ul>
        <p className="mt-1.5">{USER_CONTENT_NOTE}</p>
      </details>
      {err && <ErrorNote msg={err} />}
      {done && <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Shared! Thanks for helping other repairers.</div>}

      <div className="flex justify-end gap-2">
        <button onClick={close} className={ghostBtn}>{busy && mode === 'upload' ? 'Cancel upload' : 'Cancel'}</button>
        <button onClick={submit} disabled={!canSubmit || done} className={primaryBtn}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {busy ? (mode === 'upload' ? 'Uploading…' : 'Sharing…') : 'Share video'}
        </button>
      </div>
    </Modal>
  );
}

function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// "My videos" (Progress page)
// ------------------------------------------------------------------

export function MyVideosPanel({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const user = useAuthUser();
  const [videos, setVideos] = useState<CommunityVideo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setVideos([]); return; }
    setVideos(null);
    return subscribeMyVideos(user.uid, v => { setVideos(v); setErr(null); }, e => { setVideos([]); setErr(friendlyError(e)); });
  }, [user]);

  return (
    <section className={`${card} p-5 space-y-4`} aria-labelledby="my-videos-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-videos-h" className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center"><Film className="w-4 h-4" /></span>
          My videos
        </h2>
        <RouteLink to="/devices" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Find a device to share a fix</RouteLink>
      </div>
      {!isFirebaseConfigured ? (
        <p className="text-xs text-slate-500">Video sharing needs the cloud database, which is not configured for this build.</p>
      ) : !user ? (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>Sign in to see and manage the repair videos you’ve shared.</span>
          {onOpenAuth && <button onClick={onOpenAuth} className={primaryBtn}><LogIn className="w-3.5 h-3.5" /> Sign in</button>}
        </div>
      ) : videos === null ? (
        <div className="py-6 text-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading your videos…</div>
      ) : (
        <>
          {err && <ErrorNote msg={err} />}
          {videos.length === 0 ? (
            <p className="text-xs text-slate-500">You haven’t shared any repair videos yet. Open any model’s solutions page and tap “Share a repair video”.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.map(v => (
                <VideoCard key={v.id} video={v} uid={user.uid} canModerate={false} actor={null} solutionTitle={v.solutionTitle} showDevice />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export { VideoCard as CommunityVideoCard };
