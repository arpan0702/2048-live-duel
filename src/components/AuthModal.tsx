import React, { useState } from 'react';
import { User, Lock, LogIn, UserPlus, AlertCircle, X, Sparkles } from 'lucide-react';
import { identity } from '../services/identity';
import type { UserProfile } from '../types/game';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (profile: UserProfile) => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [tab, setTab] = useState<'login' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'signup') {
        const res = await identity.signUp(username, password);
        if (res.success && res.profile) {
          onSuccess(res.profile);
          if (onClose) onClose();
        } else {
          setError(res.error || 'Failed to create account.');
        }
      } else {
        const res = await identity.login(username, password);
        if (res.success && res.profile) {
          onSuccess(res.profile);
          if (onClose) onClose();
        } else {
          setError(res.error || 'Failed to log in.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-stone-900 border-2 border-stone-800 rounded-3xl p-6 shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">
            {tab === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            {tab === 'signup'
              ? 'Save your high scores & claim your spot in the Hall of Fame'
              : 'Sign in to access your persistent stats and duels'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] font-mono uppercase text-stone-400 block mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. MatrixMaster"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={16}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-stone-400 block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 mt-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
          >
            {tab === 'signup' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Creating Account...' : 'Sign Up'}</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Logging In...' : 'Log In'}</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-stone-500 text-center mt-4 font-mono">
          Auto-login enabled: your session will persist on this browser!
        </p>
      </div>
    </div>
  );
};
