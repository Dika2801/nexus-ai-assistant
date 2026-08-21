import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Code2,
  PenTool,
  BarChart3,
  Image as ImageIcon,
  GraduationCap,
  Search,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { CustomGPT } from '../types';

export const DEFAULT_CUSTOM_GPTS: CustomGPT[] = [
  {
    id: 'gpt-code-architect',
    name: 'NEXUS Code Architect',
    tagline: 'Senior Full-Stack Engineer & Algorithm Expert',
    description:
      'Spesialis dalam merancang arsitektur perangkat lunak, debugging rumit, TypeScript, Python, optimasi performa, dan implementasi clean code.',
    category: 'Programming',
    icon: 'code',
    badge: 'Paling Populer',
    systemPrompt:
      'Anda adalah NEXUS Code Architect, seorang Principal Software Engineer. Berikan solusi kode yang bersih, type-safe, efisien, modular, dan sertakan penjelasan arsitektur yang solid serta instruksi eksekusi.',
    starterPrompts: [
      'Bantu saya merancang arsitektur API microservices yang scalable',
      'Tulis algoritma pencarian graf dan optimasi performa dalam TypeScript',
      'Review dan temukan potensi memory leak pada kode React ini',
      'Buat script Python untuk data pipeline otomatis',
    ],
  },
  {
    id: 'gpt-creative-wordsmith',
    name: 'Creative Wordsmith & Copywriter',
    tagline: 'Penulis Narasi, Storytelling & Konten Bernyawa',
    description:
      'Ahli dalam penulisan kreatif, copywriting persuasif, esai mendalam, artikel SEO berkualitas tinggi, dan naskah presentasi berbobot.',
    category: 'Writing',
    icon: 'pen',
    badge: 'Creative Choice',
    systemPrompt:
      'Anda adalah Creative Wordsmith di NEXUS AI. Hasilkan tulisan yang sangat memikat, kaya kosakata, memiliki alur ritmis yang natural, bebas klise AI, dan berdaya pikat tinggi.',
    starterPrompts: [
      'Tulis cerita fiksi ilmiah pendek dengan plot twist yang mendalam',
      'Buat copywriting landing page produk SaaS yang sangat persuasif',
      'Susun esai filosofis tentang masa depan kecerdasan buatan',
      'Tulis script video storytelling berdurasi 3 menit',
    ],
  },
  {
    id: 'gpt-data-analyst',
    name: 'Data & Quantitative Analyst',
    tagline: 'Statistik, Analisis Data & Model Finansial',
    description:
      'Menganalisis dataset, data tabular CSV/Excel, pemodelan statistik, probabilitas, dan visualisasi wawasan bisnis komprehensif.',
    category: 'Analysis',
    icon: 'chart',
    badge: 'Quantitative',
    systemPrompt:
      'Anda adalah Analis Kuantitatif & Data Scientist Senior di NEXUS AI. Berikan analisis berbasis data yang tajam, interpretasi metrik kunci, dan rekomendasi strategis.',
    starterPrompts: [
      'Bantu saya menganalisis tren pertumbuhan revenue dan retensi pelanggan',
      'Jelaskan konsep regresi linear berganda dengan contoh bisnis nyata',
      'Buat rumus Excel/SQL query untuk menghitung Customer Lifetime Value (CLV)',
      'Bantu saya menginterpretasikan distribusi data statistik ini',
    ],
  },
  {
    id: 'gpt-dalle-studio',
    name: 'DALL-E Visual Studio Master',
    tagline: 'Konseptor Seni Visual & Prompt Artist',
    description:
      'Menghasilkan konsep visual, deskripsi prompt sinematik untuk DALL-E 3 / Midjourney, dan mengarahkan estetika grafis.',
    category: 'Creative',
    icon: 'image',
    badge: 'Visual Arts',
    systemPrompt:
      'Anda adalah Direktur Seni Visual di NEXUS AI. Bantu pengguna merumuskan prompt visual DALL-E 3 dengan pencahayaan, lensa kamera, komposisi, mood warna, dan detail artistik yang spektakuler.',
    starterPrompts: [
      'Rancang prompt DALL-E 3 untuk pemandangan kota cyberpunk futuristik',
      'Buat konsep karakter 3D render menggemaskan bergaya Pixar',
      'Buat ilustrasi flat vector minimalis untuk brand teknologi',
      'Deskripsikan lukisan cat minyak lanskap pegunungan mistis',
    ],
  },
  {
    id: 'gpt-academic-researcher',
    name: 'Academic Scholar & Literature Reviewer',
    tagline: 'Kajian Ilmiah, Metodologi & Struktur Riset',
    description:
      'Membantu penyusunan latar belakang penelitian, telaah pustaka (literature review), metodologi riset, dan struktur karya ilmiah yang ketat.',
    category: 'Education',
    icon: 'academic',
    badge: 'Research',
    systemPrompt:
      'Anda adalah Guru Besar dan Peneliti Akademik di NEXUS AI. Berikan panduan metodologi penelitian ilmiah yang ketat, objektif, berstandar tinggi, dan sistematis.',
    starterPrompts: [
      'Bantu saya merumuskan rumusan masalah dan hipotesis penelitian',
      'Susun kerangka telaah pustaka (literature review) topik Natural Language Processing',
      'Jelaskan perbedaan metodologi kualitatif vs kuantitatif untuk studi kasus',
      'Bantu saya menyusun abstrak jurnal ilmiah berstandar internasional',
    ],
  },
  {
    id: 'gpt-deep-investigator',
    name: 'Global Web & Fact Investigator',
    tagline: 'Penelusuran Fakta & Riset Web Mendalam',
    description:
      'Menggali informasi terkini, sintesis berita global, verifikasi fakta, dan perbandingan komparatif lintas sumber terpercaya.',
    category: 'Productivity',
    icon: 'search',
    badge: 'Real-Time Info',
    systemPrompt:
      'Anda adalah Peneliti & Fact-Checker Global di NEXUS AI. Analisis fakta, berikan ringkasan multi-perspektif, dan pisahkan antara opini dengan data terverifikasi.',
    starterPrompts: [
      'Rangkum perkembangan teknologi energi fusi nuklir terbaru di dunia',
      'Bandingkan ekosistem startup teknologi di Asia Tenggara tahun ini',
      'Jelaskan dampak regulasi AI di Uni Eropa terhadap pengembang global',
      'Buat laporan komprehensif tentang tren eksplorasi luar angkasa',
    ],
  },
];

