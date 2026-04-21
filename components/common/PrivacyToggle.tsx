import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PrivacyToggleProps {
  isPrivate: boolean;
  setIsPrivate: (isPrivate: boolean) => void;
}

const PrivacyToggle: React.FC<PrivacyToggleProps> = ({ isPrivate, setIsPrivate }) => {
  return (
    <button
      onClick={() => setIsPrivate(!isPrivate)}
      className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      aria-label={isPrivate ? "Mostrar valores" : "Ocultar valores"}
    >
      {isPrivate ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
};

export default PrivacyToggle;
