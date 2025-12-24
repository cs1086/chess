import { useState, useEffect } from 'react';
import { ref, set, onValue, push, update, remove, onDisconnect, increment } from 'firebase/database';
import { db } from '../firebase/config';
import type { UserProfile, ChatMessage, Challenge, GameState } from '../types';
import { initializeBoard, canCapture, isValidMove, checkWinner } from '../utils/gameLogic';

const ADMIN_ID = 'mouse530';

// Generate a simple unique session ID
const generateSessionId = () => Math.random().toString(36).substring(2, 15);

export const useFirebase = (initialUserId: string | null) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState<UserProfile[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [receivedChallenge, setReceivedChallenge] = useState<Challenge | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
    const [currentGameId, setCurrentGameId] = useState<string | null>(null);
    const [mySessionId] = useState(generateSessionId());

    const isAdmin = initialUserId === ADMIN_ID;

    // User Profile & Online Status
    useEffect(() => {
        if (!initialUserId) return;

        const userRef = ref(db, `users/${initialUserId}`);

        // Check if user exists, if not create
        const unsubscribeUser = onValue(userRef, (snapshot) => {
            if (!snapshot.exists()) {
                const newUser: UserProfile = {
                    id: initialUserId,
                    name: initialUserId,
                    wins: 0,
                    losses: 0,
                    surrenders: 0,
                    runaways: 0,
                    rejections: 0,
                    lastOnline: Date.now(),
                    inChatRoom: false,
                    isOnline: true,
                    sessionId: mySessionId
                };
                set(userRef, newUser);
            } else {
                const userData = snapshot.val() as UserProfile;

                // --- Session Conflict Logic ---
                // If it's a real user (not admin) and session ID exists and is different from mine
                if (!isAdmin && userData.sessionId && userData.sessionId !== mySessionId && userData.isOnline) {
                    alert('您的帳號已在其他地方登入。您將被強制登出。');
                    localStorage.removeItem('chess_userId');
                    window.location.reload();
                    return;
                }

                setUser({
                    ...userData,
                    id: initialUserId,
                    name: userData.name || initialUserId,
                    rejections: userData.rejections || 0,
                    surrenders: userData.surrenders || 0,
                    runaways: userData.runaways || 0
                });

                // Restore active game if exists (Admin doesn't play)
                if (!isAdmin && userData.activeGameId && !currentGameId) {
                    setCurrentGameId(userData.activeGameId);
                }
            }
        });

        // Handle online status
        const statusRef = ref(db, `users/${initialUserId}`);

        // Reset inChatRoom on refresh/mount and update sessionId
        update(statusRef, {
            isOnline: true,
            inChatRoom: false,
            sessionId: mySessionId
        });

        onDisconnect(statusRef).update({
            isOnline: false,
            lastOnline: Date.now()
        });

        // Leaderboard and online players
        const allUsersRef = ref(db, 'users');
        const unsubscribeAllUsers = onValue(allUsersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users = Object.entries(data).map(([key, value]) => {
                    const val = value as UserProfile;
                    return {
                        ...val,
                        id: key,
                        name: val.name || key,
                        wins: val.wins || 0,
                        losses: val.losses || 0,
                        surrenders: val.surrenders || 0,
                        runaways: val.runaways || 0,
                        rejections: val.rejections || 0
                    };
                });

                // Admin logic: 
                // 1. Admin not in leaderboard
                // 2. Admin not in online players (others can't see admin)
                setLeaderboard(users.filter(u => u.id !== ADMIN_ID).sort((a, b) => {
                    const winRateA = (a.wins + a.losses > 0) ? (a.wins / (a.wins + a.losses)) : 0;
                    const winRateB = (b.wins + b.losses > 0) ? (b.wins / (b.wins + b.losses)) : 0;

                    if (winRateB !== winRateA) return winRateB - winRateA;
                    if (a.runaways !== b.runaways) return a.runaways - b.runaways;
                    if (a.surrenders !== b.surrenders) return a.surrenders - b.surrenders;
                    if (a.rejections !== b.rejections) return a.rejections - b.rejections;
                    return b.wins - a.wins; // Final tie-breaker
                }).slice(0, 10));

                setOnlinePlayers(users.filter(u => u.isOnline === true && u.id !== ADMIN_ID));
            }
        });

        return () => {
            unsubscribeUser();
            unsubscribeAllUsers();
        };
    }, [initialUserId, mySessionId]);

    // Chat & Challenges
    useEffect(() => {
        if (!user || !user.inChatRoom) {
            setMessages([]);
            setReceivedChallenge(null);
            return;
        }

        const messagesRef = ref(db, 'chat/messages');
        const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgs = Object.values(data) as ChatMessage[];
                setMessages(msgs.slice(-50)); // Last 50 messages
            }
        });

        // Admin doesn't receive challenges
        if (isAdmin) return;

        const challengesRef = ref(db, `challenges/${user.id}`);
        const unsubscribeChallenges = onValue(challengesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const challengeData = data as Challenge & { gameId?: string };
                if (challengeData.status === 'accepted' && challengeData.gameId) {
                    setCurrentGameId(challengeData.gameId);
                    toggleChatRoom(false);
                    remove(challengesRef); // Clean up
                } else {
                    setReceivedChallenge(challengeData);
                }
            } else {
                setReceivedChallenge(null);
            }
        });

        return () => {
            unsubscribeMessages();
            unsubscribeChallenges();
        };
    }, [user?.inChatRoom, isAdmin, user?.id]);

    // Game State Sync
    useEffect(() => {
        if (!currentGameId) {
            setGameState(null);
            return;
        }

        const gameRef = ref(db, `games/${currentGameId}`);
        const unsubscribeGame = onValue(gameRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const rawBoard = data.board || [];
                // Ensure board is always a proper 32-element array even if Firebase returns it as an object
                const normalizedBoard = Array.from({ length: 32 }, (_, i) => rawBoard[i] || null);

                // Normalize spectators from object to array
                const spectators = data.spectators ? Object.values(data.spectators) as UserProfile[] : [];

                setGameState({
                    ...data,
                    board: normalizedBoard,
                    spectators
                } as GameState);
            }
        });

        return () => unsubscribeGame();
    }, [currentGameId]);

    // Handle "Runaway" (Timeout) detection and auto-exit
    useEffect(() => {
        if (gameState?.gameStatus === 'ended' && gameState?.endReason === 'runaway') {
            const isWinner = (gameState.players.red?.id === user?.id && gameState.winner === 'red') ||
                (gameState.players.black?.id === user?.id && gameState.winner === 'black');

            const message = isWinner
                ? '對手因斷線超過 2 分鐘，判定您獲勝！系統將自動帶您回聊天室。'
                : '您因斷線超時被判定逃跑，遊戲已結束。系統將自動帶您回首頁。';

            alert(message);
            exitGame();
        }
    }, [gameState?.gameStatus, gameState?.endReason, user?.id]);

    // Handle opponent leaving after game ends
    useEffect(() => {
        if (isAdmin || !gameState || gameState.gameStatus !== 'ended' || !user || !currentGameId) return;

        // Skip if it was a runaway end, it's already handled above
        if (gameState.endReason === 'runaway') return;

        const opponentId = gameState.players.red?.id === user.id
            ? gameState.players.black?.id
            : gameState.players.red?.id;

        if (!opponentId) return;

        const opponentRef = ref(db, `users/${opponentId}`);
        const unsubscribeOpponent = onValue(opponentRef, (snapshot) => {
            const opponentData = snapshot.val() as UserProfile;
            if (opponentData) {
                // If opponent left the game room or went offline
                const hasLeft = opponentData.activeGameId !== currentGameId || !opponentData.isOnline;
                if (hasLeft) {
                    alert('對手已離開或不願意續戰，系統將自動帶您回聊天室。');
                    exitGame();
                }
            }
        });

        return () => unsubscribeOpponent();
    }, [gameState?.gameStatus, currentGameId, user?.id, isAdmin]);

    // Runaway Monitoring (2 minutes timeout)
    useEffect(() => {
        if (isAdmin || !gameState || gameState.gameStatus !== 'playing' || !user || !currentGameId) return;

        const opponentId = gameState.players.red?.id === user.id
            ? gameState.players.black?.id
            : gameState.players.red?.id;

        if (!opponentId) return;

        const checkRunaway = () => {
            const opponentRef = ref(db, `users/${opponentId}`);
            onValue(opponentRef, (snapshot) => {
                const opponentData = snapshot.val() as UserProfile;
                if (opponentData && !opponentData.isOnline) {
                    const offlineDuration = Date.now() - (opponentData.lastOnline || 0);
                    if (offlineDuration >= 120000) { // 2 minutes
                        // We are the winner, opponent is the runaway
                        const winnerColor = gameState.players.red?.id === user.id ? 'red' : 'black';

                        update(ref(db, `games/${currentGameId}`), {
                            gameStatus: 'ended',
                            winner: winnerColor,
                            endReason: 'runaway'
                        });
                        updateStats(winnerColor, 'runaway');
                    }
                }
            }, { onlyOnce: true });
        };

        const interval = setInterval(checkRunaway, 10000); // Check every 10 seconds
        return () => clearInterval(interval);
    }, [gameState?.gameStatus, currentGameId, user?.id, isAdmin]);

    const toggleChatRoom = (inRoom: boolean) => {
        if (!user || !user.id) return;
        update(ref(db, `users/${user.id}`), {
            inChatRoom: inRoom,
            isOnline: true  // Ensure user is marked as online
        });
    };

    const sendMessage = (content: string, to?: string) => {
        if (!user) return;
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            from: user.id,
            fromName: user.name,
            content,
            timestamp: Date.now(),
        };

        if (to) {
            newMessage.to = to;
        }

        push(ref(db, 'chat/messages'), newMessage);
    };

    const sendChallenge = (toId: string) => {
        if (!user || isAdmin) return;
        const challenge: Challenge = {
            id: user.id,
            fromId: user.id,
            fromName: user.name,
            toId,
            status: 'pending',
            timestamp: Date.now()
        };
        set(ref(db, `challenges/${toId}`), challenge);
    };

    const acceptChallenge = (challenge: Challenge) => {
        if (isAdmin) return;
        const gameId = `${challenge.fromId}_${challenge.toId}_${Date.now()}`;
        const initialBoard = initializeBoard();

        const newGame: GameState = {
            board: initialBoard,
            currentPlayer: Math.random() > 0.5 ? 'red' : 'black',
            players: {
                red: { id: challenge.fromId, name: challenge.fromName },
                black: { id: challenge.toId, name: user!.name }
            },
            gameStatus: 'playing',
            turnStartTime: Date.now()
        };

        set(ref(db, `games/${gameId}`), newGame);
        // Notify the other player by updating challenge status
        update(ref(db, `challenges/${user!.id}`), { status: 'accepted', gameId });
        update(ref(db, `challenges/${challenge.fromId}`), { status: 'accepted', gameId });

        setCurrentGameId(gameId);
        update(ref(db, `users/${user!.id}`), { activeGameId: gameId });
        update(ref(db, `users/${challenge.fromId}`), { activeGameId: gameId });
        toggleChatRoom(false);
    };

    const joinSpectate = (gameId: string) => {
        if (!user || !user.id || isAdmin) return;
        const spectatorRef = ref(db, `games/${gameId}/spectators/${user.id}`);
        set(spectatorRef, {
            id: user.id,
            name: user.name,
            wins: user.wins,
            losses: user.losses
        });
        update(ref(db, `users/${user.id}`), { activeGameId: gameId });
        setCurrentGameId(gameId);
        toggleChatRoom(false);
    };

    const rejectChallenge = () => {
        if (isAdmin || !user) return;
        // Increment rejection count
        update(ref(db, `users/${user.id}`), {
            rejections: increment(1)
        });
        remove(ref(db, `challenges/${user.id}`));
    };

    const handleMove = (from: number, to: number) => {
        if (isAdmin || !gameState || !currentGameId) return;
        const currentCaptured = gameState.capturedPieces || { red: [], black: [] };
        const capturedPieces = {
            red: Array.isArray(currentCaptured.red) ? [...currentCaptured.red] : Object.values(currentCaptured.red || {}),
            black: Array.isArray(currentCaptured.black) ? [...currentCaptured.black] : Object.values(currentCaptured.black || {})
        };

        const board = [...gameState.board];
        const attacker = board[from];
        const target = board[to];

        if (!attacker) return;

        if (target) {
            if (canCapture(attacker, target, board)) {
                if (gameState.currentPlayer === 'red') {
                    capturedPieces.red.push(target);
                } else {
                    capturedPieces.black.push(target);
                }
                board[to] = { ...attacker, position: to };
                board[from] = null;
            } else {
                return; // Invalid capture
            }
        } else {
            if (isValidMove(from, to)) {
                board[to] = { ...attacker, position: to };
                board[from] = null;
            } else {
                return; // Invalid move
            }
        }

        const winner = checkWinner(board);
        const nextPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';

        update(ref(db, `games/${currentGameId}`), {
            board,
            currentPlayer: winner ? null : nextPlayer,
            gameStatus: winner ? 'ended' : 'playing',
            winner: winner || null,
            turnStartTime: Date.now(),
            lastMove: { from, to, type: target ? 'capture' : 'move' },
            capturedPieces
        });

        if (winner) {
            updateStats(winner, 'normal');
        }
    };

    const handleFlip = (index: number) => {
        if (isAdmin || !gameState || !currentGameId) return;
        const board = [...gameState.board];
        const piece = board[index];
        if (!piece || piece.isFlipped) return;

        board[index] = { ...piece, isFlipped: true };

        let nextPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';

        update(ref(db, `games/${currentGameId}`), {
            board,
            currentPlayer: nextPlayer,
            turnStartTime: Date.now(),
            lastMove: { from: index, to: index, type: 'flip' }
        });
    };

    const updateStats = (winnerColor: string, reason: 'normal' | 'surrender' | 'runaway' = 'normal') => {
        if (!gameState) return;
        const players = gameState.players;
        const winnerId = winnerColor === 'red' ? players.red?.id : players.black?.id;
        const loserId = winnerColor === 'red' ? players.black?.id : players.red?.id;

        if (winnerId && winnerId !== ADMIN_ID) {
            update(ref(db, `users/${winnerId}`), {
                wins: increment(1)
            });
        }
        if (loserId && loserId !== ADMIN_ID) {
            const updates: any = { losses: increment(1) };
            if (reason === 'surrender') updates.surrenders = increment(1);
            if (reason === 'runaway') updates.runaways = increment(1);
            update(ref(db, `users/${loserId}`), { ...updates });
        }
    };

    const surrender = () => {
        if (isAdmin || !gameState || !currentGameId) return;
        const winner = gameState.players.red?.id === user?.id ? 'black' : 'red';
        update(ref(db, `games/${currentGameId}`), {
            gameStatus: 'ended',
            winner,
            endReason: 'surrender'
        });
        updateStats(winner, 'surrender');
    };

    const requestRematch = () => {
        if (isAdmin || !gameState || !currentGameId || !user) return;
        const color = gameState.players.red?.id === user.id ? 'red' : 'black';
        const otherColor = color === 'red' ? 'black' : 'red';

        const rematchRef = ref(db, `games/${currentGameId}/rematch/${color}`);
        set(rematchRef, true);

        // Check if both agreed
        if (gameState.rematch?.[otherColor]) {
            const initialBoard = initializeBoard();
            update(ref(db, `games/${currentGameId}`), {
                board: initialBoard,
                currentPlayer: Math.random() > 0.5 ? 'red' : 'black',
                gameStatus: 'playing',
                winner: null,
                endReason: null,
                lastMove: null,
                capturedPieces: { red: [], black: [] },
                turnStartTime: Date.now(),
                rematch: { red: false, black: false }
            });
        }
    };

    const exitGame = () => {
        if (!user || !user.id || !currentGameId) return;

        remove(ref(db, `games/${currentGameId}/spectators/${user.id}`));
        update(ref(db, `users/${user.id}`), { activeGameId: null });

        setCurrentGameId(null);
        toggleChatRoom(true);
    };

    // Admin Utilities
    const clearChat = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'chat'));
        setMessages([]);
    };

    const clearGames = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'games'));
        await remove(ref(db, 'challenges'));
        // Clear all users activeGameId
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(userId => {
                    update(ref(db, `users/${userId}`), { activeGameId: null });
                });
            }
        }, { onlyOnce: true });
        setGameState(null);
        setCurrentGameId(null);
    };

    const clearUsers = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'users'));
        // Special case: we don't want to log out the current admin
    };

    const clearStats = async () => {
        if (!isAdmin) return;
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(userId => {
                    update(ref(db, `users/${userId}`), {
                        wins: 0,
                        losses: 0,
                        surrenders: 0,
                        runaways: 0,
                        rejections: 0
                    });
                });
            }
        }, { onlyOnce: true });
    };

    return {
        user,
        leaderboard,
        onlinePlayers,
        messages,
        receivedChallenge,
        gameState,
        isAdmin,
        toggleChatRoom,
        sendMessage,
        sendChallenge,
        acceptChallenge,
        rejectChallenge,
        handleMove,
        handleFlip,
        surrender,
        requestRematch,
        exitGame,
        joinSpectate,
        clearChat,
        clearGames,
        clearUsers,
        clearStats
    };
};
