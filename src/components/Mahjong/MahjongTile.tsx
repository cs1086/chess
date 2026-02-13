import React from 'react';
import type { MahjongTile as MahjongTileType, MahjongSuit } from '../../types';

interface MahjongTileProps {
    tile?: MahjongTileType;
    isHidden?: boolean;
    isSelected?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const numToChinese = (num: number) => {
    const map = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return map[num - 1] || num;
};

const getTileContent = (suit: MahjongSuit, value: number) => {
    switch (suit) {
        case 'wan':
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-red-600 font-bold text-lg">{numToChinese(value)}</span>
                    <span className="text-red-600 font-bold text-sm">萬</span>
                </div>
            );
        case 'tong':
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center text-white text-[10px] my-auto">
                        {/* Simplified representation for dots */}
                    </div>
                    <span className="text-blue-600 font-bold text-xs">{value}筒</span>
                </div>
            );
        case 'tiao':
            return (
                <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-green-600 font-bold text-lg">{value === 1 ? '鳥' : value}</span>
                    <span className="text-green-600 font-bold text-sm">索</span>
                </div>
            );
        case 'wind':
            const winds = ['東', '南', '西', '北'];
            return <div className="text-black font-bold text-2xl">{winds[value - 1]}</div>;
        case 'dragon':
            const dragons = ['中', '發', '白'];
            const colors = ['text-red-600', 'text-green-600', 'text-blue-600 border border-blue-600 rounded px-0.5']; // White dragon is blank or box
            return <div className={`${colors[value - 1]} font-bold text-2xl ${value === 3 ? 'text-transparent border-2 border-blue-400 w-6 h-8' : ''}`}>{dragons[value - 1]}</div>;
        default: return null;
    }
};

export const MahjongTile: React.FC<MahjongTileProps> = ({ tile, isHidden, isSelected, onClick, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-8 h-11 text-xs',
        md: 'w-10 h-14 text-sm',
        lg: 'w-14 h-20 text-lg'
    };

    return (
        <div
            className={`
                relative flex items-center justify-center bg-[#fdfdfd] border-b-4 border-r-2 border-gray-300 rounded shadow-md select-none cursor-pointer transition-transform duration-100 box-border
                ${sizeClasses[size]}
                ${isSelected ? 'transform -translate-y-3 ring-2 ring-yellow-400 z-10' : 'hover:-translate-y-1'}
                ${isHidden ? 'bg-gradient-to-br from-green-600 to-green-800 border-green-900' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {!isHidden && tile ? (
                <div className="flex flex-col items-center justify-center w-full h-full p-0.5">
                    {getTileContent(tile.suit, tile.value)}
                </div>
            ) : isHidden ? (
                <div className="w-full h-full rounded-[1px] opacity-10" />
            ) : null}
        </div>
    );
};
