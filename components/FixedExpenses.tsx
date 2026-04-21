
import React, { useState, useMemo } from 'react';
import { FixedExpense, PaymentMethod, AppSettings } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
import { getPaymentMethodIcon } from '../utils/styleUtils';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import PrivacyValue from './common/PrivacyValue';
import SelectableTag from './common/SelectableTag';

interface FixedExpensesProps {
  fixedExpenses: FixedExpense[];
  crudHooks: CrudHooks<FixedExpense>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const FixedExpenses: React.FC<FixedExpensesProps> = ({ 
    fixedExpenses, crudHooks, appSettings, setIsSidebarOpen, 
    selectedDate, setSelectedDate,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
  const emptyExpense: Omit<FixedExpense, 'id' | 'user_id'> = {
    category: appSettings.fixed_expense_categories[0] || '',
    value: 0, due_date: 1, payment_method: PaymentMethod.Boleto, notes: '',
  };
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<FixedExpense, 'id' | 'user_id'>>(emptyExpense);
  
  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();

  const currentMonthStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;

  const openModal = (expense: FixedExpense | null) => {
    if (isPastMonth) return;
    setEditingExpense(expense);
    setFormData(expense ? { ...expense } : emptyExpense);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'due_date' ? parseInt(value) : value }));
  };

  const handleValueChange = (newValue: number) => {
      setFormData(prev => ({...prev, value: newValue}));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      await crudHooks.updateItem({ ...editingExpense, ...formData });
    } else {
      await crudHooks.addItem({ ...formData, paid_months: [] });
    }
    closeModal();
  };

  const handleTogglePaidMonth = async (expense: FixedExpense) => {
    if (isPastMonth) return;
    const paidMonths = expense.paid_months || [];
    const isPaid = paidMonths.includes(currentMonthStr);
    const newPaidMonths = isPaid ? paidMonths.filter(m => m !== currentMonthStr) : [...paidMonths, currentMonthStr];
    await crudHooks.updateItem({ ...expense, paid_months: newPaidMonths });
  };

  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setExpenseToDelete(id);
  }

  const confirmDelete = async () => {
    if(expenseToDelete) {
        await crudHooks.deleteItem(expenseToDelete);
        setExpenseToDelete(null);
    }
  };

  const totalMonthlyValue = useMemo(() => {
    return fixedExpenses.reduce((acc, exp) => acc + exp.value, 0);
  }, [fixedExpenses]);

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingExpense ? 'Editar Despesa' : 'Adicionar Despesa'}>
        <form onSubmit={handleSave} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Categoria</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {appSettings.fixed_expense_categories.map(cat => (
                      <SelectableTag 
                        key={cat} 
                        label={cat} 
                        selected={formData.category === cat} 
                        onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                        colorClass="orange"
                      />
                  ))}
              </div>
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor (R$)</label>
              <CurrencyInput
                name="value" value={formData.value} onChange={handleValueChange} required
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Dia do Vencimento</label>
              <input type="number" name="due_date" value={formData.due_date} onChange={handleChange} required min="1" max="31" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center"/>
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
           </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Notas</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"></textarea>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Salvar</button>
            </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!expenseToDelete} onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDelete} title="Confirmar Exclusão"
      >
        Tem certeza de que deseja excluir esta despesa fixa? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
         <ViewHeader 
          title="Despesas Fixas" setIsSidebarOpen={setIsSidebarOpen}
          selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          isPrivacyMode={isPrivacyMode} setIsPrivacyMode={setIsPrivacyMode}
          isAnimationsEnabled={isAnimationsEnabled} setIsAnimationsEnabled={setIsAnimationsEnabled}
        >
          <button 
            onClick={() => openModal(null)} 
            disabled={isPastMonth}
            title={isPastMonth ? "Não é possível adicionar em meses anteriores" : "Adicionar nova despesa"}
            className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            <PlusCircle size={18} />
            Adicionar Despesa
          </button>
        </ViewHeader>
        
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">Categoria</th>
                <th scope="col" className="px-6 py-3">Status Mês</th>
                <th scope="col" className="px-6 py-3">Valor</th>
                <th scope="col" className="px-6 py-3">Vencimento</th>
                <th scope="col" className="px-6 py-3">Pagamento</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fixedExpenses.map((exp) => {
                const isPaidThisMonth = (exp.paid_months || []).includes(currentMonthStr);
                const canBeChecked = exp.payment_method !== PaymentMethod.CreditCard;
                return (
                <tr key={exp.id} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors ${isPaidThisMonth && canBeChecked ? 'text-slate-400 dark:text-slate-500 line-through opacity-70' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white"><span className={isPaidThisMonth && canBeChecked ? '' : 'text-slate-800 dark:text-slate-100'}>{exp.category}</span></td>
                  <td className="px-6 py-4">
                    {canBeChecked ? (
                      <button
                        onClick={() => handleTogglePaidMonth(exp)}
                        disabled={isPastMonth}
                        title={isPastMonth ? "Não é possível alterar o status" : "Alterar status de pagamento"}
                        className={`px-2 py-1 rounded-full text-xs font-semibold cursor-pointer w-20 text-center transition-colors disabled:cursor-not-allowed ${ isPaidThisMonth ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' }`}
                        aria-label={`Marcar ${exp.category} como pago para este mês`}
                      >
                        {isPaidThisMonth ? 'Pago' : 'Pendente'}
                      </button>
                    ) : ( <span className="text-xs text-slate-400 italic">Automático</span> )}
                  </td>
                  <td className="px-6 py-4">
                    <PrivacyValue isPrivate={isPrivacyMode} value={exp.value} animate={isAnimationsEnabled} />
                  </td>
                  <td className="px-6 py-4">Dia {exp.due_date}</td>
                  <td className="px-6 py-4"><div className="flex items-center space-x-2">{getPaymentMethodIcon(exp.payment_method)}<span>{exp.payment_method}</span></div></td>
                  <td className="px-6 py-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(exp)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar despesa"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(exp.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir despesa"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )})}
            </tbody>
            {fixedExpenses.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                    <tr>
                        <td colSpan={5} className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">Total do Mês</td>
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

export default FixedExpenses;
