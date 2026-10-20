import { aiFetch } from '../lib/aiFetch';
import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { Bot, Send, User, Sparkles, RefreshCw, Terminal, Cpu, AlertTriangle, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  /** Set on an error bubble: the user text that failed, so it can be retried. */
  failedText?: string;
}

const STORAGE_PREFIX = 'diyelectronics_chat_';
const greetingMessage = (greeting: string): Message => ({ id: '1', sender: 'assistant', text: greeting, timestamp: '' });

function loadConversation(personaId: string, greeting: string): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + personaId);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore unavailable/corrupt storage
  }
  return [greetingMessage(greeting)];
}

const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const PERSONAS = [
  {
    id: 'sanwolf',
    mode: 'copilot',
    name: 'SANWOLF',
    role: 'Expert electronic diagnostics, component troubleshooting & repair copilot',
    icon: Bot,
    color: 'bg-cobalt-600 text-white',
    iconColor: 'text-amber-500 fill-amber-500',
    greeting: 'Hello! I am SANWOLF, your AI Repair Copilot. Ask me anything about troubleshooting motherboards, soldering, component replacement, smartphone repair, or circuit diagnostics.'
  },
  {
    id: 'codefox',
    mode: 'codefox',
    name: 'CODEFOX',
    role: 'Embedded systems, firmware, Arduino & Python engineering copilot',
    icon: Terminal,
    color: 'bg-blue-500 text-white',
    iconColor: 'text-blue-500 fill-blue-500',
    greeting: 'Hi! I am CODEFOX. Need help writing firmware, debugging a microcontroller, or configuring a new sensor? Let me know what you are building.'
  },
  {
    id: 'circuitbear',
    mode: 'circuitbear',
    name: 'CIRCUITBEAR',
    role: 'Circuit design, PCB layout & hardware prototyping expert',
    icon: Cpu,
    color: 'bg-emerald-500 text-white',
    iconColor: 'text-emerald-500 fill-emerald-500',
    greeting: 'Greetings! I am CIRCUITBEAR. I can help you design custom PCBs, analyze schematics, and calculate power requirements. What are we designing today?'
  }
];

export default function AiAssistantView() {
  const [activePersonaId, setActivePersonaId] = useState('sanwolf');
  const activePersona = PERSONAS.find(p => p.id === activePersonaId) || PERSONAS[0];

  const [messages, setMessages] = useState<Message[]>(() => loadConversation(activePersona.id, activePersona.greeting));

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Keep each persona's conversation for this browser session.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + activePersonaId, JSON.stringify(messages.slice(-50)));
    } catch {
      // storage full/unavailable: conversation just won't persist
    }
  }, [messages, activePersonaId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isGenerating]);

  const handlePersonaChange = (personaId: string) => {
    if (personaId === activePersonaId) return;
    const newPersona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];
    setActivePersonaId(personaId);
    setMessages(loadConversation(newPersona.id, newPersona.greeting));
  };

  const handleClearConversation = () => {
    setMessages([greetingMessage(activePersona.greeting)]);
  };

  const sendText = async (userText: string, baseMessages: Message[]) => {
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: nowLabel()
    };

    setMessages([...baseMessages, userMsg]);
    setIsGenerating(true);

    try {
      const formattedHistory = baseMessages
        .filter(m => m.id !== '1' && !m.failedText)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text
        }));

      // All AI calls go through the server (/api/chat) so the Gemini API key
      // never ships to the browser. The persona's system prompt lives on the server;
      // we only send which mode to use.
      const res = await aiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: formattedHistory,
          mode: activePersona.mode
        })
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON (e.g. a 404 page)
      }

      if (!res.ok || !data?.reply) {
        const errorMessage = data?.error
          || (res.status === 404
            ? "The AI service isn't reachable right now. Please try again shortly."
            : `The AI service returned an error (${res.status}). Please try again shortly.`);
        throw new Error(errorMessage);
      }

      const assistantMsg: Message = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        timestamp: nowLabel()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      console.warn("AI Assistant request failed:", error?.message);
      const friendlyError = error?.message && !/Failed to fetch|NetworkError|Load failed/i.test(error.message)
        ? error.message
        : "I couldn't reach the AI service just now. Please check your connection and try again.";
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: friendlyError,
        timestamp: nowLabel(),
        failedText: userText
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    const userText = input.trim();
    setInput('');
    await sendText(userText, messages);
  };

  const handleRetry = (errorMsg: Message) => {
    if (!errorMsg.failedText || isGenerating) return;
    // Drop the error bubble and the user message that failed, then resend it.
    const idx = messages.findIndex(m => m.id === errorMsg.id);
    const base = messages.slice(0, Math.max(0, idx - 1));
    sendText(errorMsg.failedText, base);
  };

  const ActiveIcon = activePersona.icon;

  return (
    <div className="ds-page flex flex-col h-[calc(100dvh-3.5rem)]">
      {/* Persona Selector */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {PERSONAS.map(p => {
          const Icon = p.icon;
          const isSelected = activePersonaId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handlePersonaChange(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                isSelected 
                  ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' 
                  : 'bg-transparent border-transparent text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? p.color.split(' ')[0].replace('bg-', 'text-') : 'text-stone-400'}`} />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl ${activePersona.color} flex items-center justify-center font-bold shadow-lg`}>
            <ActiveIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              {activePersona.name} AI Assistant <Sparkles className={`w-4 h-4 ${activePersona.iconColor}`} />
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">{activePersona.role}</p>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            type="button"
            onClick={handleClearConversation}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            New chat
          </button>
        )}
      </div>

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar" role="log" aria-live="polite" aria-label={`Conversation with ${activePersona.name}`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
              msg.sender === 'user' ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950' : `${activePersona.color} shadow-md`
            }`}>
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <ActiveIcon className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] min-w-0 rounded-2xl px-5 py-3.5 text-sm ${
              msg.sender === 'user' 
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-tr-xs' 
                : msg.failedText
                  ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 rounded-tl-xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 shadow-sm rounded-tl-xs'
            }`}>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                  {msg.sender === 'user' ? 'You' : activePersona.name}
                </span>
                <span className="text-[10px] opacity-50">{msg.timestamp}</span>
              </div>
              {msg.failedText ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-2 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{msg.text}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRetry(msg)}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : msg.sender === 'assistant' ? (
                <div className="leading-relaxed break-words [&_h1]:font-bold [&_h1]:text-base [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-3 [&_h3]:font-bold [&_h3]:mt-2 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-stone-100 dark:[&_code]:bg-stone-800 [&_code]:px-1 [&_code]:rounded [&_pre]:overflow-x-auto [&_pre]:bg-stone-100 dark:[&_pre]:bg-stone-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-3 [&_a]:underline">
                  <Markdown>{msg.text}</Markdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${activePersona.color} flex items-center justify-center shadow-md animate-pulse`}>
              <ActiveIcon className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl px-5 py-3.5 text-xs text-stone-500 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="pt-4 border-t border-stone-200 dark:border-stone-800 flex gap-3">
        <label htmlFor="ai-assistant-input" className="sr-only">Message {activePersona.name}</label>
        <input 
          id="ai-assistant-input"
          type="text" 
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-2xl px-5 py-3.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-cobalt-500 shadow-inner"
        />
        <button 
          type="submit"
          disabled={!input.trim() || isGenerating}
          className={`${activePersona.color} hover:opacity-90 disabled:opacity-50 font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer`}
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
