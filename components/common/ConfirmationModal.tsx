
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-center p-4" 
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 p-2 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{title}</h3>
            <div className="text-sm text-slate-500 dark:text-slate-400">
                {children}
            </div>
        </div>
        <div className="flex justify-center items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-700 rounded-b-lg">
            <button 
                onClick={onClose} 
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:border-slate-600 rounded-md"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
                Sim, excluir
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
