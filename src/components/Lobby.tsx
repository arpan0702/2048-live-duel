import React, { useState } from 'react';
import { Swords, Zap, Clock, Trophy, Copy, Check, ExternalLink, Play, User, Edit3, ShieldAlert, Share2 } from 'lucide-react';
import type { GameMode, RoomState, UserProfile } from '../types/game';
import { formatScore, formatTileValue, getTileVisual } from '../engine/gameEngine';

interface LobbyProps {
  userProfile: UserProfile | null;
  onUpdateUsername: (newUsername: string) => Promise<{ success: boolean; error?: string }>;
  onCreateRoom: (mode: GameMode) => Promise<RoomState>;
  onJoinRoom: (roomCode: string) => Promise<RoomState>;
  onStartSolo: () => void;
  onOpenLeaderboard: () => void;
  waitingRoom: RoomState | null;
  onCancelWaiting: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  userProfile,
  onUpdateUsername,
  onCreateRoom,
  onJoinRoom,
  onStartSolo,
  onOpenLeaderboard,
  waitingRoom,
  onCancelWaiting,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('sudden_death');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Username editing state
  const [isEditingUsername, setIsEditingUsername] = useState(!userProfile);
  const [usernameInput, setUsernameInput] = useState(userProfile?.username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    const res = await onUpdateUsername(usernameInput);
    if (res.success) {
      setIsEditingUsername(false);
    } else {
      setUsernameError(res.error || 'Failed to save username.');
    }
  };

