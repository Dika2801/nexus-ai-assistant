import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Centralized OpenAI Model Configuration
// NEXUS AI menggunakan OpenAI sebagai SATU-SATUNYA AI provider utama.
// Google/Gemini TIDAK digunakan lagi, baik sebagai provider utama maupun
// fallback tersembunyi. Jika OpenAI gagal, sistem menampilkan error yang
// jelas — bukan diam-diam berpindah ke provider lain.
//
// Semua nama model bisa diganti lewat environment variable tanpa mengubah
// kode aplikasi. Jika model yang diminta tidak tersedia pada akun API kamu,
// OpenAI API akan mengembalikan error 'model_not_found' yang akan diteruskan
// apa adanya ke pengguna (lihat mapOpenAIError()).
// ---------------------------------------------------------------------------
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';
const OPENAI_CHAT_MODEL_MINI = process.env.OPENAI_CHAT_MODEL_MINI || 'gpt-4o-mini';
const OPENAI_REASONING_MODEL = process.env.OPENAI_REASONING_MODEL || 'o3-mini';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
const OPENAI_IMAGE_EDIT_MODEL = process.env.OPENAI_IMAGE_EDIT_MODEL || 'gpt-image-1';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

// URL microservice face-swap eksternal (lihat folder /faceswap-service).
// Sengaja dipisah dari backend utama karena face-swap butuh model computer
// vision (InsightFace) yang tidak tersedia lewat OpenAI API.
const FACE_SWAP_SERVICE_URL = process.env.FACE_SWAP_SERVICE_URL || '';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const startTime = Date.now();

// Increase JSON payload limit for image and document uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS and Security Headers (Configured for Hugging Face Spaces & Standalone Web)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  res.removeHeader('X-Frame-Options');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ---------------------------------------------------------------------------
// Zero-Cost Database Engine (Local JSON persistence + Supabase Bridge)
// ---------------------------------------------------------------------------
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'nexus_db.json');

interface StoredData {
  users: Array<{
    id: string;
    username: string;
    passwordHash: string;
    name: string;
    role: 'user' | 'admin';
    isActive: boolean;
    createdAt: number;
    totalTokensUsed: number;
    totalRequests: number;
    lastActive: number;
  }>;
  conversations: Array<{
    id: string;
    userId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Array<any>;
    pinned?: boolean;
    model: string;
  }>;
  settings: {
    defaultModel: string;
    maxRateLimitPerMin: number;
    announcement: string;
    allowRegistration: boolean;
  };
  errorLogs?: Array<{
    id: string;
    timestamp: number;
    level: 'warn' | 'error' | 'info';
    context: string;
    message: string;
    userId?: string;
    metadata?: Record<string, any>;
  }>;
}

const defaultDB: StoredData = {
  users: [
    {
      id: 'admin_root',
      username: 'admin',
      passwordHash: 'admin123',
      name: 'NEXUS Administrator',
      role: 'admin',
      isActive: true,
      createdAt: Date.now(),
      totalTokensUsed: 0,
      totalRequests: 0,
      lastActive: Date.now(),
    },
    {
      id: 'guest_user',
      username: 'guest',
      passwordHash: 'guest123',
      name: 'Guest User',
      role: 'user',
      isActive: true,
      createdAt: Date.now(),
      totalTokensUsed: 0,
      totalRequests: 0,
      lastActive: Date.now(),
    },
  ],
  conversations: [],
  settings: {
    defaultModel: 'nexus-5.6-sol',
    maxRateLimitPerMin: 30,
    announcement: 'Selamat datang di NEXUS AI Assistant. Dikembangkan oleh NEXUS Group (Founder & CEO: Muhamad Andika).',
    allowRegistration: true,
  },
  errorLogs: [],
};

let db: StoredData = { ...defaultDB };

function initDB() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.users || !Array.isArray(db.users)) db.users = defaultDB.users;
      if (!db.conversations || !Array.isArray(db.conversations)) db.conversations = defaultDB.conversations;
      if (!db.settings) db.settings = defaultDB.settings;
      if (!db.errorLogs || !Array.isArray(db.errorLogs)) db.errorLogs = [];
    } else {
      saveDB();
    }
  } catch (err) {
    console.warn('Using in-memory DB fallback:', err);
    db = defaultDB;
  }
}

function saveDB() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist DB to file, using in-memory state:', err);
  }
}

initDB();

// ---------------------------------------------------------------------------
// Autonomous AI Co-Pilot Developer & Self-Healing Engine (Auto-Diagnostic & Self-Repair)
// ---------------------------------------------------------------------------

function logSystemTelemetry(level: 'error' | 'warn' | 'info', context: string, message: string, userId?: string, metadata?: any) {
  try {
    if (!db.errorLogs) db.errorLogs = [];
    const entry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level,
      context: String(context).slice(0, 80),
      message: String(message).slice(0, 500),
      userId: userId ? String(userId).slice(0, 32) : undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    };
    db.errorLogs.unshift(entry);
    if (db.errorLogs.length > 200) {
      db.errorLogs = db.errorLogs.slice(0, 200);
    }
    saveDB();
  } catch (err) {
    console.warn('[Telemetry] Error saving telemetry:', err);
  }
}

// AI Autonomous Self-Healing Diagnostic Analysis (OpenAI)
async function performAutonomousSelfHealing(errorContext: string, errorMessage: string) {
  const openai = getOpenAIClient();
  if (!openai) return null;

  try {
    const prompt = `Anda adalah NEXUS Autonomous Co-Pilot Developer & Self-Healing Agent.
Terjadi error atau anomali pada sistem:
- Context: ${errorContext}
- Message: ${errorMessage}

Berikan diagnosis akar masalah (root cause) singkat dan langkah perbaikan otomatis (self-healing mitigation recommendation) dalam format JSON valid berikut, TANPA markdown, TANPA teks lain:
{
  "diagnosis": "penjelasan akar masalah singkat dan padat",
  "severity": "low" | "medium" | "high",
  "autoFixAction": "rekomendasi tindakan perbaikan otomatis yang diambil sistem",
  "healthStatus": "healed" | "monitoring" | "attention_needed"
}`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL_MINI,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const text = completion.choices?.[0]?.message?.content;
    if (text) {
      const parsed = JSON.parse(text);
      logSystemTelemetry('info', 'self-healing-copilot', `Diagnosis Selesai: ${parsed.diagnosis} | Status: ${parsed.healthStatus}`, undefined, parsed);
      return parsed;
    }
  } catch (diagErr: any) {
    console.warn('[Self-Healing Co-Pilot] Diag note:', diagErr?.message);
  }
  return null;
}
const requestLogs = new Map<string, number[]>();

function checkRateLimit(key: string, limitPerMinute: number = 30): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = requestLogs.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= limitPerMinute) {
    return false;
  }

  validTimestamps.push(now);
  requestLogs.set(key, validTimestamps);
  return true;
}

