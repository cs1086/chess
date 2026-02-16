import React from 'react';
import type { MahjongTile as MahjongTileType, MahjongSuit } from '../../types';

interface MahjongTileProps {
    tile?: MahjongTileType;
    isHidden?: boolean;
    isSelected?: boolean;
    isDangerous?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const numToChinese = (num: number) => {
    const map = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return map[num - 1] || num;
};

// Helper Component removed since all tiles are now text-based.

const getTileContent = (suit: MahjongSuit, value: number, size: string) => {
    const isSmall = size === 'sm';

    switch (suit) {
        case 'wan':
            return (
                <div className="flex flex-col items-center justify-center leading-none h-full py-0.5">
                    <span className="text-gray-800 font-serif font-black" style={{ fontSize: isSmall ? '12px' : '18px' }}>{numToChinese(value)}</span>
                    <span className="text-red-700 font-serif font-black" style={{ fontSize: isSmall ? '10px' : '14px' }}>萬</span>
                </div>
            );

        case 'tong':
            return (
                <div className="flex flex-col items-center justify-center leading-none h-full py-0.5">
                    <span className="text-gray-800 font-serif font-black" style={{ fontSize: isSmall ? '12px' : '18px' }}>{numToChinese(value)}</span>
                    <span className="text-blue-800 font-serif font-black" style={{ fontSize: isSmall ? '10px' : '14px' }}>筒</span>
                </div>
            );

        case 'tiao':
            return (
                <div className="flex flex-col items-center justify-center leading-none h-full py-0.5">
                    <span className="text-gray-800 font-serif font-black" style={{ fontSize: isSmall ? '12px' : '18px' }}>{numToChinese(value)}</span>
                    <span className="text-green-800 font-serif font-black" style={{ fontSize: isSmall ? '10px' : '14px' }}>條</span>
                </div>
            );

        case 'wind': {
            const winds = ['東', '南', '西', '北'];
            return <div className="text-gray-800 font-serif font-black" style={{ fontSize: isSmall ? '18px' : '26px' }}>{winds[value - 1]}</div>;
        }

        case 'dragon': {
            const dragons = ['中', '發', '白'];
            const colors = ['text-red-700', 'text-green-700', ''];
            if (value === 3) { // White
                return (
                    <div className={`border-2 border-blue-700 rounded ${isSmall ? 'w-5 h-7' : 'w-7 h-9'} flex items-center justify-center overflow-hidden`}>
                        <div className="w-full h-full border border-blue-700/30 m-0.5" />
                    </div>
                );
            }
            return <div className={`${colors[value - 1]} font-serif font-black`} style={{ fontSize: isSmall ? '18px' : '26px' }}>{dragons[value - 1]}</div>;
        }
        default: return null;
    }
};

export const MahjongTile: React.FC<MahjongTileProps> = ({ tile, isHidden, isSelected, isDangerous, onClick, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-8 h-11',
        md: 'w-10 h-14',
        lg: 'w-14 h-20'
    };

    return (
        <div
            className={`
                relative flex items-center justify-center rounded-[4px] select-none cursor-pointer transition-all duration-100 box-border group
                ${sizeClasses[size]}
                ${isSelected ? 'transform -translate-y-4 shadow-[0_15px_30px_rgba(0,0,0,0.4)] z-50' : 'hover:-translate-y-1 shadow-md hover:shadow-xl'}
                ${className}
            `}
            onClick={onClick}
        >
            {/* 3D Depth side (The Green Part of a Green-Back Tile) - ALWAYS BEHIND */}
            {!isHidden && (
                <>
                    <div className="absolute inset-0 translate-y-[3px] translate-x-[2px] bg-emerald-900 rounded-[4px] -z-20 shadow-sm" />
                    <div className="absolute -bottom-[4px] -right-[3px] w-full h-full bg-emerald-800 rounded-[4px] -z-30 shadow-xl border-b-[1px] border-r-[1px] border-black/40" />

                    {/* The Actual White Face Layer - Explicitly on top of the green */}
                    <div className="absolute inset-0 bg-white border-t border-l border-white rounded-[4px] -z-10 shadow-[0_2px_5px_rgba(0,0,0,0.1)]" />
                </>
            )}

            {/* Hidden Tile Background */}
            {isHidden && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 border border-emerald-950 rounded-[4px] shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]" />
            )}

            {/* Danger Indicator (Pulse Red Ring) */}
            {isDangerous && !isHidden && (
                <div className="absolute inset-0 border-[3px] border-red-500 rounded-[4px] z-50 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6),inset_0_0_8px_rgba(239,68,68,0.4)] pointer-events-none" />
            )}

            {/* Front Polish Shine */}
            {!isHidden && (
                <div className="absolute top-0.5 left-0.5 right-0.5 h-1/3 bg-gradient-to-b from-gray-100/50 to-transparent rounded-t-[3px] pointer-events-none z-20" />
            )}

            {!isHidden && tile ? (
                <div className={`flex flex-col items-center justify-center w-full h-full p-1 z-10 transition-transform overflow-hidden ${isSelected ? 'scale-105' : 'group-hover:scale-102'}`}>
                    <div className="drop-shadow-[0_0.5px_0.5px_rgba(0,0,0,0.15)] w-full h-full flex items-center justify-center">
                        {getTileContent(tile.suit, tile.value, size)}
                    </div>
                </div>
            ) : isHidden ? (
                <div className="w-full h-full rounded-[4px] bg-emerald-800/20 flex items-center justify-center overflow-hidden z-20">
                    <div className="w-[120%] h-[20%] bg-emerald-600/10 rotate-45 transform" />
                    <div className="absolute inset-2 border border-emerald-400/20 rounded-sm" />
                </div>
            ) : null}
        </div>
    );
};
