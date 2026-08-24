import React from 'react';
import {
  Settings,
  Cpu,
  Moon,
  Sun,
  Volume2,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { AIModel, AppSettings, User } from '../types';

interface SettingsViewProps {
  user: User | null;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  models: AIModel[];
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  settings,
  onUpdateSettings,
  models,
  onLogout,
  onOpenAdmin,
}) => {
  return (
    <div className="max-w-4xl mx-auto w-full px-3 py-4 space-y-4 pb-20">
      {/* Header */}
      <div className="border-b border-white/5 pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-4.5 h-4.5 text-blue-400" />
          Pengaturan Aplikasi
        </h2>
        <p className="text-xs text-white/50">
          Konfigurasi model AI, preferensi suara, tema visual, dan status backend.
        </p>
      </div>

      {/* 1. Model Selection */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            Model AI Utama
          </h3>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            OpenAI & Multimodal
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {models.map((model) => {
            const isSelected = settings.defaultModel === model.id;
            return (
              <div
                key={model.id}
                onClick={() => onUpdateSettings({ defaultModel: model.id })}
                className={`cursor-pointer p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-[#161616] border-blue-500/60 shadow-sm'
                    : 'bg-[#080808] hover:bg-[#121212] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {model.name}
                  </span>
                  {model.badge && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {model.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed mb-2">
                  {model.description}
                </p>
                <div className="flex items-center justify-between text-[10px] text-white/40 pt-1.5 border-t border-white/5">
                  <span className="font-mono">Context: {model.contextWindow}</span>
                  <span className="font-medium text-blue-400">{model.speed}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Appearance & Theme */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Moon className="w-4 h-4 text-blue-400" />
          Tampilan & Tema Visual
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.theme === 'dark'
                ? 'bg-[#161616] border-blue-500/50 text-white'
                : 'bg-[#080808] border-white/5 text-white/50 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4 text-blue-400" />
            <span>Clean Dark Mode</span>
          </button>

          <button
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              settings.theme === 'light'
                ? 'bg-[#161616] border-blue-500/50 text-white'
                : 'bg-[#080808] border-white/5 text-white/50 hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Crisp Light Mode</span>
          </button>
        </div>
      </div>

      {/* 3. Voice Settings */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-400" />
            Pengaturan Suara (Voice TTS & STT)
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          {/* Auto Speak Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#080808] border border-white/5">
            <div>
              <p className="font-semibold text-white">Baca Otomatis Jawaban AI</p>
              <p className="text-[11px] text-white/40">Aktifkan agar setiap respons AI langsung diucapkan via audio.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.voice.autoSpeak}
              onChange={(e) =>
                onUpdateSettings({
                  voice: { ...settings.voice, autoSpeak: e.target.checked },
                })
              }
              className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
            />
          </div>

          {/* Voice Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#080808] border border-white/5">
            <div>
              <label className="block mb-1 font-medium text-white/70">
                Kecepatan Bicara ({settings.voice.rate}x)
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.voice.rate}
                onChange={(e) =>
                  onUpdateSettings({
                    voice: { ...settings.voice, rate: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium text-white/70">
                Pitch Suara ({settings.voice.pitch})
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={settings.voice.pitch}
                onChange={(e) =>
                  onUpdateSettings({
                    voice: { ...settings.voice, pitch: parseFloat(e.target.value) },
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. User Profile & Account */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-blue-400" />
          Informasi Akun Pengguna
        </h3>

        {user ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#080808] border border-white/5 text-xs">
              <div>
                <p className="font-bold text-white text-sm">{user.name || user.username}</p>
                <p className="text-white/40 font-mono text-[11px]">Username: @{user.username}</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                {user.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 block">Total Permintaan</span>
                <span className="text-sm font-bold text-white font-mono">{user.totalRequests || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 block">Estimasi Token</span>
                <span className="text-sm font-bold text-blue-400 font-mono">{user.totalTokensUsed || 0}</span>
              </div>
            </div>

            {/* Admin Shortcut if Admin */}
            {user.role === 'admin' && (
              <button
                id="btn-open-admin-from-settings"
                onClick={onOpenAdmin}
                className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Buka Admin Control Panel</span>
              </button>
            )}

            {/* Logout */}
            <button
              id="btn-logout"
              onClick={onLogout}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/40">Belum masuk akun.</p>
        )}
      </div>

      {/* 5. Zero-Cost Server Architecture Badge */}
      <div className="p-4 rounded-2xl bg-[#111111] border border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          Arsitektur Server Rp0 (Zero-Cost Community Hosting)
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          NEXUS AI Assistant dirancang tanpa database berbayar, tanpa server VPS berbayar, dan tanpa langganan tersembunyi. Kunci API tersimpan aman di server Hugging Face / Environment tanpa terpapar ke browser ataupun file APK Android.
        </p>
      </div>
    </div>
  );
};

