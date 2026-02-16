import React from 'react';
import type { MahjongGameState, MahjongTile as MahjongTileType, MahjongMeld } from '../../types';
import { MahjongTile } from './MahjongTile';
import { sortHand, getWaitingStatus, canPong, canChi, checkHu } from '../../utils/mahjongLogic';

/** Renders a strategic summary in cheat mode */
const CheatSummary: React.FC<{ hand: MahjongTileType[] }> = ({ hand }) => {
    const status = getWaitingStatus(hand);
    const hasAny = status.hu.length > 0 || status.pong.length > 0 || status.chi.length > 0;
    if (!hasAny) return null;

    return (
        <div className="mt-1 bg-black/60 border border-yellow-500/30 rounded p-1.5 text-[10px] text-white shadow-lg backdrop-blur-sm pointer-events-none z-50 animate-fade-in max-w-[180px]">
            {status.hu.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-1">
                    <span className="text-yellow-400 font-black">聽:</span>
                    {status.hu.map((n, i) => (
                        <span key={i} className="text-red-400 font-bold bg-white/10 px-0.5 rounded border border-white/5">{n}</span>
                    ))}
                </div>
            )}
            <div className="flex flex-col gap-0.5 text-gray-300">
                {status.pong.length > 0 && (
                    <div className="flex flex-wrap gap-0.5"><span className="text-blue-400">碰:</span> {status.pong.join(',')}</div>
                )}
                {status.chi.length > 0 && (
                    <div className="flex flex-wrap gap-0.5"><span className="text-green-400">吃:</span> {status.chi.join(',')}</div>
                )}
            </div>
        </div>
    );
};

interface MahjongBoardProps {
    gameState: MahjongGameState;
    currentUserId: string;
    onDiscard?: (tile: MahjongTileType) => void;
    onPong?: () => void;
    onKong?: () => void;
    onChi?: () => void;
    onHu?: () => void;
    onSkip?: () => void;
    onExit?: () => void;
}

/** Renders a single meld group (Pong / Chi / Kong) */
const MeldGroup: React.FC<{ meld: MahjongMeld; size?: 'sm' | 'md'; side?: 'left' | 'right' | 'top' | 'bottom' }> = ({ meld, size = 'sm', side = 'bottom' }) => {
    const tiles = meld.tiles || [];
    if (side === 'left') {
        // Left player: rotate 90° clockwise, tiles stacked horizontally (appear vertical)
        return (
            <div className="flex flex-row bg-black/20 rounded p-[1px] rotate-90 origin-center">
                {tiles.map((t, i) => (
                    <MahjongTile key={t.id || i} tile={t} size={size} />
                ))}
            </div>
        );
    }
    if (side === 'right') {
        // Right player: rotate -90° (counter-clockwise)
        return (
            <div className="flex flex-row bg-black/20 rounded p-[1px] -rotate-90 origin-center">
                {tiles.map((t, i) => (
                    <MahjongTile key={t.id || i} tile={t} size={size} />
                ))}
            </div>
        );
    }
    return (
        <div className="flex flex-row bg-black/20 rounded p-[2px]">
            {tiles.map((t, i) => (
                <MahjongTile key={t.id || i} tile={t} size={size} />
            ))}
        </div>
    );
};

import { DiceRollingOverlay } from './DiceRollingOverlay';

