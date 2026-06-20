import type { DEMatch, FencerStats } from '../types';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Returns positions[seedIdx] = bracket slot for that seed (0-indexed).
// Constructed so that seed1 always faces the lowest remaining seed,
// and seeds 1 & 2 can only meet in the final. BYEs go to the lowest seeds
// (highest rank numbers), so upper seeds get byes when bracket is not full.
//
// Algorithm: expand recursively, pairing each seed with its "complement"
// (bracketSize - 1 - seedIdx) and assigning them to adjacent slot pairs.
// This ensures:
//   n=4:  seed1 vs seed4, seed2 vs seed3
//   n=8:  seed1 vs seed8, seed4 vs seed5, seed2 vs seed7, seed3 vs seed6
function seedPositions(bracketSize: number): number[] {
  if (bracketSize === 1) return [0];
  const half = bracketSize / 2;
  const prev = seedPositions(half);
  const result = new Array<number>(bracketSize);
  for (let seedIdx = 0; seedIdx < half; seedIdx++) {
    const prevSlot = prev[seedIdx];
    result[seedIdx] = prevSlot * 2;
    result[bracketSize - 1 - seedIdx] = prevSlot * 2 + 1;
  }
  return result;
}

export function buildBracket(advancedStats: FencerStats[], thirdPlace: boolean): DEMatch[] {
  const advanced = advancedStats.filter(s => s.advanced).sort((a, b) => a.globalRank - b.globalRank);
  const n = advanced.length;
  if (n < 2) return [];

  const bracketSize = nextPowerOf2(n);
  const numRounds = Math.log2(bracketSize);
  const matches: DEMatch[] = [];

  // Round 1 slots (0-indexed positions in bracket)
  const positions = seedPositions(bracketSize);
  // positions[i] = bracket slot for seed i+1

  // First round: bracketSize/2 matches
  const round1Count = bracketSize / 2;
  for (let matchIdx = 0; matchIdx < round1Count; matchIdx++) {
    const topSlot = matchIdx * 2;
    const bottomSlot = topSlot + 1;
    const topSeedIdx = positions.indexOf(topSlot);
    const bottomSeedIdx = positions.indexOf(bottomSlot);

    const fencerA = topSeedIdx < n ? advanced[topSeedIdx].fencerId : null;
    const fencerB = bottomSeedIdx < n ? advanced[bottomSeedIdx].fencerId : null;
    const isBye = (fencerA === null) !== (fencerB === null);

    matches.push({
      id: generateId(),
      round: 1,
      position: matchIdx,
      fencerAId: fencerA,
      fencerBId: fencerB,
      scoreA: null,
      scoreB: null,
      winner: isBye ? (fencerA !== null ? 'A' : 'B') : null,
      isBye,
    });
  }

  // Subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);
    for (let pos = 0; pos < matchCount; pos++) {
      matches.push({
        id: generateId(),
        round,
        position: pos,
        fencerAId: null,
        fencerBId: null,
        scoreA: null,
        scoreB: null,
        winner: null,
        isBye: false,
      });
    }
  }

  // 3rd place match
  if (thirdPlace && numRounds >= 2) {
    matches.push({
      id: generateId(),
      round: numRounds,
      position: -1,
      fencerAId: null,
      fencerBId: null,
      scoreA: null,
      scoreB: null,
      winner: null,
      isBye: false,
      isThirdPlace: true,
    });
  }

  // BYE勝者を次ラウンドへ自動繰り上げ（positionの小さい順に処理）
  let result = matches;
  const byeMatches = matches
    .filter(m => m.isBye && m.winner !== null)
    .sort((a, b) => a.position - b.position);
  for (const bye of byeMatches) {
    result = advanceWinner(result, bye.id);
  }

  return result;
}

// 試合結果を取り消して次ラウンドから選手を除去（カスケード）
export function revertDEMatch(matches: DEMatch[], matchId: string): DEMatch[] {
  const updated = matches.map(m => ({ ...m }));
  const match = updated.find(m => m.id === matchId);
  if (!match || match.isBye) return updated;

  const maxRound = Math.max(...updated.filter(m => !m.isThirdPlace).map(m => m.round));
  const winnerId = match.winner === 'A' ? match.fencerAId : match.fencerBId;
  const loserId  = match.winner === 'A' ? match.fencerBId : match.fencerAId;

  // 現在の試合をリセット
  match.winner = null;
  match.scoreA = null;
  match.scoreB = null;

  if (!match.isThirdPlace && winnerId) {
    // 次ラウンドの試合から勝者を除去
    const nextRound = match.round + 1;
    const nextPos   = Math.floor(match.position / 2);
    const next = updated.find(m => m.round === nextRound && m.position === nextPos && !m.isThirdPlace);
    if (next) {
      if (next.fencerAId === winnerId) next.fencerAId = null;
      else if (next.fencerBId === winnerId) next.fencerBId = null;
      // 次ラウンドが既に確定済みなら合わせてリセット
      next.winner = null;
      next.scoreA = null;
      next.scoreB = null;
    }
  }

  // 準決勝の敗者を3位決定戦から除去
  if (!match.isThirdPlace && match.round === maxRound - 1 && loserId) {
    const third = updated.find(m => m.isThirdPlace);
    if (third) {
      if (third.fencerAId === loserId) third.fencerAId = null;
      else if (third.fencerBId === loserId) third.fencerBId = null;
      third.winner = null;
      third.scoreA = null;
      third.scoreB = null;
    }
  }

  return updated;
}

export function advanceWinner(matches: DEMatch[], matchId: string): DEMatch[] {
  const updated = matches.map(m => ({ ...m }));
  const match = updated.find(m => m.id === matchId);
  if (!match || match.winner === null) return updated;

  const winnerId = match.winner === 'A' ? match.fencerAId : match.fencerBId;
  const loserId = match.winner === 'A' ? match.fencerBId : match.fencerAId;

  if (match.isThirdPlace) return updated;

  // Find next round match
  const nextRound = match.round + 1;
  const nextPosition = Math.floor(match.position / 2);
  const nextMatch = updated.find(m => m.round === nextRound && m.position === nextPosition && !m.isThirdPlace);
  if (nextMatch) {
    const isTopSlot = match.position % 2 === 0;
    if (isTopSlot) nextMatch.fencerAId = winnerId;
    else nextMatch.fencerBId = winnerId;
  }

  // Semi-final losers go to 3rd place match
  const maxRound = Math.max(...updated.filter(m => !m.isThirdPlace).map(m => m.round));
  if (match.round === maxRound - 1) {
    const thirdPlaceMatch = updated.find(m => m.isThirdPlace);
    if (thirdPlaceMatch) {
      if (thirdPlaceMatch.fencerAId === null) thirdPlaceMatch.fencerAId = loserId;
      else thirdPlaceMatch.fencerBId = loserId;
    }
  }

  return updated;
}
