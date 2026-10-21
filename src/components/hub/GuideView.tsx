// Guide page: /guides/view/:id — numbered steps with images, tools & parts (fix kit) with shop links,
// difficulty / time, "I fixed it" counter, comments on every step and on the whole guide.
import { useEffect, useMemo, useState } from 'react';
import { WhereToBuy } from '../PartsFinderPanels';
import { TranslatableVideo } from '../VideoTranslator';
import { USER_CONTENT_NOTE } from '../../config/policy';
import { Clock, CheckCircle2, MessageSquare, Pencil, Trash2, Wrench, Package, AlertTriangle, ShieldOff, ArrowLeft, X, Share2, Check } from 'lucide-react';
import { usePathname, navigate, RouteLink } from '../../hooks/usePathname';
import { useAdminStatus } from '../../lib/admin';
import {
  subscribeGuide, subscribeCompletion, setCompletion, subscribeGuideComments, addGuideComment, deleteGuideComment, deleteGuide,
  adminSetStatus, friendlyHubError, partSearchLinks, timeAgo, millis, KIND_LABELS, LIMITS,
  type HubGuide, type GuideComment,
} from '../../lib/repairHub';
import { PageShell, card, input, btnPrimary, btnMint, btnGhost, btnDanger, Chip, DIFF_STYLE, ErrorNote, Notice, Loading, SignInPrompt, ExtLink, useHubUser } from './ui';
import { OwnershipGuard } from '../OwnershipAgreementModal';

