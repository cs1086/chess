import React from 'react';
import type { UserProfile } from '../../types';
import { Trophy, MessageSquare } from 'lucide-react';

interface HomeProps {
    user: UserProfile;
    leaderboard: UserProfile[];
    onJoinChat: () => void;
    isAdmin?: boolean;
    onClearChat?: () => void;
    onClearGames?: () => void;
    onClearUsers?: () => void;
    onClearStats?: () => void;
}

const AdminPanel: React.FC<{
    onClearChat: () => void;
    onClearGames: () => void;
    onClearUsers: () => void;
    onClearStats: () => void;
}> = ({ onClearChat, onClearGames, onClearUsers, onClearStats }) => (
    <div className="bg-red-900/20 border-2 border-red-500/50 rounded-2xl p-6 space-y-4">
        <h3 className="text-xl font-black text-red-500 flex items-center gap-2 italic uppercase">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            Admin Operations Panel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
                onClick={() => window.confirm('確定要清除所有聊天記錄？') && onClearChat()}
                className="p-4 bg-gray-800 hover:bg-gray-700 border border-red-500/30 rounded-xl font-bold transition-all text-sm text-red-400"
            >
                🔥 清除所有聊天
            </button>
            <button
                onClick={() => window.confirm('確定要清除所有戰局與挑戰？') && onClearGames()}
                className="p-4 bg-gray-800 hover:bg-gray-700 border border-red-500/30 rounded-xl font-bold transition-all text-sm text-red-400"
            >
                ⚔️ 清除所有戰局
            </button>
            <button
                onClick={() => window.confirm('注意：這將清除所有使用者數據！') && onClearUsers()}
                className="p-4 bg-gray-800 hover:bg-gray-700 border border-red-500/30 rounded-xl font-bold transition-all text-sm text-red-400"
            >
                💀 清除所有使用者
            </button>
            <button
                onClick={() => window.confirm('確定要清除所有玩家的勝敗、逃跑與拒絕紀錄？') && onClearStats()}
                className="p-4 bg-gray-800 hover:bg-gray-700 border border-yellow-500/30 rounded-xl font-bold transition-all text-sm text-yellow-400"
            >
                📊 清除所有紀錄 (不刪帳號)
            </button>
        </div>
    </div>
);

export const Home: React.FC<HomeProps> = ({
    user,
    leaderboard,
    onJoinChat,
    isAdmin,
    onClearChat,
    onClearGames,
    onClearUsers,
    onClearStats
}) => {
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {isAdmin && onClearChat && onClearGames && onClearUsers && onClearStats && (
                    <AdminPanel
                        onClearChat={onClearChat}
                        onClearGames={onClearGames}
                        onClearUsers={onClearUsers}
                        onClearStats={onClearStats}
                    />
                )}
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800 p-6 rounded-2xl border border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg shadow-red-900/40">
                            {user.name && user.name.length > 0 ? user.name[0].toUpperCase() : '?'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{user.name}</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                <span>勝: <span className="text-green-400 font-bold">{user.wins}</span></span>
                                <span>敗: <span className="text-red-400 font-bold">{user.losses}</span></span>
                                <span>投降: <span className="text-orange-400 font-bold">{user.surrenders || 0}</span></span>
                                <span>逃跑: <span className="text-purple-400 font-bold">{user.runaways || 0}</span></span>
                                <span>拒絕: <span className="text-gray-300 font-bold">{user.rejections || 0}</span></span>
                                <span>勝率: <span className="text-blue-400 font-bold">
                                    {user.wins + user.losses > 0
                                        ? Math.round((user.wins / (user.wins + user.losses)) * 100)
                                        : 0}%
                                </span></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={onJoinChat}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/40 text-lg"
                        >
                            <MessageSquare size={24} />
                            進入聊天室
                        </button>
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-700 flex items-center gap-3">
                        <Trophy className="text-yellow-500" />
                        <h3 className="text-xl font-bold text-yellow-500">排行榜</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-700/50 text-gray-400 text-sm">
                                    <th className="px-6 py-4">排名</th>
                                    <th className="px-6 py-4">玩家</th>
                                    <th className="px-6 py-4 text-center">勝</th>
                                    <th className="px-6 py-4 text-center">敗</th>
                                    <th className="px-6 py-4 text-center">投</th>
                                    <th className="px-6 py-4 text-center">逃</th>
                                    <th className="px-6 py-4 text-center">拒</th>
                                    <th className="px-6 py-4 text-right">勝率</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {leaderboard.map((player, index) => (
                                    <tr key={`${player.id}-${index}`} className={`hover:bg-gray-700/30 transition-colors ${player.id === user.id ? 'bg-red-900/10' : ''}`}>
                                        <td className="px-6 py-4 font-bold">
                                            {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium">{player.name}</span>
                                            {player.id === user.id && <span className="ml-2 text-xs bg-red-600 px-2 py-0.5 rounded text-white">你</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center text-green-400 font-mono">{player.wins}</td>
                                        <td className="px-6 py-4 text-center text-red-400 font-mono">{player.losses}</td>
                                        <td className="px-6 py-4 text-center text-orange-400 font-mono">{player.surrenders || 0}</td>
                                        <td className="px-6 py-4 text-center text-purple-400 font-mono">{player.runaways || 0}</td>
                                        <td className="px-6 py-4 text-center text-gray-400 font-mono">{player.rejections || 0}</td>
                                        <td className="px-6 py-4 text-right font-mono text-blue-400">
                                            {player.wins + player.losses > 0
                                                ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                                                : 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
