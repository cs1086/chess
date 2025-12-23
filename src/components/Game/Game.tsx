import React, { useState, useEffect } from 'react';
import type { GameState, PieceColor } from '../../types';
import { Board } from '../Board/Board';
import { Piece } from '../Piece/Piece';
import { Timer, Flag, RefreshCw, Users } from 'lucide-react';
import { sortCapturedPieces } from '../../utils/gameLogic';

interface GameProps {
    gameState: GameState;
    currentUserId: string;
    onMove: (from: number, to: number) => void;
    onFlip: (index: number) => void;
    onSurrender: () => void;
    onRematch: () => void;
    onExit: () => void;
}

export const Game: React.FC<GameProps> = ({
    gameState,
    currentUserId,
    onMove,
    onFlip,
    onSurrender,
    onRematch,
    onExit,
}) => {
    const [selectedPos, setSelectedPos] = useState<number | null>(null);
    const [cheatMode, setCheatMode] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);

    const isRed = gameState.players.red?.id === currentUserId;
    const isBlack = gameState.players.black?.id === currentUserId;
    const isSpectator = !isRed && !isBlack;
    const playerColor: PieceColor | null = isRed ? 'red' : (isBlack ? 'black' : null);
    const isMyTurn = !isSpectator && gameState.currentPlayer === playerColor && gameState.gameStatus === 'playing';

    const isTimerEnabled = import.meta.env.VITE_ENABLE_TIMER === 'true';

    // Timer logic
    useEffect(() => {
        if (!isTimerEnabled || gameState.gameStatus !== 'playing') return;

        const startTime = gameState.turnStartTime || Date.now();
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, 30 - elapsed);
            setTimeLeft(remaining);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [gameState.currentPlayer, gameState.turnStartTime, gameState.gameStatus, isTimerEnabled]);

    const handleSquareClick = (index: number) => {
        if (!isMyTurn || isSpectator) return;

        const piece = gameState.board[index];

        if (selectedPos === null) {
            if (piece) {
                if (!piece.isFlipped) {
                    onFlip(index);
                } else if (piece.color === playerColor) {
                    setSelectedPos(index);
                }
            }
        } else {
            if (selectedPos === index) {
                setSelectedPos(null);
            } else if (piece && piece.isFlipped && piece.color === playerColor) {
                // 如果點選了自己的另一個棋子，直接切換選取
                setSelectedPos(index);
            } else {
                // 如果是空位或對手棋子，嘗試移動/吃子
                const selectedPiece = gameState.board[selectedPos];
                if (selectedPiece) {
                    onMove(selectedPos, index);
                    setSelectedPos(null);
                }
            }
        }
    };

    const getPlayerDisplay = (color: PieceColor) => {
        const player = gameState.players[color];
        const isCurrent = gameState.currentPlayer === color;
        return (
            <div className={`flex flex-col items-center p-3 rounded-xl transition-all border-2 ${isCurrent ? 'bg-orange-600/20 border-orange-500 scale-105 shadow-lg shadow-orange-900/20' : 'bg-gray-800/40 border-transparent opacity-60'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 ${color === 'red' ? 'bg-red-600' : 'bg-gray-950 text-white'}`}>
                    {player?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-xs font-bold truncate max-w-[80px]">{player?.name || '等待中...'}</span>
                {isTimerEnabled && isCurrent && gameState.gameStatus === 'playing' && (
                    <div className="flex items-center gap-1 text-[10px] text-orange-400 mt-1 font-mono">
                        <Timer size={10} />
                        {timeLeft}s
                    </div>
                )}
            </div>
        );
    };

    const CapturedList = ({ color, title }: { color: 'red' | 'black', title: string }) => {
        const pieces = sortCapturedPieces(Object.values(gameState.capturedPieces?.[color] || {}));
        return (
            <div className="flex flex-col gap-2 w-12 md:w-16 min-h-[300px] bg-black/20 rounded-xl p-2 items-center border border-white/5 shadow-inner">
                {/* 標題改為白色且更明顯 */}
                <span className="text-[12px] text-white/80 font-serif vertical-text mb-2 uppercase tracking-[0.2em]">{title}</span>
                <div className="flex flex-col gap-1 w-full items-center">
                    {pieces.map((piece, i) => (
                        <div key={`${color}-cap-${i}`} className="w-8 h-8 md:w-11 md:h-11 opacity-95 hover:scale-110 transition-transform">
                            {/* 使用 captured variant 縮小文字 */}
                            <Piece piece={{ ...piece, isFlipped: true }} variant="captured" />
                        </div>
                    ))}
                    {pieces.length === 0 && (
                        <div className="flex flex-col items-center gap-1 opacity-10 mt-4">
                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-500" />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const SpectatorList = () => {
        const spectators = gameState.spectators || [];
        return (
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 w-full mt-4">
                <div className="flex items-center gap-2 mb-3 text-orange-500/80">
                    <Users size={18} />
                    <span className="font-bold text-sm tracking-widest">觀眾席 ({spectators.length})</span>
                </div>
                <div className="flex flex-wrap gap-3">
                    {spectators.map(s => (
                        <div key={s.id} className="flex items-center gap-2 bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-700/50 shadow-sm">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/20">
                                {s.name && s.name.length > 0 ? s.name[0].toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-200">{s.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono">W:{s.wins} L:{s.losses}</span>
                            </div>
                        </div>
                    ))}
                    {spectators.length === 0 && (
                        <span className="text-xs text-gray-600 italic py-2">目前尚無觀眾...</span>
                    )}
                </div>
            </div>
        );
    };

    const opponentColor = playerColor === 'red' ? 'black' : 'red';
    const myColor = playerColor || 'red';

    return (
        <div className="min-h-screen bg-[#1a120b] text-[#e8d5c4] flex flex-col items-center p-4 md:p-8 animate-in fade-in duration-500">
            {/* Title with secret toggle */}
            <div className="mb-6 text-center select-none">
                <h1 className="text-4xl md:text-5xl font-serif tracking-[0.5em] font-black text-orange-900/40 flex justify-center items-center gap-2">
                    <span>楚</span>
                    <span>河</span>
                    <span
                        onClick={() => setCheatMode(!cheatMode)}
                        className="cursor-default"
                    >
                        漢
                    </span>
                    <span>界</span>
                </h1>
                <div className="h-0.5 w-64 bg-gradient-to-r from-transparent via-orange-900/30 to-transparent mt-2" />
            </div>

            <div className="w-full max-w-lg md:max-w-6xl flex flex-col gap-4 md:gap-6">
                {/* Info Bar */}
                <div className="flex justify-between items-center px-4 max-w-4xl mx-auto w-full">
                    {getPlayerDisplay(opponentColor)}
                    <div className="text-gray-600 italic text-sm font-serif">VS</div>
                    {getPlayerDisplay(myColor)}
                </div>

                {/* Main Content Area (Captured - Board - Captured) */}
                <div className="flex flex-row items-start justify-center gap-2 md:gap-6 w-full">
                    {/* Left: Opponent's captured pieces */}
                    <div className="hidden sm:block">
                        <CapturedList color={opponentColor} title="俘虜" />
                    </div>

                    {/* Middle: Board */}
                    <div className="flex flex-col gap-4 flex-1 max-w-[800px]">
                        <div className="relative">
                            <Board
                                board={gameState.board}
                                selectedPosition={selectedPos}
                                onSquareClick={handleSquareClick}
                                cheatMode={cheatMode}
                            />

                            {/* Game Over Overlay */}
                            {gameState.gameStatus === 'ended' && (
                                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
                                    <div className="text-4xl md:text-6xl font-black mb-4 tracking-widest uppercase italic text-orange-500 drop-shadow-2xl">
                                        {isSpectator
                                            ? `${gameState.winner === 'red' ? '紅方' : '黑方'} 獲勝!`
                                            : (gameState.winner === playerColor ? '獲勝!' : '敗北!')
                                        }
                                    </div>
                                    <p className="text-gray-400 mb-8 font-serif">勝敗乃兵家常事，少俠請重新來過。</p>

                                    <div className="flex flex-col gap-3 w-full max-w-[200px]">
                                        {!isSpectator && !gameState.rematch?.[myColor] ? (
                                            <button
                                                onClick={onRematch}
                                                className="w-full py-4 bg-red-700 hover:bg-red-600 text-white rounded-2xl font-bold transition-all transform active:scale-95 shadow-xl shadow-red-900/40 border border-red-500/30 flex items-center justify-center gap-2"
                                            >
                                                <RefreshCw size={20} />
                                                再戰一局
                                            </button>
                                        ) : !isSpectator ? (
                                            <div className="w-full py-4 bg-orange-900/20 text-orange-400 rounded-2xl font-bold border border-orange-900/50 animate-pulse text-center">
                                                等待對手...
                                            </div>
                                        ) : null}
                                        <button
                                            onClick={onExit}
                                            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl font-medium transition-all"
                                        >
                                            回聊天室
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile Captured View (Horizontal) */}
                        <div className="sm:hidden flex flex-col gap-2">
                            <div className="flex flex-col bg-black/20 rounded-xl p-2 border border-white/5">
                                <span className="text-[10px] text-white/50 mb-1">對手俘虜</span>
                                <div className="flex flex-wrap gap-1">
                                    {sortCapturedPieces(Object.values(gameState.capturedPieces?.[opponentColor] || {})).map((piece, i) => (
                                        <div key={`mob-opp-${i}`} className="w-8 h-8 opacity-95">
                                            <Piece piece={{ ...piece, isFlipped: true }} variant="captured" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col bg-black/20 rounded-xl p-2 border border-white/5">
                                <span className="text-[10px] text-white/50 mb-1">我方俘虜</span>
                                <div className="flex flex-wrap gap-1">
                                    {sortCapturedPieces(Object.values(gameState.capturedPieces?.[myColor] || {})).map((piece, i) => (
                                        <div key={`mob-me-${i}`} className="w-8 h-8 opacity-95">
                                            <Piece piece={{ ...piece, isFlipped: true }} variant="captured" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-between items-center gap-4 px-2">
                            <button
                                onClick={isSpectator ? onExit : onSurrender}
                                disabled={!isSpectator && gameState.gameStatus !== 'playing'}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all disabled:opacity-30 border border-gray-800 shrink-0"
                            >
                                <Flag size={18} />
                                {isSpectator ? '退出觀戰' : '投降'}
                            </button>

                            <div className="flex-1 text-center">
                                {isMyTurn ? (
                                    <span className="text-orange-500 font-bold animate-pulse text-sm">輪到你了!</span>
                                ) : gameState.gameStatus === 'playing' ? (
                                    <span className="text-white/60 text-sm animate-pulse">對手思考中...</span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Right: My captured pieces */}
                    <div className="hidden sm:block">
                        <CapturedList color={myColor} title="俘虜" />
                    </div>
                </div>

                {/* Spectator List at the bottom */}
                <SpectatorList />
            </div>
        </div>
    );
};
