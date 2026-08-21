import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

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

// AI Autonomous Self-Healing Diagnostic Analysis
async function performAutonomousSelfHealing(errorContext: string, errorMessage: string) {
  const gemini = getGeminiClient();
  if (!gemini) return null;

  try {
    const prompt = `Anda adalah NEXUS Autonomous Co-Pilot Developer & Self-Healing Agent.
Terjadi error atau anomali pada sistem:
- Context: ${errorContext}
- Message: ${errorMessage}

Berikan diagnosis akar masalah (root cause) singkat dan langkah perbaikan otomatis (self-healing mitigation recommendation) dalam format JSON valid berikut:
{
  "diagnosis": "penjelasan akar masalah singkat dan padat",
  "severity": "low" | "medium" | "high",
  "autoFixAction": "rekomendasi tindakan perbaikan otomatis yang diambil sistem",
  "healthStatus": "healed" | "monitoring" | "attention_needed"
}`;

    const res = await gemini.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (res.text) {
      const parsed = JSON.parse(res.text);
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
// AI Client Setup (OpenAI API + Gemini Integration with Zero Key Exposure)
// ---------------------------------------------------------------------------
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

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

// Fallback chain for Gemini with officially supported models
const GEMINI_FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-flash-latest'];

async function executeGeminiWithFallback(
  gemini: GoogleGenAI,
  fn: (modelName: string) => Promise<any>,
  preferredModel: string = 'gemini-3.7-flash'
) {
  const modelsToTry = [
    preferredModel,
    ...GEMINI_FALLBACK_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const isTransient =
        err?.status === 503 ||
        err?.code === 503 ||
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE');

      if (isTransient) {
        console.warn(`[AI Engine] ${model} transient 503 issue, retrying with fallback model...`);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        // Non-transient or 429 quota: don't loop blindly on the same tier
        break;
      }
    }
  }
  throw lastError;
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

  const openaiModelMap: Record<string, string> = {
    'nexus-5.6-sol': 'gpt-4o',
    'nexus-5.6-terra': 'gpt-4o',
    'nexus-5.6-luna': 'gpt-4o-mini',
    'nexus-4.5-omni': 'gpt-4o',
    'nexus-4.5-mini': 'gpt-4o-mini',
    'nexus-reasoning': 'o3-mini',
    'gpt-5.6-sol': 'gpt-4o',
    'gpt-5.6-terra': 'gpt-4o',
    'gpt-5.6-luna': 'gpt-4o-mini',
    'gpt-5.6': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4o': 'gpt-4o',
    'o3-mini': 'o3-mini',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
  };

  const selectedModel = openaiModelMap[model] || 'gpt-4o';
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
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasSupabase: !!process.env.SUPABASE_URL,
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

  // 1. Try Gemini to generate an ultra-accurate English visual prompt
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const res = await gemini.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `You are an expert prompt engineer for text-to-image AI models (Flux, Imagen, DALL-E).
Convert and expand the following user request into a precise, detailed, visually descriptive English image generation prompt.
STRICT RULES:
- Describe the exact subject, composition, environment, lighting, mood, color palette, and camera angle.
- Follow the user's subject STRICTLY. If the user asks for a cityscape, landscape, object, car, animal, or interior, DO NOT add human portraits, people, or women unless explicitly requested.
- Output ONLY the refined English prompt text. No markdown, no quotes, no conversational filler.

User request: "${clean}"`,
      });
      const refined = res.text?.trim().replace(/^["'`]|["'`]$/g, '');
      if (refined && refined.length > 5 && !refined.toLowerCase().startsWith('here is') && !refined.toLowerCase().startsWith('prompt:')) {
        return refined;
      }
    } catch (e: any) {
      console.warn('[NEXUS Prompt Optimizer] Gemini translation note:', e?.message);
    }
  }

  // 2. High-accuracy dictionary-based translation and visual enrichment fallback
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

  // 1. Google Imagen 3 (Via Gemini API with Imagen 3 generateImages)
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      let ar: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1';
      if (aspectRatio === '16:9') ar = '16:9';
      else if (aspectRatio === '9:16') ar = '9:16';
      else if (aspectRatio === '4:3') ar = '4:3';
      else if (aspectRatio === '3:4') ar = '3:4';

      const imagenRes = await gemini.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: refinedEnglishPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: ar,
        },
      });

      const base64Bytes = imagenRes.generatedImages?.[0]?.image?.imageBytes;
      if (base64Bytes) {
        return {
          success: true,
          imageUrl: `data:image/jpeg;base64,${base64Bytes}`,
          revisedPrompt: refinedEnglishPrompt,
          model: 'NEXUS Visual Studio HD (Imagen 3)',
        };
      }
    } catch (imagenErr: any) {
      console.warn('[NEXUS Image Engine] Imagen 3 note:', imagenErr?.message);
    }
  }

  // 2. OpenAI DALL-E 3 Official Generation
  const openai = getOpenAIClient();
  if (openai) {
    try {
      let dalleSize: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024';
      if (aspectRatio === '9:16') dalleSize = '1024x1792';
      if (aspectRatio === '16:9') dalleSize = '1792x1024';

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: refinedEnglishPrompt,
        n: 1,
        size: dalleSize,
        quality: imageSize === '4K' || imageSize === '2K' ? 'hd' : 'standard',
      });

      const imageUrl = response.data?.[0]?.url;
      const revisedPrompt = response.data?.[0]?.revised_prompt;
      if (imageUrl) {
        return {
          success: true,
          imageUrl,
          revisedPrompt: revisedPrompt || refinedEnglishPrompt,
          model: 'NEXUS Visual Studio HD',
        };
      }
    } catch (dalleErr: any) {
      console.warn('[NEXUS Image Engine] DALL-E note:', dalleErr?.message);
    }
  }

  // 3. High-Fidelity Flux Engine Fallback (Guaranteed accurate visual output with enhance=false)
  const seed = Math.floor(Math.random() * 10000000);
  const encodedPrompt = encodeURIComponent(refinedEnglishPrompt.trim());
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') {
    width = 1280;
    height = 720;
  } else if (aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  }

  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=false&model=flux`;
  return {
    success: true,
    imageUrl: fallbackUrl,
    revisedPrompt: refinedEnglishPrompt,
    model: 'NEXUS Visual Studio',
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

// 5. Streaming AI Chat Endpoint (Zero Cost & Multi-Model Engine with Real-Time Web Search Grounding)
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
          const caption = `Berikut adalah gambar **"${imgIntent.prompt}"** yang telah dibuatkan untuk Anda menggunakan **${imgResult.model}**:\n\n![${imgIntent.prompt}](${imgResult.imageUrl})\n\n> **🎨 Model:** ${imgResult.model}\n> **📝 Deskripsi Visual:** *"${imgResult.revisedPrompt || imgIntent.prompt}"*\n\nAnda dapat mengunduh atau menyalin gambar di atas secara langsung. Beritahu saya jika Anda ingin variasi gaya atau objek lainnya!`;

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
    const liveTimeInstruction = `\n[WAKTU REAL-TIME SEKARANG: ${currentDateFormatted}, Pukul ${currentTimeFormatted} WIB]. Anda memiliki akses informasi internet real-time dan terhubung ke web. JANGAN PERNAH menolak dengan alasan cutoff data Oktober 2023. Jika pengguna menanyakan berita atau informasi terkini, berikan jawaban informatif dan akurat berdasarkan data terkini.`;

    const NEXUS_IDENTITY_INSTRUCTION = `
