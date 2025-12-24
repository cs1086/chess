import React, { useState } from 'react';
import type { UserProfile } from '../../types';
import { Trophy } from 'lucide-react';

interface AuthProps {
    onLogin: (id: string) => void;
    leaderboard: UserProfile[];
}

export const Auth: React.FC<AuthProps> = ({ onLogin, leaderboard }) => {
    const [userId, setUserId] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Allow Chinese characters (\u4e00-\u9fa5), letters, and numbers
        const validIdPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
        if (!userId.trim()) {
            setError('ID 不能為空');
            return;
        }
        if (!validIdPattern.test(userId)) {
            setError('ID 只能包含中文、英文、數字、下劃線或連字號');
            return;
        }
        onLogin(userId);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 gap-8">
            <div className="w-full max-w-md p-8 bg-gray-800 rounded-3xl shadow-2xl border border-gray-700">
                <h1 className="text-4xl font-black mb-8 text-center bg-gradient-to-r from-red-500 to-red-800 bg-clip-text text-transparent italic uppercase tracking-tighter">
                    暗棋對戰
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="userId" className="block text-sm font-bold text-gray-400 mb-2 ml-1">
                            輸入您的玩家 ID
                        </label>
                        <input
                            type="text"
                            id="userId"
                            value={userId}
                            onChange={(e) => {
                                setUserId(e.target.value);
                                setError('');
                            }}
                            className="w-full px-5 py-4 bg-gray-900 border border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/50 text-white transition-all placeholder:text-gray-600 font-bold"
                            placeholder="例如: player123"
                            maxLength={15}
                        />
                        {error && <p className="mt-2 text-sm text-red-500 font-bold ml-1">⚠️ {error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transform active:scale-95 transition-all shadow-lg shadow-red-900/40 text-lg uppercase tracking-wide"
                    >
                        進入遊戲
                    </button>
                </form>

                <div className="mt-8 text-center text-gray-500 text-xs font-medium">
                    您的 ID 將會儲存在此瀏覽器中
                </div>
            </div>

            {/* Leaderboard on Auth Page */}
            {leaderboard.length > 0 && (
                <div className="w-full max-w-2xl bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-gray-700 bg-gray-800/50 flex items-center gap-3">
                        <Trophy className="text-yellow-500" />
                        <h3 className="text-xl font-black text-yellow-500 italic uppercase">KO榜 - 當前強者</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-900/50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
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
                            <tbody className="divide-y divide-gray-700/50 text-sm">
                                {leaderboard.map((player, index) => (
                                    <tr key={player.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 font-black">
                                            {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-200">
                                            {player.name}
                                        </td>
                                        <td className="px-6 py-4 text-center text-green-400 font-mono font-bold">{player.wins}</td>
                                        <td className="px-6 py-4 text-center text-red-400 font-mono">{player.losses}</td>
                                        <td className="px-6 py-4 text-center text-orange-400 font-mono">{player.surrenders || 0}</td>
                                        <td className="px-6 py-4 text-center text-purple-400 font-mono">{player.runaways || 0}</td>
                                        <td className="px-6 py-4 text-center text-gray-500 font-mono">{player.rejections || 0}</td>
                                        <td className="px-6 py-4 text-right font-mono text-blue-400 font-bold">
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
            )}
        </div>
    );
};
