import React, { useState } from 'react';

interface AuthProps {
    onLogin: (id: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [userId, setUserId] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Allow Chinese characters (\u4e00-\u9fa5), letters, and numbers
        const validIdPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
        if (!userId.trim()) {
            setError('ID 不能為空');
            return;
        }
        if (!validIdPattern.test(userId)) {
            setError('ID 只能包含中文、英文、數字、下劃線或連字號');
            return;
        }
        onLogin(userId);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="w-full max-w-md p-8 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
                <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-red-500 to-black bg-clip-text text-transparent">
                    暗棋對戰
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="userId" className="block text-sm font-medium text-gray-400 mb-2">
                            輸入您的玩家 ID
                        </label>
                        <input
                            type="text"
                            id="userId"
                            value={userId}
                            onChange={(e) => {
                                setUserId(e.target.value);
                                setError('');
                            }}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-white transition-all"
                            placeholder="例如: player123"
                            maxLength={15}
                        />
                        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transform active:scale-95 transition-all shadow-lg shadow-red-900/40"
                    >
                        開始遊戲
                    </button>
                </form>

                <div className="mt-8 text-center text-gray-500 text-sm">
                    您的 ID 將會儲存在此瀏覽器中
                </div>
            </div>
        </div>
    );
};