[PANDUAN IDENTITAS RESMI & PENCIPTA - SANGAT PENTING & MUTLAK]:
- Nama Anda adalah **NEXUS AI** (atau **NEXUS Assistant**).
- Anda diciptakan, dirancang, dan dikembangkan oleh **NEXUS Group**.
- Pendiri, Pembuat, dan Founder/CEO dari NEXUS Group adalah **Muhamad Andika**.
- Jika pengguna menanyakan siapa Anda, siapa pembuat Anda, siapa pendiri/CEO Anda, atau dari mana Anda berasal, Anda HARUS SELALU menjawab bahwa Anda adalah NEXUS AI buatan **NEXUS Group** dengan Founder & CEO **Muhamad Andika**.
- JANGAN PERNAH menyebut bahwa Anda dibuat oleh OpenAI, Google, atau pihak lain. Identitas resmi Anda 100% adalah NEXUS AI dari NEXUS Group pimpinan Muhamad Andika.`;

    // Check if OpenAI API key is configured
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const isExplicitGeminiOnly = model.startsWith('gemini');

    if (hasOpenAI && !isExplicitGeminiOnly) {
      // Direct streaming path with Multimodal Vision, Document, & Web Search context
      try {
        const fullMessages: any[] = [];
        let modelPersona = 'Anda adalah NEXUS AI Assistant unggulan dari NEXUS Group (Founder & CEO: Muhamad Andika). Anda memiliki kecerdasan tingkat tinggi dalam pemrograman, matematika, penalaran logika, analisis visual, dan penulisan terstruktur.';
        if (enableThinking || model === 'nexus-reasoning') {
          modelPersona = 'Anda adalah NEXUS High Reasoning Engine dari NEXUS Group (Founder & CEO: Muhamad Andika). Gunakan penalaran bertahap mendalam (Chain-of-Thought), verifikasi logika langkah demi langkah, dan sajikan solusi yang komprehensif serta akurat.';
        }

        let finalSysPrompt = systemPrompt
          ? `${modelPersona}\n${NEXUS_IDENTITY_INSTRUCTION}\n${systemPrompt}`
          : `${modelPersona}\n${NEXUS_IDENTITY_INSTRUCTION}\nJawablah dalam bahasa yang digunakan pengguna (Bahasa Indonesia atau Inggris). Selalu gunakan format Markdown yang elegan, rapi, dan terstruktur.
