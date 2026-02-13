import React from 'react';
import { MahjongTile as MahjongTileComponent } from './MahjongTile';
import type { MahjongTile, MahjongMeld, MahjongGameState } from '../../types';
import { Trophy, Star, ArrowRight } from 'lucide-react';

interface MahjongResultProps {
    gameState: MahjongGameState;
    onExit: () => void;
}

export const MahjongResult: React.FC<MahjongResultProps> = ({ gameState, onExit }) => {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    const scoring = gameState.scoringResult;
    const winningHand = gameState.winningHand || [];

    if (!winner || !scoring) return null;

    const windNames = ['東', '南', '西', '北'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-gradient-to-b from-[#2a1f0e] to-[#1a120b] border-2 border-yellow-600/50 rounded-2xl shadow-2xl w-[90vw] max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-700 px-6 py-4 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,200,0.3),transparent_70%)]" />
                    <div className="relative flex items-center justify-center gap-2">
                        <Trophy className="text-yellow-200" size={28} />
                        <h2 className="text-2xl font-bold text-yellow-100 tracking-wider">胡牌！</h2>
                        <Trophy className="text-yellow-200" size={28} />
                    </div>
                    <p className="text-yellow-200/80 text-sm mt-1">
                        {winner.name} · {windNames[winner.wind]}風 · {gameState.isZimo ? '自摸' : '放槍'}
                    </p>
                </div>

                {/* Winning Hand */}
                <div className="px-4 pt-4 pb-2">
                    <h3 className="text-gray-400 text-xs font-medium mb-2 flex items-center gap-1">
                        <Star size={12} /> 胡牌牌型
                    </h3>
                    <div className="flex flex-wrap gap-1 justify-center bg-green-900/30 rounded-xl p-3 border border-green-800/30">
                        {/* Melds (declared) */}
                        {(winner.melds || []).map((meld: MahjongMeld, mi: number) => (
                            <div key={`meld-${mi}`} className="flex gap-0.5 mr-2">
                                {meld.tiles.map((tile: MahjongTile, ti: number) => (
                                    <MahjongTileComponent key={`meld-${mi}-${ti}`} tile={tile} size="sm" />
                                ))}
                            </div>
                        ))}
                        {/* Separator if melds exist */}
                        {(winner.melds || []).length > 0 && (
                            <div className="w-px bg-yellow-600/30 mx-1 self-stretch" />
                        )}
                        {/* Hand tiles */}
                        {winningHand.map((tile: MahjongTile, i: number) => (
                            <MahjongTileComponent key={`hand-${i}`} tile={tile} size="sm" />
                        ))}
                    </div>
                </div>

                {/* Scoring Details */}
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

                        {/* Total */}
                        <div className="bg-yellow-900/30 border-t border-yellow-600/30 px-4 py-3 flex items-center justify-between">
                            <span className="text-yellow-200 font-bold text-lg">總計</span>
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 font-bold text-3xl">{scoring.totalFan}</span>
                                <span className="text-yellow-300/80 text-sm">台</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="px-4 pb-4 pt-1">
                    <button
                        onClick={onExit}
                        className="w-full py-3 bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-yellow-600/20 active:scale-[0.98]"
                    >
                        返回房間
                    </button>
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
            `}</style>
        </div>
    );
};
