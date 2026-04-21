import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthNavigatorProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MonthNavigator: React.FC<MonthNavigatorProps> = ({ selectedDate, setSelectedDate }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedDate.getUTCFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPickerYear(selectedDate.getUTCFullYear());
  }, [selectedDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pickerRef]);


  const handlePrevMonth = () => {
    const newDate = new Date(selectedDate.getTime());
    newDate.setUTCMonth(newDate.getUTCMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDate.getTime());
    newDate.setUTCMonth(newDate.getUTCMonth() + 1);
    setSelectedDate(newDate);
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(Date.UTC(pickerYear, monthIndex, 1));
    setSelectedDate(newDate);
    setIsPickerOpen(false);
  };
  
  const formattedDate = selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="relative flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
      <button onClick={handlePrevMonth} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors" aria-label="Mês anterior">
        <ChevronLeft size={20} />
      </button>
      <button onClick={() => setIsPickerOpen(!isPickerOpen)} className="font-semibold text-sm text-slate-700 dark:text-slate-300 w-40 text-center capitalize hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md py-1.5 transition-colors whitespace-nowrap">
        {formattedDate}
      </button>
      <button onClick={handleNextMonth} className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors" aria-label="Próximo mês">
        <ChevronRight size={20} />
      </button>

      {isPickerOpen && (
        <div ref={pickerRef} className="absolute top-full mt-2 w-64 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-lg p-4 z-10 left-1/2 -translate-x-1/2">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setPickerYear(y => y - 1)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronLeft size={20} /></button>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{pickerYear}</span>
            <button onClick={() => setPickerYear(y => y + 1)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {months.map((month, index) => (
              <button
                key={month}
                onClick={() => handleMonthSelect(index)}
                className={`p-2 text-sm rounded-md hover:bg-blue-500 hover:text-white ${selectedDate.getUTCMonth() === index && selectedDate.getUTCFullYear() === pickerYear ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthNavigator;