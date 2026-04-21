
import React, { useState, useMemo } from 'react';
import { Income, Company, AppSettings } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle, Building2, Tag } from 'lucide-react';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import { formatToUTCDateString } from '../utils/dateUtils';
import PrivacyValue from './common/PrivacyValue';

interface IncomesProps {
  incomes: Income[];
  crudHooks: CrudHooks<Income>;
  appSettings: AppSettings;
  companies: Company[];
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const Incomes: React.FC<IncomesProps> = ({ 
    incomes, crudHooks, appSettings, companies,
    setIsSidebarOpen, selectedDate, setSelectedDate,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled 
}) => {
  const emptyIncome: Omit<Income, 'id' | 'user_id'> = {
    source: '',
    category: appSettings.income_categories[0] || '',
    value: 0,
    receipt_date: formatToUTCDateString(new Date()),
    is_recurring: false,
    notes: '',
    company_id: undefined,
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Income, 'id' | 'user_id'>>(emptyIncome);
  
  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();

  const getCompanyName = (companyId?: number) => companies.find(c => c.id === companyId)?.name || 'N/A';

  const visibleIncomes = useMemo(() => {
    return incomes.filter(i => {
      const d = new Date(`${i.receipt_date}T00:00:00Z`);
      return d.getUTCMonth() === selectedDate.getUTCMonth() && d.getUTCFullYear() === selectedDate.getUTCFullYear();
    });
  }, [incomes, selectedDate]);
  
  const totalMonthlyValue = useMemo(() => {
      return visibleIncomes.reduce((acc, i) => acc + i.value, 0);
  }, [visibleIncomes]);

  const openModal = (income: Income | null) => {
    if (isPastMonth) return;
    setEditingIncome(income);
    setFormData(income ? { ...income } : emptyIncome);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIncome(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleValueChange = (newValue: number) => {
    setFormData(prev => ({ ...prev, value: newValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, company_id: formData.company_id ? Number(formData.company_id) : undefined };
    if (editingIncome) {
        await crudHooks.updateItem({ ...editingIncome, ...dataToSave });
    } else {
        await crudHooks.addItem(dataToSave);
    }
    closeModal();
  };
  
  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setIncomeToDelete(id);
  }
  
  const confirmDelete = async () => {
    if (incomeToDelete) {
        await crudHooks.deleteItem(incomeToDelete);
        setIncomeToDelete(null);
    }
  };

  // Reusable Tag Component
  const SelectableTag = ({ label, selected, onClick, icon: Icon, colorClass = "green" }: { label: string, selected: boolean, onClick: () => void, icon?: any, colorClass?: string }) => (
      <button 
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
            selected 
                ? `bg-${colorClass}-600 text-white border-${colorClass}-600 shadow-sm scale-105` 
                : `bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700`
        }`}
      >
          {Icon && <Icon size={12} />}
          {label}
      </button>
  );

  return (
    <>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingIncome ? "Editar Receita" : "Adicionar Nova Receita"}>
        <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Fonte da Receita</label>
                    <input type="text" name="source" value={formData.source} onChange={handleChange} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500" placeholder="Ex: Salário, Freelance"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor (R$)</label>
                    <CurrencyInput value={formData.value} onChange={handleValueChange} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm font-bold text-lg"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data</label>
                    <DatePicker value={formData.receipt_date} onChange={(date) => setFormData(prev => ({ ...prev, receipt_date: date }))} />
                </div>
            </div>

            {/* CATEGORIES (Tags) */}
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Categoria</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {appSettings.income_categories.map(cat => (
                        <SelectableTag 
                            key={cat} 
                            label={cat} 
                            selected={formData.category === cat} 
                            onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                            icon={Tag}
                        />
                    ))}
                </div>
            </div>

            {/* COMPANY & RECURRING */}
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Empresa Vinculada (PJ)</label>
                <div className="flex flex-wrap gap-2 mb-4">
                    <SelectableTag 
                        label="Nenhuma" 
                        selected={!formData.company_id} 
                        onClick={() => setFormData(prev => ({ ...prev, company_id: undefined }))}
                        colorClass="slate"
                    />
                    {companies.map(c => (
                        <SelectableTag 
                            key={c.id} 
                            label={c.name} 
                            selected={formData.company_id === c.id} 
                            onClick={() => setFormData(prev => ({ ...prev, company_id: c.id }))}
                            icon={Building2}
                            colorClass="blue"
                        />
                    ))}
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto inline-flex border border-slate-200 dark:border-slate-700">
                     <button 
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, is_recurring: false}))}
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.is_recurring ? 'bg-white shadow-sm text-slate-800 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                     >
                         Receita Única
                     </button>
                     <button 
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, is_recurring: true}))}
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.is_recurring ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                     >
                         Recorrente
                     </button>
                 </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Observações</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm resize-none"></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-xl">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-lg shadow-green-200 dark:shadow-none transition-transform hover:scale-105 active:scale-95">Salvar Receita</button>
            </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!incomeToDelete}
        onClose={() => setIncomeToDelete(null)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
      >
        Tem certeza de que deseja excluir esta receita? Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
        <ViewHeader 
          title="Receitas" 
          setIsSidebarOpen={setIsSidebarOpen}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          isPrivacyMode={isPrivacyMode} setIsPrivacyMode={setIsPrivacyMode}
          isAnimationsEnabled={isAnimationsEnabled} setIsAnimationsEnabled={setIsAnimationsEnabled}
        >
          <button 
            onClick={() => openModal(null)}
            disabled={isPastMonth}
            title={isPastMonth ? "Não é possível adicionar receitas em meses anteriores" : "Adicionar nova receita"}
            className="flex items-center gap-2 text-sm text-white bg-green-600 hover:bg-green-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-green-800 disabled:cursor-not-allowed"
          >
            <PlusCircle size={18} />
            Adicionar Receita
          </button>
        </ViewHeader>

        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">Fonte</th>
                <th scope="col" className="px-6 py-3">Categoria</th>
                <th scope="col" className="px-6 py-3">Empresa</th>
                <th scope="col" className="px-6 py-3">Data</th>
                <th scope="col" className="px-6 py-3">Valor Bruto</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleIncomes.map((income) => (
                <tr key={income.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50">
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{income.source}</td>
                  <td className="px-6 py-4">{income.category}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        {income.company_id && <Building2 size={14} className="text-slate-400"/>}
                        <span>{getCompanyName(income.company_id)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{new Date(`${income.receipt_date}T00:00:00Z`).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                  <td className="px-6 py-4"><PrivacyValue isPrivate={isPrivacyMode} value={income.value} animate={isAnimationsEnabled} /></td>
                  <td className="px-6 py-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(income)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar receita"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(income.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir receita"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {visibleIncomes.length === 0 && (<tr><td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhuma receita para o mês selecionado.</td></tr>)}
            </tbody>
            {visibleIncomes.length > 0 && (
                 <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                    <tr>
                        <td colSpan={5} className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">Total Bruto do Mês</td>
                        <td className="px-6 py-3 text-right"><PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyValue} className="font-bold" animate={isAnimationsEnabled} /></td>
                    </tr>
                </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
};

export default Incomes;
