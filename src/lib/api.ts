import { ChatMessage, Conversation, AIModel, AdminStats, AppSettings, User, ErrorLogEntry } from '../types';

export class ApiClient {
  private static getHeaders(userId?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userId) {
      headers['x-user-id'] = userId;
    }
    return headers;
  }

  // Health
  static async checkHealth() {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Backend offline');
    return res.json();
  }

  // Models
  static async getModels(): Promise<{ models: AIModel[]; defaultModel: string }> {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Gagal mengambil daftar model');
    return res.json();
  }

  // Auth
  static async login(username: string, password: string): Promise<{ user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal login');
    return data;
  }

  static async register(username: string, password: string, name?: string): Promise<{ user: User }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mendaftar');
    return data;
  }

  static async guestLogin(): Promise<{ user: User }> {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal masuk sebagai tamu');
    return data;
  }

  // Conversations
  static async getConversations(userId: string): Promise<Conversation[]> {
    const res = await fetch('/api/conversations', {
      headers: this.getHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil riwayat');
    return data.conversations || [];
  }

  static async createConversation(
    userId: string,
    payload: {
      title?: string;
      model?: string;
      systemPrompt?: string;
      initialMessage?: ChatMessage;
      customGptId?: string;
    }
  ): Promise<Conversation> {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membuat percakapan');
    return data.conversation;
  }

  static async updateConversation(
    userId: string,
    id: string,
    payload: Partial<Conversation>
  ): Promise<Conversation> {
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(userId),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui percakapan');
    return data.conversation;
  }

  static async deleteConversation(userId: string, id: string): Promise<boolean> {
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus percakapan');
    return true;
  }

  // Streaming Chat
  static async streamChat(
    userId: string,
    params: {
      messages: Array<{ role: string; content: string }>;
      model: string;
      attachments?: any[];
      systemPrompt?: string;
      enableWebSearch?: boolean;
      enableThinking?: boolean;
    },
    callbacks: {
      onChunk: (chunk: string) => void;
      onGrounding?: (sources: Array<{ title?: string; uri?: string }>) => void;
      onError: (error: string) => void;
      onDone: (data: any) => void;
    },
    abortSignal?: AbortSignal
  ) {
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: this.getHeaders(userId),
        body: JSON.stringify(params),
        signal: abortSignal,
      });

      if (!response.ok) {
        let errMessage = 'Gagal memproses chat.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {
          // ignore
        }
        callbacks.onError(errMessage);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('Stream tidak dapat dibaca.');
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.substring(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6).trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === 'chunk') {
                callbacks.onChunk(parsed.text || '');
              } else if (currentEvent === 'grounding') {
                callbacks.onGrounding?.(parsed.sources || []);
              } else if (currentEvent === 'done') {
                callbacks.onDone(parsed);
              } else if (currentEvent === 'error') {
                callbacks.onError(parsed.message || 'Terjadi kesalahan pada AI model.');
              }
            } catch (jsonErr) {
              console.warn('Failed parsing SSE payload:', jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // user cancelled manually
        return;
      }
      callbacks.onError(err.message || 'Koneksi terputus.');
    }
  }

  // Tools
  static async analyzeImage(userId: string, imageBase64: string, mimeType: string, prompt?: string) {
    const res = await fetch('/api/tools/analyze-image', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ imageBase64, mimeType, prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menganalisis gambar');
    return data;
  }

  static async analyzeDocument(userId: string, documentText: string, docName: string, question?: string) {
    const res = await fetch('/api/tools/analyze-doc', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ documentText, docName, question }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menganalisis dokumen');
    return data;
  }

  static async webSearch(userId: string, query: string) {
    const res = await fetch('/api/tools/web-search', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal melakukan pencarian web');
    return data;
  }

  // High-Res Image Generation (Gemini Image & DALL-E)
  static async generateImage(
    userId: string,
    prompt: string,
    options?: {
      size?: string;
      imageSize?: '512px' | '1K' | '2K' | '4K';
      aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
      modelChoice?: 'gemini' | 'dalle';
    }
  ) {
    const res = await fetch('/api/tools/generate-image', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({
        prompt,
        size: options?.size || '1024x1024',
        imageSize: options?.imageSize || '1K',
        aspectRatio: options?.aspectRatio || '1:1',
        modelChoice: options?.modelChoice || 'gemini',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membuat gambar AI');
    return data;
  }

  // Image Editing with text prompt and reference photo
  static async editImage(
    userId: string,
    params: {
      imageBase64: string;
      mimeType?: string;
      prompt: string;
      imageSize?: '512px' | '1K' | '2K' | '4K';
    }
  ) {
    const res = await fetch('/api/tools/edit-image', {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengedit gambar AI');
    return data;
  }

  // Admin
  static async getAdminStats(userId: string): Promise<AdminStats> {
    const res = await fetch('/api/admin/stats', {
      headers: this.getHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil statistik admin');
    return data;
  }

  static async getAdminUsers(userId: string) {
    const res = await fetch('/api/admin/users', {
      headers: this.getHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil data user');
    return data.users;
  }

  static async toggleUserStatus(adminId: string, targetUserId: string) {
    const res = await fetch(`/api/admin/users/${targetUserId}/toggle`, {
      method: 'POST',
      headers: this.getHeaders(adminId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengubah status user');
    return data;
  }

  static async updateAdminSettings(adminId: string, settings: any) {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: this.getHeaders(adminId),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui pengaturan');
    return data;
  }

  // Error Logs Telemetry
  static async getAdminErrorLogs(adminId: string): Promise<ErrorLogEntry[]> {
    const res = await fetch('/api/admin/logs', {
      headers: this.getHeaders(adminId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengambil log error');
    return data.errorLogs || [];
  }

  static async clearAdminErrorLogs(adminId: string): Promise<boolean> {
    const res = await fetch('/api/admin/logs', {
      method: 'DELETE',
      headers: this.getHeaders(adminId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus log error');
    return data.success;
  }
}
