import React from 'react';

interface LogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const LogoLoader: React.FC<LogoLoaderProps> = ({ 
  size = 'lg', 
  text, 
  fullScreen = true,
  className = ''
}) => {
  // Size mappings
  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-5 h-5'
  }[size];

  const containerClasses = fullScreen 
    ? "fixed inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-50" 
    : `flex items-center justify-center gap-2 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center gap-1.5">
        {/* Dot 1 - Darker Blue */}
        <div className={`${dotSize} rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]`}></div>
        
        {/* Dot 2 - Medium Blue */}
        <div className={`${dotSize} rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]`}></div>
        
        {/* Dot 3 - Lighter Blue (Optional for balance in animation, creates a wave) */}
        <div className={`${dotSize} rounded-full bg-blue-300/80 animate-bounce`}></div>
      </div>
      
      {text && (
        <p className={`mt-4 font-medium text-slate-600 dark:text-slate-300 animate-pulse ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default LogoLoader;