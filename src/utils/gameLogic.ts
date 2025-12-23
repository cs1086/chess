import type { Piece, PieceType, PieceColor } from '../types';

export const PIECE_VALUES: Record<PieceType, number> = {
    king: 7,
    advisor: 6,
    elephant: 5,
    rook: 4,
    knight: 3,
    cannon: 2,
    pawn: 1,
};

export const PIECE_NAMES_RED: Record<PieceType, string> = {
    king: '帥',
    advisor: '仕',
    elephant: '相',
    rook: '俥',
    knight: '傌',
    cannon: '炮',
    pawn: '兵',
};

export const PIECE_NAMES_BLACK: Record<PieceType, string> = {
    king: '將',
    advisor: '士',
    elephant: '象',
    rook: '車',
    knight: '馬',
    cannon: '包',
    pawn: '卒',
};

export function initializeBoard(): Piece[] {
    const pieces: { type: PieceType; color: PieceColor }[] = [];
    const counts: Record<PieceType, number> = {
        king: 1,
        advisor: 2,
        elephant: 2,
        rook: 2,
        knight: 2,
        cannon: 2,
        pawn: 5,
    };

    (['red', 'black'] as PieceColor[]).forEach((color) => {
        Object.entries(counts).forEach(([type, count]) => {
            for (let i = 0; i < count; i++) {
                pieces.push({ type: type as PieceType, color });
            }
        });
    });

    // Shuffle pieces
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    return pieces.map((p, index) => ({
        id: `${p.color}-${p.type}-${index}`,
        ...p,
        isFlipped: false,
        position: index,
    }));
}

const COLS = 8;

export function isValidMove(from: number, to: number): boolean {
    const fromRow = Math.floor(from / COLS);
    const fromCol = from % COLS;
    const toRow = Math.floor(to / COLS);
    const toCol = to % COLS;

    const rowDiff = Math.abs(fromRow - toRow);
    const colDiff = Math.abs(fromCol - toCol);

    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

export function canCapture(attacker: Piece, target: Piece, board: (Piece | null)[]): boolean {
    if (attacker.color === target.color) return false;
    if (!target.isFlipped) return false;

    const from = attacker.position;
    const to = target.position;

    // Cannon special rule: must have exactly one piece in between
    if (attacker.type === 'cannon') {
        const fromRow = Math.floor(from / COLS);
        const fromCol = from % COLS;
        const toRow = Math.floor(to / COLS);
        const toCol = to % COLS;

        if (fromRow !== toRow && fromCol !== toCol) return false;

        let count = 0;
        if (fromRow === toRow) {
            const minCol = Math.min(fromCol, toCol);
            const maxCol = Math.max(fromCol, toCol);
            for (let c = minCol + 1; c < maxCol; c++) {
                if (board[fromRow * COLS + c]) count++;
            }
        } else {
            const minRow = Math.min(fromRow, toRow);
            const maxRow = Math.max(fromRow, toRow);
            for (let r = minRow + 1; r < maxRow; r++) {
                if (board[r * COLS + fromCol]) count++;
            }
        }
        return count === 1;
    }

    // Normal capture: must be adjacent
    if (!isValidMove(from, to)) return false;

    // King vs Pawn special rule
    if (attacker.type === 'king' && target.type === 'pawn') return false;
    if (attacker.type === 'pawn' && target.type === 'king') return true;

    // Rank rule
    return PIECE_VALUES[attacker.type] >= PIECE_VALUES[target.type];
}

export function checkWinner(board: (Piece | null)[]): PieceColor | null {
    const redPieces = board.filter(p => p && p.color === 'red');
    const blackPieces = board.filter(p => p && p.color === 'black');

    if (redPieces.length === 0) return 'black';
    if (blackPieces.length === 0) return 'red';

    return null;
}

export function sortCapturedPieces(pieces: Piece[]): Piece[] {
    return [...pieces].sort((a, b) => PIECE_VALUES[b.type] - PIECE_VALUES[a.type]);
}
