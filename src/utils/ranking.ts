import type { Pool, Fencer, FencerStats, DEMatch } from '../types';

export function calcPoolStats(pool: Pool, fencerIds: string[]): Map<string, Omit<FencerStats, 'globalRank' | 'advanced'>> {
  const withdrawn = pool.withdrawnFencerIds ?? [];
  const activeIds = fencerIds.filter(id => !withdrawn.includes(id));

  const stats = new Map<string, { victories: number; matches: number; touchesScored: number; touchesReceived: number }>();
  for (const id of activeIds) {
    stats.set(id, { victories: 0, matches: 0, touchesScored: 0, touchesReceived: 0 });
  }

  for (const bout of pool.bouts) {
    if (bout.winner === null || bout.scoreA === null || bout.scoreB === null) continue;
    // 棄権選手との対戦はノーカウント
    if (withdrawn.includes(bout.fencerAId) || withdrawn.includes(bout.fencerBId)) continue;
    const sA = stats.get(bout.fencerAId);
    const sB = stats.get(bout.fencerBId);
    if (!sA || !sB) continue;

    sA.matches++;
    sB.matches++;
    sA.touchesScored += bout.scoreA;
    sA.touchesReceived += bout.scoreB;
    sB.touchesScored += bout.scoreB;
    sB.touchesReceived += bout.scoreA;

    if (bout.winner === 'A') sA.victories++;
    else sB.victories++;
  }

  const result = new Map<string, Omit<FencerStats, 'globalRank' | 'advanced'>>();

  const ranked = activeIds
    .map(id => {
      const s = stats.get(id)!;
      const vm = s.matches > 0 ? s.victories / s.matches : 0;
      const indicator = s.touchesScored - s.touchesReceived;
      return { fencerId: id, ...s, vm, indicator, poolRank: 0, withdrawn: false };
    })
    .sort((a, b) => {
      if (b.vm !== a.vm) return b.vm - a.vm;
      if (b.indicator !== a.indicator) return b.indicator - a.indicator;
      return b.touchesScored - a.touchesScored;
    });

  ranked.forEach((s, i) => {
    result.set(s.fencerId, { ...s, poolRank: i + 1 });
  });

  // 棄権選手は最下位に追加
  withdrawn.forEach((id, i) => {
    result.set(id, {
      fencerId: id,
      victories: 0, matches: 0, vm: 0,
      touchesScored: 0, touchesReceived: 0, indicator: 0,
      poolRank: ranked.length + i + 1,
      withdrawn: true,
    });
  });

  return result;
}

export function calcGlobalStats(pools: Pool[], _fencers: Fencer[]): FencerStats[] {
  const allStats: Array<Omit<FencerStats, 'globalRank' | 'advanced'>> = [];

  for (const pool of pools) {
    const poolStatMap = calcPoolStats(pool, pool.fencerIds);
    for (const [, stat] of poolStatMap) {
      allStats.push(stat);
    }
  }

  const active   = allStats.filter(s => !s.withdrawn);
  const inactive = allStats.filter(s => s.withdrawn);

  const sorted = [...active].sort((a, b) => {
    if (b.vm !== a.vm) return b.vm - a.vm;
    if (b.indicator !== a.indicator) return b.indicator - a.indicator;
    return b.touchesScored - a.touchesScored;
  });

  const result: FencerStats[] = [
    ...sorted.map((s, i) => ({ ...s, globalRank: i + 1, advanced: false })),
    ...inactive.map((s, i) => ({ ...s, globalRank: sorted.length + i + 1, advanced: false })),
  ];

  return result;
}

export function applyAdvancement(
  globalStats: FencerStats[],
  advancementType: 'percent' | 'count',
  advancementValue: number,
  totalFencers: number
): FencerStats[] {
  const count =
    advancementType === 'percent'
      ? Math.round((advancementValue / 100) * totalFencers)
      : advancementValue;

  return globalStats.map(s => ({
    ...s,
    advanced: !s.withdrawn && s.globalRank <= count,
  }));
}

