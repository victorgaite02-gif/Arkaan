
import React from 'react';
import { ViewFilterType } from '../../types';

interface ViewFilterProps {
  viewFilter: ViewFilterType;
  setViewFilter: (filter: ViewFilterType) => void;
}

const ViewFilter: React.FC<ViewFilterProps> = ({ viewFilter, setViewFilter }) => {
  const baseClasses = 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors';
  const activeClasses = 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-sm';
  const inactiveClasses = 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700';

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
      <button
        onClick={() => setViewFilter('all')}
        className={`${baseClasses} ${viewFilter === 'all' ? activeClasses : inactiveClasses}`}
      >
        Todos
      </button>
      <button
        onClick={() => setViewFilter('own')}
        className={`${baseClasses} ${viewFilter === 'own' ? activeClasses : inactiveClasses}`}
      >
        Apenas Meus
      </button>
    </div>
  );
};

export default ViewFilter;
