import React, { useEffect, useState } from 'react';
import { MahjongTile as MahjongTileComponent } from './MahjongTile';
import type { MahjongTile, MahjongMeld, MahjongGameState } from '../../types';
import { Trophy, Star, ArrowRight, XCircle } from 'lucide-react';

interface MahjongResultProps {
    gameState: MahjongGameState;
    onNextRound: () => void;
    onExit: () => void;
    isHost: boolean;
}

export const MahjongResult: React.FC<MahjongResultProps> = ({ gameState, onNextRound, onExit, isHost }) => {
    const isDraw = gameState.endReason === 'exhaustive_draw';
    const isAllRoundsComplete = (gameState.round || 1) >= (gameState.totalRounds || 16);
    const winner = gameState.players.find(p => p.id === gameState.winner);
    const scoring = gameState.scoringResult;
    const winningHand = gameState.winningHand || [];
    const windNames = ['東', '南', '西', '北'];

    // Auto-countdown for next round
    const [countdown, setCountdown] = useState(isAllRoundsComplete ? -1 : 5);

    useEffect(() => {
        if (isAllRoundsComplete || countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown, isAllRoundsComplete]);

    useEffect(() => {
        if (countdown === 0 && isHost && !isAllRoundsComplete) {
            onNextRound();
        }
    }, [countdown, isHost, isAllRoundsComplete, onNextRound]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-gradient-to-b from-[#2a1f0e] to-[#1a120b] border-2 border-yellow-600/50 rounded-2xl shadow-2xl w-[90vw] max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-4 text-center relative overflow-hidden ${isDraw
                    ? 'bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600'
                    : 'bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700'
                    }`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,200,0.3),transparent_70%)]" />
                    <div className="relative flex items-center justify-center gap-2">
                        {isDraw ? (
                            <>
                                <XCircle className="text-gray-200" size={28} />
                                <h2 className="text-2xl font-bold text-gray-100 tracking-wider">流局</h2>
                                <XCircle className="text-gray-200" size={28} />
                            </>
                        ) : (
                            <>
                                <Trophy className="text-yellow-200" size={28} />
                                <h2 className="text-2xl font-bold text-yellow-100 tracking-wider">胡牌！</h2>
                                <Trophy className="text-yellow-200" size={28} />
                            </>
                        )}
                    </div>
                    {!isDraw && winner && (
                        <p className="text-yellow-200/80 text-sm mt-1">
                            {winner.name} · {windNames[winner.wind]}風 · {gameState.isZimo ? '自摸' : '放槍'}
                        </p>
                    )}
                    {isDraw && (
                        <p className="text-gray-200/80 text-sm mt-1">牌牆已摸完，本局無人胡牌</p>
                    )}
                    <p className="text-gray-300/60 text-xs mt-1">
                        第 {gameState.round} / {gameState.totalRounds || 16} 局 · {windNames[gameState.prevailingWind]}風圈
                    </p>
                </div>

                {/* Winning Hand (only for hu) */}
                {!isDraw && winner && scoring && (
                    <>
                        <div className="px-4 pt-4 pb-2">
                            <h3 className="text-gray-400 text-xs font-medium mb-2 flex items-center gap-1">
                                <Star size={12} /> 胡牌牌型
                            </h3>
                            <div className="flex flex-wrap gap-1 justify-center bg-green-900/30 rounded-xl p-3 border border-green-800/30">
                                {(winner.melds || []).map((meld: MahjongMeld, mi: number) => (
                                    <div key={`meld-${mi}`} className="flex gap-0.5 mr-2">
                                        {meld.tiles.map((tile: MahjongTile, ti: number) => (
                                            <MahjongTileComponent key={`meld-${mi}-${ti}`} tile={tile} size="sm" />
                                        ))}
                                    </div>
                                ))}
                                {(winner.melds || []).length > 0 && (
                                    <div className="w-px bg-yellow-600/30 mx-1 self-stretch" />
                                )}
                                {winningHand.map((tile: MahjongTile, i: number) => (
                                    <MahjongTileComponent key={`hand-${i}`} tile={tile} size="sm" />
                                ))}
                            </div>
                        </div>

                        <div className="px-4 py-3">
                            <h3 className="text-gray-400 text-xs font-medium mb-2 flex items-center gap-1">
                                <Star size={12} /> 台數明細
                            </h3>
                            <div className="bg-black/30 rounded-xl border border-gray-700/50 overflow-hidden">
                                <div className="divide-y divide-gray-700/30">
                                    {scoring.items.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-500 font-bold text-lg">{item.fan}</span>
                                                <span className="text-gray-300 text-xs">台</span>
                                                <ArrowRight size={12} className="text-gray-600" />
                                                <span className="text-white font-medium">{item.name}</span>
                                            </div>
                                            <span className="text-gray-500 text-xs max-w-[140px] text-right">{item.description}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-yellow-900/30 border-t border-yellow-600/30 px-4 py-3 flex items-center justify-between">
                                    <span className="text-yellow-200 font-bold text-lg">總計</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400 font-bold text-3xl">{scoring.totalFan}</span>
                                        <span className="text-yellow-300/80 text-sm">台</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Scoreboard for draw */}
                {isDraw && (
                    <div className="px-4 py-4">
                        <h3 className="text-gray-400 text-xs font-medium mb-2">各家分數</h3>
                        <div className="bg-black/30 rounded-xl border border-gray-700/50 overflow-hidden divide-y divide-gray-700/30">
                            {gameState.players.map((p, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                    <span className="text-white font-medium">{p.name} ({windNames[p.wind]})</span>
                                    <span className="text-yellow-400 font-bold">{p.score} 分</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="px-4 pb-4 pt-1 flex gap-3">
                    {isAllRoundsComplete ? (
                        <button
                            onClick={onExit}
                            className="w-full py-3 bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg active:scale-[0.98]"
                        >
                            16 圈結束 — 返回房間
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onExit}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-xl transition-all duration-200 shadow-lg active:scale-[0.98]"
                            >
                                退出
                            </button>
                            <button
                                onClick={isHost ? onNextRound : undefined}
                                disabled={!isHost}
                                className="flex-[2] py-3 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg active:scale-[0.98] disabled:opacity-50"
                            >
                                {isHost
                                    ? `下一局${countdown > 0 ? ` (${countdown}s)` : ''}`
                                    : `等待房主開始下一局${countdown > 0 ? ` (${countdown}s)` : ''}`
                                }
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.4s ease-out;
                }
            `}
            </style>
        </div>
    );
};