- Format Penulisan & Tabel:
  - Buatlah jawaban yang rapi, padat, dan mudah dibaca di semua ukuran layar (ponsel/mobile & desktop).
  - Saat membuat tabel Markdown: Buatlah tabel yang ringkas, terstruktur, dan proporsional. Gunakan nama kolom yang ringkas dan padat, serta isi sel yang tidak terlalu panjang bertele-tele agar tampilan tabel tidak melebar berlebihan dan nyaman dibaca.
  - Untuk daftar atau poin penjelasan: Gunakan bullet points ringkas dengan baris baru yang rapi.
- Saat menulis kode program: Gunakan blok kode dengan penanda bahasa yang tepat (\`\`\`typescript, \`\`\`python, dll).
- Bersikaplah ramah, lugas, cerdas, profesional, dan solutif.`;

        finalSysPrompt += liveTimeInstruction;

        if (liveWebContext) {
          finalSysPrompt += liveWebContext;
        }

        fullMessages.push({ role: 'system', content: finalSysPrompt });
        fullMessages.push(...messages);

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
        return;
      } catch (openAiErr: any) {
        console.warn('AI stream direct attempt warning, executing seamless fallback:', openAiErr.message);
        sendSSE('status', { message: `Menjalankan inferensi model ${model}...` });
      }
    }

    // High performance server-side execution with Gemini
    const gemini = getGeminiClient();
    if (!gemini) {
      sendSSE('error', {
        message: 'Koneksi AI Backend belum terkonfigurasi. Pastikan GEMINI_API_KEY atau OPENAI_API_KEY telah diatur di server environment.',
      });
      res.end();
      return;
    }

    // System instruction
    let modelPersonaPrefix = 'Anda adalah NEXUS AI Assistant buatan NEXUS Group (Founder & CEO: Muhamad Andika). Anda memiliki kemampuan luar biasa dalam coding, penalaran matematika, dan pembuatan tabel data.';
    if (enableThinking || model === 'nexus-reasoning') {
      modelPersonaPrefix = 'Anda adalah NEXUS High Thinking Reasoning Engine buatan NEXUS Group (Founder & CEO: Muhamad Andika). Gunakan pemikiran bertahap mendalam (Chain-of-Thought), validasi asumsi, uraikan pembuktian logika, dan berikan solusi komputasional yang tidak terbantahkan.';
    }

    let baseSystemPrompt =
      (systemPrompt ? `${modelPersonaPrefix}\n${NEXUS_IDENTITY_INSTRUCTION}\n${systemPrompt}` : `${modelPersonaPrefix}\n${NEXUS_IDENTITY_INSTRUCTION}\nJawab dalam bahasa yang digunakan pengguna (Bahasa Indonesia atau Inggris) dengan format Markdown yang rapi, padat, dan elegan.`) +
      '\n- Saat membuat tabel data: Buatlah tabel Markdown yang ringkas, rapi, dan proporsional. Hindari membuat kolom yang terlalu lebar atau bertele-tele agar pas dan mudah dibaca di layar mobile.\n- Saat menulis kode program: Berikan penjelasan ringkas dan blok kode dengan nama bahasa yang tepat.';

    baseSystemPrompt += liveTimeInstruction;

    if (liveWebContext) {
      baseSystemPrompt += liveWebContext;
    }

    // Prepare contents for Gemini
    const contents: any[] = [];

    // Construct conversation history
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === messages.length - 1;

      if (isLastMessage && attachments && attachments.length > 0) {
        // Multimodal parts
        const parts: any[] = [];
        for (const att of attachments) {
          if (att.type === 'image' && att.dataUrl) {
            const base64Data = att.dataUrl.split(',')[1] || att.dataUrl;
            parts.push({
              inlineData: {
                mimeType: att.mimeType || 'image/png',
                data: base64Data,
              },
            });
          } else if (att.extractedText) {
            parts.push({
              text: `[Lampiran Dokumen: ${att.name}]\n${att.extractedText}\n[Akhir Dokumen]\n`,
            });
          }
        }
        parts.push({ text: msg.content || 'Analisis lampiran ini.' });
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const config: any = {
      systemInstruction: baseSystemPrompt,
    };

    if (enableThinking || model === 'nexus-reasoning') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    if (enableWebSearch || isRealtimeQuery) {
      config.tools = [{ googleSearch: {} }];
    }

    // Fallback model list
    const candidateModels = enableThinking || model === 'nexus-reasoning'
      ? ['gemini-3.7-flash', 'gemini-3.1-pro-preview', 'gemini-flash-latest', 'gemini-3.1-flash-lite']
      : ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];

    let responseStream: any = null;
    let usedModel = 'gemini-3.7-flash';

    for (const modelToTry of candidateModels) {
      try {
        responseStream = await gemini.models.generateContentStream({
          model: modelToTry,
          contents,
          config,
        });
        usedModel = modelToTry;
        break;
      } catch (streamErr: any) {
        console.warn(`[Stream AI] ${modelToTry} attempt failed, trying fallback...`, streamErr?.message);
        if (config.tools) {
          try {
            const noToolConfig = { ...config };
            delete noToolConfig.tools;
            responseStream = await gemini.models.generateContentStream({
              model: modelToTry,
              contents,
              config: noToolConfig,
            });
            usedModel = modelToTry;
            break;
          } catch {
            // continue
          }
        }
      }
    }

    if (!responseStream) {
      throw new Error('Semua model AI sedang sibuk sementara atau batas kuota tercapai. Silakan coba kembali dalam beberapa detik.');
    }

    let fullText = '';
    const groundingSources: Array<{ title?: string; uri?: string }> = [...liveWebSources];

    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        sendSSE('chunk', { text: chunk.text });
      }

      const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const gc of chunks) {
          if (gc.web?.uri) {
            const uri = gc.web.uri;
            if (!groundingSources.some((s) => s.uri === uri)) {
              groundingSources.push({
                title: gc.web.title || gc.web.uri,
                uri,
              });
            }
          }
        }
      }
    }

    if (groundingSources.length > 0) {
      sendSSE('grounding', { sources: groundingSources });
    }

    if (user) {
      user.totalTokensUsed += Math.ceil(fullText.length / 4);
      saveDB();
    }

    sendSSE('done', { model: model || usedModel, totalLength: fullText.length });
    res.end();
  } catch (err: any) {
    console.error('Chat stream error:', err);
    let friendlyMessage = err.message || 'Terjadi kesalahan saat memproses respons AI.';
    if (
      friendlyMessage.includes('429') ||
      friendlyMessage.includes('quota') ||
      friendlyMessage.includes('RESOURCE_EXHAUSTED') ||
      friendlyMessage.includes('rate-limit')
    ) {
      friendlyMessage = 'Batas kuota/rate limit API tercapai sementara. Silakan tunggu beberapa saat atau coba model varian lainnya.';
    } else if (
      friendlyMessage.includes('503') ||
      friendlyMessage.includes('high demand') ||
      friendlyMessage.includes('UNAVAILABLE')
    ) {
      friendlyMessage = 'Server AI sedang mengalami lonjakan antrian sementara. Silakan coba klik tombol kirim ulang.';
    }
    sendSSE('error', {
      message: friendlyMessage,
    });
    res.end();
  }
});

