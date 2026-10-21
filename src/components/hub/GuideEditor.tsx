// Create / edit a step-by-step guide or teardown: /guides/new[?device=..&kind=teardown], /guides/edit/:id
// Drafts are private to the author; publishing makes the guide public. Photos and the optional
// video upload to Firebase Cloud Storage (src/lib/guideMedia.ts); https links still work too.
// Teardowns need at least one photo on every step before they can be published.
import { useEffect, useState } from 'react';
import { CONTENT_POLICY_SHORT } from '../../config/policy';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Send, Image as ImageIcon, AlertTriangle, ArrowLeft, Video, Loader2, X } from 'lucide-react';
import { usePathname, navigate, RouteLink } from '../../hooks/usePathname';
import {
  createGuide, updateGuide, getGuide, deviceRefFromSearch, validateGuide, friendlyHubError, isHttpsUrl,
  DIFFICULTIES, GUIDE_KINDS, KIND_LABELS, LIMITS,
  type GuideInput, type GuideStep, type DeviceRef, type GuideKind, type GuideDifficulty,
} from '../../lib/repairHub';
import { PageShell, card, input, btnPrimary, btnMint, btnGhost, btnDanger, ErrorNote, Notice, SignInPrompt, Loading, useHubUser } from './ui';
import DevicePicker from './DevicePicker';
import { uploadGuideImage, uploadGuideVideo, checkGuideImage, checkGuideVideo, friendlyUploadError } from '../../lib/guideMedia';
import { useOwnershipGate } from '../OwnershipAgreementModal';
import { isOwnershipSensitive } from '../../lib/ownershipAgreement';

const emptyStep = (): GuideStep => ({ title: '', text: '', imageUrls: [''], caution: '' });

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (v && items.length < LIMITS.listItems) { onChange([...items, v.slice(0, LIMITS.itemLen)]); setDraft(''); } };
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
            {t}<button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-0.5 rounded hover:text-rose-600" aria-label={`Remove ${t}`}>×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} className={input} maxLength={LIMITS.itemLen} />
        <button type="button" onClick={add} className={btnGhost}><Plus className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

