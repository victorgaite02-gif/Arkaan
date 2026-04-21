import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatToUTCDateString } from '../../utils/dateUtils';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Always interpret the value string as UTC
  const selectedDate = value ? new Date(`${value}T00:00:00Z`) : new Date(new Date().setUTCHours(0,0,0,0));
  const [viewDate, setViewDate] = useState(selectedDate);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pickerRef]);
  
  const daysInMonth = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstDayOfMonth = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1)).getUTCDay();
  const calendarDays = Array.from({ length: firstDayOfMonth }, () => null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  
  const handleDateSelect = (day: number) => {
    const newDate = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day));
    onChange(formatToUTCDateString(newDate));
    setIsOpen(false);
  };

  const changeMonth = (amount: number) => {
    setViewDate(prev => {
        const newDate = new Date(prev);
        newDate.setUTCMonth(prev.getUTCMonth() + amount);
        return newDate;
    });
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-left flex justify-between items-center"
      >
        <span>{selectedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-days text-slate-400"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
      </button>
      {isOpen && (
        <div ref={pickerRef} className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg shadow-lg p-4 z-20">
          <div className="flex justify-between items-center mb-2">
            <button type="button" onClick={() => changeMonth(-1)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronLeft size={20} /></button>
            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{months[viewDate.getUTCMonth()]} {viewDate.getUTCFullYear()}</span>
            <button type="button" onClick={() => changeMonth(1)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <div key={`${day}-${i}`}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => (
              <div key={index} className="flex justify-center items-center">
                {day ? (
                  <button
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors ${
                      day === selectedDate.getUTCDate() && viewDate.getUTCMonth() === selectedDate.getUTCMonth() && viewDate.getUTCFullYear() === selectedDate.getUTCFullYear()
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-blue-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                ) : <div />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;