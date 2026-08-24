import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  Zap,
  X,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { User } from '../types';
import { ApiClient } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  currentUser: User | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await ApiClient.login(username, password);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await ApiClient.register(username, password, name);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Proses otentikasi gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await ApiClient.guestLogin();
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal masuk sebagai tamu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative p-5 text-center bg-[#080808] border-b border-white/5">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-[#1a1a1a]"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto mb-2 shadow-sm shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            {mode === 'login' ? 'Masuk ke NEXUS AI' : 'Daftar Akun Baru'}
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            Sistem autentikasi ringan & aman (Zero-Cost Hosting)
          </p>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Alex Pratama"
                  className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 active:scale-98 transition-all"
            >
              {isLoading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar Sekarang'}
            </button>
          </form>

          {/* Guest Login Button */}
          <div className="relative my-3 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative px-2 bg-[#111111] text-[10px] text-white/40 uppercase tracking-wider font-semibold">
              atau
            </span>
          </div>

          <button
            onClick={handleGuest}
            disabled={isLoading}
            className="w-full py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#222222] border border-white/5 text-white/80 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Masuk Instan sebagai Tamu (Guest)</span>
          </button>

          {/* Mode Switch */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="text-xs text-blue-400 hover:underline font-medium"
            >
              {mode === 'login' ? 'Belum punya akun? Daftar gratis' : 'Sudah punya akun? Masuk'}
            </button>
          </div>

          {/* Quick Admin Helper Hint */}
          <div className="pt-2 text-[10px] text-white/40 text-center border-t border-white/5">
            Akun Default: <span className="font-mono text-blue-400">admin</span> / <span className="font-mono text-blue-400">admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
};

