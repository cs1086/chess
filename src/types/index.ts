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
}

export interface PlayerInfo {
  id: string;
  name: string;
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
