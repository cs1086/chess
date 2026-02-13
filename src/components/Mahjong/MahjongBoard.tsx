import React from 'react';
import type { MahjongGameState, MahjongTile as MahjongTileType } from '../../types';
import { MahjongTile } from './MahjongTile';

interface MahjongBoardProps {
    gameState: MahjongGameState;
    currentUserId: string;
    onDiscard?: (tile: MahjongTileType) => void;
    onPong?: () => void;
    onKong?: () => void;
    onChi?: () => void;
    onHu?: () => void;
    onSkip?: () => void;
}

export const MahjongBoard: React.FC<MahjongBoardProps> = ({
    gameState, currentUserId, onDiscard,
    onPong, onKong, onChi, onHu, onSkip
}) => {
    // Determine seat rotation
    const selfIndex = gameState.players.findIndex(p => p.id === currentUserId);
    // If spectator (index -1), default to viewing player 0 at bottom
    const viewIndex = selfIndex === -1 ? 0 : selfIndex;

    // Helper to get relative player (0=Self, 1=Right, 2=Top, 3=Left)
    // Normalize arrays that Firebase may return as undefined (empty arrays are deleted)
    const getPlayer = (offset: number) => {
        const index = (viewIndex + offset) % 4;
        const p = gameState.players[index];
        if (!p) return { id: '', name: '?', wind: 0, hand: [], melds: [], discarded: [], score: 0 };
        return {
            ...p,
            hand: p.hand || [],
            discarded: p.discarded || [],
            melds: p.melds || [],

        };
    };

    const right = getPlayer(1);
    const top = getPlayer(2);
    const left = getPlayer(3);
    const self = getPlayer(0);

    return (
        <div className="relative w-full h-[600px] md:h-[700px] bg-[#0a5c36] rounded-xl overflow-hidden shadow-2xl p-2 md:p-4 select-none border-8 border-[#3e2723]">
            {/* Center Area */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#064225] p-6 rounded-lg text-white text-center border-2 border-[#8d6e63] shadow-lg z-0 w-48 h-48 flex flex-col justify-center items-center">
                <div className="text-3xl font-bold mb-2 text-yellow-400">
                    {['東', '南', '西', '北'][gameState.prevailingWind]}風圈
                </div>
                <div className="text-sm opacity-80 text-gray-300">剩餘牌數: {gameState.wallCount}</div>
                <div className="mt-2 text-xs bg-black/30 px-2 py-1 rounded text-yellow-200">
                    莊家: {gameState.players[gameState.dealer]?.name}
                </div>
                <div className="text-xs text-gray-400 mt-1">Round: {gameState.round}</div>
            </div>

            {/* Top Player (Opposite) */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center max-w-[80%]">
                <div className="text-white text-xs mb-1 opacity-70">{top.name}</div>
                <div className="flex flex-row gap-0.5 mb-2">
                    {/* Render hidden hand */}
                    {top.hand.map((_, i) => (
                        <MahjongTile key={i} size="sm" isHidden />
                    ))}
                </div>
                {/* Discards */}
                <div className="flex flex-wrap gap-0.5 justify-center w-64 md:w-80 flex-row-reverse">
                    {top.discarded.map((t, i) => (
                        <MahjongTile key={i} tile={t} size="sm" />
                    ))}
                </div>
            </div>

            {/* Left Player */}
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-row items-center h-[80%]">
                <div className="flex flex-col items-center">
                    <div className="text-white text-xs mb-1 opacity-70 rotate-90">{left.name}</div>
                    <div className="flex flex-col gap-0.5 mr-2">
                        {/* Render hidden hand vertical */}
                        {left.hand.map((_, i) => (
                            <MahjongTile key={i} size="sm" isHidden className="rotate-90" />
                        ))}
                    </div>
                </div>
                {/* Discards */}
                <div className="grid grid-cols-6 gap-0.5 w-24 md:w-32 rotate-90">
                    {left.discarded.map((t, i) => (
                        <MahjongTile key={i} tile={t} size="sm" className="-rotate-90" />
                    ))}
                </div>
            </div>

            {/* Right Player */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-row-reverse items-center h-[80%]">
                <div className="flex flex-col items-center">
                    <div className="text-white text-xs mb-1 opacity-70 -rotate-90">{right.name}</div>
                    <div className="flex flex-col gap-0.5 ml-2">
                        {/* Render hidden hand vertical */}
                        {right.hand.map((_, i) => (
                            <MahjongTile key={i} size="sm" isHidden className="-rotate-90" />
                        ))}
                    </div>
                </div>
                {/* Discards */}
                <div className="grid grid-cols-6 gap-0.5 w-24 md:w-32 -rotate-90">
                    {right.discarded.map((t, i) => (
                        <MahjongTile key={i} tile={t} size="sm" className="rotate-90" />
                    ))}
                </div>
            </div>

            {/* Self Player (Bottom) */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center w-full px-4">
                {/* Discards */}
                <div className="flex flex-wrap gap-0.5 justify-center mb-8 w-full max-w-2xl">
                    {self.discarded.map((t, i) => (
                        <MahjongTile key={i} tile={t} size="sm" />
                    ))}
                </div>

                {/* Hand */}
                <div className="flex flex-row gap-0.5 md:gap-1 items-end h-20 mb-2">
                    {self.hand.map((t, i) => (
                        <MahjongTile
                            key={t.id || i}
                            tile={t}
                            size="md"
                            onClick={() => onDiscard && onDiscard(t)}
                            className="cursor-pointer hover:mb-4 transition-all duration-200 shadow-xl"
                        />
                    ))}
                </div>
                <div className="text-white text-xs mt-1 opacity-70">{self.name} {gameState.currentTurn === self.id ? '(Your Turn)' : ''}</div>

                {/* Action Buttons */}
                {(() => {
                    const pendingAction = gameState.pendingAction;
                    const canAct = pendingAction && pendingAction.targetPlayers.includes(currentUserId);
                    const myActions = canAct ? pendingAction.actions.find(a => a.playerId === currentUserId) : null;

                    if (canAct && myActions) {
                        return (
                            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex gap-4 z-50 animate-bounce">
                                {myActions.canPong && (
                                    <button
                                        onClick={onPong}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-blue-500 border-2 border-white ring-2 ring-blue-400"
                                    >
                                        碰 (Pong)
                                    </button>
                                )}
                                {myActions.canKong && (
                                    <button
                                        onClick={onKong}
                                        className="bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-purple-500 border-2 border-white ring-2 ring-purple-400"
                                    >
                                        槓 (Kong)
                                    </button>
                                )}
                                {myActions.canChi && (
                                    <button
                                        onClick={onChi}
                                        className="bg-green-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-green-500 border-2 border-white ring-2 ring-green-400"
                                    >
                                        吃 (Chi)
                                    </button>
                                )}
                                {myActions.canHu && (
                                    <button
                                        onClick={onHu}
                                        className="bg-red-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-red-500 border-2 border-white ring-2 ring-red-400 animate-pulse"
                                    >
                                        胡 (Hu)
                                    </button>
                                )}
                                <button
                                    onClick={onSkip}
                                    className="bg-gray-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-gray-500 border-2 border-white ring-2 ring-gray-400"
                                >
                                    過 (Skip)
                                </button>
                            </div>
                        );
                    }
                    return null;
                })()}

            </div>
        </div>
    );
};