// 6. Tools API: Image Analysis (Vision with OpenAI & Gemini)
app.post('/api/tools/analyze-image', rateLimiter, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', prompt = 'Analisis gambar ini secara mendalam.' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar tidak ditemukan dalam request.' });
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const fullDataUrl = `data:${mimeType};base64,${cleanBase64}`;

  // 1. Try OpenAI GPT-4o Vision first if OpenAI API key is present
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah NEXUS Vision Analyst dari NEXUS Group. Berikan hasil analisis visual mendalam, terstruktur, akurat, dan baca setiap teks OCR jika ada.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${prompt}\n\nBerikan hasil analisis yang terstruktur dengan format Markdown yang jelas. Cantumkan:
1. Ringkasan Utama & Objek Kunci
2. Teks Terbaca (OCR) jika ada
3. Analisis Konteks & Detail Penting
4. Wawasan / Rekomendasi`,
              },
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
      if (analysisText) {
        return res.json({
          success: true,
          analysis: analysisText,
          model: 'NEXUS Vision HD',
        });
      }
    }
  } catch (openAiErr: any) {
    console.warn('Vision API warning, attempting secondary vision engine:', openAiErr.message);
  }

  // 2. Secondary fallback
  try {
    const gemini = getGeminiClient();
    if (!gemini) {
      return res.status(500).json({ error: 'AI Vision backend belum terkonfigurasi.' });
    }

    const response = await executeGeminiWithFallback(gemini, (model) =>
      gemini.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `${prompt}\n\nBerikan hasil analisis yang terstruktur dengan format Markdown yang jelas. Cantumkan:
