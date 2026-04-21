
import React, { useMemo } from 'react';
import { Subscription, FixedExpense, Debt, Debtor, Income, AppSettings, NegotiationStatus, Purchase, PaymentMethod, Refund, SmartGoal, Status } from '../types';
import { Bar, BarChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Target, AlertTriangle, AlertCircle, Wallet, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, CalendarDays, ShoppingBag } from 'lucide-react';
import ViewHeader from './common/ViewHeader';
import { getStatementDateForPurchase } from '../utils/dateUtils';
import PrivacyValue from './common/PrivacyValue';
import useMediaQuery from '../utils/useMediaQuery';

interface DashboardProps {
  subscriptions: Subscription[];
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  debtors: Debtor[];
  incomes: Income[];
  purchases: Purchase[];
  refunds: Refund[];
  smartGoals: SmartGoal[];
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const getSubscriptionValueInBRL = (subscription: Subscription, settings: AppSettings): number => {
    if (subscription.currency === 'USD') {
        const usdRate = subscription.applied_usd_rate ?? settings.usd_rate;
        const iofRate = subscription.applied_iof_rate ?? settings.iof_rate;
        return subscription.monthly_value * usdRate * (1 + iofRate / 100);
    }
    return subscription.monthly_value;
};

const Dashboard: React.FC<DashboardProps> = ({ 
    subscriptions, fixedExpenses, debts, incomes, purchases, refunds, smartGoals,
    appSettings, setIsSidebarOpen, selectedDate, setSelectedDate,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const currentMonth = selectedDate.getUTCMonth();
  const currentYear = selectedDate.getUTCFullYear();
  const currentMonthStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;

  // Helper for animation classes
  const animClass = (base: string) => isAnimationsEnabled ? base : '';
  const chartDuration = isAnimationsEnabled ? 1500 : 0;

  // --- 1. DATA CALCULATIONS (Current Month) ---

  // Incomes
  const monthlyIncomes = useMemo(() => incomes.filter(i => {
    const d = new Date(`${i.receipt_date}T00:00:00Z`);
    return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
  }), [incomes, currentMonth, currentYear]);
  
  const totalIncome = monthlyIncomes.reduce((acc, curr) => acc + curr.value, 0);

  // Historical Average Income (for Smart Goals)
  const avgMonthlyIncome = useMemo(() => {
      if (incomes.length === 0) return 0;
      const uniqueMonths = new Set(incomes.map(i => i.receipt_date.substring(0, 7))).size || 1;
      const totalIncomeAllTime = incomes.reduce((acc, i) => acc + i.value, 0);
      return totalIncomeAllTime / uniqueMonths;
  }, [incomes]);
  
  const baseIncome = Math.max(totalIncome, avgMonthlyIncome);
  const isSafetyMode = totalIncome < avgMonthlyIncome && totalIncome > 0;

  // Fixed Expenses
  const monthlyFixedExpenses = useMemo(() => fixedExpenses.reduce((acc, exp) => acc + exp.value, 0), [fixedExpenses]);
  
  // Subscriptions
  const activeSubscriptions = useMemo(() => subscriptions.filter(s => {
    const startDate = new Date(`${s.start_date}T00:00:00Z`);
    if (startDate > new Date(Date.UTC(currentYear, currentMonth + 1, 0))) return false;
    if (s.cancellation_date) {
        const cancelDate = new Date(`${s.cancellation_date}T00:00:00Z`);
        if (cancelDate < new Date(Date.UTC(currentYear, currentMonth, 1))) return false;
    }
    return true;
  }), [subscriptions, currentMonth, currentYear]);

  const monthlySubscriptions = activeSubscriptions.reduce((acc, sub) => acc + getSubscriptionValueInBRL(sub, appSettings), 0);

  // Purchases & Refunds
  const { creditCardTotal, otherPurchasesTotal, spendingByCategory, cardsData } = useMemo(() => {
    let ccTotal = 0;
    let otherTotal = 0;
    const spending: Record<string, number> = {};
    const cardsMap: Record<string, number> = {}; // Card ID -> Total

    purchases.forEach(p => {
        if (p.is_refunded) return;
        
        const card = (appSettings.credit_cards || []).find(c => c.id === p.credit_card_id);
        const stmtDate = getStatementDateForPurchase(p, card);
        
        let valueToAdd = 0;

        if (p.payment_method === PaymentMethod.CreditCard) {
             if (p.is_installment) {
                const monthsDiff = (currentYear - stmtDate.getUTCFullYear()) * 12 + (currentMonth - stmtDate.getUTCMonth());
                if (monthsDiff >= 0 && monthsDiff < p.installments) {
                    valueToAdd = p.value / p.installments;
                    ccTotal += valueToAdd;
                    if(p.credit_card_id) cardsMap[p.credit_card_id] = (cardsMap[p.credit_card_id] || 0) + valueToAdd;
                }
             } else {
                 if (stmtDate.getUTCMonth() === currentMonth && stmtDate.getUTCFullYear() === currentYear) {
                     valueToAdd = p.value;
                     ccTotal += valueToAdd;
                     if(p.credit_card_id) cardsMap[p.credit_card_id] = (cardsMap[p.credit_card_id] || 0) + valueToAdd;
                 }
             }
        } else {
            // Non-card purchases (PIX, Debit, etc)
             if (stmtDate.getUTCMonth() === currentMonth && stmtDate.getUTCFullYear() === currentYear) {
                 valueToAdd = p.value;
                 otherTotal += valueToAdd;
             }
        }
        
        if (valueToAdd > 0) {
             spending[p.category] = (spending[p.category] || 0) + valueToAdd;
        }
    });
    
    // Subtract Refunds from Credit Card Total
    const monthlyRefunds = refunds
        .filter(r => {
             const d = new Date(`${r.refund_date}T00:00:00Z`);
             return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
        });

    monthlyRefunds.forEach(r => {
        ccTotal -= r.value;
        // Optionally adjust card map if refund is linked to card (requires credit_card_id on refund)
         if(r.credit_card_id) cardsMap[r.credit_card_id] = Math.max(0, (cardsMap[r.credit_card_id] || 0) - r.value);
    });

    return { creditCardTotal: Math.max(0, ccTotal), otherPurchasesTotal: otherTotal, spendingByCategory: spending, cardsData: cardsMap };
  }, [purchases, currentMonth, currentYear, appSettings.credit_cards, refunds]);

  const totalExpenses = monthlyFixedExpenses + monthlySubscriptions + creditCardTotal + otherPurchasesTotal;
  const balance = totalIncome - totalExpenses;
  
  // Recent Transactions
  const recentTransactions = useMemo(() => {
      const all: any[] = [
          ...incomes.map(i => ({...i, type: 'income', date: i.receipt_date})),
          ...purchases.map(p => ({...p, type: 'purchase', date: p.purchase_date})),
      ];
      return all.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [incomes, purchases]);

  // Chart Data (Last 12 Months)
  const chartData = [
      { name: 'Fixos', value: monthlyFixedExpenses, fill: '#3b82f6' },
      { name: 'Assinaturas', value: monthlySubscriptions, fill: '#8b5cf6' },
      { name: 'Compras', value: otherPurchasesTotal + creditCardTotal, fill: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Status Badge Logic
  const getBalanceStatus = () => {
      if (balance >= totalIncome * 0.2) return { text: 'Excelente', color: 'text-green-500 bg-green-100 dark:bg-green-900/30' };
      if (balance > 0) return { text: 'Positivo', color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' };
      return { text: 'Atenção', color: 'text-red-500 bg-red-100 dark:bg-red-900/30' };
  };

  const getCardStatus = (closingDay: number) => {
    const today = new Date().getUTCDate();
    if (today < closingDay) return { text: 'Aberta', color: 'text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-300' };
    if (today === closingDay) return { text: 'Fecha Hoje', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300' };
    return { text: 'Fechada', color: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300' };
};

  return (
    <div className="space-y-6">
      <ViewHeader 
        title="Dashboard" 
        setIsSidebarOpen={setIsSidebarOpen} 
        selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate}
        isPrivacyMode={isPrivacyMode}
        setIsPrivacyMode={setIsPrivacyMode}
        isAnimationsEnabled={isAnimationsEnabled}
        setIsAnimationsEnabled={setIsAnimationsEnabled}
      />

      {/* KPI Cards Row - Compact Version */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${animClass('animate-fade-in-up')}`}>
          {/* Income */}
          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm relative overflow-hidden group">
               <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-200/20 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
               <div className="relative z-10">
                   <div className="flex justify-between items-center mb-2">
                       <div className="p-2 bg-white dark:bg-emerald-900/40 rounded-xl shadow-sm text-emerald-600 dark:text-emerald-400">
                           <TrendingUp size={20}/>
                       </div>
                       {isSafetyMode && <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Baixa</span>}
                   </div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Entradas Totais</p>
                   <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                       <PrivacyValue isPrivate={isPrivacyMode} value={totalIncome} animate={isAnimationsEnabled} />
                   </h3>
               </div>
          </div>

          {/* Expenses */}
          <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-3xl border border-rose-100 dark:border-rose-800/30 shadow-sm relative overflow-hidden group">
               <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-200/20 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
               <div className="relative z-10">
                   <div className="flex justify-between items-center mb-2">
                       <div className="p-2 bg-white dark:bg-rose-900/40 rounded-xl shadow-sm text-rose-500 dark:text-rose-400">
                           <ShoppingBag size={20}/>
                       </div>
                   </div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saídas Totais</p>
                   <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                       <PrivacyValue isPrivate={isPrivacyMode} value={totalExpenses} animate={isAnimationsEnabled} />
                   </h3>
               </div>
          </div>

          {/* Credit Card Total */}
          <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-3xl border border-orange-100 dark:border-orange-800/30 shadow-sm relative overflow-hidden group">
               <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-200/20 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
               <div className="relative z-10">
                   <div className="flex justify-between items-center mb-2">
                       <div className="p-2 bg-white dark:bg-orange-900/40 rounded-xl shadow-sm text-orange-500 dark:text-orange-400">
                           <CreditCard size={20}/>
                       </div>
                   </div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fatura Cartões</p>
                   <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                       <PrivacyValue isPrivate={isPrivacyMode} value={creditCardTotal} animate={isAnimationsEnabled} />
                   </h3>
               </div>
          </div>

          {/* Balance */}
          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-3xl border border-blue-100 dark:border-blue-800/30 shadow-sm relative overflow-hidden group">
               <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-200/20 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
               <div className="relative z-10">
                   <div className="flex justify-between items-center mb-2">
                       <div className="p-2 bg-white dark:bg-blue-900/40 rounded-xl shadow-sm text-blue-600 dark:text-blue-400">
                           <Wallet size={20}/>
                       </div>
                       <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getBalanceStatus().color}`}>
                           {getBalanceStatus().text}
                       </span>
                   </div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saldo Final</p>
                   <h3 className={`text-xl font-bold mt-0.5 ${balance < 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                       <PrivacyValue isPrivate={isPrivacyMode} value={balance} animate={isAnimationsEnabled} />
                   </h3>
               </div>
          </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${animClass('animate-fade-in-up delay-100')}`}>
          {/* Main Column: Cards & Spending */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* My Cards Section */}
              {appSettings.credit_cards && appSettings.credit_cards.length > 0 && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-blue-600 dark:text-blue-400" size={20} />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Meus Cartões</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {appSettings.credit_cards.map(card => {
                            const status = getCardStatus(card.closingDate);
                            const currentBill = cardsData[card.id] || 0;
                            
                            return (
                                <div key={card.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <CreditCard size={64} className="text-slate-800 dark:text-white" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-700 dark:text-slate-200">{card.nickname}</h4>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                                                {status.text}
                                            </span>
                                        </div>
                                        <div className="mb-3">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Fatura Atual</p>
                                            <p className="text-xl font-bold text-slate-800 dark:text-white">
                                                <PrivacyValue isPrivate={isPrivacyMode} value={currentBill} animate={isAnimationsEnabled} />
                                            </p>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                                            <span>Fecha dia {card.closingDate}</span>
                                            <span>Vence dia {card.dueDate}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

             {/* Top Spending Section */}
             <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                    <ArrowUpRight className="text-red-500" size={20} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Onde você mais gasta</h3>
                </div>
                 <div className="space-y-4">
                    {Object.entries(spendingByCategory)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 4)
                        .map(([category, value], idx) => {
                             const totalSpent = Object.values(spendingByCategory).reduce((a, b) => a + b, 0);
                             const percent = totalSpent > 0 ? (value / totalSpent) * 100 : 0;
                             
                             return (
                                 <div key={category}>
                                     <div className="flex justify-between text-sm mb-1">
                                         <span className="font-medium text-slate-700 dark:text-slate-300">{category}</span>
                                         <span className="text-slate-600 dark:text-slate-400 font-semibold">
                                             <PrivacyValue isPrivate={isPrivacyMode} value={value} as="span" animate={isAnimationsEnabled} />
                                             <span className="text-xs font-normal text-slate-400 ml-1">({percent.toFixed(0)}%)</span>
                                         </span>
                                     </div>
                                     <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                         <div 
                                            className={`h-full rounded-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${percent}%` }}
                                         ></div>
                                     </div>
                                 </div>
                             )
                        })}
                        {Object.keys(spendingByCategory).length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sem gastos registrados no período.</p>}
                 </div>
            </div>

            {/* Smart Goals Preview */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="text-blue-600 dark:text-blue-400" size={20} />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Metas Ativas</h3>
                    </div>
                </div>
                {smartGoals.filter(g => g.is_active).length > 0 ? (
                    <div className="space-y-4">
                        {smartGoals.filter(g => g.is_active).slice(0, 2).map(goal => (
                            <div key={goal.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{goal.description}</span>
                                    <span className="text-slate-600 dark:text-slate-400">
                                        <PrivacyValue isPrivate={isPrivacyMode} value={goal.saved_value} as="span" animate={isAnimationsEnabled}/> / <PrivacyValue isPrivate={isPrivacyMode} value={goal.target_value} as="span" className="text-xs text-slate-400" animate={isAnimationsEnabled}/>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (goal.saved_value / goal.target_value) * 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma meta ativa.</p>
                )}
            </div>
          </div>

          {/* Sidebar Column: Recent & Breakdown */}
          <div className="space-y-6">
               <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Extrato Recente</h3>
                  <div className="space-y-4">
                      {recentTransactions.map((t, i) => (
                          <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                      {t.type === 'income' ? <ArrowDownRight size={16}/> : <ArrowUpRight size={16}/>}
                                  </div>
                                  <div>
                                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{t.type === 'income' ? t.source : t.description}</p>
                                      <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                  </div>
                              </div>
                              <span className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                  {t.type === 'income' ? '+' : '-'} <PrivacyValue isPrivate={isPrivacyMode} value={t.value} as="span" animate={isAnimationsEnabled} />
                              </span>
                          </div>
                      ))}
                      {recentTransactions.length === 0 && <p className="text-sm text-slate-400 text-center">Nenhuma transação.</p>}
                  </div>
              </div>

               <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-80 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Breakdown</h3>
                  <div className="flex-1 w-full -ml-4">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                    animationDuration={chartDuration}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => isPrivacyMode ? '****' : `R$ ${value.toFixed(2)}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                            </PieChart>
                        </ResponsiveContainer>
                      ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-xs">Sem dados</div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
