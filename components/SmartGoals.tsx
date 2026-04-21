import React, { useState, useMemo, useEffect } from 'react';
import { SmartGoal, Subscription, FixedExpense, Debt, Income, Purchase, AppSettings, PaymentMethod, CategoryLimit, Status } from '../types';
import { CrudHooks } from '../App';
import ViewHeader from './common/ViewHeader';
import { Target, PlusCircle, Sparkles, Loader2, Trash2, CheckCircle, PiggyBank, TrendingUp, AlertTriangle, Edit, X, AlertCircle, ShieldCheck, TrendingDown, ArrowRight, Scissors, ListChecks } from 'lucide-react';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import { formatToUTCDateString, getStatementDateForPurchase } from '../utils/dateUtils';
import PrivacyValue from './common/PrivacyValue';
import ConfirmationModal from './common/ConfirmationModal';
import { GoogleGenAI, Type } from '@google/genai';
import Modal from './common/Modal';

interface SmartGoalsProps {
  smartGoals: SmartGoal[];
  crudHooks: CrudHooks<SmartGoal>;
  appSettings: AppSettings;
  subscriptions: Subscription[];
  fixedExpenses: FixedExpense[];
  debts: Debt[];
  incomes: Income[];
  purchases: Purchase[];
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

type GoalType = 'custom' | 'debt' | 'emergency' | 'reduce_spending';

const getSubscriptionValueInBRL = (subscription: Subscription, settings: AppSettings): number => {
    if (subscription.currency === 'USD') {
        const usdRate = subscription.applied_usd_rate ?? settings.usd_rate;
        const iofRate = subscription.applied_iof_rate ?? settings.iof_rate;
        return subscription.monthly_value * usdRate * (1 + iofRate / 100);
    }
    return subscription.monthly_value;
};

const SmartGoals: React.FC<SmartGoalsProps> = ({ 
    smartGoals, crudHooks, appSettings,
    subscriptions, fixedExpenses, debts, incomes, purchases,
    setIsSidebarOpen, selectedDate,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  // Form States
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState(0);
  const [targetDate, setTargetDate] = useState(formatToUTCDateString(new Date(new Date().setMonth(new Date().getMonth() + 6))));
  
  // Wizard States
  const [goalType, setGoalType] = useState<GoalType>('custom');
  const [emergencyMonths, setEmergencyMonths] = useState(6);
  
  // Manual Editing of Limits
  const [editableLimits, setEditableLimits] = useState<CategoryLimit[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState(1); // 1: Select Type, 2: Configure
  
  // Action States
  const [goalToDelete, setGoalToDelete] = useState<number | null>(null);
  const [goalToAddSavings, setGoalToAddSavings] = useState<SmartGoal | null>(null);
  const [savingsToAdd, setSavingsToAdd] = useState(0);

  // --- Calculations for Context ---
  const currentMonth = selectedDate.getUTCMonth();
  const currentYear = selectedDate.getUTCFullYear();

  // 1. Calculate Average Monthly Income (Historical)
  const avgMonthlyIncome = useMemo(() => {
      if (incomes.length === 0) return 0;
      const uniqueMonths = new Set(incomes.map(i => i.receipt_date.substring(0, 7))).size || 1;
      const totalIncomeAllTime = incomes.reduce((acc, i) => acc + i.value, 0);
      return totalIncomeAllTime / uniqueMonths;
  }, [incomes]);

  // 2. Calculate Current Month Income
  const currentMonthIncome = useMemo(() => {
      return incomes
        .filter(i => {
            const d = new Date(`${i.receipt_date}T00:00:00Z`);
            return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
        })
        .reduce((acc, curr) => acc + curr.value, 0);
  }, [incomes, currentMonth, currentYear]);

  // 3. Base Income for Logic (Max of Current vs Average)
  const baseIncome = Math.max(currentMonthIncome, avgMonthlyIncome);

  // 4. Calculate Real-Time Spending by Category
  const spendingByCategory = useMemo(() => {
      const spending: Record<string, number> = {};
      
      purchases.forEach(p => {
        const card = (appSettings.credit_cards || []).find(c => c.id === p.credit_card_id);
        const stmtDate = getStatementDateForPurchase(p, card);
        // const pMonth = new Date(`${p.purchase_date}T00:00:00Z`).getUTCMonth(); // Unused variable
        const pYear = new Date(`${p.purchase_date}T00:00:00Z`).getUTCFullYear();
        
        let valueToAdd = 0;

        if (p.payment_method === PaymentMethod.CreditCard) {
             if (p.is_installment) {
                const monthsDiff = (currentYear - stmtDate.getUTCFullYear()) * 12 + (currentMonth - stmtDate.getUTCMonth());
                if (monthsDiff >= 0 && monthsDiff < p.installments) {
                    valueToAdd = p.value / p.installments;
                }
             } else if (stmtDate.getUTCMonth() === currentMonth && stmtDate.getUTCFullYear() === currentYear) {
                valueToAdd = p.value;
             }
        } else { // PIX, Boleto, etc
            // For non-card, check against the purchase date or a due date if available.
            // Simplified: check if it falls in current view month/year based on stmt logic (which handles non-card as 1st of month)
            if (stmtDate.getUTCMonth() === currentMonth && stmtDate.getUTCFullYear() === currentYear) {
                valueToAdd = p.value;
            }
        }
        
        if (valueToAdd > 0 && !p.is_refunded) {
             spending[p.category] = (spending[p.category] || 0) + valueToAdd;
        }
      });
      return spending;
  }, [purchases, currentMonth, currentYear, appSettings.credit_cards]);

  // 5. Data for Goal Presets
  const totalActiveDebt = useMemo(() => {
      return debts
        .filter(d => d.status !== Status.Settled && d.status !== Status.Paid)
        .reduce((acc, d) => acc + d.current_value, 0);
  }, [debts]);

  const monthlyCostOfLiving = useMemo(() => {
      const fixed = fixedExpenses.reduce((acc, f) => acc + f.value, 0);
      const subs = subscriptions.filter(s => s.status === Status.Active).reduce((acc, s) => acc + getSubscriptionValueInBRL(s, appSettings), 0);
      return fixed + subs + (appSettings.accounting_cost || 0);
  }, [fixedExpenses, subscriptions, appSettings]);
  
  const totalMonthlySpending = useMemo(() => {
      const variableSpending = (Object.values(spendingByCategory) as number[]).reduce((a, b) => a + b, 0);
      return monthlyCostOfLiving + variableSpending;
  }, [monthlyCostOfLiving, spendingByCategory]);


  const resetForm = () => {
      setDescription('');
      setTargetValue(0);
      setTargetDate(formatToUTCDateString(new Date(new Date().setMonth(new Date().getMonth() + 6))));
      setEditableLimits([]);
      setRecommendations([]);
      setReasoning('');
      setEditingGoalId(null);
      setWizardStep(1);
      setGoalType('custom');
      setError('');
  };

  const handleOpenCreate = () => {
      resetForm();
      setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: SmartGoal) => {
      setDescription(goal.description);
      setTargetValue(goal.target_value);
      setTargetDate(goal.target_date);
      setEditableLimits(goal.category_limits?.limits || []);
      setRecommendations(goal.category_limits?.recommendations || []);
      setReasoning(goal.category_limits?.reasoning || '');
      setEditingGoalId(goal.id);
      
      const storedType = (goal.category_limits as any)?.goalType as GoalType | undefined;
      if (storedType) setGoalType(storedType);
      else {
        // Infer if missing
        if (goal.description.includes('Dívidas')) setGoalType('debt');
        else if (goal.description.includes('Reduzir')) setGoalType('reduce_spending');
        else if (goal.description.includes('Emergência')) setGoalType('emergency');
        else setGoalType('custom');
      }
      
      setWizardStep(2);
      setIsModalOpen(true);
  };

  const handleSelectGoalType = (type: GoalType) => {
      setGoalType(type);
      
      if (type === 'debt') {
          setDescription("Quitar Minhas Dívidas");
          setTargetValue(totalActiveDebt);
      } else if (type === 'emergency') {
          setDescription(`Reserva de Emergência (${emergencyMonths} meses)`);
          setTargetValue(monthlyCostOfLiving * emergencyMonths);
      } else if (type === 'reduce_spending') {
          const reductionPercentage = 0.15; // 15% reduction
          const currentSpend = totalMonthlySpending > 0 ? totalMonthlySpending : baseIncome;
          const targetSpend = currentSpend * (1 - reductionPercentage);
          setDescription(`Teto de Gastos Mensal`);
          setTargetValue(Math.round(targetSpend)); 
      } else {
          setDescription("");
          setTargetValue(0);
      }
      setWizardStep(2);
  };

  useEffect(() => {
      if (goalType === 'emergency' && wizardStep === 2) {
          setTargetValue(monthlyCostOfLiving * emergencyMonths);
          setDescription(`Reserva de Emergência (${emergencyMonths} meses)`);
      }
  }, [emergencyMonths, goalType, monthlyCostOfLiving, wizardStep]);

  const generateAIPlan = async () => {
    if (!description || targetValue <= 0) {
      setError("Por favor, preencha a descrição e o valor alvo.");
      return;
    }
    setIsLoading(true);
    setError('');

    const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});

    const monthlyFixedCosts = monthlyCostOfLiving;
    const incomeForPrompt = baseIncome > 0 ? baseIncome : 5000; 

    let goalContext = "";
    if (goalType === 'debt') {
        goalContext = "CONTEXTO: O usuário quer quitar dívidas. O plano deve ser agressivo em cortes de supérfluos. O valor alvo é o total da dívida.";
    } else if (goalType === 'emergency') {
        goalContext = "CONTEXTO: Reserva de emergência. Foco em consistência.";
    } else if (goalType === 'reduce_spending') {
        goalContext = "CONTEXTO: O usuário quer reduzir despesas. O 'Valor Alvo' aqui representa o TETO DE GASTOS MENSAL desejado. Defina limites estritos para categorias variáveis.";
    } else {
        goalContext = "CONTEXTO: Objetivo geral de compra/sonho.";
    }

    const prompt = `
      Atue como um coach financeiro. Meta: "${description}".
      ${goalContext}
      
      Dados Atuais:
      - Renda Mensal: R$ ${incomeForPrompt.toFixed(2)}
      - Custos Fixos: R$ ${monthlyFixedCosts.toFixed(2)}
      - Valor Alvo/Teto: R$ ${targetValue}
      
      Crie um orçamento.
      1. Limites de gastos (R$) por categoria variável.
      2. Porcentagem da renda.
      3. 3 recomendações curtas.
      4. 1 frase motivacional.

      Retorne JSON estrito.
    `;

    try {
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                limits: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            limit: { type: Type.NUMBER },
                            percentage: { type: Type.NUMBER }
                        },
                        required: ["category", "limit", "percentage"]
                    }
                },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                reasoning: { type: Type.STRING },
            },
            required: ["limits", "recommendations", "reasoning"],
        };
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema },
        });

        const planContent = response.text.trim();
        if (!planContent) throw new Error("Resposta da IA vazia.");

        const result = JSON.parse(planContent);
        setEditableLimits(result.limits);
        setRecommendations(result.recommendations);
        setReasoning(result.reasoning);

    } catch (e: any) {
      console.error("Error creating goal plan:", e);
      setError(e.message || "Erro ao gerar plano com IA.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGoal = async () => {
      if (!description || targetValue <= 0 || editableLimits.length === 0) {
          setError("Preencha os dados e gere/edite o plano de categorias.");
          return;
      }

      const updatedCategoryLimits = {
          limits: editableLimits,
          recommendations,
          reasoning,
          goalType: goalType 
      };

      const goalData = {
          description,
          target_value: targetValue,
          target_date: targetDate,
          category_limits: updatedCategoryLimits as any,
          is_active: true,
      };

      if (editingGoalId) {
          const originalGoal = smartGoals.find(g => g.id === editingGoalId);
          await crudHooks.updateItem({ ...originalGoal!, ...goalData });
      } else {
          await crudHooks.addItem({ ...goalData, saved_value: 0 });
      }
      setIsModalOpen(false);
      resetForm();
  };

  const handleLimitChange = (index: number, field: keyof CategoryLimit, value: string | number) => {
      const newLimits = [...editableLimits];
      newLimits[index] = { ...newLimits[index], [field]: value };
      setEditableLimits(newLimits);
  };

  const handleDeleteLimit = (index: number) => {
      setEditableLimits(editableLimits.filter((_, i) => i !== index));
  };

  const handleAddLimit = () => {
      setEditableLimits([...editableLimits, { category: appSettings.purchase_categories[0], limit: 0, percentage: 0 }]);
  };

  const handleDelete = (id: number) => setGoalToDelete(id);
  
  const confirmDelete = async () => {
    if (goalToDelete) {
        await crudHooks.deleteItem(goalToDelete);
        setGoalToDelete(null);
    }
  };

  const handleAddSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goalToAddSavings && savingsToAdd > 0) {
        await crudHooks.updateItem({ ...goalToAddSavings, saved_value: goalToAddSavings.saved_value + savingsToAdd });
        setSavingsToAdd(0);
        setGoalToAddSavings(null);
    }
  };

  // --- Render Logic for different Goal Types ---

  const renderDebtProgress = (goal: SmartGoal) => {
      // Snowball Sort: Lowest CURRENT value first (Focus on closing smaller balances)
      const sortedDebts = [...debts].sort((a, b) => a.current_value - b.current_value);
      
      const totalOriginal = sortedDebts.reduce((acc, d) => acc + d.original_value, 0);
      const totalCurrent = sortedDebts.reduce((acc, d) => d.status === Status.Settled || d.status === Status.Paid ? 0 : acc + d.current_value, 0);
      const totalPaid = Math.max(0, totalOriginal - totalCurrent);
      const progress = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;

      // Identify the first debt that is NOT settled/paid
      const currentFocusId = sortedDebts.find(d => d.status !== Status.Settled && d.status !== Status.Paid)?.id;

      return (
          <div className="space-y-4">
               <div className="mb-4 p-5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Progresso da Quitação</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            <PrivacyValue isPrivate={false} value={totalPaid} as="span" animate={isAnimationsEnabled} /> 
                            <span className="text-slate-400 text-sm font-normal mx-1">/</span> 
                            <PrivacyValue isPrivate={false} value={totalOriginal} as="span" className="text-slate-500 text-sm" animate={isAnimationsEnabled} />
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 relative overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-red-500 to-green-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, progress)}%` }}></div>
                    </div>
                     <p className="text-xs text-slate-500 text-center">Atualize o status das dívidas na aba 'Dívidas' para ver o progresso.</p>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <ListChecks className="text-blue-600" size={18}/>
                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Plano Bola de Neve (Checklist)</h4>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {sortedDebts.map(debt => {
                            const isPaid = debt.status === Status.Settled || debt.status === Status.Paid;
                            const isFocus = debt.id === currentFocusId;
                            
                            return (
                                <div key={debt.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isPaid ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50 opacity-70' : isFocus ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700/30 dark:border-slate-700'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isPaid ? 'bg-green-500 border-green-500 text-white' : 'border-slate-400 text-transparent'}`}>
                                            {isPaid && <CheckCircle size={14}/>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm font-medium ${isPaid ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-white'}`}>{debt.description}</p>
                                                {isFocus && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded-full">FOCO ATUAL</span>}
                                            </div>
                                            <p className="text-xs text-slate-500">{debt.creditor}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold ${isPaid ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                        <PrivacyValue isPrivate={false} value={debt.current_value} as="span" animate={isAnimationsEnabled} />
                                    </span>
                                </div>
                            );
                        })}
                        {sortedDebts.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhuma dívida cadastrada.</p>}
                    </div>
                </div>
          </div>
      );
  };

  const renderReduceSpendingProgress = (goal: SmartGoal) => {
      // Goal Value is the "Limit" (Teto).
      const percentageSpent = goal.target_value > 0 ? (totalMonthlySpending / goal.target_value) * 100 : 0;
      const isOverBudget = totalMonthlySpending > goal.target_value;
      const remaining = goal.target_value - totalMonthlySpending;
      
      return (
           <div className="space-y-4">
                <div className="mb-4 p-5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Gasto vs. Teto</span>
                        <span className={`text-lg font-bold ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                            <PrivacyValue isPrivate={false} value={totalMonthlySpending} as="span" animate={isAnimationsEnabled} /> 
                            <span className="text-slate-400 text-sm font-normal mx-1">/</span> 
                            <PrivacyValue isPrivate={false} value={goal.target_value} as="span" className="text-slate-500 text-sm" animate={isAnimationsEnabled} />
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 relative overflow-hidden mb-2">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-red-500' : percentageSpent > 85 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                            style={{ width: `${Math.min(100, percentageSpent)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                        {isOverBudget 
                            ? `Você excedeu o teto em ${((totalMonthlySpending - goal.target_value)).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.` 
                            : `Parabéns! Você está economizando ${remaining.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} em relação à meta.`}
                    </p>
                </div>
                
                 {/* Category Breakdown for Reduction */}
                 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm">Limites Sugeridos pela IA</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                         {goal.category_limits?.limits.map((limit, i) => {
                                const spent = spendingByCategory[limit.category] || 0;
                                const percent = limit.limit > 0 ? (spent / limit.limit) * 100 : 0;
                                const over = spent > limit.limit;
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={over ? 'text-red-600 font-semibold' : 'text-slate-600 dark:text-slate-300'}>{limit.category}</span>
                                            <span>
                                                 <PrivacyValue isPrivate={false} value={spent} as="span" animate={isAnimationsEnabled} /> / <PrivacyValue isPrivate={false} value={limit.limit} as="span" animate={isAnimationsEnabled} />
                                            </span>
                                        </div>
                                         <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                                        </div>
                                    </div>
                                )
                         })}
                    </div>
                 </div>
           </div>
      );
  };

  return (
    <>
    <ConfirmationModal isOpen={!!goalToDelete} onClose={() => setGoalToDelete(null)} onConfirm={confirmDelete} title="Excluir Meta">
        Tem certeza? Todo o progresso desta meta será perdido.
    </ConfirmationModal>

    {/* CREATE / EDIT MODAL */}
    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingGoalId ? "Editar Meta & Orçamento" : "Planejador de Metas"}>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            
            {/* STEP 1: WIZARD TYPE SELECTION */}
            {!editingGoalId && wizardStep === 1 && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Qual é o seu principal objetivo financeiro no momento?</p>
                    
                    <button onClick={() => handleSelectGoalType('reduce_spending')} className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group text-left">
                        <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <Scissors size={24}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400">Diminuir Despesas</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Define um teto de gastos e monitora automaticamente seu progresso mensal.
                            </p>
                        </div>
                    </button>

                    <button onClick={() => handleSelectGoalType('debt')} className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group text-left">
                        <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                            <TrendingDown size={24}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-red-700 dark:group-hover:text-red-400">Sair das Dívidas</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gera um checklist automático (Bola de Neve) baseado nas suas dívidas cadastradas.</p>
                        </div>
                    </button>

                    <button onClick={() => handleSelectGoalType('emergency')} className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group text-left">
                         <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                            <ShieldCheck size={24}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400">Reserva de Emergência</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Calcula sua segurança baseada no seu custo de vida mensal (aprox. <PrivacyValue isPrivate={false} value={monthlyCostOfLiving} as="span" animate={isAnimationsEnabled} />).</p>
                        </div>
                    </button>

                    <button onClick={() => handleSelectGoalType('custom')} className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group text-left">
                         <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">Meta Personalizada</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Viagem, carro novo, casamento ou qualquer outro sonho.</p>
                        </div>
                    </button>
                </div>
            )}

            {/* STEP 2: CONFIGURATION */}
            {wizardStep === 2 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                 {!editingGoalId && (
                    <button onClick={() => setWizardStep(1)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-2 flex items-center gap-1">
                        &larr; Voltar para tipos
                    </button>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Objetivo</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" />
                </div>
                
                 {/* Special Input for Emergency Fund */}
                 {goalType === 'emergency' && (
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg mb-2">
                         <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Quantos meses de segurança?</label>
                         <div className="flex gap-2">
                             {[3, 6, 12].map(m => (
                                 <button 
                                    key={m} 
                                    onClick={() => setEmergencyMonths(m)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md border ${emergencyMonths === m ? 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}
                                 >
                                     {m} Meses
                                 </button>
                             ))}
                         </div>
                     </div>
                 )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {goalType === 'reduce_spending' ? 'Teto de Gastos (R$)' : 'Valor Alvo (R$)'}
                        </label>
                        <CurrencyInput value={targetValue} onChange={setTargetValue} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" />
                         {goalType === 'debt' && <p className="text-[10px] text-slate-400 mt-1">Soma automática das dívidas ativas.</p>}
                         {goalType === 'emergency' && <p className="text-[10px] text-slate-400 mt-1">Baseado no custo fixo mensal.</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Alvo</label>
                        <DatePicker value={targetDate} onChange={setTargetDate} />
                    </div>
                </div>

                {/* AI Generator Button */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2"><Sparkles size={16}/> Inteligência Artificial</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        A IA analisará seus dados para criar um plano estratégico para "{description}".
                    </p>
                    <button onClick={generateAIPlan} disabled={isLoading} className="w-full py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : (
                            <>
                                <span>Gerar Plano</span>
                                <ArrowRight size={14}/>
                            </>
                        )}
                    </button>
                </div>

                {/* Resulting Plan */}
                {editableLimits.length > 0 && (
                    <div className="space-y-3 border-t dark:border-slate-700 pt-4 animate-in slide-in-from-bottom-4 fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium text-slate-800 dark:text-white">Limites Recomendados</h4>
                            <button onClick={handleAddLimit} className="text-xs text-blue-600 hover:underline">+ Adicionar</button>
                        </div>
                        {editableLimits.map((limit, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <select 
                                    value={limit.category} 
                                    onChange={(e) => handleLimitChange(index, 'category', e.target.value)}
                                    className="w-1/3 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded"
                                >
                                    {appSettings.purchase_categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="relative w-1/4">
                                    <input 
                                        type="number" 
                                        value={limit.percentage || 0} 
                                        onChange={(e) => handleLimitChange(index, 'percentage', parseFloat(e.target.value))}
                                        className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded"
                                    />
                                    <span className="absolute right-2 top-1 text-slate-400">%</span>
                                </div>
                                <div className="w-1/3">
                                    <CurrencyInput 
                                        value={limit.limit} 
                                        onChange={(val) => handleLimitChange(index, 'limit', val)} 
                                        className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded"
                                    />
                                </div>
                                <button onClick={() => handleDeleteLimit(index)} className="text-red-500 hover:text-red-700"><X size={16}/></button>
                            </div>
                        ))}
                        {reasoning && (
                            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                                <p className="text-xs italic text-slate-600 dark:text-slate-300">"{reasoning}"</p>
                            </div>
                        )}
                    </div>
                )}
                
                {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
            )}

            {wizardStep === 2 && (
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                    <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-md">Cancelar</button>
                    <button onClick={handleSaveGoal} className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md font-medium">Salvar Meta</button>
                </div>
            )}
        </div>
    </Modal>

    {/* ADD SAVINGS MODAL */}
    <Modal isOpen={!!goalToAddSavings} onClose={() => setGoalToAddSavings(null)} title="Adicionar Economia">
        <form onSubmit={handleAddSavings} className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Quanto você guardou para <strong>{goalToAddSavings?.description}</strong>?</p>
            <CurrencyInput value={savingsToAdd} onChange={setSavingsToAdd} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm" autoFocus />
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setGoalToAddSavings(null)} className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-md">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md">Confirmar</button>
            </div>
        </form>
    </Modal>

    <div className="space-y-6">
      <ViewHeader 
        title="Metas Inteligentes" setIsSidebarOpen={setIsSidebarOpen} selectedDate={selectedDate}
        isPrivacyMode={isPrivacyMode} setIsPrivacyMode={setIsPrivacyMode}
        isAnimationsEnabled={isAnimationsEnabled} setIsAnimationsEnabled={setIsAnimationsEnabled}
      >
         <button onClick={handleOpenCreate} className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto">
            <PlusCircle size={18} /> Nova Meta
          </button>
      </ViewHeader>

      {smartGoals.length > 0 ? (
        <div className="grid grid-cols-1 gap-8">
            {smartGoals.map(goal => {
                const storedType = (goal.category_limits as any)?.goalType as GoalType | undefined;
                const currentType = storedType || 'custom'; // Fallback for old records

                return (
                <div key={goal.id} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    {/* Header Actions */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button onClick={() => handleOpenEdit(goal)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-full transition-colors" title="Editar Meta"><Edit size={18}/></button>
                        <button onClick={() => handleDelete(goal.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-full transition-colors" title="Excluir Meta"><Trash2 size={18}/></button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                {currentType === 'debt' && <TrendingDown className="text-red-500" size={24} />}
                                {currentType === 'reduce_spending' && <Scissors className="text-purple-500" size={24} />}
                                {currentType === 'emergency' && <ShieldCheck className="text-green-500" size={24} />}
                                {currentType === 'custom' && <Target className="text-blue-600" size={24} />}
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{goal.description}</h2>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Alvo: {new Date(`${goal.target_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                    </div>

                    {/* RENDER DIFFERENT BODY BASED ON TYPE */}
                    {currentType === 'debt' ? renderDebtProgress(goal) : 
                     currentType === 'reduce_spending' ? renderReduceSpendingProgress(goal) : 
                     (
                        // Default for Custom / Emergency (Accumulation)
                        <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Progresso da Economia</span>
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    <PrivacyValue isPrivate={false} value={goal.saved_value} as="span" animate={isAnimationsEnabled} /> 
                                    <span className="text-slate-400 text-sm font-normal mx-1">/</span> 
                                    <PrivacyValue isPrivate={false} value={goal.target_value} as="span" className="text-slate-500 text-sm" animate={isAnimationsEnabled} />
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 relative overflow-hidden mb-4">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (goal.saved_value / goal.target_value) * 100)}%` }}></div>
                            </div>
                            <button onClick={() => setGoalToAddSavings(goal)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-transform active:scale-95">
                                <PiggyBank size={16} /> Registrar Depósito
                            </button>
                        </div>
                    )}

                    {/* Common Recommendations Section */}
                    <div className={`grid grid-cols-1 ${currentType !== 'reduce_spending' && currentType !== 'debt' ? 'lg:grid-cols-2' : ''} gap-6`}>
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div className="flex items-center gap-2 mb-3 text-blue-800 dark:text-blue-300">
                                <Sparkles size={18} />
                                <h3 className="font-semibold">Plano Estratégico</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 italic">"{goal.category_limits?.reasoning}"</p>
                            <ul className="space-y-2.5">
                                {goal.category_limits?.recommendations.map((rec, i) => (
                                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2.5 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                        <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0"/>
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Show Budget only for Custom/Emergency accumulation goals (Others have specific views) */}
                        {(currentType === 'custom' || currentType === 'emergency') && (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="text-slate-700 dark:text-slate-300" size={18} />
                                        <h3 className="font-semibold text-slate-800 dark:text-white">Orçamento Mensal</h3>
                                    </div>
                                </div>
                                
                                <div className="space-y-4 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                    {goal.category_limits?.limits.map((limit, i) => {
                                        const effectiveLimit = (limit.percentage && baseIncome > 0) 
                                            ? (baseIncome * (limit.percentage / 100)) 
                                            : limit.limit;
                                        
                                        const spent = spendingByCategory[limit.category] || 0;
                                        const percentUsed = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : (spent > 0 ? 100 : 0);
                                        const barColor = percentUsed > 100 ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-500' : 'bg-green-500';
                                        const isOver = percentUsed > 100;

                                        return (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-1.5">
                                                    <span className={`font-medium ${isOver ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'} flex items-center gap-1`}>
                                                        {limit.category}
                                                        {isOver && <AlertCircle size={12} className="text-red-500"/>}
                                                    </span>
                                                    <div className="text-right text-xs">
                                                        <span className={`${isOver ? 'text-red-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            <PrivacyValue isPrivate={false} value={spent} as="span" animate={isAnimationsEnabled} />
                                                        </span>
                                                        <span className="text-slate-400 mx-1">/</span>
                                                        <span className="text-slate-500">
                                                            <PrivacyValue isPrivate={false} value={effectiveLimit} as="span" animate={isAnimationsEnabled} />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                                                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, percentUsed)}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )})}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-xl shadow-sm text-center border border-dashed border-slate-300 dark:border-slate-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-blue-600 dark:text-blue-400"/>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Comece a Planejar seu Futuro</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Defina um objetivo (viagem, carro, reserva) e nossa IA criará um plano de gastos personalizado para você.</p>
            <button onClick={handleOpenCreate} className="inline-flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-semibold py-3 px-8 rounded-full shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                <PlusCircle size={20} /> Criar Minha Primeira Meta
            </button>
        </div>
      )}
    </div>
    </>
  );
};

export default SmartGoals;