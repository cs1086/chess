
import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { ChatMessage, UserProfile } from '../../types';

interface RoomChatProps {
    messages: ChatMessage[];
    currentUser: UserProfile;
    onSendMessage: (content: string) => void;
    className?: string;
}

export const RoomChat: React.FC<RoomChatProps> = ({ messages, currentUser, onSendMessage, className = "" }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow-lg border border-[#e8d5c4] flex flex-col h-full ${className}`}>
            <div className="p-4 bg-[#f8f1e7] border-b border-[#e8d5c4] rounded-t-xl flex items-center gap-2">
                <MessageSquare size={20} className="text-[#8b5a2b]" />
                <h3 className="font-bold text-[#5c3a1e]">聊天室</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fffaf5] min-h-[300px] md:min-h-0">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-10 text-sm">
                        暫無訊息
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isSelf = msg.from === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-end gap-2 max-w-[85%]">
                                    {!isSelf && (
                                        <div className="w-6 h-6 rounded-full bg-[#dcc0a3] flex items-center justify-center text-xs font-bold text-[#5c3a1e] shrink-0">
                                            {msg.fromName[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div
                                        className={`px-4 py-2 rounded-2xl text-sm break-words shadow-sm ${isSelf
                                                ? 'bg-[#8b5a2b] text-white rounded-br-none'
                                                : 'bg-white border border-[#e8d5c4] text-[#374151] rounded-bl-none'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 px-1">
                                    {msg.fromName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t border-[#e8d5c4] rounded-b-xl flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="輸入訊息..."
                    className="flex-1 px-4 py-2 rounded-full border border-[#ccbfa8] bg-[#fdfdfd] text-sm focus:outline-none focus:border-[#8b5a2b] focus:ring-1 focus:ring-[#8b5a2b]"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-[#8b5a2b] text-white rounded-full hover:bg-[#6d4621] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};
