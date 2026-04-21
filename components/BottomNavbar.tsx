
import React from 'react';
import { View } from '../types';
import { LayoutDashboard, ShoppingCart, Target, BarChart3, Settings, Sparkles } from 'lucide-react';

interface BottomNavbarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onOpenChat: () => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ currentView, setCurrentView, onOpenChat }) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'purchases', label: 'Compras', icon: ShoppingCart },
    { id: 'ai_chat', label: 'Kaan', icon: Sparkles, isAction: true },
    { id: 'smartGoals', label: 'Metas', icon: Target },
    { id: 'settings', label: 'Menu', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center md:hidden z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const isAi = item.id === 'ai_chat';
        
        return (
          <button
            key={item.id}
            onClick={() => {
                if (item.isAction) onOpenChat();
                else setCurrentView(item.id as View);
            }}
            className={`flex flex-col items-center justify-center text-[10px] w-full h-full transition-all active:scale-95 ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : isAi 
                    ? 'text-indigo-500 dark:text-indigo-400' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className={`mb-1 ${isAi ? 'bg-indigo-50 dark:bg-indigo-900/30 p-1.5 rounded-xl' : ''}`}>
                <item.icon size={isAi ? 22 : 20} strokeWidth={isActive || isAi ? 2.5 : 2} />
            </div>
            <span className={`font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavbar;