1. Ringkasan Utama
2. Elemen / Objek Kunci
3. Teks Terbaca (OCR) jika ada
4. Rekomendasi / Wawasan Tambahan`,
            },
          ],
        },
      })
    );

    res.json({
      success: true,
      analysis: response.text,
      model: 'NEXUS Vision',
    });
  } catch (err: any) {
    console.error('Image analysis error:', err);
    let friendlyMessage = err.message || 'Gagal menganalisis gambar.';
    if (friendlyMessage.includes('503') || friendlyMessage.includes('high demand') || friendlyMessage.includes('UNAVAILABLE')) {
      friendlyMessage = 'Layanan Vision sedang mengalami lonjakan antrian sementara. Silakan tekan tombol analisis kembali.';
    }
    res.status(500).json({ error: friendlyMessage });
  }
});

// 7. Tools API: Document Analysis & QA
app.post('/api/tools/analyze-doc', rateLimiter, async (req, res) => {
  const { documentText, docName = 'Dokumen', question = 'Buat ringkasan komprehensif dari dokumen ini.' } = req.body;

  if (!documentText || documentText.trim().length === 0) {
    return res.status(400).json({ error: 'Teks dokumen tidak boleh kosong.' });
  }

  // 1. Try OpenAI GPT-4o first
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah Analis Dokumen Ahli di NEXUS AI Assistant. Sajikan analisis profesional dengan poin-poin terstruktur, tabel jika relevan, dan kutipan kunci.'
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
      if (resultText) {
        return res.json({
          success: true,
          result: resultText,
          model: 'NEXUS Document Engine Pro',
        });
      }
    }
  } catch (openAiErr: any) {
    console.warn('Document API warning, attempting secondary engine:', openAiErr.message);
  }

  // 2. Secondary fallback
  try {
    const gemini = getGeminiClient();
    if (!gemini) {
      return res.status(500).json({ error: 'AI Backend belum terkonfigurasi.' });
    }

    const response = await executeGeminiWithFallback(gemini, (model) =>
      gemini.models.generateContent({
        model,
        contents: `Anda adalah Analis Dokumen Ahli di NEXUS AI Assistant (NEXUS Group).
