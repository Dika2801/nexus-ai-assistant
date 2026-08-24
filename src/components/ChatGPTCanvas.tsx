import React, { useState } from 'react';
import {
  X,
  Code2,
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Bug,
  BookOpen,
  Zap,
  Globe2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CanvasDocument } from '../types';

interface ChatGPTCanvasProps {
  document: CanvasDocument;
  isOpen: boolean;
  onClose: () => void;
  onUpdateDocument: (updated: Partial<CanvasDocument>) => void;
  onSendActionToChat: (prompt: string) => void;
}

export const ChatGPTCanvas: React.FC<ChatGPTCanvasProps> = ({
  document,
  isOpen,
  onClose,
  onUpdateDocument,
  onSendActionToChat,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([document.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    const ext = document.isCode ? (document.language === 'python' ? 'py' : document.language === 'javascript' ? 'js' : document.language === 'html' ? 'html' : 'ts') : 'md';
    a.download = `${document.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'nexus_canvas'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      id="nexus-chatgpt-canvas"
      className={`fixed lg:relative top-0 right-0 z-40 h-full bg-[#0d0d0d] border-l border-white/10 flex flex-col shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'w-full inset-0 z-50' : 'w-full lg:w-[480px] xl:w-[560px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#141414]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {document.isCode ? <Code2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <input
              type="text"
              value={document.title}
              onChange={(e) => onUpdateDocument({ title: e.target.value })}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 w-full truncate"
              placeholder="Judul Dokumen..."
            />
            <p className="text-[10px] text-white/40 px-1 font-mono uppercase">
              {document.isCode ? `Kode: ${document.language || 'text'}` : 'Dokumen / Tulisan'} • Canvas Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title="Salin Semua"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title="Download Berkas"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hidden lg:flex p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Kecilkan' : 'Perbesar Layar Penuh'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title="Tutup Canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Action Toolbar (ChatGPT Canvas feature) */}
      <div className="px-4 py-2 border-b border-white/5 bg-[#111111] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider whitespace-nowrap mr-1">
          Aksi AI:
        </span>
        {document.isCode ? (
          <>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Tinjau dan perbaiki bug/kesalahan dalam kode ini:\n\`\`\`${document.language}\n${document.content}\n\`\`\``
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 whitespace-nowrap transition-colors"
            >
              <Bug className="w-3 h-3" /> Perbaiki Bug
            </button>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Tambahkan komentar dokumentasi penjelasan yang rapi pada kode ini:\n\`\`\`${document.language}\n${document.content}\n\`\`\``
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 whitespace-nowrap transition-colors"
            >
              <BookOpen className="w-3 h-3" /> Beri Komentar
            </button>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Optimalkan performa, struktur, dan efisiensi kode ini:\n\`\`\`${document.language}\n${document.content}\n\`\`\``
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 whitespace-nowrap transition-colors"
            >
              <Zap className="w-3 h-3" /> Optimasi Kode
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Sempurnakan tata bahasa, pilihan kata, dan alur penulisan dokumen berikut:\n\n${document.content}`
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 whitespace-nowrap transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Poles Tulisan
            </button>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Ringkas dokumen berikut menjadi poin-poin eksekutif kunci:\n\n${document.content}`
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 whitespace-nowrap transition-colors"
            >
              <BookOpen className="w-3 h-3" /> Buat Ringkasan
            </button>
            <button
              onClick={() =>
                onSendActionToChat(
                  `Terjemahkan dokumen ini ke Bahasa Inggris secara profesional dan natural:\n\n${document.content}`
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 whitespace-nowrap transition-colors"
            >
              <Globe2 className="w-3 h-3" /> Translate to English
            </button>
          </>
        )}
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <textarea
          value={document.content}
          onChange={(e) => onUpdateDocument({ content: e.target.value })}
          className="w-full h-full min-h-[400px] bg-transparent text-sm text-white/90 font-mono resize-none focus:outline-none leading-relaxed selection:bg-emerald-500/30"
          placeholder="Tulis kode atau catatan Anda di sini..."
          spellCheck="false"
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-white/10 bg-[#111111] text-[11px] text-white/40 flex items-center justify-between">
        <span>{document.content.length} karakter • {document.content.split(/\s+/).filter(Boolean).length} kata</span>
        <span>Perubahan tersimpan otomatis</span>
      </div>
    </aside>
  );
};
