
import React, { useState, useMemo } from 'react';
import { Subscription, Status, PaymentMethod, AppSettings } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle, AlertCircle, CreditCard as CardIcon, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { getStatusColor, getPaymentMethodIcon } from '../utils/styleUtils';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import { formatToUTCDateString } from '../utils/dateUtils';
import useMediaQuery from '../utils/useMediaQuery';
import PrivacyValue from './common/PrivacyValue';
import SelectableTag from './common/SelectableTag';

interface SubscriptionsProps {
  subscriptions: Subscription[];
  crudHooks: CrudHooks<Subscription>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isMobile: boolean;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const getSubscriptionValueInBRL = (subscription: Subscription, settings: AppSettings): number => {
    if (subscription.currency === 'USD') {
        const usdRate = subscription.applied_usd_rate ?? settings.usd_rate;
        const iofRate = subscription.applied_iof_rate ?? settings.iof_rate;
        return subscription.monthly_value * usdRate * (1 + iofRate / 100);
    }
    return subscription.monthly_value;
};

const calculateTotalPaid = (sub: Subscription, untilDate: Date, settings: AppSettings): number => {
    const startDate = new Date(`${sub.start_date}T00:00:00Z`);
    let endDate = untilDate;
    if (sub.cancellation_date) {
        const cancellationDate = new Date(`${sub.cancellation_date}T00:00:00Z`);
        if (cancellationDate < endDate) endDate = cancellationDate;
    }
    if (startDate > endDate) return 0;
    const months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth()) + 1;
    const monthlyValueBRL = getSubscriptionValueInBRL(sub, settings);
    return monthlyValueBRL * Math.max(0, months);
};

