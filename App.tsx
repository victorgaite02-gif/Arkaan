
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabaseClient';
import { 
  View, AppSettings, Subscription, FixedExpense, Debt, Debtor, Income, 
  Purchase, SmartGoal, Company, Refund, ViewFilterType, PrefillData, PaymentMethod, PlatformSetting, SupportTicket 
} from './types';
import { initialSettings } from './services/mockData';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Subscriptions from './components/Subscriptions';
import FixedExpenses from './components/FixedExpenses';
import Purchases from './components/Purchases';
import Debts from './components/Debts';
import Debtors from './components/Debtors';
import Incomes from './components/Incomes';
import SmartGoals from './components/SmartGoals';
import Reports from './components/Reports';
import Settings from './components/Settings';
import BottomNavbar from './components/BottomNavbar';
import Chatbot from './components/Chatbot';
import LogoLoader from './components/common/LogoLoader';
import useMediaQuery from './utils/useMediaQuery';
import { formatToUTCDateString } from './utils/dateUtils';
import Admin from './components/Admin';
import Support from './components/Support';
import SystemAnnouncementModal from './components/common/SystemAnnouncement';
import { AlertTriangle, LogOut, Database } from 'lucide-react';

export interface CrudHooks<T> {
  addItem: (item: Omit<T, 'id' | 'user_id' | 'created_at'>) => Promise<T | null>;
  updateItem: (item: T) => Promise<T | null>;
  deleteItem: (id: number | string) => Promise<void>;
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  
  // Data States
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [smartGoals, setSmartGoals] = useState<SmartGoal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  
  // Platform Settings State
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);

  // UI States
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Preferences
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => localStorage.getItem('arkaan_privacy') === 'true');
  const [isAnimationsEnabled, setIsAnimationsEnabled] = useState(() => localStorage.getItem('arkaan_animations') !== 'false');
  const [viewFilter, setViewFilter] = useState<ViewFilterType>('all');

  const isMobile = useMediaQuery('(max-width: 768px)');

  // --- Auth & Init ---

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData(session.user.id);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id);
      else {
        setAppSettings(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('arkaan_privacy', String(isPrivacyMode));
  }, [isPrivacyMode]);

  useEffect(() => {
    localStorage.setItem('arkaan_animations', String(isAnimationsEnabled));
  }, [isAnimationsEnabled]);

  // --- Data Fetching ---

  const fetchData = async (userId: string) => {
    setIsLoading(true);
    setInitError(null);
    try {
      // Fetch Platform Settings (Global) First for Maintenance Check
      const { data: platformData } = await supabase.from('platform_settings').select('*');
      if (platformData) setPlatformSettings(platformData);

      // Fetch Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError) {
        if (settingsError.code === 'PGRST116') {
           // Create default settings if not exists
           const { data: newSettings } = await supabase
              .from('app_settings')
              .insert([{ ...initialSettings, user_id: userId }])
              .select()
              .single();
           setAppSettings(newSettings);
        } else {
           throw new Error(`Erro ao carregar configurações: ${settingsError.message}`);
        }
      } else if (settingsData) {
         setAppSettings(settingsData);
         
         // STRICT MAINTENANCE CHECK
         const isMaintenance = platformData?.find(s => s.key === 'maintenance_mode')?.value;
         if (isMaintenance && !settingsData.is_admin) {
             await supabase.auth.signOut();
             alert("A plataforma está em manutenção. Apenas administradores podem acessar.");
             window.location.reload();
             return;
         }
      }

      // Parallel Fetch for other tables
      const results = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', userId),
        supabase.from('fixed_expenses').select('*').eq('user_id', userId),
        supabase.from('purchases').select('*').eq('user_id', userId),
        supabase.from('debts').select('*').eq('user_id', userId),
        supabase.from('debtors').select('*').eq('user_id', userId),
        supabase.from('incomes').select('*').eq('user_id', userId),
        supabase.from('smart_goals').select('*').eq('user_id', userId),
        supabase.from('companies').select('*').eq('user_id', userId),
        supabase.from('refunds').select('*').eq('user_id', userId),
        supabase.from('support_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      setSubscriptions(results[0].data || []);
      setFixedExpenses(results[1].data || []);
      setPurchases(results[2].data || []);
      setDebts(results[3].data || []);
      setDebtors(results[4].data || []);
      setIncomes(results[5].data || []);
      setSmartGoals(results[6].data || []);
      setCompanies(results[7].data || []);
      setRefunds(results[8].data || []);
      setTickets(results[9].data || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setInitError(error.message || "Ocorreu um erro inesperado ao carregar seus dados.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- CRUD Factory ---

  const createCrudHooks = <T extends { id: any, user_id: string }>(
    tableName: string, 
    setState: React.Dispatch<React.SetStateAction<T[]>>
  ): CrudHooks<T> => ({
    addItem: async (item) => {
      if (!session) return null;
      const { data, error } = await supabase
        .from(tableName)
        .insert([{ ...item, user_id: session.user.id }])
        .select()
        .single();
      
      if (error) {
        console.error(`Error adding to ${tableName}:`, error);
        return null;
      }
      
      setState(prev => [...prev, data as T]);
      return data as T;
    },
    updateItem: async (item) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(item)
        .eq('id', item.id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating ${tableName}:`, error);
        return null;
      }

      setState(prev => prev.map(i => i.id === item.id ? (data as T) : i));
      return data as T;
    },
    deleteItem: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) console.error(`Error deleting from ${tableName}:`, error);
      else setState(prev => prev.filter(i => i.id !== id));
    }
  });

  // --- Specialized Handlers ---

  const updateAppSettings = async (newSettings: AppSettings) => {
    if (!session) return;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, user_id, created_at, updated_at, ...updates } = newSettings as any;

    const { data, error } = await supabase
      .from('app_settings')
      .update(updates)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
        console.error("Error updating settings:", error);
        throw new Error(error.message || "Falha ao atualizar configurações");
    }
    
    if (data) setAppSettings(data);
  };

  const handleOnboardingComplete = async (
      settings: AppSettings, 
      extraData?: { 
          companyData?: { name: string, tax_rate: number },
          initialIncome?: { value: number, source: string, company_id?: number }
      }
  ) => {
     try {
       await updateAppSettings(settings);
       
       if (session) {
           let companyId = undefined;
           
           if (extraData?.companyData) {
              const newCompany = await createCrudHooks('companies', setCompanies).addItem(extraData.companyData);
              if (newCompany) companyId = newCompany.id;
           }

           if (extraData?.initialIncome) {
               await createCrudHooks('incomes', setIncomes).addItem({
                   source: extraData.initialIncome.source,
                   value: extraData.initialIncome.value,
                   category: 'Salário',
                   receipt_date: formatToUTCDateString(new Date()),
                   is_recurring: true,
                   notes: 'Renda inicial cadastrada no onboarding',
                   company_id: companyId 
               });
           }
       }
     } catch (e) {
       console.error("Failed to complete onboarding", e);
       throw e; 
     }
  };

  const handleAddRefund = async (purchase: Purchase) => {
    if (!session) return;
    
    const refundData = {
        purchase_id: purchase.id,
        refund_date: formatToUTCDateString(new Date()),
        value: purchase.value,
        credit_card_id: purchase.credit_card_id,
        description: `Estorno: ${purchase.description.split(' :: ')[0]}`
    };
    
    const { data: newRefund, error: refundError } = await supabase
        .from('refunds')
        .insert([{ ...refundData, user_id: session.user.id }])
        .select()
        .single();
    
    if (refundError) {
        console.error("Error creating refund", refundError);
        return;
    }
    setRefunds(prev => [...prev, newRefund]);

    const { data: updatedPurchase, error: purchaseError } = await supabase
        .from('purchases')
        .update({ is_refunded: true })
        .eq('id', purchase.id)
        .select()
        .single();

    if (!purchaseError && updatedPurchase) {
        setPurchases(prev => prev.map(p => p.id === updatedPurchase.id ? updatedPurchase : p));
    }
  };

  // --- Chatbot Handlers ---

  const handleTransactionCreate = async (prefillData: PrefillData) => {
      const hooks = prefillData.type === 'income' 
        ? createCrudHooks<Income>('incomes', setIncomes)
        : createCrudHooks<Purchase>('purchases', setPurchases);
      
      await hooks.addItem(prefillData.data as any);
  };

  const handleTransactionDelete = async (description: string) => {
      const target = purchases
        .filter(p => p.description.toLowerCase().includes(description.toLowerCase()))
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())[0];
      
      if (target) {
          await createCrudHooks<Purchase>('purchases', setPurchases).deleteItem(target.id);
          return `Transação "${target.description}" de R$ ${target.value.toFixed(2)} foi removida.`;
      }
      return "Não encontrei nenhuma transação recente com essa descrição.";
  };

  const handleFinancialDataRequest = () => {
     const monthIncome = incomes.reduce((acc, i) => acc + i.value, 0); 
     const monthExpense = purchases.reduce((acc, p) => acc + p.value, 0) + fixedExpenses.reduce((a,b)=>a+b.value, 0) + subscriptions.reduce((a,b)=>a+b.monthly_value, 0);
     return JSON.stringify({
         userName: appSettings?.user_name,
         totalIncome: monthIncome,
         totalExpenses: monthExpense,
         balance: monthIncome - monthExpense,
         activeDebts: debts.reduce((a,b)=>a+b.current_value, 0)
     });
  };

  // Check feature flags
  const isKaanEnabled = platformSettings.find(s => s.key === 'enable_kaan')?.value ?? true;

  // --- Render ---

  if (isLoading) return <LogoLoader />;

  if (!session) return <Auth />;

  // Initial Error State (e.g. Database connection issues or Policy errors)
  if (initError && session) {
    const isRecursionError = initError.includes('infinite recursion');
    
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md text-center border border-slate-200 dark:border-slate-700">
           <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isRecursionError ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isRecursionError ? <Database className="text-amber-500" size={32} /> : <AlertTriangle className="text-red-500" size={32} />}
           </div>
           
           <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
               {isRecursionError ? "Erro de Configuração do Banco" : "Erro de Conexão"}
           </h2>
           
           <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
             {isRecursionError 
                ? "Foi detectado um loop nas políticas de segurança do banco de dados (RLS). O administrador precisa executar o script de correção SQL." 
                : "Não foi possível carregar seus dados. Isso pode ocorrer devido a permissões de banco de dados desatualizadas ou falha na rede."
             }
             <br/><br/>
             <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded block break-all border border-slate-200 dark:border-slate-700">{initError}</span>
           </p>
           
           <button 
             onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
             className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity"
           >
             <LogOut size={18} /> Sair e Recarregar
           </button>
        </div>
      </div>
    );
  }

  if (!appSettings) return <LogoLoader text="Carregando configurações..." />;

  const showOnboarding = !appSettings.is_onboarded;

  if (showOnboarding) {
    return <Onboarding appSettings={appSettings} onComplete={handleOnboardingComplete} />;
  }

  const renderView = () => {
    const commonProps = {
      appSettings,
      setIsSidebarOpen,
      selectedDate,
      setSelectedDate,
      isPrivacyMode,
      setIsPrivacyMode,
      isAnimationsEnabled,
      setIsAnimationsEnabled,
    };

    switch (currentView) {
      case 'dashboard':
        return <Dashboard {...commonProps} subscriptions={subscriptions} fixedExpenses={fixedExpenses} debts={debts} debtors={debtors} incomes={incomes} purchases={purchases} refunds={refunds} smartGoals={smartGoals} />;
      case 'subscriptions':
        return <Subscriptions {...commonProps} subscriptions={subscriptions} crudHooks={createCrudHooks('subscriptions', setSubscriptions)} isMobile={isMobile} />;
      case 'fixedExpenses':
        return <FixedExpenses {...commonProps} fixedExpenses={fixedExpenses} crudHooks={createCrudHooks('fixed_expenses', setFixedExpenses)} />;
      case 'purchases':
        return <Purchases {...commonProps} purchases={purchases} refunds={refunds} crudHooks={createCrudHooks('purchases', setPurchases)} handleAddRefund={handleAddRefund} viewFilter={viewFilter} setViewFilter={setViewFilter} />;
      case 'debts':
        return <Debts {...commonProps} debts={debts} crudHooks={createCrudHooks('debts', setDebts)} viewFilter={viewFilter} setViewFilter={setViewFilter} />;
      case 'debtors':
        return <Debtors {...commonProps} debtors={debtors} crudHooks={createCrudHooks('debtors', setDebtors)} />;
      case 'incomes':
        return <Incomes {...commonProps} incomes={incomes} companies={companies} crudHooks={createCrudHooks('incomes', setIncomes)} />;
      case 'smartGoals':
        return <SmartGoals {...commonProps} smartGoals={smartGoals} crudHooks={createCrudHooks('smart_goals', setSmartGoals)} subscriptions={subscriptions} fixedExpenses={fixedExpenses} debts={debts} incomes={incomes} purchases={purchases} />;
      case 'reports':
        return <Reports {...commonProps} subscriptions={subscriptions} fixedExpenses={fixedExpenses} debts={debts} debtors={debtors} incomes={incomes} purchases={purchases} />;
      case 'settings':
        return <Settings {...commonProps} setAppSettings={updateAppSettings} companies={companies} crudHooks={{ companies: createCrudHooks('companies', setCompanies) }} isMobile={isMobile} />;
      case 'support':
        return <Support {...commonProps} tickets={tickets} crudHooks={createCrudHooks('support_tickets', setTickets)} />;
      case 'admin':
        // Protected Admin Route
        if (!appSettings.is_admin) return <Dashboard {...commonProps} subscriptions={subscriptions} fixedExpenses={fixedExpenses} debts={debts} debtors={debtors} incomes={incomes} purchases={purchases} refunds={refunds} smartGoals={smartGoals} />;
        return <Admin {...commonProps} />;
      default:
        return <Dashboard {...commonProps} subscriptions={subscriptions} fixedExpenses={fixedExpenses} debts={debts} debtors={debtors} incomes={incomes} purchases={purchases} refunds={refunds} smartGoals={smartGoals} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <SystemAnnouncementModal />
      
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        appSettings={appSettings}
        isMobile={isMobile}
        onOpenChat={() => {
            if(isKaanEnabled) setIsChatOpen(true);
            else alert("O assistente Kaan está temporariamente desativado pelo administrador.");
        }}
      />
      
      <main className="flex-1 overflow-auto w-full relative">
        <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto min-h-full">
           {renderView()}
        </div>
      </main>

      {isMobile && (
        <BottomNavbar 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
            onOpenChat={() => {
                if(isKaanEnabled) setIsChatOpen(true);
                else alert("O assistente Kaan está temporariamente desativado.");
            }} 
        />
      )}
      
      {isKaanEnabled && (
          <Chatbot 
              isOpen={isChatOpen}
              appSettings={appSettings} 
              onClose={() => setIsChatOpen(false)} 
              onTransactionCreate={handleTransactionCreate}
              onTransactionDelete={handleTransactionDelete}
              onFinancialDataRequest={handleFinancialDataRequest}
          />
      )}
    </div>
  );
};

export default App;