export default function GuideEditor({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const { pathname, search } = usePathname();
  const editId = pathname.startsWith('/guides/edit/') ? decodeURIComponent(pathname.split('/')[3] || '') : '';
  const { uid, owner } = useHubUser();

  const [loading, setLoading] = useState(!!editId);
  const [loadErr, setLoadErr] = useState('');
  const [device, setDevice] = useState<DeviceRef | null>(() => deviceRefFromSearch(search));
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<GuideKind>(() => (GUIDE_KINDS as readonly string[]).includes(search.get('kind') || '') ? (search.get('kind') as GuideKind) : 'repair');
  const [difficulty, setDifficulty] = useState<GuideDifficulty>('Moderate');
  const [minutes, setMinutes] = useState(30);
  const [tools, setTools] = useState<string[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  // Upload progress keyed by slot ('cover', 'video', 'step-3'); a key present means an upload is running.
  const [uploads, setUploads] = useState<Record<string, number>>({});
  const [triedPublish, setTriedPublish] = useState(false);
  const [steps, setSteps] = useState<GuideStep[]>([emptyStep()]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    getGuide(editId).then((g) => {
      if (!alive) return;
      if (!g) { setLoadErr('This guide does not exist or you cannot edit it.'); return; }
      if (uid && g.ownerUid !== uid) { setLoadErr('Only the author can edit this guide.'); return; }
      setDevice({ key: g.deviceKey, label: g.deviceLabel, path: g.devicePath });
      setTitle(g.title); setSummary(g.summary); setKind(g.kind); setDifficulty(g.difficulty); setMinutes(g.minutes);
      setTools(g.tools || []); setParts(g.parts || []); setCoverUrl(g.coverUrl || ''); setVideoUrl(g.videoUrl || '');
      setSteps(g.steps?.length ? g.steps.map((s) => ({ ...s, imageUrls: s.imageUrls?.length ? s.imageUrls : [''] })) : [emptyStep()]);
      setStatus(g.status === 'published' ? 'published' : 'draft');
    }).catch((e) => alive && setLoadErr(friendlyHubError(e, 'open this guide'))).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [editId, uid]);

  useEffect(() => { document.title = `${editId ? 'Edit' : 'New'} guide · DIY Electronics`; }, [editId]);

  if (!owner) return <PageShell><SignInPrompt action="write repair guides and teardowns" onOpenAuth={onOpenAuth} /></PageShell>;
  if (loading) return <PageShell><Loading label="Opening guide…" /></PageShell>;
  if (loadErr) return <PageShell><ErrorNote message={loadErr} /></PageShell>;

  const setStep = (i: number, patch: Partial<GuideStep>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const uploading = Object.keys(uploads).length > 0;
  const setProgress = (key: string, pct: number | null) => setUploads((u) => {
    const n = { ...u };
    if (pct === null) delete n[key]; else n[key] = pct;
    return n;
  });

  const uploadStepPhotos = async (i: number, list: File[]) => {
    if (!list.length || !uid) return;
    const room = LIMITS.stepImages - steps[i].imageUrls.filter(Boolean).length;
    if (room <= 0) { setErr(`Step ${i + 1} already has ${LIMITS.stepImages} photos.`); return; }
    const bad = list.map(checkGuideImage).find(Boolean);
    if (bad) { setErr(bad); return; }
    setErr('');
    const key = `step-${i}`;
    try {
      for (const [n, f] of list.slice(0, room).entries()) {
        const url = await uploadGuideImage(uid, f, (pct) => setProgress(key, Math.round((n * 100 + pct) / Math.min(list.length, room))));
        setSteps((s) => s.map((x, j) => (j === i ? { ...x, imageUrls: [...x.imageUrls.filter(Boolean), url].slice(0, LIMITS.stepImages) } : x)));
      }
    } catch (e) {
      setErr(friendlyUploadError(e));
    } finally {
      setProgress(key, null);
    }
  };

  const uploadCover = async (f: File | undefined) => {
    if (!f || !uid) return;
    const bad = checkGuideImage(f);
    if (bad) { setErr(bad); return; }
    setErr('');
    try { setCoverUrl(await uploadGuideImage(uid, f, (pct) => setProgress('cover', pct))); }
    catch (e) { setErr(friendlyUploadError(e)); }
    finally { setProgress('cover', null); }
  };

  const uploadVideo = async (f: File | undefined) => {
    if (!f || !uid) return;
    const bad = checkGuideVideo(f);
    if (bad) { setErr(bad); return; }
    setErr('');
    try { setVideoUrl(await uploadGuideVideo(uid, f, (pct) => setProgress('video', pct))); }
    catch (e) { setErr(friendlyUploadError(e)); }
    finally { setProgress('video', null); }
  };

  const stepNeedsPhoto = (st: GuideStep) => kind === 'teardown' && !!(st.text.trim() || st.title.trim()) && !st.imageUrls.some((u) => u && isHttpsUrl(u));

  const { gate, modal: ownershipModal } = useOwnershipGate();

  const save = async (publish: boolean) => {
    if (!device) { setErr('Choose the device this guide is for.'); return; }
    if (uploading) { setErr('Please wait for the uploads to finish.'); return; }
    if (publish) setTriedPublish(true);
    const g: GuideInput = { title, summary, kind, device, difficulty, minutes, tools, parts, steps, coverUrl, videoUrl };
    const v = validateGuide(g, publish);
    if (v) { setErr(v); return; }
    // FRP / unlock / account-removal guides: the author confirms the Ownership Agreement before sharing.
    if (publish && isOwnershipSensitive(title, summary) && !(await gate('upload'))) {
      setErr('Not published: FRP and unlock guides can only be shared after accepting the Ownership Agreement.');
      return;
    }
    setBusy(true); setErr('');
    try {
      if (editId) {
        await updateGuide(editId, g, publish);
        navigate(`/guides/view/${editId}`);
      } else {
        const id = await createGuide(g, owner, publish);
        navigate(`/guides/view/${id}`);
      }
    } catch (e) {
      setErr(friendlyHubError(e, publish ? 'publish the guide' : 'save the draft'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      {ownershipModal}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <RouteLink to="/guides" className="text-xs font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Guides</RouteLink>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{editId ? 'Edit guide' : kind === 'teardown' ? 'Create a teardown' : 'Create a repair guide'}</h1>
          <p className="text-xs text-slate-500">{status === 'published' ? 'Published guide: changes go live when you publish again.' : 'Drafts are only visible to you until you publish.'}</p>
          <p className="text-[11px] text-slate-400 max-w-xl">{CONTENT_POLICY_SHORT} You are responsible for what you publish; DIY Electronics does not endorse user procedures. <a href="/about#content-policy" className="underline">Content policy</a></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(false)} disabled={busy} className={btnGhost}><Save className="w-3.5 h-3.5" /> Save draft</button>
          <button onClick={() => save(true)} disabled={busy || uploading} className={btnMint}><Send className="w-3.5 h-3.5" /> Publish</button>
        </div>
      </div>
      {err && <ErrorNote message={err} />}
      {note && <Notice>{note}</Notice>}

      <div className={`${card} p-5 space-y-4`}>
        <DevicePicker value={device} onChange={setDevice} />
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder={kind === 'teardown' ? 'e.g. Hisense 55A6 teardown' : 'e.g. Samsung UA55 backlight LED strip replacement'} className={input} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Guide type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as GuideKind)} className={input}>
              {GUIDE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as GuideDifficulty)} className={input}>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Time (minutes)</span>
              <input type="number" min={1} max={10000} value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} className={input} />
            </label>
          </div>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Introduction</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={LIMITS.summary} placeholder="What this guide fixes, symptoms, and anything to know before starting (safety, discharging capacitors, battery level…)" className={`${input} min-h-[90px]`} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cover image link (optional)</span>
            <div className="flex gap-2">
              <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className={input} maxLength={1000} />
              <label className={`${btnGhost} cursor-pointer shrink-0`}>
                {uploads.cover !== undefined ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploads.cover}%</> : <><ImageIcon className="w-3.5 h-3.5" /> Upload</>}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploads.cover !== undefined} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadCover(f); }} />
              </label>
            </div>
            {coverUrl && isHttpsUrl(coverUrl) && <img src={coverUrl} alt="Cover preview" className="mt-2 h-28 rounded-lg object-cover" />}
          </label>
          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> {kind === 'teardown' ? 'Teardown video' : 'Video'} (optional)</span>
            <p className="text-[11px] text-slate-500">Upload an MP4, WebM or MOV up to 150 MB, or paste a video link (https://…).</p>
            <div className="flex gap-2">
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://… (or upload a file)" className={input} maxLength={1000} />
              <label className={`${btnGhost} cursor-pointer shrink-0`}>
                {uploads.video !== undefined ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploads.video}%</> : <><Video className="w-3.5 h-3.5" /> Upload video</>}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploads.video !== undefined} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadVideo(f); }} />
              </label>
              {videoUrl && <button type="button" onClick={() => setVideoUrl('')} className={btnGhost} aria-label="Remove video"><X className="w-3.5 h-3.5" /></button>}
            </div>
            {uploads.video !== undefined && (
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploads.video}%` }} /></div>
            )}
            {videoUrl && isHttpsUrl(videoUrl) && /firebasestorage|\.(mp4|webm|mov)(\?|$)/i.test(videoUrl) && (
              <video src={videoUrl} controls preload="metadata" className="mt-2 w-full max-w-xl rounded-xl bg-black" />
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <ListEditor label="Tools" items={tools} onChange={setTools} placeholder="e.g. Phillips #00, spudger, multimeter" />
          <ListEditor label="Parts (fix kit)" items={parts} onChange={setParts} placeholder="e.g. 3227 mAh battery, adhesive strips" />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className={`${card} p-5 space-y-3 ${triedPublish && stepNeedsPhoto(s) ? 'ring-2 ring-rose-400' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Step {i + 1}{kind === 'teardown' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-rose-500">Photo required</span>}</div>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btnGhost} aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className={btnGhost} aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => setSteps((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [emptyStep()]))} className={btnDanger} aria-label="Delete step"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} maxLength={LIMITS.stepTitle} placeholder="Step title (e.g. Remove the back cover)" className={input} />
            <textarea value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} maxLength={LIMITS.stepText} placeholder="Instructions. One action per line works best." className={`${input} min-h-[90px]`} />
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-2.5 shrink-0" />
              <input value={s.caution} onChange={(e) => setStep(i, { caution: e.target.value })} maxLength={500} placeholder="Caution / warning for this step (optional)" className={input} />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step photos ({kind === 'teardown' ? 'at least 1, ' : ''}up to {LIMITS.stepImages}: upload or paste https links)</div>
              {s.imageUrls.some((u) => u && isHttpsUrl(u)) && (
                <div className="flex flex-wrap gap-2">
                  {s.imageUrls.filter((u) => u && isHttpsUrl(u)).map((u) => (
                    <div key={u} className="relative">
                      <img src={u} alt="" className="w-20 h-16 rounded-lg object-cover bg-slate-100" />
                      <button type="button" onClick={() => setStep(i, { imageUrls: s.imageUrls.filter((x) => x !== u).length ? s.imageUrls.filter((x) => x !== u) : [''] })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-xs leading-5" aria-label="Remove photo">×</button>
                    </div>
                  ))}
                </div>
              )}
              {triedPublish && stepNeedsPhoto(s) && <p className="text-xs font-bold text-rose-600">Add at least one photo to this step.</p>}
              {s.imageUrls.map((u, k) => (u.includes('firebasestorage.googleapis.com') ? null : (
                <div key={k} className="flex gap-2 items-center">
                  <input value={u} onChange={(e) => setStep(i, { imageUrls: s.imageUrls.map((x, j) => (j === k ? e.target.value : x)) })} placeholder="https://… (image link)" className={input} maxLength={1000} />
                  <button type="button" onClick={() => setStep(i, { imageUrls: s.imageUrls.length > 1 ? s.imageUrls.filter((_, j) => j !== k) : [''] })} className={btnGhost} aria-label="Remove image">×</button>
                </div>
              )))}
              <div className="flex gap-2">
                {s.imageUrls.length < LIMITS.stepImages && <button type="button" onClick={() => setStep(i, { imageUrls: [...s.imageUrls, ''] })} className={btnGhost}><Plus className="w-3.5 h-3.5" /> Image link</button>}
                <label className={`${btnPrimary} cursor-pointer`}>
                  {uploads[`step-${i}`] !== undefined ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading {uploads[`step-${i}`]}%</> : <><ImageIcon className="w-3.5 h-3.5" /> Upload photos</>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploads[`step-${i}`] !== undefined} onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; uploadStepPhotos(i, f); }} />
                </label>
              </div>
            </div>
          </div>
        ))}
        {steps.length < LIMITS.steps && (
          <button type="button" onClick={() => setSteps((s) => [...s, emptyStep()])} className={`${btnPrimary} w-full py-3`}><Plus className="w-4 h-4" /> Add step {steps.length + 1}</button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => save(false)} disabled={busy} className={btnGhost}><Save className="w-3.5 h-3.5" /> Save draft</button>
        <button onClick={() => save(true)} disabled={busy || uploading} className={btnMint}><Send className="w-3.5 h-3.5" /> {busy ? 'Saving…' : uploading ? 'Uploading…' : kind === 'teardown' ? 'Publish teardown' : 'Publish guide'}</button>
      </div>
    </PageShell>
  );
}
