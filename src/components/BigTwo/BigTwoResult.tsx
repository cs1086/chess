import React from 'react';
import type { BigTwoGameState } from '../../types';

interface BigTwoResultProps {
    gameState: BigTwoGameState;
    currentUserId: string;
    onExit: () => void;
}

export const BigTwoResult: React.FC<BigTwoResultProps> = ({
    gameState, currentUserId, onExit
}) => {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    const isWinner = gameState.winner === currentUserId;

    // Sort players by card count (ascending = better)
    const rankings = [...gameState.players].sort((a, b) =>
        (a.hand?.length || 0) - (b.hand?.length || 0)
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/10">
                {/* Crown / Trophy */}
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">
                        {isWinner ? '🏆' : '🃏'}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {isWinner ? '恭喜獲勝！' : '遊戲結束'}
                    </h2>
                    <p className="text-yellow-400 text-lg">
                        🎉 {winner?.name || '未知'} 獲勝！
                    </p>
                </div>

                {/* Rankings */}
                <div className="space-y-3 mb-8">
                    {rankings.map((player, index) => {
                        const medals = ['🥇', '🥈', '🥉', '💀'];
                        const cardCount = player.hand?.length || 0;
                        return (
                            <div
                                key={player.id}
                                className={`
                                    flex items-center justify-between px-4 py-3 rounded-xl
                                    ${player.id === currentUserId
                                        ? 'bg-yellow-500/20 border border-yellow-500/30'
                                        : 'bg-white/5 border border-white/5'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{medals[index]}</span>
                                    <span className={`font-medium ${player.id === currentUserId ? 'text-yellow-300' : 'text-white'}`}>
                                        {player.name}
                                    </span>
                                </div>
                                <span className="text-gray-400 text-sm">
                                    {cardCount === 0 ? '✨ 出完' : `剩 ${cardCount} 張`}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={onExit}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:brightness-110 transition shadow-lg shadow-amber-500/30"
                >
                    返回房間
                </button>
            </div>
        </div>
    );
};