// Rate limit middleware
const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientKey = (req.headers['x-user-id'] as string) || req.ip || 'anonymous';
  const maxLimit = db.settings.maxRateLimitPerMin || 30;

  if (!checkRateLimit(clientKey, maxLimit)) {
    return res.status(429).json({
      error: 'Batas penggunaan tercapai (Rate limit exceeded). Silakan tunggu 1 menit.',
      retryAfterSeconds: 60,
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// AI Client Setup — OpenAI adalah SATU-SATUNYA provider AI.
// API key TIDAK PERNAH dikirim ke frontend; hanya dibaca dari environment
// variable di sisi server (backend-as-proxy).
// ---------------------------------------------------------------------------

const AVAILABLE_MODELS = [
  {
    id: 'nexus-5.6-sol',
    name: 'NEXUS 5.6 Sol',
    provider: 'NEXUS' as const,
    description: 'Model frontier unggulan NEXUS untuk penalaran paling kompleks, coding arsitektur, dan deep logic.',
    contextWindow: '1.05M',
    speed: 'High Reasoning' as const,
    isDefault: true,
    badge: 'Frontier Flagship',
    supportsVision: true,
    supportsWebSearch: true,
  },
  {
    id: 'nexus-5.6-terra',
    name: 'NEXUS 5.6 Terra',
    provider: 'NEXUS' as const,
    description: 'Model serbaguna seimbang untuk analisis visual gambar, naskah dokumen, dan tugas harian.',
    contextWindow: '1.05M',
    speed: 'Balanced' as const,
    badge: 'Multimodal Workload',
    supportsVision: true,
    supportsWebSearch: true,
  },
  {
    id: 'nexus-5.6-luna',
    name: 'NEXUS 5.6 Luna',
    provider: 'NEXUS' as const,
    description: 'Model ultra cepat berlatensi rendah untuk respons kilat, percakapan interaktif, dan efisiensi tinggi.',
    contextWindow: '1.05M',
    speed: 'Ultra Fast' as const,
    badge: 'Ultra Fast & Ringkas',
    supportsVision: true,
    supportsWebSearch: true,
  },
  {
    id: 'nexus-4.5-omni',
    name: 'NEXUS 4.5 Omni',
    provider: 'NEXUS' as const,
    description: 'Model flagship multimodal unggulan untuk visual, membaca gambar, logika mendalam, dan analisis.',
    contextWindow: '128K',
    speed: 'Balanced' as const,
    badge: 'Multimodal Vision',
    supportsVision: true,
    supportsWebSearch: true,
  },
  {
    id: 'nexus-4.5-mini',
    name: 'NEXUS 4.5 Mini',
    provider: 'NEXUS' as const,
    description: 'Model gesit & hemat kuota untuk percakapan, tugas harian, dan coding.',
    contextWindow: '128K',
    speed: 'Ultra Fast' as const,
    badge: 'Paling Hemat',
    supportsVision: true,
    supportsWebSearch: true,
  },
  {
    id: 'nexus-reasoning',
    name: 'NEXUS Reasoning Pro',
    provider: 'NEXUS' as const,
    description: 'Model reasoning bertahap mendalam untuk matematika, algoritma, dan problem-solving logika.',
    contextWindow: '200K',
    speed: 'High Reasoning' as const,
    badge: 'Deep Reasoning',
    supportsVision: false,
    supportsWebSearch: true,
  },
];

// Menerjemahkan error OpenAI mentah menjadi pesan yang jelas & ramah pengguna,
// tanpa pernah menampilkan traceback teknis. Detail asli tetap dicatat lewat
// console.error/logSystemTelemetry untuk keperluan debugging backend.
function mapOpenAIError(err: any): { message: string; status: number } {
  const status = err?.status || err?.response?.status;
  const code = err?.code || err?.error?.code;
  const rawMsg = String(err?.message || err?.error?.message || '');

  if (!process.env.OPENAI_API_KEY) {
    return { message: 'OPENAI_API_KEY belum dikonfigurasi di server. Hubungi administrator untuk mengatur secret ini.', status: 500 };
  }
  if (status === 401 || code === 'invalid_api_key') {
    return { message: 'API key OpenAI tidak valid. Periksa kembali OPENAI_API_KEY di secret server.', status: 401 };
  }
  if (status === 404 || code === 'model_not_found') {
    return { message: `Model AI yang diminta tidak tersedia pada akun OpenAI kamu. Coba ganti model lewat environment variable OPENAI_CHAT_MODEL.`, status: 404 };
  }
  if (status === 429 || code === 'rate_limit_exceeded' || code === 'insufficient_quota') {
    return { message: 'Batas kuota/rate limit OpenAI tercapai. Silakan tunggu sebentar atau periksa saldo/plan API kamu.', status: 429 };
  }
  if (rawMsg.toLowerCase().includes('context_length_exceeded') || rawMsg.toLowerCase().includes('maximum context length')) {
    return { message: 'Percakapan terlalu panjang untuk diproses model ini. Mulai percakapan baru atau kurangi lampiran.', status: 400 };
  }
  if (status === 400 || code === 'invalid_request_error') {
    return { message: 'Permintaan tidak valid ke AI (format pesan/lampiran bermasalah).', status: 400 };
  }
  if (err?.name === 'AbortError' || rawMsg.toLowerCase().includes('timeout')) {
    return { message: 'Koneksi ke server AI timeout. Silakan coba lagi.', status: 504 };
  }
  if (status >= 500 || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ENOTFOUND')) {
    return { message: 'Terjadi gangguan saat menghubungkan ke AI. Silakan coba lagi dalam beberapa saat.', status: 502 };
  }
  return { message: 'Terjadi gangguan saat menghubungkan ke AI. Silakan coba lagi.', status: 500 };
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Helper to execute OpenAI chat completion with full Multimodal Vision and Document support
async function callOpenAI(messages: any[], model: string, stream = false, attachments?: any[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured in backend secrets.');

  // Peta nama model "NEXUS" (identitas produk) ke model OpenAI aktual.
  // Semua diambil dari konfigurasi terpusat di atas (OPENAI_CHAT_MODEL, dst)
  // sehingga model bisa diganti lewat environment variable tanpa mengubah kode.
  const openaiModelMap: Record<string, string> = {
    'nexus-5.6-sol': OPENAI_CHAT_MODEL,
    'nexus-5.6-terra': OPENAI_CHAT_MODEL,
    'nexus-5.6-luna': OPENAI_CHAT_MODEL_MINI,
    'nexus-4.5-omni': OPENAI_CHAT_MODEL,
    'nexus-4.5-mini': OPENAI_CHAT_MODEL_MINI,
    'nexus-reasoning': OPENAI_REASONING_MODEL,
  };

  // Jika model bukan salah satu alias NEXUS, izinkan pemanggil memberikan
  // nama model OpenAI asli secara langsung (mis. 'gpt-4o', 'o3-mini').
  const selectedModel = openaiModelMap[model] || model || OPENAI_CHAT_MODEL;
  const client = getOpenAIClient();
  if (!client) throw new Error('OpenAI client could not be initialized.');

  // Format messages into standard OpenAI schema with Multimodal Vision & Docs
  const formattedMessages: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLast = i === messages.length - 1;
    const currentAttachments = (isLast && attachments && attachments.length > 0) ? attachments : (m.attachments || []);

    if (m.role === 'assistant') {
      formattedMessages.push({
        role: 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      });
    } else if (m.role === 'system') {
      formattedMessages.push({
        role: 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      });
    } else {
      // User message
      let textContent = typeof m.content === 'string' ? m.content : '';

      // Append extracted text from attached documents
      if (currentAttachments && currentAttachments.length > 0) {
        for (const att of currentAttachments) {
          if (att.type === 'document' || att.extractedText) {
            textContent += `\n\n[Lampiran Dokumen: "${att.name || 'Dokumen'}"]:\n\`\`\`\n${att.extractedText || ''}\n\`\`\`\n`;
          }
        }
      }

      // Check for image attachments
      const imageAttachments = currentAttachments?.filter((a: any) => a.type === 'image' && a.dataUrl) || [];

      if (imageAttachments.length > 0) {
        const contentParts: any[] = [
          { type: 'text', text: textContent || 'Analisis dan jelaskan gambar terlampir ini secara detail.' },
        ];
        for (const img of imageAttachments) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.dataUrl,
              detail: 'auto',
            },
          });
        }
        formattedMessages.push({
          role: 'user',
          content: contentParts,
        });
      } else {
        formattedMessages.push({
          role: 'user',
          content: textContent,
        });
      }
    }
  }

  // Handle o3-mini reasoning models that do not accept system role directly
  if (selectedModel.startsWith('o3')) {
    const sysIdx = formattedMessages.findIndex((m) => m.role === 'system');
    if (sysIdx !== -1) {
      const sysMsg = formattedMessages.splice(sysIdx, 1)[0];
      const firstUser = formattedMessages.find((m) => m.role === 'user');
      if (firstUser) {
        if (typeof firstUser.content === 'string') {
          firstUser.content = `[Instruksi Sistem]: ${sysMsg.content}\n\n${firstUser.content}`;
        }
      }
    }
  }

  if (stream) {
    return await client.chat.completions.create({
      model: selectedModel,
      messages: formattedMessages,
      stream: true,
    });
  } else {
    return await client.chat.completions.create({
      model: selectedModel,
      messages: formattedMessages,
      stream: false,
    });
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// 1. Health & Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'NEXUS AI Assistant',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasSupabase: !!process.env.SUPABASE_URL,
    hasFaceSwapService: !!FACE_SWAP_SERVICE_URL,
    aiProvider: 'OpenAI',
    totalUsers: db.users.length,
    totalConversations: db.conversations.length,
    defaultModel: db.settings.defaultModel,
  });
});

