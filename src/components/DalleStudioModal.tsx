import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Palette,
  ExternalLink,
  Upload,
  Layers,
  Wand2,
} from 'lucide-react';
import { ApiClient } from '../lib/api';

interface DalleStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSendImageToChat?: (imageUrl: string, prompt: string) => void;
}

export const DalleStudioModal: React.FC<DalleStudioModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSendImageToChat,
}) => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [imageSize, setImageSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [modelChoice, setModelChoice] = useState<'dalle'>('dalle');
  const [stylePreset, setStylePreset] = useState<string>('Photorealistic');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceMime, setReferenceMime] = useState<string>('image/jpeg');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const stylePresets = [
    { name: 'Photorealistic', promptSuffix: ', ultra high resolution 8k, photorealistic cinematic lighting, masterpiece' },
    { name: '3D Render', promptSuffix: ', 3D Pixar Disney style render, raytracing, vibrant colors, volumetric lighting' },
    { name: 'Cyberpunk', promptSuffix: ', cyberpunk aesthetic, neon lights, futuristic city rain, high contrast moody' },
    { name: 'Digital Art', promptSuffix: ', digital concept art, trending on ArtStation, detailed brushwork' },
    { name: 'Anime/Manga', promptSuffix: ', modern anime aesthetic, Makoto Shinkai style, vibrant sky and detailed textures' },
    { name: 'Minimalist Vector', promptSuffix: ', minimalist clean vector art, flat design, elegant modern composition' },
  ];

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Harap unggah file gambar (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setReferenceImage(dataUrl);
      setReferenceMime(file.type);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    const selectedStyle = stylePresets.find((s) => s.name === stylePreset);
    const fullPrompt = `${prompt.trim()}${selectedStyle && mode === 'generate' ? selectedStyle.promptSuffix : ''}`;

    try {
      if (mode === 'edit') {
        if (!referenceImage) {
          throw new Error('Harap unggah gambar referensi yang ingin diedit.');
        }
        const data = await ApiClient.editImage(userId, {
          imageBase64: referenceImage,
          mimeType: referenceMime,
          prompt: fullPrompt,
          imageSize,
        });
        if (data.imageUrl) {
          setResultImage(data.imageUrl);
          setRevisedPrompt(data.revisedPrompt || fullPrompt);
        } else {
          throw new Error('Tidak ada gambar yang dihasilkan.');
        }
      } else {
        const data = await ApiClient.generateImage(userId, fullPrompt, {
          imageSize,
          aspectRatio,
          modelChoice,
        });
        if (data.imageUrl) {
          setResultImage(data.imageUrl);
          setRevisedPrompt(data.revisedPrompt || fullPrompt);
        } else {
          throw new Error('Tidak ada gambar yang dihasilkan.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memproses gambar AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(revisedPrompt || prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy prompt failed:', e);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `nexus_art_${imageSize}_${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                NEXUS Visual Studio
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  NEXUS Vision HD • 1K / 2K / 4K
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Hasilkan gambar ultra-HD dengan NEXUS Vision Engine (NEXUS Group)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4 pb-2 bg-[#121212] border-b border-white/5 flex items-center gap-2">
          <button
            onClick={() => setMode('generate')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              mode === 'generate'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-black shadow-md shadow-amber-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Buat Gambar Baru (Text-to-Image)
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              mode === 'edit'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Edit & Modifikasi Gambar (Image Editing)
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-4">
            {/* If Edit Mode, Reference Image Upload */}
            {mode === 'edit' && (
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-purple-400" />
                    Gambar Referensi yang Ingin Diedit
                  </span>
                  {referenceImage && (
                    <button
                      onClick={() => setReferenceImage(null)}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />

                {referenceImage ? (
                  <div className="relative h-28 w-full rounded-xl overflow-hidden border border-purple-500/40 bg-black/40 flex items-center justify-center group">
                    <img src={referenceImage} alt="Ref" className="h-full w-full object-cover" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Ganti Gambar
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-28 w-full rounded-xl border border-dashed border-white/20 hover:border-purple-400/60 bg-[#181818] flex flex-col items-center justify-center text-white/50 hover:text-white cursor-pointer transition-colors p-3 text-center"
                  >
                    <Upload className="w-6 h-6 text-purple-400 mb-1" />
                    <span className="text-xs font-medium">Klik untuk unggah foto referensi</span>
                    <span className="text-[10px] text-white/30">PNG, JPG, WebP</span>
                  </div>
                )}
              </div>
            )}

            {/* Prompt Input */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {mode === 'edit' ? 'Instruksi Pengeditan Visual' : 'Deskripsi Visual (Prompt)'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'edit'
                    ? 'Misal: Ubah latar belakang menjadi pemandangan matahari terbenam di pegunungan, tambahkan kacamata hitam futuristik...'
                    : 'Misal: Pemandangan kota metropolitan futuristik bercahaya neon di bawah hujan dengan kendaraan terbang super detail...'
                }
                className="w-full h-24 bg-[#181818] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500 resize-none leading-relaxed"
              />
            </div>

            {/* Image Resolution Affordance (1K, 2K, 4K, 512px) */}
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-rose-400" />
                Resolusi Kualitas Gambar
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['512px', '1K', '2K', '4K'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setImageSize(sz)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      imageSize === sz
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                        : 'bg-[#181818] border-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            {mode === 'generate' && (
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Rasio Aspek
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: '1:1', val: '1:1' },
                    { label: '16:9', val: '16:9' },
                    { label: '9:16', val: '9:16' },
                    { label: '4:3', val: '4:3' },
                    { label: '3:4', val: '3:4' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setAspectRatio(item.val as any)}
                      className={`py-1.5 text-xs rounded-xl border transition-all text-center ${
                        aspectRatio === item.val
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-[#181818] border-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Style Presets */}
            {mode === 'generate' && (
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  Gaya Preset
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {stylePresets.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setStylePreset(s.name)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] truncate border transition-all text-center ${
                        stylePreset === s.name
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-medium'
                          : 'bg-[#181818] border-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || (mode === 'edit' && !referenceImage)}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {mode === 'edit' ? 'Mengedit Gambar...' : 'Merender Gambar HD...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === 'edit' ? 'Terapkan Pengeditan Gambar' : `Hasilkan Gambar (${imageSize})`}
                </>
              )}
            </button>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[360px] bg-[#141414] border border-white/10 rounded-2xl p-4 overflow-hidden relative">
            {isGenerating ? (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-full border-4 border-rose-500/20 border-t-rose-400 animate-spin mx-auto"></div>
                <p className="text-sm font-semibold text-white">Sedang Memproses Gambar AI...</p>
                <p className="text-xs text-white/40 max-w-xs mx-auto">
                  Engine sedang menyusun detail piksel dengan kualitas {imageSize} dan rasio {aspectRatio}.
                </p>
              </div>
            ) : resultImage ? (
              <div className="w-full h-full flex flex-col items-center justify-between space-y-4">
                <div className="relative w-full max-h-[380px] rounded-xl overflow-hidden border border-white/10 flex items-center justify-center bg-black/40">
                  <img
                    src={resultImage}
                    alt="AI Visual"
                    className="max-h-[380px] w-auto object-contain rounded-xl shadow-2xl"
                  />
                </div>

                <div className="w-full space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-white/70">
                    <p className="font-semibold text-white/90 mb-1 flex items-center justify-between">
                      <span>Prompt Visual ({imageSize}):</span>
                      <button
                        onClick={handleCopyPrompt}
                        className="text-white/40 hover:text-white flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Tersalin' : 'Salin'}
                      </button>
                    </p>
                    <p className="line-clamp-2 italic">{revisedPrompt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download ({imageSize})
                    </button>
                    {onSendImageToChat && (
                      <button
                        onClick={() => {
                          onSendImageToChat(resultImage, prompt);
                          onClose();
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Kirim ke Chat
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 space-y-3 text-white/40">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/30">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium text-white/60">Belum Ada Gambar yang Dihasilkan</p>
                <p className="text-xs max-w-xs mx-auto">
                  Pilih mode, tentukan resolusi (1K/2K/4K), masukkan prompt, dan klik Hasilkan Gambar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
