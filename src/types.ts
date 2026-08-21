export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
  totalTokensUsed: number;
  totalRequests: number;
  lastActive: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'audio';
  mimeType: string;
  size: number;
  dataUrl?: string; // base64 representation
  extractedText?: string;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  model?: string;
  groundingSources?: GroundingSource[];
  sources?: GroundingSource[];
  isStreaming?: boolean;
  tokensUsed?: number;
  error?: string;
  liked?: boolean;
  disliked?: boolean;
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  pinned?: boolean;
  model: string;
  systemPrompt?: string;
  customGptId?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Gemini' | 'Community';
  description: string;
  contextWindow: string;
  speed: 'Ultra Fast' | 'Fast' | 'Balanced' | 'High Reasoning';
  isDefault?: boolean;
  badge?: string;
  supportsVision?: boolean;
  supportsWebSearch?: boolean;
}

export interface VoiceSettings {
  enabled: boolean;
  autoSpeak: boolean;
  voiceName: string;
  rate: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 1.5
  volume: number; // 0 - 1
  language: string; // 'id-ID' | 'en-US'
  gender?: 'male' | 'female';
}

export interface CustomInstructions {
  enabled: boolean;
  aboutUser: string;
  howToRespond: string;
}

export interface AppSettings {
  defaultModel: string;
  theme: 'dark' | 'light' | 'system';
  voice: VoiceSettings;
  maxTokensPerRequest: number;
  streamResponse: boolean;
  systemPrompt: string;
  customInstructions: CustomInstructions;
  customBackendUrl?: string;
}

export interface CustomGPT {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'Programming' | 'Writing' | 'Productivity' | 'Analysis' | 'Creative' | 'Education';
  icon: string;
  badge?: string;
  systemPrompt: string;
  starterPrompts: string[];
}

export interface CanvasDocument {
  id?: string;
  title: string;
  content: string;
  language?: string;
  isCode: boolean;
  updatedAt?: number;
  lastModified?: number;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  level: 'warn' | 'error' | 'info';
  context: string;
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalRequests: number;
  totalTokensEstimate: number;
  serverUptimeSeconds: number;
  backendProvider: string;
  defaultModel: string;
  maxRateLimitPerMin: number;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  supabaseConfigured: boolean;
  announcement?: string;
  errorLogsCount?: number;
  recentErrors?: ErrorLogEntry[];
}

export interface ToolAnalysisResult {
  title: string;
  summary: string;
  details: string;
  structuredData?: Record<string, any>;
  tags?: string[];
}