// 2. Model List
app.get('/api/models', (req, res) => {
  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: db.settings.defaultModel,
  });
});

// 3. Simple Authentication
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const user = db.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Akun dinonaktifkan oleh administrator.' });
  }

  user.lastActive = Date.now();
  saveDB();

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      totalTokensUsed: user.totalTokensUsed,
      totalRequests: user.totalRequests,
      createdAt: user.createdAt,
    },
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!db.settings.allowRegistration) {
    return res.status(403).json({ error: 'Pendaftaran pengguna baru sedang ditutup.' });
  }
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  }

  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: 'Username sudah digunakan. Silakan gunakan username lain.' });
  }

  const newUser = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    username: cleanUsername,
    passwordHash: password,
    name: name?.trim() || cleanUsername,
    role: 'user' as const,
    isActive: true,
    createdAt: Date.now(),
    totalTokensUsed: 0,
    totalRequests: 0,
    lastActive: Date.now(),
  };

  db.users.push(newUser);
  saveDB();

  res.json({
    user: {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      totalTokensUsed: 0,
      totalRequests: 0,
      createdAt: newUser.createdAt,
    },
  });
});

app.post('/api/auth/guest', (req, res) => {
  const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const guestUser = {
    id: guestId,
    username: 'guest_' + Math.random().toString(36).substring(2, 6),
    passwordHash: 'guest123',
    name: 'Tamu NEXUS',
    role: 'user' as const,
    isActive: true,
    createdAt: Date.now(),
    totalTokensUsed: 0,
    totalRequests: 0,
    lastActive: Date.now(),
  };
  db.users.push(guestUser);
  saveDB();

  res.json({
    user: {
      id: guestUser.id,
      username: guestUser.username,
      name: guestUser.name,
      role: guestUser.role,
      totalTokensUsed: 0,
      totalRequests: 0,
      createdAt: guestUser.createdAt,
    },
  });
});

// ---------------------------------------------------------------------------
// Real-Time Live Web Search Engine (Google News RSS, DuckDuckGo, Wikipedia, & Live Web Data)
// ---------------------------------------------------------------------------

function shouldPerformAutoWebSearch(query: string, enableWebSearch?: boolean): boolean {
  if (enableWebSearch) return true;
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase();
  const keywords = [
    'berita', 'terkini', 'terbaru', 'hari ini', 'saat ini', 'sekarang', 'info', 'kabar',
    'perkembangan', 'cuaca', 'harga', 'kurs', 'saham', 'rupiah', 'dolar', 'bitcoin',
    'crypto', 'ihsg', 'klasemen', 'jadwal', 'pertandingan', 'presiden', 'pilpres', 'pilkada',
    'menteri', 'ikn', 'gempa', 'bencana', 'update', 'viral', 'trending', 'film terbaru',
    'jadwal bioskop', 'news', 'today', 'latest', 'current', 'weather', 'price', 'stock',
    'who is', 'when is', 'recent', 'live', 'now', 'event', 'events', 'indonesia'
  ];
  return keywords.some((kw) => q.includes(kw));
}

function detectImageGenerationIntent(query: string): { isImageGen: boolean; prompt: string } {
  if (!query || typeof query !== 'string') return { isImageGen: false, prompt: '' };
  const q = query.trim();
  const lower = q.toLowerCase();

  const imagePatterns = [
    /^(?:tolong\s+)?(?:buatkan|buat|bikinin|bikin|gambarkan|gambarkanlah|lukiskan|ciptakan|hasilkan|generate|create|draw|paint|make)\s+(?:sebuah\s+|seekor\s+|suatu\s+|satu\s+)?(?:gambar|foto|lukisan|ilustrasi|image|picture|photo|illustration|artwork)\s+(?:tentang\s+|dari\s+|berupa\s+|of\s+|about\s+)?(.+)$/i,
    /^(?:buatkan|buat|bikinin|bikin|lukiskan|gambarkan|draw|paint|generate)\s+(?:sebuah\s+|seekor\s+|suatu\s+)?(.+)$/i,
    /^(?:gambar|foto|lukisan|ilustrasi|image)\s+(?:dari|tentang|of|about)\s+(.+)$/i,
  ];

  for (const pattern of imagePatterns) {
    const match = q.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim().replace(/^[\.,:;]+|[\.,:;]+$/g, '');
      const exLower = extracted.toLowerCase();
      if (
        !exLower.startsWith('kode') &&
        !exLower.startsWith('tabel') &&
        !exLower.startsWith('program') &&
        !exLower.startsWith('script') &&
        !exLower.startsWith('dokumen') &&
        !exLower.startsWith('surat') &&
        !exLower.startsWith('esai') &&
        !exLower.startsWith('puisi') &&
        !exLower.startsWith('ringkasan') &&
        !exLower.startsWith('artikel')
      ) {
        return { isImageGen: true, prompt: extracted };
      }
    }
  }

  if (
    lower.includes('buatkan gambar') ||
    lower.includes('buat gambar') ||
    lower.includes('bikinin gambar') ||
    lower.includes('bikin gambar') ||
    lower.includes('lukiskan gambar') ||
    lower.includes('generate image') ||
    lower.includes('create image') ||
    lower.includes('draw an image') ||
    lower.includes('draw a picture')
  ) {
    const cleaned = q
      .replace(/^(?:tolong\s+)?(?:buatkan|buat|bikinin|bikin|lukiskan|generate|create|draw)\s+(?:sebuah\s+|seekor\s+|suatu\s+)?(?:gambar|foto|lukisan|image|picture)\s+(?:tentang|dari|of|about|berupa)?\s*/i, '')
      .trim();
    return { isImageGen: true, prompt: cleaned || q };
  }

  return { isImageGen: false, prompt: '' };
}

