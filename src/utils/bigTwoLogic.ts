import type { BigTwoCard, BigTwoSuit, BigTwoHandType, BigTwoPlay } from '../types';

// Suit order: clubs < diamonds < hearts < spades
const SUIT_ORDER: Record<BigTwoSuit, number> = {
    clubs: 0,
    diamonds: 1,
    hearts: 2,
    spades: 3
};

// Rank order: 3 < 4 < ... < K < A < 2
// Stored as: 3=3, 4=4, ..., 10=10, J=11, Q=12, K=13, A=14, 2=15

export const RANK_NAMES: Record<number, string> = {
    3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};

export const SUIT_SYMBOLS: Record<BigTwoSuit, string> = {
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥',
    spades: '♠'
};

export const SUIT_COLORS: Record<BigTwoSuit, string> = {
    clubs: '#1a1a2e',
    diamonds: '#c0392b',
    hearts: '#c0392b',
    spades: '#1a1a2e'
};

// --- Deck ---

export function initializeBigTwoDeck(): BigTwoCard[] {
    const suits: BigTwoSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
    const cards: BigTwoCard[] = [];
    let idx = 0;
    for (const suit of suits) {
        for (let rank = 3; rank <= 15; rank++) {
            cards.push({
                id: `bt_${suit}_${rank}`,
                suit,
                rank
            });
            idx++;
        }
    }
    return cards;
}