  const handleCreate = async () => {
    if (!userProfile) {
      setIsEditingUsername(true);
      return;
    }
    setErrorMsg(null);
    setIsCreating(true);
    try {
      await onCreateRoom(selectedMode);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      setIsEditingUsername(true);
      return;
    }
    const clean = joinCodeInput.trim().toUpperCase().replace('#', '');
    if (!clean || clean.length < 4) {
      setErrorMsg('Please enter a valid 6-character room code.');
      return;
    }
    setErrorMsg(null);
    setIsJoining(true);
    try {
      await onJoinRoom(clean);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to join room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (!waitingRoom) return;
    navigator.clipboard.writeText(waitingRoom.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!waitingRoom) return;
    const url = `${window.location.origin}${window.location.pathname}?join=${waitingRoom.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenPlayer2Window = () => {
    if (!waitingRoom) return;
    const url = `${window.location.origin}${window.location.pathname}?join=${waitingRoom.roomCode}`;
    window.open(url, '_blank', 'width=450,height=800');
  };

  // Waiting Room Screen
  if (waitingRoom) {
    return (
      <div className="w-full max-w-md mx-auto p-4 animate-fade-in select-none">
        <div className="bg-stone-900 border-2 border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 mx-auto flex items-center justify-center mb-4 animate-pulse">
            <Swords className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-white tracking-wide uppercase">Match Room Created</h2>
          <p className="text-xs text-stone-400 mt-1">Share this room code with an opponent to start</p>

          <div className="bg-stone-950/90 border-2 border-dashed border-stone-700 rounded-2xl p-5 my-6 flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-stone-400 uppercase tracking-widest">ROOM CODE</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl font-mono font-black text-amber-400 tracking-wider">
                #{waitingRoom.roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <span className="text-xs text-amber-300 font-medium">
              Mode: {waitingRoom.mode === 'sudden_death' ? '⚡ Sudden Death' : waitingRoom.mode === 'blitz_3m' ? '⏱️ Blitz (3 Min)' : '⏱️ Blitz (5 Min)'}
            </span>

            {/* Direct Invite Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Direct Link Copied!' : 'Copy Invite Link (Share to Phone/Friend)'}</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-mono text-stone-400 mb-6 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Waiting for Player 2 to join...</span>
          </div>

          {/* Local testing helper button */}
          <div className="mb-4">
            <button
              onClick={handleOpenPlayer2Window}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>⚡ Test Locally: Open Player 2 Window</span>
            </button>
            <p className="text-[10px] text-stone-500 mt-1.5 font-mono">
              Opens a popup window to duel live in split-screen on your computer!
            </p>
          </div>

          <button
            onClick={onCancelWaiting}
            className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel & Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  const userTileBig = BigInt(userProfile?.highestTileAchieved || '2');
  const userTileVisual = getTileVisual(userTileBig);

  return (
    <div className="w-full max-w-md mx-auto p-3 sm:p-4 animate-fade-in select-none">
      {/* User Profile Bar */}
      <div className="bg-stone-900/95 border border-stone-800 rounded-2xl p-4 mb-4 shadow-xl">
        {isEditingUsername || !userProfile ? (
          <form onSubmit={handleSaveUsername} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Choose Your Username
              </span>
              {userProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditingUsername(false)}
                  className="text-xs text-stone-500 hover:text-stone-300"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. MatrixMaster"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                maxLength={16}
                required
                className="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder:text-stone-600 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
            {usernameError && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{usernameError}</span>
              </p>
            )}
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-stone-100 text-base">{userProfile.username}</span>
                  <button
                    onClick={() => {
                      setUsernameInput(userProfile.username);
                      setIsEditingUsername(true);
                    }}
                    className="text-stone-500 hover:text-amber-400 transition-colors p-1"
                    title="Change Username"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-stone-400 font-mono">
                  All-Time Best: <span className="text-amber-400 font-bold">{formatScore(userProfile.allTimeHighScore)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] text-stone-500 font-mono uppercase">Max Tile</span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shadow-sm ${userTileVisual.bg} ${userTileVisual.text}`}>
                {formatTileValue(userTileBig)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Global Hall of Fame Button */}
      <div className="mb-4">
        <button
          onClick={onOpenLeaderboard}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>View Hall of Fame Leaderboard</span>
        </button>
      </div>

      {/* Main Duel Section */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-2xl space-y-5">
        <div>
          <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            <span>2048 Live Duel</span>
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Endless 4x4 realtime multiplayer • No 2048 win cutoff
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mode Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 block mb-2">
            Select Duel Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMode('sudden_death')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedMode === 'sudden_death'
                  ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                <Zap className="w-3.5 h-3.5" />
                <span>Sudden Death</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                Lockout triggers 60s countdown
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('blitz_3m')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedMode === 'blitz_3m'
                  ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-1 text-cyan-400 font-bold text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Blitz 3 Min</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                High score at 3:00 wins
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('blitz_5m')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                selectedMode === 'blitz_5m'
                  ? 'bg-purple-500/20 border-purple-500 text-white shadow-md'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-1 text-purple-400 font-bold text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Blitz 5 Min</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 leading-tight">
                High score at 5:00 wins
              </span>
            </button>
          </div>
        </div>

        {/* Create Match Button */}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          <span>{isCreating ? 'Generating Room...' : 'Create Match Room'}</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-stone-800 w-full" />
          <span className="bg-stone-900 px-3 text-[11px] font-mono text-stone-500 uppercase tracking-widest">
            OR JOIN EXISTING
          </span>
        </div>

        {/* Join Room Form */}
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            placeholder="Room Code (e.g. DUEL42)"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
            maxLength={7}
            className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-stone-600 focus:outline-none focus:border-amber-400 uppercase tracking-wider"
          />
          <button
            type="submit"
            disabled={isJoining}
            className="bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            {isJoining ? 'Connecting...' : 'Join Duel'}
          </button>
        </form>

        {isJoining && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-400 animate-pulse bg-amber-950/40 border border-amber-800/40 p-2.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Finding room #{joinCodeInput.trim().toUpperCase().replace('#', '')} across live network...</span>
          </div>
        )}

        {/* Solo Practice Button */}
        <div className="pt-2 border-t border-stone-800/80">
          <button
            onClick={onStartSolo}
            className="w-full py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/60 border border-stone-800 text-stone-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            <span>Practice Solo Endless Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
