import React from 'react';
import type { BigTwoCard as BigTwoCardType } from '../../types';
import { RANK_NAMES, SUIT_SYMBOLS } from '../../utils/bigTwoLogic';

interface BigTwoCardProps {
    card?: BigTwoCardType;
    isHidden?: boolean;
    isSelected?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'w-8 h-12 text-[10px]',
    md: 'w-12 h-[72px] text-sm',
    lg: 'w-16 h-24 text-base'
};

export const BigTwoCardComponent: React.FC<BigTwoCardProps> = ({
    card, isHidden, isSelected, onClick, size = 'md', className = ''
}) => {
    if (isHidden) {
        return (
            <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-lg flex items-center justify-center ${className}`}>
                <div className="w-[60%] h-[70%] rounded border border-blue-400/30 bg-blue-900/50 flex items-center justify-center">
                    <span className="text-blue-300/50 text-lg font-bold">♠</span>
                </div>
            </div>
        );
    }

    if (!card) return null;

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const suitSymbol = SUIT_SYMBOLS[card.suit];
    const rankName = RANK_NAMES[card.rank];

    return (
        <div
            onClick={onClick}
            className={`
                ${sizeClasses[size]} rounded-lg border-2 shadow-lg cursor-pointer
                flex flex-col items-center justify-between p-1
                transition-all duration-200 select-none relative
                ${isSelected
                    ? 'border-yellow-400 bg-gradient-to-b from-yellow-50 to-white -translate-y-3 ring-2 ring-yellow-300 shadow-yellow-200/50 shadow-xl'
                    : 'border-gray-300 bg-gradient-to-b from-white to-gray-50 hover:-translate-y-1 hover:shadow-xl'
                }
                ${className}
            `}
        >
            {/* Top-left rank + suit */}
            <div className={`self-start leading-none ${isRed ? 'text-red-600' : 'text-gray-800'}`}>
                <div className="font-bold">{rankName}</div>
                <div className="-mt-0.5">{suitSymbol}</div>
            </div>

            {/* Center suit */}
            <div className={`text-2xl ${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'} ${isRed ? 'text-red-500' : 'text-gray-700'}`}>
                {suitSymbol}
            </div>

            {/* Bottom-right rank + suit (inverted) */}
            <div className={`self-end leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-800'}`}>
                <div className="font-bold">{rankName}</div>
                <div className="-mt-0.5">{suitSymbol}</div>
            </div>
        </div>
    );
};