// DE結果に基づく最終順位計算
export function calcFinalRankings(
  deMatches: DEMatch[],
  poolGlobalStats: FencerStats[],
  hasThirdPlace: boolean,
): Array<{ fencerId: string; finalRank: number; withdrawn?: boolean }> {
  const mainMatches = deMatches.filter(m => !m.isBye && !m.isThirdPlace);
  const thirdPlaceMatch = deMatches.find(m => m.isThirdPlace);

  if (mainMatches.length === 0) return [];

  const maxRound = mainMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const finalMatch = mainMatches.find(m => m.round === maxRound);
  const results: Array<{ fencerId: string; finalRank: number; withdrawn?: boolean }> = [];
  let nextRank = 1;

  // 1位: 決勝勝者, 2位: 決勝敗者
  if (finalMatch?.winner) {
    const winnerId = finalMatch.winner === 'A' ? finalMatch.fencerAId : finalMatch.fencerBId;
    const loserId  = finalMatch.winner === 'A' ? finalMatch.fencerBId : finalMatch.fencerAId;
    if (winnerId) results.push({ fencerId: winnerId, finalRank: nextRank++ });
    if (loserId)  results.push({ fencerId: loserId,  finalRank: nextRank++ });
  }

  // 3位/4位: 3位決定戦あり
  if (hasThirdPlace && thirdPlaceMatch?.winner) {
    const w = thirdPlaceMatch.winner === 'A' ? thirdPlaceMatch.fencerAId : thirdPlaceMatch.fencerBId;
    const l = thirdPlaceMatch.winner === 'A' ? thirdPlaceMatch.fencerBId : thirdPlaceMatch.fencerAId;
    if (w) results.push({ fencerId: w, finalRank: nextRank++ });
    if (l) results.push({ fencerId: l, finalRank: nextRank++ });
  } else if (!hasThirdPlace && maxRound >= 2) {
    // 3位決定戦なし: 準決勝敗者2名が同3位
    const sfLosers = mainMatches
      .filter(m => m.round === maxRound - 1 && m.winner !== null)
      .map(m => (m.winner === 'A' ? m.fencerBId : m.fencerAId))
      .filter((id): id is string => id !== null);
    _sortByPoolRank(sfLosers, poolGlobalStats).forEach(id =>
      results.push({ fencerId: id, finalRank: nextRank }),
    );
    nextRank += sfLosers.length;
  }

  // それ以前のラウンドの敗者 (準々決勝以下)
  for (let round = maxRound - 2; round >= 1; round--) {
    const losers = mainMatches
      .filter(m => m.round === round && m.winner !== null)
      .map(m => (m.winner === 'A' ? m.fencerBId : m.fencerAId))
      .filter((id): id is string => id !== null);
    if (losers.length === 0) continue;
    _sortByPoolRank(losers, poolGlobalStats).forEach(id =>
      results.push({ fencerId: id, finalRank: nextRank++ }),
    );
  }

  // 棄権選手は最下位
  const ranked = new Set(results.map(r => r.fencerId));
  poolGlobalStats
    .filter(s => s.withdrawn && !ranked.has(s.fencerId))
    .sort((a, b) => a.globalRank - b.globalRank)
    .forEach(s => results.push({ fencerId: s.fencerId, finalRank: nextRank++, withdrawn: true }));

  return results;
}

function _sortByPoolRank(fencerIds: string[], stats: FencerStats[]): string[] {
  return [...fencerIds].sort((a, b) => {
    const sA = stats.find(s => s.fencerId === a);
    const sB = stats.find(s => s.fencerId === b);
    if (!sA || !sB) return 0;
    if (sB.vm !== sA.vm) return sB.vm - sA.vm;
    if (sB.indicator !== sA.indicator) return sB.indicator - sA.indicator;
    return sB.touchesScored - sA.touchesScored;
  });
}

// FIE 推奨試合順序（プールサイズ別）
const FIE_BOUT_ORDER: Record<number, [number, number][]> = {
  2: [[1,2]],
  3: [[1,2],[2,3],[1,3]],
  4: [[1,4],[2,3],[1,3],[2,4],[3,4],[1,2]],
  5: [[1,2],[3,4],[1,5],[2,4],[3,5],[1,4],[2,5],[3,1],[4,5],[2,3]],
  6: [[1,2],[4,5],[2,3],[5,6],[3,1],[6,4],[1,5],[3,6],[2,4],[3,5],[1,6],[4,2],[5,3],[2,6],[4,1]],
  7: [[1,4],[2,5],[3,6],[4,7],[1,2],[5,6],[3,7],[1,5],[4,6],[2,3],[5,7],[1,6],[3,4],[2,7],[1,3],[6,7],[2,4],[3,5],[4,2],[1,7],[6,3],[5,4],[7,2],[6,1],[5,3]],
};

export function getBoutOrder(poolSize: number): [number, number][] {
  return FIE_BOUT_ORDER[poolSize] ?? [];
}
