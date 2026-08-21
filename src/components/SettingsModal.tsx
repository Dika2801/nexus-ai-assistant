import React, { useState } from 'react';
import {
  X,
  Settings,
  Cpu,
  Volume2,
  Brain,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  Download,
  Trash2,
  CheckCircle2,
  Sparkles,
  Key,
} from 'lucide-react';
import { AppSettings, AIModel, User, Conversation } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  models: AIModel[];
  conversations: Conversation[];
  onClearAllConversations: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  settings,
  onUpdateSettings,
  models,
  conversations,
  onClearAllConversations,
  onLogout,
  onOpenAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'voice' | 'memory' | 'model' | 'data'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExportData = () => {
    const dataStr = JSON.stringify(conversations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_chatgpt_conversations_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveMemory = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pengaturan & Preferensi</h2>
              <p className="text-xs text-white/50">Kelola akun, suara ChatGPT, memori kustom, dan model AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-56 p-3 border-b md:border-b-0 md:border-r border-white/5 bg-[#111111] space-y-1 flex-shrink-0">
            {[
              { id: 'general', label: 'Umum & Tema', icon: Settings },
              { id: 'voice', label: 'Suara (Voice)', icon: Volume2 },
              { id: 'memory', label: 'Custom Memory', icon: Brain },
              { id: 'model', label: 'Model & Engine', icon: Cpu },
              { id: 'data', label: 'Data & Riwayat', icon: Download },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {user?.role === 'admin' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full mt-4 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-400 hover:bg-amber-400/10 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Tema Tampilan</h3>
                  <p className="text-xs text-white/50 mb-3">Pilih tema antarmuka visual NEXUS AI</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onUpdateSettings({ theme: 'dark' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                        settings.theme === 'dark'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-[#161616] border-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Dark Theme (ChatGPT)</span>
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ theme: 'light' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                        settings.theme === 'light'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-[#161616] border-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>Light Theme</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Streaming Output</h4>
                      <p className="text-[11px] text-white/50">Tampilkan teks kata demi kata secara real-time</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.streamResponse}
                      onChange={(e) => onUpdateSettings({ streamResponse: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {user && (
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Keluar dari Akun</h4>
                      <p className="text-[11px] text-white/50">Masuk sebagai: {user.username}</p>
                    </div>
                    <button
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. VOICE TAB */}
            {activeTab === 'voice' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Karakter Suara Pria (ChatGPT Male Voice)</h3>
                  <p className="text-xs text-white/50 mb-3">
                    Menggunakan pemrosesan audio berfrekuensi natural khas suara pria asisten ChatGPT
                  </p>

                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
                    <p className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Natural Male AI Voice Aktif
                    </p>
                    <p className="text-[11px] text-white/70 mt-1">
                      Suara dirancang dengan intonasi pria berwibawa, jernih, dan artikulasi lancar dalam Bahasa Indonesia & Inggris.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#161616] border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white">Baca Otomatis Balasan AI</p>
                      <p className="text-[11px] text-white/40">Suarakan setiap respons yang diterima secara otomatis</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.voice.autoSpeak}
                      onChange={(e) =>
                        onUpdateSettings({
                          voice: { ...settings.voice, autoSpeak: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-[#161616] border border-white/5">
                      <label className="block text-xs font-medium text-white/80 mb-2">
                        Kecepatan Bicara: {settings.voice.rate}x
                      </label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={settings.voice.rate}
                        onChange={(e) =>
                          onUpdateSettings({
                            voice: { ...settings.voice, rate: parseFloat(e.target.value) },
                          })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-[#161616] border border-white/5">
                      <label className="block text-xs font-medium text-white/80 mb-2">
                        Pitch Nada Suara: {settings.voice.pitch} (Deep Male)
                      </label>
                      <input
                        type="range"
                        min="0.7"
                        max="1.3"
                        step="0.02"
                        value={settings.voice.pitch}
                        onChange={(e) =>
                          onUpdateSettings({
                            voice: { ...settings.voice, pitch: parseFloat(e.target.value) },
                          })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. CUSTOM INSTRUCTIONS / MEMORY TAB (ChatGPT feature) */}
            {activeTab === 'memory' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-emerald-400" />
                    Custom Instructions (Memori Personal)
                  </h3>
                  <p className="text-xs text-white/50">
                    Beri tahu NEXUS AI bagaimana Anda ingin asisten merespons dan latar belakang Anda untuk semua percakapan.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#161616] border border-white/5">
                  <span className="text-xs font-semibold text-white">Aktifkan Custom Memory untuk Chat Baru</span>
                  <input
                    type="checkbox"
                    checked={settings.customInstructions?.enabled ?? true}
                    onChange={(e) =>
                      onUpdateSettings({
                        customInstructions: {
                          ...(settings.customInstructions || { aboutUser: '', howToRespond: '' }),
                          enabled: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">
                    1. Apa yang ingin Anda NEXUS ketahui tentang Anda untuk memberikan jawaban terbaik?
                  </label>
                  <textarea
                    value={settings.customInstructions?.aboutUser || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        customInstructions: {
                          ...(settings.customInstructions || { enabled: true, howToRespond: '' }),
                          aboutUser: e.target.value,
                        },
                      })
                    }
                    placeholder="Misal: Saya seorang software engineer full-stack di Indonesia, menyukai penjelasan arsitektur yang mendalam dan ringkas..."
                    className="w-full h-24 bg-[#161616] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">
                    2. Bagaimana Anda ingin NEXUS AI merespons? (Gaya, nada, struktur)
                  </label>
                  <textarea
                    value={settings.customInstructions?.howToRespond || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        customInstructions: {
                          ...(settings.customInstructions || { enabled: true, aboutUser: '' }),
                          howToRespond: e.target.value,
                        },
                      })
                    }
                    placeholder="Misal: Berikan jawaban to the point, sertakan kode siap pakai dengan penjelasan ringkas, gunakan gaya bahasa santun profesional..."
                    className="w-full h-24 bg-[#161616] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveMemory}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {saveSuccess ? 'Tersimpan!' : 'Simpan Memori'}
                  </button>
                </div>
              </div>
            )}

            {/* 4. MODEL & ENGINE TAB */}
            {activeTab === 'model' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Model OpenAI & Multimodal Engine</h3>
                  <p className="text-xs text-white/50">Pilih model default untuk memulai percakapan baru</p>
                </div>

                <div className="space-y-2.5">
                  {models.map((model) => {
                    const isSelected = settings.defaultModel === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => onUpdateSettings({ defaultModel: model.id })}
                        className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                            : 'bg-[#161616] hover:bg-[#1c1c1c] border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-2">
                            {model.name}
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          </span>
                          {model.badge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/80 border border-white/10">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed mb-2">{model.description}</p>
                        <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5">
                          <span>Context Window: {model.contextWindow}</span>
                          <span className="text-emerald-400 font-mono">{model.speed}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. DATA CONTROLS TAB */}
            {activeTab === 'data' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Data & Riwayat Percakapan</h3>
                  <p className="text-xs text-white/50">Ekspor atau hapus seluruh data percakapan Anda dengan aman</p>
                </div>

                <div className="p-4 rounded-xl bg-[#161616] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Ekspor Semua Chat ({conversations.length} Percakapan)</h4>
                      <p className="text-[11px] text-white/40">Unduh arsip percakapan lengkap dalam format JSON</p>
                    </div>
                    <button
                      onClick={handleExportData}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Ekspor JSON
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-red-400">Hapus Seluruh Riwayat Chat</h4>
                      <p className="text-[11px] text-white/40">
                        Tindakan ini permanen dan akan menghapus semua pesan tersimpan
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Yakin ingin menghapus seluruh riwayat percakapan?')) {
                          onClearAllConversations();
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Semua
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
