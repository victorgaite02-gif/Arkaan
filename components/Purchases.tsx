
import React, { useState, useMemo } from 'react';
import { Purchase, AppSettings, CreditCard, Person, ViewFilterType, Refund, PaymentMethod } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle, User, ArrowDownUp, Tag, ChevronDown, RotateCcw, Search, CalendarDays, Wallet, CreditCard as CreditCardIcon, QrCode, Banknote, FileText, Check, Sparkles, X } from 'lucide-react';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import { getStatementDateForPurchase, formatToUTCDateString } from '../utils/dateUtils';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import PrivacyValue from './common/PrivacyValue';
import { getPaymentMethodIcon } from '../utils/styleUtils';
import SelectableTag from './common/SelectableTag';

interface PurchasesProps {
  purchases: Purchase[];
  refunds: Refund[];
  crudHooks: CrudHooks<Purchase>;
  handleAddRefund: (purchase: Purchase) => Promise<void>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
  viewFilter: ViewFilterType;
  setViewFilter: (filter: ViewFilterType) => void;
}

type SortOption = 'purchase_date' | 'created_at';

type PurchaseFormData = {
  description: string;
  notes: string;
  category: string;
  value: number;
  purchase_date: string;
  payment_method: string;
  is_installment: boolean;
  installments: number;
  person_id?: string;
  credit_card_id?: string;
};

const calculatePaidInstallments = (purchase: Purchase, currentDate: Date, card?: CreditCard): number => {
    if (!purchase.is_installment) return 1;
    const firstPaymentStatementDate = getStatementDateForPurchase(purchase, card);
    const monthsPassed = (currentDate.getUTCFullYear() - firstPaymentStatementDate.getUTCFullYear()) * 12 + (currentDate.getUTCMonth() - firstPaymentStatementDate.getUTCMonth());
    const paidCount = monthsPassed + 1;
    return Math.max(0, Math.min(purchase.installments, paidCount));
};

