import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft,
  ChevronDown,
  Sparkles,
  Cpu,
  Share2,
  Check,
  Compass,
  Image as ImageIcon,
  Columns,
  Settings,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { User, AIModel } from '../types';

interface TopNavProps {
  user: User | null;
  activeModel: string;
  models: AIModel[];
  onSelectModel: (modelId: string) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onOpenExploreGPTs: () => void;
  onOpenDalleStudio: () => void;
  onToggleCanvas: () => void;
  isCanvasOpen: boolean;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  hasActiveConversation: boolean;
  onShareConversation: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  user,
  activeModel,
  models,
  onSelectModel,
  onNewChat,
  onToggleSidebar,
  onOpenExploreGPTs,
  onOpenDalleStudio,
  onToggleCanvas,
  isCanvasOpen,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
  hasActiveConversation,
  onShareConversation,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find((m) => m.id === activeModel) || models[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShareClick = () => {
    onShareConversation();
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 px-3 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Sidebar Toggle & Model Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Buka/Tutup Menu Riwayat"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Brand Logo for Mobile */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-sm ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white tracking-tight hidden xs:inline">
              NEXUS
            </span>
          </div>

          {/* Model Selector Dropdown (ChatGPT-style header dropdown) */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors"
            >
              <span className="text-white/90 truncate max-w-[130px] sm:max-w-none">
                {currentModel?.name || 'OpenAI GPT-5.6'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-white/40 tracking-wider">
                  Pilih Model AI
                </div>
                <div className="space-y-1">
                  {models.map((m) => {
                    const isSelected = m.id === activeModel;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-500/15 text-white border border-emerald-500/30'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            {m.name}
                            {isSelected && <Sparkles className="w-3 h-3 text-emerald-400" />}
                          </span>
                          {m.badge && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 line-clamp-1 leading-snug">
                          {m.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Tools & Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Explore GPTs Shortcut */}
          <button
            onClick={onOpenExploreGPTs}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/5 transition-colors"
            title="Jelajahi Custom GPTs"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Explore GPTs</span>
          </button>

          {/* DALL-E 3 Studio */}
          <button
            onClick={onOpenDalleStudio}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/5 transition-colors"
            title="DALL-E 3 Image Studio"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">DALL-E</span>
          </button>

          {/* Canvas Workspace Toggle */}
          <button
            onClick={onToggleCanvas}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isCanvasOpen
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'text-white/70 hover:text-white hover:bg-white/5 border-white/5'
            }`}
            title="Toggle Canvas Workspace"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Canvas</span>
          </button>

          {/* Share Chat */}
          {hasActiveConversation && (
            <button
              onClick={handleShareClick}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              title="Bagikan Tautan Chat"
            >
              {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          )}

          {/* New Chat Top Button */}
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-sm active:scale-95 transition-all"
            title="Chat Baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title="Pengaturan"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
