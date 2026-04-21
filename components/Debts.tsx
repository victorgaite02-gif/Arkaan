
import React, { useState, useMemo } from 'react';
import { Debt, Status, NegotiationStatus, AppSettings, Person, ViewFilterType } from '../types';
import { CrudHooks } from '../App';
import { Edit, Trash2, PlusCircle, User, CheckCircle2, AlertTriangle, XCircle, Timer, FileWarning } from 'lucide-react';
import { getStatusColor } from '../utils/styleUtils';
import Modal from './common/Modal';
import ConfirmationModal from './common/ConfirmationModal';
import ViewHeader from './common/ViewHeader';
import CurrencyInput from './common/CurrencyInput';
import DatePicker from './common/DatePicker';
import { formatToUTCDateString } from '../utils/dateUtils';
import PrivacyValue from './common/PrivacyValue';
import SelectableTag from './common/SelectableTag';

interface DebtsProps {
  debts: Debt[];
  crudHooks: CrudHooks<Debt>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewFilter: ViewFilterType;
  setViewFilter: (filter: ViewFilterType) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (isPrivate: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (enabled: boolean) => void;
}

const Debts: React.FC<DebtsProps> = ({ 
    debts, crudHooks, appSettings, setIsSidebarOpen, 
    selectedDate, setSelectedDate, viewFilter, setViewFilter,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
    const emptyDebt: Omit<Debt, 'id' | 'user_id'> = {
        creditor: '', description: '', category: appSettings.debt_categories[0] || '',
        original_value: 0, current_value: 0, start_date: formatToUTCDateString(new Date()),
        next_installment_date: formatToUTCDateString(new Date()), status: Status.InProgress,
        negotiation_status: NegotiationStatus.Renegotiated, person_id: '', notes: '',
        total_installments: 12, paid_installments: 0,
    };
    
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Debt, 'id' | 'user_id'>>(emptyDebt);
  
  const now = new Date();
  const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const isPastMonth = selectedDate.getTime() < startOfCurrentMonth.getTime();

  const currentMonthStr = `${selectedDate.getUTCFullYear()}-${(selectedDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;

  const getPersonNameById = (id?: string): string => appSettings.people.find(p => p.id === id)?.name || '';

  const { negotiatedDebts, pendingDebts } = useMemo(() => {
    const baseDebts = viewFilter === 'own' ? debts.filter(d => !d.person_id) : debts;

    const negotiated = baseDebts.filter(d => {
        if (d.negotiation_status !== NegotiationStatus.Renegotiated) return false;
        const startDate = new Date(`${d.start_date}T00:00:00Z`);
        const monthsPassed = (selectedDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (selectedDate.getUTCMonth() - startDate.getUTCMonth());
        return monthsPassed >= 0 && monthsPassed < (d.total_installments || Infinity);
    });
    const pending = baseDebts.filter(d => d.negotiation_status === NegotiationStatus.Pending);
    return { negotiatedDebts: negotiated, pendingDebts: pending };
  }, [debts, selectedDate, viewFilter]);

  const totalMonthlyInstallments = useMemo(() => {
    return negotiatedDebts.reduce((acc, debt) => {
      const installmentValue = debt.total_installments ? debt.original_value / debt.total_installments : 0;
      return acc + installmentValue;
    }, 0);
  }, [negotiatedDebts]);
  
  const openModal = (debt: Debt | null) => {
    if (isPastMonth) return;
    setEditingDebt(debt);
    setFormData(debt ? { ...debt } : emptyDebt);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDebt(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'total_installments' || name === 'paid_installments' ? parseInt(value) : value }));
  };
  
  const handleValueChange = (name: 'original_value' | 'current_value', newValue: number) => {
      setFormData(prev => ({...prev, [name]: newValue}));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
        ...formData,
        person_id: formData.person_id || undefined,
    };
    if (editingDebt) {
      await crudHooks.updateItem({ ...editingDebt, ...dataToSave });
    } else {
      await crudHooks.addItem(dataToSave);
    }
    closeModal();
  };
  
  const handleDelete = (id: number) => {
    if (isPastMonth) return;
    setDebtToDelete(id);
  }

  const confirmDelete = async () => {
    if(debtToDelete) {
        await crudHooks.deleteItem(debtToDelete);
        setDebtToDelete(null);
    }
  };

  const handleTogglePaidMonth = async (debt: Debt) => {
    if (isPastMonth) return;
    const paidMonths = debt.paid_months || [];
    const isPaid = paidMonths.includes(currentMonthStr);
    let newPaidInstallments = debt.paid_installments || 0;
    let newPaidMonths: string[];
    let newStatus = debt.status;

    if (isPaid) {
        newPaidInstallments = Math.max(0, newPaidInstallments - 1);
        newPaidMonths = paidMonths.filter(m => m !== currentMonthStr);
    } else {
        newPaidInstallments++;
        newPaidMonths = [...paidMonths, currentMonthStr];
    }
    
    if (debt.total_installments && newPaidInstallments >= debt.total_installments) {
        newStatus = Status.Settled;
    } else {
        newStatus = Status.InProgress;
    }

    await crudHooks.updateItem({ ...debt, paid_months: newPaidMonths, paid_installments: newPaidInstallments, status: newStatus });
  };

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingDebt ? 'Editar Dívida' : 'Adicionar Dívida'}>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Status da Negociação</label>
              <div className="flex gap-2">
                  <SelectableTag label="Renegociada (Parcelada)" selected={formData.negotiation_status === NegotiationStatus.Renegotiated} onClick={() => setFormData(prev => ({...prev, negotiation_status: NegotiationStatus.Renegotiated}))} colorClass="green" icon={CheckCircle2} />
                  <SelectableTag label="Pendente" selected={formData.negotiation_status === NegotiationStatus.Pending} onClick={() => setFormData(prev => ({...prev, negotiation_status: NegotiationStatus.Pending}))} colorClass="orange" icon={AlertTriangle} />
              </div>
            </div>

             <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Atribuir a</label>
              <div className="flex flex-wrap gap-2">
                  <SelectableTag label="Ninguém" selected={!formData.person_id} onClick={() => setFormData(prev => ({...prev, person_id: ''}))} colorClass="slate" />
                  {appSettings.people.map(p => (
                      <SelectableTag key={p.id} label={p.name} selected={formData.person_id === p.id} onClick={() => setFormData(prev => ({...prev, person_id: p.id}))} colorClass="purple" icon={User} />
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Credor</label>
              <input type="text" name="creditor" value={formData.creditor} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm"/>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Categoria</label>
              <select name="category" value={formData.category} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm">
                 {appSettings.debt_categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Descrição</label>
              <input type="text" name="description" value={formData.description} onChange={handleChange} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Original (R$)</label>
              <CurrencyInput value={formData.original_value} onChange={(v) => handleValueChange('original_value', v)} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm font-bold"/>
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Valor Atual/Restante (R$)</label>
              <CurrencyInput value={formData.current_value} onChange={(v) => handleValueChange('current_value', v)} required className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm font-bold"/>
            </div>
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Data Inicial</label>
              <DatePicker value={formData.start_date} onChange={(date) => setFormData(prev => ({...prev, start_date: date}))} />
            </div>

            {formData.negotiation_status === NegotiationStatus.Renegotiated && (
                <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Próx. Parcela</label>
                   <DatePicker value={formData.next_installment_date} onChange={(date) => setFormData(prev => ({...prev, next_installment_date: date}))} />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Status da Parcela</label>
                  <div className="flex gap-2">
                      <SelectableTag label="Em Dia" selected={formData.status === Status.InProgress} onClick={() => setFormData(prev => ({...prev, status: Status.InProgress}))} colorClass="blue" icon={Timer} />
                      <SelectableTag label="Atrasado" selected={formData.status === Status.Overdue} onClick={() => setFormData(prev => ({...prev, status: Status.Overdue}))} colorClass="red" icon={FileWarning} />
                      <SelectableTag label="Quitado" selected={formData.status === Status.Settled} onClick={() => setFormData(prev => ({...prev, status: Status.Settled}))} colorClass="green" icon={CheckCircle2} />
                  </div>
                </div>

                 <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Total de Parcelas</label>
                  <input type="number" name="total_installments" value={formData.total_installments} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-center"/>
                </div>
                 <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Parcelas Pagas</label>
                  <input type="number" name="paid_installments" value={formData.paid_installments} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm text-center"/>
                </div>
              </>
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

      <ConfirmationModal isOpen={!!debtToDelete} onClose={() => setDebtToDelete(null)} onConfirm={confirmDelete} title="Confirmar Exclusão">
        Tem certeza de que deseja excluir esta dívida? Esta ação não pode ser desfeita.
      </ConfirmationModal>

       <ViewHeader 
        title="Dívidas e Negociações" 
        setIsSidebarOpen={setIsSidebarOpen} 
        selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate}
        viewFilter={viewFilter}
        setViewFilter={setViewFilter}
        isPrivacyMode={isPrivacyMode}
        setIsPrivacyMode={setIsPrivacyMode}
        isAnimationsEnabled={isAnimationsEnabled}
        setIsAnimationsEnabled={setIsAnimationsEnabled}
      >
         <button 
            onClick={() => openModal(null)}
            disabled={isPastMonth}
            title={isPastMonth ? "Não é possível adicionar em meses anteriores" : "Adicionar nova dívida"}
            className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg w-full sm:w-auto disabled:bg-blue-800 disabled:cursor-not-allowed"
        >
            <PlusCircle size={18} /> Adicionar Dívida
        </button>
      </ViewHeader>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Dívidas em Pagamento (Renegociadas)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">Credor / Pessoa</th>
                <th scope="col" className="px-6 py-3">Status Mês</th>
                <th scope="col" className="px-6 py-3">Valor da Parcela</th>
                <th scope="col" className="px-6 py-3">Progresso</th>
                <th scope="col" className="px-6 py-3">Status Geral</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {negotiatedDebts.map((debt) => {
                const isSettled = debt.status === Status.Settled;
                const progress = debt.total_installments ? (((debt.paid_installments || 0) / debt.total_installments) * 100) : 0;
                const isPaidThisMonth = (debt.paid_months || []).includes(currentMonthStr);
                const installmentValue = debt.total_installments ? debt.original_value / debt.total_installments : debt.current_value;
                const assignedPersonName = getPersonNameById(debt.person_id);

                return (
                <tr key={debt.id} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors ${isPaidThisMonth ? 'text-slate-400 dark:text-slate-500 line-through opacity-70' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                    <div>
                        <span className={isPaidThisMonth ? '' : 'text-slate-800 dark:text-slate-100'}>{debt.creditor}</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-1 mt-1" title={`Atribuído a: ${assignedPersonName}`}><User size={12}/> {assignedPersonName.split(' ')[0] || 'N/A'}</div>
                  </td>
                   <td className="px-6 py-4">
                    {debt.total_installments && (
                        <button onClick={() => handleTogglePaidMonth(debt)} disabled={isPastMonth} title={isPastMonth ? "Não é possível alterar o status" : "Alterar status de pagamento"} className={`px-2 py-1 rounded-full text-xs font-semibold w-20 text-center transition-colors cursor-pointer disabled:cursor-not-allowed ${ isPaidThisMonth ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`} aria-label={`Marcar parcela de ${debt.creditor} como paga para este mês`}>
                          {isPaidThisMonth ? 'Pago' : 'Pendente'}
                        </button>
                    )}
                  </td>
                  <td className="px-6 py-4"><PrivacyValue isPrivate={isPrivacyMode} value={installmentValue} animate={isAnimationsEnabled} /></td>
                  <td className="px-6 py-4">
                    {debt.total_installments ? (
                        <div className="flex flex-col">
                            <span className={`font-semibold ${isSettled ? 'text-green-500' : (isPaidThisMonth ? '' : 'text-slate-800 dark:text-slate-100')}`}>
                                {debt.paid_installments || 0} / {debt.total_installments} {isSettled ? '(Quitado)' : ''}
                            </span>
                            <div className="w-24 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-1">
                                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    ) : (<span>N/A</span>)}
                  </td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(debt.status)}`}>{debt.status}</span></td>
                  <td className="px-6 py-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(debt)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar dívida"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(debt.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir dívida"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )})}
            </tbody>
            {negotiatedDebts.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                    <tr>
                        <td colSpan={5} className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">Total de Parcelas do Mês</td>
                        <td className="px-6 py-3 text-right"><PrivacyValue isPrivate={isPrivacyMode} value={totalMonthlyInstallments} animate={isAnimationsEnabled} /></td>
                    </tr>
                </tfoot>
            )}
          </table>
           {negotiatedDebts.length === 0 && <p className="text-center py-4 text-slate-500 dark:text-slate-400">Nenhuma dívida em pagamento para este mês.</p>}
        </div>
      </div>

       <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Dívidas Pendentes de Negociação</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">Credor / Pessoa</th>
                <th scope="col" className="px-6 py-3">Descrição</th>
                <th scope="col" className="px-6 py-3">Valor Estimado</th>
                <th scope="col" className="px-6 py-3">Data Inicial</th>
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingDebts.map((debt) => {
                const assignedPersonName = getPersonNameById(debt.person_id);
                return (
                <tr key={debt.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600/50">
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                     <div>
                        {debt.creditor}
                    </div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-1 mt-1" title={`Atribuído a: ${assignedPersonName}`}>
                        <User size={12}/> {assignedPersonName.split(' ')[0] || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">{debt.description}</td>
                  <td className="px-6 py-4"><PrivacyValue isPrivate={isPrivacyMode} value={debt.current_value} animate={isAnimationsEnabled} /></td>
                  <td className="px-6 py-4">{new Date(`${debt.start_date}T00:00:00Z`).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                  <td className="px-6 py-4 flex space-x-2 justify-end">
                    <button onClick={() => openModal(debt)} disabled={isPastMonth} title={isPastMonth ? "Não é possível editar meses anteriores" : "Editar dívida"} className="text-slate-400 hover:text-blue-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(debt.id)} disabled={isPastMonth} title={isPastMonth ? "Não é possível excluir em meses anteriores" : "Excluir dívida"} className="text-slate-400 hover:text-red-500 disabled:text-slate-600 disabled:cursor-not-allowed"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
           {pendingDebts.length === 0 && <p className="text-center py-4 text-slate-500 dark:text-slate-400">Nenhuma dívida pendente de negociação.</p>}
        </div>
      </div>
    </div>
  );
};

export default Debts;
