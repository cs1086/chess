import React from 'react';
import type { Piece as PieceType } from '../../types';
import { PIECE_NAMES_RED, PIECE_NAMES_BLACK } from '../../utils/gameLogic';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PieceProps {
    piece: PieceType | null;
    selected?: boolean;
    onClick?: () => void;
    cheatMode?: boolean;
    variant?: 'board' | 'captured';
}

export const Piece: React.FC<PieceProps> = ({ piece, selected, onClick, cheatMode, variant = 'board' }) => {
    if (!piece) return <div className="w-full h-full" onClick={onClick} />;

    const isRed = piece.color === 'red';
    const name = isRed ? PIECE_NAMES_RED[piece.type] : PIECE_NAMES_BLACK[piece.type];

    // Cheat mode UI distinction
    const isCheatVisible = cheatMode && !piece.isFlipped;
    const isHidden = !piece.isFlipped && !cheatMode;

    const isCaptured = variant === 'captured';

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative w-[90%] h-[90%] rounded-full cursor-pointer transition-all duration-300 transform select-none",
                "flex items-center justify-center font-bold",
                // Responsive sizing for board vs captured
                isCaptured
                    ? "text-xl md:text-2xl"
                    : "text-3xl md:text-5xl",
                "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.2)] active:scale-95",
                // Flipped state (Wood Texture)
                piece.isFlipped
                    ? (isRed
                        ? "bg-gradient-to-br from-amber-50 to-orange-100 text-red-700 border-[3px] border-amber-900 shadow-inner"
                        : "bg-gradient-to-br from-amber-50 to-orange-100 text-gray-900 border-[3px] border-amber-900 shadow-inner")
                    : "bg-gradient-to-br from-orange-800 to-amber-950 border-[3px] border-amber-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]",
                // Selected state
                selected && "ring-4 ring-yellow-500 scale-110 z-10 brightness-110",
                // Cheat mode distinction - subtly dim the piece but keep original color
                isCheatVisible && "brightness-[0.8]"
            )}
        >
            {/* Wooden Grain Effect for flipped pieces */}
            {piece.isFlipped && (
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.05)_100%)] pointer-events-none" />
            )}

            {!isHidden && (
                <span className={cn(
                    "transition-all duration-500",
                    isCheatVisible
                        ? (isRed ? "text-red-500/20 blur-[0.5px]" : "text-amber-100/10 blur-[0.5px]")
                        : "drop-shadow-[1px_1px_0px_rgba(255,255,255,0.4)]"
                )}>
                    {name}
                </span>
            )}

            {/* Back design for unflipped pieces */}
            {!piece.isFlipped && !cheatMode && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                        "border-2 border-amber-700/50 rounded-full",
                        isCaptured ? "w-6 h-6" : "w-8 h-8 md:w-10 md:h-10"
                    )} />
                    <div className={cn(
                        "absolute border border-amber-700/30 rounded-full",
                        isCaptured ? "w-3 h-3" : "absolute w-4 h-4 md:w-6 md:h-6"
                    )} />
                </div>
            )}
        </div>
    );
};
