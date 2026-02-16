import type { MahjongTile, MahjongPlayer, MahjongSuit } from '../types';

// --- Scoring Result Types ---
export interface FanItem {
    name: string;       // 台數名稱
    fan: number;        // 台數
    description: string; // 說明
}

export interface ScoringResult {
    totalFan: number;
    items: FanItem[];
    basePoints: number;  // 底分
    totalPoints: number; // 總分
}

// --- Internal Helpers ---


/** Check if a tile is a number suit (wan/tong/tiao) */
function isNumberSuit(suit: MahjongSuit): boolean {
    return suit === 'wan' || suit === 'tong' || suit === 'tiao';
}


/** Check if a tile is an honor (wind or dragon) */
function isHonor(suit: MahjongSuit): boolean {
    return suit === 'wind' || suit === 'dragon';
}


/** Get all unique tile identifiers in a set */
function tileKey(suit: MahjongSuit, value: number): string {
    return `${suit}-${value}`;
}

// --- Decompose hand into sets + pair ---
// Returns ALL valid decompositions so scoring can pick the best one

interface Decomposition {
    pair: { suit: MahjongSuit; value: number };
    sets: Array<{
        type: 'pong' | 'chow';
        suit: MahjongSuit;
        value: number; // for pong: tile value, for chow: start value
    }>;
}

function decomposeHand(tiles: MahjongTile[]): Decomposition[] {
    const results: Decomposition[] = [];

    // Try each possible pair
    const tried = new Set<string>();
    for (let i = 0; i < tiles.length - 1; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i].suit === tiles[j].suit && tiles[i].value === tiles[j].value) {
                const key = tileKey(tiles[i].suit, tiles[i].value);
                if (tried.has(key)) continue;
                tried.add(key);

                // Remove pair and try to form sets with remaining
                const remaining = [...tiles];
                remaining.splice(j, 1); // remove j first (larger index)
                remaining.splice(i, 1);

                const sets: Decomposition['sets'] = [];
                if (trySets(remaining, sets)) {
                    results.push({
                        pair: { suit: tiles[i].suit, value: tiles[i].value },
                        sets: [...sets]
                    });
                }
            }
        }
    }

    return results;
}

function trySets(tiles: MahjongTile[], sets: Decomposition['sets']): boolean {
    if (tiles.length === 0) return true;

    // Sort for consistency
    const sorted = [...tiles].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.value - b.value;
    });

    const first = sorted[0];

    // Try pong (triplet)
    const sameCount = sorted.filter(t => t.suit === first.suit && t.value === first.value).length;
    if (sameCount >= 3) {
        let removed = 0;
        const remaining = sorted.filter(t => {
            if (removed < 3 && t.suit === first.suit && t.value === first.value) {
                removed++;
                return false;
            }
            return true;
        });
        sets.push({ type: 'pong', suit: first.suit, value: first.value });
        if (trySets(remaining, sets)) return true;
        sets.pop();
    }

    // Try chow (sequence) - only for number suits
    if (isNumberSuit(first.suit)) {
        const v = first.value;
        const secondIdx = sorted.findIndex(t => t.suit === first.suit && t.value === v + 1);
        const thirdIdx = sorted.findIndex(t => t.suit === first.suit && t.value === v + 2);

        if (secondIdx !== -1 && thirdIdx !== -1) {
            const remaining = [...sorted];
            const indices = [0, secondIdx, thirdIdx].sort((a, b) => b - a);
            indices.forEach(i => remaining.splice(i, 1));

            sets.push({ type: 'chow', suit: first.suit, value: v });
            if (trySets(remaining, sets)) return true;
            sets.pop();
        }
    }

    return false;
}

// --- Main Scoring Function ---

