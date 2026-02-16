import type { MahjongTile, MahjongSuit } from '../types';

export const SUITS: MahjongSuit[] = ['wan', 'tong', 'tiao', 'wind', 'dragon'];

export function initializeMahjongDeck(): MahjongTile[] {
    const tiles: MahjongTile[] = [];
    let index = 0;

    // 1. Wan, Tong, Tiao (1-9, 4 of each)
    const simpleSuits: MahjongSuit[] = ['wan', 'tong', 'tiao'];
    simpleSuits.forEach(suit => {
        for (let value = 1; value <= 9; value++) {
            for (let i = 0; i < 4; i++) {
                tiles.push({
                    id: `${suit}-${value}-${i}`,
                    suit: suit,
                    value,
                    index: index++
                });
            }
        }
    });

    // 2. Winds (East, South, West, North, 4 of each)
    // Values: 1=East, 2=South, 3=West, 4=North
    for (let value = 1; value <= 4; value++) {
        for (let i = 0; i < 4; i++) {
            tiles.push({
                id: `wind-${value}-${i}`,
                suit: 'wind',
                value,
                index: index++
            });
        }
    }

    // 3. Dragons (Red, Green, White, 4 of each)
    // Values: 1=Red(中), 2=Green(發), 3=White(白)
    for (let value = 1; value <= 3; value++) {
        for (let i = 0; i < 4; i++) {
            tiles.push({
                id: `dragon-${value}-${i}`,
                suit: 'dragon',
                value,
                index: index++
            });
        }
    }



    return tiles;
}