// Intelligent Prompt Optimizer & Translator for Image Synthesis
async function translateAndRefineImagePrompt(rawPrompt: string): Promise<string> {
  const clean = rawPrompt.trim();
  if (!clean) return 'breathtaking masterpiece, 8k resolution, photorealistic';

  // 1. Try OpenAI to generate an ultra-accurate English visual prompt
  const openaiForPrompt = getOpenAIClient();
  if (openaiForPrompt) {
    try {
      const completion = await openaiForPrompt.chat.completions.create({
        model: OPENAI_CHAT_MODEL_MINI,
        messages: [
          {
            role: 'system',
            content: `You are an expert prompt engineer for text-to-image AI models.
Convert and expand the user's request into a precise, detailed, visually descriptive English image generation prompt.
STRICT RULES:
- Describe the exact subject, composition, environment, lighting, mood, color palette, and camera angle.
- Follow the user's subject STRICTLY. If the user asks for a cityscape, landscape, object, car, animal, or interior, DO NOT add human portraits, people, or women unless explicitly requested.
- Output ONLY the refined English prompt text. No markdown, no quotes, no conversational filler.`,
          },
          { role: 'user', content: clean },
        ],
      });
      const refined = completion.choices?.[0]?.message?.content?.trim().replace(/^["'`]|["'`]$/g, '');
      if (refined && refined.length > 5 && !refined.toLowerCase().startsWith('here is') && !refined.toLowerCase().startsWith('prompt:')) {
        return refined;
      }
    } catch (e: any) {
      console.warn('[NEXUS Prompt Optimizer] OpenAI translation note:', e?.message);
    }
  }

  // 2. High-accuracy dictionary-based translation and visual enrichment fallback
  // (dipakai hanya jika OpenAI tidak terkonfigurasi atau gagal — bukan AI provider,
  // murni pemetaan kata kunci lokal, tidak memanggil Gemini/Google AI apa pun)
  let en = clean;
  const translationMap: Array<[RegExp, string]> = [
    [/pemandangan kota pada malam hari|pemandangan kota malam|kota malam hari|kota malam/gi, 'breathtaking panoramic cityscape at night, glowing skyscrapers, luminous city street lights, illuminated buildings, clear night sky, reflections on water'],
    [/pemandangan kota siang hari|pemandangan kota/gi, 'magnificent modern city skyline, architectural skyscrapers, bustling streets, bright daylight, clear sky'],
    [/pemandangan alam/gi, 'scenic natural landscape, dramatic mountains, lush greenery, crystal clear river, morning light'],
    [/malam hari|waktu malam/gi, 'at night with glowing lights and atmospheric night ambience'],
    [/siang hari/gi, 'bright daylight, sunlit, clear skies'],
    [/sore hari|senja|sunset/gi, 'golden hour sunset, vibrant warm orange and purple twilight sky'],
    [/pagi hari|sunrise/gi, 'early morning sunrise, golden morning mist'],
    [/pantai/gi, 'tropical beach, turquoise ocean waves, white sand'],
    [/gunung/gi, 'majestic mountain peaks, dramatic clouds, breathtaking alpine vista'],
    [/hutan/gi, 'lush green forest, sunbeams filtering through trees'],
    [/air terjun/gi, 'majestic cascading waterfall, mist and lush mossy rocks'],
    [/desa|pedesaan/gi, 'picturesque countryside village, tranquil rural scenery'],
    [/cyberpunk/gi, 'cyberpunk metropolis, neon lighting, futuristic holograms, rainy reflections'],
    [/mobil/gi, 'sleek modern luxury sports car'],
    [/motor/gi, 'futuristic motorcycle'],
    [/kucing/gi, 'cute adorable fluffy cat, soft fur, close-up'],
    [/anjing/gi, 'friendly loyal dog, joyful expression'],
    [/robot/gi, 'futuristic high-tech android robot, polished chrome details'],
    [/lukisan/gi, 'masterpiece oil painting, rich textures, artistic brushstrokes'],
    [/anime/gi, 'high quality anime illustration, vivid vibrant colors, makoto shinkai style'],
    [/ilustrasi 3d/gi, 'cute 3d render, claymation style, soft studio lighting'],
  ];

  for (const [regex, replacement] of translationMap) {
    if (regex.test(en)) {
      en = en.replace(regex, replacement);
    }
  }

  return `${en}, highly detailed, photorealistic, cinematic lighting, sharp focus, 8k resolution`;
}

// Universal AI Image Generation Engine (NEXUS Visual Studio Engine)
async function generateAiImageHelper(prompt: string, aspectRatio: string = '1:1', imageSize: string = '1K') {
  const refinedEnglishPrompt = await translateAndRefineImagePrompt(prompt);
  console.log(`[NEXUS Image Engine] Original: "${prompt}" -> Refined: "${refinedEnglishPrompt}"`);

  // OpenAI Image Generation (DALL-E 3 / gpt-image-1, dikonfigurasi lewat OPENAI_IMAGE_MODEL)
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OPENAI_API_KEY belum dikonfigurasi di server. Fitur generate gambar tidak tersedia.');
  }

  let dalleSize: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024';
  if (aspectRatio === '9:16') dalleSize = '1024x1792';
  if (aspectRatio === '16:9') dalleSize = '1792x1024';

  const response = await openai.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt: refinedEnglishPrompt,
    n: 1,
    size: dalleSize,
    ...(OPENAI_IMAGE_MODEL === 'dall-e-3'
      ? { quality: imageSize === '4K' || imageSize === '2K' ? 'hd' : 'standard' }
      : {}),
  });

  const imageData = response.data?.[0];
  const imageUrl = imageData?.url
    ? imageData.url
    : imageData?.b64_json
      ? `data:image/png;base64,${imageData.b64_json}`
      : null;

  if (!imageUrl) {
    throw new Error('OpenAI tidak mengembalikan gambar. Coba ubah deskripsi gambar Anda.');
  }

  return {
    success: true,
    imageUrl,
    revisedPrompt: imageData?.revised_prompt || refinedEnglishPrompt,
    model: `NEXUS Visual Studio HD (${OPENAI_IMAGE_MODEL})`,
  };
}

async function performLiveWebSearch(query: string): Promise<{
  summary: string;
  contextText: string;
  sources: Array<{ title: string; uri: string; snippet?: string }>;
}> {
  const sources: Array<{ title: string; uri: string; snippet?: string }> = [];
  const snippets: string[] = [];
  const cleanQuery = query.trim();

  // 1. Google News Live RSS (Breaking news & current real-time articles in Indonesia & Global)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const isIndo = !/[a-zA-Z]{18,}/.test(cleanQuery);
    const rssUrl = isIndo
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=id&gl=ID&ceid=ID:id`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`;

    const rssRes = await fetch(rssUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    clearTimeout(timeout);

    if (rssRes.ok) {
      const xmlText = await rssRes.text();
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<source[^>]*>(.*?)<\/source>[\s\S]*?<\/item>/gi;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xmlText)) !== null && count < 5) {
        const rawTitle = match[1]
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"');
        const link = match[2];
        const pubDate = match[3];
        const sourceName = match[4].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');

        snippets.push(`[Berita Terkini - ${sourceName} (${pubDate})]: ${rawTitle}`);
        sources.push({
          title: `${rawTitle} (${sourceName})`,
          uri: link,
          snippet: `${rawTitle} - Dipublikasikan: ${pubDate}`,
        });
        count++;
      }
    }
  } catch (e) {
    // Continue
  }

  // 2. DuckDuckGo Instant Answer & Related Topics
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }
    );
    clearTimeout(timeout);

    if (ddgRes.ok) {
      const data: any = await ddgRes.json();
      if (data.AbstractText && data.AbstractURL) {
        snippets.push(`[Ringkasan DuckDuckGo - ${data.Heading || 'Utama'}]: ${data.AbstractText}`);
        sources.push({
          title: data.Heading || 'Ringkasan Utama',
          uri: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 4)) {
          if (topic.Text && topic.FirstURL) {
            snippets.push(`- ${topic.Text}`);
            sources.push({
              title: topic.Text.slice(0, 70) + (topic.Text.length > 70 ? '...' : ''),
              uri: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }
    }
  } catch (e) {
    // Continue to next source
  }

  // 3. Wikipedia Search API
  try {
    const isIndo = /[a-zA-Z]/.test(cleanQuery) && (
      cleanQuery.includes('apa') || cleanQuery.includes('siapa') || cleanQuery.includes('berita') ||
      cleanQuery.includes('harga') || cleanQuery.includes('terbaru') || cleanQuery.includes('indonesia')
    );
    const lang = isIndo ? 'id' : 'en';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const wikiRes = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'NexusAI/1.0 (support@nexus.ai)' },
      }
    );
    clearTimeout(timeout);

    if (wikiRes.ok) {
      const wikiData: any = await wikiRes.json();
      const searchResults = wikiData?.query?.search || [];
      for (const item of searchResults.slice(0, 3)) {
        const cleanSnippet = item.snippet.replace(/<\/?[^>]+(>|$)/g, '');
        snippets.push(`[Wikipedia - ${item.title}]: ${cleanSnippet}`);
        sources.push({
          title: `Wikipedia: ${item.title}`,
          uri: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          snippet: cleanSnippet,
        });
      }
    }
  } catch (e) {
    // Continue
  }

  // 4. Fallback search link
  if (sources.length === 0) {
    sources.push({
      title: `Pencarian Web Terverifikasi: "${cleanQuery}"`,
      uri: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
      snippet: `Data web pencarian langsung untuk "${cleanQuery}"`,
    });
  }

  // Deduplicate sources by URI
  const uniqueSources = sources.filter((v, i, a) => a.findIndex((t) => t.uri === v.uri) === i).slice(0, 6);

  const contextText = snippets.length > 0
    ? snippets.join('\n\n')
    : `Informasi pencarian web aktif untuk topik: "${cleanQuery}".`;

  return {
    summary: snippets.slice(0, 2).join(' '),
    contextText,
    sources: uniqueSources,
  };
}

