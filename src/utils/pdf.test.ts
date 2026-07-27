import { describe, expect, it } from 'vitest';
import type { DEMatch, Fencer, FencerStats, Tournament, TournamentEvent } from '../types';
import { buildBracket } from './bracket';
import {
  arePoolsComplete,
  buildDEBracketSheetsDocument,
  buildDEBracketSheetsHtml,
  buildDEPrintPlan,
  buildPoolSheetsDocument,
  buildPoolScoreSheetsDocument,
  buildPoolScoreSheetsHtml,
} from './pdf';

function makeFencers(count: number): Fencer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `fencer-${index + 1}`,
    lastName: `選手${index + 1}`,
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    club: `クラブ${(index % 4) + 1}`,
  }));
}

function makeStats(fencers: Fencer[]): FencerStats[] {
  return fencers.map((fencer, index) => ({
    fencerId: fencer.id,
    victories: 0,
    matches: 0,
    vm: 0,
    touchesScored: 0,
    touchesReceived: 0,
    indicator: 0,
    poolRank: index + 1,
    globalRank: index + 1,
    advanced: true,
  }));
}

function makeTournament(fencerCount: number, matches: DEMatch[] = []): Tournament {
  const fencers = makeFencers(fencerCount);
  return {
    id: 'category-1',
    eventId: 'event-1',
    name: '',
    date: '2026-07-27',
    weapon: 'エペ',
    gender: '男子',
    ageCategory: 'シニア',
    ageCategoryCustom: '',
    format: '個人',
    status: '進行中',
    fencers,
    phases: [
      { id: 'pool-phase', type: 'pool', maxPoolSize: 7, advancement: { type: 'count', value: fencerCount } },
      { id: 'de-phase', type: 'de', thirdPlace: false, classification: false, classificationPlacements: [] },
    ],
    phaseRuntimes: [
      {
        phaseId: 'pool-phase',
        type: 'pool',
        subPhase: 'running',
        inputFencerIds: fencers.map(fencer => fencer.id),
        pools: [
          {
            id: 'pool-1',
            index: 0,
            fencerIds: fencers.slice(0, Math.ceil(fencerCount / 2)).map(fencer => fencer.id),
            bouts: [],
          },
          {
            id: 'pool-2',
            index: 1,
            fencerIds: fencers.slice(Math.ceil(fencerCount / 2)).map(fencer => fencer.id),
            bouts: [],
          },
        ],
      },
      { phaseId: 'de-phase', type: 'de', inputFencerIds: fencers.map(fencer => fencer.id), deMatches: matches },
    ],
    activePhaseIdx: matches.length > 0 ? 1 : 0,
  };
}

const event: TournamentEvent = {
  id: 'event-1',
  name: 'テスト大会',
  date: '2026-07-27',
  venue: '中央体育館',
  status: '実施中',
  pin: '',
  categoryIds: ['category-1'],
};

function bracketFor(count: number, thirdPlace = false) {
  const fencers = makeFencers(count);
  return buildBracket(makeStats(fencers), thirdPlace);
}

describe('審判用PDF', () => {
  it('プールは1組につき1シートを生成する', () => {
    const tournament = makeTournament(10);
    const html = buildPoolScoreSheetsHtml(tournament, event);

    expect(html.match(/data-print-sheet="pool"/g)).toHaveLength(2);
    expect(html).toContain('プール 1 記録用紙');
    expect(html).toContain('プール 2 記録用紙');
    expect(html).toContain('試合順');
    expect(html).not.toContain('FIE推奨');
  });

  it('実施中はマトリクスと試合順、全試合終了後は結果へ自動切替する', () => {
    const running = makeTournament(4);
    expect(arePoolsComplete(running)).toBe(false);
    const runningDocument = buildPoolSheetsDocument(running, event);
    expect(runningDocument).toContain('プール 1 記録用紙');
    expect(runningDocument).toContain('試合順');

    const completed = makeTournament(4);
    for (const runtime of completed.phaseRuntimes) {
      if (runtime.type !== 'pool') continue;
      runtime.pools = runtime.pools.map(pool => ({
        ...pool,
        bouts: [{
          id: `bout-${pool.id}`,
          fencerAId: pool.fencerIds[0],
          fencerBId: pool.fencerIds[1],
          scoreA: 5,
          scoreB: 3,
          winner: 'A',
        }],
      }));
    }
    expect(arePoolsComplete(completed)).toBe(true);
    const resultDocument = buildPoolSheetsDocument(completed, event);
    expect(resultDocument).toContain('プール 1 結果');
    expect(resultDocument).toContain('V5');
    expect(resultDocument).not.toContain('試合順');
  });

  it('64名は16名単位の4シートでベスト8まで進め、ベスト8以降を別シートにする', () => {
    const matches = bracketFor(64);
    const plan = buildDEPrintPlan(matches);
    const preliminary = plan.filter(sheet => sheet.kind === 'preliminary');
    const final = plan.filter(sheet => sheet.kind === 'final');

    expect(preliminary).toHaveLength(4);
    expect(preliminary.every(sheet => sheet.inputCount === 16)).toBe(true);
    expect(preliminary.every(sheet => sheet.qualifierCount === 2)).toBe(true);
    expect(final).toHaveLength(1);
    expect(final[0].inputCount).toBe(8);

    const tournament = makeTournament(64, matches);
    const html = buildDEBracketSheetsHtml(tournament, event);
    expect(html.match(/data-sheet-kind="preliminary"/g)).toHaveLength(4);
    expect(html.match(/data-sheet-kind="final"/g)).toHaveLength(1);
    expect(html).toContain('ベスト8以降');
  });

  it('32名は16名単位の2シートから各4名がベスト8へ進む', () => {
    const preliminary = buildDEPrintPlan(bracketFor(32)).filter(sheet => sheet.kind === 'preliminary');
    expect(preliminary).toHaveLength(2);
    expect(preliminary.every(sheet => sheet.inputCount === 16)).toBe(true);
    expect(preliminary.every(sheet => sheet.qualifierCount === 4)).toBe(true);
  });

  it('128名でも各シートの開始人数を16名以下に保つ', () => {
    const plan = buildDEPrintPlan(bracketFor(128));
    expect(plan.every(sheet => sheet.inputCount <= 16)).toBe(true);
    expect(plan.at(-1)).toMatchObject({ kind: 'final', inputCount: 8 });
  });

  it('16名以下はトーナメント全体を1シートに収める', () => {
    const plan = buildDEPrintPlan(bracketFor(16));
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'full', inputCount: 16, qualifierCount: 1 });
  });

  it('3位決定戦は準決勝敗者の記入欄として表示する', () => {
    const matches = bracketFor(16, true);
    const html = buildDEBracketSheetsHtml(makeTournament(16, matches), event);
    expect(html).toContain('準決勝 敗者1');
    expect(html).toContain('準決勝 敗者2');
    expect(html).not.toContain('準決勝 -1');
  });

  it('印刷ドキュメントはA4横向きで生成する', () => {
    const tournament = makeTournament(16, bracketFor(16));
    expect(buildPoolScoreSheetsDocument(tournament, event)).toContain('@page { size: A4 landscape;');
    expect(buildDEBracketSheetsDocument(tournament, event)).toContain('@page { size: A4 landscape;');
  });
});
