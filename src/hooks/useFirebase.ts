
import { useState, useEffect, useRef } from 'react';
import { ref, set, onValue, push, update, remove, onDisconnect, increment } from 'firebase/database';
import { db } from '../firebase/config';
import type { UserProfile, ChatMessage, GameState, Room, GameType, MahjongGameState, MahjongPlayer, MahjongTile, Piece, BigTwoGameState, BigTwoPlayer, BigTwoPlay } from '../types';
import { initializeBoard, canCapture, isValidMove, checkWinner } from '../utils/gameLogic';
import {
    initializeMahjongDeck, shuffleTiles, dealTiles,
    canChi, canPong, canKong, findChiTiles, checkHu, sortHand
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
                    if (myRoom) {
                        setIsInLobby(false);
                        // Sync game ID if room is playing
                        if (myRoom.activeGameId && currentGameId !== myRoom.activeGameId) {
                            setCurrentGameId(myRoom.activeGameId);
                        }
                    }
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

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const d3 = Math.floor(Math.random() * 6) + 1;
            const dice = [d1, d2, d3];
            const diceSum = d1 + d2 + d3;
            const dealerIndex = (diceSum - 1) % 4;

            const playersList: MahjongPlayer[] = activePlayers.slice(0, 4).map((p, index) => {
                const relativeIndex = (index - dealerIndex + 4) % 4;
                return {
                    id: p.id,
                    name: p.name,
                    wind: relativeIndex,
                    hand: hands[relativeIndex],
                    melds: [],
                    discarded: [],
                    score: 0
                };
            });

            newMahjongGame = {
                players: playersList,
                wall,
                wallCount: wall.length,
                currentTurn: playersList[dealerIndex].id, // Dealer starts
                dice: dice,
                prevailingWind: 0, // East
                dealer: dealerIndex,
                gameStatus: 'playing',
                round: 1,
                totalRounds: 16,
                discardedTiles: [],
                lianZhuangCount: 0
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
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'playing',
                activeGameId: gameId
            });
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
                activeGameId: gameId,
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
                activeGameId: gameId,
            });
            currentRoom.players.forEach(p => {
                update(ref(db, `users/${p.id}`), { activeGameId: gameId });
            });
            setCurrentGameId(gameId);
        } else if (currentRoom.gameType !== 'big_two') {
            // Placeholder for other games (Big Two is handled above)
            // Just set the status to playing so they see the "開發中" screen
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'playing',
                activeGameId: gameId,
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
                } else if (data.wall !== undefined || data.prevailingWind !== undefined) {
                    // Mahjong game - normalize all arrays from Firebase
                    const toArray = (val: any): any[] => {
                        if (!val) return [];
                        if (Array.isArray(val)) return val;
                        if (typeof val === 'object') return Object.values(val);
                        return [];
                    };

                    const normalizedPlayers = toArray(data.players).map((p: any) => ({
                        ...p,
                        hand: toArray(p.hand),
                        discarded: toArray(p.discarded),
                        melds: toArray(p.melds).map((m: any) => ({
                            ...m,
                            tiles: toArray(m.tiles)
                        })),
                        score: p.score || 0,
                        wind: p.wind ?? 0,
                    }));

                    const normalizedState: MahjongGameState = {
                        ...data,
                        players: normalizedPlayers,
                        wall: toArray(data.wall),
                        wallCount: data.wallCount ?? toArray(data.wall).length,
                        dice: toArray(data.dice),
                        prevailingWind: data.prevailingWind ?? 0,
                        dealer: data.dealer ?? 0,
                        round: data.round ?? 1,
                        gameStatus: data.gameStatus || 'playing',
                        currentTurn: data.currentTurn || '',
                        discardedTiles: toArray(data.discardedTiles),
                    };

                    // Normalize pendingAction if present
                    if (data.pendingAction) {
                        normalizedState.pendingAction = {
                            ...data.pendingAction,
                            tile: data.pendingAction.tile,
                            fromPlayer: data.pendingAction.fromPlayer,
                            targetPlayers: toArray(data.pendingAction.targetPlayers),
                            actions: toArray(data.pendingAction.actions),
                        };
                    }

                    setMahjongState(normalizedState);
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

    const requestRematch = async () => {
        if (!user || !currentRoom) return;

        // For dark chess, just start a new game in the same room
        if (currentRoom.gameType === 'chinese_dark_chess') {
            const activePlayers = currentRoom.players.filter(p => p.id && !p.id.startsWith('bot_'));

            // Fill with bots if needed
            let allPlayers = [...activePlayers];
            if (currentRoom.fillWithBots) {
                const config = GAME_CONFIGS[currentRoom.gameType];
                const needed = (config?.maxPlayers || 2) - allPlayers.length;
                for (let i = 0; i < needed; i++) {
                    const botId = `bot_${Date.now()}_${i}`;
                    allPlayers.push({
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

            if (allPlayers.length < 2) {
                alert('人數不足，無法再戰一局');
                return;
            }

            const gameId = `game_${currentRoom.id}_${Date.now()}`;
            const initialBoard = initializeBoard();

            const p1 = allPlayers[0];
            const p2 = allPlayers[1];
            const p1IsRed = Math.random() > 0.5;

            const newGame: GameState = {
                board: initialBoard,
                currentPlayer: Math.random() > 0.5 ? 'red' : 'black',
                players: {
                    red: p1IsRed ? { ...p1, wins: 0, losses: 0 } : { ...p2, wins: 0, losses: 0 },
                    black: !p1IsRed ? { ...p1, wins: 0, losses: 0 } : { ...p2, wins: 0, losses: 0 }
                },
                gameStatus: 'playing',
                turnStartTime: Date.now(),
                isColorAssigned: false
            };

            await set(ref(db, `games/${gameId}`), newGame);
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'playing',
                activeGameId: gameId,
            });
            currentRoom.players.forEach(p => {
                update(ref(db, `users/${p.id}`), { activeGameId: gameId });
            });
            setCurrentGameId(gameId);
        } else {
            // For other game types, exit to room and let players ready up again
            await exitGame();
        }
    };

    const exitGame = async () => {
        console.log("useFirebase: exitGame called", { userId: user?.id, currentGameId, roomId: currentRoom?.id });
        if (!user) return;

        // Always try to clear activeGameId in DB if user is logged in
        if (user.id) {
            await update(ref(db, `users/${user.id}`), { activeGameId: null });
        }

        setCurrentGameId(null);

        // User remains in room, but we reset room status to waiting
        if (currentRoom) {
            // Reset all players to not ready
            const resetPlayers = (currentRoom.players || []).map(p => ({ ...p, isReady: false }));
            await update(ref(db, `rooms/${currentRoom.id}`), {
                status: 'waiting',
                players: resetPlayers,
                activeGameId: null
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
        if (mahjongState.gameStatus !== 'playing') return;
        if (mahjongState.pendingAction) return; // Don't draw while there's a pending action

        const currentPlayerId = mahjongState.currentTurn;
        if (currentPlayerId !== user.id && !currentPlayerId.startsWith('bot_')) return;

        const playerIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const player = mahjongState.players[playerIndex];
        const hand = player.hand || [];
        const meldCount = (player.melds || []).length;
        const effectiveSize = hand.length + meldCount * 3;

        // Already has enough tiles to discard (17 effective tiles)
        if (effectiveSize >= 17) return;

        const wall = mahjongState.wall || [];
        // Taiwan 16-tile Mahjong: 16 tiles are reserved at the end.
        // If normal draw would take from these 16, it's a draw (和局).
        if (wall.length <= 16) {
            // 流局 (Exhaustive draw)
            await update(ref(db, `games/${currentGameId}`), {
                gameStatus: 'ended',
                endReason: 'exhaustive_draw',
                pendingAction: null
            });
            await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
            return;
        }

        const newWall = [...wall];
        const tile = newWall.pop();
        if (!tile) return;

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: sortHand([...hand, tile])
        };

        // Check Zimo (Self Draw Win)
        const canZimo = checkHu(newPlayers[playerIndex].hand);

        if (canZimo) {
            await update(ref(db, `games/${currentGameId}`), {
                wall: newWall,
                wallCount: newWall.length,
                players: newPlayers,
                lastDrawnTileId: tile.id,
                pendingAction: {
                    tile,
                    fromPlayer: currentPlayerId,
                    targetPlayers: [currentPlayerId],
                    actions: [{ playerId: currentPlayerId, canHu: true }]
                }
            });
        } else {
            await update(ref(db, `games/${currentGameId}`), {
                wall: newWall,
                wallCount: newWall.length,
                players: newPlayers,
                lastDrawnTileId: tile.id,
            });
        }
    };

    const discardMahjongTile = async (tileId: string) => {
        console.log('discardMahjongTile called:', tileId);
        if (!mahjongState || !currentGameId) {
            console.log('Discard failed: state or gameId missing', { mahjongState: !!mahjongState, currentGameId });
            return;
        }
        if (mahjongState.gameStatus !== 'playing') {
            console.log('Discard failed: game not in playing status', mahjongState.gameStatus);
            return;
        }
        if (mahjongState.pendingAction) {
            console.log('Discard failed: pending action exists', mahjongState.pendingAction);
            return; // Can't discard while pending action
        }

        const currentPlayerId = mahjongState.currentTurn;
        if (currentPlayerId !== user?.id && !currentPlayerId.startsWith('bot_')) {
            console.log('Discard failed: Not your turn or not a bot', { current: currentPlayerId, me: user?.id });
            return;
        }

        const playerIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const player = mahjongState.players[playerIndex];
        const hand = player.hand || [];

        const tileIndex = hand.findIndex(t => t.id === tileId);
        if (tileIndex === -1) return;

        const tile = hand[tileIndex];
        const newHand = [...hand];
        newHand.splice(tileIndex, 1);

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = {
            ...player,
            hand: sortHand(newHand),
            discarded: [...(player.discarded || []), tile]
        };

        // Check if other players can claim the discarded tile (Chi, Pong, Kong, Hu)
        const pendingActions: {
            playerId: string;
            canChi?: boolean;
            canPong?: boolean;
            canKong?: boolean;
            canHu?: boolean;
        }[] = [];

        for (const p of mahjongState.players) {
            if (p.id === currentPlayerId) continue;
            if (!p.hand || p.hand.length === 0) continue;

            try {
                const pongResult = canPong(p.hand, tile);
                const kongResult = canKong(p.hand, tile);
                const isNextPlayer = (p.wind === (player.wind + 1) % 4);
                const chiResult = isNextPlayer ? canChi(p.hand, tile) : false;
                const huResult = checkHu([...p.hand, tile]);

                if (pongResult || kongResult || chiResult || huResult) {
                    pendingActions.push({
                        playerId: p.id,
                        canPong: pongResult || false,
                        canKong: kongResult || false,
                        canChi: chiResult || false,
                        canHu: huResult || false
                    });
                }
            } catch (e) {
                console.error(`Error checking claims for player ${p.id}:`, e);
            }
        }

        const updateData: any = {
            players: newPlayers,
            lastDrawnTileId: null,
            lastDiscard: {
                tile,
                player: currentPlayerId,
                timestamp: Date.now()
            },
            discardedTiles: [...(mahjongState.discardedTiles || []), tile]
        };

        if (pendingActions.length > 0) {
            // Priority: Hu(3) > Pong/Kong(2) > Chi(1)
            const getScore = (pa: any) => {
                if (pa.canHu) return 3;
                if (pa.canPong || pa.canKong) return 2;
                if (pa.canChi) return 1;
                return 0;
            };

            const maxScore = Math.max(...pendingActions.map(getScore));
            const highestPriorityPlayers = pendingActions.filter(pa => getScore(pa) === maxScore);

            let firstTargetId = '';
            if (maxScore === 3) {
                // Multiple Hu: Pick the one closest to discarder downstream (playerIndex)
                highestPriorityPlayers.sort((a, b) => {
                    const idxA = mahjongState.players.findIndex(p => p.id === a.playerId);
                    const idxB = mahjongState.players.findIndex(p => p.id === b.playerId);
                    const distA = (idxA - playerIndex + 4) % 4;
                    const distB = (idxB - playerIndex + 4) % 4;
                    return distA - distB;
                });
                firstTargetId = highestPriorityPlayers[0].playerId;
            } else {
                // Pong/Kong/Chi normally only one player can do these per discard
                firstTargetId = highestPriorityPlayers[0].playerId;
            }

            updateData.pendingAction = {
                tile,
                fromPlayer: currentPlayerId,
                targetPlayers: [firstTargetId],
                actions: pendingActions
            };
        } else {
            // No one can claim, advance to next turn
            const nextPlayerIndex = (playerIndex + 1) % mahjongState.players.length;
            const nextPlayerId = mahjongState.players[nextPlayerIndex]?.id;
            updateData.currentTurn = nextPlayerId;
            updateData.pendingAction = null;
        }

        try {
            await update(ref(db, `games/${currentGameId}`), updateData);
        } catch (e) {
            console.error('Error updating game state after discard:', e);
        }
    };

    // Unified action handlers are defined below in the "Action Handlers" section.


    // Bot & Human Mahjong Logic
    const mahjongBotInProgress = useRef(false);

    // Helper: determine if a player needs to draw or discard
    // In 16-tile Mahjong: each player starts with 16 tiles.
    // After melds, hand shrinks. The total tiles accounted for = hand + melds*3.
    // Need to draw: total == 16 (or any multiple where hand needs +1)
    // Need to discard: total == 17 (hand has an extra tile to discard)
    const getPlayerTileState = (player: MahjongPlayer): 'need_draw' | 'need_discard' | 'waiting' => {
        const hand = (player.hand || []);
        const meldCount = (player.melds || []).length;
        const effectiveHandSize = hand.length + meldCount * 3;
        // 16 → need draw, 17 → need discard
        if (effectiveHandSize <= 16) return 'need_draw';
        if (effectiveHandSize >= 17) return 'need_discard';
        return 'waiting';
    };

    // Effect 1: Bot auto-respond to pendingAction (Sequential Priority)
    useEffect(() => {
        if (!mahjongState || !currentRoom || !user || !currentGameId) return;
        if (mahjongState.gameStatus !== 'playing') return;
        if (!mahjongState.pendingAction) return;
        if (currentRoom.hostId !== user.id) return; // Only host processes bots

        const pa = mahjongState.pendingAction;
        const currentTargetId = pa.targetPlayers?.[0];

        if (!currentTargetId?.startsWith('bot_')) return;

        const timer = setTimeout(async () => {
            // Re-fetch state logic or rely on mahjongState update
            if (!mahjongState?.pendingAction || !currentGameId) return;
            const updatedPA = mahjongState.pendingAction;
            // Ensure we are still the target
            if (updatedPA.targetPlayers?.[0] !== currentTargetId) return;

            const botAction = updatedPA.actions.find(a => a.playerId === currentTargetId);
            if (!botAction) {
                if (typeof skipActionForPlayer === 'function') await skipActionForPlayer(currentTargetId);
                return;
            }

            // Priority: Hu > Pong/Kong > Chi > Skip
            if (botAction.canHu) {
                if (typeof performHuForPlayer === 'function') await performHuForPlayer(currentTargetId);
                return;
            }
            if (botAction.canPong && Math.random() < 0.8) {
                if (typeof performPongForPlayer === 'function') await performPongForPlayer(currentTargetId);
                return;
            }
            if (botAction.canKong && Math.random() < 0.8) {
                if (typeof performKongForPlayer === 'function') await performKongForPlayer(currentTargetId, updatedPA.tile);
                return;
            }
            if (botAction.canChi && Math.random() < 0.5) {
                if (typeof performChiForPlayer === 'function') await performChiForPlayer(currentTargetId, updatedPA.tile);
                return;
            }

            if (typeof skipActionForPlayer === 'function') await skipActionForPlayer(currentTargetId);
        }, 1200);

        return () => clearTimeout(timer);
    }, [mahjongState?.pendingAction, currentRoom?.hostId, user?.id, currentGameId]);

    // Effect 2: Bot draw/discard & Human auto-draw
    useEffect(() => {
        if (!mahjongState || !currentRoom || !currentGameId) return;
        if (mahjongState.gameStatus !== 'playing') return;
        if (mahjongState.pendingAction) return; // Don't act while pending action exists

        const currentPlayerId = mahjongState.currentTurn;
        if (!currentPlayerId) return;

        const playerIndex = mahjongState.players.findIndex(p => p.id === currentPlayerId);
        if (playerIndex === -1) return;
        const currentPlayer = mahjongState.players[playerIndex];
        const tileState = getPlayerTileState(currentPlayer);

        // Bot Logic (host processes bot turns)
        if (currentPlayerId.startsWith('bot_') && currentRoom.hostId === user?.id) {
            if (mahjongBotInProgress.current) return;
            mahjongBotInProgress.current = true;

            const timer = setTimeout(async () => {
                try {
                    if (!mahjongState || mahjongState.gameStatus !== 'playing' || mahjongState.pendingAction) {
                        return;
                    }

                    const pi = mahjongState.players.findIndex(p => p.id === currentPlayerId);
                    if (pi === -1) return;
                    const botPlayer = mahjongState.players[pi];
                    const state = getPlayerTileState(botPlayer);

                    if (state === 'need_draw') {
                        // Bot draws AND discards in one atomic operation
                        const wall = mahjongState.wall || [];
                        if (wall.length === 0) {
                            await update(ref(db, `games/${currentGameId}`), {
                                gameStatus: 'ended',
                                endReason: 'exhaustive_draw'
                            });
                            await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
                            return;
                        }

                        const newWall = [...wall];
                        const drawnTile = newWall.pop();
                        if (!drawnTile) return;

                        const newHand = sortHand([...(botPlayer.hand || []), drawnTile]);

                        // Check Zimo first
                        if (checkHu(newHand)) {
                            // Bot wins by self-draw! Just update the state
                            const newPlayers = [...mahjongState.players];
                            newPlayers[pi] = { ...botPlayer, hand: newHand };
                            await update(ref(db, `games/${currentGameId}`), {
                                wall: newWall,
                                wallCount: newWall.length,
                                players: newPlayers,
                                gameStatus: 'ended',
                                endReason: 'zimo',
                                winner: currentPlayerId
                            });
                            await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
                            return;
                        }

                        // Bot discards a random tile from the new hand
                        const tileToDiscard = newHand[Math.floor(Math.random() * newHand.length)];
                        const discardHand = newHand.filter(t => t.id !== tileToDiscard.id);

                        const newPlayers = [...mahjongState.players];
                        newPlayers[pi] = {
                            ...botPlayer,
                            hand: sortHand(discardHand),
                            discarded: [...(botPlayer.discarded || []), tileToDiscard]
                        };

                        // Check if other players can claim the discard
                        const pendingActions: {
                            playerId: string;
                            canChi?: boolean;
                            canPong?: boolean;
                            canKong?: boolean;
                            canHu?: boolean;
                        }[] = [];

                        for (const p of mahjongState.players) {
                            if (p.id === currentPlayerId) continue;
                            if (!p.hand || p.hand.length === 0) continue;
                            try {
                                const pongResult = canPong(p.hand, tileToDiscard);
                                const kongResult = canKong(p.hand, tileToDiscard);
                                const isNextPlayer = (p.wind === (botPlayer.wind + 1) % 4);
                                const chiResult = isNextPlayer ? canChi(p.hand, tileToDiscard) : false;
                                const huResult = checkHu([...p.hand, tileToDiscard]);
                                if (pongResult || kongResult || chiResult || huResult) {
                                    pendingActions.push({
                                        playerId: p.id,
                                        canPong: pongResult || false,
                                        canKong: kongResult || false,
                                        canChi: chiResult || false,
                                        canHu: huResult || false
                                    });
                                }
                            } catch (e) {
                                console.error(`Error checking claims for player ${p.id}:`, e);
                            }
                        }

                        const updateData: any = {
                            wall: newWall,
                            wallCount: newWall.length,
                            players: newPlayers,
                            lastDiscard: {
                                tile: tileToDiscard,
                                player: currentPlayerId,
                                timestamp: Date.now()
                            },
                            discardedTiles: [...(mahjongState.discardedTiles || []), tileToDiscard]
                        };

                        if (pendingActions.length > 0) {
                            updateData.pendingAction = {
                                tile: tileToDiscard,
                                fromPlayer: currentPlayerId,
                                targetPlayers: pendingActions.map(pa => pa.playerId),
                                actions: pendingActions
                            };
                        } else {
                            const nextPlayerIndex = (pi + 1) % mahjongState.players.length;
                            updateData.currentTurn = mahjongState.players[nextPlayerIndex]?.id;
                            updateData.pendingAction = null;
                        }

                        await update(ref(db, `games/${currentGameId}`), updateData);

                    } else if (state === 'need_discard') {
                        // Bot already has 17 tiles, just discard
                        const hand = botPlayer.hand || [];
                        if (hand.length > 0) {
                            const randomTile = hand[Math.floor(Math.random() * hand.length)];
                            if (randomTile?.id) await discardMahjongTile(randomTile.id);
                        }
                    }
                } catch (e) {
                    console.error('Bot turn error:', e);
                } finally {
                    mahjongBotInProgress.current = false;
                }
            }, 1000);

            return () => {
                clearTimeout(timer);
                mahjongBotInProgress.current = false;
            };
        }

        // Human auto-draw
        if (currentPlayerId === user?.id && tileState === 'need_draw') {
            const timer = setTimeout(() => {
                drawMahjongTile();
            }, 400);
            return () => clearTimeout(timer);
        }

    }, [mahjongState, currentRoom?.hostId, user?.id, currentGameId]);

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

    const performHuForPlayer = async (playerId: string) => {
        if (!mahjongState || !currentGameId) return;
        const pa = mahjongState.pendingAction;
        const tile = pa ? pa.tile : (mahjongState.lastDiscard?.tile);
        if (!tile) return;

        const playerIndex = mahjongState.players.findIndex(p => p.id === playerId);
        const player = mahjongState.players[playerIndex];
        const isZimo = !pa;
        const isLastTile = (mahjongState.wallCount || 0) === 0;

        const currentDealerIndex = mahjongState.dealer;
        const currentDealerId = mahjongState.players[currentDealerIndex]?.id;
        const lianZhuangCount = mahjongState.lianZhuangCount || 0;

        // Taiwan Rules: Add Zhuang Fan if winner is dealer OR winner took dealer's discard
        const isDealerWin = playerId === currentDealerId;
        const isDealerLoss = (pa && pa.fromPlayer === currentDealerId);
        const shouldAddZhuangFan = !!(isDealerWin || isDealerLoss);

        const scoringResult = calculateScore({
            player,
            winningTile: tile,
            isZimo,
            isLastTile,
            isKongDraw: mahjongState.isKongDraw || false,
            prevailingWind: mahjongState.prevailingWind,
            seatWind: player.wind,
            isDealer: shouldAddZhuangFan,
            lianZhuangCount: lianZhuangCount
        });

        const fromPlayerId = pa?.fromPlayer || '';

        const updatedPlayers = mahjongState.players.map((p: any) => {
            let newScore = p.score || 0;
            if (p.id === playerId) {
                // Winner gets points
                if (isZimo) {
                    newScore += scoringResult.totalPoints * 3;
                } else {
                    newScore += scoringResult.totalPoints;
                }
            } else if (isZimo) {
                // Everyone else pays if Zimo
                newScore -= scoringResult.totalPoints;
            } else if (p.id === fromPlayerId) {
                // Discarder pays if Rong
                newScore -= scoringResult.totalPoints;
            }
            return { ...p, score: newScore };
        });

        await update(ref(db, `games/${currentGameId}`), {
            gameStatus: 'ended',
            endReason: 'hu',
            winner: playerId,
            winningHand: [...(player.hand || []), tile],
            scoringResult,
            isZimo,
            isLastTile,
            players: updatedPlayers
        });
        await update(ref(db, `rooms/${currentRoom?.id}`), { status: 'ended' });
    };

    const performHu = () => user && performHuForPlayer(user.id);

    const performPongForPlayer = async (playerId: string) => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction) return;
        const tile = mahjongState.pendingAction.tile;
        const playerIndex = mahjongState.players.findIndex(p => p.id === playerId);
        const player = mahjongState.players[playerIndex];

        const newHand = [...(player.hand || [])];
        let removed = 0;
        for (let i = newHand.length - 1; i >= 0; i--) {
            if (newHand[i].suit === tile.suit && newHand[i].value === tile.value) {
                newHand.splice(i, 1);
                removed++;
                if (removed === 2) break;
            }
        }

        const fromPlayerId = mahjongState.pendingAction.fromPlayer;
        const fromPlayerIndex = mahjongState.players.findIndex(p => p.id === fromPlayerId);

        const newMeld: any = {
            type: 'pong',
            tiles: [tile, tile, tile],
            fromPlayer: fromPlayerId
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = { ...player, hand: sortHand(newHand), melds: [...(player.melds || []), newMeld] };

        // Remove from fromPlayer's discarded list
        if (fromPlayerIndex !== -1) {
            const fromP = newPlayers[fromPlayerIndex];
            const newDiscarded = (fromP.discarded || []).filter(t => t.id !== tile.id);
            newPlayers[fromPlayerIndex] = { ...fromP, discarded: newDiscarded };
        }

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            pendingAction: null,
            currentTurn: playerId,
            lastDrawnTileId: null,
            discardedTiles: (mahjongState.discardedTiles || []).filter((t: any) => t.id !== tile.id)
        });
    };

    const performPong = () => user && performPongForPlayer(user.id);

    const performKongForPlayer = async (playerId: string, tile?: MahjongTile) => {

        if (!mahjongState || !currentGameId) return;
        const targetTile = tile || (mahjongState.pendingAction?.tile);
        if (!targetTile) return;

        const playerIndex = mahjongState.players.findIndex(p => p.id === playerId);
        const player = mahjongState.players[playerIndex];

        const newHand = [...(player.hand || [])];
        let removed = 0;
        for (let i = newHand.length - 1; i >= 0; i--) {
            if (newHand[i].suit === targetTile.suit && newHand[i].value === targetTile.value) {
                newHand.splice(i, 1);
                removed++;
                if (removed === 3) break;
            }
        }

        const fromPlayerId = mahjongState.pendingAction?.fromPlayer || playerId;
        const fromPlayerIndex = mahjongState.players.findIndex(p => p.id === fromPlayerId);

        const newMeld: any = {
            type: 'kong',
            tiles: [targetTile, targetTile, targetTile, targetTile],
            fromPlayer: fromPlayerId
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = { ...player, hand: sortHand(newHand), melds: [...(player.melds || []), newMeld] };

        // Remove from fromPlayer's discarded list (if it was from a discard)
        if (mahjongState.pendingAction && fromPlayerIndex !== -1) {
            const fromP = newPlayers[fromPlayerIndex];
            const newDiscarded = (fromP.discarded || []).filter(t => t.id !== targetTile.id);
            newPlayers[fromPlayerIndex] = { ...fromP, discarded: newDiscarded };
        }

        const updateData: any = {
            players: newPlayers,
            pendingAction: null,
            currentTurn: playerId,
            discardedTiles: (mahjongState.discardedTiles || []).filter((t: any) => t.id !== targetTile.id)
        };

        if (mahjongState.wall.length > 0) {
            const newWall = [...mahjongState.wall];
            // Taiwan 16-tile Mahjong: Kong补牌 (Replacement) is taken from the "tail" of the dead wall
            // If pop() is head, shift() is tail.
            const replacementTile = newWall.shift();
            if (replacementTile) {
                newPlayers[playerIndex].hand = sortHand([...newPlayers[playerIndex].hand, replacementTile]);
                await update(ref(db, `games/${currentGameId}`), {
                    ...updateData,
                    wall: newWall,
                    wallCount: newWall.length,
                    lastDrawnTileId: replacementTile.id,
                    isKongDraw: true
                });
                return;
            }
        }

        await update(ref(db, `games/${currentGameId}`), {
            ...updateData,
            lastDrawnTileId: null
        });
    };

    const performKong = () => user && performKongForPlayer(user.id);

    const performChiForPlayer = async (playerId: string, tile?: MahjongTile) => {

        if (!mahjongState || !currentGameId) return;
        const targetTile = tile || (mahjongState.pendingAction?.tile);
        if (!targetTile) return;

        const playerIndex = mahjongState.players.findIndex(p => p.id === playerId);
        const player = mahjongState.players[playerIndex];

        const chiOptions = findChiTiles(player.hand || [], targetTile);
        if (chiOptions.length === 0) return;

        const tilesToUse = chiOptions[0];
        const newHand = [...(player.hand || [])];
        for (const t of tilesToUse) {
            const idx = newHand.findIndex(h => h.id === t.id);
            if (idx !== -1) newHand.splice(idx, 1);
        }

        const fromPlayerId = mahjongState.pendingAction?.fromPlayer || '';
        const fromPlayerIndex = mahjongState.players.findIndex(p => p.id === fromPlayerId);

        const newMeld: any = {
            type: 'chow',
            tiles: sortHand([...tilesToUse, targetTile]),
            fromPlayer: fromPlayerId
        };

        const newPlayers = [...mahjongState.players];
        newPlayers[playerIndex] = { ...player, hand: sortHand(newHand), melds: [...(player.melds || []), newMeld] };

        // Remove from fromPlayer's discarded list
        if (fromPlayerIndex !== -1) {
            const fromP = newPlayers[fromPlayerIndex];
            const newDiscarded = (fromP.discarded || []).filter(t => t.id !== targetTile.id);
            newPlayers[fromPlayerIndex] = { ...fromP, discarded: newDiscarded };
        }

        await update(ref(db, `games/${currentGameId}`), {
            players: newPlayers,
            pendingAction: null,
            currentTurn: playerId,
            lastDrawnTileId: null,
            discardedTiles: (mahjongState.discardedTiles || []).filter((t: any) => t.id !== targetTile.id)
        });
    };

    const performChi = () => user && performChiForPlayer(user.id);

    const skipActionForPlayer = async (playerId: string) => {
        if (!mahjongState || !currentGameId || !mahjongState.pendingAction) return;

        const pa = mahjongState.pendingAction;
        const discarderId = pa.fromPlayer;
        const discarderIndex = mahjongState.players.findIndex(p => p.id === discarderId);

        const remainingActions = pa.actions.filter(a => a.playerId !== playerId);

        if (remainingActions.length === 0) {
            // No more actions
            if (pa.fromPlayer === playerId) {
                // Self-draw (Zimo) skip: Stay in turn to discard
                await update(ref(db, `games/${currentGameId}`), {
                    pendingAction: null
                });
            } else {
                // Claim skip: advance to next player's draw
                const nextPlayerId = mahjongState.players[(discarderIndex + 1) % 4].id;
                await update(ref(db, `games/${currentGameId}`), {
                    pendingAction: null,
                    currentTurn: nextPlayerId
                });
            }
        } else {
            // Pick next priority actor
            const getScore = (a: any) => { if (a.canHu) return 3; if (a.canPong || a.canKong) return 2; if (a.canChi) return 1; return 0; };
            const maxRem = Math.max(...remainingActions.map(getScore));
            const bestPlayers = remainingActions.filter(a => getScore(a) === maxRem);

            let nextActorId = bestPlayers[0].playerId;
            if (maxRem === 3) {
                bestPlayers.sort((a, b) => {
                    const idxA = mahjongState.players.findIndex(p => p.id === a.playerId);
                    const idxB = mahjongState.players.findIndex(p => p.id === b.playerId);
                    return ((idxA - discarderIndex + 4) % 4) - ((idxB - discarderIndex + 4) % 4);
                });
                nextActorId = bestPlayers[0].playerId;
            }
            await update(ref(db, `games/${currentGameId}/pendingAction`), {
                targetPlayers: [nextActorId],
                actions: remainingActions
            });
        }
    };

    const skipAction = () => user && skipActionForPlayer(user.id);




    const startNextRound = async () => {
        if (!mahjongState || !currentGameId || !currentRoom || !user) return;
        if (mahjongState.gameStatus !== 'ended') return;
        if (currentRoom.hostId !== user.id) return; // Only host starts next round

        const currentDealerId = mahjongState.players[mahjongState.dealer]?.id;
        const dealerWon = mahjongState.winner === currentDealerId;
        const isDraw = mahjongState.endReason === 'exhaustive_draw';
        const isLianZhuang = dealerWon || isDraw;

        let nextDealer = mahjongState.dealer;
        let nextRound = mahjongState.round || 1;
        let nextLianZhuangCount = (mahjongState.lianZhuangCount || 0);

        if (isLianZhuang) {
            nextLianZhuangCount += 1;
        } else {
            nextDealer = (mahjongState.dealer + 1) % 4;
            nextRound += 1;
            nextLianZhuangCount = 0;
        }

        const totalRounds = mahjongState.totalRounds || 16;

        if (nextRound > totalRounds) {
            // All rounds complete
            return;
        }

        // Prevailing wind changes every 4 successful rounds (dealer passes)
        const nextPrevailingWind = Math.floor((nextRound - 1) / 4) % 4;

        // Re-deal tiles
        const tiles = shuffleTiles(initializeMahjongDeck());
        const { hands, wall } = dealTiles(tiles);

        // Preserve scores, rotate winds based on new dealer
        const newPlayers: MahjongPlayer[] = mahjongState.players.map((p, index) => ({
            id: p.id,
            name: p.name,
            wind: (index - nextDealer + 4) % 4, // wind relative to dealer
            hand: hands[index],
            melds: [],
            discarded: [],
            score: p.score // keep accumulated score
        }));

        const newRoundState: MahjongGameState = {
            players: newPlayers,
            wall,
            wallCount: wall.length,
            currentTurn: newPlayers[nextDealer].id, // Dealer starts
            dice: [1, 1, 1],
            prevailingWind: nextPrevailingWind,
            dealer: nextDealer,
            gameStatus: 'playing',
            round: nextRound,
            totalRounds,
            discardedTiles: [],
            lianZhuangCount: nextLianZhuangCount
        };

        await set(ref(db, `games/${currentGameId}`), newRoundState);
        await update(ref(db, `rooms/${currentRoom.id}`), { status: 'playing' });
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
        startNextRound,
        toggleReady,
        playBigTwoCards,
        passBigTwoTurn
    };
};