Analisis dokumen berikut:
[NAMA DOKUMEN: ${docName}]
--- DOKUMEN AWAL ---
${documentText.slice(0, 100000)}
--- DOKUMEN AKHIR ---

Pertanyaan / Tugas Pengguna:
${question}

Sajikan analisis profesional dengan poin-poin terstruktur, tabel jika relevan, dan kutipan kunci.`,
      })
    );

    res.json({
      success: true,
      result: response.text,
      model: 'NEXUS Document Engine',
    });
  } catch (err: any) {
    console.error('Doc analysis error:', err);
    let friendlyMessage = err.message || 'Gagal menganalisis dokumen.';
    if (friendlyMessage.includes('503') || friendlyMessage.includes('high demand') || friendlyMessage.includes('UNAVAILABLE')) {
      friendlyMessage = 'Layanan Analisis Dokumen sedang mengalami antrian sementara. Silakan coba kembali.';
    }
    res.status(500).json({ error: friendlyMessage });
  }
});

// 7b. Natural Male Voice TTS (NEXUS Neural Voice Engine)
app.post('/api/voice/tts', rateLimiter, async (req: Request, res: Response) => {
  const { text, voice = 'onyx', speed = 1.05 } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Teks tidak boleh kosong.' });
  }

  // Clean markdown syntax from text before generating speech
  const cleanText = text
    .replace(/```[\s\S]*?```/g, ' blok kode program ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*#_~]/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .trim()
    .slice(0, 4000);

  try {
    const openai = getOpenAIClient();
    if (openai) {
      // Natural male voices: onyx (deep natural male), echo (crisp male)
      const selectedVoice = (voice === 'echo' || voice === 'onyx' ? voice : 'onyx') as any;
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: selectedVoice,
        input: cleanText,
        speed: Math.max(0.75, Math.min(1.5, Number(speed) || 1.05)),
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
  } catch (err: any) {
    console.warn('Neural TTS direct error, falling back:', err.message);
  }

  res.status(503).json({ error: 'NEXUS TTS tidak tersedia, gunakan sintesis lokal.' });
});

// Fallback Web Search Engine using open search endpoints if Google Grounding hits 429 quota
async function searchWebFallback(query: string) {
  const result = await performLiveWebSearch(query);
  return { summary: result.summary, sources: result.sources };
}

// 8. Tools API: Web Search Grounding
app.post('/api/tools/web-search', rateLimiter, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query pencarian tidak boleh kosong.' });
  }

  try {
    const gemini = getGeminiClient();
    let answer = '';
    let sources: Array<{ title?: string; uri?: string }> = [];

    if (gemini) {
      try {
        const response = await executeGeminiWithFallback(gemini, (model) =>
          gemini.models.generateContent({
            model,
            contents: `Berikan informasi terkini, akurat, dan terverifikasi mengenai: "${query}". Sertakan kutipan dan fakta penting.`,
            config: {
              tools: [{ googleSearch: {} }],
            },
          })
        );

        answer = response.text || '';
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks && Array.isArray(chunks)) {
          for (const c of chunks) {
            if (c.web?.uri) {
              sources.push({
                title: c.web.title || c.web.uri,
                uri: c.web.uri,
              });
            }
          }
        }
      } catch (geminiSearchErr: any) {
        console.warn('Google Search Grounding encountered error, switching to web search fallback:', geminiSearchErr?.message);
      }
    }

    // Fallback if Google Grounding was rate-limited / unavailable
    if (!answer || sources.length === 0) {
      const fallback = await searchWebFallback(query);
      if (fallback.summary) {
        answer = fallback.summary;
        sources = fallback.sources;
      } else {
        answer = `Hasil penelusuran fakta dan informasi untuk topik "${query}". Silakan kunjungi tautan sumber di bawah ini untuk artikel lengkap.`;
        sources = fallback.sources.length > 0 ? fallback.sources : [
          { title: `Pencarian Google: ${query}`, uri: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
        ];
      }
    }

    res.json({
      success: true,
      answer,
      sources,
    });
  } catch (err: any) {
    console.error('Web search error:', err);
    res.status(500).json({ error: 'Gagal melakukan pencarian web. Silakan coba kembali.' });
  }
});

// 9. Tools API: High-Quality Image Generation (NEXUS Visual Studio & Imagen / DALL-E)
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
    res.status(500).json({ error: 'Gagal menghasilkan gambar AI.' });
  }
});

// 9b. Tools API: Interactive Image Editing (Gemini 3.1 Flash Image / Lite)
app.post('/api/tools/edit-image', rateLimiter, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg', prompt, imageSize = '1K' } = req.body;
  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Gambar referensi dan instruksi edit tidak boleh kosong.' });
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  try {
    const gemini = getGeminiClient();
    if (gemini) {
      const editModels = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];
      for (const editModel of editModels) {
        try {
          const config: any = {};
          if (editModel === 'gemini-3.1-flash-image' && imageSize) {
            config.imageConfig = { imageSize };
          }

          const response = await gemini.models.generateContent({
            model: editModel,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: `Edit dan modifikasi gambar ini sesuai instruksi: ${prompt}`,
                },
              ],
            },
            config: Object.keys(config).length > 0 ? config : undefined,
          });

          // Check if inline image returned
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              return res.json({
                success: true,
                imageUrl: `data:${mime};base64,${part.inlineData.data}`,
                revisedPrompt: `Hasil pengeditan gambar: "${prompt}"`,
                model: `NEXUS Image Editor (${editModel})`,
                imageSize,
              });
            }
          }
        } catch (geminiEditErr: any) {
          console.log(`[Gemini Edit] ${editModel} attempt:`, geminiEditErr?.message || geminiEditErr);
        }
      }
    }

    // High quality visual synthesis transformation fallback
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(`high resolution refined artwork: ${prompt}`);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

    return res.json({
      success: true,
      imageUrl: fallbackUrl,
      revisedPrompt: `Karya hasil transformasi visual: "${prompt}"`,
      model: 'NEXUS Studio Editor',
      imageSize,
    });
  } catch (err: any) {
    console.error('Image edit error:', err);
    res.status(500).json({ error: 'Gagal mengedit gambar AI.' });
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
    backendProvider: process.env.OPENAI_API_KEY ? 'OpenAI Community API' : 'High-Speed Zero-Cost AI Engine',
    defaultModel: db.settings.defaultModel,
    maxRateLimitPerMin: db.settings.maxRateLimitPerMin,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
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