interface ExploreGPTsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGPT: (gpt: CustomGPT, starterPrompt?: string) => void;
}

export const ExploreGPTsModal: React.FC<ExploreGPTsModalProps> = ({
  isOpen,
  onClose,
  onSelectGPT,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Programming', 'Writing', 'Analysis', 'Creative', 'Education', 'Productivity'];

  const filteredGPTs = DEFAULT_CUSTOM_GPTS.filter((gpt) => {
    const matchesSearch =
      gpt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gpt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gpt.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || gpt.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'code':
        return <Code2 className="w-5 h-5 text-blue-400" />;
      case 'pen':
        return <PenTool className="w-5 h-5 text-purple-400" />;
      case 'chart':
        return <BarChart3 className="w-5 h-5 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-amber-400" />;
      case 'academic':
        return <GraduationCap className="w-5 h-5 text-cyan-400" />;
      default:
        return <Compass className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Explore Custom GPTs
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  NEXUS Studio
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Jelajahi asisten AI khusus yang dirancang untuk kebutuhan spesifik Anda
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

        {/* Search & Category Filter */}
        <div className="p-6 pb-2 space-y-4 border-b border-white/5 bg-[#111111]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari asisten GPT (misal: Code, Data, Copywriting)..."
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-white/30"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20'
                    : 'bg-[#1a1a1a] text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {cat === 'All' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* GPTs Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGPTs.map((gpt) => (
            <div
              key={gpt.id}
              className="group bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 hover:border-emerald-500/30 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                      {getIcon(gpt.icon)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {gpt.name}
                      </h3>
                      <p className="text-[11px] text-white/50 line-clamp-1">{gpt.tagline}</p>
                    </div>
                  </div>
                  {gpt.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/70 border border-white/10">
                      {gpt.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/70 leading-relaxed mb-4">{gpt.description}</p>

                {/* Prompt Starters */}
                <div className="space-y-1.5 mb-4">
                  <p className="text-[10px] uppercase font-semibold text-white/30 tracking-wider">
                    Contoh Perintah:
                  </p>
                  {gpt.starterPrompts.slice(0, 2).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectGPT(gpt, prompt)}
                      className="w-full text-left text-xs text-white/60 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 rounded-lg px-2.5 py-1.5 truncate transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">"{prompt}"</span>
                      <ArrowRight className="w-3 h-3 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectGPT(gpt)}
                className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Mulai Chat dengan Asisten Ini
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
