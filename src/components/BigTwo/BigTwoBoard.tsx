import React, { useState, useMemo } from 'react';
import type { BigTwoGameState, BigTwoCard as BigTwoCardType } from '../../types';
import { BigTwoCardComponent } from './BigTwoCard';
import { detectHandType, SUIT_SYMBOLS, RANK_NAMES, sortHand } from '../../utils/bigTwoLogic';

interface BigTwoBoardProps {
    gameState: BigTwoGameState;
    currentUserId: string;
    onPlayCards: (cardIds: string[]) => void;
    onPass: () => void;
}

const HAND_TYPE_NAMES: Record<string, string> = {
    single: '單張',
    pair: '對子',
    triple: '三條',
    straight: '順子',
    full_house: '葫蘆',
    four_of_a_kind: '鐵支',
    straight_flush: '同花順'
};

export const BigTwoBoard: React.FC<BigTwoBoardProps> = ({
    gameState, currentUserId, onPlayCards, onPass
}) => {
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

    // Find self and opponents
    const selfIndex = gameState.players.findIndex(p => p.id === currentUserId);
    const viewIndex = selfIndex === -1 ? 0 : selfIndex;

    const getPlayer = (offset: number) => {
        const index = (viewIndex + offset) % gameState.players.length;
        const p = gameState.players[index];
        if (!p) return { id: '', name: '?', hand: [], cardCount: 0 };
        return {
            ...p,
            hand: p.hand || [],
            cardCount: p.cardCount ?? (p.hand || []).length
        };
    };

    const selfRaw = getPlayer(0);
    // Sort hand for display: rank ascending (3→K→A→2), suit: clubs→diamonds→hearts→spades
    const self = useMemo(() => ({
        ...selfRaw,
        hand: sortHand(selfRaw.hand)
    }), [selfRaw]);
    const playerCount = gameState.players.length;

    // For 4 players: right=1, top=2, left=3
    // For 3 players: right=1, left=2
    const opponents = [];
    for (let i = 1; i < playerCount; i++) {
        opponents.push(getPlayer(i));
    }

    const isMyTurn = gameState.currentTurn === currentUserId;
    const isNewRound = gameState.consecutivePasses >= (playerCount - 1) || !gameState.lastPlay;
    const isFirstPlay = !gameState.lastPlay && !gameState.roundStarter;

    // Toggle card selection
    const toggleCard = (cardId: string) => {
        if (!isMyTurn) return;
        setSelectedCardIds(prev => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
    };

    // Get selected cards
    const selectedCards = useMemo(() =>
        self.hand.filter(c => selectedCardIds.has(c.id)),
        [self.hand, selectedCardIds]
    );

    // Preview hand type
    const previewHandType = useMemo(() => {
        if (selectedCards.length === 0) return null;
        return detectHandType(selectedCards);
    }, [selectedCards]);

    const handlePlay = () => {
        if (selectedCards.length === 0) return;
        onPlayCards(Array.from(selectedCardIds));
        setSelectedCardIds(new Set());
    };

    const handlePass = () => {
        onPass();
        setSelectedCardIds(new Set());
    };

    const formatCard = (card: BigTwoCardType) =>
        `${SUIT_SYMBOLS[card.suit]}${RANK_NAMES[card.rank]}`;

    // Find the current turn player name
    const currentTurnPlayer = gameState.players.find(p => p.id === gameState.currentTurn);

    return (
        <div className="w-full flex flex-col items-center select-none">
            {/* Game Table */}
            <div className="relative w-full max-w-4xl min-h-[650px] md:min-h-[750px] bg-gradient-to-b from-[#1a6b1a] to-[#0d4d0d] rounded-3xl shadow-2xl border-8 border-[#3e2723]">

                {/* Felt texture overlay */}
                <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')]" />

                {/* Top opponents */}
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-8">
                    {playerCount === 4 && (
                        <>
                            {/* Left indicator */}
                            <OpponentSlot
                                player={opponents[2]}
                                position="left"
                                isCurrentTurn={gameState.currentTurn === opponents[2]?.id}
                            />
                            {/* Top */}
                            <OpponentSlot
                                player={opponents[1]}
                                position="top"
                                isCurrentTurn={gameState.currentTurn === opponents[1]?.id}
                            />
                            {/* Right */}
                            <OpponentSlot
                                player={opponents[0]}
                                position="right"
                                isCurrentTurn={gameState.currentTurn === opponents[0]?.id}
                            />
                        </>
                    )}
                    {playerCount === 3 && (
                        <>
                            <OpponentSlot
                                player={opponents[1]}
                                position="left"
                                isCurrentTurn={gameState.currentTurn === opponents[1]?.id}
                            />
                            <OpponentSlot
                                player={opponents[0]}
                                position="right"
                                isCurrentTurn={gameState.currentTurn === opponents[0]?.id}
                            />
                        </>
                    )}
                </div>

                {/* Center Play Area */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    {/* Last play info */}
                    <div className="mb-2 text-center">
                        {gameState.lastPlay ? (
                            <div className="text-yellow-300/80 text-xs font-medium">
                                {gameState.players.find(p => p.id === gameState.lastPlayerId)?.name} 出了
                                <span className="text-yellow-200 ml-1">
                                    {HAND_TYPE_NAMES[gameState.lastPlay.handType] || gameState.lastPlay.handType}
                                </span>
                            </div>
                        ) : (
                            <div className="text-green-300/60 text-xs">新一輪</div>
                        )}
                    </div>

                    {/* Center cards */}
                    <div className="flex gap-1 md:gap-2 min-h-[80px] items-center">
                        {gameState.centerCards && gameState.centerCards.length > 0 ? (
                            gameState.centerCards.map((card, i) => (
                                <BigTwoCardComponent key={card.id || i} card={card} size="md" />
                            ))
                        ) : (
                            <div className="text-white/20 text-lg font-light italic">
                                {isNewRound ? '自由出牌' : '等待出牌...'}
                            </div>
                        )}
                    </div>

                    {/* Turn indicator */}
                    <div className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg
                        ${isMyTurn
                            ? 'bg-yellow-500 text-black animate-pulse'
                            : 'bg-black/40 text-white/70'
                        }`}
                    >
                        {isMyTurn ? '✨ 你的回合' : `⏳ ${currentTurnPlayer?.name || '...'} 的回合`}
                    </div>
                </div>

                {/* Selected cards preview */}
                {selectedCards.length > 0 && (
                    <div className="absolute bottom-36 left-1/2 transform -translate-x-1/2 z-20">
                        <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/10">
                            <span className="text-white/60 text-xs">
                                已選 {selectedCards.length} 張：
                            </span>
                            <span className="text-white text-sm ml-1 font-medium">
                                {selectedCards.map(formatCard).join(' ')}
                            </span>
                            {previewHandType && (
                                <span className="text-green-400 text-xs ml-2 font-bold">
                                    ({HAND_TYPE_NAMES[previewHandType]})
                                </span>
                            )}
                            {previewHandType === null && selectedCards.length > 0 && (
                                <span className="text-red-400 text-xs ml-2">
                                    (不合法牌型)
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Self hand */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center w-full px-4">
                    {/* Player info */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`} />
                        <span className="text-white text-sm font-medium">{self.name}</span>
                        <span className="text-white/40 text-xs">({self.hand.length} 張)</span>
                    </div>

                    {/* Hand cards */}
                    <div className="flex flex-wrap justify-center gap-0.5 md:gap-1 items-end mb-3 max-w-full">
                        {self.hand.map((card) => (
                            <BigTwoCardComponent
                                key={card.id}
                                card={card}
                                size="md"
                                isSelected={selectedCardIds.has(card.id)}
                                onClick={() => toggleCard(card.id)}
                            />
                        ))}
                    </div>

                    {/* Action buttons */}
                    {isMyTurn && (
                        <div className="flex gap-3">
                            <button
                                onClick={handlePlay}
                                disabled={selectedCards.length === 0 || !previewHandType}
                                className={`
                                    px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg transition transform active:scale-95
                                    ${selectedCards.length > 0 && previewHandType
                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:brightness-110'
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                出牌
                            </button>
                            {!isFirstPlay && (
                                <button
                                    onClick={handlePass}
                                    disabled={isNewRound && isFirstPlay}
                                    className="px-8 py-2.5 rounded-xl font-bold text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 transition transform active:scale-95 shadow-lg border border-gray-600"
                                >
                                    Pass
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Opponent Slot Component ---

interface OpponentSlotProps {
    player: { id: string; name: string; hand: any[]; cardCount: number };
    position: 'left' | 'top' | 'right';
    isCurrentTurn: boolean;
}

const OpponentSlot: React.FC<OpponentSlotProps> = ({ player, isCurrentTurn }) => {
    if (!player) return null;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className={`
                flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${isCurrentTurn
                    ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 shadow-lg shadow-yellow-500/20'
                    : 'bg-black/30 text-white/70 border border-white/10'
                }
            `}>
                {isCurrentTurn && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                <span>{player.name}</span>
                <span className="text-white/40">({player.cardCount} 張)</span>
            </div>
            {/* Mini hidden cards */}
            <div className="flex gap-px mt-1">
                {Array.from({ length: Math.min(player.cardCount, 13) }).map((_, i) => (
                    <div
                        key={i}
                        className="w-2 h-3 rounded-[1px] bg-gradient-to-b from-blue-600 to-blue-900 border border-blue-500/30"
                    />
                ))}
            </div>
        </div>
    );
};