export function shuffleBigTwoDeck(cards: BigTwoCard[]): BigTwoCard[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function dealBigTwoCards(deck: BigTwoCard[]): BigTwoCard[][] {
    const hands: BigTwoCard[][] = [[], [], [], []];
    for (let i = 0; i < deck.length; i++) {
        hands[i % 4].push(deck[i]);
    }
    // Sort each hand
    hands.forEach(hand => hand.sort(compareBigTwoCards));
    return hands;
}

// --- Card Comparison ---

export function compareBigTwoCards(a: BigTwoCard, b: BigTwoCard): number {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
}

function getHighCard(cards: BigTwoCard[]): BigTwoCard {
    return cards.reduce((max, c) => compareBigTwoCards(c, max) > 0 ? c : max, cards[0]);
}

// --- Hand Type Detection ---

export function detectHandType(cards: BigTwoCard[]): BigTwoHandType | null {
    const n = cards.length;
    if (n === 1) return 'single';
    if (n === 2) return isPair(cards) ? 'pair' : null;
    if (n === 3) return isTriple(cards) ? 'triple' : null;
    if (n === 5) return detect5CardHand(cards);
    return null;
}

function isPair(cards: BigTwoCard[]): boolean {
    return cards.length === 2 && cards[0].rank === cards[1].rank;
}

function isTriple(cards: BigTwoCard[]): boolean {
    return cards.length === 3 && cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank;
}

function detect5CardHand(cards: BigTwoCard[]): BigTwoHandType | null {
    const sorted = [...cards].sort(compareBigTwoCards);
    const ranks = sorted.map(c => c.rank);

    const isStraightCheck = isConsecutive(ranks);
    const isFlushCheck = sorted.every(c => c.suit === sorted[0].suit);

    if (isStraightCheck && isFlushCheck) return 'straight_flush';
    if (isFourOfAKind(ranks)) return 'four_of_a_kind';
    if (isFullHouse(ranks)) return 'full_house';
    if (isFlushCheck) return null; // Flush alone is not valid in Big Two
    if (isStraightCheck) return 'straight';

    return null;
}

function isConsecutive(ranks: number[]): boolean {
    const sorted = [...ranks].sort((a, b) => a - b);
    // Special straights in Big Two: A-2-3-4-5 is NOT valid
    // Valid straights: consecutive ranks
    // Handle wrap: 3-4-5-6-7 ... 10-J-Q-K-A
    // 2 (rank 15) cannot be part of a straight except as highest in J-Q-K-A-2? 
    // In standard Taiwan Big Two: 2 cannot be in straights
    // A (14) can be: 10-J-Q-K-A
    // But NOT: Q-K-A-2-3 or A-2-3-4-5

    // If 2 (15) is present, not a valid straight
    if (sorted.includes(15)) return false;

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
}

function isFourOfAKind(ranks: number[]): boolean {
    const counts = getRankCounts(ranks);
    return Object.values(counts).some(c => c === 4);
}

function isFullHouse(ranks: number[]): boolean {
    const counts = getRankCounts(ranks);
    const vals = Object.values(counts).sort();
    return vals.length === 2 && vals[0] === 2 && vals[1] === 3;
}

function getRankCounts(ranks: number[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const r of ranks) {
        counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
}

// --- Hand Comparison ---

// Hand type power level for comparing across types
const HAND_TYPE_POWER: Record<BigTwoHandType, number> = {
    single: 0,
    pair: 0,
    triple: 0,
    straight: 1,
    full_house: 2,
    four_of_a_kind: 3,
    straight_flush: 4
};

/**
 * Compare two plays. Returns true if `play` beats `lastPlay`.
 */
export function canBeatPlay(play: BigTwoPlay, lastPlay: BigTwoPlay): boolean {
    // Different card counts = invalid (unless special bomb rules)
    if (play.cards.length !== lastPlay.cards.length) {
        // Four of a kind (5 cards) and straight flush can beat any 5-card hand
        if (play.cards.length === 5 && lastPlay.cards.length === 5) {
            if (HAND_TYPE_POWER[play.handType] > HAND_TYPE_POWER[lastPlay.handType]) {
                return true;
            }
            if (HAND_TYPE_POWER[play.handType] < HAND_TYPE_POWER[lastPlay.handType]) {
                return false;
            }
            // Same power level, compare by representative card
        } else {
            return false;
        }
    }

    // Same card count + same type (or same power level for 5-card)
    if (play.handType !== lastPlay.handType && play.cards.length === 5) {
        // Already handled power comparison above, if we got here they are same power
        // which shouldn't happen with different types. But just in case:
        return HAND_TYPE_POWER[play.handType] > HAND_TYPE_POWER[lastPlay.handType];
    }

    if (play.handType !== lastPlay.handType) return false;

    // Compare same hand types
    switch (play.handType) {
        case 'single':
            return compareBigTwoCards(play.cards[0], lastPlay.cards[0]) > 0;

        case 'pair':
        case 'triple':
            return compareBigTwoCards(getHighCard(play.cards), getHighCard(lastPlay.cards)) > 0;

        case 'straight':
        case 'straight_flush': {
            const playHigh = getHighCard(play.cards);
            const lastHigh = getHighCard(lastPlay.cards);
            return compareBigTwoCards(playHigh, lastHigh) > 0;
        }

        case 'full_house': {
            // Compare by the triple part
            const playTripleRank = getTripleRank(play.cards);
            const lastTripleRank = getTripleRank(lastPlay.cards);
            return playTripleRank > lastTripleRank;
        }

        case 'four_of_a_kind': {
            const playFourRank = getFourRank(play.cards);
            const lastFourRank = getFourRank(lastPlay.cards);
            return playFourRank > lastFourRank;
        }

        default:
            return false;
    }
}

function getTripleRank(cards: BigTwoCard[]): number {
    const counts = getRankCounts(cards.map(c => c.rank));
    for (const [rank, count] of Object.entries(counts)) {
        if (count === 3) return Number(rank);
    }
    return 0;
}

function getFourRank(cards: BigTwoCard[]): number {
    const counts = getRankCounts(cards.map(c => c.rank));
    for (const [rank, count] of Object.entries(counts)) {
        if (count === 4) return Number(rank);
    }
    return 0;
}

// --- Validation ---

export function isValidPlay(
    cards: BigTwoCard[],
    lastPlay: BigTwoPlay | undefined,
    isNewRound: boolean,
    isFirstPlayOfGame: boolean
): { valid: boolean; handType: BigTwoHandType | null; error?: string } {
    if (cards.length === 0) {
        return { valid: false, handType: null, error: '請選擇要出的牌' };
    }

    const handType = detectHandType(cards);
    if (!handType) {
        return { valid: false, handType: null, error: '不合法的牌型' };
    }

    // First play of entire game must include ♣3
    if (isFirstPlayOfGame) {
        const hasClub3 = cards.some(c => c.suit === 'clubs' && c.rank === 3);
        if (!hasClub3) {
            return { valid: false, handType, error: '第一手必須包含♣3' };
        }
    }

    // New round (everyone else passed or first play) - any valid play is fine
    if (isNewRound || !lastPlay) {
        return { valid: true, handType };
    }

    // Must beat last play
    const play: BigTwoPlay = { cards, handType, playerId: '' };
    if (!canBeatPlay(play, lastPlay)) {
        return { valid: false, handType, error: '必須出比上家更大的牌' };
    }

    return { valid: true, handType };
}

// --- Find Club 3 holder ---

export function findClub3Holder(hands: BigTwoCard[][]): number {
    for (let i = 0; i < hands.length; i++) {
        if (hands[i].some(c => c.suit === 'clubs' && c.rank === 3)) {
            return i;
        }
    }
    return 0;
}

// --- Bot Logic ---

export function botSelectCards(
    hand: BigTwoCard[],
    lastPlay: BigTwoPlay | undefined,
    isNewRound: boolean,
    isFirstPlayOfGame: boolean
): BigTwoCard[] | null {
    const sorted = [...hand].sort(compareBigTwoCards);

    if (isNewRound || !lastPlay) {
        // Bot starts a new round
        if (isFirstPlayOfGame) {
            // Must include club 3
            const club3 = sorted.find(c => c.suit === 'clubs' && c.rank === 3);
            if (club3) return [club3];
        }
        // Play lowest single
        return [sorted[0]];
    }

    // Try to beat last play
    const cardCount = lastPlay.cards.length;

    if (cardCount === 1) {
        // Find smallest card that beats last play
        for (const card of sorted) {
            if (compareBigTwoCards(card, lastPlay.cards[0]) > 0) {
                return [card];
            }
        }
    } else if (cardCount === 2 && lastPlay.handType === 'pair') {
        // Find smallest pair that beats
        const pairs = findPairs(sorted);
        const lastHigh = getHighCard(lastPlay.cards);
        for (const pair of pairs) {
            if (compareBigTwoCards(getHighCard(pair), lastHigh) > 0) {
                return pair;
            }
        }
    } else if (cardCount === 5) {
        // Try to find a 5-card hand that beats
        const fiveCardHands = find5CardHands(sorted);
        for (const fiveHand of fiveCardHands) {
            const handType = detectHandType(fiveHand);
            if (handType) {
                const play: BigTwoPlay = { cards: fiveHand, handType, playerId: '' };
                if (canBeatPlay(play, lastPlay)) {
                    return fiveHand;
                }
            }
        }
    }

    // Can't beat, pass
    return null;
}

function findPairs(sorted: BigTwoCard[]): BigTwoCard[][] {
    const pairs: BigTwoCard[][] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].rank === sorted[i + 1].rank) {
            pairs.push([sorted[i], sorted[i + 1]]);
            i++; // skip next
        }
    }
    return pairs;
}

function find5CardHands(sorted: BigTwoCard[]): BigTwoCard[][] {
    const hands: BigTwoCard[][] = [];

    // Find straights
    for (let i = 0; i <= sorted.length - 5; i++) {
        const candidate = sorted.slice(i, i + 5);
        if (detectHandType(candidate) !== null) {
            hands.push(candidate);
        }
    }

    // Find full houses
    const rankCounts = getRankCounts(sorted.map(c => c.rank));
    for (const [tripleRank, count] of Object.entries(rankCounts)) {
        if (count >= 3) {
            const triples = sorted.filter(c => c.rank === Number(tripleRank)).slice(0, 3);
            for (const [pairRank, pCount] of Object.entries(rankCounts)) {
                if (pairRank !== tripleRank && pCount >= 2) {
                    const pairs = sorted.filter(c => c.rank === Number(pairRank)).slice(0, 2);
                    hands.push([...triples, ...pairs]);
                }
            }
        }
    }

    return hands;
}

// --- Sort hand for display ---
export function sortHand(hand: BigTwoCard[]): BigTwoCard[] {
    return [...hand].sort(compareBigTwoCards);
}
