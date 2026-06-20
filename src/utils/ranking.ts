import type { Pool, Fencer, FencerStats } from '../types';

export function calcPoolStats(pool: Pool, fencerIds: string[]): Map<string, Omit<FencerStats, 'globalRank' | 'advanced'>> {
  const stats = new Map<string, { victories: number; matches: number; touchesScored: number; touchesReceived: number }>();

  for (const id of fencerIds) {
    stats.set(id, { victories: 0, matches: 0, touchesScored: 0, touchesReceived: 0 });
  }

  for (const bout of pool.bouts) {
    if (bout.winner === null || bout.scoreA === null || bout.scoreB === null) continue;
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
  const ranked = fencerIds
    .map(id => {
      const s = stats.get(id)!;
      const vm = s.matches > 0 ? s.victories / s.matches : 0;
      const indicator = s.touchesScored - s.touchesReceived;
      return { fencerId: id, ...s, vm, indicator, poolRank: 0 };
    })
    .sort((a, b) => {
      if (b.vm !== a.vm) return b.vm - a.vm;
      if (b.indicator !== a.indicator) return b.indicator - a.indicator;
      return b.touchesScored - a.touchesScored;
    });

  ranked.forEach((s, i) => {
    result.set(s.fencerId, { ...s, poolRank: i + 1 });
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

  const sorted = [...allStats].sort((a, b) => {
    if (b.vm !== a.vm) return b.vm - a.vm;
    if (b.indicator !== a.indicator) return b.indicator - a.indicator;
    return b.touchesScored - a.touchesScored;
  });

  return sorted.map((s, i) => ({ ...s, globalRank: i + 1, advanced: false }));
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

  return globalStats.map(s => ({ ...s, advanced: s.globalRank <= count }));
}
