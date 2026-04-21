import React from 'react';
import { Sparkles } from 'lucide-react';

interface ChatFabProps {
  onClick: () => void;
}

const ChatFab: React.FC<ChatFabProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:from-blue-600 hover:to-indigo-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 z-40"
      aria-label="Open AI Assistant"
    >
      <Sparkles size={28} />
    </button>
  );
};

export default ChatFab;