// 4. Conversation Management
app.get('/api/conversations', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest_user';
  const userConvs = db.conversations
    .filter((c) => c.userId === userId)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
  res.json({ conversations: userConvs });
});

app.post('/api/conversations', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest_user';
  const { title, model, systemPrompt, initialMessage } = req.body;

  const newConv = {
    id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    userId,
    title: title || 'Percakapan Baru',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: false,
    model: model || db.settings.defaultModel,
    systemPrompt: systemPrompt || '',
    messages: initialMessage ? [initialMessage] : [],
  };

  db.conversations.unshift(newConv);
  saveDB();

  res.json({ conversation: newConv });
});

app.put('/api/conversations/:id', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest_user';
  const { id } = req.params;
  const { title, pinned, messages, model } = req.body;

  const conv = db.conversations.find((c) => c.id === id && (c.userId === userId || userId === 'admin_root'));
  if (!conv) {
    return res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
  }

  if (title !== undefined) conv.title = title;
  if (pinned !== undefined) conv.pinned = pinned;
  if (messages !== undefined) conv.messages = messages;
  if (model !== undefined) conv.model = model;
  conv.updatedAt = Date.now();

  saveDB();
  res.json({ conversation: conv });
});

app.delete('/api/conversations/:id', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'guest_user';
  const { id } = req.params;

  const index = db.conversations.findIndex((c) => c.id === id && (c.userId === userId || userId === 'admin_root'));
  if (index === -1) {
    return res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
  }

  db.conversations.splice(index, 1);
  saveDB();
  res.json({ success: true, message: 'Percakapan berhasil dihapus.' });
});

// 5. Streaming AI Chat Endpoint — OpenAI sebagai satu-satunya AI provider,
// dengan konteks percakapan penuh, trimming riwayat token-aware, dan
// grounding pencarian web real-time.
app.post('/api/chat/stream', rateLimiter, async (req: Request, res: Response) => {
  const { messages, model = 'nexus-5.6-sol', attachments = [], systemPrompt, enableWebSearch, enableThinking } = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'guest_user';

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Pesan percakapan tidak boleh kosong.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Update user stats
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.totalRequests += 1;
    user.lastActive = Date.now();
  }

  if (!process.env.OPENAI_API_KEY) {
    sendSSE('error', {
      message: 'OPENAI_API_KEY belum dikonfigurasi di server. Hubungi administrator untuk mengatur secret ini.',
    });
    res.end();
    return;
  }

  try {
    let liveWebSources: Array<{ title?: string; uri?: string }> = [];
    let liveWebContext = '';

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastQuery = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    // 1. In-Chat Image Generation Intent (like ChatGPT DALL-E)
    const imgIntent = detectImageGenerationIntent(lastQuery);
    if (imgIntent.isImageGen && imgIntent.prompt && (!attachments || attachments.length === 0)) {
      sendSSE('status', { message: `🎨 Menghasilkan gambar "${imgIntent.prompt}" dengan AI Visual Studio...` });
      try {
        const imgResult = await generateAiImageHelper(imgIntent.prompt);
        if (imgResult && imgResult.imageUrl) {
          const caption = `Ini gambar **"${imgIntent.prompt}"** yang baru saya buat pakai **${imgResult.model}**:\n\n![${imgIntent.prompt}](${imgResult.imageUrl})\n\n> **Model:** ${imgResult.model}\n> **Deskripsi visual:** *"${imgResult.revisedPrompt || imgIntent.prompt}"*\n\nMau saya buatkan variasi gaya atau angle lain?`;

          const chunkSize = 30;
          for (let i = 0; i < caption.length; i += chunkSize) {
            sendSSE('chunk', { text: caption.slice(i, i + chunkSize) });
            await new Promise((r) => setTimeout(r, 12));
          }
          sendSSE('done', { model: imgResult.model, imageUrl: imgResult.imageUrl });
          if (user) {
            user.totalTokensUsed += 50;
            saveDB();
          }
          res.end();
          return;
        }
      } catch (imgErr: any) {
        console.warn('In-chat image generation note, proceeding with chat pipeline:', imgErr?.message);
      }
    }

    // 2. Real-Time Web Search (Auto-detect or Explicit button toggle)
    const isRealtimeQuery = shouldPerformAutoWebSearch(lastQuery, enableWebSearch);
    if (isRealtimeQuery && lastQuery) {
      sendSSE('status', { message: '🔍 Mengakses data & berita internet secara real-time...' });
      try {
        const searchResult = await performLiveWebSearch(lastQuery);
        liveWebSources = searchResult.sources;
        liveWebContext = `\n\n[INFORMASI TERVERIFIKASI INTERNET LANGSUNG (LIVE WEB REAL-TIME - ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})]:\n${searchResult.contextText}\n[PANDUAN PENTING: Jawablah pertanyaan pengguna menggunakan data web dan berita terkini di atas secara faktual dan akurat. Jangan pernah mengatakan pengetahuan Anda terbatas ke tahun 2023.]\n`;

        if (liveWebSources.length > 0) {
          sendSSE('grounding', { sources: liveWebSources });
        }
      } catch (searchErr) {
        console.warn('Live web search error during streaming:', searchErr);
      }
    }

    const now = new Date();
    const currentDateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
    const currentTimeFormatted = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
    const liveTimeInstruction = `\n[WAKTU SAAT INI: ${currentDateFormatted}, Pukul ${currentTimeFormatted} WIB]. Kamu terhubung ke internet real-time, jadi kalau ditanya berita atau info terkini, jawab pakai data terbaru di bawah (kalau ada) — jangan bilang datamu terbatas ke tanggal cutoff training.`;

    const NEXUS_IDENTITY_INSTRUCTION = `
[IDENTITAS]: Namamu NEXUS AI, dikembangkan oleh NEXUS Group (Founder & CEO: Muhamad Andika). Kalau ditanya siapa kamu atau siapa pembuatmu, jawab itu — jangan menyebut nama perusahaan AI lain sebagai penciptamu.`;

    // System prompt — dirancang agar NEXUS AI terdengar natural, tidak kaku,
    // dan tidak template, sesuai gaya komunikasi yang diminta.
    let modelPersona = `Kamu adalah NEXUS AI, asisten serbaguna yang cerdas dan enak diajak ngobrol — bukan cuma untuk trading, tapi untuk apa saja: coding, riset, analisis, tulis-menulis, sampai obrolan santai sehari-hari.

Gaya bicaramu:
- Natural dan mengalir, seperti orang yang benar-benar paham konteks, bukan template chatbot.
- Jangan selalu buka jawaban dengan "Tentu!" atau tutup dengan "Semoga membantu!" — variasikan atau langsung saja ke intinya.
- Jangan mengulang pertanyaan pengguna sebelum menjawab.
- Kalau pertanyaannya simpel, jawab singkat dan padat — tidak usah bertele-tele. Kalau pengguna minta detail atau topiknya memang kompleks, baru masuk ke penjelasan terstruktur (poin-poin, tabel bila relevan).
- Gunakan Bahasa Indonesia yang natural kalau pengguna berbahasa Indonesia (termasuk paham gaya santai/slang seperti "gue", "lu", "bro"), dan English kalau pengguna menulis dalam English. Jangan menerjemahkan secara kaku atau aneh.
- Istilah teknis dijelaskan dengan bahasa sederhana bila terlihat dibutuhkan.
- Tetap profesional saat konteksnya memang butuh itu (misalnya kode program, analisis data, atau topik serius), meski pengguna santai.
- Untuk kode program: beri blok kode dengan bahasa yang tepat, dan jelaskan bagian penting saja — tidak perlu menjelaskan tiap baris kalau tidak diminta.
- Untuk tabel: ringkas dan proporsional, kolom tidak bertele-tele, enak dibaca di layar HP maupun desktop.`;

    if (enableThinking || model === 'nexus-reasoning') {
      modelPersona += `\n\nUntuk permintaan ini, gunakan penalaran bertahap yang teliti (chain-of-thought internal), verifikasi logikamu sendiri sebelum menjawab, dan sajikan solusi yang benar-benar teruji — terutama untuk soal matematika, algoritma, atau debugging.`;
    }

    let finalSysPrompt = systemPrompt
      ? `${modelPersona}\n${NEXUS_IDENTITY_INSTRUCTION}\n\n${systemPrompt}`
      : `${modelPersona}\n${NEXUS_IDENTITY_INSTRUCTION}`;

    finalSysPrompt += liveTimeInstruction;

    if (liveWebContext) {
      finalSysPrompt += liveWebContext;
    }

    // 3. Token-aware conversation history trimming.
    // Mencegah error "context length exceeded" / request terlalu besar dengan
    // membatasi jumlah pesan riwayat yang dikirim, sambil tetap menjaga
    // konteks percakapan. Strategi: selalu sertakan system prompt + pesan
    // terakhir (dengan lampiran), lalu isi sisa "anggaran" dengan pesan-pesan
    // terbaru lainnya (recency-based window).
    const MAX_HISTORY_MESSAGES = 24; // jumlah pesan riwayat maksimum yang dikirim ke model
    const MAX_HISTORY_CHARS = 60000; // ~15K token kasar, menyisakan ruang untuk system prompt + jawaban

    let trimmedMessages = messages;
    if (messages.length > MAX_HISTORY_MESSAGES) {
      trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    }
    let runningChars = trimmedMessages.reduce(
      (acc: number, m: any) => acc + (typeof m.content === 'string' ? m.content.length : 0),
      0
    );
    while (runningChars > MAX_HISTORY_CHARS && trimmedMessages.length > 2) {
      const removed = trimmedMessages.shift();
      runningChars -= typeof removed?.content === 'string' ? removed.content.length : 0;
    }
    const wasTrimmed = trimmedMessages.length < messages.length;

    const fullMessages: any[] = [];
    if (wasTrimmed) {
      finalSysPrompt += `\n[CATATAN]: Sebagian riwayat percakapan paling awal telah dipangkas otomatis untuk menjaga performa. Fokus pada konteks pesan-pesan terbaru.`;
    }
    fullMessages.push({ role: 'system', content: finalSysPrompt });
    fullMessages.push(...trimmedMessages);

    const openAIStream = (await callOpenAI(fullMessages, model, true, attachments)) as any;
    let totalChars = 0;

    for await (const chunk of openAIStream) {
      const textChunk = chunk.choices?.[0]?.delta?.content || '';
      if (textChunk) {
        totalChars += textChunk.length;
        sendSSE('chunk', { text: textChunk });
      }
    }

    if (liveWebSources.length > 0) {
      sendSSE('grounding', { sources: liveWebSources });
    }

    sendSSE('done', { model });

    if (user) {
      user.totalTokensUsed += Math.ceil(totalChars / 4);
      saveDB();
    }
    res.end();
  } catch (err: any) {
    console.error('Chat stream error:', err);
    logSystemTelemetry('error', 'chat-stream', err?.message || String(err), userId);
    const mapped = mapOpenAIError(err);
    sendSSE('error', { message: mapped.message });
    res.end();
  }
});

