import React, { useState, useEffect, useRef } from 'react';
import { TopNav } from './components/TopNav';
import { ChatGPTSidebar } from './components/ChatGPTSidebar';
import { ChatView } from './components/ChatView';
import { ChatGPTCanvas } from './components/ChatGPTCanvas';
import { ExploreGPTsModal, DEFAULT_CUSTOM_GPTS } from './components/ExploreGPTsModal';
import { DalleStudioModal } from './components/DalleStudioModal';
import { VoiceModal } from './components/VoiceModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminModal } from './components/AdminModal';
import { AuthModal } from './components/AuthModal';
import { ApiClient } from './lib/api';
import { errorLogger } from './lib/errorLogger';
import { VoiceManager } from './lib/voice';
import {
  User,
  Conversation,
  ChatMessage,
  Attachment,
  AIModel,
  AppSettings,
  VoiceSettings,
  CanvasDocument,
  CustomGPT,
} from './types';

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  },
};

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  autoSpeak: false,
  voiceName: '',
  rate: 1.05,
  pitch: 0.92,
  volume: 1.0,
  language: 'id-ID',
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultModel: 'nexus-5.6-sol',
  theme: 'dark',
  voice: DEFAULT_VOICE_SETTINGS,
  maxTokensPerRequest: 4096,
  streamResponse: true,
  systemPrompt:
    'Anda adalah NEXUS AI Assistant buatan NEXUS Group (Founder & CEO: Muhamad Andika). Jawab dalam bahasa yang digunakan pengguna (Bahasa Indonesia atau Inggris) dengan format Markdown yang rapi, presisi, dan elegan.',
  customInstructions: {
    enabled: true,
    aboutUser: '',
    howToRespond: 'Jawab dengan terstruktur, jelas, akurat, dan berikan kode program yang siap dijalankan.',
  },
};