const Purchases: React.FC<PurchasesProps> = ({ 
    purchases, refunds, crudHooks, handleAddRefund, appSettings, setIsSidebarOpen, 
    selectedDate, setSelectedDate, isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled,
    viewFilter, setViewFilter
}) => {
  const emptyPurchase: PurchaseFormData = {
    description: '', notes: '', category: appSettings.purchase_categories[0] || '',
    value: 0, purchase_date: formatToUTCDateString(new Date()),
    payment_method: '', // Start empty to force selection
    is_installment: false, installments: 2, person_id: '', credit_card_id: (appSettings.credit_cards && appSettings.credit_cards[0]?.id) || '',
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<number | null>(null);
  const [purchaseToRefund, setPurchaseToRefund] = useState<Purchase | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState<PurchaseFormData>(emptyPurchase);
  const [sortOption, setSortOption] = useState<SortOption>('purchase_date');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();
  
  const getPersonNameById = (id?: string): string => appSettings.people.find(p => p.id === id)?.name || '';
  
  const purchasesForReview = useMemo(() => {
    return purchases.filter(p => p.pending_review)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [purchases]);
  
  const filteredPurchases = useMemo(() => {
    let basePurchases = viewFilter === 'own' 
      ? purchases.filter(p => !p.person_id && !p.pending_review) 
      : purchases.filter(p => !p.pending_review);

    if (categoryFilter !== 'all') {
      basePurchases = basePurchases.filter(p => p.category === categoryFilter);
    }
    
    if (searchQuery.trim() === '') {
      return basePurchases;
    }

    const lowercasedQuery = searchQuery.toLowerCase();

    return basePurchases.filter(p => {
      const formattedDate = new Date(`${p.purchase_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      const formattedValue = p.value.toFixed(2).replace('.', ',');

      return (
        p.description.toLowerCase().includes(lowercasedQuery) ||
        p.category.toLowerCase().includes(lowercasedQuery) ||
        formattedValue.includes(lowercasedQuery) ||
        p.value.toString().includes(lowercasedQuery) || // also check raw number
        formattedDate.includes(lowercasedQuery)
      );
    });
  }, [purchases, categoryFilter, viewFilter, searchQuery]);

  const {
    endingThisMonth,
    installments,
    oneTime,
    totalMonthlyStatement,
    totalRemainingInstallmentBalance,
    oneTimeTotal,
    installmentsTotal,
    endingThisMonthTotal,
    refundsThisMonth,
  } = useMemo(() => {
    const sortedPurchases = [...filteredPurchases].sort((a, b) => {
        const dateA = new Date(a[sortOption] || a.purchase_date);
        const dateB = new Date(b[sortOption] || b.purchase_date);
        return dateB.getTime() - dateA.getTime();
    });

    const groups = {
        endingThisMonth: [] as Purchase[],
        installments: [] as Purchase[],
        oneTime: [] as Purchase[]
    };
    let monthlyTotal = 0;
    let remainingBalance = 0;

    for (const p of sortedPurchases) {
        if (p.is_installment && !p.is_refunded) {
            const card = (appSettings.credit_cards || []).find(c => c.id === p.credit_card_id);
            const paidInstallments = calculatePaidInstallments(p, new Date(), card);
            const remainingInstallments = p.installments - paidInstallments;
            if (remainingInstallments > 0) {
                remainingBalance += (p.value / p.installments) * remainingInstallments;
            }
        }

        const card = (appSettings.credit_cards || []).find(c => c.id === p.credit_card_id);
        const statementDate = getStatementDateForPurchase(p, card);
        const installmentValue = p.is_installment ? p.value / p.installments : p.value;

        if (p.is_installment) {
            const monthsDiff = (selectedDate.getUTCFullYear() - statementDate.getUTCFullYear()) * 12 + (selectedDate.getUTCMonth() - statementDate.getUTCMonth());
            if (monthsDiff >= 0 && monthsDiff < p.installments) {
                if(!p.is_refunded) monthlyTotal += installmentValue;
                const paidCountForSelectedMonth = calculatePaidInstallments(p, selectedDate, card);
                if (paidCountForSelectedMonth === p.installments) {
                    groups.endingThisMonth.push(p);
                }
                groups.installments.push(p);
            }
        } else {
            if (statementDate.getUTCMonth() === selectedDate.getUTCMonth() && statementDate.getUTCFullYear() === selectedDate.getUTCFullYear()) {
                if(!p.is_refunded) monthlyTotal += installmentValue;
                groups.oneTime.push(p);
            }
        }
    }

    const refundsThisMonth = refunds.filter(r => {
        const d = new Date(`${r.refund_date}T00:00:00Z`);
        return d.getUTCMonth() === selectedDate.getUTCMonth() && d.getUTCFullYear() === selectedDate.getUTCFullYear();
    });
    const totalRefundsThisMonth = refundsThisMonth.reduce((acc, r) => acc + r.value, 0);

    const ongoingInstallments = groups.installments.filter(p => !groups.endingThisMonth.some(e => e.id === p.id));
    
    const oneTimeTotal = groups.oneTime.reduce((acc, p) => p.is_refunded ? acc : acc + p.value, 0);
    const installmentsTotal = ongoingInstallments.reduce((acc, p) => p.is_refunded ? acc : acc + (p.value / p.installments), 0);
    const endingThisMonthTotal = groups.endingThisMonth.reduce((acc, p) => p.is_refunded ? acc : acc + (p.value / p.installments), 0);

    return {
        endingThisMonth: groups.endingThisMonth,
        installments: ongoingInstallments,
        oneTime: groups.oneTime,
        totalMonthlyStatement: monthlyTotal - totalRefundsThisMonth,
        totalRemainingInstallmentBalance: remainingBalance,
        oneTimeTotal,
        installmentsTotal,
        endingThisMonthTotal,
        refundsThisMonth,
    };
  }, [filteredPurchases, selectedDate, appSettings.credit_cards, sortOption, refunds]);

  const getCardNickname = (cardId?: string) => (appSettings.credit_cards || []).find(c => c.id === cardId)?.nickname || '';

  const openModal = (purchase: Purchase | null) => {
    if (isPastMonth && !purchase?.pending_review) return;
    setEditingPurchase(purchase);
    if (purchase) {
      const [title, notes] = purchase.description.split(' :: ');
      setFormData({
         ...purchase,
         payment_method: purchase.payment_method,
         description: title,
         notes: notes || '' 
        });
    } else {
      setFormData(emptyPurchase);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        if (name === 'installments') {
            const num = parseInt(value);
            setFormData(prev => ({ ...prev, installments: isNaN(num) ? 1 : num }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }
  };
  
  const handleValueChange = (newValue: number) => {
      setFormData(prev => ({...prev, value: newValue}));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.payment_method) {
        alert("Por favor, selecione uma forma de pagamento.");
        return;
    }

    const combinedDescription = `${formData.description}${formData.notes ? ` :: ${formData.notes}` : ''}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { notes, ...restOfData } = formData;
    
    const isCardPayment = formData.payment_method === PaymentMethod.CreditCard;
    const selectedCard = isCardPayment ? (appSettings.credit_cards || []).find(c => c.id === formData.credit_card_id) : undefined;

    const dataToSave: Omit<Purchase, 'id' | 'user_id' | 'created_at' | 'pending_review'> = {
        ...restOfData,
        description: combinedDescription,
        is_installment: isCardPayment ? formData.is_installment : false,
        installments: isCardPayment && formData.is_installment ? formData.installments : 1,
        credit_card_id: isCardPayment ? formData.credit_card_id : undefined,
        card_closing_date: selectedCard?.closingDate,
        card_due_date: selectedCard?.dueDate,
        person_id: formData.person_id || undefined,
    };

    if (editingPurchase) {
      const finalData = { ...editingPurchase, ...dataToSave };
      if (editingPurchase.pending_review) {
        finalData.pending_review = false;
      }
      await crudHooks.updateItem(finalData);
    } else {
      await crudHooks.addItem(dataToSave);
    }
    closeModal();
  };


  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setPurchaseToDelete(id);
  }
  
  const confirmDelete = async () => {
    if (purchaseToDelete) {
      await crudHooks.deleteItem(purchaseToDelete);
      setPurchaseToDelete(null);
      setPurchaseDetails(null);
    }
  };
  
  const confirmRefund = async () => {
    if (purchaseToRefund) {
      await handleAddRefund(purchaseToRefund);
      setPurchaseDetails(prev => prev ? {...prev, is_refunded: true} : null);
      setPurchaseToRefund(null);
    }
  };

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };
  
  const renderPurchaseTable = (data: Purchase[], title: string, sectionKey: string, totalValue: number) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div onClick={() => toggleSection(sectionKey)} className="w-full flex justify-between items-center text-left cursor-pointer">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
             <div className="flex items-center gap-4">
                {collapsedSections[sectionKey] && data.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>{data.length} {data.length > 1 ? 'compras' : 'compra'}</span>
                        <PrivacyValue isPrivate={isPrivacyMode} value={totalValue} className="font-semibold text-slate-700 dark:text-slate-300" animate={false} />
                    </div>
                )}
                <ChevronDown size={20} className={`transition-transform text-slate-400 ${collapsedSections[sectionKey] ? '-rotate-90' : 'rotate-0'}`} />
            </div>
        </div>
        {!collapsedSections[sectionKey] && (
          <div className="overflow-x-auto mt-6">
              <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400 rounded-xl">
                      <tr>
                          <th scope="col" className="px-6 py-4 rounded-l-xl">Título / Descrição</th>
                          <th scope="col" className="px-6 py-4">Valor</th>
                          <th scope="col" className="px-6 py-4 rounded-r-xl">Progresso</th>
                      </tr>
                  </thead>
                  <tbody>
                      {data.map(renderPurchaseRow)}
                  </tbody>
                  {data.length > 0 && (
                      <tfoot className="font-semibold">
                          <tr>
                              <td colSpan={2} className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">Total na Fatura do Mês</td>
                              <td className="px-6 py-4 text-slate-800 dark:text-slate-100"><PrivacyValue isPrivate={isPrivacyMode} value={totalValue} className="font-bold" animate={false}/></td>
                          </tr>
                      </tfoot>
                  )}
              </table>
              {data.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Nenhuma compra nesta categoria para o mês.</p>}
          </div>
        )}
    </div>
  );
  
  const renderPurchaseRow = (pur: Purchase) => {
    const card = (appSettings.credit_cards || []).find(c => c.id === pur.credit_card_id);
    const paidInstallments = calculatePaidInstallments(pur, selectedDate, card);
    const isSettled = pur.is_installment && paidInstallments >= pur.installments;
    const installmentValue = pur.is_installment ? pur.value / pur.installments : pur.value;
    const assignedPersonName = getPersonNameById(pur.person_id);
    const [title, notes] = pur.description.split(' :: ');

    return (
        <tr onClick={() => setPurchaseDetails(pur)} key={pur.id} className={`border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${pur.is_refunded ? 'bg-red-50 dark:bg-red-900/10 opacity-70' : ''}`}>
          <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
            <div>
              <span className='text-slate-800 dark:text-slate-100 font-semibold'>{title}</span>
              {pur.is_refunded && <span className="ml-2 text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">ESTORNO</span>}
              {notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{notes}</p>}
            </div>
            <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-3 mt-1.5 flex-wrap">
               <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"><Tag size={10}/> {pur.category}</span>
               <span className="flex items-center gap-1" title="Data da Compra">
                    <CalendarDays size={12}/> {new Date(`${pur.purchase_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
               </span>
               {assignedPersonName && <span className="flex items-center gap-1 text-blue-500" title={`Atribuído a: ${assignedPersonName}`}><User size={12}/> {assignedPersonName.split(' ')[0]}</span>}
               <span className="flex items-center gap-1">{getPaymentMethodIcon(pur.payment_method)} {pur.payment_method === PaymentMethod.CreditCard ? getCardNickname(pur.credit_card_id) : pur.payment_method}</span>
            </div>
          </td>
          <td className="px-6 py-4">
            <div>
                <span className={`${pur.is_refunded ? 'line-through opacity-50' : 'text-slate-700 dark:text-slate-200 font-bold'}`}><PrivacyValue isPrivate={isPrivacyMode} value={installmentValue} as="span" animate={false} /></span>
                 <p className="font-medium text-[10px] text-slate-400 mt-1">Total: <PrivacyValue isPrivate={isPrivacyMode} value={pur.value} as="span" className="text-[10px]" animate={false} /></p>
            </div>
          </td>
          <td className="px-6 py-4">
            {pur.is_installment ? (
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${isSettled ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            {paidInstallments}/{pur.installments}
                        </span>
                        {isSettled && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Quitado</span>}
                    </div>
                    <div className="w-24 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(paidInstallments / pur.installments) * 100}%` }}></div>
                    </div>
                </div>
            ) : (<span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">À vista</span>)}
          </td>
        </tr>
    );
  };

    const PurchaseDetailModal: React.FC<{
      purchase: Purchase | null;
    }> = ({ purchase }) => {
        if (!purchase) return null;

        const associatedRefund = refunds.find(r => r.purchase_id === purchase.id);
        const card = (appSettings.credit_cards || []).find(c => c.id === purchase.credit_card_id);
        const paidInstallments = calculatePaidInstallments(purchase, new Date(), card);
        const isSettled = purchase.is_installment && paidInstallments >= purchase.installments;
        const assignedPersonName = getPersonNameById(purchase.person_id);
        const [title, notes] = purchase.description.split(' :: ');
        const installmentValue = purchase.is_installment ? purchase.value / purchase.installments : purchase.value;

        // ... status tag logic ...
        const getStatusTag = () => {
            if (purchase.is_refunded) return <span className="text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-300 px-2 py-0.5 rounded-full">Estornada</span>;
            if (purchase.pending_review) return <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-0.5 rounded-full">Revisar</span>;
            if (isSettled) return <span className="text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">Quitada</span>;
            if (purchase.is_installment) return <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">Parcelada</span>;
            return <span className="text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">À Vista</span>;
        };
        
        const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
            <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Icon size={14} />
                    <span>{label}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-white mt-0.5">{value}</p>
            </div>
        );
        
        return (
            <Modal isOpen={!!purchase} onClose={() => setPurchaseDetails(null)} title="">
                <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300">
                    {/* Header */}
                    <div className="text-center border-b dark:border-slate-700 pb-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                            <PrivacyValue isPrivate={false} value={purchase.value} animate={false} />
                        </h2>
                        {purchase.is_installment && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                em {purchase.installments}x de <PrivacyValue isPrivate={false} value={installmentValue} as="span" animate={false} />
                            </p>
                        )}
                        <div className="mt-2">{getStatusTag()}</div>
                        {notes && <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">{notes}</p>}
                    </div>

                    {/* Details with Icons */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                        <DetailItem icon={Tag} label="Categoria" value={purchase.category} />
                        <DetailItem 
                           icon={CalendarDays} 
                           label="Data da Compra" 
                           value={new Date(`${purchase.purchase_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} 
                        />
                        <DetailItem 
                           icon={Wallet}
                           label="Forma de Pagamento" 
                           value={
                               <span className="flex items-center gap-2">
                                   {getPaymentMethodIcon(purchase.payment_method)}
                                   {purchase.payment_method}
                                   {purchase.payment_method === PaymentMethod.CreditCard && ` (${getCardNickname(purchase.credit_card_id)})`}
                               </span>
                           } 
                        />
                        <DetailItem icon={User} label="Atribuído a" value={assignedPersonName || 'Ninguém'} />
                    </div>

                    {purchase.is_installment && (
                        <div className="pt-4 border-t dark:border-slate-700">
                            <div className="flex justify-between items-baseline mb-1">
                               <p className="text-xs text-slate-500 dark:text-slate-400">Progresso das Parcelas</p>
                               <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">{paidInstallments} de {purchase.installments} pagas</p>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(paidInstallments / purchase.installments) * 100}%` }}></div>
                            </div>
                            <p className="text-xs text-right mt-1 text-slate-500 dark:text-slate-400">
                               Valor da parcela: <PrivacyValue isPrivate={false} value={installmentValue} as="span" animate={false} />
                            </p>
                        </div>
                    )}

                    {/* ... Refund section ... */}
                    {associatedRefund && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                            <p className="font-semibold text-green-800 dark:text-green-300 text-sm">Estorno Realizado</p>
                            <p className="text-xs">Crédito de R$ {associatedRefund.value.toFixed(2)} aplicado na fatura em {new Date(`${associatedRefund.refund_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.</p>
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                        {/* ... Actions ... */}
                        <button 
                            onClick={() => { setPurchaseToDelete(purchase.id); }} 
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-md flex items-center gap-2"
                            disabled={isPastMonth}
                        >
                            <Trash2 size={16} /> Excluir
                        </button>
                        <button 
                            onClick={() => { setPurchaseToRefund(purchase); }}
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-md flex items-center gap-2"
                            disabled={isPastMonth || purchase.is_refunded}
                            title={purchase.is_refunded ? "Compra já estornada" : "Estornar compra"}
                        >
                            <RotateCcw size={16} /> Estornar
                        </button>
                        <button 
                            onClick={() => { setPurchaseDetails(null); openModal(purchase); }} 
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2"
                            disabled={isPastMonth && !purchase.pending_review}
                        >
                            <Edit size={16} /> {purchase.pending_review ? 'Revisar' : 'Editar'}
                        </button>
                    </div>
                </div>
            </Modal>
        );
    };

    return (
        <>
            {/* ... Modals ... */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingPurchase ? 'Editar Compra' : 'Adicionar Compra'}>
                <form onSubmit={handleSave} className="space-y-6">
                  
                  {/* TITLE & VALUE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">O que você comprou?</label>
                        <input type="text" name="description" value={formData.description} onChange={handleChange} required placeholder="Ex: Mercado, iFood, Uber..." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor (R$)</label>
                        <CurrencyInput value={formData.value} onChange={handleValueChange} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm font-bold text-lg"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data</label>
                        <DatePicker value={formData.purchase_date} onChange={(date) => setFormData(prev => ({...prev, purchase_date: date}))} />
                    </div>
                  </div>

                  {/* CATEGORIES (Tags) */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Categoria</label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {appSettings.purchase_categories.map(cat => (
                              <SelectableTag 
                                key={cat} 
                                label={cat} 
                                selected={formData.category === cat} 
                                onClick={() => setFormData(prev => ({ ...prev, category: cat }))} 
                              />
                          ))}
                      </div>
                  </div>

                  {/* PAYMENT METHOD (Tags) */}
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Como pagou?</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(PaymentMethod).map(method => {
                            let Icon = Wallet;
                            if (method === PaymentMethod.CreditCard) Icon = CreditCardIcon;
                            else if (method === PaymentMethod.PIX) Icon = QrCode;
                            else if (method === PaymentMethod.Boleto) Icon = FileText;
                            else if (method === PaymentMethod.Dinheiro) Icon = Banknote;

                            return (
                                <SelectableTag 
                                    key={method}
                                    label={method}
                                    icon={Icon}
                                    selected={formData.payment_method === method}
                                    onClick={() => setFormData(prev => ({ ...prev, payment_method: method }))}
                                />
                            );
                        })}
                      </div>
                  </div>

                  {/* CREDIT CARD LOGIC */}
                  {formData.payment_method === PaymentMethod.CreditCard && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl space-y-4 animate-fade-in">
                             {/* Select Card */}
                             <div>
                                <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-2">Qual Cartão?</label>
                                <div className="flex flex-wrap gap-2">
                                    {(appSettings.credit_cards || []).map(c => (
                                        <SelectableTag 
                                            key={c.id} 
                                            label={c.nickname} 
                                            selected={formData.credit_card_id === c.id} 
                                            onClick={() => setFormData(prev => ({ ...prev, credit_card_id: c.id }))}
                                            colorClass="blue"
                                        />
                                    ))}
                                    {appSettings.credit_cards.length === 0 && <span className="text-xs text-slate-500">Nenhum cartão cadastrado. Vá em Configurações.</span>}
                                </div>
                             </div>

                             {/* Installment Toggle */}
                             <div className="flex items-center gap-4">
                                 <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                     <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({...prev, is_installment: false, installments: 1}))}
                                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${!formData.is_installment ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                     >
                                         À Vista
                                     </button>
                                     <button 
                                        type="button"
                                        onClick={() => setFormData(prev => ({...prev, is_installment: true, installments: 2}))}
                                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${formData.is_installment ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                     >
                                         Parcelado
                                     </button>
                                 </div>
                                 
                                 {formData.is_installment && (
                                     <div className="flex-1 flex items-center gap-2">
                                         <input 
                                            type="number" 
                                            min="2" max="36" 
                                            value={formData.installments} 
                                            onChange={(e) => setFormData(prev => ({...prev, installments: parseInt(e.target.value) || 2}))}
                                            className="w-16 px-2 py-2 text-center font-bold border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700"
                                         />
                                         <span className="text-xs font-medium text-slate-500">x Parcelas</span>
                                     </div>
                                 )}
                             </div>
                        </div>
                    )}

                  {/* PERSON & NOTES */}
                  <div className="grid grid-cols-1 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Para quem? (Opcional)</label>
                        <div className="flex flex-wrap gap-2">
                            <SelectableTag 
                                label="Para mim (Ninguém)" 
                                selected={!formData.person_id} 
                                onClick={() => setFormData(prev => ({ ...prev, person_id: '' }))}
                                colorClass="slate"
                            />
                            {appSettings.people.map(p => (
                                <SelectableTag 
                                    key={p.id} 
                                    label={p.name} 
                                    selected={formData.person_id === p.id} 
                                    onClick={() => setFormData(prev => ({ ...prev, person_id: p.id }))}
                                    icon={User}
                                    colorClass="purple"
                                />
                            ))}
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Observações</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm resize-none" placeholder="Detalhes opcionais..."></textarea>
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                    <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-xl">Cancelar</button>
                    <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-transform hover:scale-105 active:scale-95">Salvar Compra</button>
                  </div>
                </form>
            </Modal>
            
            <ConfirmationModal isOpen={!!purchaseToDelete} onClose={() => setPurchaseToDelete(null)} onConfirm={confirmDelete} title="Confirmar Exclusão">
                Tem certeza de que deseja excluir esta compra?
            </ConfirmationModal>
            
            <ConfirmationModal isOpen={!!purchaseToRefund} onClose={() => setPurchaseToRefund(null)} onConfirm={confirmRefund} title="Confirmar Estorno">
                Tem certeza de que deseja estornar esta compra? Um crédito no valor total será adicionado à sua fatura atual.
            </ConfirmationModal>
            
            <PurchaseDetailModal purchase={purchaseDetails} />

            <div className="space-y-6">
                <ViewHeader 
                    title="Compras" 
                    setIsSidebarOpen={setIsSidebarOpen}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    isPrivacyMode={isPrivacyMode}
                    setIsPrivacyMode={setIsPrivacyMode}
                    isAnimationsEnabled={isAnimationsEnabled}
                    setIsAnimationsEnabled={setIsAnimationsEnabled}
                    viewFilter={viewFilter}
                    setViewFilter={setViewFilter}
                >
                    <button 
                        onClick={() => openModal(null)}
                        disabled={isPastMonth}
                        title={isPastMonth ? "Não é possível adicionar em meses anteriores" : "Adicionar nova compra"}
                        className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-blue-800 disabled:cursor-not-allowed"
                    >
                        <PlusCircle size={18} />
                        Adicionar Compra
                    </button>
                </ViewHeader>
                
                {/* Compact KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center text-sm">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-slate-500 dark:text-slate-400 mb-1 text-xs uppercase font-bold">Fatura do Mês</h3>
                        <p className="font-bold text-xl text-blue-600 dark:text-blue-400"><PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyStatement} animate={false} /></p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-slate-500 dark:text-slate-400 mb-1 text-xs uppercase font-bold">Saldo Devedor (Parcelas)</h3>
                        <p className="font-bold text-xl text-orange-500 dark:text-orange-400"><PrivacyValue isPrivate={isPrivacyMode} value={totalRemainingInstallmentBalance} animate={false} /></p>
                    </div>
                </div>

                {/* AI Review Section - Redesigned as Cards */}
                {purchasesForReview.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-3xl shadow-sm border border-amber-100 dark:border-amber-800/30">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-amber-600" size={20}/>
                                <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300">Revisão Kaan (IA)</h2>
                            </div>
                            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{purchasesForReview.length} pendentes</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {purchasesForReview.map(pur => {
                                const [title] = pur.description.split(' :: ');
                                return (
                                    <div key={pur.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-800/30 flex justify-between items-center group hover:shadow-md transition-all">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{title}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{pur.category} • {new Date(`${pur.purchase_date}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                                            <p className="font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                <PrivacyValue isPrivate={isPrivacyMode} value={pur.value} animate={false} />
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => { setPurchaseToDelete(pur.id); }} 
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                title="Rejeitar"
                                            >
                                                <X size={18} />
                                            </button>
                                            <button 
                                                onClick={() => openModal(pur)} 
                                                className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-110"
                                                title="Aprovar/Editar"
                                            >
                                                <Check size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {refundsThisMonth.length > 0 && (
                     <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl shadow-sm border border-emerald-100 dark:border-emerald-800/30">
                        <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-4">Créditos e Estornos</h2>
                         <div className="space-y-2">
                            {refundsThisMonth.map(refund => (
                                <div key={refund.id} className="flex justify-between items-center text-sm p-3 bg-white/60 dark:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800/20">
                                    <p className="text-emerald-900 dark:text-emerald-100 font-medium">{refund.description}</p>
                                    <p className="font-bold text-emerald-700 dark:text-emerald-300">- <PrivacyValue isPrivate={isPrivacyMode} value={refund.value} as="span" animate={false}/></p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Search & Filters Row */}
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full md:w-auto flex-1 max-w-sm">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar compras..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                        />
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 no-scrollbar">
                        <div className="relative">
                            <select value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)} className="appearance-none pl-8 pr-8 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none shadow-sm cursor-pointer">
                                <option value="purchase_date">Por Data</option>
                                <option value="created_at">Por Criação</option>
                            </select>
                            <ArrowDownUp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="appearance-none pl-8 pr-8 py-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none shadow-sm cursor-pointer">
                                <option value="all">Categorias: Todas</option>
                                {appSettings.purchase_categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <Tag size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {searchQuery.trim() !== '' ? (
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Resultados da Busca</h2>
                        <div className="overflow-x-auto mt-4">
                        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400 rounded-xl">
                                <tr>
                                    <th scope="col" className="px-6 py-4 rounded-l-xl">Título / Descrição</th>
                                    <th scope="col" className="px-6 py-4">Valor</th>
                                    <th scope="col" className="px-6 py-4 rounded-r-xl">Progresso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPurchases.sort((a, b) => {
                                    const dateA = new Date(a[sortOption] || a.purchase_date);
                                    const dateB = new Date(b[sortOption] || b.purchase_date);
                                    return dateB.getTime() - dateA.getTime();
                                }).map(renderPurchaseRow)}
                            </tbody>
                        </table>
                         {filteredPurchases.length === 0 && <p className="text-center py-4 text-slate-500 dark:text-slate-400">Nenhuma compra encontrada.</p>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {renderPurchaseTable(endingThisMonth, 'Parcelas que se encerram', 'ending', endingThisMonthTotal)}
                        {renderPurchaseTable(installments, 'Compras Parceladas', 'installments', installmentsTotal)}
                        {renderPurchaseTable(oneTime, 'Compras à Vista', 'one_time', oneTimeTotal)}
                    </div>
                )}
            </div>
        </>
    );
};

export default Purchases;