// 6. Tools API: Image Analysis / Vision (OpenAI multimodal)
app.post('/api/tools/analyze-image', rateLimiter, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', prompt = 'Analisis gambar ini secara mendalam.' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar tidak ditemukan dalam request.' });
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return res.status(400).json({ error: `Format gambar ${mimeType} tidak didukung. Gunakan JPEG, PNG, WEBP, atau GIF.` });
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  // Batas kasar ~15MB base64 (kira-kira 11MB gambar asli) agar tidak membebani API.
  if (cleanBase64.length > 15_000_000) {
    return res.status(400).json({ error: 'Ukuran gambar terlalu besar. Maksimal sekitar 10MB.' });
  }
  const fullDataUrl = `data:${mimeType};base64,${cleanBase64}`;

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di server.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah NEXUS Vision — bagian dari NEXUS AI yang menganalisis gambar. Berikan analisis visual yang jelas, akurat, dan langsung ke inti, termasuk teks OCR jika ada. Sesuaikan tingkat detail dengan kompleksitas gambar, jangan memaksakan struktur panjang untuk gambar sederhana.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: fullDataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    });

    const analysisText = completion.choices?.[0]?.message?.content || '';
    return res.json({
      success: true,
      analysis: analysisText,
      model: 'NEXUS Vision HD',
    });
  } catch (err: any) {
    console.error('Image analysis error:', err);
    logSystemTelemetry('error', 'analyze-image', err?.message || String(err));
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// 7. Tools API: Document Analysis & QA (OpenAI)
app.post('/api/tools/analyze-doc', rateLimiter, async (req, res) => {
  const { documentText, docName = 'Dokumen', question = 'Buat ringkasan komprehensif dari dokumen ini.' } = req.body;

  if (!documentText || documentText.trim().length === 0) {
    return res.status(400).json({ error: 'Teks dokumen tidak boleh kosong.' });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di server.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah bagian dari NEXUS AI yang menganalisis dokumen. Jawab pertanyaan pengguna secara langsung berdasarkan isi dokumen, dengan poin-poin terstruktur atau tabel bila relevan. Sertakan kutipan kunci dari dokumen bila membantu, tapi jangan mengarang informasi yang tidak ada di dalamnya.',
        },
        {
          role: 'user',
          content: `[NAMA DOKUMEN: ${docName}]
--- DOKUMEN AWAL ---
${documentText.slice(0, 100000)}
--- DOKUMEN AKHIR ---

Pertanyaan / Tugas Pengguna:
${question}`,
        },
      ],
    });

    const resultText = completion.choices?.[0]?.message?.content || '';
    return res.json({
      success: true,
      result: resultText,
      model: 'NEXUS Document Engine Pro',
    });
  } catch (err: any) {
    console.error('Doc analysis error:', err);
    logSystemTelemetry('error', 'analyze-doc', err?.message || String(err));
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// ---------------------------------------------------------------------------
// cleanTextForSpeech: membersihkan teks Markdown/kode/URL/simbol teknis
// sebelum dikirim ke TTS, tanpa mengubah makna kalimat. Dipakai oleh endpoint
// /api/voice/tts sebelum audio disintesis oleh OpenAI.
// ---------------------------------------------------------------------------
function cleanTextForSpeech(raw: string): string {
  let text = raw;

  // Blok kode -> diganti keterangan singkat, bukan dibacakan mentah
  text = text.replace(/```[\s\S]*?```/g, ' (blok kode program) ');
  // Inline code -> ambil isinya saja
  text = text.replace(/`([^`]+)`/g, '$1');
  // Gambar markdown -> buang seluruhnya (alt text tidak perlu dibaca)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Link markdown -> ambil teksnya saja, buang URL
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // URL polos -> buang
  text = text.replace(/https?:\/\/\S+/g, '');
  // Heading markdown (#, ##, dst) -> buang tanda pagar saja
  text = text.replace(/^#{1,6}\s*/gm, '');
  // Bold/italic/strikethrough markdown symbols
  text = text.replace(/[*_~]{1,3}/g, '');
  // Blockquote markers
  text = text.replace(/^>\s?/gm, '');
  // Baris tabel markdown (| --- | --- |) -> buang, sulit dibacakan natural
  text = text.replace(/^\|.*\|$/gm, '');
  text = text.replace(/^[-|: ]+$/gm, '');
  // Citation-style bracket seperti [1], [source], JSON literal { ... }
  text = text.replace(/\[\d+\]/g, '');
  text = text.replace(/\{[\s\S]{0,300}?\}/g, (m) => (m.includes('"') || m.includes(':') ? ' ' : m));
  // Emoji berlebihan -> sisakan maksimal simbol yang natural diucapkan, buang sisanya
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
  // Rapikan spasi berlebih
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

// 7b. Natural Voice TTS (OpenAI Audio Speech)
app.post('/api/voice/tts', rateLimiter, async (req: Request, res: Response) => {
  const { text, voice = 'onyx', speed = 1.05 } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Teks tidak boleh kosong.' });
  }

  const cleanText = cleanTextForSpeech(text).slice(0, 4000);
  if (!cleanText) {
    return res.status(400).json({ error: 'Teks tidak mengandung konten yang bisa diucapkan.' });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di server. Fitur suara tidak tersedia.' });
  }

  try {
    // Suara natural: onyx (pria dalam), echo (pria tegas), nova/shimmer (wanita)
    const allowedVoices = ['onyx', 'echo', 'nova', 'shimmer', 'alloy', 'fable'];
    const selectedVoice = (allowedVoices.includes(voice) ? voice : 'onyx') as any;
    const mp3 = await openai.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: selectedVoice,
      input: cleanText,
      speed: Math.max(0.75, Math.min(1.5, Number(speed) || 1.05)),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err: any) {
    console.error('TTS error:', err);
    logSystemTelemetry('error', 'voice-tts', err?.message || String(err));
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// 7c. Speech-to-Text (OpenAI Whisper Transcription)
// Alur: Microphone (frontend MediaRecorder) -> audio blob (base64) -> endpoint ini
// -> OpenAI transcription -> teks -> dikirim balik ke frontend untuk masuk ke chat.
app.post('/api/voice/transcribe', rateLimiter, async (req: Request, res: Response) => {
  const { audioBase64, mimeType = 'audio/webm', language } = req.body;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Audio tidak ditemukan dalam request.' });
  }

  const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const audioBuffer = Buffer.from(cleanBase64, 'base64');

  if (audioBuffer.length === 0) {
    return res.status(400).json({ error: 'Audio kosong atau gagal dibaca.' });
  }
  // Batas ~25MB sesuai batas file audio OpenAI
  if (audioBuffer.length > 25 * 1024 * 1024) {
    return res.status(400).json({ error: 'File audio terlalu besar. Maksimal 25MB.' });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di server. Fitur transkripsi tidak tersedia.' });
  }

  try {
    const extMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
    };
    const ext = extMap[mimeType] || 'webm';
    // OpenAI Node SDK butuh objek File-like; gunakan util toFile dari SDK.
    const { toFile } = await import('openai');
    const file = await toFile(audioBuffer, `voice-input.${ext}`, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      model: OPENAI_TRANSCRIBE_MODEL,
      file,
      language: language || undefined,
    });

    return res.json({
      success: true,
      text: transcription.text || '',
      model: OPENAI_TRANSCRIBE_MODEL,
    });
  } catch (err: any) {
    console.error('Transcription error:', err);
    logSystemTelemetry('error', 'voice-transcribe', err?.message || String(err));
    let mapped = mapOpenAIError(err);
    if (String(err?.message || '').toLowerCase().includes('unsupported')) {
      mapped = { message: 'Format audio tidak didukung. Gunakan rekaman dari mikrofon browser (webm/mp4/wav).', status: 400 };
    }
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// Fallback pencarian web non-AI (RSS/DuckDuckGo/Wikipedia) — dipakai hanya
// jika OpenAI web-search tool gagal/tidak tersedia. Ini murni pengambilan
// data publik, bukan AI provider, dan tidak pernah memanggil Gemini/Google AI.
async function searchWebFallback(query: string) {
  const result = await performLiveWebSearch(query);
  return { summary: result.summary, sources: result.sources };
}

// 8. Tools API: Web Search Grounding
// Prioritas #1: OpenAI Responses API dengan tool web_search resmi.
// Fallback (jika tool tidak tersedia di akun/plan OpenAI kamu, atau error):
// mesin pencarian non-AI lokal (Google News RSS + DuckDuckGo + Wikipedia) —
// ini bukan AI provider, murni pengambilan data publik untuk grounding teks.
app.post('/api/tools/web-search', rateLimiter, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query pencarian tidak boleh kosong.' });
  }

  let answer = '';
  let sources: Array<{ title?: string; uri?: string }> = [];
  let usedEngine = 'NEXUS Web Search (OpenAI)';

  const openai = getOpenAIClient();
  if (openai) {
    try {
      const response: any = await (openai as any).responses.create({
        model: OPENAI_CHAT_MODEL,
        tools: [{ type: 'web_search' }],
        input: `Berikan informasi terkini, akurat, dan terverifikasi mengenai: "${query}". Ringkas dan sertakan fakta-fakta penting.`,
      });

      answer = response.output_text || '';

      // Ekstrak sumber dari annotation citation di Responses API
      const outputItems = response.output || [];
      for (const item of outputItems) {
        const contentParts = item?.content || [];
        for (const part of contentParts) {
          const annotations = part?.annotations || [];
          for (const ann of annotations) {
            if (ann?.type === 'url_citation' && ann?.url) {
              if (!sources.some((s) => s.uri === ann.url)) {
                sources.push({ title: ann.title || ann.url, uri: ann.url });
              }
            }
          }
        }
      }
    } catch (openAiSearchErr: any) {
      console.warn('OpenAI web_search tool note, falling back to local engine:', openAiSearchErr?.message);
    }
  }

  // Fallback non-AI jika OpenAI web_search tidak tersedia/gagal
  if (!answer || sources.length === 0) {
    try {
      const fallback = await searchWebFallback(query);
      usedEngine = 'NEXUS Web Search (Fallback Engine)';
      if (fallback.summary) {
        answer = answer || fallback.summary;
        if (sources.length === 0) sources = fallback.sources;
      } else if (sources.length === 0) {
        answer = answer || `Hasil penelusuran fakta dan informasi untuk topik "${query}". Silakan kunjungi tautan sumber di bawah ini untuk artikel lengkap.`;
        sources = fallback.sources;
      }
    } catch (fallbackErr: any) {
      console.warn('Fallback web search error:', fallbackErr?.message);
    }
  }

  if (!answer && sources.length === 0) {
    return res.status(502).json({ error: 'Gagal melakukan pencarian web. Silakan coba lagi dalam beberapa saat.' });
  }

  res.json({
    success: true,
    answer,
    sources,
    engine: usedEngine,
  });
});

// 9. Tools API: High-Quality Image Generation (OpenAI)
app.post('/api/tools/generate-image', rateLimiter, async (req, res) => {
  const { prompt, size = '1024x1024', imageSize = '1K', aspectRatio = '1:1' } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt gambar tidak boleh kosong.' });
  }

  try {
    const result = await generateAiImageHelper(prompt, aspectRatio, imageSize);
    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      model: result.model,
      imageSize,
      aspectRatio,
    });
  } catch (err: any) {
    console.error('Image generation error:', err);
    logSystemTelemetry('error', 'generate-image', err?.message || String(err));
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// 9b. Tools API: Interactive Image Editing (OpenAI Images Edit — gpt-image-1)
app.post('/api/tools/edit-image', rateLimiter, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', prompt, imageSize = '1K' } = req.body;
  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Gambar referensi dan instruksi edit tidak boleh kosong.' });
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di server.' });
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const imageBuffer = Buffer.from(cleanBase64, 'base64');

  try {
    const { toFile } = await import('openai');
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = extMap[mimeType] || 'png';
    const file = await toFile(imageBuffer, `source.${ext}`, { type: mimeType });

    const response = await openai.images.edit({
      model: OPENAI_IMAGE_EDIT_MODEL,
      image: file,
      prompt: `Edit dan modifikasi gambar ini sesuai instruksi berikut, pertahankan elemen lain yang tidak disebutkan: ${prompt}`,
    });

    const imageData = response.data?.[0];
    const resultUrl = imageData?.url
      ? imageData.url
      : imageData?.b64_json
        ? `data:image/png;base64,${imageData.b64_json}`
        : null;

    if (!resultUrl) {
      throw new Error('OpenAI tidak mengembalikan hasil edit gambar.');
    }

    return res.json({
      success: true,
      imageUrl: resultUrl,
      revisedPrompt: `Hasil pengeditan gambar: "${prompt}"`,
      model: `NEXUS Image Editor (${OPENAI_IMAGE_EDIT_MODEL})`,
      imageSize,
    });
  } catch (err: any) {
    console.error('Image edit error:', err);
    logSystemTelemetry('error', 'edit-image', err?.message || String(err));
    const mapped = mapOpenAIError(err);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// 9c. Tools API: Face Swap — dijalankan lewat microservice terpisah
// (lihat folder /faceswap-service) karena butuh model computer vision
// khusus (InsightFace + GFPGAN) yang bukan bagian dari OpenAI API.
// Backend ini HANYA meneruskan (proxy) request ke microservice tersebut;
// tidak pernah menyimpan foto secara permanen.
app.post('/api/tools/face-swap', rateLimiter, async (req, res) => {
  const { sourceImageBase64, targetImageBase64, enhanceStrength = 0.6 } = req.body;

  if (!sourceImageBase64 || !targetImageBase64) {
    return res.status(400).json({ error: 'Foto sumber dan foto target wajib diunggah.' });
  }

  if (!FACE_SWAP_SERVICE_URL) {
    return res.status(503).json({
      error: 'Fitur Face Swap belum dikonfigurasi. Deploy /faceswap-service (lihat README-nya) lalu set FACE_SWAP_SERVICE_URL di secret server.',
      configured: false,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const upstream = await fetch(`${FACE_SWAP_SERVICE_URL.replace(/\/$/, '')}/api/face-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceImageBase64, targetImageBase64, enhanceStrength }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data: any = await upstream.json().catch(() => null);

    if (!upstream.ok || !data?.success) {
      return res.status(upstream.status || 502).json({
        error: data?.error || 'Gagal memproses face swap pada layanan eksternal.',
      });
    }

    return res.json({
      success: true,
      imageUrl: data.imageUrl,
      model: 'NEXUS Face Studio (InsightFace + GFPGAN)',
    });
  } catch (err: any) {
    console.error('Face swap proxy error:', err);
    logSystemTelemetry('error', 'face-swap', err?.message || String(err));
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Layanan Face Swap timeout. Coba lagi dengan foto yang lebih kecil.' });
    }
    return res.status(502).json({ error: 'Tidak dapat terhubung ke layanan Face Swap. Periksa FACE_SWAP_SERVICE_URL.' });
  }
});

