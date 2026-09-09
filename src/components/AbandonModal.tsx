import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AbandonModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AbandonModal: React.FC<AbandonModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl animate-scale-in text-center">
        <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-black text-stone-100 mb-2">Abandon Match?</h3>
        <p className="text-sm text-stone-400 mb-6 leading-relaxed">
          Leaving this match will automatically forfeit the duel to your opponent. Are you sure you want to quit?
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            Keep Playing
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-900/40 transition-colors cursor-pointer"
          >
            Abandon Match
          </button>
        </div>
      </div>
    </div>
  );
};
