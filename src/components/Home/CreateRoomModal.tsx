
import React, { useState } from 'react';
import type { GameType } from '../../types';
import { GAME_CONFIGS } from '../../utils/gameConfig';

interface CreateRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (gameType: GameType, password?: string, allowSpectators?: boolean, fillWithBots?: boolean) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [gameType, setGameType] = useState<GameType>('chinese_dark_chess');
    const [password, setPassword] = useState('');
    const [allowSpectators, setAllowSpectators] = useState(true);
    const [fillWithBots, setFillWithBots] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate(gameType, password, allowSpectators, fillWithBots);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#f0e4d4] rounded-2xl shadow-2xl w-full max-w-md border-4 border-[#8b5a2b] p-6">
                <h2 className="text-2xl font-bold text-[#5c3a1e] mb-6 text-center">開設房間</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[#8b5a2b] font-bold mb-2">遊戲類型</label>
                        <select
                            value={gameType}
                            onChange={(e) => setGameType(e.target.value as GameType)}
                            className="w-full p-3 rounded-lg border-2 border-[#ccbfa8] bg-[#fff8f0] focus:border-[#8b5a2b] focus:outline-none text-[#5c3a1e]"
                        >
                            {Object.entries(GAME_CONFIGS).map(([key, config]) => (
                                <option key={key} value={key}>
                                    {config.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#8b5a2b] font-bold mb-2">房間密碼 (選填)</label>
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="留空則無需密碼"
                            className="w-full p-3 rounded-lg border-2 border-[#ccbfa8] bg-[#fff8f0] focus:border-[#8b5a2b] focus:outline-none text-[#5c3a1e]"
                        />
                    </div>

                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="allowSpectators"
                            checked={allowSpectators}
                            onChange={(e) => setAllowSpectators(e.target.checked)}
                            className="w-5 h-5 accent-[#8b5a2b]"
                        />
                        <label htmlFor="allowSpectators" className="text-[#5c3a1e] font-medium">允許自由觀戰</label>
                    </div>

                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            id="fillWithBots"
                            checked={fillWithBots}
                            onChange={(e) => setFillWithBots(e.target.checked)}
                            className="w-5 h-5 accent-[#8b5a2b]"
                        />
                        <label htmlFor="fillWithBots" className="text-[#5c3a1e] font-medium">人數不足由電腦補足</label>
                    </div>

                    <div className="pt-4 flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-[#e8d5c4] text-[#8b5a2b] rounded-xl font-bold hover:bg-[#dcc0a3] transition border border-[#dcc0a3]"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-gradient-to-r from-[#8b5a2b] to-[#6d4621] text-[#fff8f0] rounded-xl font-bold hover:shadow-lg transition transform active:scale-95"
                        >
                            建立房間
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
