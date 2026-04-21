
import React from 'react';
import { View, AppSettings } from '../types';
import { LayoutDashboard, CreditCard, Home, TrendingDown, ShoppingCart, BarChart3, Settings, HandCoins, LogOut, X, TrendingUp, Target, Sparkles, ShieldAlert, LifeBuoy } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  appSettings: AppSettings;
  isMobile: boolean;
  onOpenChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, setIsOpen, appSettings, isMobile, onOpenChat }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
    { id: 'fixedExpenses', label: 'Despesas Fixas', icon: Home },
    { id: 'purchases', label: 'Compras', icon: ShoppingCart },
    { id: 'debts', label: 'Dívidas', icon: TrendingDown },
    { id: 'debtors', label: 'A Receber', icon: HandCoins },
    { id: 'incomes', label: 'Receitas', icon: TrendingUp },
    { id: 'smartGoals', label: 'Metas', icon: Target },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];
  
  // Fixed classes ensuring rounded corners on both states
  const baseClasses = "flex items-center px-4 py-3 text-slate-500 dark:text-slate-400 transition-all duration-300 transform rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium border border-transparent";
  
  // Active state
  const activeClasses = "flex items-center px-4 py-3 text-white bg-blue-600 shadow-md shadow-blue-200 dark:shadow-none rounded-2xl text-sm font-medium border border-transparent hover:bg-blue-500 transition-colors";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  const getAvatar = () => {
    if (appSettings.avatar_url) {
      return appSettings.avatar_url;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(appSettings.user_name)}&background=3b82f6&color=fff`;
  }

  const sidebarContent = (
    <>
      <div className="flex justify-between items-center mb-8 px-2">
         <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Arkaan</h2>
            </div>
         </div>
         <button className="md:hidden text-slate-400 hover:text-slate-600" onClick={() => setIsOpen(false)}>
            <X size={24} />
         </button>
      </div>

      <div className="flex flex-col justify-between flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <nav className="space-y-1">
           {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setCurrentView(item.id as View); if(isMobile) setIsOpen(false); }}
              className={currentView === item.id ? activeClasses : baseClasses}
            >
              <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} strokeWidth={2} />
              <span className="mx-3">{item.label}</span>
            </button>
          ))}
          
          <div className="my-2 border-t border-slate-100 dark:border-slate-800/50"></div>
          
          <button
              onClick={() => { setCurrentView('support'); if(isMobile) setIsOpen(false); }}
              className={currentView === 'support' ? activeClasses : baseClasses}
            >
              <LifeBuoy className={`w-5 h-5 ${currentView === 'support' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} strokeWidth={2} />
              <span className="mx-3">Central de Ajuda</span>
          </button>

          {/* AI Chat Item */}
          <button
              onClick={() => { onOpenChat(); if(isMobile) setIsOpen(false); }}
              className={baseClasses + " text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:text-indigo-400"}
            >
              <Sparkles className="w-5 h-5" strokeWidth={2} />
              <span className="mx-3 font-semibold">Kaan</span>
          </button>

          {/* Admin Item */}
          {appSettings.is_admin && (
             <button
              onClick={() => { setCurrentView('admin'); if(isMobile) setIsOpen(false); }}
              className={`${currentView === 'admin' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'} flex items-center px-4 py-3 mt-2 transition-all duration-300 transform rounded-2xl text-sm font-bold border border-transparent`}
            >
              <ShieldAlert className={`w-5 h-5 ${currentView === 'admin' ? 'text-red-400' : 'text-slate-500'}`} strokeWidth={2} />
              <span className="mx-3">Administração</span>
            </button>
          )}
        </nav>
        
        <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <div className="flex items-center gap-x-3 overflow-hidden">
                    <img className="object-cover w-9 h-9 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" src={getAvatar()} alt="avatar"/>
                    <div className="min-w-0">
                        <h1 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{appSettings.user_name}</h1>
                        <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${appSettings.plan === 'vip' ? 'bg-amber-400' : appSettings.plan === 'pro' ? 'bg-blue-400' : 'bg-slate-400'}`}></span>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{appSettings.plan || 'Free'} Plan</p>
                        </div>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors" aria-label="Sair" title="Sair">
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col w-72 h-screen px-5 py-6 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className="relative flex-shrink-0 flex flex-col w-64 h-screen px-5 py-8 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/50">
      {sidebarContent}
    </aside>
  );
};

export default React.memo(Sidebar);