// 10. Admin Panel APIs
app.get('/api/admin/stats', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = db.users.find((u) => u.id === userId);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Memerlukan hak akses administrator.' });
  }

  const totalTokens = db.users.reduce((acc, u) => acc + (u.totalTokensUsed || 0), 0);
  const totalRequests = db.users.reduce((acc, u) => acc + (u.totalRequests || 0), 0);
  const totalMessages = db.conversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

  res.json({
    totalUsers: db.users.length,
    activeUsers: db.users.filter((u) => u.isActive).length,
    totalConversations: db.conversations.length,
    totalMessages,
    totalRequests,
    totalTokensEstimate: totalTokens,
    serverUptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    backendProvider: 'OpenAI',
    defaultModel: db.settings.defaultModel,
    maxRateLimitPerMin: db.settings.maxRateLimitPerMin,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    faceSwapConfigured: !!FACE_SWAP_SERVICE_URL,
    supabaseConfigured: !!process.env.SUPABASE_URL,
    announcement: db.settings.announcement,
    errorLogsCount: (db.errorLogs || []).length,
    recentErrors: (db.errorLogs || []).slice(0, 10),
  });
});

// Admin Log Ingestion & Querying API
app.post('/api/admin/logs/error', (req, res) => {
  const { logs, log } = req.body;
  if (!db.errorLogs) db.errorLogs = [];

  const newEntries: Array<any> = Array.isArray(logs) ? logs : log ? [log] : [];

  for (const entry of newEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const level: 'error' | 'warn' | 'info' =
      entry.level === 'error' ? 'error' : entry.level === 'info' ? 'info' : 'warn';
    const cleanEntry = {
      id: entry.id || `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: entry.timestamp || Date.now(),
      level,
      context: String(entry.context || 'general').slice(0, 80),
      message: String(entry.message || 'Unknown error').slice(0, 500),
      userId: entry.userId ? String(entry.userId).slice(0, 32) : undefined,
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : undefined,
    };
    db.errorLogs.unshift(cleanEntry);
  }

  // Keep max 150 entries in log ring buffer
  if (db.errorLogs.length > 150) {
    db.errorLogs = db.errorLogs.slice(0, 150);
  }

  saveDB();
  res.json({ success: true, count: db.errorLogs.length });
});

app.get('/api/admin/logs', (req, res) => {
  const adminId = req.headers['x-user-id'] as string;
  const admin = db.users.find((u) => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  res.json({
    success: true,
    errorLogs: db.errorLogs || [],
  });
});

app.delete('/api/admin/logs', (req, res) => {
  const adminId = req.headers['x-user-id'] as string;
  const admin = db.users.find((u) => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  db.errorLogs = [];
  saveDB();

  res.json({ success: true, message: 'Log error berhasil dikosongkan.' });
});

// Autonomous Co-Pilot Self-Healing Health & Repair Endpoint
app.post('/api/admin/copilot/diagnose', async (req, res) => {
  const adminId = req.headers['x-user-id'] as string;
  const admin = db.users.find((u) => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { issueContext = 'System Full Health Check', issueMessage = 'Routine self-diagnostic scan' } = req.body;

  try {
    const healingResult = await performAutonomousSelfHealing(issueContext, issueMessage);
    
    // Auto cleanup corrupted or orphaned conversations / users if any
    let fixedItemsCount = 0;
    if (Array.isArray(db.conversations)) {
      const initialCount = db.conversations.length;
      db.conversations = db.conversations.filter(c => c && c.id && c.userId);
      fixedItemsCount += (initialCount - db.conversations.length);
    }
    if (Array.isArray(db.users)) {
      const initialUsers = db.users.length;
      db.users = db.users.filter(u => u && u.id && u.username);
      fixedItemsCount += (initialUsers - db.users.length);
    }

    if (fixedItemsCount > 0) {
      saveDB();
    }

    res.json({
      success: true,
      copilot: {
        status: 'online',
        role: 'NEXUS Autonomous Co-Pilot Developer',
        diagnostic: healingResult || {
          diagnosis: 'Sistem arsitektur backend, rute API, dan model AI berada dalam status prima.',
          severity: 'low',
          autoFixAction: 'Pembersihan otomatis cache & validasi integritas database selesai.',
          healthStatus: 'healed'
        },
        databaseSanitized: true,
        repairedEntitiesCount: fixedItemsCount,
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal menjalankan diagnosa Co-Pilot: ' + err.message });
  }
});

app.get('/api/admin/users', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const user = db.users.find((u) => u.id === userId);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  res.json({
    users: db.users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      totalTokensUsed: u.totalTokensUsed || 0,
      totalRequests: u.totalRequests || 0,
      lastActive: u.lastActive || u.createdAt,
    })),
  });
});

app.post('/api/admin/users/:id/toggle', (req, res) => {
  const adminId = req.headers['x-user-id'] as string;
  const admin = db.users.find((u) => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { id } = req.params;
  const targetUser = db.users.find((u) => u.id === id);

  if (!targetUser) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  if (targetUser.id === admin.id) {
    return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun sendiri.' });
  }

  targetUser.isActive = !targetUser.isActive;
  saveDB();

  res.json({
    success: true,
    user: {
      id: targetUser.id,
      username: targetUser.username,
      isActive: targetUser.isActive,
    },
  });
});

app.post('/api/admin/settings', (req, res) => {
  const adminId = req.headers['x-user-id'] as string;
  const admin = db.users.find((u) => u.id === adminId);

  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak.' });
  }

  const { defaultModel, maxRateLimitPerMin, announcement, allowRegistration } = req.body;

  if (defaultModel !== undefined) db.settings.defaultModel = defaultModel;
  if (maxRateLimitPerMin !== undefined) db.settings.maxRateLimitPerMin = Number(maxRateLimitPerMin);
  if (announcement !== undefined) db.settings.announcement = announcement;
  if (allowRegistration !== undefined) db.settings.allowRegistration = !!allowRegistration;

  saveDB();
  res.json({ success: true, settings: db.settings });
});

// ---------------------------------------------------------------------------
// Vite & Static Asset Handling
// ---------------------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXUS AI Server] running on http://0.0.0.0:${PORT}`);
  });
}

start();
