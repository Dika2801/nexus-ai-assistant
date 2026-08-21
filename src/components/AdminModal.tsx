import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  Sliders,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  Server,
  Zap,
  Terminal,
  Trash2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { AdminStats, AIModel, ErrorLogEntry } from '../types';
import { ApiClient } from '../lib/api';

interface AdminModalProps {
  adminId: string;
  isOpen: boolean;
  onClose: () => void;
  models: AIModel[];
  onModelConfigChange?: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  adminId,
  isOpen,
  onClose,
  models,
  onModelConfigChange,
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<'all' | 'error' | 'warn'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [defaultModel, setDefaultModel] = useState('nexus-5.6-sol');
  const [rateLimit, setRateLimit] = useState(30);
  const [announcement, setAnnouncement] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, usersData, logsData] = await Promise.all([
        ApiClient.getAdminStats(adminId),
        ApiClient.getAdminUsers(adminId),
        ApiClient.getAdminErrorLogs(adminId).catch(() => []),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
      setErrorLogs(logsData || []);
      setDefaultModel(statsData.defaultModel || 'nexus-5.6-sol');
      setRateLimit(statsData.maxRateLimitPerMin || 30);
      setAnnouncement((statsData as any).announcement || '');
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data admin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleToggleUser = async (targetUserId: string) => {
    try {
      await ApiClient.toggleUserStatus(adminId, targetUserId);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, isActive: !u.isActive } : u))
      );
      setSuccessMsg('Status pengguna berhasil diubah.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClearLogs = async () => {
    try {
      await ApiClient.clearAdminErrorLogs(adminId);
      setErrorLogs([]);
      setSuccessMsg('Log error berhasil dibersihkan.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal membersihkan log.');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await ApiClient.updateAdminSettings(adminId, {
        defaultModel,
        maxRateLimitPerMin: rateLimit,
        announcement,
      });
      setSuccessMsg('Pengaturan sistem berhasil disimpan.');
      onModelConfigChange?.();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLogs = errorLogs.filter((l) => {
    if (selectedLogLevel === 'all') return true;
    return l.level === selectedLogLevel;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#080808]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">NEXUS Admin Control Panel</h3>
              <p className="text-[11px] text-white/50">Monitoring pengguna, konfigurasi model & batas rate limit.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-400" /> Total User
                </span>
                <p className="text-base font-bold text-white mt-1 font-mono">{stats.totalUsers}</p>
                <span className="text-[10px] text-emerald-400">{stats.activeUsers} aktif</span>
              </div>

              <div className="p-3 rounded-xl bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-blue-400" /> Permintaan AI
                </span>
                <p className="text-base font-bold text-white mt-1 font-mono">{stats.totalRequests}</p>
                <span className="text-[10px] text-white/40">{stats.totalMessages} pesan</span>
              </div>

              <div className="p-3 rounded-xl bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Total Token
                </span>
                <p className="text-base font-bold text-amber-300 mt-1 font-mono">
                  {stats.totalTokensEstimate > 1000
                    ? `${(stats.totalTokensEstimate / 1000).toFixed(1)}k`
                    : stats.totalTokensEstimate}
                </p>
                <span className="text-[10px] text-white/40">Terkonsumsi</span>
              </div>

              <div className="p-3 rounded-xl bg-[#080808] border border-white/5">
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" /> Server Uptime
                </span>
                <p className="text-base font-bold text-emerald-300 mt-1 font-mono">
                  {Math.floor(stats.serverUptimeSeconds / 60)}m {stats.serverUptimeSeconds % 60}s
                </p>
                <span className="text-[10px] text-emerald-400 font-semibold">Rp0 Cost</span>
              </div>
            </div>
          )}

          {/* 2. Global System Configuration */}
          <div className="p-3.5 rounded-xl bg-[#080808] border border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" />
              Pengaturan Sistem & Batas Penggunaan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-[11px] text-white/60">Model Default Aplikasi:</label>
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#161616] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.speed})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-white/60">
                  Batas Request per Menit (Rate Limit):
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(parseInt(e.target.value) || 30)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#161616] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-[11px] text-white/60">Pesan Pengumuman Sistem:</label>
              <input
                type="text"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Pengumuman untuk seluruh pengguna..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#161616] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <button
              id="btn-save-admin-settings"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>

          {/* 3. User Management Table */}
          <div className="p-3.5 rounded-xl bg-[#080808] border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                Daftar Pengguna ({users.length})
              </h4>
              <button
                onClick={loadData}
                className="text-[11px] text-white/40 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="border border-white/5 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#161616] text-white/50 border-b border-white/5">
                  <tr>
                    <th className="p-2">User</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Reqs</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#161616]/40">
                      <td className="p-2 font-medium truncate max-w-[120px]">
                        <div>{u.name}</div>
                        <div className="text-[10px] text-white/40">@{u.username}</div>
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                              : 'bg-[#202020] text-white/50'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-blue-400">{u.totalRequests}</td>
                      <td className="p-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] ${
                            u.isActive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                              u.isActive
                                ? 'bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/30'
                                : 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/30'
                            }`}
                          >
                            {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Unified Error Logs & Telemetry Monitor */}
          <div className="p-3.5 rounded-xl bg-[#080808] border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Log Error & Telemetri Sistem
                </h4>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-white/70">
                  {errorLogs.length} entri
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Filter buttons */}
                <div className="flex items-center bg-[#161616] p-0.5 rounded-lg border border-white/5 text-[10px]">
                  <button
                    onClick={() => setSelectedLogLevel('all')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      selectedLogLevel === 'all'
                        ? 'bg-[#252525] text-white font-medium'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setSelectedLogLevel('error')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      selectedLogLevel === 'error'
                        ? 'bg-rose-950/60 text-rose-300 font-medium'
                        : 'text-white/40 hover:text-rose-400'
                    }`}
                  >
                    Error
                  </button>
                  <button
                    onClick={() => setSelectedLogLevel('warn')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      selectedLogLevel === 'warn'
                        ? 'bg-amber-950/60 text-amber-300 font-medium'
                        : 'text-white/40 hover:text-amber-400'
                    }`}
                  >
                    Warn
                  </button>
                </div>

                {errorLogs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    className="p-1 rounded-md text-white/40 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Bersihkan Semua Log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="border border-white/5 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-[11px] flex flex-col items-center justify-center gap-1">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Tidak ada log error yang terdeteksi. Sistem berjalan normal tanpa anomali.</span>
                </div>
              ) : (
                <div className="divide-y divide-white/5 text-[11px]">
                  {filteredLogs.map((l) => (
                    <div key={l.id} className="p-2.5 hover:bg-[#161616]/40 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              l.level === 'error'
                                ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40'
                                : l.level === 'warn'
                                ? 'bg-amber-950/50 text-amber-300 border border-amber-800/40'
                                : 'bg-blue-950/50 text-blue-300 border border-blue-800/40'
                            }`}
                          >
                            {l.level}
                          </span>
                          <span className="font-mono text-[10px] text-blue-400 font-semibold">
                            [{l.context}]
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40 font-mono">
                          {new Date(l.timestamp).toLocaleTimeString('id-ID')}
                        </span>
                      </div>

                      <p className="text-white/80 font-mono text-[11px] break-words">
                        {l.message}
                      </p>

                      {(l.userId || l.metadata) && (
                        <div className="text-[10px] text-white/40 flex items-center gap-2 font-mono mt-0.5">
                          {l.userId && <span>User: {l.userId}</span>}
                          {l.metadata && (
                            <span className="truncate max-w-xs text-white/30">
                              Meta: {JSON.stringify(l.metadata)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

