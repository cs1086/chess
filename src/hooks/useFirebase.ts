import { useState, useEffect } from 'react';
import { ref, set, onValue, push, update, remove, onDisconnect, increment } from 'firebase/database';
import { db } from '../firebase/config';
import type { UserProfile, ChatMessage, Challenge, GameState } from '../types';
import { initializeBoard, canCapture, isValidMove, checkWinner } from '../utils/gameLogic';

const ADMIN_ID = 'mouse530';

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

    useEffect(() => {
        if (!initialUserId) return;

        const userRef = ref(db, `users/${initialUserId}`);
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
                if (!isAdmin && userData.activeGameId && !currentGameId) {
                    setCurrentGameId(userData.activeGameId);
                }
            }
        });

        const statusRef = ref(db, `users/${initialUserId}`);
        update(statusRef, {
            isOnline: true,
            inChatRoom: false,
            sessionId: mySessionId
        });
        onDisconnect(statusRef).update({
            isOnline: false,
            lastOnline: Date.now()
        });

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
                setLeaderboard(users.filter(u => u.id !== ADMIN_ID && (u.wins + u.losses > 0)).sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    const winRateA = (a.wins + a.losses > 0) ? (a.wins / (a.wins + a.losses)) : 0;
                    const winRateB = (b.wins + b.losses > 0) ? (b.wins / (b.wins + b.losses)) : 0;
                    if (winRateB !== winRateA) return winRateB - winRateA;
                    if (a.runaways !== b.runaways) return a.runaways - b.runaways;
                    if (a.surrenders !== b.surrenders) return a.surrenders - b.surrenders;
                    if (a.rejections !== b.rejections) return a.rejections - b.rejections;
                    return 0;
                }).slice(0, 10));
                setOnlinePlayers(users.filter(u => u.isOnline === true && (u.inChatRoom || u.activeGameId) && u.id !== ADMIN_ID));
            }
        });

        return () => {
            unsubscribeUser();
            unsubscribeAllUsers();
        };
    }, [initialUserId, mySessionId, isAdmin, currentGameId]);

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
                setMessages(msgs.slice(-50));
            }
        });
        if (isAdmin) return;
        const challengesRef = ref(db, `challenges/${user.id}`);
        const unsubscribeChallenges = onValue(challengesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const challengeData = data as Challenge & { gameId?: string };
                if (challengeData.status === 'accepted' && challengeData.gameId) {
                    setCurrentGameId(challengeData.gameId);
                    toggleChatRoom(false);
                    remove(challengesRef);
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
                const normalizedBoard = Array.from({ length: 32 }, (_, i) => rawBoard[i] || null);
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

    useEffect(() => {
        if (!gameState || gameState.gameStatus !== 'ended' || !user || isAdmin) return;
        const isPlayer = gameState.players.red?.id === user.id || gameState.players.black?.id === user.id;
        const reason = gameState.endReason;
        if (reason === 'runaway') {
            if (isPlayer) {
                const isWinner = (gameState.players.red?.id === user.id && gameState.winner === 'red') ||
                    (gameState.players.black?.id === user.id && gameState.winner === 'black');
                alert(isWinner
                    ? '對手因斷線超過 2 分鐘，判定您獲勝！系統將自動帶您回聊天室。'
                    : '您因斷線超時被判定逃跑，遊戲已結束。系統將自動帶您回首頁。');
            } else {
                const runawayColor = gameState.winner === 'red' ? '黑色' : '紅色';
                alert(`由於 ${runawayColor} 玩家斷線超時（逃跑），遊戲已結束。系統將帶您回聊天室。`);
            }
            exitGame();
        } else if (reason === 'surrender' && !isPlayer) {
            const surrenderColor = gameState.winner === 'red' ? '黑色' : '紅色';
            alert(`由於 ${surrenderColor} 玩家投降，遊戲已結束。系統將帶您回聊天室。`);
            exitGame();
        }
    }, [gameState?.gameStatus, gameState?.endReason, user?.id, isAdmin, gameState?.players.red?.id, gameState?.players.black?.id, gameState?.winner]);

    useEffect(() => {
        if (isAdmin || !gameState || gameState.gameStatus !== 'ended' || !user || !currentGameId) return;
        if (gameState.endReason === 'runaway' || gameState.endReason === 'surrender') return;
        const isPlayer = gameState.players.red?.id === user.id || gameState.players.black?.id === user.id;
        if (isPlayer) {
            const opponentId = gameState.players.red?.id === user.id ? gameState.players.black?.id : gameState.players.red?.id;
            if (!opponentId) return;
            const opponentRef = ref(db, `users/${opponentId}`);
            const unsubscribeOpponent = onValue(opponentRef, (snapshot) => {
                const opponentData = snapshot.val() as UserProfile;
                if (opponentData) {
                    if (opponentData.activeGameId !== currentGameId) {
                        alert('對手已離開或不願意續戰，系統將自動帶您回聊天室。');
                        exitGame();
                    }
                }
            });
            return () => unsubscribeOpponent();
        } else {
            const redId = gameState.players.red?.id;
            const blackId = gameState.players.black?.id;
            if (!redId || !blackId) return;
            const checkPlayers = () => {
                const redRef = ref(db, `users/${redId}`);
                const blackRef = ref(db, `users/${blackId}`);
                onValue(redRef, (redSnap) => {
                    const redData = redSnap.val() as UserProfile;
                    onValue(blackRef, (blackSnap) => {
                        const blackData = blackSnap.val() as UserProfile;
                        if (redData && blackData && redData.activeGameId !== currentGameId && blackData.activeGameId !== currentGameId) {
                            alert('對戰雙方均已離開，系統將自動帶您回聊天室。');
                            exitGame();
                        }
                    }, { onlyOnce: true });
                }, { onlyOnce: true });
            };
            const unsubRed = onValue(ref(db, `users/${redId}`), checkPlayers);
            const unsubBlack = onValue(ref(db, `users/${blackId}`), checkPlayers);
            return () => { unsubRed(); unsubBlack(); };
        }
    }, [gameState?.gameStatus, currentGameId, user?.id, isAdmin, gameState?.endReason, gameState?.players.red?.id, gameState?.players.black?.id]);

    useEffect(() => {
        if (isAdmin || !gameState || gameState.gameStatus !== 'playing' || !user || !currentGameId) return;
        const opponentId = gameState.players.red?.id === user.id ? gameState.players.black?.id : gameState.players.red?.id;
        if (!opponentId) return;
        const checkRunaway = () => {
            const opponentRef = ref(db, `users/${opponentId}`);
            onValue(opponentRef, (snapshot) => {
                const opponentData = snapshot.val() as UserProfile;
                if (opponentData && !opponentData.isOnline) {
                    const offlineDuration = Date.now() - (opponentData.lastOnline || 0);
                    if (offlineDuration >= 120000) {
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
        const interval = setInterval(checkRunaway, 10000);
        return () => clearInterval(interval);
    }, [gameState?.gameStatus, currentGameId, user?.id, isAdmin, gameState?.players.red?.id, gameState?.players.black?.id]);

    const toggleChatRoom = (inRoom: boolean) => {
        if (!user || !user.id) return;
        update(ref(db, `users/${user.id}`), {
            inChatRoom: inRoom,
            isOnline: true
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
        if (to) newMessage.to = to;
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
        const challenger = onlinePlayers.find(p => p.id === challenge.fromId);
        const challenged = onlinePlayers.find(p => p.id === challenge.toId);

        const newGame: GameState = {
            board: initialBoard,
            currentPlayer: Math.random() > 0.5 ? 'red' : 'black',
            players: {
                red: {
                    id: challenge.fromId,
                    name: challenge.fromName,
                    wins: challenger?.wins || 0,
                    losses: challenger?.losses || 0
                },
                black: {
                    id: challenge.toId,
                    name: user!.name,
                    wins: challenged?.wins || 0,
                    losses: challenged?.losses || 0
                }
            },
            gameStatus: 'playing',
            turnStartTime: Date.now(),
            isColorAssigned: false
        };

        set(ref(db, `games/${gameId}`), newGame);
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
        update(ref(db, `users/${user.id}`), { rejections: increment(1) });
        remove(ref(db, `challenges/${user.id}`));
    };

    const handleMove = (from: number, to: number) => {
        if (isAdmin || !gameState || !currentGameId || !user) return;
        const playerColor = gameState.players.red?.id === user.id ? 'red' :
            gameState.players.black?.id === user.id ? 'black' : null;

        if (gameState.currentPlayer !== playerColor) return;

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
                if (gameState.currentPlayer === 'red') capturedPieces.red.push(target);
                else capturedPieces.black.push(target);
                board[to] = { ...attacker, position: to };
                board[from] = null;
            } else return;
        } else {
            if (isValidMove(from, to)) {
                board[to] = { ...attacker, position: to };
                board[from] = null;
            } else return;
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
        if (winner) updateStats(winner, 'normal');
    };

    const handleFlip = (index: number) => {
        if (isAdmin || !gameState || !currentGameId || !user) return;
        const playerColor = gameState.players.red?.id === user.id ? 'red' :
            gameState.players.black?.id === user.id ? 'black' : null;

        if (gameState.currentPlayer !== playerColor) return;

        const board = [...gameState.board];
        const piece = board[index];
        if (!piece || piece.isFlipped) return;
        board[index] = { ...piece, isFlipped: true };
        const nextPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';

        const finalUpdates: any = {
            board,
            currentPlayer: nextPlayer,
            turnStartTime: Date.now(),
            lastMove: { from: index, to: index, type: 'flip' }
        };

        if (!gameState.isColorAssigned) {
            finalUpdates.isColorAssigned = true;
            // First flip defines the roles. 
            // If the flipped piece color doesn't match the flipper's current role, swap roles.
            if (piece.color !== gameState.currentPlayer) {
                const redP = gameState.players.red;
                const blackP = gameState.players.black;
                finalUpdates.players = {
                    red: blackP,
                    black: redP
                };
                // If we swap roles, Player A (who was Red) is now Black.
                // It should now be Red's turn (the other person).
                // Since nextPlayer was set to Black, we need to override it back to Red.
                finalUpdates.currentPlayer = gameState.currentPlayer;
            }
        }
        update(ref(db, `games/${currentGameId}`), finalUpdates);
    };

    const updateStats = (winnerColor: string, reason: 'normal' | 'surrender' | 'runaway' = 'normal') => {
        if (!gameState) return;
        const players = gameState.players;
        const winnerId = winnerColor === 'red' ? players.red?.id : players.black?.id;
        const loserId = winnerColor === 'red' ? players.black?.id : players.red?.id;
        if (winnerId && winnerId !== ADMIN_ID) update(ref(db, `users/${winnerId}`), { wins: increment(1) });
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
                rematch: { red: false, black: false },
                isColorAssigned: false
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

    const clearChat = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'chat'));
        setMessages([]);
    };

    const clearGames = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'games'));
        await remove(ref(db, 'challenges'));
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) Object.keys(data).forEach(userId => update(ref(db, `users/${userId}`), { activeGameId: null }));
        }, { onlyOnce: true });
        setGameState(null);
        setCurrentGameId(null);
    };

    const clearUsers = async () => { if (!isAdmin) await remove(ref(db, 'users')); };
    const clearStats = async () => {
        if (!isAdmin) return;
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) Object.keys(data).forEach(userId => update(ref(db, `users/${userId}`), { wins: 0, losses: 0, surrenders: 0, runaways: 0, rejections: 0 }));
        }, { onlyOnce: true });
    };

    return { user, leaderboard, onlinePlayers, messages, receivedChallenge, gameState, isAdmin, toggleChatRoom, sendMessage, sendChallenge, acceptChallenge, rejectChallenge, handleMove, handleFlip, surrender, requestRematch, exitGame, joinSpectate, clearChat, clearGames, clearUsers, clearStats };
};
