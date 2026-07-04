import { describe, it, expect } from 'vitest';
import { buildBracket } from './bracket';
import { advanceWinner } from './bracket';
import { calcFinalRankings } from './ranking';
import type { FencerStats, DEMatch } from '../types';

// 8名の FencerStats (全員 advanced=true, pool 順位順)
function make8Stats(): FencerStats[] {
  return Array.from({ length: 8 }, (_, i) => ({
    fencerId: `f${i + 1}`,
    victories: 7 - i,
    matches: 7,
    vm: (7 - i) / 7,
    touchesScored: 35 - i * 3,
    touchesReceived: 10 + i * 3,
    indicator: 25 - i * 6,
    poolRank: i + 1,
    globalRank: i + 1,
    advanced: true,
    withdrawn: false,
  }));
}

// 全試合を「上位シードが勝つ」ように進行させる
function playAllMatches(matches: DEMatch[], winners: Map<string, string>): DEMatch[] {
  let current = [...matches];
  const maxRound = Math.max(...current.filter(m => !m.isThirdPlace).map(m => m.round));

  for (let r = 1; r <= maxRound; r++) {
    const roundMatches = current.filter(m => m.round === r && !m.isThirdPlace && !m.isBye);
    for (const m of roundMatches) {
      if (m.winner !== null) continue; // bye は skip
      if (!m.fencerAId || !m.fencerBId) continue;
      // 小さい番号 = 高シード が勝つ
      const aNum = parseInt(m.fencerAId.replace('f', ''));
      const bNum = parseInt(m.fencerBId.replace('f', ''));
      const w: 'A' | 'B' = aNum < bNum ? 'A' : 'B';
      const update = { winner: w, scoreA: w === 'A' ? 15 : 10, scoreB: w === 'A' ? 10 : 15 };
      current = advanceWinner(current.map(x => x.id === m.id ? { ...x, ...update } : x), m.id);
    }
  }

  // 3位決定戦
  const third = current.find(m => m.isThirdPlace);
  if (third && third.fencerAId && third.fencerBId && third.winner === null) {
    const aNum = parseInt(third.fencerAId.replace('f', ''));
    const bNum = parseInt(third.fencerBId.replace('f', ''));
    const w: 'A' | 'B' = aNum < bNum ? 'A' : 'B';
    current = current.map(m => m.id === third.id ? { ...m, winner: w, scoreA: 15, scoreB: 11 } : m);
  }

  return current;
}

describe('calcFinalRankings - 8名DEトーナメント (3決あり)', () => {
  const stats = make8Stats();
  const rawBracket = buildBracket(stats, true);
  const played = playAllMatches(rawBracket, new Map());

  it('f1が1位になる', () => {
    const results = calcFinalRankings(played, stats, true);
    const r = results.find(x => x.fencerId === 'f1');
    expect(r?.finalRank).toBe(1);
  });

  it('f2が2位になる', () => {
    const results = calcFinalRankings(played, stats, true);
    const r = results.find(x => x.fencerId === 'f2');
    expect(r?.finalRank).toBe(2);
  });

  it('3位と4位が決まる', () => {
    const results = calcFinalRankings(played, stats, true);
    const ranks = results.map(r => r.finalRank).sort((a, b) => a - b);
    expect(ranks).toContain(3);
    expect(ranks).toContain(4);
  });

  it('全8名がランク付けされる', () => {
    const results = calcFinalRankings(played, stats, true);
    expect(results).toHaveLength(8);
    const ids = results.map(r => r.fencerId).sort();
    expect(ids).toEqual(['f1','f2','f3','f4','f5','f6','f7','f8'].sort());
  });

  it('5〜8位は準々決勝敗者でプール順位順', () => {
    const results = calcFinalRankings(played, stats, true);
    // R1 losers are f5,f6,f7,f8 (lower seeds beat by higher seeds)
    const bottom = results.filter(r => r.finalRank >= 5).sort((a, b) => a.finalRank - b.finalRank);
    // Higher globalRank (worse pool rank) should have higher finalRank
    for (let i = 0; i < bottom.length - 1; i++) {
      const sA = stats.find(s => s.fencerId === bottom[i].fencerId)!;
      const sB = stats.find(s => s.fencerId === bottom[i + 1].fencerId)!;
      expect(sA.globalRank).toBeLessThan(sB.globalRank);
    }
  });
});

describe('calcFinalRankings - 8名DEトーナメント (3決なし)', () => {
  const stats = make8Stats();
  const rawBracket = buildBracket(stats, false);
  const played = playAllMatches(rawBracket, new Map());

  it('準決勝敗者2名が同3位', () => {
    const results = calcFinalRankings(played, stats, false);
    const thirdRanked = results.filter(r => r.finalRank === 3);
    expect(thirdRanked).toHaveLength(2);
  });

  it('順位4がなく次が5位', () => {
    const results = calcFinalRankings(played, stats, false);
    expect(results.find(r => r.finalRank === 4)).toBeUndefined();
    const ranks = results.map(r => r.finalRank).sort((a, b) => a - b);
    // 1, 2, 3, 3, 5, 6, 7, 8
    expect(ranks).toEqual([1, 2, 3, 3, 5, 6, 7, 8]);
  });
});

describe('calcFinalRankings - 途中棄権あり', () => {
  it('棄権者は最下位になる', () => {
    const stats = make8Stats();
    // f8 を棄権扱いに
    const statsWithWithdraw: FencerStats[] = stats.map(s =>
      s.fencerId === 'f8' ? { ...s, withdrawn: true, advanced: false } : s
    );
    // f8 が advanced=false なので bracket には入らない (7名)
    const rawBracket = buildBracket(statsWithWithdraw.filter(s => s.advanced), true);
    const played = playAllMatches(rawBracket, new Map());
    const results = calcFinalRankings(played, statsWithWithdraw, true);

    // f8 が結果に含まれ最下位（withdrawn=true）
    const f8 = results.find(r => r.fencerId === 'f8');
    expect(f8?.withdrawn).toBe(true);
    const maxRank = Math.max(...results.map(r => r.finalRank));
    expect(f8?.finalRank).toBe(maxRank);
  });
});