export function shuffleTiles(tiles: MahjongTile[]): MahjongTile[] {
    const shuffled = [...tiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function sortHand(hand: MahjongTile[]): MahjongTile[] {
    const suitOrder: Record<string, number> = {
        'wan': 0,
        'tong': 1,
        'tiao': 2,
        'wind': 3,
        'dragon': 4,
        'flower': 5
    };

    return [...hand].sort((a, b) => {
        // Suit comparison
        const orderA = suitOrder[a.suit] ?? 99;
        const orderB = suitOrder[b.suit] ?? 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        // Value comparison within same suit
        return (a.value || 0) - (b.value || 0);
    });
}



export function dealTiles(shuffledTiles: MahjongTile[]): {
    hands: MahjongTile[][];
    wall: MahjongTile[];
} {
    const tiles = [...shuffledTiles];
    const hands: MahjongTile[][] = [[], [], [], []];

    // Deal 16 tiles to each player
    for (let i = 0; i < 16; i++) {
        for (let p = 0; p < 4; p++) {
            const tile = tiles.pop();
            if (tile) hands[p].push(tile);
        }
    }

    // Dealer (player 0) draws one more (the 17th tile)
    const dealerTile = tiles.pop();
    if (dealerTile) hands[0].push(dealerTile);

    // Sort hands efficiently
    for (let i = 0; i < 4; i++) {
        hands[i] = sortHand(hands[i]);
    }

    return {
        hands,
        wall: tiles
    };
}

export function canPong(hand: MahjongTile[], tile: MahjongTile): boolean {
    if (!hand || !tile || hand.length < 2) return false;
    const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
    return count >= 2;
}

export function canKong(hand: MahjongTile[], tile: MahjongTile): boolean {
    if (!hand || !tile || hand.length < 3) return false;
    const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
    return count === 3;
}

export function canChi(hand: MahjongTile[], tile: MahjongTile): boolean {
    if (!hand || !tile || hand.length < 2) return false;
    // Chi only for number suits (Wan, Tong, Tiao)
    if (['wind', 'dragon'].includes(tile.suit)) return false;

    const sameSuit = hand.filter(t => t.suit === tile.suit);
    const v = tile.value;

    const has = (val: number) => sameSuit.some(t => t.value === val);

    if (has(v + 1) && has(v + 2)) return true;
    if (has(v - 1) && has(v + 1)) return true;
    if (has(v - 2) && has(v - 1)) return true;

    return false;
}

export function findChiTiles(hand: MahjongTile[], tile: MahjongTile): MahjongTile[][] {
    if (!canChi(hand, tile)) return [];
    const v = tile.value;
    const sameSuit = hand.filter(t => t.suit === tile.suit);
    const has = (val: number) => sameSuit.filter(t => t.value === val);

    const options: MahjongTile[][] = [];

    // Case 1: [v+1, v+2]
    const s1 = has(v + 1), s2 = has(v + 2);
    if (s1.length > 0 && s2.length > 0) options.push([s1[0], s2[0]]);

    // Case 2: [v-1, v+1]
    const m1 = has(v - 1), m2 = has(v + 1);
    if (m1.length > 0 && m2.length > 0) options.push([m1[0], m2[0]]);

    // Case 3: [v-2, v-1]
    const b1 = has(v - 2), b2 = has(v - 1);
    if (b1.length > 0 && b2.length > 0) options.push([b1[0], b2[0]]);

    return options;
}

export function checkHu(hand: MahjongTile[]): boolean {
    if (!hand || hand.length < 2) return false;
    // Taiwan 16-tile Mahjong: 17 tiles to win (16 in hand + 1 new)
    // Needs 5 sets (Pong/Kong/Chi) + 1 pair (Eye)
    // The hand passed here includes the new tile.
    // Winning hand: (n*3 + 2) tiles where n = number of sets
    if (hand.length % 3 !== 2) return false;

    // Standard approach:
    // Sort hand
    const sortedHand = sortHand(hand);

    // Try to find a pair
    const uniquePairs = new Set<string>();
    for (let i = 0; i < sortedHand.length - 1; i++) {
        if (sortedHand[i].suit === sortedHand[i + 1].suit && sortedHand[i].value === sortedHand[i + 1].value) {
            uniquePairs.add(`${sortedHand[i].suit}-${sortedHand[i].value}`);
        }
    }

    for (const pairKey of Array.from(uniquePairs)) {
        const [suit, valStr] = pairKey.split('-');
        const value = parseInt(valStr);

        // Remove pair
        const remaining = [...sortedHand];
        const p1 = remaining.findIndex(t => t.suit === suit && t.value === value);
        remaining.splice(p1, 1);
        const p2 = remaining.findIndex(t => t.suit === suit && t.value === value);
        remaining.splice(p2, 1);

        if (canFormSets(remaining)) return true;
    }

    return false;
}

function canFormSets(tiles: MahjongTile[]): boolean {
    if (tiles.length === 0) return true;

    // Try to form a set with the first tile
    const first = tiles[0];

    // 1. Pong (Triplet)
    if (canPong(tiles, first)) { // Use existing helper but need to verify it checks for 3 including first
        // canPong checks if hand has 2 matching 'first'. `tiles` includes `first` here?
        // Wait, `canPong` logic was: count >= 2. If tiles has 3, count will be 3 (inc first) or 2 (exc first)? 
        // My canPong implementation: `hand.filter(...).length >= 2`.
        // If I pass `tiles` (which includes `first`) and `first` to canPong, it counts itself?
        // Let's rewrite simple logic here for backtracking:

        const tripCount = tiles.filter(t => t.suit === first.suit && t.value === first.value).length;
        if (tripCount >= 3) {
            // Simpler: Find 3 indices
            const indices = tiles.map((t, i) => (t.suit === first.suit && t.value === first.value) ? i : -1).filter(i => i !== -1).slice(0, 3);
            if (indices.length === 3) {
                const stepTiles = [...tiles];
                // Remove from back to keep indices valid? No, map/filter is safer.
                // Just remove 3 matches.
                let removed = 0;
                const nextTiles = stepTiles.filter(t => {
                    if (removed < 3 && t.suit === first.suit && t.value === first.value) {
                        removed++;
                        return false;
                    }
                    return true;
                });
                if (canFormSets(nextTiles)) return true;
            }
        }
    }

    // 2. Chi (Sequence) - Only for number suits
    if (['wan', 'tong', 'tiao'].includes(first.suit)) {
        const v = first.value;
        const secondIdx = tiles.findIndex(t => t.suit === first.suit && t.value === v + 1);
        const thirdIdx = tiles.findIndex(t => t.suit === first.suit && t.value === v + 2);

        if (secondIdx !== -1 && thirdIdx !== -1) {
            const nextTiles = [...tiles];
            // Remove carefully (indices shift)
            // Remove largest index first
            const indices = [0, secondIdx, thirdIdx].sort((a, b) => b - a);
            indices.forEach(i => nextTiles.splice(i, 1));

            if (canFormSets(nextTiles)) return true;
        }
    }

    return false;
}

export interface WaitingStatus {
    hu: string[];
    pong: string[];
    kong: string[];
    chi: string[];
}

export function getWaitingStatus(hand: MahjongTile[]): WaitingStatus {
    const status: WaitingStatus = { hu: [], pong: [], kong: [], chi: [] };
    if (!hand || hand.length === 0) return status;

    const uniqueTiles: { suit: MahjongSuit, value: number, name: string }[] = [];

    // Helper to get name
    const getName = (s: MahjongSuit, v: number) => {
        if (s === 'wan') return `${v}萬`;
        if (s === 'tong') return `${v}筒`;
        if (s === 'tiao') return `${v}索`;
        if (s === 'wind') return ['東', '南', '西', '北'][v - 1] + '風';
        if (s === 'dragon') return ['中', '發', '白'][v - 1];
        return `${s}-${v}`;
    };

    // 1. Get unique tile types to check
    const suits: MahjongSuit[] = ['wan', 'tong', 'tiao', 'wind', 'dragon'];
    for (const s of suits) {
        const maxVal = (s === 'wind') ? 4 : (s === 'dragon') ? 3 : 9;
        for (let v = 1; v <= maxVal; v++) {
            uniqueTiles.push({ suit: s, value: v, name: getName(s, v) });
        }
    }

    // 2. Check each tile
    for (const t of uniqueTiles) {
        const dummyTile = { id: 'dummy', suit: t.suit, value: t.value, index: 0 };

        // Hu? (Only if hand size is correct for 17-tile win: 16 in hand + 1 dummy)
        if (hand.length === 16) {
            if (checkHu([...hand, dummyTile])) status.hu.push(t.name);
        }

        // Pong?
        if (canPong(hand, dummyTile)) status.pong.push(t.name);

        // Kong?
        if (canKong(hand, dummyTile)) status.kong.push(t.name);

        // Chi?
        if (canChi(hand, dummyTile)) status.chi.push(t.name);
    }

    return status;
}
