
import React from 'react';
import { Film, Pause } from 'lucide-react';

interface AnimationToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const AnimationToggle: React.FC<AnimationToggleProps> = ({ isEnabled, onToggle }) => {
  return (
    <button
      onClick={() => onToggle(!isEnabled)}
      className={`p-2 rounded-lg transition-colors ${isEnabled ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}
      aria-label={isEnabled ? "Desativar animações" : "Ativar animações"}
      title={isEnabled ? "Animações Ativadas" : "Animações Desativadas"}
    >
      {isEnabled ? <Film size={20} /> : <Pause size={20} />}
    </button>
  );
};

export default AnimationToggle;
