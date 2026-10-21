import { aiFetch } from '../lib/aiFetch';
import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot, Send, User, Sparkles, Terminal, Cpu, AlertTriangle, RotateCcw, Plus, Camera, Image as ImageIcon, Video, X,
  Maximize2, Minimize2, ChevronDown, Network, Loader2, ExternalLink, Search,
} from 'lucide-react';
import { compressImageFile, extractVideoFrames, fitToBudget, makeThumb, prepareImageFromUrl, proxied } from '../lib/media';
import type { PreparedImage } from '../lib/media';
import { streamChat, prewarmAi } from '../lib/aiStream';
import CircuitMapView from './CircuitMapView';
import { NoMultimeterCard, WhereToBuy } from './PartsFinderPanels';
import { asksForMeasurement } from '../lib/partsFinder';
import type { CircuitMapResult } from './CircuitMapView';
import { useOwnershipGate } from './OwnershipAgreementModal';
import { isOwnershipSensitive } from '../lib/ownershipAgreement';

interface BoardPhoto { title: string; thumbUrl: string; url: string; fullUrl?: string; pageUrl: string; source: string; credit: string; licenseUrl?: string | null }
interface BoardLookup { query: string; photos: BoardPhoto[]; web: { title: string; url: string; snippet?: string; kind?: string; source?: string }[]; links: { label: string; url: string; kind: string }[] }
interface Attachment { id: string; thumb: string; kind: 'photo' | 'frame'; label?: string }

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  /** Set on an error bubble: the user text that failed, so it can be retried. */
  failedText?: string;
  attachments?: Attachment[];
  board?: BoardLookup | null;
  circuit?: { result: CircuitMapResult; photoUrl?: string | null };
  streaming?: boolean;
}

const STORAGE_PREFIX = 'diyelectronics_chat_';
const greetingMessage = (greeting: string): Message => ({ id: '1', sender: 'assistant', text: greeting, timestamp: '' });

function loadConversation(personaId: string, greeting: string): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + personaId);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((m: Message) => ({ ...m, streaming: false }));
  } catch {
    // ignore unavailable/corrupt storage
  }
  return [greetingMessage(greeting)];
}

const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const PERSONAS = [
  {
    id: 'sanwolf', mode: 'copilot', name: 'SANWOLF', short: 'SANWOLF',
    role: 'Expert repair technician: diagnostics, boards, photos & circuit maps',
    icon: Bot, color: 'bg-cobalt-600 text-white', iconColor: 'text-amber-500 fill-amber-500',
    greeting: 'Hi, I am **SANWOLF**, your repair technician. Tell me the device, model and what it is doing, or tap **+** to send a photo or video of the board. I can also **map a circuit** from a photo or a board number and show you exactly which parts to test.',
  },
  {
    id: 'codefox', mode: 'codefox', name: 'CODEFOX', short: 'CODEFOX',
    role: 'Embedded systems, firmware, Arduino & Python',
    icon: Terminal, color: 'bg-blue-500 text-white', iconColor: 'text-blue-500 fill-blue-500',
    greeting: 'Hi! I am CODEFOX. Need help writing firmware, debugging a microcontroller, or wiring a sensor? Tell me what you are building.',
  },
  {
    id: 'circuitbear', mode: 'circuitbear', name: 'CIRCUITBEAR', short: 'CIRCUIT',
    role: 'Circuit design, PCB layout & calculations',
    icon: Cpu, color: 'bg-emerald-500 text-white', iconColor: 'text-emerald-500 fill-emerald-500',
    greeting: 'Greetings! I am CIRCUITBEAR. I can help you design circuits and PCBs, analyse schematics and do the calculations. What are we designing today?',
  },
];

