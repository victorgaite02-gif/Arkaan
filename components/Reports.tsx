import React, { useState, useMemo, useEffect } from 'react';
import { Subscription, FixedExpense, Debt, Debtor, Income, AppSettings, Purchase, Status } from '../types';
import ViewHeader from './common/ViewHeader';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Wallet, PieChart as PieIcon, BarChart3, Share2, AlertTriangle, CheckCircle, AlertOctagon, Lightbulb } from 'lucide-react';
import { getStatementDateForPurchase } from '../utils/dateUtils';
import { GoogleGenAI, Type } from '@google/genai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PrivacyValue from './common/PrivacyValue';

interface ReportsProps {
  subscriptions: Subscription[];
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  debtors: Debtor[];
  incomes: Income[];
  purchases: Purchase[];
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

interface AIReportData {
    healthScore: number;
    headline: string;
    tone: 'positive' | 'neutral' | 'warning' | 'critical';
    summary: string;
    spendingAnalysis: string;
    actionItems: string[];
}

const getSubscriptionValueInBRL = (subscription: Subscription, settings: AppSettings): number => {
    if (subscription.currency === 'USD') {
        const usdRate = subscription.applied_usd_rate ?? settings.usd_rate;
        const iofRate = subscription.applied_iof_rate ?? settings.iof_rate;
        return subscription.monthly_value * usdRate * (1 + iofRate / 100);
    }
    return subscription.monthly_value;
};

const Reports: React.FC<ReportsProps> = ({ 
    subscriptions, fixedExpenses, debts, debtors, incomes, purchases, 
    appSettings, setIsSidebarOpen, selectedDate, isPrivacyMode, setIsPrivacyMode,
    isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  
  const chartDuration = isAnimationsEnabled ? 2500 : 0;
  
  const monthName = selectedDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
  const year = selectedDate.getUTCFullYear();
  const reportKey = `arkan_report_json_${appSettings.user_id}_${year}_${selectedDate.getUTCMonth()}`;

  // Load saved report from local storage on date change
  useEffect(() => {
      const saved = localStorage.getItem(reportKey);
      if (saved) {
          try {
            setAiReport(JSON.parse(saved));
          } catch (e) {
            console.error("Failed to parse saved report", e);
            setAiReport(null);
          }
      } else {
          setAiReport(null);
      }
  }, [reportKey]);

  const { financialContext, chartData, categoryData } = useMemo(() => {
    const month = selectedDate.getUTCMonth();
    const year = selectedDate.getUTCFullYear();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    
    // 1. Setup Structures
    const dailyFlow: Record<number, { day: number, income: number, expense: number }> = {};
    for (let i = 1; i <= daysInMonth; i++) dailyFlow[i] = { day: i, income: 0, expense: 0 };
    
    const categoryTotals: Record<string, number> = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    // 2. Process Incomes
    incomes.forEach(i => { 
        const d = new Date(`${i.receipt_date}T00:00:00Z`); 
        if (d.getUTCMonth() === month && d.getUTCFullYear() === year) {
            totalIncome += i.value;
            if (dailyFlow[d.getUTCDate()]) dailyFlow[d.getUTCDate()].income += i.value;
        }
    });

    // 3. Process Expenses
    // Subscriptions
    subscriptions.forEach(s => { 
        const sd = new Date(`${s.start_date}T00:00:00Z`); 
        const isActive = !(sd > new Date(Date.UTC(year, month + 1, 0))) && 
                         !(s.cancellation_date && new Date(`${s.cancellation_date}T00:00:00Z`) < new Date(Date.UTC(year, month, 1)));
        
        if (isActive) {
            const val = getSubscriptionValueInBRL(s, appSettings);
            totalExpenses += val;
            categoryTotals[s.category] = (categoryTotals[s.category] || 0) + val;
            const day = Math.min(s.billing_date, daysInMonth);
            if (dailyFlow[day]) dailyFlow[day].expense += val;
        }
    });

    // Fixed Expenses
    fixedExpenses.forEach(f => {
        totalExpenses += f.value;
        categoryTotals[f.category] = (categoryTotals[f.category] || 0) + f.value;
        const day = Math.min(f.due_date, daysInMonth);
        if (dailyFlow[day]) dailyFlow[day].expense += f.value;
    });

    // Purchases
    purchases.forEach(p => { 
        if (p.is_refunded) return;
        
        const card = (appSettings.credit_cards || []).find(c => c.id === p.credit_card_id); 
        const statementDate = getStatementDateForPurchase(p, card);
        
        let val = 0;
        let day = 1; 

        if (p.is_installment) { 
            const monthsDiff = (year - statementDate.getUTCFullYear()) * 12 + (month - statementDate.getUTCMonth()); 
            if (monthsDiff >= 0 && monthsDiff < p.installments) {
                val = p.value / p.installments;
                day = card?.dueDate ? Math.min(card.dueDate, daysInMonth) : 1;
            }
        } else if (statementDate.getUTCMonth() === month && statementDate.getUTCFullYear() === year) { 
            val = p.value;
            if (p.payment_method === 'Cartão de Crédito' && card?.dueDate) {
                 day = Math.min(card.dueDate, daysInMonth);
            } else {
                 const pDate = new Date(`${p.purchase_date}T00:00:00Z`);
                 day = pDate.getUTCDate();
            }
        } 
        
        if (val > 0) {
            totalExpenses += val;
            categoryTotals[p.category] = (categoryTotals[p.category] || 0) + val;
            if (dailyFlow[day]) dailyFlow[day].expense += val;
        }
    });

    // Calculate Total Accumulated Debt (Stock)
    const totalAccumulatedDebt = debts
        .filter(d => d.status !== Status.Settled && d.status !== Status.Paid)
        .reduce((acc, d) => acc + d.current_value, 0);

    // 4. Finalize Data
    const topExpenses = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const chartDataArr = Object.values(dailyFlow);
    const pieDataArr = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .filter(i => i.value > 0)
        .sort((a, b) => b.value - a.value);

    return {
      financialContext: {
          totalIncome,
          totalExpenses,
          finalBalance: totalIncome - totalExpenses,
          savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
          topExpensesStr: topExpenses.map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`).join(', '),
          totalAccumulatedDebt 
      },
      chartData: chartDataArr,
      categoryData: pieDataArr
    };
  }, [selectedDate, incomes, subscriptions, fixedExpenses, purchases, appSettings, debts]);

  const generateSummary = async () => {
    setIsLoading(true);
    setAiReport(null);
    
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});

    const prompt = `
      Você é um consultor financeiro sênior analítico e realista.
      Analise os dados financeiros de ${appSettings.user_name} para ${monthName}/${year}.

      DADOS DO MÊS:
      - Entradas: R$ ${financialContext.totalIncome.toFixed(2)}
      - Saídas: R$ ${financialContext.totalExpenses.toFixed(2)}
      - Saldo do Mês: R$ ${financialContext.finalBalance.toFixed(2)}
      - Taxa de Economia: ${financialContext.savingsRate.toFixed(1)}%
      
      CONTEXTO GERAL DE DÍVIDAS:
      - Dívida Total Acumulada: R$ ${financialContext.totalAccumulatedDebt.toFixed(2)}
      
      MAIORES GASTOS:
      - ${financialContext.topExpensesStr}

      INSTRUÇÕES CRÍTICAS:
      1. Se houver Dívida Total Acumulada alta (acima de zero), o tom DEVE ser de ALERTA ou CAUTELA. Não elogie um saldo positivo se a pessoa está endividada; o saldo deve ser sugerido para abater a dívida.
      2. Se o saldo for negativo, o tom é crítico.
      3. Seja direto.
      
      Retorne APENAS um JSON com a seguinte estrutura:
      {
        "healthScore": number (0 a 100 - Se tiver dívida alta, a nota deve ser baixa, < 60),
        "headline": string (Título curto de 3-5 palavras resumindo a situação),
        "tone": "positive" | "neutral" | "warning" | "critical",
        "summary": string (Parágrafo de 2-3 frases com o diagnóstico),
        "spendingAnalysis": string (Análise sobre onde foi o dinheiro),
        "actionItems": string[] (Lista de 3 ações práticas e curtas)
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        healthScore: { type: Type.NUMBER },
                        headline: { type: Type.STRING },
                        tone: { type: Type.STRING, enum: ["positive", "neutral", "warning", "critical"] },
                        summary: { type: Type.STRING },
                        spendingAnalysis: { type: Type.STRING },
                        actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["healthScore", "headline", "tone", "summary", "spendingAnalysis", "actionItems"]
                }
            }
        });
        
        const reportText = response.text;
        if (!reportText) throw new Error("Resposta vazia da IA");
        
        const parsedReport: AIReportData = JSON.parse(reportText);
        setAiReport(parsedReport);
        localStorage.setItem(reportKey, JSON.stringify(parsedReport));

    } catch (error: any) {
        console.error("Error generating AI summary:", error);
        alert("Erro ao gerar relatório. Tente novamente.");
    } finally {
        setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
      if (score >= 80) return 'text-green-500';
      if (score >= 60) return 'text-blue-500';
      if (score >= 40) return 'text-yellow-500';
      return 'text-red-500';
  };

  const getToneStyles = (tone: string) => {
      switch (tone) {
          case 'positive': return { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-200', icon: CheckCircle };
          case 'warning': return { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-200', icon: AlertTriangle };
          case 'critical': return { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-200', icon: AlertOctagon };
          default: return { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-800 dark:text-slate-200', icon: Sparkles };
      }
  };

  return (
    <div className="space-y-8 pb-10">
      <ViewHeader 
        title="Relatório Mensal" 
        setIsSidebarOpen={setIsSidebarOpen} 
        selectedDate={selectedDate}
        isPrivacyMode={isPrivacyMode}
        setIsPrivacyMode={setIsPrivacyMode}
        isAnimationsEnabled={isAnimationsEnabled}
        setIsAnimationsEnabled={setIsAnimationsEnabled}
      />

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-t-4 border-green-500">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Receitas</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1"><PrivacyValue isPrivate={isPrivacyMode} value={financialContext.totalIncome} animate={isAnimationsEnabled} /></h3>
                  </div>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                      <TrendingUp size={20}/>
                  </div>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-t-4 border-red-500">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Despesas</p>
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1"><PrivacyValue isPrivate={isPrivacyMode} value={financialContext.totalExpenses} animate={isAnimationsEnabled} /></h3>
                  </div>
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                      <TrendingDown size={20}/>
                  </div>
              </div>
          </div>
          <div className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-t-4 ${financialContext.finalBalance >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldo do Mês</p>
                      <h3 className={`text-2xl font-bold mt-1 ${financialContext.finalBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          <PrivacyValue isPrivate={isPrivacyMode} value={financialContext.finalBalance} animate={isAnimationsEnabled} />
                      </h3>
                  </div>
                  <div className={`p-2 rounded-lg ${financialContext.finalBalance >= 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'}`}>
                      <Wallet size={20}/>
                  </div>
              </div>
          </div>
          
          {/* Replace Savings Rate with Total Debt Context if debt exists */}
          {financialContext.totalAccumulatedDebt > 0 ? (
             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-t-4 border-red-600">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dívida Total</p>
                        <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                            <PrivacyValue isPrivate={isPrivacyMode} value={financialContext.totalAccumulatedDebt} animate={isAnimationsEnabled} />
                        </h3>
                    </div>
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                        <AlertOctagon size={20}/>
                    </div>
                </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border-t-4 border-indigo-500">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Taxa de Economia</p>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                            {isPrivacyMode ? '***' : `${financialContext.savingsRate.toFixed(1)}%`}
                        </h3>
                    </div>
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                        <PieIcon size={20}/>
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* AI ANALYSIS SECTION */}
      <div className="relative">
          {!aiReport ? (
             <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-2xl shadow-lg text-center border border-slate-700">
                 <div className="max-w-2xl mx-auto">
                    <Sparkles size={48} className="text-yellow-400 mx-auto mb-4 opacity-80"/>
                    <h2 className="text-2xl font-bold mb-2">Análise Inteligente</h2>
                    <p className="text-slate-400 mb-6">
                        Nossa IA pode analisar suas receitas, despesas e dívidas para gerar um diagnóstico preciso e realista da sua situação financeira neste mês.
                    </p>
                    <button 
                        onClick={generateSummary} 
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold transition-all disabled:opacity-50 shadow-lg shadow-blue-500/30"
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                        {isLoading ? 'Analisando Dados...' : 'Gerar Diagnóstico Financeiro'}
                    </button>
                 </div>
             </div>
          ) : (
             <div className="animate-in fade-in slide-in-from-bottom-4">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                         <Sparkles className="text-blue-600" size={24}/> Diagnóstico do Mês
                     </h2>
                     <button onClick={generateSummary} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                         <Share2 size={12}/> Atualizar Análise
                     </button>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     {/* Left Column: Score & Headline */}
                     <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                         <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                             <svg className="w-full h-full transform -rotate-90">
                                 <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-700" />
                                 <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={351.86} strokeDashoffset={351.86 - (351.86 * aiReport.healthScore) / 100} className={`${getScoreColor(aiReport.healthScore)} ${isAnimationsEnabled ? 'transition-all duration-1000 ease-out' : ''}`} strokeLinecap="round" />
                             </svg>
                             <div className="absolute inset-0 flex flex-col items-center justify-center">
                                 <span className={`text-3xl font-bold ${getScoreColor(aiReport.healthScore)}`}>{aiReport.healthScore}</span>
                                 <span className="text-xs text-slate-400 uppercase font-semibold">Score</span>
                             </div>
                         </div>
                         <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{aiReport.headline}</h3>
                         <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getToneStyles(aiReport.tone).bg} ${getToneStyles(aiReport.tone).text}`}>
                             Situação {aiReport.tone === 'critical' ? 'Crítica' : aiReport.tone === 'warning' ? 'Atenção' : aiReport.tone === 'positive' ? 'Saudável' : 'Estável'}
                         </span>
                     </div>

                     {/* Right Column: Analysis & Actions */}
                     <div className="lg:col-span-2 space-y-4">
                         {/* Summary Card */}
                         <div className={`p-5 rounded-xl border ${getToneStyles(aiReport.tone).bg} ${getToneStyles(aiReport.tone).border}`}>
                             <div className="flex gap-3">
                                 <div className={`mt-1 ${getToneStyles(aiReport.tone).text}`}>
                                     {React.createElement(getToneStyles(aiReport.tone).icon, { size: 24 })}
                                 </div>
                                 <div>
                                     <h4 className={`font-bold mb-1 ${getToneStyles(aiReport.tone).text}`}>Resumo</h4>
                                     <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{aiReport.summary}</p>
                                 </div>
                             </div>
                         </div>

                         {/* Spending Analysis */}
                         <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                             <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-sm flex items-center gap-2">
                                 <PieIcon size={16} className="text-indigo-500"/> Análise de Gastos
                             </h4>
                             <p className="text-sm text-slate-600 dark:text-slate-400">{aiReport.spendingAnalysis}</p>
                         </div>

                         {/* Action Items */}
                         <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                             <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                                 <Lightbulb size={16} className="text-yellow-500"/> Plano de Ação
                             </h4>
                             <ul className="space-y-2">
                                 {aiReport.actionItems.map((item, idx) => (
                                     <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg">
                                         <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                                             {idx + 1}
                                         </div>
                                         {item}
                                     </li>
                                 ))}
                             </ul>
                         </div>
                     </div>
                 </div>
             </div>
          )}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DAILY FLOW CHART */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="text-blue-600 dark:text-blue-400" size={20}/>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Fluxo de Caixa Diário</h3>
              </div>
              <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                              formatter={(value: number) => isPrivacyMode ? '****' : `R$ ${value.toFixed(0)}`}
                              labelFormatter={(day) => `Dia ${day}`}
                          />
                          <Bar dataKey="income" name="Entrada" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" animationDuration={chartDuration} />
                          <Bar dataKey="expense" name="Saída" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="b" animationDuration={chartDuration} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* CATEGORY PIE CHART */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                  <PieIcon className="text-indigo-600 dark:text-indigo-400" size={20}/>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Por Categoria</h3>
              </div>
              <div className="flex-1 min-h-[300px]">
                  {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={categoryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={2}
                                  dataKey="value"
                                  animationDuration={chartDuration}
                              >
                                  {categoryData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                  ))}
                              </Pie>
                              <Tooltip 
                                   formatter={(value: number) => isPrivacyMode ? '****' : `R$ ${value.toFixed(2)}`}
                                   contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                              />
                              <Legend 
                                  layout="horizontal" 
                                  verticalAlign="bottom" 
                                  align="center" 
                                  wrapperStyle={{fontSize: '11px', paddingTop: '20px'}} 
                                  formatter={(value, entry: any) => <span className="text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                              />
                          </PieChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <PieIcon size={48} className="opacity-20 mb-2"/>
                          <p className="text-sm">Sem dados suficientes.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Reports;