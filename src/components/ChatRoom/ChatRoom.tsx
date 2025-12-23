import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile, ChatMessage, Challenge } from '../../types';
import { Send, User, Swords, Shield, X, Eye } from 'lucide-react';

interface ChatRoomProps {
    currentUser: UserProfile;
    onlinePlayers: UserProfile[];
    messages: ChatMessage[];
    onSendMessage: (content: string, to?: string) => void;
    onSendChallenge: (toId: string) => void;
    onJoinSpectate: (gameId: string) => void;
    onLeave: () => void;
    receivedChallenge?: Challenge;
    onAcceptChallenge: (challenge: Challenge) => void;
    onRejectChallenge: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
    currentUser,
    onlinePlayers,
    messages,
    onSendMessage,
    onSendChallenge,
    onJoinSpectate,
    onLeave,
    receivedChallenge,
    onAcceptChallenge,
    onRejectChallenge,
}) => {
    const [inputText, setInputText] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState<UserProfile | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText, selectedPlayer?.id);
        setInputText('');
    };

    return (
        <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar / Topbar - Players */}
            <div className="w-full md:w-80 bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col shrink-0">
                {/* Current User Info - Hidden or condensed on mobile to save space */}
                <div className="hidden md:block p-4 bg-gradient-to-r from-red-900/30 to-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                            {currentUser.name && currentUser.name.length > 0 ? currentUser.name[0].toUpperCase() : '?'}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg">{currentUser.name || currentUser.id}</span>
                            <span className="text-xs text-gray-400">ID: {currentUser.id}</span>
                        </div>
                    </div>
                </div>

                <div className="p-3 md:p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 backdrop-blur-md">
                    <h3 className="font-bold flex items-center gap-2 text-sm md:text-base">
                        <User size={18} />
                        在線玩家 ({onlinePlayers.length})
                    </h3>
                    <button onClick={onLeave} className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Player List: Horizontal on mobile, Vertical on desktop */}
                <div className="flex-1 overflow-x-auto md:overflow-y-auto flex md:flex-col p-2 md:p-0 gap-2 md:gap-0 min-h-[100px] md:min-h-0 items-center md:items-stretch">
                    {onlinePlayers.map(player => (
                        <div
                            key={player.id}
                            onClick={() => player.id !== currentUser.id && setSelectedPlayer(player)}
                            className={`
                                shrink-0 p-3 md:p-4 flex flex-col md:flex-row items-center md:justify-between cursor-pointer transition-all border border-gray-700/50 md:border-0 md:border-b md:border-gray-700/50 rounded-xl md:rounded-none
                                ${player.id === currentUser.id ? 'bg-gray-700/30 opacity-80 cursor-default' : 'hover:bg-gray-700/50'}
                                ${selectedPlayer?.id === player.id ? 'bg-blue-600/20 ring-2 ring-blue-500 md:ring-0 md:border-l-4 md:border-l-blue-500' : ''}
                                min-w-[100px] md:min-w-0
                            `}
                        >
                            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 text-center md:text-left">
                                <div className={`relative w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold shadow-inner ${player.id === currentUser.id ? 'bg-gray-600' : 'bg-red-600'}`}>
                                    {player.name && player.name.length > 0 ? player.name[0].toUpperCase() : '?'}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                                </div>
                                <div className="flex flex-col overflow-hidden max-w-[80px] md:max-w-none">
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-xs md:text-sm truncate">{player.name || player.id}{player.id === currentUser.id ? '(你)' : ''}</span>
                                        {player.activeGameId && (
                                            <span className="text-[9px] bg-red-900/40 text-red-400 px-1 rounded border border-red-500/20 shrink-0">對戰中</span>
                                        )}
                                    </div>
                                    <span className="hidden md:block text-[10px] text-gray-500 truncate">ID: {player.id}</span>
                                    <span className="text-[10px] text-gray-500">勝率: {player.wins + player.losses > 0 ? Math.round((player.wins / (player.wins + player.losses)) * 100) : 0}%</span>
                                </div>
                            </div>

                            {/* Challenge Button - Desktop only, or show on selective click for mobile */}
                            <div className="hidden md:block">
                                {player.id !== currentUser.id && (
                                    <div className="flex gap-2">
                                        {player.activeGameId ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onJoinSpectate(player.activeGameId!);
                                                }}
                                                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-all transform active:scale-95 shadow-md shadow-blue-900/20"
                                                title="觀戰"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSendChallenge(player.id);
                                                }}
                                                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-all transform active:scale-95 shadow-md shadow-red-900/20"
                                                title="發起挑戰"
                                            >
                                                <Swords size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-900/50 backdrop-blur-xl relative">
                <div className="p-4 bg-gray-800/30 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-green-500 animate-pulse`}></div>
                        <span className="font-bold">世界聊天 {selectedPlayer ? ` > 與 ${selectedPlayer.name} 私聊` : ''}</span>
                    </div>
                    {selectedPlayer && (
                        <button onClick={() => setSelectedPlayer(null)} className="text-xs bg-gray-700 px-2 py-1 rounded-md hover:bg-gray-600 transition-all">
                            回復公開頻道
                        </button>
                    )}
                </div>

                <div ref={scrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden scroll-smooth">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.from === currentUser.id ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{msg.fromName}</span>
                                {msg.to && <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50">私訊</span>}
                            </div>
                            <div className={`
                max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-xl
                ${msg.from === currentUser.id
                                    ? 'bg-red-600 text-white rounded-tr-none shadow-red-900/10'
                                    : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700 shadow-black/50'}
              `}>
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-gray-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSend} className="p-4 bg-gray-800/50 border-t border-gray-700 sticky bottom-0 backdrop-blur-md">
                    <div className="flex gap-2 max-w-4xl mx-auto items-center">
                        {selectedPlayer && (
                            <div className="hidden md:flex items-center gap-1 bg-blue-600/20 text-blue-400 px-3 py-2 rounded-lg border border-blue-500/30 text-xs shrink-0">
                                <Shield size={14} />
                                To: {selectedPlayer.name}
                            </div>
                        )}
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="flex-1 bg-gray-700 border border-gray-600 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 placeholder:text-gray-500 transition-all shadow-inner"
                            placeholder={selectedPlayer ? `私訊給 ${selectedPlayer.name}...` : "說點什麼吧..."}
                        />
                        <button
                            type="submit"
                            className="bg-red-600 hover:bg-red-700 p-3 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-red-900/20"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </form>

                {/* Challenge Modal */}
                {receivedChallenge && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-800 p-8 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-900/40 max-w-sm w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/20">
                                <Swords size={40} className="text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black mb-2 tracking-tighter uppercase italic">挑戰降臨!</h2>
                                <p className="text-gray-400 leading-relaxed">玩家 <span className="text-white font-bold underline decoration-red-500 underline-offset-4">{receivedChallenge.fromName}</span> 向你發起了暗棋生死戰!</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => onRejectChallenge()}
                                    className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl font-bold transition-all transform active:scale-95 border border-gray-600"
                                >
                                    逃跑 (拒絕)
                                </button>
                                <button
                                    onClick={() => onAcceptChallenge(receivedChallenge)}
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-bold transition-all transform active:scale-95 shadow-lg shadow-red-900/40 border border-red-500"
                                >
                                    迎戰 (接受)
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
