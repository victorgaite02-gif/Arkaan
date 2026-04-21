
import React from 'react';
import { Menu } from 'lucide-react';
import MonthNavigator from './MonthNavigator';
import PrivacyToggle from './PrivacyToggle';
import ViewFilter from './ViewFilter';
import NotificationBell from './NotificationBell';
import { ViewFilterType } from '../../types';

interface ViewHeaderProps {
  title: string;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
  children?: React.ReactNode;
  isPrivacyMode?: boolean;
  setIsPrivacyMode?: (isPrivate: boolean) => void;
  isAnimationsEnabled?: boolean;
  setIsAnimationsEnabled?: (enabled: boolean) => void;
  viewFilter?: ViewFilterType;
  setViewFilter?: (filter: ViewFilterType) => void;
  isMobile?: boolean;
}

const ViewHeader: React.FC<ViewHeaderProps> = ({ 
  title, setIsSidebarOpen, selectedDate, setSelectedDate, children,
  isPrivacyMode, setIsPrivacyMode,
  viewFilter, setViewFilter
}) => {
  return (
    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 relative z-30">
      <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
        <div className="flex items-center gap-3">
            <button className="md:hidden text-slate-500 dark:text-slate-400 p-2 -ml-2" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{title}</h1>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
        
        {/* Filters and Navigation - Scrollable Container */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar flex-1 sm:flex-none">
            {viewFilter && setViewFilter && (
                <ViewFilter viewFilter={viewFilter} setViewFilter={setViewFilter} />
            )}
            {selectedDate && setSelectedDate && (
            <MonthNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            )}
        </div>
        
        {/* Actions - Fixed Container (No Overflow) to allow Dropdowns to pop out */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
            {/* Notification Bell */}
            <NotificationBell />
            
            {typeof isPrivacyMode !== 'undefined' && setIsPrivacyMode && (
            <PrivacyToggle isPrivate={isPrivacyMode} setIsPrivate={setIsPrivacyMode} />
            )}
        </div>
        
        {children && (
            <div className="flex-shrink-0">
                {children}
            </div>
        )}
      </div>
    </div>
  );
};

export default ViewHeader;
