import React, { useState, useEffect } from 'react';

interface DiceRollingOverlayProps {
    dice: number[];
    onComplete: () => void;
}

export const DiceRollingOverlay: React.FC<DiceRollingOverlayProps> = ({ dice = [1, 2, 3], onComplete }) => {
    const [rolling, setRolling] = useState(true);
    const [displayDice, setDisplayDice] = useState([1, 1, 1]);

    useEffect(() => {
        // Roll animation
        const interval = setInterval(() => {
            setDisplayDice([
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ]);
        }, 100);

        const timer = setTimeout(() => {
            clearInterval(interval);
            setRolling(false);
            setDisplayDice(dice);

            // Wait a bit before completing
            setTimeout(onComplete, 1500);
        }, 1200);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [dice, onComplete]);

    const renderDice = (val: number, index: number) => {
        const dots = [
            [], // 0
            [4], // 1
            [0, 8], // 2
            [0, 4, 8], // 3
            [0, 2, 6, 8], // 4
            [0, 2, 4, 6, 8], // 5
            [0, 2, 3, 5, 6, 8], // 6
        ];

        return (
            <div
                key={index}
                className={`
                    w-16 h-16 md:w-24 md:h-24 bg-white rounded-xl shadow-[0_10px_0_#ddd,0_15px_20px_rgba(0,0,0,0.3)] 
                    flex items-center justify-center p-2 md:p-4 relative
                    ${rolling ? 'animate-bounce' : 'transform translate-y-[5px] shadow-[0_5px_0_#ddd,0_10px_10px_rgba(0,0,0,0.2)]'}
                    transition-all duration-300
                `}
                style={{
                    animationDelay: `${index * 0.1}s`,
                    animationDuration: '0.4s'
                }}
            >
                <div className="grid grid-cols-3 grid-rows-3 w-full h-full gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="flex items-center justify-center">
                            {dots[val].includes(i) && (
                                <div className={`
                                    w-2 h-2 md:w-4 md:h-4 rounded-full 
                                    ${val === 1 || val === 4 ? 'bg-red-600' : 'bg-gray-900'}
                                    shadow-inner
                                `} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="mb-8 text-white text-2xl md:text-4xl font-black tracking-widest uppercase italic bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-lg">
                {rolling ? '正在擲骰子...' : `點數: ${displayDice.reduce((a, b) => a + b, 0)}`}
            </div>

            <div className="flex gap-4 md:gap-8 items-center justify-center">
                {displayDice.map((v, i) => renderDice(v, i))}
            </div>

            <div className="mt-12 text-yellow-500/50 text-sm animate-pulse">
                正宗台灣麻將 - 莊家開局
            </div>
        </div>
    );
};
