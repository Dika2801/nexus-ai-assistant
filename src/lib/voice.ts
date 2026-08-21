// Web Speech API + OpenAI Neural TTS Audio wrapper for natural voice on mobile/desktop

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export class VoiceManager {
  private static recognition: any = null;
  private static isListening: boolean = false;
  private static currentAudio: HTMLAudioElement | null = null;
  private static audioUrl: string | null = null;

  // Initialize Speech Recognition (STT)
  static isSTTSupported(): boolean {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  static startListening(
    callbacks: {
      onResult: (transcript: string, isFinal: boolean) => void;
      onError: (error: string) => void;
      onEnd: () => void;
    },
    lang: string = 'id-ID'
  ) {
    if (!this.isSTTSupported()) {
      callbacks.onError('Fitur Voice Input (Speech Recognition) tidak didukung pada browser ini.');
      return;
    }

    try {
      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionConstructor();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = lang;

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        callbacks.onResult(text, !!finalTranscript);
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          callbacks.onError('Izin mikrofon ditolak. Izinkan akses mikrofon di browser.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          callbacks.onError(`Error mikrofon: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd();
      };

      this.recognition.start();
    } catch (err: any) {
      callbacks.onError(err.message || 'Gagal memulai mikrofon.');
    }
  }

  static stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
    }
  }

  // Text-To-Speech (TTS)
  static isTTSSupported(): boolean {
    return typeof window !== 'undefined';
  }

  static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  // High Fidelity OpenAI Studio Voice (Male: Onyx) with Web Speech Fallback
  static async speak(
    text: string,
    options?: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      lang?: string;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!text) return;

    this.stopSpeaking();

    // Clean markdown before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' blok kode program ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~]/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .trim();

    if (!cleanText) return;

    // 1. Try OpenAI Natural Studio Voice (Male: onyx) via backend
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText.slice(0, 3000),
          voice: 'onyx', // Authentic deep natural male ChatGPT voice
          speed: options?.rate || 1.05,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 100) {
          if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
          }
          const url = URL.createObjectURL(blob);
          this.audioUrl = url;

          const audio = new Audio(url);
          this.currentAudio = audio;

          audio.onended = () => {
            this.currentAudio = null;
            options?.onEnd?.();
          };

          audio.onerror = () => {
            this.currentAudio = null;
            this.speakWebSpeechFallback(cleanText, options);
          };

          await audio.play();
          return;
        }
      }
    } catch {
      // Continue to fallback
    }

    // 2. Fallback to Web Speech API (Local Synth)
    this.speakWebSpeechFallback(cleanText, options);
  }

  private static speakWebSpeechFallback(
    cleanText: string,
    options?: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      lang?: string;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = options?.rate ?? 1.05;
      utterance.pitch = options?.pitch ?? 0.92;
      utterance.lang = options?.lang ?? 'id-ID';

      const voices = window.speechSynthesis.getVoices();
      if (options?.voiceName) {
        const selectedVoice = voices.find((v) => v.name === options.voiceName);
        if (selectedVoice) utterance.voice = selectedVoice;
      } else {
        const maleVoice = voices.find((v) => {
          const name = v.name.toLowerCase();
          const lang = v.lang.toLowerCase();
          return (
            (lang.includes('id') && (name.includes('male') || name.includes('ardi') || name.includes('pria') || name.includes('natural') || name.includes('google'))) ||
            name.includes('natural') ||
            name.includes('guy') ||
            name.includes('david') ||
            name.includes('george') ||
            name.includes('male')
          );
        }) || voices.find((v) => v.lang.includes('id') || v.lang.includes('ID')) || voices[0];

        if (maleVoice) utterance.voice = maleVoice;
      }

      utterance.onend = () => {
        options?.onEnd?.();
      };

      utterance.onerror = (e: any) => {
        // Suppress benign cancellation/interrupted events
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          options?.onError?.(e);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }

  static stopSpeaking() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  static isSpeaking(): boolean {
    if (this.currentAudio && !this.currentAudio.paused) return true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}
