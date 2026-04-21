
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemAnnouncement } from '../../types';
import { Bell, Check, Info, AlertTriangle, CheckCircle, Megaphone, X } from 'lucide-react';

const NotificationBell: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      // The RLS policy handles filtering for global (user_id is null) vs personal (user_id = auth.uid())
      // We just need to fetch active ones.
      const { data } = await supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data) {
        setAnnouncements(data);
        // Calculate unread
        const count = data.filter(a => !localStorage.getItem(`arkaan_seen_announcement_${a.id}`)).length;
        setUnreadCount(count);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh occasionally or listen to changes could be implemented here
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const markAsRead = (id: number) => {
    localStorage.setItem(`arkaan_seen_announcement_${id}`, 'true');
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle size={16} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      default: return <Megaphone size={16} className="text-blue-500" />;
    }
  };

  const getBgColor = (type: string) => {
      switch (type) {
        case 'critical': return 'bg-red-50 dark:bg-red-900/20';
        case 'warning': return 'bg-amber-50 dark:bg-amber-900/20';
        case 'success': return 'bg-green-50 dark:bg-green-900/20';
        default: return 'bg-blue-50 dark:bg-blue-900/20';
      }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Notificações</h3>
            {unreadCount > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{unreadCount} novas</span>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {announcements.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <p className="text-xs">Nenhuma notificação no momento.</p>
                </div>
            ) : (
                announcements.map(ann => {
                    const isRead = !!localStorage.getItem(`arkaan_seen_announcement_${ann.id}`);
                    return (
                        <div 
                            key={ann.id} 
                            onClick={() => markAsRead(ann.id)}
                            className={`p-3 rounded-xl transition-colors cursor-default ${isRead ? 'bg-white dark:bg-slate-900 opacity-60 hover:opacity-100' : 'bg-slate-50 dark:bg-slate-800'}`}
                        >
                            <div className="flex gap-3 items-start">
                                <div className={`p-2 rounded-full flex-shrink-0 ${getBgColor(ann.type)}`}>
                                    {getIcon(ann.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-sm font-bold ${isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>{ann.title}</h4>
                                        {!isRead && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{ann.message}</p>
                                    <p className="text-[10px] text-slate-400 mt-2 flex justify-between">
                                        <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                        {ann.user_id && <span className="text-blue-500 font-medium">Pessoal</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
