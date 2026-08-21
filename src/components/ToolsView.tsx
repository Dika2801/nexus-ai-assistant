import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Globe,
  Mic,
  Volume2,
  Sparkles,
  Upload,
  Send,
  Copy,
  Check,
  Play,
  Square,
  ExternalLink,
  Layers,
  CheckCircle2,
  Smartphone,
  Server,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ApiClient } from '../lib/api';
import { VoiceManager } from '../lib/voice';
import { VoiceSettings } from '../types';

interface ToolsViewProps {
  userId: string;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  onSendToChat: (prompt: string, attachments?: any[]) => void;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  userId,
  voiceSettings,
  onUpdateVoiceSettings,
}) => {
  const [activeTool, setActiveTool] = useState<'image' | 'doc' | 'search' | 'voice' | 'deploy'>('image');

  // Tool 1: Image Analysis State
  const [imageFile, setImageFile] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [imagePrompt, setImagePrompt] = useState('Analisis gambar ini secara mendalam dan berikan detail objek serta teks.');
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Tool 2: Document Analysis State
  const [docName, setDocName] = useState('Dokumen.txt');
  const [docContent, setDocContent] = useState('');
  const [docQuestion, setDocQuestion] = useState('Buatkan ringkasan eksekutif dan poin-poin penting dari dokumen ini.');
  const [docResult, setDocResult] = useState<string | null>(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Tool 3: Web Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchSources, setSearchSources] = useState<Array<{ title?: string; uri?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tool 4: Voice Studio State
  const [voiceTestText, setVoiceTestText] = useState('Halo! Saya NEXUS AI Assistant. Arsitektur zero-cost server dengan performa tinggi.');
  const [isSpeakingTest, setIsSpeakingTest] = useState(false);
  const [sttTestTranscript, setSttTestTranscript] = useState('');
  const [isRecordingTest, setIsRecordingTest] = useState(false);

  const [copied, setCopied] = useState(false);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Image Analysis Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageFile({
        name: file.name,
        base64,
        mimeType: file.type || 'image/jpeg',
      });
      setImageResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunImageAnalysis = async () => {
    if (!imageFile) return;
    setIsAnalyzingImage(true);
    setImageResult(null);

    try {
      const res = await ApiClient.analyzeImage(userId, imageFile.base64, imageFile.mimeType, imagePrompt);
      setImageResult(res.analysis);
    } catch (err: any) {
      setImageResult(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Document Analysis Handler
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setDocContent(content);
      setDocResult(null);
    };
    reader.readAsText(file);
  };

  const handleRunDocAnalysis = async () => {
    if (!docContent.trim()) return;
    setIsAnalyzingDoc(true);
    setDocResult(null);

    try {
      const res = await ApiClient.analyzeDocument(userId, docContent, docName, docQuestion);
      setDocResult(res.result);
    } catch (err: any) {
      setDocResult(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  // Web Search Handler
  const handleRunWebSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchAnswer(null);
    setSearchSources([]);

    try {
      const res = await ApiClient.webSearch(userId, searchQuery.trim());
      setSearchAnswer(res.answer);
      setSearchSources(res.sources || []);
    } catch (err: any) {
      setSearchAnswer(`Pencarian gagal: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Voice Studio Handlers
  const handleTestTTS = () => {
    if (isSpeakingTest) {
      VoiceManager.stopSpeaking();
      setIsSpeakingTest(false);
      return;
    }

    setIsSpeakingTest(true);
    VoiceManager.speak(voiceTestText, {
      voiceName: voiceSettings.voiceName,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      lang: voiceSettings.language || 'id-ID',
      onEnd: () => setIsSpeakingTest(false),
      onError: () => setIsSpeakingTest(false),
    });
  };

  const handleTestSTT = () => {
    if (isRecordingTest) {
      VoiceManager.stopListening();
      setIsRecordingTest(false);
      return;
    }

    setIsRecordingTest(true);
    setSttTestTranscript('');
    VoiceManager.startListening(
      {
        onResult: (text, isFinal) => {
          setSttTestTranscript(text);
          if (isFinal) setIsRecordingTest(false);
        },
        onError: (err) => {
          setSttTestTranscript(`Error: ${err}`);
          setIsRecordingTest(false);
        },
        onEnd: () => setIsRecordingTest(false),
      },
      voiceSettings.language || 'id-ID'
    );
  };

  const toolTabs = [
    { id: 'image' as const, label: 'Vision Image', icon: ImageIcon },
    { id: 'doc' as const, label: 'Doc Analysis', icon: FileText },
    { id: 'search' as const, label: 'Web Search', icon: Globe },
    { id: 'voice' as const, label: 'Voice Studio', icon: Mic },
    { id: 'deploy' as const, label: 'APK & Hosting', icon: Smartphone },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full px-3 py-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-blue-400" />
            NEXUS AI Toolkit
          </h2>
          <p className="text-xs text-white/50">
            Perangkat multimodal terhubung langsung ke backend server zero-cost.
          </p>
        </div>
      </div>

      {/* Tool Selector Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {toolTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              id={`tool-tab-${tab.id}`}
              onClick={() => setActiveTool(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-[#111111] text-white/70 hover:text-white hover:bg-[#161616] border border-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------- */}
      {/* TOOL 1: IMAGE ANALYSIS (VISION) */}
      {/* ---------------------------------------------------- */}
      {activeTool === 'image' && (
        <div className="space-y-4 bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Analisis Gambar & Vision
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              OCR + Visual QA
            </span>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Upload Dropzone / Preview */}
          {!imageFile ? (
            <button
              id="btn-upload-image-tool"
              onClick={() => imageInputRef.current?.click()}
              className="w-full border border-dashed border-white/15 hover:border-blue-500/50 rounded-xl p-8 flex flex-col items-center justify-center text-center group transition-colors bg-[#080808]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] group-hover:bg-blue-600/10 flex items-center justify-center text-white/40 group-hover:text-blue-400 mb-2 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-white">Pilih Foto atau Screenshot</p>
              <p className="text-[11px] text-white/40 mt-1">Mendukung format PNG, JPG, WEBP, GIF</p>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start bg-[#080808] p-3 rounded-xl border border-white/5">
              <img
                src={imageFile.base64}
                alt="Preview"
                className="w-full sm:w-44 h-36 object-cover rounded-lg border border-white/10"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-blue-400 truncate max-w-[200px]">{imageFile.name}</span>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="text-xs text-white/50 hover:text-white underline"
                  >
                    Ganti Foto
                  </button>
                </div>

                {/* Preset Prompt Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    'Ekstrak seluruh teks (OCR)',
                    'Jelaskan isi gambar detail',
                    'Deteksi error atau bug',
                    'Ubah UI menjadi kode HTML/Tailwind',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setImagePrompt(preset)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#161616] hover:bg-[#202020] text-white/80 border border-white/5 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Instruksi Analisis:</label>
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Contoh: Identifikasi diagram ini dan jelaskan alurnya..."
              className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Action Button */}
          <button
            id="btn-run-image-analysis"
            onClick={handleRunImageAnalysis}
            disabled={!imageFile || isAnalyzingImage}
            className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              imageFile && !isAnalyzingImage
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 active:scale-98'
                : 'bg-[#161616] text-white/30 cursor-not-allowed'
            }`}
          >
            {isAnalyzingImage ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Menganalisis Visual...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Jalankan Analisis Gambar</span>
              </>
            )}
          </button>

          {/* Result Output */}
          {imageResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#080808] border border-white/5 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-blue-400">Hasil Analisis:</span>
                <button
                  onClick={() => handleCopy(imageResult)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
              <div className="prose-nexus text-sm text-slate-200">
                <ReactMarkdown>{imageResult}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TOOL 2: DOCUMENT ANALYSIS */}
      {/* ---------------------------------------------------- */}
      {activeTool === 'doc' && (
        <div className="space-y-4 bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Analisis Dokumen & Teks
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Summarizer
            </span>
          </div>

          <input
            ref={docInputRef}
            type="file"
            accept=".txt,.md,.pdf,.json,.csv,.js,.ts,.py,.html"
            onChange={handleDocUpload}
            className="hidden"
          />

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-white/70">Isi Dokumen / Teks:</label>
            <button
              onClick={() => docInputRef.current?.click()}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah File
            </button>
          </div>

          <textarea
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Ketik atau tempel (paste) teks dokumen, artikel, riset, atau kode di sini..."
            rows={5}
            className="w-full px-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Pertanyaan / Perintah Analisis:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={docQuestion}
                onChange={(e) => setDocQuestion(e.target.value)}
                placeholder="Contoh: Ringkas dalam 5 poin kunci..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#080808] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500/50"
              />
              <button
                id="btn-run-doc-analysis"
                onClick={handleRunDocAnalysis}
                disabled={!docContent.trim() || isAnalyzingDoc}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  docContent.trim() && !isAnalyzingDoc
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-[#161616] text-white/30 cursor-not-allowed'
                }`}
              >
                {isAnalyzingDoc ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Analisis</span>
              </button>
            </div>
          </div>

          {docResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#080808] border border-white/5 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-blue-400">Hasil Analisis Dokumen:</span>
                <button
                  onClick={() => handleCopy(docResult)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
              <div className="prose-nexus text-sm text-slate-200">
                <ReactMarkdown>{docResult}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TOOL 3: WEB SEARCH GROUNDING */}
      {/* ---------------------------------------------------- */}
      {activeTool === 'search' && (
        <div className="space-y-4 bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Live Web Search Grounding
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Web
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunWebSearch()}
              placeholder="Contoh: Berita teknologi AI terkini hari ini..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#080808] border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500/50"
            />
            <button
              id="btn-run-web-search"
              onClick={handleRunWebSearch}
              disabled={!searchQuery.trim() || isSearching}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                searchQuery.trim() && !isSearching
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-[#161616] text-white/30 cursor-not-allowed'
              }`}
            >
              {isSearching ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              <span>Cari Web</span>
            </button>
          </div>

          {searchAnswer && (
            <div className="mt-4 p-4 rounded-xl bg-[#080808] border border-white/5 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-blue-400">Jawaban Terverifikasi:</span>
                <button
                  onClick={() => handleCopy(searchAnswer)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>

              <div className="prose-nexus text-sm text-slate-200">
                <ReactMarkdown>{searchAnswer}</ReactMarkdown>
              </div>

              {searchSources.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-blue-400 mb-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Sumber Web:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchSources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-[#111111] hover:bg-[#161616] border border-white/5 text-xs text-white/80 hover:text-blue-400 transition-colors"
                      >
                        <span className="truncate max-w-[240px] font-medium">{s.title || s.uri}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TOOL 4: VOICE STUDIO (INPUT & OUTPUT) */}
      {/* ---------------------------------------------------- */}
      {activeTool === 'voice' && (
        <div className="space-y-4 bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-400" />
              Voice Studio (STT & TTS)
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Web Speech Engine
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* STT Input Section */}
            <div className="bg-[#080808] border border-white/5 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-rose-400" />
                Voice Input (Speech Recognition)
              </h4>
              <p className="text-[11px] text-white/40">
                Uji sensitivitas mikrofon dan transkripsi suara real-time secara langsung.
              </p>

              <button
                id="btn-test-stt"
                onClick={handleTestSTT}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isRecordingTest
                    ? 'bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/30'
                    : 'bg-[#1a1a1a] hover:bg-[#222222] text-white border border-white/10'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isRecordingTest ? 'Mendengarkan...' : 'Mulai Rekam Suara'}</span>
              </button>

              {sttTestTranscript && (
                <div className="p-2.5 bg-[#111111] rounded-lg border border-white/5 text-xs text-blue-300">
                  <span className="font-semibold text-white/40 block text-[10px] mb-1 uppercase tracking-wider">Transkrip:</span>
                  "{sttTestTranscript}"
                </div>
              )}
            </div>

            {/* TTS Output Section */}
            <div className="bg-[#080808] border border-white/5 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Voice Output (Text-to-Speech)
              </h4>

              <input
                type="text"
                value={voiceTestText}
                onChange={(e) => setVoiceTestText(e.target.value)}
                placeholder="Teks untuk diucapkan..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#111111] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50"
              />

              <div className="grid grid-cols-2 gap-2 text-[11px] text-white/50">
                <div>
                  <label className="block mb-1">Kecepatan ({voiceSettings.rate}x):</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceSettings.rate}
                    onChange={(e) => onUpdateVoiceSettings({ rate: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1">Pitch ({voiceSettings.pitch}):</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={voiceSettings.pitch}
                    onChange={(e) => onUpdateVoiceSettings({ pitch: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              <button
                id="btn-test-tts"
                onClick={handleTestTTS}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isSpeakingTest
                    ? 'bg-rose-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isSpeakingTest ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isSpeakingTest ? 'Hentikan' : 'Dengarkan Suara'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TOOL 5: APK & ZERO COST DEPLOY HUB */}
      {/* ---------------------------------------------------- */}
      {activeTool === 'deploy' && (
        <div className="space-y-4 bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-400" />
              Android APK & Zero-Cost Architecture
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Rp0 Community
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hugging Face Setup Card */}
            <div className="bg-[#080808] p-4 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Server className="w-4 h-4" />
                1. Hugging Face Spaces (Rp0 Free Tier)
              </div>
              <ul className="text-xs text-white/70 space-y-1.5 list-disc list-inside">
                <li>Deploy Space baru di Hugging Face (SDK: Node.js / Docker).</li>
                <li>Di <b>Variables and Secrets</b>, masukkan secret <code className="text-blue-400">OPENAI_API_KEY</code>.</li>
                <li>API key tersimpan 100% aman di server dan tidak pernah tersimpan di APK Android.</li>
              </ul>
            </div>

            {/* Android APK Build Card */}
            <div className="bg-[#080808] p-4 rounded-xl border border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Smartphone className="w-4 h-4" />
                2. Buat APK Android (PWABuilder / Capacitor)
              </div>
              <ul className="text-xs text-white/70 space-y-1.5 list-disc list-inside">
                <li>Buka <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold">PWABuilder.com</a>.</li>
                <li>Masukkan URL aplikasi dan klik <b>Package For Android</b>.</li>
                <li>Unduh file <code className="text-blue-400">.apk</code> dan install langsung di smartphone Android.</li>
              </ul>
            </div>
          </div>

          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              <b>Keamanan Terjamin:</b> APK Android bertindak sebagai UI client murni. Seluruh autentikasi dan pemanggilan OpenAI API dieksekusi oleh backend server tanpa mengekspos kunci API ke perangkat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

