
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { AppSettings, PlatformSetting, SystemAnnouncement, SupportTicket } from '../types';
import ViewHeader from './common/ViewHeader';
import { 
    Users, Shield, Activity, Megaphone, Search, 
    CheckCircle, XCircle, AlertTriangle, Plus, Trash2, 
    ToggleLeft, ToggleRight, Edit, Save, Crown, LifeBuoy, MessageSquare, Filter
} from 'lucide-react';
import LogoLoader from './common/LogoLoader';
import Modal from './common/Modal';

interface AdminProps {
    appSettings: AppSettings;
    setIsSidebarOpen: (isOpen: boolean) => void;
    isPrivacyMode: boolean;
    setIsPrivacyMode: (v: boolean) => void;
    isAnimationsEnabled: boolean;
    setIsAnimationsEnabled: (v: boolean) => void;
}

const Admin: React.FC<AdminProps> = ({ 
    appSettings, setIsSidebarOpen, 
    isPrivacyMode, setIsPrivacyMode, 
    isAnimationsEnabled, setIsAnimationsEnabled 
}) => {
    const [activeTab, setActiveTab] = useState<'users' | 'platform' | 'broadcast' | 'support'>('users');
    const [isLoading, setIsLoading] = useState(false);
    
    // Data States
    const [users, setUsers] = useState<AppSettings[]>([]);
    const [settings, setSettings] = useState<PlatformSetting[]>([]);
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    
    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'resolved'>('all');
    const [editingUser, setEditingUser] = useState<AppSettings | null>(null);
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [replyingTicket, setReplyingTicket] = useState<SupportTicket | null>(null);
    const [adminReply, setAdminReply] = useState('');
    
    // Announcement Form
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        message: '',
        type: 'info' as 'info' | 'warning' | 'success' | 'critical'
    });

    useEffect(() => {
        fetchAdminData();
    }, [activeTab]);

    const fetchAdminData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'users') {
                const { data } = await supabase.from('app_settings').select('*').order('created_at', { ascending: false });
                if (data) setUsers(data);
            } else if (activeTab === 'platform') {
                const { data } = await supabase.from('platform_settings').select('*');
                if (data) setSettings(data);
            } else if (activeTab === 'broadcast') {
                const { data } = await supabase.from('system_announcements').select('*').order('created_at', { ascending: false });
                if (data) setAnnouncements(data);
            } else if (activeTab === 'support') {
                const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
                
                if (data) {
                    // Enrich with user names (could be optimized with a join, but RLS makes direct join tricky sometimes)
                    // Since admins can view all app_settings, let's fetch user map
                    const { data: usersData } = await supabase.from('app_settings').select('user_id, user_name, user_email');
                    const userMap = new Map<string, any>((usersData || []).map((u: any) => [u.user_id, u]));
                    
                    const enrichedTickets = data.map(t => ({
                        ...t,
                        user_name: userMap.get(t.user_id)?.user_name || 'Desconhecido',
                        user_email: userMap.get(t.user_id)?.user_email || 'N/A'
                    }));
                    setTickets(enrichedTickets);
                }
            }
        } catch (error) {
            console.error("Error fetching admin data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- User Management ---
    const handleUpdateUserPlan = async (userId: string, plan: 'free' | 'pro' | 'vip') => {
        const { error } = await supabase.from('app_settings').update({ plan }).eq('user_id', userId);
        if (!error) {
            setUsers(users.map(u => u.user_id === userId ? { ...u, plan } : u));
            setEditingUser(null);
        }
    };

    const handleToggleAdmin = async (userId: string, isAdmin: boolean) => {
        if(userId === appSettings.user_id) return alert("Você não pode remover seu próprio acesso.");
        const { error } = await supabase.from('app_settings').update({ is_admin: isAdmin }).eq('user_id', userId);
        if (!error) {
            setUsers(users.map(u => u.user_id === userId ? { ...u, is_admin: isAdmin } : u));
        }
    };

    // --- Platform Settings ---
    const handleToggleSetting = async (key: string, currentValue: boolean) => {
        const { error } = await supabase.from('platform_settings').update({ value: !currentValue }).eq('key', key);
        if (!error) {
            setSettings(settings.map(s => s.key === key ? { ...s, value: !currentValue } : s));
        }
    };

    // --- Announcements ---
    const handleCreateAnnouncement = async () => {
        const { error } = await supabase.from('system_announcements').insert([newAnnouncement]);
        if (!error) {
            setIsAnnouncementModalOpen(false);
            setNewAnnouncement({ title: '', message: '', type: 'info' });
            fetchAdminData();
        }
    };

    const handleToggleAnnouncement = async (id: number, isActive: boolean) => {
        const { error } = await supabase.from('system_announcements').update({ is_active: !isActive }).eq('id', id);
        if (!error) {
            setAnnouncements(announcements.map(a => a.id === id ? { ...a, is_active: !isActive } : a));
        }
    };

    const handleDeleteAnnouncement = async (id: number) => {
        const { error } = await supabase.from('system_announcements').delete().eq('id', id);
        if (!error) {
            setAnnouncements(announcements.filter(a => a.id !== id));
        } else {
            console.error("Error deleting announcement:", error);
            alert("Erro ao excluir: " + error.message);
        }
    };

    // --- Support Tickets ---
    const handleReplyTicket = async () => {
        if(!replyingTicket) return;
        
        // 1. Update Ticket
        const { error } = await supabase.from('support_tickets').update({ 
            admin_response: adminReply,
            status: 'resolved',
            updated_at: new Date().toISOString()
        }).eq('id', replyingTicket.id);

        if(!error) {
            // 2. Create Personal Notification for User
            await supabase.from('system_announcements').insert([{
                title: 'Ticket Respondido',
                message: `Sua solicitação "${replyingTicket.title}" foi respondida pelo suporte.`,
                type: 'success',
                is_active: true,
                user_id: replyingTicket.user_id // targeted notification
            }]);

            // Update local state using functional update to ensure fresh state
            setTickets(prev => prev.map(t => t.id === replyingTicket.id ? { ...t, admin_response: adminReply, status: 'resolved' } : t));
            setReplyingTicket(null);
            setAdminReply('');
        } else {
            alert("Erro ao responder ticket: " + error.message);
        }
    };

    // Filtered Data
    const filteredUsers = users.filter(u => 
        u.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.user_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTickets = tickets.filter(t => {
        if (ticketFilter === 'all') return true;
        if (ticketFilter === 'open') return t.status === 'open' || t.status === 'in_progress';
        if (ticketFilter === 'resolved') return t.status === 'resolved' || t.status === 'closed';
        return true;
    });

    return (
        <div className="space-y-6 pb-20">
            <ViewHeader 
                title="Administração" 
                setIsSidebarOpen={setIsSidebarOpen}
                isPrivacyMode={isPrivacyMode}
                setIsPrivacyMode={setIsPrivacyMode}
                isAnimationsEnabled={isAnimationsEnabled}
                setIsAnimationsEnabled={setIsAnimationsEnabled}
            />

            {/* Admin Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={64}/></div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase">Total Usuários</h3>
                    <p className="text-3xl font-bold mt-1">{users.length || '-'}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64}/></div>
                    <h3 className="text-sm font-bold text-blue-200 uppercase">Avisos Ativos</h3>
                    <p className="text-3xl font-bold mt-1">{announcements.filter(a => a.is_active).length || '-'}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Sistema</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`w-3 h-3 rounded-full ${settings.find(s => s.key === 'maintenance_mode')?.value ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {settings.find(s => s.key === 'maintenance_mode')?.value ? 'Manutenção' : 'Operacional'}
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Tickets Abertos</h3>
                    <p className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-1 overflow-x-auto">
                <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    Gerenciar Usuários
                </button>
                <button onClick={() => setActiveTab('support')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'support' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    Suporte / Tickets
                </button>
                <button onClick={() => setActiveTab('platform')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'platform' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    Configurações da Plataforma
                </button>
                <button onClick={() => setActiveTab('broadcast')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'broadcast' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    Comunicados
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[400px]">
                {isLoading ? <LogoLoader /> : (
                    <>
                        {/* USERS TAB */}
                        {activeTab === 'users' && (
                            <div className="space-y-4">
                                <div className="relative max-w-md">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por nome ou email..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl"
                                    />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                                            <tr>
                                                <th className="px-6 py-3">Usuário</th>
                                                <th className="px-6 py-3">Plano</th>
                                                <th className="px-6 py-3">Admin</th>
                                                <th className="px-6 py-3">Cadastro</th>
                                                <th className="px-6 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.user_id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                        <div className="flex flex-col">
                                                            <span>{user.user_name}</span>
                                                            <span className="text-xs text-slate-400">{user.user_email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                                            user.plan === 'vip' ? 'bg-amber-100 text-amber-700' : 
                                                            user.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {user.plan || 'Free'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.is_admin ? <Shield size={16} className="text-green-500"/> : <span className="text-slate-300">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs">
                                                        {/* Assuming created_at exists on raw fetch but not in type strictly, safe fallback */}
                                                        {(user as any).created_at ? new Date((user as any).created_at).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => setEditingUser(user)} className="text-blue-500 hover:underline text-xs font-bold">Gerenciar</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SUPPORT TICKETS TAB */}
                        {activeTab === 'support' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800 dark:text-white">Tickets de Suporte</h3>
                                    <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                        <button onClick={() => setTicketFilter('all')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${ticketFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Todos</button>
                                        <button onClick={() => setTicketFilter('open')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${ticketFilter === 'open' ? 'bg-white dark:bg-slate-600 shadow-sm text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400'}`}>Abertos</button>
                                        <button onClick={() => setTicketFilter('resolved')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${ticketFilter === 'resolved' ? 'bg-white dark:bg-slate-600 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>Resolvidos</button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredTickets.map(ticket => (
                                        <div key={ticket.id} className="bg-white dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                        ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                                                        ticket.status === 'closed' ? 'bg-slate-100 text-slate-600' : 
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'closed' ? 'Fechado' : 'Aberto'}
                                                    </span>
                                                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">
                                                        {ticket.type.toUpperCase()}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-white">{ticket.title}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                    {ticket.user_name} ({ticket.user_email}) • {new Date(ticket.created_at).toLocaleDateString()}
                                                </p>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg mb-2">
                                                    {ticket.description}
                                                </p>
                                                {ticket.admin_response && (
                                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                                        <strong>Sua resposta:</strong> {ticket.admin_response}
                                                    </p>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => { setReplyingTicket(ticket); setAdminReply(ticket.admin_response || ''); }} 
                                                className="ml-4 p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                            >
                                                <MessageSquare size={18}/>
                                            </button>
                                        </div>
                                    ))}
                                    {filteredTickets.length === 0 && <p className="text-slate-500 text-center py-4">Nenhum ticket encontrado com este filtro.</p>}
                                </div>
                            </div>
                        )}

                        {/* PLATFORM TAB */}
                        {activeTab === 'platform' && (
                            <div className="space-y-6">
                                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Controle de Funcionalidades</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {settings.map(setting => (
                                        <div key={setting.key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white">{setting.description}</h4>
                                                <p className="text-xs text-slate-500 font-mono mt-1">{setting.key}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleSetting(setting.key, setting.value)}
                                                className={`p-2 rounded-full transition-colors ${setting.value ? 'text-green-500 bg-green-100 dark:bg-green-900/20' : 'text-slate-400 bg-slate-200 dark:bg-slate-600'}`}
                                            >
                                                {setting.value ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                            </button>
                                        </div>
                                    ))}
                                    {settings.length === 0 && <p className="text-slate-500">Nenhuma configuração encontrada no banco de dados.</p>}
                                </div>
                            </div>
                        )}

                        {/* BROADCAST TAB */}
                        {activeTab === 'broadcast' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 dark:text-white">Avisos do Sistema</h3>
                                    <button onClick={() => setIsAnnouncementModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                                        <Plus size={16}/> Novo Aviso
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    {announcements.map(ann => (
                                        <div key={ann.id} className={`p-4 rounded-xl border-l-4 shadow-sm bg-white dark:bg-slate-700/50 ${
                                            ann.type === 'critical' ? 'border-red-500' : 
                                            ann.type === 'warning' ? 'border-amber-500' : 
                                            ann.type === 'success' ? 'border-green-500' : 'border-blue-500'
                                        }`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-white">{ann.title}</h4>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{ann.message}</p>
                                                    <p className="text-xs text-slate-400 mt-2 flex gap-4">
                                                        <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                                        <span>• {ann.type.toUpperCase()}</span>
                                                        {ann.user_id && <span className="font-bold text-blue-500">• Privado</span>}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleToggleAnnouncement(ann.id, ann.is_active)} title={ann.is_active ? "Desativar" : "Ativar"} className={`p-2 rounded-lg ${ann.is_active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                                                        {ann.is_active ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                                                    </button>
                                                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={20}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {announcements.length === 0 && <p className="text-slate-500 text-center py-10">Nenhum aviso registrado.</p>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal Edit User */}
            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title={`Gerenciar: ${editingUser?.user_name}`}>
                {editingUser && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Plano de Assinatura</label>
                            <div className="flex gap-2">
                                {(['free', 'pro', 'vip'] as const).map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => handleUpdateUserPlan(editingUser.user_id, p)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${editingUser.plan === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                                    >
                                        {p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Permissões de Admin</label>
                            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900/50">
                                <div>
                                    <p className="text-sm font-bold text-red-700 dark:text-red-300">Acesso Administrativo</p>
                                    <p className="text-xs text-red-600/70">Cuidado: Isso dá controle total sobre a plataforma.</p>
                                </div>
                                <button 
                                    onClick={() => handleToggleAdmin(editingUser.user_id, !editingUser.is_admin)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold ${editingUser.is_admin ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border'}`}
                                >
                                    {editingUser.is_admin ? 'REVOGAR' : 'CONCEDER'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal New Announcement */}
            <Modal isOpen={isAnnouncementModalOpen} onClose={() => setIsAnnouncementModalOpen(false)} title="Novo Comunicado">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Título</label>
                        <input type="text" value={newAnnouncement.title} onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl" placeholder="Ex: Manutenção Programada"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Mensagem</label>
                        <textarea rows={4} value={newAnnouncement.message} onChange={e => setNewAnnouncement({...newAnnouncement, message: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl" placeholder="Detalhes do aviso..."/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Tipo de Alerta</label>
                        <div className="flex gap-2">
                            {['info', 'success', 'warning', 'critical'].map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setNewAnnouncement({...newAnnouncement, type: t as any})}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase ${
                                        newAnnouncement.type === t 
                                        ? (t === 'critical' ? 'bg-red-500 text-white' : t === 'warning' ? 'bg-amber-500 text-white' : t === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white')
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleCreateAnnouncement} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 mt-4">
                        Publicar Aviso
                    </button>
                </div>
            </Modal>

            {/* Modal Reply Ticket */}
            <Modal isOpen={!!replyingTicket} onClose={() => setReplyingTicket(null)} title="Responder Ticket">
                <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-sm">
                        <p className="font-bold text-slate-700 dark:text-white mb-2">{replyingTicket?.title}</p>
                        <p className="text-slate-600 dark:text-slate-400">{replyingTicket?.description}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Sua Resposta</label>
                        <textarea rows={4} value={adminReply} onChange={e => setAdminReply(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl" placeholder="Escreva a solução..."/>
                    </div>
                    <button onClick={handleReplyTicket} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 mt-4">
                        Enviar e Marcar como Resolvido
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Admin;
