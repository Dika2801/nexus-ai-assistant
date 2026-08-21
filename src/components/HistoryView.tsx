import React, { useState } from 'react';
import {
  History,
  MessageSquare,
  Search,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  Download,
  Check,
  X,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Conversation } from '../types';

interface HistoryViewProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePinConversation: (id: string) => void;
  onNewChat: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onTogglePinConversation,
  onNewChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const titleMatch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const msgMatch = c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return titleMatch || msgMatch;
  });

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const exportConversation = (conv: Conversation) => {
    const exportData = {
      title: conv.title,
      model: conv.model,
      createdAt: new Date(conv.createdAt).toISOString(),
      updatedAt: new Date(conv.updatedAt).toISOString(),
      messages: conv.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_chat_${conv.title.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Baru saja';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mnt lalu`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`;
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-3 py-4 space-y-4 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-blue-400" />
            Riwayat Percakapan
          </h2>
          <p className="text-xs text-white/50">
            Total {conversations.length} sesi percakapan tersimpan secara aman.
          </p>
        </div>

        <button
          id="btn-new-chat-history"
          onClick={onNewChat}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 active:scale-98 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Mulai Chat Baru</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari judul percakapan atau kata kunci..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#111111] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conversation List */}
      {filteredConversations.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl bg-[#080808]">
          <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center text-white/40 mx-auto mb-3">
            <History className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-white/80">
            {searchQuery ? 'Tidak ada percakapan yang cocok.' : 'Belum ada riwayat percakapan.'}
          </p>
          <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
            Percakapan Anda dengan asisten AI akan otomatis tersimpan dan dapat dibuka kembali kapan saja.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;
            const isDeleting = deleteConfirmId === conv.id;
            const lastMsg = conv.messages[conv.messages.length - 1];

            return (
              <div
                key={conv.id}
                id={`conversation-card-${conv.id}`}
                className={`group relative rounded-xl border p-3 sm:p-3.5 transition-all ${
                  isActive
                    ? 'bg-[#161616] border-blue-500/40 shadow-sm'
                    : 'bg-[#111111] hover:bg-[#141414] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left content / Title & Snippet */}
                  <div
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex-1 cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {conv.pinned && (
                        <Pin className="w-3.5 h-3.5 text-blue-400 shrink-0 fill-current" />
                      )}

                      {isEditing ? (
                        <div
                          className="flex items-center gap-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveRename(conv.id)}
                            autoFocus
                            className="px-2 py-0.5 rounded bg-[#080808] border border-blue-500 text-xs font-semibold text-white flex-1 focus:outline-none"
                          />
                          <button
                            onClick={() => saveRename(conv.id)}
                            className="p-1 text-emerald-400 hover:bg-[#1a1a1a] rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-white/40 hover:bg-[#1a1a1a] rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {conv.title}
                        </h3>
                      )}
                    </div>

                    <p className="text-[11px] text-white/50 line-clamp-1">
                      {lastMsg ? lastMsg.content.slice(0, 100) : 'Percakapan kosong'}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                      <span>•</span>
                      <span>{conv.messages.length} pesan</span>
                      <span>•</span>
                      <span className="font-mono text-blue-400/80">{conv.model}</span>
                    </div>
                  </div>

                  {/* Actions Dropdown / Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-rose-950/40 border border-rose-800/40 px-2 py-1 rounded-lg">
                        <span className="text-[10px] text-rose-300 font-semibold">Hapus?</span>
                        <button
                          onClick={() => {
                            onDeleteConversation(conv.id);
                            setDeleteConfirmId(null);
                          }}
                          className="p-0.5 text-rose-400 hover:text-white rounded"
                          title="Konfirmasi Hapus"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-0.5 text-white/40 hover:text-white rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Pin Toggle */}
                        <button
                          onClick={() => onTogglePinConversation(conv.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            conv.pinned
                              ? 'text-blue-400 hover:bg-[#1a1a1a]'
                              : 'text-white/40 hover:text-white hover:bg-[#1a1a1a]'
                          }`}
                          title={conv.pinned ? 'Lepas Pin' : 'Sematkan (Pin) di Atas'}
                        >
                          {conv.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>

                        {/* Rename */}
                        <button
                          onClick={() => startRename(conv)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-[#1a1a1a] transition-colors"
                          title="Ubah Nama Percakapan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Export */}
                        <button
                          onClick={() => exportConversation(conv)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-[#1a1a1a] transition-colors"
                          title="Ekspor Chat (JSON)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirmId(conv.id)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Hapus Percakapan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Open Chat Trigger */}
                        <button
                          onClick={() => onSelectConversation(conv.id)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors ml-1"
                          title="Buka Percakapan"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

