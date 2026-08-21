import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  Compass,
  Image as ImageIcon,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  Sparkles,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { Conversation, User, CustomGPT } from '../types';

interface ChatGPTSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePinConversation: (id: string) => void;
  isOpen: boolean;
  onToggleSidebar: () => void;
  onOpenExploreGPTs: () => void;
  onOpenDalleStudio: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  user: User | null;
}

export const ChatGPTSidebar: React.FC<ChatGPTSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePinConversation,
  isOpen,
  onToggleSidebar,
  onOpenExploreGPTs,
  onOpenDalleStudio,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
  user,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Group conversations by date
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned = filteredConversations.filter((c) => c.pinned);
  const unpinned = filteredConversations.filter((c) => !c.pinned);

  const today = unpinned.filter((c) => now - c.updatedAt < oneDay);
  const yesterday = unpinned.filter((c) => now - c.updatedAt >= oneDay && now - c.updatedAt < 2 * oneDay);
  const last7Days = unpinned.filter((c) => now - c.updatedAt >= 2 * oneDay && now - c.updatedAt < sevenDays);
  const older = unpinned.filter((c) => now - c.updatedAt >= sevenDays);

  const handleStartEdit = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveEdit = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const renderGroup = (title: string, list: Conversation[]) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className="px-3 text-[11px] font-medium text-white/35 uppercase tracking-wider mb-1.5">
          {title}
        </h4>
        <div className="space-y-0.5">
          {list.map((c) => {
            const isActive = c.id === activeConversationId;
            const isEditing = c.id === editingId;

            return (
              <div
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white/10 text-white font-medium shadow-sm'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveEdit(c.id, e)}
                    className="flex-1 mr-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(c.id)}
                      autoFocus
                      className="w-full bg-[#1a1a1a] border border-emerald-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                  </form>
                ) : (
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <MessageSquare
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isActive ? 'text-emerald-400' : 'text-white/40 group-hover:text-white/70'
                      }`}
                    />
                    <span className="truncate">{c.title || 'Percakapan Baru'}</span>
                  </div>
                )}

                {/* Actions on hover */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinConversation(c.id);
                      }}
                      className={`p-1 rounded hover:bg-white/10 ${
                        c.pinned ? 'text-emerald-400' : 'text-white/40 hover:text-white'
                      }`}
                      title={c.pinned ? 'Lepas Pin' : 'Sematkan Chat'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleStartEdit(c, e)}
                      className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"
                      title="Ubah Judul"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => onDeleteConversation(c.id, e)}
                      className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10"
                      title="Hapus Chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggleSidebar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      <aside
        id="nexus-chatgpt-sidebar"
        className={`fixed lg:static top-0 left-0 z-50 h-full w-[270px] xl:w-[290px] bg-[#111111] border-r border-white/5 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-none'
        }`}
      >
        {/* Top Header */}
        <div className="p-3 border-b border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            {/* New Chat Primary Button */}
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 1024) onToggleSidebar();
              }}
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/5 hover:border-white/10 shadow-sm active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>New chat</span>
              </div>
              <span className="text-[10px] font-mono text-white/40 border border-white/10 rounded px-1.5 py-0.5">
                ⌘K
              </span>
            </button>

            <button
              onClick={onToggleSidebar}
              className="ml-2 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 lg:hidden"
              title="Tutup Menu"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari percakapan..."
              className="w-full bg-[#181818] border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Special Explore Links */}
          <div className="space-y-0.5 pt-1">
            <button
              onClick={() => {
                onOpenExploreGPTs();
                if (window.innerWidth < 1024) onToggleSidebar();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Explore GPTs</span>
            </button>
            <button
              onClick={() => {
                onOpenDalleStudio();
                if (window.innerWidth < 1024) onToggleSidebar();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-amber-400" />
              <span>DALL-E 3 Studio</span>
            </button>
          </div>
        </div>

        {/* Conversation History Timeline */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-white/30 text-xs">
              Belum ada percakapan. Mulai obrolan baru dengan NEXUS AI.
            </div>
          ) : (
            <>
              {renderGroup('Disematkan (Pinned)', pinned)}
              {renderGroup('Hari Ini', today)}
              {renderGroup('Kemarin', yesterday)}
              {renderGroup('7 Hari Terakhir', last7Days)}
              {renderGroup('Sebelumnya', older)}
            </>
          )}
        </div>

        {/* User Account & Footer Settings (ChatGPT style) */}
        <div className="p-3 border-t border-white/5 bg-[#0e0e0e] space-y-1">
          {user?.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-amber-400 hover:bg-amber-400/10 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Control Panel</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings className="w-4 h-4 text-white/50" />
            <span>Pengaturan & Custom Memory</span>
          </button>

          {/* User Profile Pill */}
          <div
            onClick={onOpenAuth}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                {user ? user.username.charAt(0).toUpperCase() : 'G'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user ? user.name || user.username : 'Guest User'}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono">
                  {user?.role === 'admin' ? 'Admin Access' : 'NEXUS Pro / OpenAI'}
                </p>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
};
