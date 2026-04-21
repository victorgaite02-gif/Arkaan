
import React, { useState, useMemo } from 'react';
import { Debtor, AppSettings, Status } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle, User, Banknote, CalendarClock, ListPlus } from 'lucide-react';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import { formatToUTCDateString } from '../utils/dateUtils';
import { getStatusColor } from '../utils/styleUtils';
import PrivacyValue from './common/PrivacyValue';
import SelectableTag from './common/SelectableTag';

interface DebtorsProps {
  debtors: Debtor[];
  crudHooks: CrudHooks<Debtor>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const Debtors: React.FC<DebtorsProps> = ({ 
    debtors, crudHooks, appSettings, setIsSidebarOpen, 
    selectedDate, setSelectedDate, isPrivacyMode, setIsPrivacyMode,
    isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const emptyDebtor: Omit<Debtor, 'id' | 'user_id'> = {
    person_name: '', description: '', category: appSettings.debtor_categories[0] || '',
    total_value: 0, payment_type: 'OneTime', start_date: formatToUTCDateString(new Date()),
    status: Status.Pending, installments_total: 2, installments_paid: 0, notes: '',
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [debtorToDelete, setDebtorToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Debtor, 'id' | 'user_id'>>(emptyDebtor);

  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();

  const currentMonthStr = `${selectedDate.getUTCFullYear()}-${(selectedDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;

  const visibleDebtors = useMemo(() => {
    return debtors.filter(d => {
        const startDate = new Date(`${d.start_date}T00:00:00Z`);
        const currentYear = selectedDate.getUTCFullYear();
        const currentMonth = selectedDate.getUTCMonth();
        const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        
        const isPaidThisMonth = (d.paid_months || []).includes(currentMonthStr);

        if (d.payment_type === 'OneTime') {
            return (d.status !== Status.Paid && startDate <= endOfMonth) || isPaidThisMonth;
        }
        if (d.payment_type === 'Installments') {
            const monthsPassed = (currentYear - startDate.getUTCFullYear()) * 12 + (currentMonth - startDate.getUTCMonth());
            const isWithinPeriod = monthsPassed >= 0 && monthsPassed < (d.installments_total || 0);
            return isWithinPeriod || isPaidThisMonth;
        }
        if (d.payment_type === 'Monthly') {
            return (d.status !== Status.Paid && startDate <= endOfMonth) || isPaidThisMonth;
        }
        return false;
    });
  }, [debtors, selectedDate, currentMonthStr]);
  
  const totalMonthlyValue = useMemo(() => {
      return visibleDebtors.reduce((acc, d) => {
          if ((d.paid_months || []).includes(currentMonthStr)) {
            const value = d.payment_type === 'Installments' ? (d.total_value / (d.installments_total || 1)) : d.total_value;
            return acc + value;
          }
          return acc;
      }, 0);
  }, [visibleDebtors, currentMonthStr]);

  const openModal = (debtor: Debtor | null) => {
    if (isPastMonth) return;
    setEditingDebtor(debtor);
    setFormData(debtor ? { ...debtor } : emptyDebtor);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDebtor(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
  };
  
  const handleValueChange = (newValue: number) => {
      setFormData(prev => ({...prev, total_value: newValue}));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDebtor) {
      await crudHooks.updateItem({ ...editingDebtor, ...formData });
    } else {
      await crudHooks.addItem(formData);
    }
    closeModal();
  };

  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setDebtorToDelete(id);
  }

  const confirmDelete = async () => {
    if (debtorToDelete) {
      await crudHooks.deleteItem(debtorToDelete);
      setDebtorToDelete(null);
    }
  };
  
  const handleTogglePayment = async (debtor: Debtor) => {
    if (isPastMonth) return;
    const paidMonths = debtor.paid_months || [];
    const isPaidThisMonth = paidMonths.includes(currentMonthStr);
    let updatedDebtor = { ...debtor };

    if (isPaidThisMonth) {
      updatedDebtor.paid_months = paidMonths.filter(m => m !== currentMonthStr);
      if (debtor.payment_type === 'Installments') updatedDebtor.installments_paid = Math.max(0, (debtor.installments_paid || 0) - 1);
    } else {
      updatedDebtor.paid_months = [...paidMonths, currentMonthStr];
      if (debtor.payment_type === 'Installments') updatedDebtor.installments_paid = (debtor.installments_paid || 0) + 1;
    }
    
    if (debtor.payment_type === 'OneTime') updatedDebtor.status = updatedDebtor.paid_months.length > 0 ? Status.Paid : Status.Pending;
    else if (debtor.payment_type === 'Installments') {
      const total = debtor.installments_total || 1;
      const paid = updatedDebtor.installments_paid || 0;
      updatedDebtor.status = paid >= total ? Status.Paid : Status.Pending;
    }
    
    await crudHooks.updateItem(updatedDebtor);
  };

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingDebtor ? 'Editar Devedor' : 'Adicionar Devedor'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nome do Devedor</label>
              <input type="text" name="person_name" value={formData.person_name} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Descrição</label>
              <input type="text" name="description" value={formData.description} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm"/>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Categoria</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {appSettings.debtor_categories.map(cat => (
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

             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Total (R$)</label>
              <CurrencyInput value={formData.total_value} onChange={handleValueChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm font-bold"/>
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data Inicial</label>
              <DatePicker value={formData.start_date} onChange={(date) => setFormData(prev => ({...prev, start_date: date}))} />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tipo de Pagamento</label>
              <div className="flex gap-2">
                  <SelectableTag label="À Vista / Único" selected={formData.payment_type === 'OneTime'} onClick={() => setFormData(prev => ({...prev, payment_type: 'OneTime'}))} colorClass="blue" icon={Banknote} />
                  <SelectableTag label="Parcelado" selected={formData.payment_type === 'Installments'} onClick={() => setFormData(prev => ({...prev, payment_type: 'Installments'}))} colorClass="blue" icon={ListPlus} />
                  <SelectableTag label="Recorrente (Mensal)" selected={formData.payment_type === 'Monthly'} onClick={() => setFormData(prev => ({...prev, payment_type: 'Monthly'}))} colorClass="blue" icon={CalendarClock} />
              </div>
            </div>

            {formData.payment_type === 'Installments' && (
                <>
                 <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Total de Parcelas</label>
                  <input type="number" name="installments_total" value={formData.installments_total} onChange={handleChange} min="1" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-center"/>
                </div>
                 <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Parcelas Pagas</label>
                  <input type="number" name="installments_paid" value={formData.installments_paid} onChange={handleChange} min="0" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-center"/>
                </div>
              </>
            )}
            {formData.payment_type === 'Monthly' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Dia do Vencimento</label>
                  <input type="number" name="monthly_due_date" value={formData.monthly_due_date || 1} onChange={handleChange} min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-center"/>
                </div>
            )}
          </div>
           <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Observações</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm resize-none"></textarea>
            </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-700">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal isOpen={!!debtorToDelete} onClose={() => setDebtorToDelete(null)} onConfirm={confirmDelete} title="Confirmar Exclusão">
        Tem certeza de que deseja excluir este registro? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
         <ViewHeader 
          title="Valores a Receber" setIsSidebarOpen={setIsSidebarOpen}
          selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          isPrivacyMode={isPrivacyMode} setIsPrivacyMode={setIsPrivacyMode}
          isAnimationsEnabled={isAnimationsEnabled} setIsAnimationsEnabled={setIsAnimationsEnabled}
        >
          <button 
            onClick={() => openModal(null)}
            disabled={isPastMonth}
            title={isPastMonth ? "Não é possível adicionar em meses anteriores" : "Adicionar novo devedor"}
            className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            <PlusCircle size={18} /> Adicionar
          </button>
        </ViewHeader>
        
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">Pessoa / Descrição</th>
                <th scope="col" className="px-6 py-3">Status Mês</th>
                <th scope="col" className="px-6 py-3">Valor Previsto</th>
                <th scope="col" className="px-6 py-3">Tipo</th>
                <th scope="col" className="px-6 py-3">Status Geral</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleDebtors.map((debtor) => {
                const isPaidThisMonth = (debtor.paid_months || []).includes(currentMonthStr);
                const installmentValue = debtor.payment_type === 'Installments' ? debtor.total_value / (debtor.installments_total || 1) : debtor.total_value;
                
                return (
                <tr key={debtor.id} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors ${isPaidThisMonth ? 'text-slate-400 dark:text-slate-500 line-through opacity-70' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                    <div className="flex items-center gap-2">
                         <User size={16} className="text-slate-400"/>
                         <span className={isPaidThisMonth ? '' : 'text-slate-800 dark:text-slate-100'}>{debtor.person_name}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">{debtor.description}</p>
                  </td>
                  <td className="px-6 py-4">
                     <button 
                        onClick={() => handleTogglePayment(debtor)} 
                        disabled={isPastMonth} 
                        title={isPastMonth ? "Não é possível alterar o status" : "Alterar status de recebimento"}
                        className={`px-2 py-1 rounded-full text-xs font-semibold w-20 text-center transition-colors cursor-pointer disabled:cursor-not-allowed ${ isPaidThisMonth ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}
                        aria-label={`Marcar ${debtor.description} como recebido este mês`}
                      >
                        {isPaidThisMonth ? 'Recebido' : 'Pendente'}
                     </button>
                  </td>
                  <td className="px-6 py-4"><PrivacyValue isPrivate={isPrivacyMode} value={installmentValue} animate={isAnimationsEnabled} /></td>
                  <td className="px-6 py-4">
                    {debtor.payment_type === 'Installments' ? (
                        <div className="flex flex-col">
                            <span className="text-xs">Parcelado</span>
                            <span className="text-xs font-semibold">{debtor.installments_paid} / {debtor.installments_total}</span>
                        </div>
                    ) : debtor.payment_type === 'Monthly' ? 'Mensal' : 'À Vista'}
                  </td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(debtor.status)}`}>{debtor.status}</span></td>
                  <td className="px-6 py-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(debtor)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar registro"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(debtor.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir registro"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )})}
              {visibleDebtors.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhum valor a receber neste mês.</td></tr>}
            </tbody>
            {visibleDebtors.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                    <tr>
                        <td colSpan={5} className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">Total a Receber no Mês</td>
                        <td className="px-6 py-3 text-right"><PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyValue} animate={isAnimationsEnabled} /></td>
                    </tr>
                </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default Debtors;
