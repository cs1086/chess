
import { useState, useEffect, useRef } from 'react';
import { ref, set, onValue, push, update, remove, onDisconnect, increment } from 'firebase/database';
import { db } from '../firebase/config';
import type { UserProfile, ChatMessage, GameState, Room, GameType, MahjongGameState, MahjongPlayer, Piece, BigTwoGameState, BigTwoPlayer, BigTwoPlay } from '../types';
import { initializeBoard, canCapture, isValidMove, checkWinner } from '../utils/gameLogic';
import {
    initializeMahjongDeck, shuffleTiles, dealTiles,
    canChi, canPong, canKong, checkHu
} from '../utils/mahjongLogic';
import { calculateScore } from '../utils/mahjongScoring';
import {
    initializeBigTwoDeck, shuffleBigTwoDeck, dealBigTwoCards,
    findClub3Holder, isValidPlay, detectHandType, botSelectCards
} from '../utils/bigTwoLogic';
import { GAME_CONFIGS } from '../utils/gameConfig';

const ADMIN_ID = 'mouse530';

const generateSessionId = () => Math.random().toString(36).substring(2, 15);

export const useFirebase = (initialUserId: string | null) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [mahjongState, setMahjongState] = useState<MahjongGameState | null>(null);
    const [bigTwoState, setBigTwoState] = useState<BigTwoGameState | null>(null);
    const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
    const [currentGameId, setCurrentGameId] = useState<string | null>(null);
    const [mySessionId] = useState(generateSessionId());

    // Room System States
    const [rooms, setRooms] = useState<Room[]>([]);
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [isInLobby, setIsInLobby] = useState<boolean>(true);


    const isAdmin = initialUserId === ADMIN_ID;

    // --- User Management ---
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
                    name: userData.name || initialUserId
                });

                // If user has an active game, restore it
                if (!isAdmin && userData.activeGameId && !currentGameId) {
                    setCurrentGameId(userData.activeGameId);
                    setIsInLobby(false);
                }
            }
        });

        const statusRef = ref(db, `users/${initialUserId}`);
        update(statusRef, {
            isOnline: true,
            sessionId: mySessionId
        });
        onDisconnect(statusRef).update({
            isOnline: false,
            lastOnline: Date.now()
        });

        // Listen for all users (Leaderboard)
        const allUsersRef = ref(db, 'users');
        const unsubscribeAllUsers = onValue(allUsersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users = Object.entries(data).map(([key, value]) => {
                    const val = value as UserProfile;
                    return { ...val, id: key };
                });
                setLeaderboard(users.filter(u => u.id !== ADMIN_ID && (u.wins + u.losses > 0)).sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return 0; // Simplified sort
                }).slice(0, 10));
            }
        });

        return () => {
            unsubscribeUser();
            unsubscribeAllUsers();
        };
    }, [initialUserId, mySessionId, isAdmin, currentGameId]);

    // --- Room & Lobby Management ---

    // Listen for Rooms
    useEffect(() => {
        if (!user) return;
        const roomsRef = ref(db, 'rooms');
        const unsubscribeRooms = onValue(roomsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const roomList = (Object.values(data) as any[]).map(r => ({
                    ...r,
                    players: (Array.isArray(r.players) ? r.players.filter(Boolean) : (r.players ? Object.values(r.players) : [])) as UserProfile[],
                    spectators: (Array.isArray(r.spectators) ? r.spectators.filter(Boolean) : (r.spectators ? Object.values(r.spectators) : [])) as UserProfile[]
                })) as Room[];
                setRooms(roomList);

                // Update current room if user is in one
                if (user.id) {
                    const myRoom = roomList.find(r =>
                        r.players.some(p => p.id === user.id) ||
                        r.spectators.some(s => s.id === user.id)
                    );
                    setCurrentRoom(myRoom || null);
                    if (myRoom) setIsInLobby(false);
                }
            } else {
                setRooms([]);
                setCurrentRoom(null);
            }
        });

        return () => unsubscribeRooms();
    }, [user?.id]);

    const createRoom = async (gameType: GameType, password?: string, allowSpectators: boolean = true, fillWithBots: boolean = false) => {
        if (!user) return;

        try {
            const config = GAME_CONFIGS[gameType];
            const newRoomId = push(ref(db, 'rooms')).key;
            if (!newRoomId) return;

            const newRoom: Room = {
                id: newRoomId,
                hostId: user.id,
                gameType,
                ...(password ? { password } : {}),
                allowSpectators,
                fillWithBots,
                players: [user],
                spectators: [],
                maxPlayers: config.maxPlayers,
                minPlayers: config.minPlayers,
                status: 'waiting',
                createdAt: Date.now(),
                name: `${user.name} 的房間`
            };

            // Optimistic Update: Switch to room immediately
            // This prevents flicker and makes UI responsive
            setCurrentRoom(newRoom);
            setIsInLobby(false);

            await set(ref(db, `rooms/${newRoomId}`), newRoom);
        } catch (error) {
            console.error(error);
            alert('建立房間失敗，請稍後再試');
            // Revert if failed
            setIsInLobby(true);
            setCurrentRoom(null);
        }
    };

    const joinRoom = async (roomId: string, password?: string) => {
        if (!user) return;
        const roomRef = ref(db, `rooms/${roomId}`);

        // Transaction to ensure atomic join
        // For simplicity in this non-production env, we'll read then write, 
        // but ideally should use runTransaction for concurrency safe updates.
        // Given the constraints and libraries, standard read-check-write:

        // Note: In a real app, use runTransaction. Here simple check:
        const room = rooms.find(r => r.id === roomId);
        if (!room) { alert('房間不存在'); return; }

        if (room.password && room.password !== password) {
            alert('密碼錯誤');
            return;
        }

        if (room.players.length >= room.maxPlayers) {
            // If full, try generic spectate if allowed
            if (room.allowSpectators) {
                joinSpectateRoom(roomId);
                return;
            }
            alert('房間已滿');
            return;
        }

        const updatedPlayers = [...room.players, user];
        await update(roomRef, { players: updatedPlayers });
        setIsInLobby(false);
    };

    const joinSpectateRoom = async (roomId: string) => {
        if (!user) return;
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        if (room.spectators.some(s => s.id === user.id)) {
            setIsInLobby(false);
            return;
        }

        const updatedSpectators = [...room.spectators, user];
        await update(ref(db, `rooms/${roomId}`), { spectators: updatedSpectators });
        setIsInLobby(false);
    }

    const leaveRoom = async () => {
        if (!user || !currentRoom) return;

        // Remove user from players
        const newPlayers = (currentRoom.players || []).filter(p => p.id !== user.id);
        const newSpectators = (currentRoom.spectators || []).filter(s => s.id !== user.id);

        if (newPlayers.length === 0) {
            // Room empty, delete it
            await remove(ref(db, `rooms/${currentRoom.id}`));
        } else {
            const updates: Partial<Room> = {
                players: newPlayers,
                spectators: newSpectators
            };

            // If host left, assign new host
            if (currentRoom.hostId === user.id && newPlayers.length > 0) {
                updates.hostId = newPlayers[0].id;
            }

            await update(ref(db, `rooms/${currentRoom.id}`), updates);
        }

        setIsInLobby(true);
        setCurrentRoom(null);
    };

    const kickPlayer = async (userIdToKick: string) => {
        if (!user || !currentRoom || currentRoom.hostId !== user.id) return;
        if (userIdToKick === user.id) return; // Cannot kick self

        const newPlayers = (currentRoom.players || []).filter(p => p.id !== userIdToKick);
        const newSpectators = (currentRoom.spectators || []).filter(s => s.id !== userIdToKick);

        await update(ref(db, `rooms/${currentRoom.id}`), {
            players: newPlayers,
            spectators: newSpectators
        });
    };

    const toggleReady = async () => {
        if (!user || !currentRoom) return;
        const newPlayers = currentRoom.players.map(p =>
            p.id === user.id ? { ...p, isReady: !p.isReady } : p
        );
        await update(ref(db, `rooms/${currentRoom.id}`), { players: newPlayers });
    };



    const startGame = async () => {
        if (!user || !currentRoom || currentRoom.hostId !== user.id) return;

        // Check if all players (except host) are ready
        const allReady = currentRoom.players.every(p => p.id === user.id || p.isReady);
        if (!allReady) {
            alert('尚有玩家未準備');
            return;
        }

        let activePlayers = [...currentRoom.players];

        // Handle Bot Filling
        if (currentRoom.fillWithBots && (currentRoom.gameType === 'mahjong' || currentRoom.gameType === 'chinese_dark_chess' || currentRoom.gameType === 'big_two')) {
            const config = GAME_CONFIGS[currentRoom.gameType];
            const needed = (config?.maxPlayers || 4) - activePlayers.length;
            if (needed > 0) {
                for (let i = 0; i < needed; i++) {
                    const botId = `bot_${Date.now()}_${i}`;
                    activePlayers.push({
                        id: botId,
                        name: `電腦玩家 ${i + 1}`,
                        wins: 0,
                        losses: 0,
                        isOnline: true,
                        activeGameId: '',
                        inChatRoom: false,
                        surrenders: 0,
                        runaways: 0,
                        rejections: 0,
                        lastOnline: Date.now()
                    });
                }
            }
        }

        if (activePlayers.length < currentRoom.minPlayers) {
            alert(`人數不足，至少需要 ${currentRoom.minPlayers} 人 (含電腦)`);
            return;
        }

        // Initialize Game based on type
        // Currently only Chinese Dark Chess has logic

        const gameId = `game_${currentRoom.id}_${Date.now()}`;

        let newGame: GameState | null = null;
        let newMahjongGame: MahjongGameState | null = null;

        if (currentRoom.gameType === 'chinese_dark_chess') {
            const initialBoard = initializeBoard();
            newGame = {
                board: initialBoard,
                currentPlayer: Math.random() > 0.5 ? 'red' : 'black',
                players: {
                    red: activePlayers[0].id === user.id ?
                        { id: activePlayers[0].id, name: activePlayers[0].name, wins: 0, losses: 0 } :
                        { id: activePlayers[1].id, name: activePlayers[1].name, wins: 0, losses: 0 },
                    // Randomly assign for now, or just fixed order. Random is better.
                    // Let's shuffle players for fairness or just take as is.
                    // Re-mapping players to colors properly:
                },
                gameStatus: 'playing',
                turnStartTime: Date.now(),
                isColorAssigned: false
            };

            // Proper Color Assignment for 2 players
            const p1 = activePlayers[0];
            const p2 = activePlayers[1];
            const p1IsRed = Math.random() > 0.5;

            newGame.players = {
                red: p1IsRed ? { ...p1, wins: 0, losses: 0 } : { ...p2, wins: 0, losses: 0 },
                black: !p1IsRed ? { ...p1, wins: 0, losses: 0 } : { ...p2, wins: 0, losses: 0 }
            };
        } else if (currentRoom.gameType === 'mahjong') {
            const tiles = shuffleTiles(initializeMahjongDeck());
            const { hands, wall } = dealTiles(tiles);

            // Define players
            // Ensure we have exactly 4 players for Mahjong
            const playersList: MahjongPlayer[] = activePlayers.slice(0, 4).map((p, index) => ({
                id: p.id,
                name: p.name,
                wind: index,
                hand: hands[index],

                melds: [],
                discarded: [],
                score: 0
            }));

            newMahjongGame = {
                players: playersList,
                wall,
                wallCount: wall.length,
                currentTurn: playersList[0].id, // Dealer starts
                dice: [1, 1, 1], // Placeholder
                prevailingWind: 0, // East
                dealer: 0,
                gameStatus: 'playing',
                round: 1
            };
        } else if (currentRoom.gameType === 'big_two') {
            const deck = shuffleBigTwoDeck(initializeBigTwoDeck());
            const hands = dealBigTwoCards(deck);
            const starterIndex = findClub3Holder(hands);

            const bigTwoPlayers: BigTwoPlayer[] = activePlayers.slice(0, 4).map((p, index) => ({
                id: p.id,
                name: p.name,
                hand: hands[index],
                cardCount: hands[index].length
            }));

            // Turn order starting from the club-3 holder
            const turnOrder: string[] = [];
            for (let i = 0; i < bigTwoPlayers.length; i++) {
                turnOrder.push(bigTwoPlayers[(starterIndex + i) % bigTwoPlayers.length].id);
            }

            const newBigTwoGame: BigTwoGameState = {
                players: bigTwoPlayers,
                currentTurn: bigTwoPlayers[starterIndex].id,
                turnOrder,
                consecutivePasses: 0,
                gameStatus: 'playing',
                roundStarter: bigTwoPlayers[starterIndex].id
            };

            await set(ref(db, `games/${gameId}`), newBigTwoGame);
            await update(ref(db, `rooms/${currentRoom.id}`), { status: 'playing' });
            currentRoom.players.forEach(p => {
                update(ref(db, `users/${p.id}`), { activeGameId: gameId });
            });
            setCurrentGameId(gameId);
        } else {
            // Placeholder for other games
            // Create empty game state to satisfy types, but UI will handle "Not Implemented"
        }


        if (newGame) {
            await set(ref(db, `games/${gameId}`), newGame);
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'playing',
            });
            // Update all players activeGameId
            currentRoom.players.forEach(p => {
                update(ref(db, `users/${p.id}`), { activeGameId: gameId });
            });
            setCurrentGameId(gameId);
        } else if (newMahjongGame) {
            await set(ref(db, `games/${gameId}`), newMahjongGame);
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'playing',
            });
            currentRoom.players.forEach(p => {
                update(ref(db, `users/${p.id}`), { activeGameId: gameId });
            });
            setCurrentGameId(gameId);
        }
    };


    // --- Chat Management (Room specific or Global) ---
    // Refactor: Chat messages now should probably be per room? 
    // Or keep global chat? 
    // Requirement implies "Room", so let's make chat room-based if in room, global if in lobby?
    // For now, let's keep the single chat ref but maybe scope it later.
    // Let's stick to the existing chat hook logic but allow it to be used in lobby.

    useEffect(() => {
        // Chat ref: 'chat/messages' is global. 
        // Room chat: 'rooms/{roomId}/messages'

        let messagesRef = ref(db, 'chat/messages');
        if (currentRoom) {
            messagesRef = ref(db, `rooms/${currentRoom.id}/messages`);
        } else {
            // Lobby chat
            messagesRef = ref(db, 'chat/lobby_messages');
        }

        const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgs = Object.values(data) as ChatMessage[];
                setMessages(msgs.slice(-50));
            } else {
                setMessages([]);
            }
        });

        return () => unsubscribeMessages();
    }, [currentRoom?.id]);

    const sendMessage = (content: string) => {
        if (!user) return;
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            from: user.id,
            fromName: user.name,
            content,
            timestamp: Date.now(),
        };

        let messagesRef = ref(db, 'chat/lobby_messages');
        if (currentRoom) {
            messagesRef = ref(db, `rooms/${currentRoom.id}/messages`);
        }

        push(messagesRef, newMessage);
    };

    // --- Game Logic ---
    // Listen for Game State
    useEffect(() => {
        if (!currentGameId) {
            setGameState(null);
            setMahjongState(null);
            setBigTwoState(null);
            return;
        }
        const gameRef = ref(db, `games/${currentGameId}`);
        const unsubscribeGame = onValue(gameRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Check game type based on structure
                if (data.turnOrder) {
                    // Big Two game
                    const btState = data as BigTwoGameState;
                    // Normalize arrays from Firebase
                    btState.players = (btState.players || []).map(p => ({
                        ...p,
                        hand: Array.isArray(p.hand) ? p.hand : (p.hand ? Object.values(p.hand) : []),
                        cardCount: p.cardCount ?? (Array.isArray(p.hand) ? p.hand.length : (p.hand ? Object.values(p.hand).length : 0))
                    }));
                    btState.turnOrder = Array.isArray(btState.turnOrder) ? btState.turnOrder : Object.values(btState.turnOrder || {});
                    if (btState.lastPlay) {
                        btState.lastPlay.cards = Array.isArray(btState.lastPlay.cards) ? btState.lastPlay.cards : Object.values(btState.lastPlay.cards || {});
                    }
                    if (btState.centerCards) {
                        btState.centerCards = Array.isArray(btState.centerCards) ? btState.centerCards : Object.values(btState.centerCards || {});
                    }
                    setBigTwoState(btState);
                    setGameState(null);
                    setMahjongState(null);
                } else if (data.wall) {
                    setMahjongState(data as MahjongGameState);
                    setGameState(null);
                    setBigTwoState(null);
                } else {
                    const rawBoard = data.board || [];
                    const normalizedBoard = Array.from({ length: 32 }, (_, i) => rawBoard[i] || null);
                    const spectators = data.spectators ? Object.values(data.spectators) as UserProfile[] : [];
                    setGameState({
                        ...data,
                        board: normalizedBoard,
                        spectators
                    } as GameState);
                    setMahjongState(null);
                    setBigTwoState(null);
                }
            }
        });
        return () => unsubscribeGame();
    }, [currentGameId]);

    // Existing Game Logic (handleMove, handleFlip, etc.)...
    const handleMove = (from: number, to: number) => {
        if (isAdmin || !gameState || !currentGameId || !user) return;
        // Same logic as before... 
        // Copying previous implementation logic for brevity, assuming dark chess
        // Note: For other games, needs generic handler or switch
        if (currentRoom && currentRoom.gameType !== 'chinese_dark_chess') return;

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
        if (currentRoom && currentRoom.gameType !== 'chinese_dark_chess') return;

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
            if (piece.color !== gameState.currentPlayer) {
                const redP = gameState.players.red;
                const blackP = gameState.players.black;
                finalUpdates.players = {
                    red: blackP,
                    black: redP
                };
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

    // Existing Surrender, Rematch, etc.
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
        // Logic needs to adapt to room system (restart game in room)
        // For now keep simple
        alert("Rematch not fully refactored for room system yet");
    };

    const exitGame = async () => {
        if (!user || (!user.id && !user.name) || !currentGameId) return;
        await update(ref(db, `users/${user.id}`), { activeGameId: null });
        setCurrentGameId(null);
        // User remains in room
        if (currentRoom) {
            // Reset all players to not ready
            const resetPlayers = currentRoom.players.map(p => ({ ...p, isReady: false }));
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'waiting',
                players: resetPlayers
            });
        }
    };

    // Admin tools
    const clearChat = async () => { if (isAdmin) await remove(ref(db, 'chat')); };
    const clearGames = async () => {
        if (!isAdmin) return;
        await remove(ref(db, 'games'));
        await remove(ref(db, 'rooms'));
        setRooms([]);
    };
    const clearUsers = async () => { if (!isAdmin) await remove(ref(db, 'users')); };
    const clearStats = async () => {
        if (!isAdmin) return;
        // Implementation...
    };

    // --- Mahjong Logic ---

    const drawMahjongTile = async () => {
        if (!mahjongState || !currentGameId || !user) return;
        const currentPlayerId = mahjongState.currentTurn;

        // Validation
        if (currentPlayerId !== user.id && !currentPlayerId.startsWith('bot_')) return; // Only current player can draw (or host for bot)

        // Check if hand is already full (17 tiles)
        const playerIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const player = mahjongState.players[playerIndex];
        if ((player.hand || []).length % 3 === 2) return; // Already 17 (16+1) or similar. Standard 16-tile mahjong: 16 hand + 1 draw = 17.

        if (mahjongState.wall.length === 0) {
            alert("荒局 (流局)");
            update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
            return;
        }

        const newWall = [...mahjongState.wall];
        const tile = newWall.pop(); // Draw from end or front? Usually front.
        // Array.pop() takes from end. Let's say index 0 is front. 
        // Array.shift() takes from front.
        // Let's use shift for "front" of wall.
        // const tile = newWall.shift(); 
        // Actually, dealing usually takes from start. 
        // Let's assume initialized wall is [front ... back].

        // Wait, pop() is O(1), shift() is O(n). 
        // Let's just treat end of array as front of wall for performance, or just use pop. 
        // It's random anyway.

        if (!tile) return;

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: [...(player.hand || []), tile]
        };

        // Check Zimo (Self Draw Win)
        const canZimo = checkHu(newPlayers[playerIndex].hand);

        if (canZimo) {
            // For Zimo, we create a pendingAction where the player is BOTH fromPlayer and target
            await update(ref(db, `games/${currentGameId}`), {
                wall: newWall,
                wallCount: newWall.length,
                players: newPlayers,
                pendingAction: {
                    tile, // The drawn tile (already in hand, but useful context)
                    fromPlayer: currentPlayerId,
                    targetPlayers: [currentPlayerId],
                    actions: [{
                        playerId: currentPlayerId,
                        canHu: true
                    }]
                }
            });
        } else {
            await update(ref(db, `games/${currentGameId}`), {
                wall: newWall,
                wallCount: newWall.length,
                players: newPlayers
            });
        }
    };

    const discardMahjongTile = async (tileId: string) => {
        if (!mahjongState || !currentGameId) return; // Removed user check to allow bot actions
        const currentPlayerId = mahjongState.currentTurn;
        const playerIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const player = mahjongState.players[playerIndex];

        // Validate ownership
        const tileIndex = (player.hand || []).findIndex(t => t.id === tileId);
        if (tileIndex === -1) return;

        const tile = (player.hand || [])[tileIndex];
        const newHand = [...(player.hand || [])];
        newHand.splice(tileIndex, 1);
        // Sort hand? Maybe not auto-sort, keep position?
        // Usually auto-sort in UI or logic is helpful.
        newHand.sort((a, b) => {
            // specific sort order... simplified here or use helper
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return a.value - b.value;
        });

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: newHand,
            discarded: [...(player.discarded || []), tile]
        };

        // --- Checks for Melds (Chi, Pong, Kong, Hu) ---
        const pendingActions: {
            playerId: string;
            canChi?: boolean;
            canPong?: boolean;
            canKong?: boolean;
            canHu?: boolean;
        }[] = [];

        mahjongState.players.forEach(p => {
            if (p.id === currentPlayerId) return; // Cannot claim own discard

            // Pong/Kong (Any player)
            // Assuming canPong and canKong are defined elsewhere
            const pong = canPong(p.hand, tile);
            const kong = canKong(p.hand, tile);

            // Chi (Only next player)
            // Calculate next player index
            const isNextPlayer = (p.wind === (player.wind + 1) % 4); // Assuming wind is 0,1,2,3 for East, South, West, North
            // Assuming canChi is defined elsewhere
            const chi = isNextPlayer && canChi(p.hand, tile);

            // Hu (Any player)
            // Need to check if p.hand + tile forms a winning hand
            // checkHu expect array of tiles.
            const hu = checkHu([...p.hand, tile]);

            if (pong || kong || chi || hu) {
                pendingActions.push({
                    playerId: p.id,
                    canPong: pong,
                    canKong: kong,
                    canChi: chi,
                    canHu: hu
                });
            }
        });

        if (pendingActions.length > 0) {
            // Wait for action
            await update(ref(db, `games/${currentGameId}`), {
                players: newPlayers,
                pendingAction: {
                    tile,
                    fromPlayer: currentPlayerId,
                    targetPlayers: pendingActions.map(pa => pa.playerId),
                    actions: pendingActions
                },
                lastDiscard: {
                    tile,
                    player: currentPlayerId,
                    timestamp: Date.now()
                }
            });
        } else {
            // No one can claim, next turn
            const nextPlayerIndex = (playerIndex + 1) % 4;
            const nextPlayerId = mahjongState.players[nextPlayerIndex].id;

            await update(ref(db, `games/${currentGameId}`), {
                players: newPlayers,
                currentTurn: nextPlayerId,
                lastDiscard: {
                    tile,
                    player: currentPlayerId,
                    timestamp: Date.now()
                }
            });
        }
    };

    const performHu = async () => {
        if (!mahjongState || !currentGameId || !user) return;

        // Can be from pendingAction (Gun) or self-draw (Zimo)
        if (mahjongState.pendingAction) {
            const action = mahjongState.pendingAction.actions.find(a => a.playerId === user.id);
            if (!action || !action.canHu) return;

            const tile = mahjongState.pendingAction.tile;
            const playerIndex = mahjongState.players.findIndex(p => p.id === user.id);
            const player = mahjongState.players[playerIndex];

            const isZimo = false; // Gun (放槍) - someone else discarded
            const isLastTile = (mahjongState.wall || []).length === 0;

            const scoringResult = calculateScore({
                player,
                winningTile: tile,
                isZimo,
                isLastTile,
                isKongDraw: false,
                prevailingWind: mahjongState.prevailingWind,
                seatWind: player.wind
            });

            await update(ref(db, `games/${currentGameId}`), {
                gameStatus: 'ended',
                winner: user.id,
                winningHand: [...(player.hand || []), tile],
                scoringResult,
                isZimo,
                isLastTile,
                players: mahjongState.players.map(p =>
                    p.id === user.id ? { ...p, score: p.score + scoringResult.totalPoints } : p
                )
            });

            await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
        }
    };

    // Bot & Human Auto-Draw Logic Loop
    const botActionInProgress = useRef(false);
    useEffect(() => {
        if (!mahjongState || !currentRoom) return;

        const currentPlayerId = mahjongState.currentTurn;

        // 1. Bot Logic
        if (currentPlayerId.startsWith('bot_') && currentRoom.hostId === user?.id) {
            if (botActionInProgress.current) return;

            const botIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
            if (botIndex === -1) return;
            const botPlayer = mahjongState.players[botIndex];
            const handLen = (botPlayer.hand || []).length;

            let timer: ReturnType<typeof setTimeout>;

            if (handLen % 3 === 1) { // 16 tiles -> need to draw
                botActionInProgress.current = true;
                timer = setTimeout(async () => {
                    await drawMahjongTile();
                    botActionInProgress.current = false;
                }, 1000);
            } else if (handLen % 3 === 2) { // 17 tiles -> need to discard
                botActionInProgress.current = true;
                timer = setTimeout(async () => {
                    const hand = botPlayer.hand || [];
                    const randomTile = hand[Math.floor(Math.random() * hand.length)];
                    if (randomTile) await discardMahjongTile(randomTile.id);
                    botActionInProgress.current = false;
                }, 1500);
            }

            return () => {
                if (timer) clearTimeout(timer);
            };
        }

        // 2. Human Auto-Draw Logic
        if (currentPlayerId === user?.id) {
            const playerIndex = mahjongState.players.findIndex(p => p.id === user.id);
            if (playerIndex === -1) return;
            const player = mahjongState.players[playerIndex];

            // Auto-draw if 16 tiles
            if ((player.hand || []).length % 3 === 1) {
                // Small delay for visual clarity
                const timer = setTimeout(() => {
                    drawMahjongTile();
                }, 500);
                return () => clearTimeout(timer);
            }
        }

    }, [mahjongState?.currentTurn, currentRoom?.hostId, user?.id]);

    // Dark Chess Bot Logic
    useEffect(() => {
        if (!currentRoom || currentRoom.gameType !== 'chinese_dark_chess' || !gameState || !user || !currentGameId) return;
        if (gameState.gameStatus !== 'playing') return;

        const currentPlayerColor = gameState.currentPlayer; // 'red' or 'black'
        if (!currentPlayerColor) return;
        const currentPlayerId = currentPlayerColor === 'red' ? gameState.players.red?.id : gameState.players.black?.id;

        if (!currentPlayerId?.startsWith('bot_') || currentRoom.hostId !== user.id) return;

        const timer = setTimeout(async () => {
            // Re-check state is still valid
            if (!gameState || gameState.gameStatus !== 'playing' || !currentGameId) return;

            const board = [...gameState.board];
            const myPieces: { index: number, piece: Piece }[] = [];
            const unrevealed: number[] = [];

            board.forEach((p, i) => {
                if (p) {
                    if (!p.isFlipped) unrevealed.push(i);
                    else if (p.color === currentPlayerColor) myPieces.push({ index: i, piece: p });
                }
            });

            // --- Bot Flip (directly update Firebase) ---
            const botFlip = async (flipIndex: number) => {
                const newBoard = [...gameState.board];
                const piece = newBoard[flipIndex];
                if (!piece || piece.isFlipped) return;
                newBoard[flipIndex] = { ...piece, isFlipped: true };
                const nextPlayer = currentPlayerColor === 'red' ? 'black' : 'red';

                const finalUpdates: any = {
                    board: newBoard,
                    currentPlayer: nextPlayer,
                    turnStartTime: Date.now(),
                    lastMove: { from: flipIndex, to: flipIndex, type: 'flip' }
                };

                // Handle color assignment on first flip
                if (!gameState.isColorAssigned) {
                    finalUpdates.isColorAssigned = true;
                    if (piece.color !== currentPlayerColor) {
                        const redP = gameState.players.red;
                        const blackP = gameState.players.black;
                        finalUpdates.players = { red: blackP, black: redP };
                        finalUpdates.currentPlayer = currentPlayerColor;
                    }
                }

                await update(ref(db, `games/${currentGameId}`), finalUpdates);
            };

            // --- Bot Move/Capture (directly update Firebase) ---
            const botMove = async (from: number, to: number) => {
                const newBoard = [...gameState.board];
                const attacker = newBoard[from];
                const target = newBoard[to];
                if (!attacker) return;

                const currentCaptured = gameState.capturedPieces || { red: [], black: [] };
                const capturedPieces = {
                    red: Array.isArray(currentCaptured.red) ? [...currentCaptured.red] : Object.values(currentCaptured.red || {}),
                    black: Array.isArray(currentCaptured.black) ? [...currentCaptured.black] : Object.values(currentCaptured.black || {})
                };

                if (target) {
                    if (!canCapture(attacker, target, newBoard)) return;
                    if (currentPlayerColor === 'red') capturedPieces.red.push(target);
                    else capturedPieces.black.push(target);
                    newBoard[to] = { ...attacker, position: to };
                    newBoard[from] = null;
                } else {
                    if (!isValidMove(from, to)) return;
                    newBoard[to] = { ...attacker, position: to };
                    newBoard[from] = null;
                }

                const winner = checkWinner(newBoard);
                const nextPlayer = currentPlayerColor === 'red' ? 'black' : 'red';

                await update(ref(db, `games/${currentGameId}`), {
                    board: newBoard,
                    currentPlayer: winner ? null : nextPlayer,
                    gameStatus: winner ? 'ended' : 'playing',
                    winner: winner || null,
                    turnStartTime: Date.now(),
                    lastMove: { from, to, type: target ? 'capture' : 'move' },
                    capturedPieces
                });
            };

            // --- Bot Decision Logic ---

            // 1. Try to capture
            let possibleCaptures: { from: number, to: number }[] = [];
            for (const { index, piece } of myPieces) {
                for (let to = 0; to < board.length; to++) {
                    const target = board[to];
                    if (target && target.isFlipped && target.color !== currentPlayerColor) {
                        if (canCapture(piece, target, board)) {
                            possibleCaptures.push({ from: index, to });
                        }
                    }
                }
            }
            if (possibleCaptures.length > 0) {
                const move = possibleCaptures[Math.floor(Math.random() * possibleCaptures.length)];
                await botMove(move.from, move.to);
                return;
            }

            // 2. Flip or Move
            const shouldFlip = unrevealed.length > 0 && (Math.random() < 0.6 || myPieces.length === 0);
            if (shouldFlip) {
                const flipIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                await botFlip(flipIndex);
                return;
            }

            // 3. Random move
            let possibleMoves: { from: number, to: number }[] = [];
            for (const { index } of myPieces) {
                for (let to = 0; to < board.length; to++) {
                    if (!board[to] && isValidMove(index, to)) {
                        possibleMoves.push({ from: index, to });
                    }
                }
            }
            if (possibleMoves.length > 0) {
                const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                await botMove(move.from, move.to);
                return;
            }

            // 4. Fallback: flip if stuck
            if (unrevealed.length > 0) {
                const flipIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                await botFlip(flipIndex);
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [gameState?.currentPlayer, gameState?.gameStatus, currentRoom?.gameType, user?.id, currentGameId]);

    // --- Big Two Actions ---

    const playBigTwoCards = async (cardIds: string[]) => {
        if (!bigTwoState || !currentGameId || !user) return;
        if (bigTwoState.currentTurn !== user.id) return;

        const playerIndex = bigTwoState.players.findIndex(p => p.id === user.id);
        if (playerIndex === -1) return;
        const player = bigTwoState.players[playerIndex];

        const selectedCards = (player.hand || []).filter(c => cardIds.includes(c.id));
        if (selectedCards.length === 0) return;

        const isNewRound = bigTwoState.consecutivePasses >= (bigTwoState.players.filter(p => (p.hand?.length || 0) > 0).length - 1) || !bigTwoState.lastPlay;
        const isFirstPlay = !bigTwoState.lastPlay && bigTwoState.roundStarter === bigTwoState.turnOrder[0];

        const validation = isValidPlay(selectedCards, bigTwoState.lastPlay, isNewRound, isFirstPlay);
        if (!validation.valid || !validation.handType) {
            alert(validation.error || '不合法的出牌');
            return;
        }

        // Remove cards from hand
        const newHand = (player.hand || []).filter(c => !cardIds.includes(c.id));
        const newPlayers = [...bigTwoState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: newHand,
            cardCount: newHand.length
        };

        const newPlay: BigTwoPlay = {
            cards: selectedCards,
            handType: validation.handType,
            playerId: user.id
        };

        // Check win condition
        if (newHand.length === 0) {
            await update(ref(db, `games/${currentGameId}`), {
                players: newPlayers,
                lastPlay: newPlay,
                lastPlayerId: user.id,
                centerCards: selectedCards,
                consecutivePasses: 0,
                gameStatus: 'ended',
                winner: user.id
            });
            await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
            return;
        }

        // Next turn
        const currentTurnIdx = bigTwoState.turnOrder.indexOf(user.id);
        let nextTurnIdx = (currentTurnIdx + 1) % bigTwoState.turnOrder.length;
        // Skip players with no cards
        while (newPlayers.find(p => p.id === bigTwoState.turnOrder[nextTurnIdx])?.hand?.length === 0) {
            nextTurnIdx = (nextTurnIdx + 1) % bigTwoState.turnOrder.length;
        }

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            currentTurn: bigTwoState.turnOrder[nextTurnIdx],
            lastPlay: newPlay,
            lastPlayerId: user.id,
            centerCards: selectedCards,
            consecutivePasses: 0,
            roundStarter: user.id
        });
    };

    const passBigTwoTurn = async () => {
        if (!bigTwoState || !currentGameId || !user) return;
        if (bigTwoState.currentTurn !== user.id) return;

        const newPasses = (bigTwoState.consecutivePasses || 0) + 1;
        const activePlayers = bigTwoState.players.filter(p => (p.hand?.length || 0) > 0);

        const currentTurnIdx = bigTwoState.turnOrder.indexOf(user.id);
        let nextTurnIdx = (currentTurnIdx + 1) % bigTwoState.turnOrder.length;
        while (bigTwoState.players.find(p => p.id === bigTwoState.turnOrder[nextTurnIdx])?.hand?.length === 0) {
            nextTurnIdx = (nextTurnIdx + 1) % bigTwoState.turnOrder.length;
        }

        // If everyone else passed, round resets
        if (newPasses >= activePlayers.length - 1) {
            await update(ref(db, `games/${currentGameId}`), {
                currentTurn: bigTwoState.lastPlayerId || bigTwoState.turnOrder[nextTurnIdx],
                consecutivePasses: 0,
                lastPlay: null,
                centerCards: null,
                roundStarter: bigTwoState.lastPlayerId || bigTwoState.turnOrder[nextTurnIdx]
            });
        } else {
            await update(ref(db, `games/${currentGameId}`), {
                currentTurn: bigTwoState.turnOrder[nextTurnIdx],
                consecutivePasses: newPasses
            });
        }
    };

    // Big Two Bot Logic
    const bigTwoBotInProgress = useRef(false);
    useEffect(() => {
        if (!bigTwoState || !currentRoom || currentRoom.gameType !== 'big_two') return;
        if (bigTwoState.gameStatus !== 'playing') return;

        const currentPlayerId = bigTwoState.currentTurn;
        if (!currentPlayerId?.startsWith('bot_') || currentRoom.hostId !== user?.id) return;
        if (bigTwoBotInProgress.current) return;

        const playerIndex = bigTwoState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const botPlayer = bigTwoState.players[playerIndex];
        if ((botPlayer.hand?.length || 0) === 0) return;

        bigTwoBotInProgress.current = true;

        const timer = setTimeout(async () => {
            try {
                if (!bigTwoState || !currentGameId) return;

                const activePlayers = bigTwoState.players.filter(p => (p.hand?.length || 0) > 0);
                const isNewRound = (bigTwoState.consecutivePasses || 0) >= (activePlayers.length - 1) || !bigTwoState.lastPlay;
                const isFirstPlay = !bigTwoState.lastPlay && bigTwoState.roundStarter === bigTwoState.turnOrder[0];

                const selectedCards = botSelectCards(
                    botPlayer.hand || [],
                    bigTwoState.lastPlay || undefined,
                    isNewRound,
                    isFirstPlay
                );

                if (selectedCards) {
                    // Bot plays
                    const handType = detectHandType(selectedCards);
                    if (!handType) { bigTwoBotInProgress.current = false; return; }

                    const newHand = (botPlayer.hand || []).filter(c => !selectedCards.some(s => s.id === c.id));
                    const newPlayers = [...bigTwoState.players];
                    newPlayers[playerIndex] = { ...botPlayer, hand: newHand, cardCount: newHand.length };

                    const newPlay: BigTwoPlay = { cards: selectedCards, handType, playerId: currentPlayerId };

                    if (newHand.length === 0) {
                        await update(ref(db, `games/${currentGameId}`), {
                            players: newPlayers, lastPlay: newPlay, lastPlayerId: currentPlayerId,
                            centerCards: selectedCards, consecutivePasses: 0,
                            gameStatus: 'ended', winner: currentPlayerId
                        });
                        await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
                    } else {
                        const cIdx = bigTwoState.turnOrder.indexOf(currentPlayerId);
                        let nIdx = (cIdx + 1) % bigTwoState.turnOrder.length;
                        while (newPlayers.find(p => p.id === bigTwoState.turnOrder[nIdx])?.hand?.length === 0) {
                            nIdx = (nIdx + 1) % bigTwoState.turnOrder.length;
                        }
                        await update(ref(db, `games/${currentGameId}`), {
                            players: newPlayers, currentTurn: bigTwoState.turnOrder[nIdx],
                            lastPlay: newPlay, lastPlayerId: currentPlayerId,
                            centerCards: selectedCards, consecutivePasses: 0,
                            roundStarter: currentPlayerId
                        });
                    }
                } else {
                    // Bot passes
                    const newPasses = (bigTwoState.consecutivePasses || 0) + 1;
                    const cIdx = bigTwoState.turnOrder.indexOf(currentPlayerId);
                    let nIdx = (cIdx + 1) % bigTwoState.turnOrder.length;
                    while (bigTwoState.players.find(p => p.id === bigTwoState.turnOrder[nIdx])?.hand?.length === 0) {
                        nIdx = (nIdx + 1) % bigTwoState.turnOrder.length;
                    }

                    if (newPasses >= activePlayers.length - 1) {
                        await update(ref(db, `games/${currentGameId}`), {
                            currentTurn: bigTwoState.lastPlayerId || bigTwoState.turnOrder[nIdx],
                            consecutivePasses: 0, lastPlay: null, centerCards: null,
                            roundStarter: bigTwoState.lastPlayerId || bigTwoState.turnOrder[nIdx]
                        });
                    } else {
                        await update(ref(db, `games/${currentGameId}`), {
                            currentTurn: bigTwoState.turnOrder[nIdx],
                            consecutivePasses: newPasses
                        });
                    }
                }
            } finally {
                bigTwoBotInProgress.current = false;
            }
        }, 1200);

        return () => { clearTimeout(timer); bigTwoBotInProgress.current = false; };
    }, [bigTwoState?.currentTurn, bigTwoState?.gameStatus, currentRoom?.gameType, user?.id, currentGameId]);


    // --- Action Handlers ---

    const skipAction = async () => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction) return;

        // Remove user from targetPlayers
        const newTargetPlayers = mahjongState.pendingAction.targetPlayers.filter(id => id !== user?.id);

        if (newTargetPlayers.length === 0) {
            // All skipped, proceed to next turn
            // Need to find original discarder index
            const discarderId = mahjongState.pendingAction.fromPlayer;
            const discarderIndex = mahjongState.players.findIndex(p => p.id === discarderId);
            const nextPlayerIndex = (discarderIndex + 1) % 4;
            const nextPlayerId = mahjongState.players[nextPlayerIndex].id;

            await update(ref(db, `games/${currentGameId}`), {
                pendingAction: null,
                currentTurn: nextPlayerId
            });
        } else {
            // Update targetPlayers (waiting for others)
            await update(ref(db, `games/${currentGameId}/pendingAction`), {
                targetPlayers: newTargetPlayers
            });
        }
    };

    const performPong = async () => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction || !user) return;
        // Verify user can Pong
        const action = mahjongState.pendingAction.actions.find(a => a.playerId === user.id);
        if (!action || !action.canPong) return;

        const tile = mahjongState.pendingAction.tile;
        const playerIndex = mahjongState.players.findIndex(p => p.id === user.id);
        const player = mahjongState.players[playerIndex];

        // Remove 2 matching tiles from hand
        const newHand = [...(player.hand || [])];
        let removed = 0;
        for (let i = newHand.length - 1; i >= 0; i--) {
            if (newHand[i].suit === tile.suit && newHand[i].value === tile.value) {
                newHand.splice(i, 1);
                removed++;
                if (removed === 2) break;
            }
        }

        const newMeld: any = {
            type: 'pong',
            tiles: [tile, tile, tile], // 2 from hand + 1 discarded
            fromPlayer: mahjongState.pendingAction.fromPlayer
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: newHand,
            melds: [...(player.melds || []), newMeld]
        };

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            pendingAction: null,
            currentTurn: user.id // Turn shifts to Ponger
        });
    };

    const performKong = async () => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction || !user) return;
        // Verify user can Kong
        const action = mahjongState.pendingAction.actions.find(a => a.playerId === user.id);
        if (!action || !action.canKong) return;

        const tile = mahjongState.pendingAction.tile;
        const playerIndex = mahjongState.players.findIndex(p => p.id === user.id);
        const player = mahjongState.players[playerIndex];

        // Remove 3 matching tiles
        const newHand = [...(player.hand || [])];
        let removed = 0;
        for (let i = newHand.length - 1; i >= 0; i--) {
            if (newHand[i].suit === tile.suit && newHand[i].value === tile.value) {
                newHand.splice(i, 1);
                removed++;
                if (removed === 3) break;
            }
        }

        const newMeld: any = {
            type: 'kong',
            tiles: [tile, tile, tile, tile],
            fromPlayer: mahjongState.pendingAction.fromPlayer
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: newHand,
            melds: [...(player.melds || []), newMeld]
        };

        // Kong: Draw a replacement tile (Gang Shang Hua)
        if (mahjongState.wall.length > 0) {
            const newWall = [...mahjongState.wall];
            const replacementTile = newWall.pop();
            if (replacementTile) {
                newPlayers[playerIndex].hand.push(replacementTile);
                await update(ref(db, `games/${currentGameId}`), {
                    wall: newWall,
                    wallCount: newWall.length,
                    players: newPlayers,
                    pendingAction: null,
                    currentTurn: user.id
                });
                return;
            }
        }

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            pendingAction: null,
            currentTurn: user.id
        });
    };

    const performChi = async () => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction || !user) return;
        const action = mahjongState.pendingAction.actions.find(a => a.playerId === user.id);
        if (!action || !action.canChi) return;

        const tile = mahjongState.pendingAction.tile;
        const playerIndex = mahjongState.players.findIndex(p => p.id === user.id);
        const player = mahjongState.players[playerIndex];

        // Logic to find which tiles to eat (Simplified Greedy)
        const v = tile.value;
        const hand = player.hand || [];
        const has = (val: number) => hand.find(t => t.suit === tile.suit && t.value === val);

        let tilesToEat: any[] = [];

        if (has(v - 1) && has(v + 1)) {
            tilesToEat = [has(v - 1), has(v + 1)];
        } else if (has(v - 2) && has(v - 1)) {
            tilesToEat = [has(v - 2), has(v - 1)];
        } else if (has(v + 1) && has(v + 2)) {
            tilesToEat = [has(v + 1), has(v + 2)];
        }

        if (tilesToEat.length !== 2) return;

        const newHand = [...(player.hand || [])];
        tilesToEat.forEach(t => {
            const idx = newHand.findIndex(ht => ht.id === t.id);
            if (idx !== -1) newHand.splice(idx, 1);
        });

        const newMeld: any = {
            type: 'chow',
            tiles: [...tilesToEat, tile].sort((a, b) => a.value - b.value),
            fromPlayer: mahjongState.pendingAction.fromPlayer
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: newHand,
            melds: [...(player.melds || []), newMeld]
        };

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            pendingAction: null,
            currentTurn: user.id
        });
    };

    return {
        user,
        leaderboard,
        messages,
        gameState,
        mahjongState,
        bigTwoState,
        isAdmin,
        rooms,
        currentRoom,
        isInLobby,
        createRoom,
        joinRoom,
        leaveRoom,
        kickPlayer,
        startGame,
        sendMessage,
        handleMove,
        handleFlip,
        surrender,
        requestRematch,
        exitGame,
        joinSpectate: joinSpectateRoom, // Alias adapted
        clearChat,
        clearGames,
        clearUsers,
        clearStats,
        drawMahjongTile,
        discardMahjongTile,
        performChi,
        performPong,
        performKong,
        performHu,
        skipAction,
        toggleReady,
        playBigTwoCards,
        passBigTwoTurn
    };
};
