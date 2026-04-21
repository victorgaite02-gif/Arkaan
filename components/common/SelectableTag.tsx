
import React from 'react';

interface SelectableTagProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ElementType;
  colorClass?: string; // 'blue', 'green', 'red', 'orange', 'purple', etc.
}

const SelectableTag: React.FC<SelectableTagProps> = ({ 
  label, 
  selected, 
  onClick, 
  icon: Icon, 
  colorClass = 'blue' 
}) => {
  // Map color names to Tailwind classes dynamically-ish (Tailwind needs full class names to purge correctly, 
  // but for common colors we can map them or use a safe list. Here we use a switch for safety)
  
  const getColorClasses = () => {
      if (!selected) return 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700';
      
      switch(colorClass) {
          case 'green': return 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200 dark:shadow-none';
          case 'red': return 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-200 dark:shadow-none';
          case 'orange': return 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200 dark:shadow-none';
          case 'purple': return 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200 dark:shadow-none';
          case 'slate': return 'bg-slate-600 text-white border-slate-600 shadow-sm';
          case 'blue': 
          default: return 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 dark:shadow-none';
      }
  };

  return (
    <button 
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${getColorClasses()} ${selected ? 'scale-105' : ''}`}
    >
        {Icon && <Icon size={14} className={selected ? 'text-white' : 'text-slate-400'} />}
        {label}
    </button>
  );
};

export default SelectableTag;
