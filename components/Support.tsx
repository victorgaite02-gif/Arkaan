
import React, { useState } from 'react';
import { SupportTicket, AppSettings } from '../types';
import { CrudHooks } from '../App';
import ViewHeader from './common/ViewHeader';
import { PlusCircle, MessageSquare, AlertCircle, Lightbulb, HelpCircle, CheckCircle, Clock, Trash2, Edit } from 'lucide-react';
import Modal from './common/Modal';
import SelectableTag from './common/SelectableTag';
import ConfirmationModal from './common/ConfirmationModal';

interface SupportProps {
  tickets: SupportTicket[];
  crudHooks: CrudHooks<SupportTicket>;
  appSettings: AppSettings;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (v: boolean) => void;
  isAnimationsEnabled: boolean;
  setIsAnimationsEnabled: (v: boolean) => void;
}

const Support: React.FC<SupportProps> = ({ 
    tickets, crudHooks, appSettings, setIsSidebarOpen,
    isPrivacyMode, setIsPrivacyMode, isAnimationsEnabled, setIsAnimationsEnabled
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [ticketToDelete, setTicketToDelete] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTicketId, setEditTicketId] = useState<number | null>(null);

    const emptyForm = { title: '', description: '', type: 'other' as SupportTicket['type'] };
    const [formData, setFormData] = useState(emptyForm);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        await crudHooks.addItem({
            ...formData,
            status: 'open',
            updated_at: new Date().toISOString()
        });
        closeForm();
    };

    const handleUpdateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editTicketId) return;
        const ticketToUpdate = tickets.find(t => t.id === editTicketId);
        if(!ticketToUpdate) return;

        await crudHooks.updateItem({
            ...ticketToUpdate,
            title: formData.title,
            description: formData.description,
            type: formData.type,
            updated_at: new Date().toISOString()
        });
        closeForm();
    };

    const handleDeleteTicket = async () => {
        if(ticketToDelete) {
            await crudHooks.deleteItem(ticketToDelete);
            setTicketToDelete(null);
            setSelectedTicket(null); // Close detail if open
        }
    };

    const openEditModal = (ticket: SupportTicket, e: React.MouseEvent) => {
        e.stopPropagation();
        if(ticket.status === 'resolved' || ticket.status === 'closed') {
            alert("Não é possível editar tickets finalizados.");
            return;
        }
        setIsEditing(true);
        setEditTicketId(ticket.id);
        setFormData({ title: ticket.title, description: ticket.description, type: ticket.type });
        setIsModalOpen(true);
    };

    const openDeleteConfirm = (ticketId: number, status: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(status === 'resolved' || status === 'closed') {
             // Optional: Allow deleting old history if desired, but blocking for consistency?
             // Actually, deleting history is fine.
        }
        setTicketToDelete(ticketId);
    };

    const closeForm = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setEditTicketId(null);
        setFormData(emptyForm);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'resolved': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> Resolvido</span>;
            case 'closed': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs font-bold">Fechado</span>;
            case 'in_progress': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12}/> Em Análise</span>;
            default: return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold">Aberto</span>;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'bug': return <AlertCircle size={18} className="text-red-500"/>;
            case 'suggestion': return <Lightbulb size={18} className="text-amber-500"/>;
            case 'complaint': return <MessageSquare size={18} className="text-orange-500"/>;
            default: return <HelpCircle size={18} className="text-blue-500"/>;
        }
    };

    const getTypeText = (type: string) => {
        switch (type) {
            case 'bug': return 'Erro / Bug';
            case 'suggestion': return 'Sugestão';
            case 'complaint': return 'Reclamação';
            default: return 'Outro';
        }
    };

    return (
        <div className="space-y-6">
            <ViewHeader 
                title="Central de Ajuda" 
                setIsSidebarOpen={setIsSidebarOpen}
                isPrivacyMode={isPrivacyMode}
                setIsPrivacyMode={setIsPrivacyMode}
                isAnimationsEnabled={isAnimationsEnabled}
                setIsAnimationsEnabled={setIsAnimationsEnabled}
            >
                <button onClick={() => { setIsEditing(false); setIsModalOpen(true); }} className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-semibold py-2 px-4 rounded-lg">
                    <PlusCircle size={18} /> Novo Ticket
                </button>
            </ViewHeader>

            <div className="grid grid-cols-1 gap-4">
                {tickets.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 p-12 rounded-xl text-center border border-dashed border-slate-300 dark:border-slate-700">
                        <HelpCircle size={48} className="mx-auto text-slate-300 mb-4"/>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhum chamado aberto</h3>
                        <p className="text-sm text-slate-500 mt-2">Tem alguma dúvida, sugestão ou encontrou um erro? Abra um ticket.</p>
                    </div>
                ) : (
                    tickets.map(ticket => (
                        <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                        {getTypeIcon(ticket.type)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white">{ticket.title}</h4>
                                        <span className="text-xs text-slate-500">{getTypeText(ticket.type)} • {new Date(ticket.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(ticket.status)}
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{ticket.description}</p>
                            
                            {/* Action Buttons (Visible on hover or mobile always?) */}
                            <div className="mt-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-3">
                                {ticket.admin_response ? (
                                    <div className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                                        <MessageSquare size={12}/> Respondido
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">Aguardando resposta...</div>
                                )}
                                
                                <div className="flex gap-2">
                                    {/* Edit Button - Only if not resolved */}
                                    {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                                        <button 
                                            onClick={(e) => openEditModal(ticket, e)}
                                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                            title="Editar"
                                        >
                                            <Edit size={16}/>
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={(e) => openDeleteConfirm(ticket.id, ticket.status, e)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={closeForm} title={isEditing ? "Editar Ticket" : "Abrir Novo Chamado"}>
                <form onSubmit={isEditing ? handleUpdateTicket : handleCreateTicket} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Tipo</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'bug', label: 'Erro / Bug', icon: AlertCircle },
                                { id: 'suggestion', label: 'Sugestão', icon: Lightbulb },
                                { id: 'complaint', label: 'Reclamação', icon: MessageSquare },
                                { id: 'other', label: 'Outro', icon: HelpCircle },
                            ].map(opt => (
                                <SelectableTag
                                    key={opt.id}
                                    label={opt.label}
                                    icon={opt.icon}
                                    selected={formData.type === opt.id}
                                    onClick={() => setFormData({...formData, type: opt.id as any})}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título</label>
                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl" required placeholder="Resumo do assunto"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Descrição</label>
                        <textarea rows={5} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl resize-none" required placeholder="Descreva detalhadamente..."/>
                    </div>
                    <div className="flex justify-end pt-2 gap-3">
                        <button type="button" onClick={closeForm} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-bold">Cancelar</button>
                        <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-transform active:scale-95">
                            {isEditing ? "Salvar Alterações" : "Enviar Ticket"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* View Ticket Modal */}
            {selectedTicket && (
                <Modal isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} title="Detalhes do Ticket">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedTicket.title}</h3>
                                <p className="text-xs text-slate-500 mt-1">{getTypeText(selectedTicket.type)} • Aberto em {new Date(selectedTicket.created_at).toLocaleDateString()}</p>
                            </div>
                            {getStatusBadge(selectedTicket.status)}
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        {selectedTicket.admin_response ? (
                            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 animate-fade-in">
                                <h4 className="text-sm font-bold text-green-800 dark:text-green-300 mb-2">Resposta da Equipe:</h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedTicket.admin_response}</p>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-slate-400 italic py-4">Aguardando resposta da equipe de suporte.</p>
                        )}
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2">Fechar</button>
                        </div>
                    </div>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={!!ticketToDelete}
                onClose={() => setTicketToDelete(null)}
                onConfirm={handleDeleteTicket}
                title="Excluir Ticket"
            >
                Tem certeza de que deseja excluir este ticket? O histórico da conversa será perdido.
            </ConfirmationModal>
        </div>
    );
};

export default Support;