function CommentThread({ guide, stepIndex, comments, onOpenAuth }: { guide: HubGuide; stepIndex: number; comments: GuideComment[]; onOpenAuth?: () => void }) {
  const { uid, owner } = useHubUser();
  const admin = useAdminStatus();
  const [open, setOpen] = useState(stepIndex === -1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const list = comments.filter((c) => c.stepIndex === stepIndex);
  const post = async () => {
    if (!owner) return;
    setBusy(true); setErr('');
    try { await addGuideComment(guide.id, stepIndex, text, owner); setText(''); } catch (e) { setErr(friendlyHubError(e, 'post the comment')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1">
        <MessageSquare className="w-3.5 h-3.5" /> {list.length ? `${list.length} comment${list.length === 1 ? '' : 's'}` : 'Add a comment'}
      </button>
      {open && (
        <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
          {list.map((c) => (
            <div key={c.id} className="text-xs">
              <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{c.body}</div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">{c.ownerName} · {timeAgo(millis(c.createdAt))}
                {(c.ownerUid === uid || admin.isAdmin) && <button onClick={() => deleteGuideComment(c.id).catch(() => undefined)} className="hover:text-rose-600">Delete</button>}
              </div>
            </div>
          ))}
          {guide.status !== 'published' ? <p className="text-[11px] text-slate-500">Comments open once the guide is published.</p> : owner ? (
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={LIMITS.comment} placeholder={stepIndex === -1 ? 'Comment on this guide' : `Comment on step ${stepIndex + 1}`} className={input} />
              <button onClick={post} disabled={busy || !text.trim()} className={btnPrimary}>Post</button>
            </div>
          ) : <SignInPrompt action="comment" onOpenAuth={onOpenAuth} />}
          {err && <ErrorNote message={err} />}
        </div>
      )}
    </div>
  );
}

export default function GuideView({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { pathname } = usePathname();
  const id = decodeURIComponent(pathname.split('/')[3] || '');
  const { uid } = useHubUser();
  const admin = useAdminStatus();
  const [guide, setGuide] = useState<HubGuide | null | undefined>(undefined);
  const [loadErr, setLoadErr] = useState('');
  const [done, setDone] = useState(false);
  const [comments, setComments] = useState<GuideComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeGuide(id, setGuide, (e) => { setGuide(null); setLoadErr(friendlyHubError(e, 'open this guide')); }), [id]);
  useEffect(() => subscribeCompletion(id, uid, setDone), [id, uid]);
  useEffect(() => subscribeGuideComments(id, setComments, () => setComments([])), [id]);
  useEffect(() => { if (guide) document.title = `${guide.title} · DIY Electronics`; }, [guide]);

  const isOwner = !!guide && guide.ownerUid === uid;
  const totalImages = useMemo(() => (guide?.steps || []).reduce((a, s) => a + (s.imageUrls?.length || 0), 0), [guide]);

  if (guide === undefined) return <PageShell><Loading label="Opening guide…" /></PageShell>;
  if (!guide) return <PageShell><ErrorNote message={loadErr || 'This guide does not exist, was removed, or is a private draft.'} /><RouteLink to="/guides" className={btnGhost}>Back to guides</RouteLink></PageShell>;

  const toggleDone = async () => {
    if (!uid) { onOpenAuth?.(); return; }
    setBusy(true); setErr('');
    try { await setCompletion(guide.id, uid, !done); } catch (e) { setErr(friendlyHubError(e, 'update your completion')); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this guide permanently?')) return;
    try { await deleteGuide(guide.id); navigate('/guides'); } catch (e) { setErr(friendlyHubError(e, 'delete the guide')); }
  };
  const moderate = async (status: 'removed' | 'published') => {
    if (!admin.uid) return;
    const reason = status === 'removed' ? window.prompt('Reason for removing this guide?') || '' : '';
    try { await adminSetStatus('guides', guide.id, status, { uid: admin.uid, email: admin.email }, guide.title, reason); } catch (e) { setErr(friendlyHubError(e, 'moderate the guide')); }
  };

  return (
    <PageShell>
      <RouteLink to={guide.kind === 'teardown' ? '/teardowns' : '/guides'} className="text-xs font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> {guide.kind === 'teardown' ? 'Teardowns' : 'Guides'}</RouteLink>
      {guide.status === 'draft' && <Notice>Draft: only you can see this guide. Publish it from the editor when it is ready.</Notice>}
      {guide.status === 'removed' && <Notice>This guide was removed by a moderator{guide.moderationReason ? `: ${guide.moderationReason}` : '.'}</Notice>}
      {err && <ErrorNote message={err} />}

      <div className={`${card} p-5 sm:p-6 grid md:grid-cols-[1fr,260px] gap-6`}>
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Chip className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{KIND_LABELS[guide.kind]}</Chip>
            <Chip className={DIFF_STYLE[guide.difficulty]}>Difficulty: {guide.difficulty}</Chip>
            <Chip><Clock className="w-3 h-3" /> {guide.minutes >= 120 ? `${Math.round(guide.minutes / 6) / 10} h` : `${guide.minutes} min`}</Chip>
            <Chip>{guide.steps.length} steps{totalImages ? ` · ${totalImages} images` : ''}</Chip>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 leading-tight">{guide.title}</h1>
          <div className="text-xs text-slate-500">
            For <RouteLink to={guide.devicePath} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{guide.deviceLabel}</RouteLink>
            {' '}· by <RouteLink to="/contributors" className="font-bold hover:underline">{guide.ownerName}</RouteLink> · updated {timeAgo(millis(guide.updatedAt))}
          </div>
          {guide.summary && <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{guide.summary}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={toggleDone} disabled={busy || guide.status !== 'published'} className={done ? btnGhost : btnMint}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {done ? 'You fixed it' : 'I fixed it'} · {guide.completedCount}
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }} className={btnGhost}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Share'}
            </button>
            {isOwner && <RouteLink to={`/guides/edit/${guide.id}`} className={btnGhost}><Pencil className="w-3.5 h-3.5" /> Edit</RouteLink>}
            {isOwner && <button onClick={remove} className={btnDanger}><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
            {admin.isAdmin && !isOwner && guide.status !== 'removed' && <button onClick={() => moderate('removed')} className={btnDanger}><ShieldOff className="w-3.5 h-3.5" /> Remove (admin)</button>}
            {admin.isAdmin && guide.status === 'removed' && <button onClick={() => moderate('published')} className={btnGhost}>Restore (admin)</button>}
          </div>
        </div>
        {guide.coverUrl ? <img src={guide.coverUrl} alt="" className="w-full aspect-[4/3] object-cover rounded-xl bg-slate-100" /> : null}
      </div>

      {/* FRP / unlock / account-removal guides stay hidden until the Ownership Agreement is accepted. */}
      <OwnershipGuard texts={[guide.title, guide.summary]}>
      {guide.videoUrl ? (
        <section className={`${card} p-5 space-y-3`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{guide.kind === 'teardown' ? 'Teardown video' : 'Video'}</h2>
          {/firebasestorage\.googleapis\.com|\.(mp4|webm|mov)(\?|$)/i.test(guide.videoUrl) ? (
            <TranslatableVideo src={guide.videoUrl} className="w-full max-h-[70vh] rounded-xl overflow-hidden bg-black" />
          ) : (
            <a href={guide.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:underline break-all">Watch the video ↗</a>
          )}
          <p className="text-[10px] leading-snug text-slate-400">{USER_CONTENT_NOTE}</p>
        </section>
      ) : null}

      {(guide.tools.length > 0 || guide.parts.length > 0) && (
        <WhereToBuy text={[...guide.parts, ...guide.tools].join('\n')} max={4} />
      )}
      {(guide.tools.length > 0 || guide.parts.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {guide.parts.length > 0 && (
            <section className={`${card} p-5 space-y-3`}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Package className="w-4 h-4 text-emerald-500" /> Parts (fix kit)</h2>
              {guide.parts.map((p) => (
                <div key={p} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p}</span>
                  <div className="flex gap-1">
                    <RouteLink to={`/marketplace?q=${encodeURIComponent(p)}`} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">Marketplace</RouteLink>
                    {partSearchLinks(`${guide.deviceLabel} ${p}`).slice(0, 2).map((l) => <ExtLink key={l.label} href={l.url}>{l.label}</ExtLink>)}
                  </div>
                </div>
              ))}
            </section>
          )}
          {guide.tools.length > 0 && (
            <section className={`${card} p-5 space-y-3`}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Wrench className="w-4 h-4 text-indigo-500" /> Tools</h2>
              {guide.tools.map((t) => (
                <div key={t} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t}</span>
                  <div className="flex gap-1">
                    <RouteLink to={`/marketplace?q=${encodeURIComponent(t)}`} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">Marketplace</RouteLink>
                    {partSearchLinks(t).slice(0, 1).map((l) => <ExtLink key={l.label} href={l.url}>{l.label}</ExtLink>)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      <ol className="space-y-4">
        {guide.steps.map((s, i) => (
          <li key={i} id={`step-${i + 1}`} className={`${card} p-5 space-y-3`}>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100"><span className="text-indigo-600 dark:text-indigo-400">Step {i + 1}</span>{s.title ? ` · ${s.title}` : ''}</h3>
            {s.imageUrls?.length > 0 && (
              <div className={`grid gap-2 ${s.imageUrls.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {s.imageUrls.map((u) => (
                  <button key={u} onClick={() => setZoom(u)} className="block rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={u} alt={`Step ${i + 1}`} loading="lazy" className="w-full aspect-[4/3] object-cover hover:scale-[1.02] transition-transform" />
                  </button>
                ))}
              </div>
            )}
            {s.caution && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{s.caution}</div>}
            {s.text && <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">{s.text.split('\n').filter((l) => l.trim()).map((l, k) => <li key={k} className="flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />{l}</li>)}</ul>}
            <CommentThread guide={guide} stepIndex={i} comments={comments} onOpenAuth={onOpenAuth} />
          </li>
        ))}
      </ol>
      </OwnershipGuard>

      <section className={`${card} p-5 space-y-3 text-center`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Finished?</h2>
        <p className="text-sm text-slate-500">To reassemble, follow the steps in reverse. Take e-waste and old batteries to a certified recycler.</p>
        <button onClick={toggleDone} disabled={busy || guide.status !== 'published'} className={done ? btnGhost : btnMint}>
          <CheckCircle2 className="w-4 h-4" /> {done ? `You and ${Math.max(0, guide.completedCount - 1)} others fixed it` : `I fixed it! (${guide.completedCount} so far)`}
        </button>
        <div className="text-xs text-slate-500">Didn't work? <RouteLink to={`/answers/ask?device=${encodeURIComponent(guide.deviceKey)}&label=${encodeURIComponent(guide.deviceLabel)}&path=${encodeURIComponent(guide.devicePath)}`} className="text-indigo-600 font-bold hover:underline">Ask the community</RouteLink></div>
      </section>

      <section className={`${card} p-5 space-y-3`}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Guide comments</h2>
        <CommentThread guide={guide} stepIndex={-1} comments={comments} onOpenAuth={onOpenAuth} />
      </section>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" aria-label="Close"><X className="w-5 h-5" /></button>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </PageShell>
  );
}
