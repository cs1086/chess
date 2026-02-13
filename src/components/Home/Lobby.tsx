
import React, { useState } from 'react';
import type { Room, UserProfile, GameType } from '../../types';
import { GAME_CONFIGS } from '../../utils/gameConfig';
import { Lock, Users, Eye, Plus, Search } from 'lucide-react';
import { CreateRoomModal } from './CreateRoomModal';

interface LobbyProps {
    user: UserProfile;
    rooms: Room[];
    onCreateRoom: (gameType: GameType, password?: string, allowSpectators?: boolean) => void;
    onJoinRoom: (roomId: string, password?: string) => void;
    onClearGames?: () => void;
    onClearUsers?: () => void;
    onClearStats?: () => void;
    isAdmin: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({
    user, rooms, onCreateRoom, onJoinRoom, onClearGames, onClearUsers, onClearStats, isAdmin
}) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filterType, setFilterType] = useState<GameType | 'all'>('all');
    const [showPasswordInput, setShowPasswordInput] = useState<string | null>(null);
    const [passwordInput, setPasswordInput] = useState('');

    const filteredRooms = rooms.filter(room => filterType === 'all' || room.gameType === filterType);

    const handleJoinClick = (room: Room) => {
        if (room.password && room.hostId !== user.id) {
            setShowPasswordInput(room.id);
            setPasswordInput('');
        } else {
            onJoinRoom(room.id);
        }
    };

    const submitPassword = (roomId: string) => {
        onJoinRoom(roomId, passwordInput);
        setShowPasswordInput(null);
    };

    return (
        <div className="min-h-screen bg-[#f8f1e7] p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-[#fff8f0] p-6 rounded-2xl shadow-sm border border-[#e8d5c4]">
                    <div>
                        <h1 className="text-3xl font-bold text-[#5c3a1e] mb-1">遊戲大廳</h1>
                        <p className="text-[#8b5a2b]">歡迎回來，<span className="font-bold">{user.name}</span></p>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-3">
                        {isAdmin && (
                            <div className="flex gap-2">
                                <button onClick={onClearGames} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">清除遊戲</button>
                                <button onClick={onClearUsers} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">清除用戶</button>
                                <button onClick={onClearStats} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">重置戰績</button>
                            </div>
                        )}
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[#8b5a2b] text-white rounded-xl hover:bg-[#6d4621] transition shadow-lg active:scale-95"
                        >
                            <Plus size={20} />
                            <span>建立房間</span>
                        </button>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition ${filterType === 'all'
                                ? 'bg-[#5c3a1e] text-white shadow-md'
                                : 'bg-[#e8d5c4] text-[#8b5a2b] hover:bg-[#dcc0a3]'
                            }`}
                    >
                        全部遊戲
                    </button>
                    {Object.entries(GAME_CONFIGS).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setFilterType(key as GameType)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap transition ${filterType === key
                                    ? 'bg-[#5c3a1e] text-white shadow-md'
                                    : 'bg-[#e8d5c4] text-[#8b5a2b] hover:bg-[#dcc0a3]'
                                }`}
                        >
                            {config.name}
                        </button>
                    ))}
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRooms.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-[#9ca3af]">
                            <Search size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-xl">目前沒有房間，快來建立一個吧！</p>
                        </div>
                    ) : (
                        filteredRooms.map(room => (
                            <div key={room.id} className="bg-white rounded-xl shadow-md border-2 border-[#e8d5c4] hover:border-[#dcc0a3] transition overflow-hidden flex flex-col">
                                <div className="p-5 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-[#f0e4d4] px-3 py-1 rounded-lg text-xs font-bold text-[#8b5a2b]">
                                            {GAME_CONFIGS[room.gameType].name}
                                        </div>
                                        {room.password && <Lock size={16} className="text-[#8b5a2b]" />}
                                    </div>
                                    <h3 className="text-lg font-bold text-[#5c3a1e] mb-2 truncate">
                                        {room.name || `房間 #${room.id.slice(-4)}`}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-[#6b7280]">
                                        <div className="flex items-center gap-1">
                                            <Users size={16} />
                                            <span>{room.players.length} / {room.maxPlayers}</span>
                                        </div>
                                        {room.allowSpectators && (
                                            <div className="flex items-center gap-1">
                                                <Eye size={16} />
                                                <span>{room.spectators.length}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {room.players.map(p => (
                                            <span key={p.id} className="inline-block px-2 py-1 bg-[#f3f4f6] rounded text-xs text-[#374151]">
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-[#fff8f0] border-t border-[#e8d5c4]">
                                    {showPasswordInput === room.id ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={passwordInput}
                                                onChange={(e) => setPasswordInput(e.target.value)}
                                                placeholder="輸入密碼"
                                                className="flex-1 px-3 py-2 rounded-lg border border-[#ccbfa8] text-sm focus:outline-none focus:border-[#8b5a2b]"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => submitPassword(room.id)}
                                                className="px-4 py-2 bg-[#8b5a2b] text-white rounded-lg text-sm font-bold hover:bg-[#6d4621]"
                                            >
                                                確認
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleJoinClick(room)}
                                            disabled={room.players.length >= room.maxPlayers && (!room.allowSpectators)}
                                            className={`w-full py-3 rounded-lg font-bold transition flex justify-center items-center gap-2 ${room.players.length >= room.maxPlayers
                                                    ? room.allowSpectators
                                                        ? 'bg-[#e8d5c4] text-[#8b5a2b] hover:bg-[#dcc0a3]'
                                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-[#5c3a1e] text-white hover:bg-[#4a2e18]'
                                                }`}
                                        >
                                            {room.players.length >= room.maxPlayers
                                                ? room.allowSpectators ? '觀戰' : '房間已滿'
                                                : '加入房間'
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <CreateRoomModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={onCreateRoom}
            />
        </div>
    );
};
