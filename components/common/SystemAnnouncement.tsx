
import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemAnnouncement } from '../../types';
import { X, Megaphone, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const SystemAnnouncementModal: React.FC = () => {
    const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchAnnouncement = async () => {
            try {
                // Fetch recent active announcements (Global OR Personal due to RLS)
                // We fetch a few to find one that hasn't been seen yet.
                const { data, error } = await supabase
                    .from('system_announcements')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (data && !error && data.length > 0) {
                    // Find the first one NOT in local storage
                    const unseenAnnouncement = data.find(ann => {
                        const seenKey = `arkaan_seen_announcement_${ann.id}`;
                        return !localStorage.getItem(seenKey);
                    });

                    if (unseenAnnouncement) {
                        setAnnouncement(unseenAnnouncement);
                        setIsVisible(true);
                    }
                }
            } catch (err) {
                console.error("Error checking announcements", err);
            }
        };

        fetchAnnouncement();
    }, []);

    const handleClose = () => {
        if (announcement) {
            localStorage.setItem(`arkaan_seen_announcement_${announcement.id}`, 'true');
        }
        setIsVisible(false);
    };

    if (!isVisible || !announcement) return null;

    const getIcon = () => {
        switch (announcement.type) {
            case 'critical': return <AlertTriangle size={28} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={28} className="text-amber-500" />;
            case 'success': return <CheckCircle size={28} className="text-green-500" />;
            default: return <Megaphone size={28} className="text-blue-500" />;
        }
    };

    const getStyles = () => {
        switch (announcement.type) {
            case 'critical': return { bg: 'bg-red-50 dark:bg-red-900/20', accent: 'bg-red-500' };
            case 'warning': return { bg: 'bg-amber-50 dark:bg-amber-900/20', accent: 'bg-amber-500' };
            case 'success': return { bg: 'bg-green-50 dark:bg-green-900/20', accent: 'bg-green-500' };
            default: return { bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'bg-blue-500' };
        }
    };

    const styles = getStyles();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-blur-in-up relative">
                {/* Decorative Top Line */}
                <div className={`h-1.5 w-full ${styles.accent}`}></div>
                
                <button 
                    onClick={handleClose} 
                    className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center">
                        <div className={`p-4 rounded-2xl mb-5 ${styles.bg}`}>
                            {getIcon()}
                        </div>
                        
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                            {announcement.title}
                        </h3>
                        
                        <div className="w-10 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mb-4"></div>

                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                            {announcement.message}
                        </p>
                    </div>
                </div>

                <div className="p-6 pt-0 flex justify-center">
                    <button 
                        onClick={handleClose}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemAnnouncementModal;
