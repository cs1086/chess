import type { GameType } from '../types';

export interface GameConfig {
    name: string;
    minPlayers: number;
    maxPlayers: number;
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
    chinese_dark_chess: { name: '中國暗棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    chinese_checkers_2: { name: '中國軍棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    gomoku: { name: '五子棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    go: { name: '圍棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    army_chess: { name: '陸軍棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    chess: { name: '西洋棋 (2人)', minPlayers: 2, maxPlayers: 2 },
    big_two: { name: '大老二 (3~4人)', minPlayers: 3, maxPlayers: 4 },
    sevens: { name: '牌七 (3~4人)', minPlayers: 3, maxPlayers: 4 },
    show_hand: { name: '梭哈 (2~6人)', minPlayers: 2, maxPlayers: 6 },
    mahjong: { name: '台灣麻將 (3~4人)', minPlayers: 3, maxPlayers: 4 },
};