/** Markdown with GFM tables (scrollable), code blocks and links that open in a new tab. */
function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="ai-md leading-relaxed break-words [&_h1]:font-bold [&_h1]:text-base [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-3 [&_h3]:font-bold [&_h3]:mt-2 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-stone-100 dark:[&_code]:bg-stone-800 [&_code]:px-1 [&_code]:rounded [&_pre]:overflow-x-auto [&_pre]:bg-stone-100 dark:[&_pre]:bg-stone-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-3 [&_a]:underline [&_a]:text-cobalt-600 dark:[&_a]:text-cobalt-300">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node: _n, ...props }) => <div className="my-2 -mx-1 overflow-x-auto max-w-full rounded-lg"><table {...props} /></div>,
          a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export default function AiAssistantView() {
  const [activePersonaId, setActivePersonaId] = useState('sanwolf');
  const activePersona = PERSONAS.find(p => p.id === activePersonaId) || PERSONAS[0];
  const [messages, setMessages] = useState<Message[]>(() => loadConversation(activePersona.id, activePersona.greeting));
  // "Ask AI" buttons on fix guides open this page with ?ask=<problem>: type it in, the user presses send.
  const [input, setInput] = useState(() => {
    try {
      const url = new URL(window.location.href);
      const ask = url.searchParams.get('ask') || '';
      if (ask) { url.searchParams.delete('ask'); window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); }
      return ask.slice(0, 1500);
    } catch { return ''; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [pending, setPending] = useState<{ id: string; img: PreparedImage; thumb: string; kind: 'photo' | 'frame' }[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapMode, setMapMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  /** Full-resolution images by message id (memory only; sessionStorage keeps thumbnails). */
  const fullImages = useRef(new Map<string, PreparedImage[]>());
  const retryPayload = useRef(new Map<string, { text: string; images: PreparedImage[]; map: boolean; imageUrl?: string; board?: string }>());

  useEffect(() => { prewarmAi(); }, []);

  // Keep each persona's conversation for this browser session (thumbnails only; big photos stay in memory).
  useEffect(() => {
    const slim = messages.slice(-40).map(m => (m.circuit?.photoUrl?.startsWith('data:') ? { ...m, circuit: { ...m.circuit, photoUrl: null } } : m));
    try {
      sessionStorage.setItem(STORAGE_PREFIX + activePersonaId, JSON.stringify(slim));
    } catch {
      try { sessionStorage.setItem(STORAGE_PREFIX + activePersonaId, JSON.stringify(slim.map(m => ({ ...m, attachments: undefined })))); } catch { /* full */ }
    }
  }, [messages, activePersonaId]);

  // Stick to the bottom while the answer streams in.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isGenerating]);

  // Full screen: lock page scroll, Esc exits.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [fullscreen]);

  // Auto-grow the composer up to ~5 lines.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const handlePersonaChange = (personaId: string) => {
    if (personaId === activePersonaId) return;
    const p = PERSONAS.find(x => x.id === personaId) || PERSONAS[0];
    setActivePersonaId(personaId);
    setMessages(loadConversation(p.id, p.greeting));
    setHeaderOpen(false);
  };

  const handleClearConversation = () => {
    setMessages([greetingMessage(activePersona.greeting)]);
    fullImages.current.clear();
  };

  // ---- attachments ---------------------------------------------------------------------------
  const addFiles = async (files: FileList | null, kind: 'photo' | 'video') => {
    setMenuOpen(false);
    if (!files || !files.length) return;
    setNotice(null);
    try {
      const next: { id: string; img: PreparedImage; thumb: string; kind: 'photo' | 'frame' }[] = [];
      if (kind === 'video') {
        setProcessing('Reading key frames from the video…');
        const frames = await extractVideoFrames(files[0], 6);
        for (const f of frames) next.push({ id: `f_${Date.now()}_${next.length}`, img: f, thumb: await makeThumb(f), kind: 'frame' });
      } else {
        setProcessing('Preparing photo…');
        for (const file of Array.from(files).slice(0, 6)) {
          const img = await compressImageFile(file);
          next.push({ id: `p_${Date.now()}_${next.length}`, img, thumb: await makeThumb(img), kind: 'photo' });
        }
      }
      setPending(prev => [...prev, ...next].slice(0, 8));
      if (pending.length + next.length > 8) setNotice('Up to 8 images per message; extra ones were left out.');
    } catch (e: any) {
      setNotice(e?.message || 'Could not read that file.');
    } finally {
      setProcessing(null);
    }
  };

  // ---- sending -------------------------------------------------------------------------------
  const pushAssistant = (m: Partial<Message> & { id: string }) => setMessages(prev => {
    const i = prev.findIndex(x => x.id === m.id);
    if (i === -1) return [...prev, { sender: 'assistant', text: '', timestamp: nowLabel(), ...m } as Message];
    const copy = [...prev];
    copy[i] = { ...copy[i], ...m };
    return copy;
  });

  const runCircuitMap = async (asstId: string, text: string, images: PreparedImage[], imageUrl?: string, boardOverride?: string) => {
    const photo = images[0];
    const board = (boardOverride || (photo ? '' : text)).trim().slice(0, 80);
    const symptom = photo || boardOverride ? text.trim().slice(0, 400) : '';
    const res = await aiFetch('/api/circuit-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, symptom, image: photo ? { mimeType: photo.mimeType, data: photo.data } : undefined, imageUrl }),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok || !data?.map) throw new Error(data?.error || `The circuit map could not be made (${res.status}). Please try again.`);
    const photoUrl = photo ? photo.dataUrl : imageUrl ? proxied(imageUrl) : null;
    const suspects = (data.map.components || []).filter((c: any) => c.check).length;
    pushAssistant({
      id: asstId,
      text: `**Circuit map${data.map.title ? `: ${data.map.title}` : ''}.** ${suspects ? `${suspects} part${suspects > 1 ? 's are' : ' is'} flashing red: tap one to see why, what to measure and the expected value.` : 'Tap a block to see what it does and what to measure.'}`,
      circuit: { result: data, photoUrl },
      board: !photo && !imageUrl && data.board_lookup && (data.board_lookup.photos?.length || data.board_lookup.web?.length) ? { query: board, ...data.board_lookup } : null,
      streaming: false,
    });
  };

  const send = async (text: string, images: PreparedImage[], opts: { map: boolean; imageUrl?: string; board?: string }, baseMessages: Message[]) => {
    const userId = `usr_${Date.now()}`;
    const asstId = `ast_${Date.now() + 1}`;
    const thumbs = await Promise.all(images.map(async (img, i) => ({ id: `${userId}_${i}`, thumb: await makeThumb(img, 200), kind: (img.label?.startsWith('video') ? 'frame' : 'photo') as 'photo' | 'frame', label: img.label })));
    if (images.length) fullImages.current.set(userId, images);
    const userText = text || (opts.map ? (opts.imageUrl ? 'Map the circuit of this board photo.' : 'Map the circuit of this board.') : '');
    const userMsg: Message = { id: userId, sender: 'user', text: userText, timestamp: nowLabel(), attachments: thumbs.length ? thumbs : undefined };
    setMessages([...baseMessages, userMsg]);
    setIsGenerating(true);
    retryPayload.current.set(userId, { text, images, map: opts.map, imageUrl: opts.imageUrl, board: opts.board });
    try {
      if (opts.map) {
        await runCircuitMap(asstId, text, images, opts.imageUrl, opts.board);
      } else {
        // History: text of every turn, plus the photos of the last two user turns that had any.
        const prior = baseMessages.filter(m => m.id !== '1' && !m.failedText);
        const withImages = prior.filter(m => m.sender === 'user' && fullImages.current.has(m.id)).slice(-2).map(m => m.id);
        const history = prior.map(m => ({
          role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
          text: m.circuit ? `${m.text}\n[Circuit map shown: ${m.circuit.result.map.title}; parts to check: ${m.circuit.result.map.components.filter(c => c.check).map(c => c.label).join(', ')}]` : m.text,
          images: withImages.includes(m.id) ? fullImages.current.get(m.id)!.map(i => ({ mimeType: i.mimeType, data: i.data })) : undefined,
        }));
        const sendImages = await fitToBudget(images);
        let started = false;
        const result = await streamChat(
          { message: text, history, mode: activePersona.mode, images: sendImages.map(i => ({ mimeType: i.mimeType, data: i.data, label: i.label })) },
          (full) => {
            if (!started) { started = true; pushAssistant({ id: asstId, text: full, streaming: true }); }
            else pushAssistant({ id: asstId, text: full });
          },
        );
        pushAssistant({ id: asstId, text: result.text, board: result.board || null, streaming: false });
      }
      retryPayload.current.delete(userId);
    } catch (error: any) {
      const friendly = error?.message && !/Failed to fetch|NetworkError|Load failed/i.test(error.message)
        ? error.message
        : "I couldn't reach the AI service just now. Please check your connection and try again.";
      setMessages(prev => [...prev.filter(m => m.id !== asstId), { id: `err_${Date.now()}`, sender: 'assistant', text: friendly, timestamp: nowLabel(), failedText: userId }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const { gate: ownershipGate, modal: ownershipModal } = useOwnershipGate();

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating || processing) return;
    const text = input.trim();
    if (!text && !pending.length) return;
    if (mapMode && !text && !pending.length) return;
    // FRP / account-removal / unlock questions: the Ownership Agreement must be accepted before sending.
    if (text && isOwnershipSensitive(text) && !(await ownershipGate('ai'))) {
      setNotice('Not sent. FRP and unlock help is only available after you accept the Ownership Agreement (for your own device or one you are authorised to repair).');
      return;
    }
    const images = pending.map(p => p.img);
    setInput('');
    setPending([]);
    const map = mapMode;
    setMapMode(false);
    await send(text, images, { map }, messages);
  };

  const handleRetry = (errorMsg: Message) => {
    if (!errorMsg.failedText || isGenerating) return;
    const payload = retryPayload.current.get(errorMsg.failedText);
    const idx = messages.findIndex(m => m.id === errorMsg.id);
    const base = messages.slice(0, Math.max(0, idx - 1));
    if (payload) send(payload.text, payload.images, { map: payload.map, imageUrl: payload.imageUrl, board: payload.board }, base);
    else {
      const userMsg = messages.find(m => m.id === errorMsg.failedText);
      if (userMsg) send(userMsg.text, [], { map: false }, base);
    }
  };

  const mapFromWebPhoto = useCallback((photo: BoardPhoto, boardQuery: string) => {
    if (isGenerating) return;
    send(`Board: ${boardQuery}`, [], { map: true, imageUrl: photo.fullUrl || photo.url, board: boardQuery }, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, messages]);

  const askAboutWebPhoto = useCallback(async (photo: BoardPhoto, boardQuery: string) => {
    if (isGenerating) return;
    try {
      setProcessing('Loading board photo…');
      const img = await prepareImageFromUrl(proxied(photo.fullUrl || photo.url));
      img.label = `web photo: ${photo.title} (${photo.source})`;
      const thumb = await makeThumb(img);
      setPending(prev => [...prev, { id: `w_${Date.now()}`, img, thumb, kind: 'photo' as const }].slice(0, 8));
      setInput(prev => prev || `This is a photo of ${boardQuery}. `);
      textRef.current?.focus();
    } catch {
      setNotice('That photo could not be loaded. Try another one.');
    } finally {
      setProcessing(null);
    }
  }, [isGenerating]);

  const ActiveIcon = activePersona.icon;
  const canSend = !isGenerating && !processing && (input.trim().length > 0 || pending.length > 0);

  return (
    <div
      className={fullscreen
        ? 'fixed inset-0 z-[60] flex flex-col bg-slate-50 dark:bg-slate-950 h-[100dvh]'
        : 'flex flex-col h-[calc(100dvh-3.5rem)] w-full max-w-4xl mx-auto overflow-hidden'}
      style={fullscreen ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
    >
      {ownershipModal}
      {/* Compact sticky header */}
      <div className="shrink-0 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur px-2 sm:px-4">
        <div className="h-12 flex items-center gap-2">
          <button type="button" onClick={() => setHeaderOpen(o => !o)} className="flex items-center gap-2 min-w-0 rounded-lg px-1.5 py-1 hover:bg-stone-100 dark:hover:bg-stone-800" aria-expanded={headerOpen} aria-label="Switch assistant">
            <span className={`w-8 h-8 rounded-xl ${activePersona.color} flex items-center justify-center shrink-0`}><ActiveIcon className="w-4 h-4" /></span>
            <span className="min-w-0 text-left">
              <span className="flex items-center gap-1 text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{activePersona.name} <Sparkles className={`w-3.5 h-3.5 ${activePersona.iconColor}`} /></span>
            </span>
            <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${headerOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            {messages.length > 1 && (
              <button type="button" onClick={handleClearConversation} className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">New chat</button>
            )}
            <button type="button" onClick={() => setFullscreen(f => !f)} className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {headerOpen && (
          <div className="pb-2.5 space-y-2">
            <p className="text-xs text-stone-500 dark:text-stone-400 px-1">{activePersona.role}</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {PERSONAS.map(p => {
                const Icon = p.icon;
                const sel = p.id === activePersonaId;
                return (
                  <button key={p.id} type="button" aria-pressed={sel} onClick={() => handlePersonaChange(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 border ${sel ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100' : 'border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
                    <Icon className="w-3.5 h-3.5" /> {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Messages: fill the remaining height */}
      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 py-4 space-y-4 overscroll-contain" role="log" aria-live="polite" aria-label={`Conversation with ${activePersona.name}`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-2 sm:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`hidden sm:flex w-8 h-8 rounded-xl items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950' : `${activePersona.color}`}`}>
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <ActiveIcon className="w-4 h-4" />}
            </div>
            <div className={`min-w-0 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm ${msg.circuit || msg.board ? 'w-full sm:max-w-[92%]' : 'max-w-[88%] sm:max-w-[80%]'} ${
              msg.sender === 'user'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-tr-xs'
                : msg.failedText
                  ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-tl-xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 shadow-sm rounded-tl-xs'
            }`}>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{msg.sender === 'user' ? 'You' : activePersona.name}</span>
                <span className="text-[10px] opacity-50">{msg.timestamp}</span>
              </div>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.attachments.map(a => (
                    <span key={a.id} className="relative">
                      <img src={a.thumb} alt={a.label || 'attachment'} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-white/20" />
                      {a.kind === 'frame' && <Video className="absolute bottom-1 right-1 w-3.5 h-3.5 text-white drop-shadow" />}
                    </span>
                  ))}
                </div>
              )}
              {msg.failedText ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-2 leading-relaxed"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><span>{msg.text}</span></p>
                  <button type="button" onClick={() => handleRetry(msg)} disabled={isGenerating} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50">
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
                  </button>
                </div>
              ) : msg.sender === 'assistant' ? (
                <>
                  <AiMarkdown text={msg.text} />
                  {msg.streaming && <span className="inline-block w-2 h-4 align-middle bg-cobalt-500 animate-pulse ml-0.5" aria-hidden />}
                  {msg.circuit && <div className="mt-2.5 -mx-1.5 sm:mx-0"><CircuitMapView result={msg.circuit.result} photoUrl={msg.circuit.photoUrl} /></div>}
                  {msg.board && !msg.streaming && <BoardResults board={msg.board} onMap={mapFromWebPhoto} onAsk={askAboutWebPhoto} disabled={isGenerating} />}
                  {!msg.streaming && !msg.circuit && msg.text && msg.id !== '1' && (
                    <>
                      <WhereToBuy text={msg.text} className="mt-2.5" />
                      {activePersona.id === 'sanwolf' && asksForMeasurement(msg.text) && <NoMultimeterCard className="mt-2" />}
                    </>
                  )}
                </>
              ) : (
                msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {isGenerating && !messages.some(m => m.streaming) && (
          <div className="flex items-center gap-2 pl-1">
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl px-4 py-3 flex items-center gap-1.5" aria-label="Typing">
              <span className="w-2 h-2 rounded-full bg-cobalt-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-cobalt-500 animate-bounce [animation-delay:120ms]" />
              <span className="w-2 h-2 rounded-full bg-cobalt-500 animate-bounce [animation-delay:240ms]" />
              {messages[messages.length - 1]?.attachments?.length || retryPayloadHasMap(messages) ? <span className="ml-2 text-xs text-stone-500">Looking at the board…</span> : null}
            </div>
          </div>
        )}
      </div>

      {/* Composer: pinned to the bottom with safe-area padding, never wider than the screen */}
      <form onSubmit={handleSend} className="shrink-0 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur px-2 sm:px-4 pt-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {(pending.length > 0 || processing || notice || mapMode) && (
          <div className="mb-2 space-y-1.5">
            {mapMode && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cobalt-600 text-white font-semibold"><Network className="w-3.5 h-3.5" /> Map circuit</span>
                <span className="text-stone-500 truncate">{pending.length ? 'from your photo (add the fault if you know it)' : 'type a board / model number, or add a photo'}</span>
                <button type="button" onClick={() => setMapMode(false)} className="ml-auto p-1 text-stone-400" aria-label="Cancel map mode"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {pending.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {pending.map(p => (
                  <span key={p.id} className="relative shrink-0">
                    <img src={p.thumb} alt="" className="w-14 h-14 object-cover rounded-lg border border-stone-200 dark:border-stone-700" />
                    {p.kind === 'frame' && <Video className="absolute bottom-1 left-1 w-3 h-3 text-white drop-shadow" />}
                    <button type="button" onClick={() => setPending(prev => prev.filter(x => x.id !== p.id))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center" aria-label="Remove attachment"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            {processing && <p className="text-xs text-stone-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {processing}</p>}
            {notice && <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p>}
          </div>
        )}
        <div className="relative flex items-end gap-1.5 sm:gap-2 min-w-0">
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen(o => !o)} className={`w-10 h-10 rounded-full flex items-center justify-center border ${menuOpen || mapMode ? 'bg-cobalt-600 text-white border-cobalt-600' : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`} aria-label="Add photo, video or map a circuit" aria-expanded={menuOpen}>
              <Plus className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute bottom-12 left-0 z-20 w-60 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl p-1.5">
                <MenuItem icon={Camera} label="Take a photo" hint="Use the camera" onClick={() => cameraRef.current?.click()} />
                <MenuItem icon={ImageIcon} label="Upload photos" hint="From your gallery" onClick={() => galleryRef.current?.click()} />
                <MenuItem icon={Video} label="Upload a video" hint="AI looks at key frames" onClick={() => videoRef.current?.click()} />
                <div className="my-1 h-px bg-stone-200 dark:bg-stone-800" />
                <MenuItem icon={Network} label="Map circuit" hint="From a photo or a board number" active={mapMode} onClick={() => { setMapMode(m => !m); setMenuOpen(false); textRef.current?.focus(); }} />
              </div>
            )}
          </div>
          <label htmlFor="ai-assistant-input" className="sr-only">Message {activePersona.name}</label>
          <textarea
            id="ai-assistant-input"
            ref={textRef}
            rows={1}
            maxLength={4000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setMenuOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); handleSend(); } }}
            placeholder={mapMode ? 'Board / model number, e.g. Samsung UA43TU7000' : pending.length ? 'Add a question about the photo…' : 'Ask about a fault, a board, a part…'}
            className="flex-1 min-w-0 resize-none bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-2.5 text-[16px] sm:text-sm leading-snug text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-cobalt-500 max-h-36"
          />
          <button type="submit" disabled={!canSend} className="shrink-0 w-10 h-10 rounded-full bg-cobalt-600 hover:bg-cobalt-500 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform" aria-label={mapMode ? 'Map circuit' : 'Send'}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : mapMode ? <Network className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files, 'photo'); e.target.value = ''; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files, 'photo'); e.target.value = ''; }} />
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => { addFiles(e.target.files, 'video'); e.target.value = ''; }} />
        <p className="mt-1 text-center text-[10px] text-stone-400">AI answers and circuit maps can be wrong. Check with your meter and the service manual.</p>
      </form>
    </div>
  );
}

function retryPayloadHasMap(messages: Message[]) {
  const last = messages[messages.length - 1];
  return last?.sender === 'user' && /^Map the circuit|^Board:/.test(last.text);
}

function MenuItem({ icon: Icon, label, hint, onClick, active }: { icon: typeof Camera; label: string; hint: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-stone-100 dark:hover:bg-stone-800 ${active ? 'bg-cobalt-50 dark:bg-cobalt-500/15' : ''}`}>
      <span className="w-8 h-8 rounded-lg bg-cobalt-50 dark:bg-cobalt-500/15 text-cobalt-600 dark:text-cobalt-300 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-900 dark:text-stone-100">{label}</span>
        <span className="block text-[11px] text-stone-500">{hint}</span>
      </span>
    </button>
  );
}

/** Real board photos + listings pulled from the web for a board / model number, with sources. */
function BoardResults({ board, onMap, onAsk, disabled }: { board: BoardLookup; onMap: (p: BoardPhoto, q: string) => void; onAsk: (p: BoardPhoto, q: string) => void; disabled: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const photo = sel !== null ? board.photos[sel] : null;
  return (
    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-3">
      {board.photos.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500 mb-1.5 flex items-center gap-1"><Search className="w-3 h-3" /> Board photos online for “{board.query}”</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {board.photos.map((p, i) => (
              <button key={p.url + i} type="button" onClick={() => setSel(sel === i ? null : i)} className={`shrink-0 w-28 text-left rounded-lg overflow-hidden border ${sel === i ? 'border-cobalt-500 ring-2 ring-cobalt-500/40' : 'border-stone-200 dark:border-stone-700'}`}>
                <img src={proxied(p.thumbUrl || p.url)} alt={p.title} loading="lazy" className="w-28 h-20 object-cover bg-stone-100 dark:bg-stone-800" />
                <span className="block px-1.5 py-1 text-[10px] leading-tight text-stone-600 dark:text-stone-300 line-clamp-2">{p.title}</span>
              </button>
            ))}
          </div>
          {photo && (
            <div className="mt-2 rounded-xl border border-stone-200 dark:border-stone-700 p-2.5 space-y-2">
              <img src={proxied(photo.fullUrl || photo.url)} alt={photo.title} className="w-full max-h-64 object-contain rounded-lg bg-stone-100 dark:bg-stone-800" />
              <p className="text-[11px] text-stone-500">{photo.title}. Source: <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">{photo.source} <ExternalLink className="w-2.5 h-2.5" /></a> · {photo.credit}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={disabled} onClick={() => onMap(photo, board.query)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cobalt-600 text-white text-xs font-bold disabled:opacity-50"><Network className="w-3.5 h-3.5" /> Map circuit on this photo</button>
                <button type="button" disabled={disabled} onClick={() => onAsk(photo, board.query)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-600 text-xs font-bold">Ask about this photo</button>
              </div>
            </div>
          )}
        </div>
      )}
      {board.web.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500 mb-1">Listings & guides found online</p>
          <ol className="space-y-1">
            {board.web.slice(0, 6).map((w, i) => (
              <li key={w.url} className="text-xs">
                <a href={w.url} target="_blank" rel="noreferrer" className="font-semibold text-cobalt-600 dark:text-cobalt-300 hover:underline">[{i + 1}] {w.title}</a>
                <span className="text-stone-400"> · {w.source}{w.kind ? `, ${w.kind}` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {board.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {board.links.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-medium text-stone-600 dark:text-stone-300 hover:text-cobalt-600">{l.label} <ExternalLink className="w-2.5 h-2.5" /></a>
          ))}
        </div>
      )}
    </div>
  );
}