export default function App() {
  // Navigation & User State
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isExploreGPTsOpen, setIsExploreGPTsOpen] = useState(false);
  const [isDalleStudioOpen, setIsDalleStudioOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Canvas Workspace State (NEXUS Canvas)
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasDocument, setCanvasDocument] = useState<CanvasDocument>({
    title: 'Catatan & Kode Workspace',
    content: '// Selamat datang di NEXUS Canvas Workspace\n// Anda dapat menulis kode, mengedit dokumen, atau meminta AI meninjau naskah di sini.\n\nfunction calculateMomentum(mass, velocity) {\n  return mass * velocity;\n}\n\nconsole.log("Momentum:", calculateMomentum(10, 5));',
    isCode: true,
    language: 'javascript',
    lastModified: Date.now(),
  });

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = safeStorage.getItem('nexus_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.voice) {
          parsed.voice.autoSpeak = false;
        }
        return { ...DEFAULT_APP_SETTINGS, ...parsed };
      } catch {
        return DEFAULT_APP_SETTINGS;
      }
    }
    return DEFAULT_APP_SETTINGS;
  });

  // Models State (NEXUS AI Series)
  const [models, setModels] = useState<AIModel[]>([
    {
      id: 'nexus-5.6-sol',
      name: 'NEXUS 5.6 Sol',
      provider: 'NEXUS',
      description: 'Model frontier unggulan NEXUS untuk penalaran paling kompleks, coding arsitektur, dan deep logic.',
      contextWindow: '1.05M',
      speed: 'High Reasoning',
      isDefault: true,
      badge: 'Frontier Flagship',
      supportsVision: true,
      supportsWebSearch: true,
    },
    {
      id: 'nexus-5.6-terra',
      name: 'NEXUS 5.6 Terra',
      provider: 'NEXUS',
      description: 'Model serbaguna seimbang untuk analisis visual gambar, naskah dokumen, dan tugas harian.',
      contextWindow: '1.05M',
      speed: 'Balanced',
      badge: 'Multimodal Workload',
      supportsVision: true,
      supportsWebSearch: true,
    },
    {
      id: 'nexus-5.6-luna',
      name: 'NEXUS 5.6 Luna',
      provider: 'NEXUS',
      description: 'Model ultra cepat berlatensi rendah untuk respons kilat, percakapan interaktif, dan efisiensi tinggi.',
      contextWindow: '1.05M',
      speed: 'Ultra Fast',
      badge: 'Ultra Fast & Ringkas',
      supportsVision: true,
      supportsWebSearch: true,
    },
    {
      id: 'nexus-4.5-omni',
      name: 'NEXUS 4.5 Omni',
      provider: 'NEXUS',
      description: 'Model flagship multimodal unggulan untuk visual, membaca gambar, logika mendalam, dan analisis.',
      contextWindow: '128K',
      speed: 'Balanced',
      badge: 'Multimodal Vision',
      supportsVision: true,
      supportsWebSearch: true,
    },
    {
      id: 'nexus-4.5-mini',
      name: 'NEXUS 4.5 Mini',
      provider: 'NEXUS',
      description: 'Model gesit & hemat kuota untuk percakapan, tugas harian, dan coding.',
      contextWindow: '128K',
      speed: 'Ultra Fast',
      badge: 'Paling Hemat',
      supportsVision: true,
      supportsWebSearch: true,
    },
    {
      id: 'nexus-reasoning',
      name: 'NEXUS Reasoning Pro',
      provider: 'NEXUS',
      description: 'Model reasoning bertahap mendalam untuk matematika, algoritma, dan problem-solving logika.',
      contextWindow: '200K',
      speed: 'High Reasoning',
      badge: 'Deep Reasoning',
      supportsVision: false,
      supportsWebSearch: true,
    },
  ]);
  const [activeModel, setActiveModel] = useState<string>(settings.defaultModel || 'nexus-5.6-sol');

  // Conversations & Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize User from storage or auto-login Guest
  useEffect(() => {
    const savedUser = safeStorage.getItem('nexus_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore
      }
    } else {
      // Auto guest login on first visit
      ApiClient.guestLogin()
        .then((res) => {
          setUser(res.user);
          safeStorage.setItem('nexus_user', JSON.stringify(res.user));
        })
        .catch((err) => {
          errorLogger.warn('auth.guestAutoLogin', err);
        });
    }
  }, []);

  // Fetch Models on mount
  useEffect(() => {
    ApiClient.getModels()
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
        }
        if (data.defaultModel) {
          setActiveModel((prev) => prev || data.defaultModel);
        }
      })
      .catch((err) => {
        errorLogger.warn('models.fetchModels', err);
      });
  }, []);

  // Load Conversations when User changes
  useEffect(() => {
    if (user) {
      ApiClient.getConversations(user.id)
        .then((convs) => {
          setConversations(convs);
          if (convs.length > 0 && !activeConversationId) {
            setActiveConversationId(convs[0].id);
            setMessages(convs[0].messages || []);
          }
        })
        .catch((err) => {
          errorLogger.warn('conversations.load', err, { userId: user.id }, user.id);
        });
    }
  }, [user?.id]);

  // Persist Settings & Theme
  useEffect(() => {
    safeStorage.setItem('nexus_settings', JSON.stringify(settings));
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.className = 'bg-[#f7f7f8] text-[#0d0d0d] antialiased min-h-screen';
    } else {
      document.documentElement.classList.add('dark');
      document.body.className = 'bg-[#0d0d0d] text-slate-100 antialiased min-h-screen';
    }
  }, [settings]);

  // Handle New Chat (ChatGPT New Chat)
  const handleNewChat = async (customGpt?: CustomGPT, starterPrompt?: string) => {
    if (!user) return;
    if (isStreaming) handleStopStreaming();

    const title = customGpt ? customGpt.name : 'Percakapan Baru';
    const systemPrompt = customGpt ? customGpt.systemPrompt : settings.systemPrompt;

    try {
      const newConv = await ApiClient.createConversation(user.id, {
        title,
        model: activeModel,
        systemPrompt,
        customGptId: customGpt?.id,
      });

      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);

      if (starterPrompt) {
        setTimeout(() => {
          handleSendMessage(starterPrompt);
        }, 100);
      }
    } catch (err) {
      errorLogger.warn('chat.createConversation', err, { userId: user.id, model: activeModel }, user.id);
      const localConv: Conversation = {
        id: 'conv_' + Date.now(),
        userId: user.id,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: activeModel,
        customGptId: customGpt?.id,
        messages: [],
      };
      setConversations((prev) => [localConv, ...prev]);
      setActiveConversationId(localConv.id);
      setMessages([]);

      if (starterPrompt) {
        setTimeout(() => {
          handleSendMessage(starterPrompt);
        }, 100);
      }
    }
  };

  // Handle Select Conversation
  const handleSelectConversation = (id: string) => {
    const found = conversations.find((c) => c.id === id);
    if (found) {
      setActiveConversationId(found.id);
      setMessages(found.messages || []);
      if (found.model) setActiveModel(found.model);
    }
  };

  // Handle Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    if (!user) return;
    try {
      await ApiClient.updateConversation(user.id, id, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
      );
    } catch (err) {
      errorLogger.warn('chat.renameConversation', err, { userId: user.id, convId: id, newTitle }, user.id);
    }
  };

  // Handle Delete Conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await ApiClient.deleteConversation(user.id, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      errorLogger.warn('chat.deleteConversation', err, { userId: user.id, convId: id }, user.id);
    }
  };

  // Handle Toggle Pin
  const handleTogglePin = async (id: string) => {
    if (!user) return;
    const target = conversations.find((c) => c.id === id);
    if (!target) return;

    const newPinned = !target.pinned;
    try {
      await ApiClient.updateConversation(user.id, id, { pinned: newPinned });
      setConversations((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, pinned: newPinned } : c))
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)
      );
    } catch (err) {
      errorLogger.warn('chat.togglePin', err, { userId: user.id, convId: id, newPinned }, user.id);
    }
  };

  // Stop streaming response
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === 'assistant' && last.isStreaming) {
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      }
      return prev;
    });
  };

  // Send Message and Stream AI Response
  const handleSendMessage = async (
    content: string,
    attachments?: Attachment[],
    options?: { enableWebSearch?: boolean; enableThinking?: boolean }
  ) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    let convId = activeConversationId;
    let currentConvs = [...conversations];

    // Auto create conversation if none active
    if (!convId) {
      const titleSnippet = content.slice(0, 32) || 'Percakapan AI';
      try {
        const created = await ApiClient.createConversation(user.id, {
          title: titleSnippet,
          model: activeModel,
          systemPrompt: settings.systemPrompt,
        });
        convId = created.id;
        setActiveConversationId(convId);
        currentConvs = [created, ...currentConvs];
        setConversations(currentConvs);
      } catch {
        convId = 'conv_' + Date.now();
        const fallbackConv: Conversation = {
          id: convId,
          userId: user.id,
          title: titleSnippet,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: activeModel,
          messages: [],
        };
        setActiveConversationId(convId);
        currentConvs = [fallbackConv, ...currentConvs];
        setConversations(currentConvs);
      }
    }

    const userMessage: ChatMessage = {
      id: 'msg_u_' + Date.now(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments,
    };

    const assistantMessageId = 'msg_a_' + (Date.now() + 1);
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      model: activeModel,
    };

    const updatedMessages = [...messages, userMessage, assistantPlaceholder];
    setMessages(updatedMessages);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = '';

    // Auto update conversation title if first message
    if (messages.length === 0) {
      const generatedTitle = content.slice(0, 35) || 'Percakapan Baru';
      handleRenameConversation(convId, generatedTitle);
    }

    // Build system instructions with Custom Instructions (Memory)
    let combinedSystemPrompt = settings.systemPrompt || '';
    if (settings.customInstructions?.enabled) {
      if (settings.customInstructions.aboutUser) {
        combinedSystemPrompt += `\n[Info Pengguna]: ${settings.customInstructions.aboutUser}`;
      }
      if (settings.customInstructions.howToRespond) {
        combinedSystemPrompt += `\n[Gaya Respon Yang Diminta]: ${settings.customInstructions.howToRespond}`;
      }
    }

    ApiClient.streamChat(
      user.id,
      {
        messages: updatedMessages.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model: activeModel,
        attachments,
        systemPrompt: combinedSystemPrompt,
        enableWebSearch: options?.enableWebSearch,
        enableThinking: options?.enableThinking,
      },
      {
        onChunk: (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === assistantMessageId) {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: accumulatedText,
                  isStreaming: true,
                },
              ];
            }
            return prev;
          });
        },
        onGrounding: (sources) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === assistantMessageId) {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  sources,
                },
              ];
            }
            return prev;
          });
        },
        onDone: (data) => {
          setIsStreaming(false);
          abortControllerRef.current = null;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            const finalSources = (last && last.id === assistantMessageId) ? (last.sources || last.groundingSources) : undefined;
            const finalMessages = prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: accumulatedText || m.content,
                    isStreaming: false,
                    sources: finalSources || m.sources,
                    groundingSources: finalSources || m.groundingSources,
                  }
                : m
            );

            if (convId && user) {
              ApiClient.updateConversation(user.id, convId, {
                messages: finalMessages,
                model: activeModel,
              }).catch((err) => {
                errorLogger.warn('chat.updateConversationOnDone', err, { userId: user.id, convId }, user.id);
              });
            }

            return finalMessages;
          });
        },
        onError: (errMessage) => {
          setIsStreaming(false);
          abortControllerRef.current = null;
          if (user) {
            errorLogger.error('chat.stream', errMessage, { userId: user.id, convId, model: activeModel }, user.id);
          }

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            const finalSources = (last && last.id === assistantMessageId) ? (last.sources || last.groundingSources) : undefined;
            const finalMessages = prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: accumulatedText || '⚠️ ' + errMessage,
                    error: errMessage,
                    isStreaming: false,
                    sources: finalSources || m.sources,
                  }
                : m
            );
            return finalMessages;
          });
        },
      },
      abortController.signal
    );
  };

  // Regenerate last message
  const handleRegenerateLastMessage = (modelId?: string) => {
    if (messages.length === 0) return;
    // Find last user message
    const lastUserMsgIndex = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserMsgIndex === -1) return;

    const lastUserMsg = messages[lastUserMsgIndex];
    // Remove last assistant message
    setMessages(messages.slice(0, lastUserMsgIndex));
    if (modelId) setActiveModel(modelId);
    handleSendMessage(lastUserMsg.content, lastUserMsg.attachments);
  };

  // Canvas Handlers (ChatGPT Canvas)
  const handleOpenInCanvas = (
    content: string,
    isCode = true,
    language = 'javascript',
    title = 'Dokumen Canvas'
  ) => {
    setCanvasDocument({
      title,
      content,
      isCode,
      language,
      lastModified: Date.now(),
    });
    setIsCanvasOpen(true);
  };

  // Share conversation handler
  const handleShareConversation = () => {
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    const text = activeConv
      ? `Percakapan NEXUS AI:\n${activeConv.title}\n\n` +
        messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
      : 'NEXUS AI Assistant bertenaga OpenAI GPT-5.6';

    navigator.clipboard.writeText(text);
  };

  // Clear all conversations
  const handleClearAllConversations = async () => {
    if (!user) return;
    for (const c of conversations) {
      await ApiClient.deleteConversation(user.id, c.id).catch((err) => {
        errorLogger.warn('chat.clearConversation', err, { userId: user.id, convId: c.id }, user.id);
      });
    }
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
  };

  // Auth Handlers
  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    localStorage.setItem('nexus_user', JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_user');
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    ApiClient.guestLogin()
      .then((res) => {
        setUser(res.user);
        localStorage.setItem('nexus_user', JSON.stringify(res.user));
      })
      .catch((err) => {
        errorLogger.warn('auth.logoutGuestLogin', err);
      });
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
      voice: newSettings.voice ? { ...prev.voice, ...newSettings.voice } : prev.voice,
      customInstructions: newSettings.customInstructions
        ? { ...prev.customInstructions, ...newSettings.customInstructions }
        : prev.customInstructions,
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d0d] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. ChatGPT Left Sidebar */}
      <ChatGPTSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => handleNewChat()}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePinConversation={handleTogglePin}
        isOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenExploreGPTs={() => setIsExploreGPTsOpen(true)}
        onOpenDalleStudio={() => setIsDalleStudioOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        user={user}
      />

      {/* 2. Main Content & Canvas Layout */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <TopNav
          user={user}
          activeModel={activeModel}
          models={models}
          onSelectModel={setActiveModel}
          onNewChat={() => handleNewChat()}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenExploreGPTs={() => setIsExploreGPTsOpen(true)}
          onOpenDalleStudio={() => setIsDalleStudioOpen(true)}
          onToggleCanvas={() => setIsCanvasOpen(!isCanvasOpen)}
          isCanvasOpen={isCanvasOpen}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          hasActiveConversation={messages.length > 0}
          onShareConversation={handleShareConversation}
        />

        {/* Workspace: Chat + Canvas Split Screen */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Chat View */}
          <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
            <ChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              isStreaming={isStreaming}
              activeModel={activeModel}
              models={models}
              onSelectModel={setActiveModel}
              voiceSettings={settings.voice}
              onNewChat={() => handleNewChat()}
              onOpenVoiceMode={() => setIsVoiceModalOpen(true)}
              onOpenInCanvas={handleOpenInCanvas}
              onRegenerateLastMessage={handleRegenerateLastMessage}
            />
          </main>

          {/* Canvas Document/Code Workspace (ChatGPT Canvas) */}
          <ChatGPTCanvas
            document={canvasDocument}
            isOpen={isCanvasOpen}
            onClose={() => setIsCanvasOpen(false)}
            onUpdateDocument={(up) => setCanvasDocument((prev) => ({ ...prev, ...up }))}
            onSendActionToChat={(actionPrompt) => {
              handleSendMessage(actionPrompt);
            }}
          />
        </div>
      </div>

      {/* 3. Modals */}
      {/* Explore GPTs Modal */}
      <ExploreGPTsModal
        isOpen={isExploreGPTsOpen}
        onClose={() => setIsExploreGPTsOpen(false)}
        onSelectGPT={(customGpt, starterPrompt) => {
          setIsExploreGPTsOpen(false);
          handleNewChat(customGpt, starterPrompt);
        }}
      />

      {/* DALL-E 3 Visual Studio Modal */}
      <DalleStudioModal
        isOpen={isDalleStudioOpen}
        onClose={() => setIsDalleStudioOpen(false)}
        userId={user?.id || 'guest_user'}
        onSendImageToChat={(imageUrl, prompt) => {
          const userMsg: ChatMessage = {
            id: 'msg_u_' + Date.now(),
            role: 'user',
            content: `Tampilkan gambar DALL-E yang baru saja dihasilkan dari prompt: "${prompt}"`,
            timestamp: Date.now(),
          };
          const aiMsg: ChatMessage = {
            id: 'msg_a_' + (Date.now() + 1),
            role: 'assistant',
            content: `Berikut adalah karya seni visual beresolusi tinggi yang dihasilkan oleh **DALL-E 3** untuk prompt:\n\n> *"${prompt}"*`,
            imageUrl,
            timestamp: Date.now(),
            model: 'DALL-E 3 Studio',
          };
          setMessages((prev) => [...prev, userMsg, aiMsg]);
        }}
      />

      {/* ChatGPT Live Voice Mode Modal */}
      {isVoiceModalOpen && (
        <VoiceModal
          isOpen={isVoiceModalOpen}
          onClose={() => {
            setIsVoiceModalOpen(false);
            VoiceManager.stopSpeaking();
            VoiceManager.stopListening();
          }}
          onSendMessage={(text) => handleSendMessage(text)}
          isStreaming={isStreaming}
          lastAssistantMessage={
            messages.filter((m) => m.role === 'assistant' && !m.error).slice(-1)[0]?.content
          }
          activeModelName={models.find((m) => m.id === activeModel)?.name || 'GPT-5.6 Sol'}
        />
      )}

      {/* Comprehensive Settings & Memory Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        models={models}
        conversations={conversations}
        onClearAllConversations={handleClearAllConversations}
        onLogout={handleLogout}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        currentUser={user}
      />

      {/* Admin Panel Modal */}
      {user?.role === 'admin' && (
        <AdminModal
          adminId={user.id}
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          models={models}
          onModelConfigChange={() => {
            ApiClient.getModels().then((data) => setModels(data.models));
          }}
        />
      )}
    </div>
  );
}
