import React from 'react';
import type { Piece as PieceType } from '../../types';
import { Piece } from '../Piece/Piece';

interface BoardProps {
    board: (PieceType | null)[];
    selectedPosition: number | null;
    onSquareClick: (index: number) => void;
    cheatMode: boolean;
}

export const Board: React.FC<BoardProps> = ({ board, selectedPosition, onSquareClick, cheatMode }) => {
    const handleDragStart = (e: React.DragEvent, index: number) => {
        const piece = board[index];
        if (!piece || !piece.isFlipped) {
            e.preventDefault();
            return;
        }

        // 僅拖曳圓形棋子部分，不連同正方形格子一起移動
        const target = e.currentTarget as HTMLElement;
        const pieceEl = target.querySelector('.rounded-full') as HTMLElement;
        if (pieceEl) {
            // 設置拖曳影像為棋子本身，並置左上偏移使滑鼠位於中心
            e.dataTransfer.setDragImage(pieceEl, pieceEl.offsetWidth / 2, pieceEl.offsetHeight / 2);
        }

        e.dataTransfer.setData('text/plain', index.toString());
        // Select the piece being dragged
        onSquareClick(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            onSquareClick(toIndex);
        }
    };

    return (
        <div className="grid grid-cols-8 gap-0 p-2 md:p-3 bg-[#e8d5c4] rounded-xl border-4 border-amber-900/20 shadow-2xl relative select-none">
            {Array.from({ length: 32 }).map((_, index) => {
                const piece = board[index];
                return (
                    <div
                        key={index}
                        className={`aspect-square flex items-center justify-center relative border border-amber-900/10 ${(Math.floor(index / 8) + index) % 2 === 0
                            ? 'bg-[#f4e4bc]'
                            : 'bg-[#eddec0]'
                            }`}
                        onClick={() => onSquareClick(index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                    >
                        <div
                            draggable={piece?.isFlipped}
                            onDragStart={(e) => handleDragStart(e, index)}
                            className="w-full h-full flex items-center justify-center"
                        >
                            <Piece
                                piece={piece}
                                selected={selectedPosition === index}
                                cheatMode={cheatMode}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