export interface ScoringContext {
    player: MahjongPlayer;
    winningTile: MahjongTile;
    isZimo: boolean;            // 自摸
    isLastTile: boolean;        // 海底撈月 (last tile from wall)
    isKongDraw: boolean;        // 槓上開花 (won from replacement draw after kong)
    prevailingWind: number;     // 圈風 (0=East, 1=South, 2=West, 3=North)
    seatWind: number;           // 門風 (player's wind seat)
    isDealer: boolean;          // 是否為莊家
    lianZhuangCount: number;    // 連莊次數
}

export function calculateScore(ctx: ScoringContext): ScoringResult {
    const { player, winningTile, isZimo, isLastTile, isKongDraw, prevailingWind, seatWind, isDealer, lianZhuangCount } = ctx;

    const hand = [...(player.hand || [])];
    const melds = [...(player.melds || [])];
    const fullHand = [...hand, winningTile]; // complete hand for decomposition

    // Are there any exposed melds? (門清 = no exposed melds)
    const isMenqing = melds.length === 0;

    // Decompose the concealed hand
    const decompositions = decomposeHand(fullHand);

    // Combine with declared melds for scoring
    // We'll score each decomposition and pick the highest

    let bestScore = 0;
    let bestItems: FanItem[] = [];

    for (const decomp of decompositions) {
        const currentItems: FanItem[] = [];

        // Build complete set list: declared melds + concealed sets
        const allSets: Array<{
            type: 'pong' | 'kong' | 'chow';
            suit: MahjongSuit;
            value: number;
            isConcealed: boolean;
        }> = [];

        // Add declared melds
        for (const meld of melds) {
            if (meld.tiles.length > 0) {
                const t = meld.tiles[0];
                allSets.push({
                    type: meld.type === 'kong' ? 'kong' : meld.type === 'pong' ? 'pong' : 'chow',
                    suit: t.suit,
                    value: meld.type === 'chow' ? Math.min(...meld.tiles.map((x: MahjongTile) => x.value)) : t.value,
                    isConcealed: false
                });
            }
        }

        // Add concealed sets from decomposition
        for (const s of decomp.sets) {
            allSets.push({
                type: s.type === 'pong' ? 'pong' : 'chow',
                suit: s.suit,
                value: s.value,
                isConcealed: true
            });
        }

        const pair = decomp.pair;

        // Collect all tiles for suit analysis
        const allTiles: { suit: MahjongSuit; value: number }[] = [];
        allTiles.push(pair, pair); // pair counts as 2
        for (const s of allSets) {
            if (s.type === 'chow') {
                allTiles.push({ suit: s.suit, value: s.value });
                allTiles.push({ suit: s.suit, value: s.value + 1 });
                allTiles.push({ suit: s.suit, value: s.value + 2 });
            } else {
                const count = s.type === 'kong' ? 4 : 3;
                for (let i = 0; i < count; i++) {
                    allTiles.push({ suit: s.suit, value: s.value });
                }
            }
        }

        const pongSets = allSets.filter(s => s.type === 'pong' || s.type === 'kong');
        const chowSets = allSets.filter(s => s.type === 'chow');
        const concealedPongs = allSets.filter(s => (s.type === 'pong' || s.type === 'kong') && s.isConcealed);

        // --- 1. 自摸 (1台) ---
        if (isZimo) {
            currentItems.push({ name: '自摸', fan: 1, description: '自己摸到胡牌' });
        }

        // --- 2. 門清 (1台) ---
        if (isMenqing) {
            currentItems.push({ name: '門清', fan: 1, description: '沒有吃碰槓，全部暗牌' });
        }

        // --- 3. 門清自摸 (額外1台) ---
        if (isMenqing && isZimo) {
            currentItems.push({ name: '門清自摸', fan: 1, description: '門清且自摸，額外加台' });
        }

        // --- 4. 三元牌刻子 (每組1台) ---
        const dragonNames = ['中', '發', '白'];
        let dragonPongCount = 0;
        for (let dv = 1; dv <= 3; dv++) {
            if (pongSets.some(s => s.suit === 'dragon' && s.value === dv)) {
                dragonPongCount++;
                currentItems.push({
                    name: `${dragonNames[dv - 1]}刻`,
                    fan: 1,
                    description: `持有三元牌「${dragonNames[dv - 1]}」的刻子`
                });
            }
        }

        // --- 5. 大三元 (8台, replaces individual dragon pongs) ---
        if (dragonPongCount === 3) {
            // Remove individual dragon items and add 大三元
            const filtered = currentItems.filter(item => !['中刻', '發刻', '白刻'].includes(item.name));
            currentItems.length = 0;
            currentItems.push(...filtered);
            currentItems.push({ name: '大三元', fan: 8, description: '中、發、白三組都是刻子' });
        }

        // --- 6. 圈風刻 (1台) ---
        const windNames = ['東', '南', '西', '北'];
        if (pongSets.some(s => s.suit === 'wind' && s.value === prevailingWind + 1)) {
            currentItems.push({
                name: `圈風 ${windNames[prevailingWind]}`,
                fan: 1,
                description: `持有圈風「${windNames[prevailingWind]}」的刻子`
            });
        }

        // --- 7. 門風刻 (1台) ---
        if (pongSets.some(s => s.suit === 'wind' && s.value === seatWind + 1)) {
            currentItems.push({
                name: `門風 ${windNames[seatWind]}`,
                fan: 1,
                description: `持有門風「${windNames[seatWind]}」的刻子`
            });
        }

        // --- 8. 風牌刻子數量 for 大/小四喜 ---
        let windPongCount = 0;
        let windPairCount = 0;
        for (let wv = 1; wv <= 4; wv++) {
            if (pongSets.some(s => s.suit === 'wind' && s.value === wv)) {
                windPongCount++;
            }
            if (pair.suit === 'wind' && pair.value === wv) {
                windPairCount++;
            }
        }

        // --- 9. 大四喜 (16台) ---
        if (windPongCount === 4) {
            // Remove individual wind items
            const filtered = currentItems.filter(item => !item.name.startsWith('圈風') && !item.name.startsWith('門風'));
            currentItems.length = 0;
            currentItems.push(...filtered);
            currentItems.push({ name: '大四喜', fan: 16, description: '東南西北四組都是刻子' });
        }
        // --- 10. 小四喜 (8台) ---
        else if (windPongCount === 3 && windPairCount === 1) {
            const filtered = currentItems.filter(item => !item.name.startsWith('圈風') && !item.name.startsWith('門風'));
            currentItems.length = 0;
            currentItems.push(...filtered);
            currentItems.push({ name: '小四喜', fan: 8, description: '三組風牌刻子 + 一組風牌對子' });
        }

        // --- 11. 平胡 (1台) ---
        // All chows + pair with no honors, and pair is not a yakuhai
        const allChows = pongSets.length === 0;
        const noHonorTiles = allTiles.every(t => isNumberSuit(t.suit));
        if (allChows && noHonorTiles) {
            currentItems.push({ name: '平胡', fan: 1, description: '全部是順子，無字牌' });
        }

        // --- 12. 碰碰胡 / 對對胡 (2台) ---
        if (chowSets.length === 0 && pongSets.length > 0) {
            currentItems.push({ name: '碰碰胡', fan: 2, description: '全部是刻子（或槓），無順子' });
        }

        // --- 13. 三暗刻 (2台) ---
        if (concealedPongs.length >= 3) {
            currentItems.push({ name: '三暗刻', fan: 2, description: '三組暗刻（未鳴牌的刻子）' });
        }

        // --- 14. 四暗刻 (5台) ---
        if (concealedPongs.length >= 4) {
            // Replace 三暗刻
            const filtered = currentItems.filter(item => item.name !== '三暗刻');
            currentItems.length = 0;
            currentItems.push(...filtered);
            currentItems.push({ name: '四暗刻', fan: 5, description: '四組暗刻（未鳴牌的刻子）' });
        }

        // --- 15. Suit analysis: 清一色 / 混一色 / 字一色 ---
        const numberSuits = new Set(allTiles.filter(t => isNumberSuit(t.suit)).map(t => t.suit));
        const hasHonor = allTiles.some(t => isHonor(t.suit));
        const hasNumber = numberSuits.size > 0;

        // 字一色 (16台): all honor tiles
        if (!hasNumber && hasHonor) {
            currentItems.push({ name: '字一色', fan: 16, description: '全部是字牌（風牌+三元牌）' });
        }
        // 清一色 (8台): one number suit, no honors
        else if (numberSuits.size === 1 && !hasHonor) {
            const suitName = numberSuits.values().next().value === 'wan' ? '萬' :
                numberSuits.values().next().value === 'tong' ? '筒' : '索';
            currentItems.push({ name: '清一色', fan: 8, description: `全部是${suitName}子牌` });
        }
        // 混一色 (4台): one number suit + honors
        else if (numberSuits.size === 1 && hasHonor) {
            currentItems.push({ name: '混一色', fan: 4, description: '一種數牌 + 字牌' });
        }

        // --- 16. 海底撈月 (1台) ---
        if (isLastTile && isZimo) {
            currentItems.push({ name: '海底撈月', fan: 1, description: '摸到牌牆最後一張牌胡牌' });
        }

        // --- 17. 河底撈魚 (1台) ---
        if (isLastTile && !isZimo) {
            currentItems.push({ name: '河底撈魚', fan: 1, description: '胡了最後一張打出的牌' });
        }

        // --- 18. 槓上開花 (1台) ---
        if (isKongDraw) {
            currentItems.push({ name: '槓上開花', fan: 1, description: '槓牌後補牌胡牌' });
        }

        // --- 19. 莊家/連莊 (1台 + 2n台) ---
        // 台灣麻將規則：莊家 1台，連n拉n額外加 2n台
        if (isDealer) {
            const lianFan = lianZhuangCount * 2;
            const totalZhuangFan = 1 + lianFan;
            currentItems.push({
                name: lianZhuangCount > 0 ? `莊家 (連${lianZhuangCount}拉${lianZhuangCount})` : '莊家',
                fan: totalZhuangFan,
                description: lianZhuangCount > 0 ? `莊家1台 + 連${lianZhuangCount}2n台` : '莊家1台'
            });
        }

        // --- 19. 全求人 (2台) ---
        if (melds.length >= 5 && !isZimo) {
            currentItems.push({ name: '全求人', fan: 2, description: '全部靠吃碰槓，胡別人打的牌' });
        }

        // --- 20. 搶槓 (1台) ---
        // This would need special context - skip for now as it requires tracking

        // Calculate total for this decomposition
        const totalFan = currentItems.reduce((sum, item) => sum + item.fan, 0);

        // Ensure minimum 1 台 (台灣麻將基本規則：無台不能胡)
        // If no fan items at all, it's a "雞胡" which may or may not be allowed
        // For now, we'll add it as info

        if (totalFan > bestScore) {
            bestScore = totalFan;
            bestItems = [...currentItems];
        }
    }

    // If no valid decompositions found (should not happen if checkHu passed)
    if (decompositions.length === 0) {
        // Fallback: just check zimo/menqing
        if (isZimo) bestItems.push({ name: '自摸', fan: 1, description: '自己摸到胡牌' });
        if (isMenqing) bestItems.push({ name: '門清', fan: 1, description: '沒有吃碰槓' });
        bestScore = bestItems.reduce((sum, item) => sum + item.fan, 0);
    }

    // If still 0 fan, it's a 雞胡 (chicken hand) — minimum 1台 in some rulesets
    if (bestScore === 0) {
        bestItems.push({ name: '雞胡', fan: 1, description: '無特殊台數，基本胡牌' });
        bestScore = 1;
    }

    // Calculate points: 底分 + 台數
    const basePoints = 1; // 底 (base)
    const totalPoints = basePoints + bestScore; // Simplified: each player pays (base + fan)

    return {
        totalFan: bestScore,
        items: bestItems,
        basePoints,
        totalPoints
    };
}
