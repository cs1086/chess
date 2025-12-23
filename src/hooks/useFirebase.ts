import { useState, useEffect } from 'react';
import { ref, set, onValue, push, update, remove, onDisconnect } from 'firebase/database';
import { db } from '../firebase/config';
import type { UserProfile, ChatMessage, Challenge, GameState } from '../types';
import { initializeBoard, canCapture, isValidMove, checkWinner } from '../utils/gameLogic';

export const useFirebase = (initialUserId: string | null) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [onlinePlayers, setOnlinePlayers] = useState<UserProfile[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [receivedChallenge, setReceivedChallenge] = useState<Challenge | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
    const [currentGameId, setCurrentGameId] = useState<string | null>(null);

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
                    lastOnline: Date.now(),
                    inChatRoom: false,
                    isOnline: true
                };
                set(userRef, newUser);
            } else {
                // Ensure id is always set, even if missing from database
                const userData = snapshot.val() as UserProfile;
                setUser({ ...userData, id: initialUserId, name: userData.name || initialUserId });
            }
        });

        // Handle online status
        const statusRef = ref(db, `users/${initialUserId}/isOnline`);
        onDisconnect(statusRef).set(false);
        set(statusRef, true);

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
                        name: val.name || key, // Ensure name is always set
                        wins: val.wins || 0,
                        losses: val.losses || 0
                    };
                });
                setLeaderboard(users.sort((a, b) => b.wins - a.wins).slice(0, 10));
                setOnlinePlayers(users.filter(u => u.isOnline === true && u.inChatRoom === true));
            }
        });

        return () => {
            set(statusRef, false);
            unsubscribeUser();
            unsubscribeAllUsers();
        };
    }, [initialUserId]);

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
    }, [user?.inChatRoom]);

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
            to
        };
        push(ref(db, 'chat/messages'), newMessage);
    };

    const sendChallenge = (toId: string) => {
        if (!user) return;
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
        if (!user || !user.id) return;
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
        remove(ref(db, `challenges/${user!.id}`));
    };

    const handleMove = (from: number, to: number) => {
        if (!gameState || !currentGameId) return;
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
            updateStats(winner);
        }
    };

    const handleFlip = (index: number) => {
        if (!gameState || !currentGameId) return;
        const board = [...gameState.board];
        const piece = board[index];
        if (!piece || piece.isFlipped) return;

        board[index] = { ...piece, isFlipped: true };

        let nextPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';

        // Assign colors on first flip if needed? No, darker chess usually randomizes or first flip decides.
        // In this version, we randomize start player.

        update(ref(db, `games/${currentGameId}`), {
            board,
            currentPlayer: nextPlayer,
            turnStartTime: Date.now(),
            lastMove: { from: index, to: index, type: 'flip' }
        });
    };

    const updateStats = (winner: string) => {
        if (!gameState) return;
        const isWinner = (gameState.players.red?.id === user?.id && winner === 'red') ||
            (gameState.players.black?.id === user?.id && winner === 'black');

        const userRef = ref(db, `users/${user?.id}`);
        update(userRef, {
            wins: isWinner ? (user?.wins || 0) + 1 : (user?.wins || 0),
            losses: isWinner ? (user?.losses || 0) : (user?.losses || 0) + 1
        });
    };

    const surrender = () => {
        if (!gameState || !currentGameId) return;
        const winner = gameState.players.red?.id === user?.id ? 'black' : 'red';
        update(ref(db, `games/${currentGameId}`), {
            gameStatus: 'ended',
            winner
        });
        updateStats(winner);
    };

    const requestRematch = () => {
        if (!gameState || !currentGameId || !user) return;
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
                turnStartTime: Date.now(),
                rematch: { red: false, black: false }
            });
        }
    };

    const exitGame = () => {
        if (!user || !user.id || !currentGameId) return;

        // Remove from spectators just in case
        remove(ref(db, `games/${currentGameId}/spectators/${user.id}`));

        // Clear activeGameId
        update(ref(db, `users/${user.id}`), { activeGameId: null });

        setCurrentGameId(null);
        toggleChatRoom(true);
    };

    return {
        user,
        leaderboard,
        onlinePlayers,
        messages,
        receivedChallenge,
        gameState,
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
        joinSpectate
    };
};
