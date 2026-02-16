export type PieceType = 'king' | 'advisor' | 'elephant' | 'rook' | 'knight' | 'cannon' | 'pawn';
export type PieceColor = 'red' | 'black';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  isFlipped: boolean;
  position: number; // 0-31
}

export interface GameState {
  board: (Piece | null)[];
  currentPlayer: PieceColor | null;
  players: {
    red?: PlayerInfo;
    black?: PlayerInfo;
  };
  gameStatus: 'waiting' | 'playing' | 'ended';
  winner?: PieceColor;
  lastMove?: {
    from: number;
    to: number;
    type: 'move' | 'capture' | 'flip';
  };
  turnStartTime?: number;
  capturedPieces?: {
    red: Piece[];
    black: Piece[];
  };
  rematch?: {
    red?: boolean;
    black?: boolean;
  };
  spectators?: UserProfile[];
  endReason?: 'normal' | 'surrender' | 'runaway';
  isColorAssigned?: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  wins: number;
  losses: number;
}

export interface UserProfile {
  id: string;
  name: string;
  wins: number;
  losses: number;
  surrenders: number;
  runaways: number;
  rejections: number;
  lastOnline: number;
  inChatRoom: boolean;
  isOnline: boolean;
  activeGameId?: string;
  sessionId?: string;
  isReady?: boolean;
}

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  content: string;
  timestamp: number;
  to?: string; // If present, it's a private message
}

export interface Challenge {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export type GameType =
  | 'chinese_dark_chess'
  | 'chinese_checkers_2'
  | 'gomoku'
  | 'go'
  | 'army_chess'
  | 'chess'
  | 'big_two'
  | 'sevens'
  | 'show_hand'
  | 'mahjong';

export interface Room {
  id: string;
  hostId: string;
  gameType: GameType;
  password?: string;
  allowSpectators: boolean;
  fillWithBots: boolean;
  players: UserProfile[];
  spectators: UserProfile[];
  maxPlayers: number;
  minPlayers: number;
  status: 'waiting' | 'playing' | 'ended';
  createdAt: number;
  name?: string; // Optional room name
}

// --- Mahjong Types ---

export type MahjongSuit = 'wan' | 'tong' | 'tiao' | 'wind' | 'dragon';

export interface MahjongTile {
  id: string;
  suit: MahjongSuit;
  value: number; // 1-9 (Suits), 1-4 (Wind: E,S,W,N), 1-3 (Dragon: Red, Green, White)
  index: number; // 0-143
}

export interface MahjongMeld {
  type: 'pong' | 'kong' | 'chow' | 'eye';
  tiles: MahjongTile[];
  fromPlayer?: string; // playerId
}

export interface MahjongPlayer {
  id: string;
  name: string;
  wind: number; // 0:East, 1:South, 2:West, 3:North (Seat)
  hand: MahjongTile[];
  melds: MahjongMeld[];
  discarded: MahjongTile[];
  score: number;
}

export interface MahjongGameState {
  players: MahjongPlayer[];
  wallCount: number;
  wall: MahjongTile[];
  currentTurn: string; // playerId
  dice: number[];
  prevailingWind: number; // 0:East, 1:South...
  dealer: number; // seat index 0-3
  round: number;
  totalRounds: number; // total rounds to play (e.g. 16)
  gameStatus: 'waiting' | 'playing' | 'ended';
  endReason?: 'hu' | 'zimo' | 'exhaustive_draw'; // why this round ended
  lastDiscard?: {
    tile: MahjongTile;
    player: string;
    timestamp: number;
  };
  winner?: string;
  winningHand?: MahjongTile[];
  pendingAction?: {
    tile: MahjongTile;
    fromPlayer: string;
    targetPlayers: string[];
    actions: {
      playerId: string;
      canChi?: boolean;
      canPong?: boolean;
      canKong?: boolean;
      canHu?: boolean;
    }[];
  };
  scoringResult?: {
    totalFan: number;
    items: { name: string; fan: number; description: string }[];
    basePoints: number;
    totalPoints: number;
  };
  isZimo?: boolean;
  isLastTile?: boolean;
  isKongDraw?: boolean;
  lastDrawnTileId?: string | null;
  discardedTiles?: MahjongTile[];
  lianZhuangCount?: number;
}

// --- Big Two Types ---

export type BigTwoSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export interface BigTwoCard {
  id: string;
  suit: BigTwoSuit;
  rank: number; // 3=3, 4=4, ..., 13=K, 14=A, 15=2
}

export type BigTwoHandType = 'single' | 'pair' | 'triple' | 'straight' | 'full_house' | 'four_of_a_kind' | 'straight_flush';

export interface BigTwoPlay {
  cards: BigTwoCard[];
  handType: BigTwoHandType;
  playerId: string;
}

export interface BigTwoPlayer {
  id: string;
  name: string;
  hand: BigTwoCard[];
  cardCount: number;
}

export interface BigTwoGameState {
  players: BigTwoPlayer[];
  currentTurn: string; // playerId
  turnOrder: string[]; // ordered playerIds
  lastPlay?: BigTwoPlay;
  lastPlayerId?: string;
  consecutivePasses: number;
  gameStatus: 'playing' | 'ended';
  winner?: string;
  centerCards?: BigTwoCard[]; // cards displayed in center
  roundStarter?: string; // who started the current round
  rankings?: string[]; // ordered player IDs from 1st to last
}

