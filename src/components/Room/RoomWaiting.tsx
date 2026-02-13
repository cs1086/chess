
import React from 'react';
import type { Room, UserProfile, ChatMessage } from '../../types';
import { GAME_CONFIGS } from '../../utils/gameConfig';
import { RoomChat } from './RoomChat';
import { Crown, User, AlertCircle, LogOut, Play, Eye } from 'lucide-react';

interface RoomWaitingProps {
    room: Room;
    currentUser: UserProfile;
    messages: ChatMessage[];
    onLeave: () => void;
    onStartGame: () => void;
    onKickUser: (userId: string) => void;
    onSendMessage: (content: string) => void;
    onToggleReady: () => void;
}

export const RoomWaiting: React.FC<RoomWaitingProps> = ({
    room, currentUser, messages, onLeave, onStartGame, onKickUser, onSendMessage, onToggleReady
}) => {
    const isHost = room.hostId === currentUser.id;
    const config = GAME_CONFIGS[room.gameType];
    const players = Array.isArray(room.players) ? room.players : [];
    const spectators = Array.isArray(room.spectators) ? room.spectators : [];

    // Check if start conditions are met
    const hasMinPlayers = players.length >= room.minPlayers || (room.fillWithBots && players.length >= 1);
    const allPlayersReady = players.every(p => p.id === room.hostId || p.isReady);
    const canStart = isHost && hasMinPlayers && allPlayersReady;
    const currentPlayerInRoom = players.find(p => p.id === currentUser.id);
    const isCurrentUserReady = currentPlayerInRoom?.isReady ?? false;

    return (
        <div className="min-h-screen bg-[#f8f1e7] p-4 md:p-8 font-sans flex flex-col items-center">
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-4rem)]">

                {/* Left Column: Room Info & Players */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                    {/* Header Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#e8d5c4]">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-[#5c3a1e] flex items-center gap-2">
                                    {room.name || `房間 #${room.id}`}
                                    <span className="text-sm bg-[#f0e4d4] px-2 py-1 rounded text-[#8b5a2b] font-normal">
                                        {config.name}
                                    </span>
                                </h2>
                                <p className="text-[#8b5a2b] mt-1 text-sm">
                                    房主: {players.find(p => p.id === room.hostId)?.name || '未知'}
                                </p>
                            </div>
                            <button
                                onClick={onLeave}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-bold"
                            >
                                <LogOut size={16} />
                                離開房間
                            </button>
                        </div>
                    </div>

                    {/* Players Grid */}
                    <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-[#e8d5c4] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-[#5c3a1e] flex items-center gap-2">
                                <User size={20} />
                                玩家列表 ({players.length}/{room.maxPlayers})
                            </h3>
                            <div className="flex flex-col items-end gap-1">
                                {players.length < room.minPlayers && !room.fillWithBots && (
                                    <span className="text-amber-600 text-sm flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                        <AlertCircle size={14} />
                                        還差 {room.minPlayers - players.length} 人才能開始
                                    </span>
                                )}
                                {players.length < room.maxPlayers && room.fillWithBots && (
                                    <span className="text-blue-600 text-sm flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full">
                                        <AlertCircle size={14} />
                                        將由 {room.maxPlayers - players.length} 個電腦補位
                                    </span>
                                )}
                                {!allPlayersReady && hasMinPlayers && (
                                    <span className="text-amber-600 text-sm flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                        <AlertCircle size={14} />
                                        等待玩家準備中...
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Render Slots based on Max Players */}
                            {Array.from({ length: room.maxPlayers }).map((_, i) => {
                                const player = players[i];
                                return (
                                    <div key={i} className={`
                                        relative group p-4 rounded-xl border-2 flex items-center gap-4 transition-all
                                        ${player
                                            ? (player.isReady || player.id === room.hostId ? 'border-green-500 bg-green-50' : 'border-[#8b5a2b] bg-[#fffaf5]')
                                            : 'border-dashed border-[#dcc0a3] bg-[#fdfdfd]'}
                                    `}>
                                        {player ? (
                                            <>
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-[#dcc0a3] flex items-center justify-center text-xl font-bold text-[#5c3a1e]">
                                                        {player.name[0].toUpperCase()}
                                                    </div>
                                                    {player.id === room.hostId && (
                                                        <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow">
                                                            <Crown size={14} className="text-yellow-500 fill-yellow-500" />
                                                        </div>
                                                    )}
                                                    {player.id !== room.hostId && player.isReady && (
                                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 shadow border-2 border-white">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-[#5c3a1e] truncate">
                                                            {player.name}
                                                        </p>
                                                        {player.id !== room.hostId && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${player.isReady ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                {player.isReady ? '已準備' : '未準備'}
                                                            </span>
                                                        )}
                                                        {player.id === room.hostId && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                                                                房主
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-[#8b5a2b]">戰績: {player.wins} 勝 / {player.losses} 敗</p>
                                                </div>
                                                {isHost && player.id !== currentUser.id && (
                                                    <button
                                                        onClick={() => onKickUser(player.id)}
                                                        className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs hover:bg-red-200 transition"
                                                    >
                                                        踢出
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex-1 text-center text-[#dcc0a3] font-medium">
                                                等待加入...
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Start Game / Ready Action Area */}
                        <div className="mt-8 pt-6 border-t border-[#e8d5c4] flex justify-end">
                            {isHost ? (
                                <button
                                    onClick={onStartGame}
                                    disabled={!canStart}
                                    className={`
                                        flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95
                                        ${canStart
                                            ? 'bg-gradient-to-r from-[#8b5a2b] to-[#6d4621] text-white hover:brightness-110'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                                    `}
                                >
                                    <Play size={24} fill="currentColor" />
                                    開始遊戲
                                </button>
                            ) : (
                                <button
                                    onClick={onToggleReady}
                                    className={`
                                        flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95
                                        ${isCurrentUserReady
                                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                            : 'bg-green-500 text-white hover:bg-green-600'}
                                    `}
                                >
                                    {isCurrentUserReady ? '取消準備' : '準備'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Chat & Spectators */}
                <div className="flex flex-col gap-6 h-full">
                    {/* Spectators */}
                    {room.allowSpectators && (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#e8d5c4] max-h-48 overflow-y-auto">
                            <h3 className="text-sm font-bold text-[#8b5a2b] mb-3 flex items-center gap-2">
                                <Eye size={16} />
                                觀戰者 ({spectators.length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {spectators.length === 0 && <span className="text-xs text-gray-400">無觀戰者</span>}
                                {spectators.map(s => (
                                    <span key={s.id} className="inline-flex items-center px-2 py-1 bg-[#f3f4f6] rounded text-xs text-[#374151]">
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chat */}
                    <div className="flex-1 min-h-0">
                        <RoomChat
                            messages={messages}
                            currentUser={currentUser}
                            onSendMessage={onSendMessage}
                            className="h-full"
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};
