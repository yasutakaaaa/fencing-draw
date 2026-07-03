import type { Tournament, Pool, DEMatch, FencerStats } from '../types';

type TournamentView = Tournament & { pools: Pool[]; deMatches: DEMatch[] };

function q(s: string | number) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function row(...cells: (string | number)[]) {
  return cells.map(c => q(c)).join(',');
}

function findFencer(t: TournamentView, id: string) {
  return t.fencers.find(f => f.id === id);
}

function fencerName(t: TournamentView, id: string | null) {
  if (!id) return '';
  const f = findFencer(t, id);
  return f ? `${f.lastName}${f.firstName}` : '';
}

function poolName(t: TournamentView, fencerId: string) {
  const pool = t.pools.find(p => p.fencerIds.includes(fencerId));
  return pool ? `P${pool.index + 1}` : '';
}

function roundLabel(round: number, maxRound: number) {
  if (round === maxRound) return '決勝';
  if (round === maxRound - 1) return '準決勝';
  if (round === maxRound - 2) return '準々決勝';
  return `Round${round}`;
}

// ── 1. 予選プール結果 ────────────────────────────────────────
export function exportPoolCSV(tournament: TournamentView, stats: FencerStats[]): string {
  const lines: string[] = [];
  lines.push(row('プール', 'P内順位', '氏名', '所属', '勝', '試', '勝率', '指数', '得点', '失点'));

  for (const pool of tournament.pools) {
    const poolStats = stats
      .filter(s => pool.fencerIds.includes(s.fencerId))
      .sort((a, b) => a.poolRank - b.poolRank);
    for (const s of poolStats) {
      const f = findFencer(tournament, s.fencerId);
      lines.push(row(
        `P${pool.index + 1}`, s.poolRank,
        fencerName(tournament, s.fencerId), f?.club ?? '',
        s.victories, s.matches, s.vm.toFixed(3),
        s.indicator, s.touchesScored, s.touchesReceived,
      ));
    }
  }
  return lines.join('\r\n');
}

// ── 2. 予選プール当落（グローバル順位順・通過→除外） ─────────
export function exportAdvancementCSV(tournament: TournamentView, stats: FencerStats[]): string {
  const lines: string[] = [];
  lines.push(row('総合順位', 'プール', 'P内順位', '氏名', 'ふりがな', '所属', '勝率', '指数', '得点', '通過'));

  const sorted = [...stats].sort((a, b) => {
    // 通過者を先に、その中で順位順
    if (a.advanced !== b.advanced) return a.advanced ? -1 : 1;
    return a.globalRank - b.globalRank;
  });

  for (const s of sorted) {
    const f = findFencer(tournament, s.fencerId);
    const kana = f ? `${f.lastNameKana}${f.firstNameKana}` : '';
    lines.push(row(
      s.globalRank, poolName(tournament, s.fencerId), s.poolRank,
      fencerName(tournament, s.fencerId), kana, f?.club ?? '',
      s.vm.toFixed(3), s.indicator, s.touchesScored,
      s.advanced ? '通過' : '除外',
    ));
  }
  return lines.join('\r\n');
}

// ── 3. トーナメントスコア結果 ─────────────────────────────────
export function exportDEResultsCSV(tournament: TournamentView): string {
  const lines: string[] = [];
  lines.push(row('ラウンド', '対戦位置', '選手A', 'スコアA', 'スコアB', '選手B', '勝者', 'BYE', '3位決定戦'));

  const matches = tournament.deMatches;
  const maxRound = matches.filter(m => !m.isThirdPlace).reduce((mx, m) => Math.max(mx, m.round), 0);

  const sorted = [...matches].sort((a, b) => {
    if (a.isThirdPlace) return 1;
    if (b.isThirdPlace) return -1;
    if (a.round !== b.round) return a.round - b.round;
    return a.position - b.position;
  });

  for (const m of sorted) {
    const winnerName = m.winner ? fencerName(tournament, m.winner === 'A' ? m.fencerAId : m.fencerBId) : '';
    lines.push(row(
      m.isThirdPlace ? '3位決定戦' : roundLabel(m.round, maxRound),
      m.isThirdPlace ? '' : m.position + 1,
      fencerName(tournament, m.fencerAId),
      m.scoreA ?? '',
      m.scoreB ?? '',
      fencerName(tournament, m.fencerBId),
      winnerName,
      m.isBye ? '○' : '',
      m.isThirdPlace ? '○' : '',
    ));
  }
  return lines.join('\r\n');
}

// ── 4. トーナメント最終順位 ───────────────────────────────────
export function exportFinalCSV(tournament: TournamentView, stats: FencerStats[]): string {
  const lines: string[] = [];
  lines.push(row('順位', '氏名', 'ふりがな', '所属', '勝率', '指数', '得点'));

  const sorted = [...stats].sort((a, b) => a.globalRank - b.globalRank);
  for (const s of sorted) {
    const f = findFencer(tournament, s.fencerId);
    lines.push(row(
      s.globalRank,
      fencerName(tournament, s.fencerId),
      f ? `${f.lastNameKana}${f.firstNameKana}` : '',
      f?.club ?? '',
      s.vm.toFixed(3), s.indicator, s.touchesScored,
    ));
  }
  return lines.join('\r\n');
}

// ── 共通DLヘルパー ─────────────────────────────────────────────
export function downloadCSV(content: string, filename: string) {
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 一括DL（4ファイル、100ms間隔） ────────────────────────────
export function downloadAllCSV(
  tournament: TournamentView,
  stats: FencerStats[],
) {
  const base = tournament.name || '大会';
  const files = [
    { content: exportPoolCSV(tournament, stats),        name: `${base}_1_プール結果.csv` },
    { content: exportAdvancementCSV(tournament, stats), name: `${base}_2_プール当落.csv` },
    { content: exportDEResultsCSV(tournament),          name: `${base}_3_DEスコア.csv` },
    { content: exportFinalCSV(tournament, stats),       name: `${base}_4_最終順位.csv` },
  ];
  files.forEach(({ content, name }, i) => {
    setTimeout(() => downloadCSV(content, name), i * 150);
  });
}
