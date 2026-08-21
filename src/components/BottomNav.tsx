import React from 'react';
import { MessageSquare, Wrench, History, Settings } from 'lucide-react';
import { User } from '../types';

export type TabType = 'chat' | 'tools' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  user: User | null;
  historyCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  user,
  historyCount = 0,
}) => {
  const tabs = [
    {
      id: 'chat' as TabType,
      label: 'Chat',
      icon: MessageSquare,
      description: 'AI Percakapan & Stream',
    },
    {
      id: 'tools' as TabType,
      label: 'Tools',
      icon: Wrench,
      description: 'Vision, Dokumen & Suara',
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: History,
      description: 'Riwayat Percakapan',
      badge: historyCount > 0 ? historyCount : undefined,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
      description: 'Model & Pengaturan',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#050505]/95 backdrop-blur-xl border-t border-white/5 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-all">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-blue-500 font-semibold'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {/* Active Indicator Top Line */}
              {isActive && (
                <span className="absolute -top-2 w-5 h-0.5 rounded-full bg-blue-500" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-105 text-blue-500' : ''}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

