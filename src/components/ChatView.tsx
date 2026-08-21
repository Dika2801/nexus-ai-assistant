import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
  Image as ImageIcon,
  FileText,
  X,
  Square,
  Globe,
  ExternalLink,
  Bot,
  User as UserIcon,
  Headphones,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Code2,
  Columns,
  Download,
  Edit3,
  Brain,
  Table as TableIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Attachment, AIModel, VoiceSettings } from '../types';
import { VoiceManager } from '../lib/voice';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (
    content: string,
    attachments?: Attachment[],
    options?: { enableWebSearch?: boolean; enableThinking?: boolean }
  ) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  activeModel: string;
  models: AIModel[];
  onSelectModel: (modelId: string) => void;
  voiceSettings: VoiceSettings;
  onNewChat: () => void;
  onOpenVoiceMode?: () => void;
  onOpenInCanvas?: (content: string, isCode: boolean, language?: string, title?: string) => void;
  onRegenerateLastMessage?: (modelId?: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  activeModel,
  models,
  onSelectModel,
  voiceSettings,
  onNewChat,
  onOpenVoiceMode,
  onOpenInCanvas,
  onRegenerateLastMessage,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Clean up any ongoing audio playback on unmount
  useEffect(() => {
    return () => {
      VoiceManager.stopSpeaking();
      VoiceManager.stopListening();
    };
  }, []);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    VoiceManager.stopSpeaking();
    setSpeakingMessageId(null);

    onSendMessage(input.trim(), attachments, {
      enableWebSearch,
      enableThinking,
    });
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File & Image Picker
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = file.type.startsWith('image/');

      if (isImg) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: 'att_' + Date.now() + '_' + i,
              name: file.name,
              type: 'image',
              mimeType: file.type,
              size: file.size,
              dataUrl,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const textContent = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: 'att_' + Date.now() + '_' + i,
              name: file.name,
              type: 'document',
              mimeType: file.type || 'text/plain',
              size: file.size,
              extractedText: textContent.slice(0, 50000),
            },
          ]);
        };
        reader.readAsText(file);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Voice Input (STT)
  const toggleVoiceInput = () => {
    if (isListening) {
      VoiceManager.stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      setVoiceTranscript('');
      VoiceManager.startListening(
        {
          onResult: (transcript, isFinal) => {
            setVoiceTranscript(transcript);
            setInput((prev) => {
              const prefix = prev ? prev + ' ' : '';
              return prefix + transcript;
            });
            if (isFinal) {
              setIsListening(false);
            }
          },
          onError: (err) => {
            console.warn('STT Error:', err);
            setIsListening(false);
          },
          onEnd: () => {
            setIsListening(false);
          },
        },
        voiceSettings.language || 'id-ID'
      );
    }
  };

  // Voice Output (TTS) with Natural Male ChatGPT Voice
  const handleSpeak = (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      VoiceManager.stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Kode program terlampir.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/[#*_~]/g, '');

    setSpeakingMessageId(msgId);
    VoiceManager.speak(cleanText, {
      voiceName: voiceSettings.voiceName,
      rate: voiceSettings.rate || 1.05,
      pitch: voiceSettings.pitch || 0.92,
      lang: voiceSettings.language || 'id-ID',
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
  };

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    setFeedbackMap((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? (undefined as any) : type,
    }));
  };

  // Prompt starters for empty state (ChatGPT style)
  const promptStarters = [
    {
      title: 'Tulis & Review Kode',
      desc: 'Buat full-stack TypeScript API dengan Express dan validasi Zod',
      prompt: 'Buat arsitektur backend Express API dengan TypeScript, validasi input menggunakan Zod, dan manajemen error yang rapi.',
      icon: Code2,
    },
    {
      title: 'DALL-E Visual Art',
      desc: 'Rancang prompt lukisan lanskap kota futuristik beresolusi 8k',
      prompt: 'Buatkan prompt DALL-E 3 yang sangat detail untuk pemandangan kota metropolitan futuristik di malam hari dengan pencahayaan neon sinematik.',
      icon: ImageIcon,
    },
    {
      title: 'Analisis & Riset Mendalam',
      desc: 'Bandingkan arsitektur OpenAI GPT-5.6 dengan frontier models',
      prompt: 'Analisis keunggulan arsitektur penalaran frontier model OpenAI GPT-5.6 Sol dibandingkan model generasi sebelumnya.',
      icon: Sparkles,
    },
    {
      title: 'Sintesis & Dokumen',
      desc: 'Susun rencana strategis peluncuran produk teknologi (Go-To-Market)',
      prompt: 'Susun dokumen rencana Go-To-Market (GTM) strategis untuk peluncuran produk SaaS AI dengan target pasar Asia Tenggara.',
      icon: FileText,
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-4xl mx-auto w-full px-3 sm:px-4">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pt-4 pb-4 space-y-6 pr-1">
        {messages.length === 0 ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-8 animate-in fade-in">
            {/* ChatGPT Logo Badge */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.25" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Apa yang bisa saya bantu hari ini?
            </h2>
            <p className="text-xs sm:text-sm text-white/50 max-w-md mb-8 leading-relaxed">
              NEXUS AI bertenaga OpenAI GPT-5.6, DALL-E 3 Visual Studio, Canvas Workspace, dan ChatGPT Live Voice Mode.
            </p>

            {/* Quick Starters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {promptStarters.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    id={`starter-card-${idx}`}
                    onClick={() => {
                      setInput(item.prompt);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="p-4 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 hover:border-emerald-500/30 text-slate-200 transition-all duration-200 group active:scale-[0.99] shadow-sm hover:shadow-emerald-500/5"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors">
                        <Icon className="w-4 h-4 text-white/70 group-hover:text-emerald-400" />
                      </div>
                      <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed pl-8">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSpeaking = speakingMessageId === msg.id;
            const feedback = feedbackMap[msg.id];

            return (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-emerald-500/20 ring-1 ring-white/10">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                  </div>
                )}

                <div className={`max-w-[90%] sm:max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Message Bubble Container */}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      isUser
                        ? 'bg-[#262626] text-white rounded-tr-sm border border-white/5'
                        : 'bg-transparent text-slate-100 px-0 sm:px-1'
                    }`}
                  >
                    {/* User attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 p-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white/80"
                          >
                            {att.type === 'image' ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 px-2 py-1">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                <span className="max-w-[120px] truncate">{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* DALL-E Generated Image Display */}
                    {msg.imageUrl && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 bg-black/30 max-w-lg">
                        <img
                          src={msg.imageUrl}
                          alt="DALL-E Output"
                          className="w-full h-auto object-contain max-h-[400px]"
                        />
                        <div className="p-2.5 bg-[#141414] border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] font-mono text-emerald-400">DALL-E 3 Studio</span>
                          <a
                            href={msg.imageUrl}
                            download="nexus_art.png"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-white/70 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Simpan Gambar
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Markdown Content */}
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed selection:bg-emerald-500/30">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table({ children, ...props }: any) {
                            return (
                              <div className="my-4 rounded-xl border border-white/10 bg-[#0f0f0f] overflow-hidden shadow-lg">
                                <div className="flex items-center justify-between px-3.5 py-2 bg-[#171717] border-b border-white/5 text-xs text-white/50">
                                  <div className="flex items-center gap-1.5 font-medium text-white/70">
                                    <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Tabel Terstruktur</span>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs" {...props}>
                                    {children}
                                  </table>
                                </div>
                              </div>
                            );
                          },
                          thead({ children, ...props }: any) {
                            return (
                              <thead className="bg-[#1b1b1b] text-white/90 font-semibold border-b border-white/10" {...props}>
                                {children}
                              </thead>
                            );
                          },
                          tbody({ children, ...props }: any) {
                            return (
                              <tbody className="divide-y divide-white/5 text-white/80" {...props}>
                                {children}
                              </tbody>
                            );
                          },
                          tr({ children, ...props }: any) {
                            return (
                              <tr className="hover:bg-white/[0.03] transition-colors" {...props}>
                                {children}
                              </tr>
                            );
                          },
                          th({ children, ...props }: any) {
                            return (
                              <th className="px-4 py-2.5 font-semibold text-white/90 text-left border-b border-white/10 tracking-wide text-xs" {...props}>
                                {children}
                              </th>
                            );
                          },
                          td({ children, ...props }: any) {
                            return (
                              <td className="px-4 py-2.5 text-white/80 border-b border-white/5 text-xs align-top" {...props}>
                                {children}
                              </td>
                            );
                          },
                          blockquote({ children, ...props }: any) {
                            return (
                              <blockquote className="border-l-2 border-emerald-500/70 pl-3.5 my-3 text-white/70 italic text-xs bg-white/[0.02] py-1.5 rounded-r-lg" {...props}>
                                {children}
                              </blockquote>
                            );
                          },
                          ul({ children, ...props }: any) {
                            return (
                              <ul className="list-disc list-inside my-2 space-y-1 text-white/85 text-xs" {...props}>
                                {children}
                              </ul>
                            );
                          },
                          ol({ children, ...props }: any) {
                            return (
                              <ol className="list-decimal list-inside my-2 space-y-1 text-white/85 text-xs" {...props}>
                                {children}
                              </ol>
                            );
                          },
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');

                            if (!inline && match) {
                              const lang = match[1];
                              return (
                                <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d0d]">
                                  <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#171717] border-b border-white/5 text-xs text-white/50 font-mono">
                                    <span className="text-[11px] font-semibold uppercase text-emerald-400">
                                      {lang}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {onOpenInCanvas && (
                                        <button
                                          onClick={() =>
                                            onOpenInCanvas(codeString, true, lang, `${lang.toUpperCase()} Snippet`)
                                          }
                                          className="flex items-center gap-1 text-[11px] text-white/60 hover:text-emerald-400 transition-colors"
                                          title="Buka di Canvas Workspace"
                                        >
                                          <Columns className="w-3 h-3" />
                                          <span>Canvas</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleCopy(`code_${msg.id}`, codeString)}
                                        className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors"
                                      >
                                        {copiedId === `code_${msg.id}` ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-400" />
                                            <span className="text-emerald-400">Tersalin</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            <span>Salin Kode</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <pre className="p-3.5 text-xs font-mono overflow-x-auto text-emerald-300/90 leading-relaxed bg-[#0d0d0d]">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              );
                            }
                            return (
                              <code
                                className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 font-mono text-[12px]"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          p({ node, children, ...props }: any) {
                            const hasBlockChild = node?.children?.some(
                              (child: any) =>
                                child.tagName === 'img' ||
                                (child.type === 'element' && (child.tagName === 'img' || child.tagName === 'div'))
                            );
                            if (hasBlockChild) {
                              return <div className="mb-2 last:mb-0">{children}</div>;
                            }
                            return <p className="mb-2 last:mb-0" {...props}>{children}</p>;
                          },
                          img({ src, alt, ...props }: any) {
                            return (
                              <span className="my-4 group relative block max-w-full sm:max-w-md rounded-2xl overflow-hidden border border-white/15 bg-[#121212] shadow-2xl">
                                <img
                                  src={src}
                                  alt={alt || 'Gambar Buatan AI'}
                                  className="w-full h-auto max-h-[500px] object-cover rounded-t-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                                  loading="lazy"
                                  {...props}
                                />
                                <span className="p-3 bg-[#181818] border-t border-white/10 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 overflow-hidden">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                                    <span className="text-xs text-white/80 font-medium truncate">
                                      {alt || 'Gambar DALL-E Studio'}
                                    </span>
                                  </span>
                                  <a
                                    href={src}
                                    download={`nexus-art-${Date.now()}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-sm transition-all active:scale-95"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Unduh HD</span>
                                  </a>
                                </span>
                              </span>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Web Search Sources / Grounding */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-[11px] font-semibold text-white/50 mb-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          Sumber Referensi Terverifikasi:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 text-[11px] text-white/70 hover:text-emerald-400 transition-colors"
                            >
                              <span className="truncate max-w-[200px]">{src.title || src.uri}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assistant Actions Bar (ChatGPT Action Row) */}
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mt-2 text-white/40">
                      {/* Copy Text */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
                        title="Salin Pesan"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* TTS Speak (Natural Male ChatGPT Voice) */}
                      <button
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className={`p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors ${
                          isSpeaking ? 'text-emerald-400 bg-emerald-500/10' : ''
                        }`}
                        title={isSpeaking ? 'Hentikan Suara' : 'Dengarkan Suara Natural Pria'}
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Open in Canvas */}
                      {onOpenInCanvas && (
                        <button
                          onClick={() => onOpenInCanvas(msg.content, false, 'text', 'Catatan AI')}
                          className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
                          title="Buka di Canvas Workspace"
                        >
                          <Columns className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Regenerate */}
                      {onRegenerateLastMessage && (
                        <button
                          onClick={() => onRegenerateLastMessage(activeModel)}
                          className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
                          title="Generate Ulang Jawaban"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Thumbs Up */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={`p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors ${
                          feedback === 'up' ? 'text-emerald-400 bg-emerald-500/10' : ''
                        }`}
                        title="Jawaban Bagus"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Thumbs Down */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={`p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors ${
                          feedback === 'down' ? 'text-rose-400 bg-rose-500/10' : ''
                        }`}
                        title="Perbaiki Jawaban"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Model & Token Info */}
                      {msg.model && (
                        <span className="text-[10px] text-white/30 font-mono ml-2">
                          {msg.model}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Pill (ChatGPT Style) */}
      <div className="sticky bottom-3 z-20 pb-1">
        <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl p-2.5 transition-all focus-within:border-emerald-500/50">
          {/* Attachments Preview Bar */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-1.5 mb-2 bg-[#141414] rounded-xl border border-white/5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242424] text-xs text-white/90 border border-white/10"
                >
                  {att.type === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="max-w-[140px] truncate">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Voice transcript badge while recording */}
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 animate-pulse">
              <Mic className="w-3.5 h-3.5" />
              <span className="truncate">{voiceTranscript || 'Mendengarkan ucapan Anda...'}</span>
            </div>
          )}

          {/* Textarea Input */}
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan apa saja ke NEXUS AI..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none resize-none px-2 py-1 leading-relaxed max-h-40"
          />

          {/* Input Controls Toolbar */}
          <div className="flex items-center justify-between pt-1">
            {/* Left Tools */}
            <div className="flex items-center gap-1">
              {/* File Attachment */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Unggah Gambar atau Dokumen"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.pdf,.docx,.json,.js,.ts,.py,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Web Search Grounding Toggle */}
              <button
                type="button"
                onClick={() => setEnableWebSearch(!enableWebSearch)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                  enableWebSearch
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border-white/5'
                }`}
                title="Aktifkan Pencarian Web Terkini (Grounding)"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>

              {/* Thinking Mode (Deep Reasoning) Toggle */}
              <button
                type="button"
                onClick={() => setEnableThinking(!enableThinking)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                  enableThinking
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border-white/5'
                }`}
                title="Mode Berpikir Mendalam (Deep Reasoning & High Thinking)"
              >
                <Brain className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Think</span>
              </button>

              {/* STT Microphone */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2 rounded-xl transition-colors ${
                  isListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title={isListening ? 'Hentikan Rekaman' : 'Bicara (Speech-to-Text)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Right Tools: Live Voice Mode & Send Button */}
            <div className="flex items-center gap-1.5">
              {/* ChatGPT Live Voice Mode Button */}
              {onOpenVoiceMode && (
                <button
                  type="button"
                  onClick={onOpenVoiceMode}
                  className="p-2 rounded-xl text-white/80 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 transition-all group"
                  title="Masuk ke ChatGPT Live Voice Mode"
                >
                  <Headphones className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
              )}

              {/* Send or Stop Button */}
              {isStreaming ? (
                <button
                  type="button"
                  id="btn-stop-streaming"
                  onClick={() => {
                    VoiceManager.stopSpeaking();
                    setSpeakingMessageId(null);
                    onStopStreaming();
                  }}
                  className="p-2 rounded-xl bg-white text-black hover:bg-white/90 shadow-sm active:scale-95 transition-all"
                  title="Hentikan Jawaban"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-send-message"
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-2 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-95 transition-all"
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-center text-white/30 mt-1 font-mono">
          NEXUS AI dapat membuat kesalahan. Harap verifikasi informasi penting.
        </p>
      </div>
    </div>
  );
};