const Subscriptions: React.FC<SubscriptionsProps> = ({ 
    subscriptions, crudHooks, appSettings, setIsSidebarOpen, 
    selectedDate, setSelectedDate, isMobile, 
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const emptySubscription: Omit<Subscription, 'id' | 'user_id'> = {
    service_name: '', category: appSettings.subscription_categories[0] || '',
    monthly_value: 0, currency: 'BRL', billing_date: 1,
    payment_method: PaymentMethod.CreditCard, status: Status.Active,
    start_date: formatToUTCDateString(new Date()), notes: '',
    credit_card_id: (appSettings.credit_cards || [])[0]?.id || '',
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Subscription, 'id' | 'user_id'>>(emptySubscription);
  
  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();

  const getCardNickname = (cardId?: string) => (appSettings.credit_cards || []).find(c => c.id === cardId)?.nickname || '';

  const openModal = (subscription: Subscription | null) => {
    if (isPastMonth) return;
    setEditingSubscription(subscription);
    setFormData(subscription ? { ...subscription } : emptySubscription);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubscription(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleValueChange = (newValue: number) => {
      setFormData(prev => ({ ...prev, monthly_value: newValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let dataToSave: Omit<Subscription, 'id' | 'user_id' | 'created_at'> & {cancellation_date?: string, credit_card_id?: string} = { ...formData };
    if (dataToSave.currency === 'USD') {
        dataToSave.applied_usd_rate = appSettings.usd_rate;
        dataToSave.applied_iof_rate = appSettings.iof_rate;
    } else {
        dataToSave.applied_usd_rate = undefined;
        dataToSave.applied_iof_rate = undefined;
    }
    if (dataToSave.status === Status.Canceled && !dataToSave.cancellation_date) {
        dataToSave.cancellation_date = formatToUTCDateString(new Date());
    } else if (dataToSave.status === Status.Active) {
        dataToSave.cancellation_date = undefined;
    }
    if (dataToSave.payment_method !== PaymentMethod.CreditCard) {
        dataToSave.credit_card_id = undefined;
    }

    if (editingSubscription) {
      await crudHooks.updateItem({ ...editingSubscription, ...dataToSave });
    } else {
      await crudHooks.addItem(dataToSave);
    }
    closeModal();
  };

  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setSubscriptionToDelete(id);
  }
  
  const confirmDelete = async () => {
    if (subscriptionToDelete) {
      await crudHooks.deleteItem(subscriptionToDelete);
      setSubscriptionToDelete(null);
    }
  };
  
  const handleToggleStatus = async (sub: Subscription) => {
    if (isPastMonth) return;
    const isCanceling = sub.status === Status.Active;
    const updatedSub = {
        ...sub,
        status: isCanceling ? Status.Canceled : Status.Active,
        cancellation_date: isCanceling ? formatToUTCDateString(new Date()) : undefined,
    };
    await crudHooks.updateItem(updatedSub);
  };

  const visibleSubscriptions = useMemo(() => subscriptions.filter(sub => {
    const subStartDate = new Date(`${sub.start_date}T00:00:00Z`);
    const endOfMonth = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 0));
    const startOfMonth = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
    
    if (subStartDate > endOfMonth) return false;
    if (sub.status === Status.Canceled && sub.cancellation_date) {
        const subCancelDate = new Date(`${sub.cancellation_date}T00:00:00Z`);
        if (subCancelDate < startOfMonth) return false;
    }
    return true;
  }), [subscriptions, selectedDate]);

  const totalMonthlyValue = useMemo(() => {
    return visibleSubscriptions.reduce((acc, sub) => acc + getSubscriptionValueInBRL(sub, appSettings), 0);
  }, [visibleSubscriptions, appSettings]);

  const renderDesktopView = () => (
    <div className="overflow-x-auto mt-6">
        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
            <tr>
            <th scope="col" className="px-6 py-3">Serviço</th>
            <th scope="col" className="px-6 py-3">Categoria</th>
            <th scope="col" className="px-6 py-3">Valor Mensal</th>
            <th scope="col" className="px-6 py-3">Data Cobrança</th>
            <th scope="col" className="px-6 py-3">Pagamento</th>
            <th scope="col" className="px-6 py-3">Status</th>
            <th scope="col" className="px-6 py-3 text-right">Ações</th>
            </tr>
        </thead>
        <tbody>
            {visibleSubscriptions.map((sub) => (
            <tr key={sub.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50">
                <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{sub.service_name}</td>
                <td className="px-6 py-4">{sub.category}</td>
                <td className="px-6 py-4">
                <div>
                    <PrivacyValue isPrivate={isPrivacyMode} value={getSubscriptionValueInBRL(sub, appSettings)} animate={isAnimationsEnabled} />
                    {sub.currency === 'USD' && <span className="text-xs text-slate-500 block">(US$ {sub.monthly_value.toFixed(2)})</span>}
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">Total: <PrivacyValue isPrivate={isPrivacyMode} value={calculateTotalPaid(sub, selectedDate, appSettings)} animate={isAnimationsEnabled} /></span>
                </div>
                </td>
                <td className="px-6 py-4">Dia {sub.billing_date}</td>
                <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                    {getPaymentMethodIcon(sub.payment_method)}
                    <span>{sub.payment_method}</span>
                </div>
                {sub.payment_method === PaymentMethod.CreditCard && sub.credit_card_id && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {getCardNickname(sub.credit_card_id)}
                    </div>
                )}
                </td>
                <td className="px-6 py-4"><button onClick={() => handleToggleStatus(sub)} disabled={isPastMonth} title={isPastMonth ? "Não é possível alterar o status" : "Alterar status"} className={`px-2 py-1 rounded-full text-xs font-semibold w-20 text-center transition-colors ${getStatusColor(sub.status)} disabled:cursor-not-allowed`}>{sub.status}</button></td>
                <td className="px-6 py-4 flex space-x-2 justify-end">
                <button onClick={() => openModal(sub)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar assinatura"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                <button onClick={() => handleDelete(sub.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir assinatura"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                </td>
            </tr>
            ))}
            {visibleSubscriptions.length === 0 && (<tr><td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma assinatura ativa para o mês selecionado.</td></tr>)}
        </tbody>
        {visibleSubscriptions.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                <tr>
                    <td colSpan={6} className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">Total do Mês</td>
                    <td className="px-6 py-3 text-right"><PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyValue} animate={isAnimationsEnabled} /></td>
                </tr>
            </tfoot>
        )}
        </table>
    </div>
  );

  const renderMobileView = () => (
    <div className="space-y-3 mt-6">
        {visibleSubscriptions.map(sub => (
            <div key={sub.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg shadow-sm border dark:border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">{sub.service_name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{sub.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => openModal(sub)} disabled={isPastMonth} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(sub.id)} disabled={isPastMonth} className="text-slate-400 hover:text-red-500 disabled:text-slate-600"><Trash2 size={16} /></button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400">Valor Mensal</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-200"><PrivacyValue isPrivate={isPrivacyMode} value={getSubscriptionValueInBRL(sub, appSettings)} animate={isAnimationsEnabled} /></p>
                    </div>
                    <div>
                        <p className="text-slate-500 dark:text-slate-400">Cobrança</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Dia {sub.billing_date}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 dark:text-slate-400">Pagamento</p>
                        <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                            {getPaymentMethodIcon(sub.payment_method)}
                            {sub.payment_method === PaymentMethod.CreditCard ? getCardNickname(sub.credit_card_id) : sub.payment_method}
                        </div>
                    </div>
                    <div>
                        <p className="text-slate-500 dark:text-slate-400">Status</p>
                         <button onClick={() => handleToggleStatus(sub)} disabled={isPastMonth} className={`px-2 py-0.5 rounded-full text-xs font-semibold w-20 text-center transition-colors ${getStatusColor(sub.status)} disabled:cursor-not-allowed`}>{sub.status}</button>
                    </div>
                </div>
            </div>
        ))}
        {visibleSubscriptions.length === 0 && <p className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma assinatura ativa para o mês selecionado.</p>}
        {visibleSubscriptions.length > 0 && (
            <div className="flex justify-between items-center mt-4 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Total do Mês</span>
                <PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyValue} className="text-slate-800 dark:text-slate-100" animate={isAnimationsEnabled} />
            </div>
        )}
    </div>
  );

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSubscription ? 'Editar Assinatura' : 'Adicionar Assinatura'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nome do Serviço</label>
              <input type="text" name="service_name" value={formData.service_name} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Categoria</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {appSettings.subscription_categories.map(cat => (
                      <SelectableTag 
                        key={cat} 
                        label={cat} 
                        selected={formData.category === cat} 
                        onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                        colorClass="purple"
                      />
                  ))}
              </div>
            </div>

            <div className="flex gap-2 items-end">
                <div className="flex-grow">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Mensal</label>
                  <CurrencyInput 
                    name="monthly_value" 
                    value={formData.monthly_value} 
                    onChange={handleValueChange} 
                    required 
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-bold"
                   />
                </div>
            </div>
            
            <div>
               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Moeda</label>
               <div className="flex gap-2">
                   <SelectableTag label="BRL" selected={formData.currency === 'BRL'} onClick={() => setFormData(prev => ({...prev, currency: 'BRL'}))} colorClass="green" icon={Globe} />
                   <SelectableTag label="USD" selected={formData.currency === 'USD'} onClick={() => setFormData(prev => ({...prev, currency: 'USD'}))} colorClass="blue" icon={Globe} />
               </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Dia da Cobrança</label>
              <input type="number" name="billing_date" value={formData.billing_date} onChange={handleChange} required min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center"/>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Método de Pagamento</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(PaymentMethod).map(method => (
                    <SelectableTag 
                        key={method} 
                        label={method} 
                        selected={formData.payment_method === method} 
                        onClick={() => setFormData(prev => ({ ...prev, payment_method: method }))}
                        colorClass="blue"
                    />
                ))}
              </div>
            </div>

             {formData.payment_method === PaymentMethod.CreditCard && (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Cartão de Crédito</label>
                <div className="flex flex-wrap gap-2">
                    {(appSettings.credit_cards || []).map(card => (
                        <SelectableTag 
                            key={card.id} 
                            label={card.nickname} 
                            selected={formData.credit_card_id === card.id} 
                            onClick={() => setFormData(prev => ({ ...prev, credit_card_id: card.id }))}
                            icon={CardIcon}
                            colorClass="blue"
                        />
                    ))}
                </div>
              </div>
            )}
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Status</label>
              <div className="flex gap-2">
                  <SelectableTag label="Ativo" selected={formData.status === Status.Active} onClick={() => setFormData(prev => ({...prev, status: Status.Active}))} colorClass="green" icon={CheckCircle2} />
                  <SelectableTag label="Cancelado" selected={formData.status === Status.Canceled} onClick={() => setFormData(prev => ({...prev, status: Status.Canceled}))} colorClass="red" icon={XCircle} />
              </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data de Início</label>
                <DatePicker 
                    value={formData.start_date} 
                    onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))} 
                />
            </div>
             {formData.status === Status.Canceled && (
                 <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data Cancelamento</label>
                    <DatePicker 
                        value={formData.cancellation_date || ''} 
                        onChange={(date) => setFormData(prev => ({ ...prev, cancellation_date: date }))} 
                    />
                </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Observações</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"></textarea>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-700">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Salvar</button>
          </div>
        </form>
      </Modal>
      
      <ConfirmationModal
        isOpen={!!subscriptionToDelete}
        onClose={() => setSubscriptionToDelete(null)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
      >
        Tem certeza de que deseja excluir esta assinatura? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm">
        <ViewHeader 
          title="Assinaturas" 
          setIsSidebarOpen={setIsSidebarOpen}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          isMobile={isMobile}
          isPrivacyMode={isPrivacyMode}
          setIsPrivacyMode={setIsPrivacyMode}
          isAnimationsEnabled={isAnimationsEnabled}
          setIsAnimationsEnabled={setIsAnimationsEnabled}
        >
          <button 
            onClick={() => openModal(null)}
            disabled={isPastMonth}
            title={isPastMonth ? "Não é possível adicionar em meses anteriores" : "Adicionar nova assinatura"}
            className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            <PlusCircle size={18} />
            <span className="hidden sm:inline">Adicionar Assinatura</span>
            <span className="sm:hidden">Adicionar</span>
          </button>
        </ViewHeader>

        {isMobile ? renderMobileView() : renderDesktopView()}
      </div>
    </>
  );
};

export default Subscriptions;
