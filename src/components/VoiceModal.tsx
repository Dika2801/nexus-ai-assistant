import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, Radio } from 'lucide-react';
import { VoiceManager } from '../lib/voice';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
  lastAssistantMessage?: string;
  activeModelName: string;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isStreaming,
  lastAssistantMessage,
  activeModelName,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioState, setAudioState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      stopSession();
    }
    return () => {
      stopSession();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopSession();
      return;
    }

    if (isStreaming) {
      setAudioState('thinking');
    } else if (lastAssistantMessage && audioState === 'thinking') {
      setAudioState('speaking');
      VoiceManager.speak(lastAssistantMessage, {
        rate: 1.05,
        pitch: 0.92,
        lang: 'id-ID',
        onEnd: () => {
          if (!isOpen) return;
          setAudioState('idle');
          // Automatically re-listen for true bidirectional ChatGPT voice mode when modal is open
          startListening();
        },
        onError: () => {
          setAudioState('idle');
        },
      });
    }
  }, [isOpen, isStreaming, lastAssistantMessage]);

  const startSession = () => {
    startListening();
  };

  const stopSession = () => {
    VoiceManager.stopListening();
    VoiceManager.stopSpeaking();
    setIsListening(false);
    setAudioState('idle');
  };

  const startListening = () => {
    setIsListening(true);
    setAudioState('listening');
    setTranscript('');
    VoiceManager.startListening(
      {
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal && text.trim()) {
            setIsListening(false);
            setAudioState('thinking');
            onSendMessage(text.trim());
          }
        },
        onError: (err) => {
          console.warn('Voice error:', err);
          setIsListening(false);
          setAudioState('idle');
        },
        onEnd: () => {
          setIsListening(false);
        },
      },
      'id-ID'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-[#0f0f11] border border-white/10 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title="Tutup Mode Suara"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Model indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-8">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>ChatGPT Voice Mode • {activeModelName}</span>
        </div>

        {/* Dynamic Voice Orb */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Animated Glow Rings */}
          <div
            className={`absolute w-44 h-44 rounded-full transition-all duration-700 ${
              audioState === 'listening'
                ? 'bg-emerald-500/20 animate-ping scale-110'
                : audioState === 'speaking'
                ? 'bg-blue-500/25 animate-pulse scale-125'
                : audioState === 'thinking'
                ? 'bg-purple-500/20 animate-spin scale-100'
                : 'bg-white/5 scale-90'
            }`}
          />
          <div
            className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              audioState === 'listening'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 scale-105 shadow-emerald-500/40 ring-4 ring-emerald-400/30'
                : audioState === 'speaking'
                ? 'bg-gradient-to-tr from-blue-600 to-cyan-400 scale-105 shadow-blue-500/40 ring-4 ring-blue-400/30'
                : audioState === 'thinking'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-500/40 animate-pulse'
                : 'bg-[#1c1c20] border border-white/10'
            }`}
          >
            {audioState === 'listening' ? (
              <Mic className="w-12 h-12 text-white animate-pulse" />
            ) : audioState === 'speaking' ? (
              <Volume2 className="w-12 h-12 text-white animate-bounce" />
            ) : audioState === 'thinking' ? (
              <Sparkles className="w-12 h-12 text-white animate-spin" />
            ) : (
              <MicOff className="w-10 h-10 text-white/40" />
            )}
          </div>
        </div>

        {/* State Label */}
        <h3 className="text-lg font-bold text-white mb-2">
          {audioState === 'listening' && 'Mendengarkan Anda...'}
          {audioState === 'speaking' && 'NEXUS sedang berbicara...'}
          {audioState === 'thinking' && 'Memproses jawaban...'}
          {audioState === 'idle' && 'Siap mendengarkan'}
        </h3>

        {/* Live Transcript / Prompt */}
        <p className="text-sm text-white/60 min-h-[48px] max-w-xs mb-6 italic">
          {transcript ? `"${transcript}"` : audioState === 'listening' ? 'Silakan mulai berbicara langsung...' : 'Suara natural pria (ChatGPT-style)'}
        </p>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={isListening ? () => stopSession() : () => startListening()}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md active:scale-95 ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isListening ? 'Hentikan Mic' : 'Bicara Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
};
