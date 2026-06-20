import type { Fencer, Pool, Bout } from '../types';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function assignPools(fencers: Fencer[], maxPoolSize: number): Pool[] {
  const n = fencers.length;
  if (n === 0) return [];

  const numPools = Math.ceil(n / maxPoolSize);
  const base = Math.floor(n / numPools);
  const extra = n % numPools;

  // Group by club
  const byClub = new Map<string, Fencer[]>();
  for (const f of fencers) {
    const club = f.club || '未所属';
    if (!byClub.has(club)) byClub.set(club, []);
    byClub.get(club)!.push(f);
  }

  // Sort clubs by size descending for snake distribution
  const clubGroups = [...byClub.values()].sort((a, b) => b.length - a.length);

  // Create empty pools
  const pools: Pool[] = Array.from({ length: numPools }, (_, i) => ({
    id: generateId(),
    index: i,
    fencerIds: [],
    bouts: [],
  }));

  // Snake distribution: assign fencer from each club group to pools in snake order
  const snakeOrder: number[] = [];
  for (let i = 0; i < numPools; i++) snakeOrder.push(i);
  for (let i = numPools - 1; i >= 0; i--) snakeOrder.push(i);

  const flatFencers: Fencer[] = [];
  for (const group of clubGroups) {
    for (const f of group) flatFencers.push(f);
  }

  // Assign fencers using snake pattern
  let snakeIdx = 0;
  for (const fencer of flatFencers) {
    const poolIdx = snakeOrder[snakeIdx % snakeOrder.length];
    const pool = pools[poolIdx];
    // Check pool capacity
    const capacity = poolIdx < extra ? base + 1 : base;
    if (pool.fencerIds.length < capacity) {
      pool.fencerIds.push(fencer.id);
      snakeIdx++;
    } else {
      // Try next slot
      let placed = false;
      for (let attempt = 1; attempt < numPools * 2; attempt++) {
        const tryIdx = snakeOrder[(snakeIdx + attempt) % snakeOrder.length];
        const tryPool = pools[tryIdx];
        const tryCap = tryIdx < extra ? base + 1 : base;
        if (tryPool.fencerIds.length < tryCap) {
          tryPool.fencerIds.push(fencer.id);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // fallback: just put in first non-full pool
        for (const p of pools) {
          const cap = p.index < extra ? base + 1 : base;
          if (p.fencerIds.length < cap) {
            p.fencerIds.push(fencer.id);
            break;
          }
        }
      }
      snakeIdx++;
    }
  }

  // Generate round-robin bouts for each pool
  for (const pool of pools) {
    pool.bouts = generateBouts(pool.fencerIds);
  }

  return pools;
}

function generateBouts(fencerIds: string[]): Bout[] {
  const bouts: Bout[] = [];
  for (let i = 0; i < fencerIds.length; i++) {
    for (let j = i + 1; j < fencerIds.length; j++) {
      bouts.push({
        id: generateId(),
        fencerAId: fencerIds[i],
        fencerBId: fencerIds[j],
        scoreA: null,
        scoreB: null,
        winner: null,
      });
    }
  }
  return bouts;
}