export const MahjongBoard: React.FC<MahjongBoardProps> = ({
    gameState, currentUserId, onDiscard,
    onPong, onKong, onChi, onHu, onSkip, onExit
}) => {
    const selfIndex = gameState?.players?.findIndex(p => p.id === currentUserId) ?? -1;
    const isSpectator = selfIndex === -1;
    const viewIndex = isSpectator ? 0 : selfIndex;

    const getPlayer = (offset: number) => {
        if (!gameState?.players) return { id: '', name: '?', wind: 0, hand: [] as MahjongTileType[], melds: [] as MahjongMeld[], discarded: [] as MahjongTileType[], score: 0 };
        const index = (viewIndex + offset) % 4;
        const p = gameState.players[index];
        if (!p) return { id: '', name: '?', wind: 0, hand: [] as MahjongTileType[], melds: [] as MahjongMeld[], discarded: [] as MahjongTileType[], score: 0 };
        return {
            ...p,
            hand: sortHand(p.hand || []),
            discarded: p.discarded || [],
            melds: p.melds || [],
        };
    };

    const self = getPlayer(0);
    const right = getPlayer(1);
    const top = getPlayer(2);
    const left = getPlayer(3);

    const windNames = ['東', '南', '西', '北'];
    const isMyTurn = !isSpectator && gameState?.currentTurn === self.id;
    const meldCount = (self.melds || []).length;
    const effectiveSize = self.hand.length + meldCount * 3;
    const canDiscard = isMyTurn && effectiveSize >= 17 && !gameState?.pendingAction;

    const [cheatMode, setCheatMode] = React.useState(false);
    const [isInitialRolling, setIsInitialRolling] = React.useState(true);

    // Reset rolling state if round changes
    const lastRoundRef = React.useRef(gameState?.round);
    React.useEffect(() => {
        if (gameState?.round !== lastRoundRef.current) {
            setIsInitialRolling(true);
            lastRoundRef.current = gameState?.round;
        }
    }, [gameState?.round]);

    /** Helper to check if a tile is dangerous (opponents can use it) */
    const checkIsDangerousTile = (t: MahjongTileType) => {
        if (!cheatMode) return false;
        // Check opponents
        const opponents = [right, top, left];
        for (const opp of opponents) {
            if (!opp.id) continue;
            // Winning tile for opponent?
            if (opp.hand.length === 16 && checkHu([...opp.hand, t])) return true;
            // Can they Pong/Kong?
            if (canPong(opp.hand, t)) return true;
            // Can the NEXT player (right) Chi?
            if (opp.id === right.id && canChi(opp.hand, t)) return true;
        }
        return false;
    };

    React.useEffect(() => {
        console.log('MahjongBoard Debug:', {
            currentUserId,
            selfIndex,
            currentTurn: gameState?.currentTurn,
            players: gameState?.players?.map(p => ({ id: p.id, name: p.name }))
        });
    }, [currentUserId, selfIndex, gameState?.currentTurn]);

    if (!gameState) return <div className="text-white text-center p-10">等待遊戲數據...</div>;

    return (
        <div className="relative w-screen h-screen bg-[#0a5c36] overflow-hidden shadow-2xl select-none border-8 border-[#3e2723]">
            {/* Dice Rolling Overlay */}
            {isInitialRolling && (
                <DiceRollingOverlay
                    dice={gameState.dice || [1, 2, 3]}
                    onComplete={() => setIsInitialRolling(false)}
                />
            )}

            {/* ===== TOP-LEFT INFO PANEL ===== */}
            <div className="absolute top-3 left-3 bg-[#064225]/90 px-3 py-2 rounded-lg text-white border border-[#8d6e63]/50 shadow-lg z-30 text-xs">
                <div className="text-lg font-bold text-yellow-400 mb-0.5">
                    {windNames[gameState.prevailingWind]}風圈
                </div>
                <div className="text-gray-300">
                    剩<span className="cursor-default" onClick={() => setCheatMode(!cheatMode)}>餘</span>牌數: {Math.max(0, gameState.wallCount - 16)}
                </div>
                <div className="text-yellow-200/80">
                    莊: {gameState.players[gameState.dealer]?.name}
                    {(gameState.lianZhuangCount || 0) > 0 && (
                        <span className="ml-1 text-red-400 font-bold">連 {gameState.lianZhuangCount}</span>
                    )}
                </div>
                <div className="text-gray-400">第 {gameState.round}/{gameState.totalRounds || 16} 局</div>
                {cheatMode && <div className="text-red-500/20 text-[9px] mt-1 italic">Dev Active</div>}
            </div>

            {/* ===== TOP-RIGHT EXIT BUTTON ===== */}
            {onExit && (
                <button
                    onClick={onExit}
                    className="absolute top-3 right-3 z-30 px-3 py-1.5 bg-red-900/60 hover:bg-red-800/80 text-red-200 text-xs font-bold rounded-lg border border-red-700/50 transition-colors"
                >
                    退出
                </button>
            )}

            {/* ===== CENTER: ALL DISCARDS (Centralized River) ===== */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[55%] z-10 w-[320px] h-[340px] md:w-[480px] md:h-[400px] bg-black/20 rounded-2xl border border-white/10 shadow-inner flex flex-col items-center justify-center overflow-hidden">
                {/* Watermark/Background */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
                    <div className="text-8xl font-black rotate-12">MAHJONG</div>
                </div>

                {/* Discarded Tiles Container */}
                <div className="relative w-full h-full p-4 flex flex-row flex-wrap gap-2 justify-center content-start overflow-y-auto no-scrollbar z-10">
                    {(gameState.discardedTiles || []).map((t, i) => {
                        const isLast = (gameState.lastDiscard?.tile.id === t.id) || (gameState.pendingAction?.tile.id === t.id);
                        return (
                            <div key={t.id || i} className={`relative flex-shrink-0 ${isLast ? 'z-20' : 'z-10'} transition-all duration-300`}>
                                <div className={`${isLast ? 'scale-110' : ''}`}>
                                    <MahjongTile
                                        tile={t}
                                        size="sm"
                                        className={`${isLast ? 'animate-pulse-last-discard ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-900 rounded-sm' : 'opacity-90 hover:opacity-100 hover:scale-105 shadow-md'}`}
                                    />
                                </div>
                                {isLast && <div className="absolute -inset-1 bg-yellow-400/20 blur-md rounded-sm pointer-events-none animate-pulse" />}
                            </div>
                        );
                    })}

                    {(gameState.discardedTiles || []).length === 0 && (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-white/20 text-sm font-medium tracking-widest uppercase italic">
                                Waiting for first discard...
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== TOP PLAYER (Opposite) ===== */}
            <div className="absolute top-1 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-10 max-w-[80%]">
                <div className={`text-white text-xs font-bold mb-1 px-3 py-0.5 rounded-full flex items-center gap-2 ${gameState.currentTurn === top.id ? 'bg-yellow-600/80 animate-turn-blink' : 'bg-black/50'}`}>
                    <span>{top.name} {gameState.currentTurn === top.id ? '🎯' : ''}</span>
                    <span className={`text-[10px] px-1.5 rounded bg-black/40 ${top.score > 0 ? 'text-green-400' : top.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {top.score > 0 ? '+' : ''}{top.score || 0}
                    </span>
                </div>
                {/* Hand (hidden or cheat) */}
                <div className="flex flex-row gap-[1px] mb-1 min-h-[44px] items-center">
                    {top.hand.map((t, i) => (
                        <MahjongTile key={i} tile={cheatMode ? t : undefined} size="sm" isHidden={!cheatMode} />
                    ))}
                </div>
                {/* Melds */}
                {top.melds.length > 0 && (
                    <div className="flex flex-row gap-1">
                        {top.melds.map((m, i) => <MeldGroup key={i} meld={m} />)}
                    </div>
                )}
                {cheatMode && <CheatSummary hand={top.hand} />}
            </div>

            {/* ===== LEFT PLAYER ===== */}
            <div className="absolute left-1 top-1/2 transform -translate-y-1/2 flex flex-row items-center z-10" style={{ maxHeight: '80%' }}>
                <div className="flex flex-col items-center">
                    <div className={`text-white text-[10px] font-bold mb-1 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5 ${gameState.currentTurn === left.id ? 'bg-yellow-600/80 animate-turn-blink' : 'bg-black/50'}`}>
                        <span>{left.name} {gameState.currentTurn === left.id ? '🎯' : ''}</span>
                        <span className={`px-1 rounded bg-black/40 ${left.score > 0 ? 'text-green-400' : left.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {left.score > 0 ? '+' : ''}{left.score || 0}
                        </span>
                    </div>
                    {/* Hand (hidden or cheat) - vertical stack */}
                    <div className="flex flex-col items-center">
                        {left.hand.map((t, i) => (
                            <div key={i} className="flex items-center justify-center -my-[7.5px] rotate-90 w-[32px] h-[44px]">
                                <MahjongTile tile={cheatMode ? t : undefined} size="sm" isHidden={!cheatMode} />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Melds */}
                {left.melds.length > 0 && (
                    <div className="ml-2 flex flex-col gap-2">
                        {left.melds.map((m, i) => <MeldGroup key={i} meld={m} side="left" />)}
                    </div>
                )}
                {cheatMode && <div className="ml-2"><CheatSummary hand={left.hand} /></div>}
            </div>

            {/* ===== RIGHT PLAYER ===== */}
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-row-reverse items-center z-10" style={{ maxHeight: '80%' }}>
                <div className="flex flex-col items-center">
                    <div className={`text-white text-[10px] font-bold mb-1 px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1.5 ${gameState.currentTurn === right.id ? 'bg-yellow-600/80 animate-turn-blink' : 'bg-black/50'}`}>
                        <span>{right.name} {gameState.currentTurn === right.id ? '🎯' : ''}</span>
                        <span className={`px-1 rounded bg-black/40 ${right.score > 0 ? 'text-green-400' : right.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {right.score > 0 ? '+' : ''}{right.score || 0}
                        </span>
                    </div>
                    {/* Hand (hidden or cheat) - vertical stack */}
                    <div className="flex flex-col items-center">
                        {right.hand.map((t, i) => (
                            <div key={i} className="flex items-center justify-center -my-[7.5px] rotate-90 w-[32px] h-[44px]">
                                <MahjongTile tile={cheatMode ? t : undefined} size="sm" isHidden={!cheatMode} />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Melds */}
                {right.melds.length > 0 && (
                    <div className="mr-2 flex flex-col gap-2">
                        {right.melds.map((m, i) => <MeldGroup key={i} meld={m} side="right" />)}
                    </div>
                )}
                {cheatMode && <div className="mr-2"><CheatSummary hand={right.hand} /></div>}
            </div>

            {/* ===== SELF (Bottom) ===== */}
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex flex-col items-center w-full px-2 z-30">
                {/* Melds */}
                {self.melds.length > 0 && (
                    <div className="flex flex-row gap-2 mb-1">
                        {self.melds.map((m, i) => <MeldGroup key={i} meld={m} size="md" />)}
                    </div>
                )}

                {/* Hand */}
                <div className="flex flex-row gap-0.5 md:gap-1 items-end mb-1">
                    {/* Normal hand (sorted) */}
                    <div className="flex flex-row gap-0.5 md:gap-1 items-end">
                        {self.hand
                            .filter(t => t.id !== gameState.lastDrawnTileId)
                            .map((t, i) => (
                                <MahjongTile
                                    key={t.id || i}
                                    tile={t}
                                    size="md"
                                    isDangerous={checkIsDangerousTile(t)}
                                    onClick={() => {
                                        console.log('Tile clicked:', t.id, { canDiscard });
                                        if (canDiscard && onDiscard) onDiscard(t);
                                    }}
                                    className={`${canDiscard ? 'cursor-pointer hover:-translate-y-3 ring-1 ring-white/10' : 'cursor-default opacity-90'} transition-all duration-200 shadow-xl`}
                                />
                            ))
                        }
                    </div>

                    {/* Drawn tile (separated) */}
                    {self.hand.some(t => t.id === gameState.lastDrawnTileId) && (
                        <div className="ml-4 flex flex-row items-end">
                            {self.hand
                                .filter(t => t.id === gameState.lastDrawnTileId)
                                .map((t, i) => (
                                    <MahjongTile
                                        key={t.id || i}
                                        tile={t}
                                        size="md"
                                        isDangerous={checkIsDangerousTile(t)}
                                        onClick={() => {
                                            console.log('Drawn tile clicked:', t.id, { canDiscard });
                                            if (canDiscard && onDiscard) onDiscard(t);
                                        }}
                                        className={`${canDiscard ? 'cursor-pointer hover:-translate-y-3 ring-1 ring-white/10' : 'cursor-default opacity-90'} transition-all duration-200 shadow-xl`}
                                    />
                                ))
                            }
                        </div>
                    )}
                </div>

                <div className={`text-white text-sm font-bold px-4 py-0.5 rounded-full flex items-center gap-3 ${isMyTurn ? 'bg-yellow-600/80 animate-turn-blink' : 'bg-black/50'}`}>
                    <span>{self.name} {isMyTurn ? '(你的回合)' : isSpectator ? '(觀察中)' : ''}</span>
                    <span className={`px-2 rounded bg-black/40 ${self.score > 0 ? 'text-green-400' : self.score < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        目前累積: {self.score > 0 ? '+' : ''}{self.score || 0} 台
                    </span>
                </div>

                {/* Action Buttons */}
                {(() => {
                    const pendingAction = gameState.pendingAction;
                    if (!pendingAction) return null;
                    const canAct = pendingAction.targetPlayers.includes(currentUserId);
                    const myActions = pendingAction.actions.find(a => a.playerId === currentUserId);

                    if (canAct && myActions) {
                        return (
                            <div className="absolute bottom-44 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
                                {myActions.canHu && (
                                    <button onClick={onHu} className="bg-red-600 text-white px-5 py-2 rounded-full shadow-lg font-bold hover:bg-red-500 border-2 border-white ring-2 ring-red-400 animate-pulse text-lg">胡</button>
                                )}
                                {myActions.canKong && (
                                    <button onClick={onKong} className="bg-purple-600 text-white px-5 py-2 rounded-full shadow-lg font-bold hover:bg-purple-500 border-2 border-white ring-2 ring-purple-400">槓</button>
                                )}
                                {myActions.canPong && (
                                    <button onClick={onPong} className="bg-blue-600 text-white px-5 py-2 rounded-full shadow-lg font-bold hover:bg-blue-500 border-2 border-white ring-2 ring-blue-400">碰</button>
                                )}
                                {myActions.canChi && (
                                    <button onClick={onChi} className="bg-green-600 text-white px-5 py-2 rounded-full shadow-lg font-bold hover:bg-green-500 border-2 border-white ring-2 ring-green-400">吃</button>
                                )}
                                <button onClick={onSkip} className="bg-gray-600 text-white px-5 py-2 rounded-full shadow-lg font-bold hover:bg-gray-500 border-2 border-white ring-2 ring-gray-400">過</button>
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            <style>{`
                @keyframes turnBlink {
                    0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(234, 179, 8, 0.6); }
                    50% { opacity: 0.7; box-shadow: 0 0 16px rgba(234, 179, 8, 0.9); }
                }
                @keyframes pulseBorder {
                    0%, 100% { outline: 3px solid rgba(234, 179, 8, 1); outline-offset: 1px; }
                    50% { outline: 3px solid rgba(234, 179, 8, 0.2); outline-offset: 3px; }
                }
                @keyframes pulseLastDiscard {
                    0%, 100% { outline: 4px solid #eab308; outline-offset: 1px; box-shadow: 0 0 15px #eab308; }
                    50% { outline: 4px solid rgba(234, 179, 8, 0.3); outline-offset: 4px; box-shadow: 0 0 5px #eab308; }
                }
                .animate-turn-blink {
                    animation: turnBlink 1.2s ease-in-out infinite;
                }
                .animate-pulse-border {
                    animation: pulseBorder 1.5s ease-in-out infinite;
                }
                .animate-pulse-last-discard {
                    animation: pulseLastDiscard 1.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
