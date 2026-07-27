import type { Tournament, TournamentEvent, Pool, DEMatch, FencerStats, Fencer } from '../types';
import { calcGlobalStats, calcPoolStats, getBoutOrder } from './ranking';

type TournamentView = Tournament & { pools: Pool[]; deMatches: DEMatch[] };

function esc(s: string | number) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const STYLE = `
<style>
* { box-sizing: border-box; }
body {
  font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
  font-size: 11px; margin: 14px 20px; color: #111;
}
h1  { font-size: 18px; margin: 0 0 2px; }
h2  { font-size: 12px; margin: 14px 0 4px; border-bottom: 2px solid #2563eb;
      padding-bottom: 2px; color: #1d4ed8; }
.meta { color: #666; font-size: 10px; margin: 0 0 10px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 10px; font-size: 10px; }
th { background: #1e40af; color: #fff; padding: 4px 7px; text-align: center; white-space: nowrap; }
td { border: 1px solid #ccc; padding: 3px 7px; }
tr:nth-child(even) td { background: #f0f4ff; }
.tl { text-align: left; }
.tc { text-align: center; }
.r  { text-align: right; }
.pass td { background: #dbeafe !important; }
.fail { opacity: 0.55; }
.w  { color: #1d4ed8; font-weight: bold; }
.l  { color: #b91c1c; }
.g1 td { background: #fef9c3 !important; }
.g2 td { background: #f3f4f6 !important; }
.g3 td { background: #ffedd5 !important; }
@media print { body { margin: 0.3cm 0.8cm; } @page { margin: 0.8cm; } }
</style>`;

function printDocument(title: string, body: string, extraStyle = '', autoPrint = false) {
  const script = autoPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>'
    : '';
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">` +
    `<title>${esc(title)}</title>${STYLE}${extraStyle}</head><body>${body}${script}</body></html>`;
}

function openPrint(title: string, body: string, extraStyle = '') {
  const win = window.open('', '_blank', 'width=960,height=740');
  if (!win) {
    alert('ポップアップをブロックされています。ブラウザの設定で許可してください。');
    return;
  }
  win.document.write(printDocument(title, body, extraStyle, true));
  win.document.close();
}

function header(t: TournamentView, subtitle: string) {
  return `<h1>${esc(t.name || '大会')}</h1>` +
    `<p class="meta">${esc(t.date)} · ${esc(t.weapon)} · ${esc(t.gender)} · ${subtitle}</p>`;
}

type PrintEventMeta = Pick<TournamentEvent, 'name' | 'date' | 'venue'>;

const SCORE_SHEET_STYLE = `
<style>
@page { size: A4 landscape; margin: 0; }
body { margin: 0; font-size: 9px; }
.print-sheet {
  position: relative; width: 100%; padding: 7mm;
}
.print-sheet:not(:last-child) { break-after: page; page-break-after: always; }
.sheet-header {
  width: 100%; margin: 0 0 3mm; table-layout: fixed;
  break-inside: avoid; page-break-inside: avoid;
}
.sheet-header td { border: 0; padding: 0; background: #fff !important; }
.sheet-header .sheet-title { font-size: 15px; font-weight: bold; width: 58%; padding-bottom: 1mm; }
.sheet-header .sheet-fields { width: 42%; text-align: right; vertical-align: top; font-size: 9px; }
.sheet-header .sheet-meta { color: #555; font-size: 9px; }
.sheet-field { display: inline-block; width: 31%; text-align: left; border-bottom: 1px solid #555; padding: 0 1mm 1mm; margin-left: 1.5%; }
.score-sheet .pool-grid { table-layout: fixed; margin: 0; font-size: 8px; }
.score-sheet .pool-grid th { background: #e5e7eb; color: #111; border: 1px solid #555; padding: 1.3mm 0.8mm; }
.score-sheet .pool-grid td { border: 1px solid #555; height: 8mm; padding: 0.8mm; background: #fff !important; }
.score-sheet .number-col { width: 8mm; text-align: center; }
.score-sheet .name-col { width: 37mm; }
.score-sheet .club-col { width: 31mm; }
.score-sheet .result-col { width: 10mm; text-align: center; }
.score-sheet .self-cell { background: #d1d5db !important; color: #555; text-align: center; font-weight: bold; }
.bout-order-title { margin: 3mm 0 1.5mm; font-size: 9px; font-weight: bold; }
.bout-order { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1mm 2mm; }
.bout-order-item { border-bottom: 1px solid #aaa; padding: 0.6mm 1mm; white-space: nowrap; font-size: 7.5px; }
.bracket-sheet .sheet-header { margin-bottom: 1.5mm; }
.bracket-columns { display: grid; gap: 4mm; height: 140mm; }
.bracket-sheet[data-sheet-kind="final"] .bracket-columns,
.bracket-sheet[data-sheet-kind="full"] .bracket-columns { height: 125mm; }
.bracket-round { min-width: 0; display: flex; flex-direction: column; }
.bracket-round h2 { border: 0; color: #111; margin: 0 0 1.5mm; padding: 0; text-align: center; font-size: 10px; }
.bracket-match-list { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 1mm; }
.de-match { border-left: 1.5px solid #111; border-right: 1.5px solid #111; background: #fff; }
.de-slot { display: grid; grid-template-columns: minmax(0, 1fr) 10mm; align-items: center; min-height: 7mm; border-top: 1px solid #111; padding-left: 1.5mm; }
.de-slot:last-child { border-bottom: 1px solid #111; }
.de-name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 8px; }
.de-club { color: #666; font-size: 6.5px; margin-left: 1mm; }
.de-score { height: 100%; border-left: 1px solid #111; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; }
.bye { color: #999; }
.sheet-note { color: #555; font-size: 8px; }
.third-place-sheet { margin-top: 2mm; width: 75mm; }
.third-place-sheet h2 { font-size: 9px; margin: 0 0 1mm; color: #111; border: 0; padding: 0; }
.third-place-sheet .de-match { width: 75mm; }
.empty-sheet { display: flex; align-items: center; justify-content: center; color: #777; font-size: 14px; }
</style>`;

function categoryName(tournament: Tournament) {
  if (tournament.name) return tournament.name;
  const age = tournament.ageCategory === 'その他'
    ? (tournament.ageCategoryCustom || 'その他')
    : tournament.ageCategory;
  const format = tournament.format === '個人' ? '' : ` ${tournament.format}`;
  return `${age} ${tournament.gender}${format} ${tournament.weapon}`;
}

function eventTitle(tournament: Tournament, event?: PrintEventMeta) {
  return event?.name || tournament.name || '大会';
}

function scoreSheetHeader(tournament: Tournament, event: PrintEventMeta | undefined, subtitle: string, note = '') {
  const date = event?.date || tournament.date;
  const venue = event?.venue || '';
  return `<table class="sheet-header"><tbody><tr>` +
    `<td class="sheet-title">${esc(eventTitle(tournament, event))} - ${esc(categoryName(tournament))}</td>` +
    `<td class="sheet-fields"><span class="sheet-field">ピスト:</span>` +
    `<span class="sheet-field">開始:</span><span class="sheet-field">審判:</span></td></tr>` +
    `<tr><td class="sheet-meta" colspan="2">${esc(date)}${venue ? ` · ${esc(venue)}` : ''} · ${esc(subtitle)}</td></tr>` +
    `${note ? `<tr><td class="sheet-note" colspan="2">${esc(note)}</td></tr>` : ''}` +
    `</tbody></table>`;
}

function latestPools(tournament: Tournament): Pool[] {
  const runtime = [...tournament.phaseRuntimes].reverse().find(item => item.type === 'pool');
  return runtime?.type === 'pool' ? runtime.pools : [];
}

function latestDEMatches(tournament: Tournament): DEMatch[] {
  const runtime = [...tournament.phaseRuntimes].reverse().find(item => item.type === 'de');
  return runtime?.type === 'de' ? runtime.deMatches : [];
}

function fencerLabel(fencer: Fencer | undefined, seed?: number) {
  if (!fencer) return '<span class="bye">TBD</span>';
  const seedLabel = seed ? `[${seed}] ` : '';
  return `${esc(seedLabel + fencer.lastName + fencer.firstName)}` +
    `${fencer.club ? `<span class="de-club">${esc(fencer.club)}</span>` : ''}`;
}

export function arePoolsComplete(tournament: Tournament) {
  const pools = latestPools(tournament);
  return pools.length > 0 && pools.every(pool =>
    pool.fencerIds.length < 2 || (pool.bouts.length > 0 && pool.bouts.every(bout => bout.winner !== null))
  );
}

function buildPoolSheetsHtml(tournament: Tournament, event: PrintEventMeta | undefined, includeResults: boolean) {
  const pools = latestPools(tournament);
  if (pools.length === 0) {
    return `<section class="print-sheet empty-sheet" data-print-sheet="pool-empty">プール分けがまだ作成されていません</section>`;
  }

  return pools.map(pool => {
    const fencers = pool.fencerIds
      .map(id => tournament.fencers.find(fencer => fencer.id === id))
      .filter(Boolean) as Fencer[];
    const order = getBoutOrder(fencers.length);
    const statsMap = includeResults ? calcPoolStats(pool, pool.fencerIds) : new Map();
    const opponentHeaders = fencers.map((_, index) => `<th>${index + 1}</th>`).join('');
    const rows = fencers.map((fencer, rowIndex) => {
      const scoreCells = fencers.map((opponent, columnIndex) => {
        if (rowIndex === columnIndex) return '<td class="self-cell">X</td>';
        if (!includeResults) return '<td></td>';
        const bout = pool.bouts.find(item =>
          (item.fencerAId === fencer.id && item.fencerBId === opponent.id) ||
          (item.fencerAId === opponent.id && item.fencerBId === fencer.id)
        );
        if (!bout || bout.winner === null) return '<td></td>';
        const isA = bout.fencerAId === fencer.id;
        const score = isA ? bout.scoreA : bout.scoreB;
        const won = (isA && bout.winner === 'A') || (!isA && bout.winner === 'B');
        return `<td class="tc ${won ? 'w' : ''}">${won ? 'V' : ''}${score ?? ''}</td>`;
      }).join('');
      const stats = statsMap.get(fencer.id);
      const resultCells = includeResults && stats
        ? `<td class="result-col">${stats.victories}/${stats.matches}</td>` +
          `<td class="result-col">${stats.touchesScored}</td><td class="result-col">${stats.touchesReceived}</td>` +
          `<td class="result-col">${stats.indicator >= 0 ? '+' : ''}${stats.indicator}</td>` +
          `<td class="result-col">${stats.poolRank}</td>`
        : `<td class="result-col"></td><td class="result-col"></td><td class="result-col"></td>` +
          `<td class="result-col"></td><td class="result-col"></td>`;
      return `<tr><td class="number-col">${rowIndex + 1}</td>` +
        `<td class="name-col">${esc(fencer.lastName + fencer.firstName)}</td>` +
        `<td class="club-col">${esc(fencer.club)}</td>${scoreCells}${resultCells}</tr>`;
    }).join('');
    const boutOrder = order.map(([a, b], index) =>
      `<div class="bout-order-item">#${index + 1}&nbsp;&nbsp;${a} - ${b}</div>`
    ).join('');

    return `<section class="print-sheet score-sheet" data-print-sheet="pool" data-pool-index="${pool.index}">` +
      scoreSheetHeader(tournament, event, `プール ${pool.index + 1} ${includeResults ? '結果' : '記録用紙'}`, `${fencers.length}名`) +
      `<table class="pool-grid"><thead><tr><th class="number-col">No.</th><th class="name-col">氏名</th>` +
      `<th class="club-col">所属</th>${opponentHeaders}<th class="result-col">V/M</th>` +
      `<th class="result-col">TD</th><th class="result-col">TR</th><th class="result-col">指数</th>` +
      `<th class="result-col">順位</th></tr></thead><tbody>${rows}</tbody></table>` +
      `${includeResults || order.length === 0 ? '' : `<p class="bout-order-title">試合順</p><div class="bout-order">${boutOrder}</div>`}` +
      `</section>`;
  }).join('');
}

export function buildPoolScoreSheetsHtml(tournament: Tournament, event?: PrintEventMeta) {
  return buildPoolSheetsHtml(tournament, event, false);
}

export function buildPoolResultSheetsHtml(tournament: Tournament, event?: PrintEventMeta) {
  return buildPoolSheetsHtml(tournament, event, true);
}

export function buildPoolScoreSheetsDocument(tournament: Tournament, event?: PrintEventMeta) {
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_プール記録用紙`;
  return printDocument(title, buildPoolScoreSheetsHtml(tournament, event), SCORE_SHEET_STYLE);
}

export function printPoolScoreSheets(tournament: Tournament, event?: PrintEventMeta) {
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_プール記録用紙`;
  openPrint(title, buildPoolScoreSheetsHtml(tournament, event), SCORE_SHEET_STYLE);
}

export function buildPoolSheetsDocument(tournament: Tournament, event?: PrintEventMeta) {
  const complete = arePoolsComplete(tournament);
  const suffix = complete ? 'プール結果' : 'プール記録用紙';
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_${suffix}`;
  const body = complete
    ? buildPoolResultSheetsHtml(tournament, event)
    : buildPoolScoreSheetsHtml(tournament, event);
  return printDocument(title, body, SCORE_SHEET_STYLE);
}

export function printPoolSheets(tournament: Tournament, event?: PrintEventMeta) {
  const complete = arePoolsComplete(tournament);
  const suffix = complete ? 'プール結果' : 'プール記録用紙';
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_${suffix}`;
  const body = complete
    ? buildPoolResultSheetsHtml(tournament, event)
    : buildPoolScoreSheetsHtml(tournament, event);
  openPrint(title, body, SCORE_SHEET_STYLE);
}

export interface DEPrintSheetPlan {
  kind: 'full' | 'preliminary' | 'final';
  startRound: number;
  endRound: number;
  inputStart: number;
  inputCount: number;
  qualifierCount: number;
  label: string;
}

export function buildDEPrintPlan(matches: DEMatch[]): DEPrintSheetPlan[] {
  const mainMatches = matches.filter(match => !match.isThirdPlace);
  if (mainMatches.length === 0) return [];
  const firstRound = Math.min(...mainMatches.map(match => match.round));
  const maxRound = Math.max(...mainMatches.map(match => match.round));
  const bracketSize = mainMatches.filter(match => match.round === firstRound).length * 2;
  if (bracketSize <= 16) {
    return [{
      kind: 'full', startRound: firstRound, endRound: maxRound,
      inputStart: 0, inputCount: bracketSize, qualifierCount: 1, label: 'トーナメント表',
    }];
  }

  const plan: DEPrintSheetPlan[] = [];
  const best8Round = maxRound - 3;
  let stageStartRound = firstRound;
  let stageInputCount = bracketSize;
  let blockNumber = 1;

  while (stageStartRound <= best8Round) {
    const roundsThisStage = Math.min(3, best8Round - stageStartRound + 1);
    const stageEndRound = stageStartRound + roundsThisStage - 1;
    const pageCount = Math.ceil(stageInputCount / 16);
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const inputCount = Math.min(16, stageInputCount - pageIndex * 16);
      plan.push({
        kind: 'preliminary', startRound: stageStartRound, endRound: stageEndRound,
        inputStart: pageIndex * 16, inputCount,
        qualifierCount: inputCount / Math.pow(2, roundsThisStage),
        label: `予選ブロック ${blockNumber++}`,
      });
    }
    stageInputCount /= Math.pow(2, roundsThisStage);
    stageStartRound = stageEndRound + 1;
  }

  plan.push({
    kind: 'final', startRound: best8Round + 1, endRound: maxRound,
    inputStart: 0, inputCount: 8, qualifierCount: 1, label: 'ベスト8以降',
  });
  return plan;
}

function deRoundLabel(round: number, firstRound: number, bracketSize: number) {
  const entrants = bracketSize / Math.pow(2, round - firstRound);
  if (entrants === 2) return '決勝';
  if (entrants === 4) return '準決勝';
  if (entrants === 8) return '準々決勝（ベスト8）';
  return `ベスト${entrants}`;
}

function sourceSlotLabel(round: number, position: number, side: 'A' | 'B', firstRound: number, bracketSize: number) {
  if (round === firstRound) return 'BYE';
  const previousPosition = position * 2 + (side === 'B' ? 1 : 0);
  return `${deRoundLabel(round - 1, firstRound, bracketSize)} ${previousPosition + 1} 勝者`;
}

function renderDEMatch(
  match: DEMatch | undefined,
  round: number,
  position: number,
  tournament: Tournament,
  seedMap: Map<string, number>,
  firstRound: number,
  bracketSize: number,
) {
  const renderSide = (side: 'A' | 'B') => {
    const id = side === 'A' ? match?.fencerAId : match?.fencerBId;
    const score = side === 'A' ? match?.scoreA : match?.scoreB;
    const fencer = id ? tournament.fencers.find(item => item.id === id) : undefined;
    const label = fencer
      ? fencerLabel(fencer, seedMap.get(fencer.id))
      : `<span class="bye">${esc(match?.isThirdPlace
        ? `準決勝 敗者${side === 'A' ? 1 : 2}`
        : sourceSlotLabel(round, position, side, firstRound, bracketSize))}</span>`;
    return `<div class="de-slot"><div class="de-name">${label}</div><div class="de-score">${score ?? ''}</div></div>`;
  };
  return `<div class="de-match">${renderSide('A')}${renderSide('B')}</div>`;
}

export function buildDEBracketSheetsHtml(tournament: Tournament, event?: PrintEventMeta) {
  const matches = latestDEMatches(tournament);
  const plan = buildDEPrintPlan(matches);
  if (plan.length === 0) {
    return `<section class="print-sheet empty-sheet" data-print-sheet="de-empty">トーナメント表がまだ作成されていません</section>`;
  }

  const mainMatches = matches.filter(match => !match.isThirdPlace);
  const firstRound = Math.min(...mainMatches.map(match => match.round));
  const bracketSize = mainMatches.filter(match => match.round === firstRound).length * 2;
  const pools = latestPools(tournament);
  const stats = pools.length > 0 ? calcGlobalStats(pools, tournament.fencers) : [];
  const seedMap = new Map(stats.map(stat => [stat.fencerId, stat.globalRank]));
  const preliminaryCount = plan.filter(sheet => sheet.kind === 'preliminary').length;
  let preliminaryIndex = 0;

  return plan.map(sheet => {
    if (sheet.kind === 'preliminary') preliminaryIndex += 1;
    const roundCount = sheet.endRound - sheet.startRound + 1;
    const note = sheet.kind === 'preliminary'
      ? `${preliminaryIndex}/${preliminaryCount} · この用紙から${sheet.qualifierCount}名が次へ進出`
      : sheet.kind === 'final' ? 'ベスト8から優勝決定まで' : `${bracketSize}名トーナメント`;
    const columns = Array.from({ length: roundCount }, (_, offset) => {
      const round = sheet.startRound + offset;
      const divisor = Math.pow(2, offset + 1);
      const startPosition = sheet.inputStart / divisor;
      const matchCount = sheet.inputCount / divisor;
      const cards = Array.from({ length: matchCount }, (_, index) => {
        const position = startPosition + index;
        const match = mainMatches.find(item => item.round === round && item.position === position);
        return renderDEMatch(match, round, position, tournament, seedMap, firstRound, bracketSize);
      }).join('');
      return `<div class="bracket-round"><h2>${esc(deRoundLabel(round, firstRound, bracketSize))}</h2>` +
        `<div class="bracket-match-list">${cards}</div></div>`;
    }).join('');
    const thirdPlace = sheet.kind !== 'preliminary' ? matches.find(match => match.isThirdPlace) : undefined;
    const thirdPlaceHtml = thirdPlace
      ? `<div class="third-place-sheet"><h2>3位決定戦</h2>` +
        renderDEMatch(thirdPlace, thirdPlace.round, thirdPlace.position, tournament, seedMap, firstRound, bracketSize) +
        `</div>`
      : '';

    return `<section class="print-sheet bracket-sheet" data-print-sheet="de" data-sheet-kind="${sheet.kind}" ` +
      `data-start-count="${sheet.inputCount}" data-qualifier-count="${sheet.qualifierCount}">` +
      scoreSheetHeader(tournament, event, sheet.label, note) +
      `<div class="bracket-columns" style="grid-template-columns:repeat(${roundCount},minmax(0,1fr))">${columns}</div>` +
      `${thirdPlaceHtml}</section>`;
  }).join('');
}

export function buildDEBracketSheetsDocument(tournament: Tournament, event?: PrintEventMeta) {
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_トーナメント記録用紙`;
  return printDocument(title, buildDEBracketSheetsHtml(tournament, event), SCORE_SHEET_STYLE);
}

export function printDEBracketSheets(tournament: Tournament, event?: PrintEventMeta) {
  const title = `${eventTitle(tournament, event)}_${categoryName(tournament)}_トーナメント記録用紙`;
  openPrint(title, buildDEBracketSheetsHtml(tournament, event), SCORE_SHEET_STYLE);
}

// ── 1. プール結果 ────────────────────────────────────────────────
export function printPoolResults(tournament: TournamentView, stats: FencerStats[]) {
  let body = header(tournament, '予選プール結果');

  for (const pool of tournament.pools) {
    const ps = stats
      .filter(s => pool.fencerIds.includes(s.fencerId))
      .sort((a, b) => a.poolRank - b.poolRank);

    body += `<h2>プール ${pool.index + 1}（${pool.fencerIds.length}名）</h2>` +
      `<table><thead><tr>` +
      `<th>P内順</th><th class="tl">氏名</th><th class="tl">所属</th>` +
      `<th>勝</th><th>試</th><th>勝率</th><th>指数</th><th>得点</th><th>失点</th>` +
      `</tr></thead><tbody>`;

    for (const s of ps) {
      const f = tournament.fencers.find(x => x.id === s.fencerId);
      const name = f ? `${f.lastName}${f.firstName}` : '';
      body += `<tr>` +
        `<td class="tc">${s.poolRank}</td>` +
        `<td>${esc(name)}</td>` +
        `<td>${esc(f?.club ?? '')}</td>` +
        `<td class="tc">${s.victories}</td>` +
        `<td class="tc">${s.matches}</td>` +
        `<td class="tc">${s.vm.toFixed(3)}</td>` +
        `<td class="tc">${s.indicator >= 0 ? '+' : ''}${s.indicator}</td>` +
        `<td class="tc">${s.touchesScored}</td>` +
        `<td class="tc">${s.touchesReceived}</td>` +
        `</tr>`;
    }
    body += `</tbody></table>`;

    // 試合スコア一覧
    const fencers = pool.fencerIds
      .map(id => tournament.fencers.find(f => f.id === id))
      .filter(Boolean) as typeof tournament.fencers;

    const completedBouts = pool.bouts.filter(b => b.winner !== null);
    if (completedBouts.length > 0) {
      body += `<table><thead><tr>` +
        `<th class="tl">選手A</th><th>得点A</th><th>得点B</th><th class="tl">選手B</th>` +
        `</tr></thead><tbody>`;
      for (const b of completedBouts) {
        const fa = fencers.find(f => f.id === b.fencerAId);
        const fb = fencers.find(f => f.id === b.fencerBId);
        const wonA = b.winner === 'A';
        body += `<tr>` +
          `<td class="${wonA ? 'w' : 'l'}">${esc(fa ? `${fa.lastName}${fa.firstName}` : '')}</td>` +
          `<td class="tc">${b.scoreA ?? '-'}</td>` +
          `<td class="tc">${b.scoreB ?? '-'}</td>` +
          `<td class="${!wonA ? 'w' : 'l'}">${esc(fb ? `${fb.lastName}${fb.firstName}` : '')}</td>` +
          `</tr>`;
      }
      body += `</tbody></table>`;
    }
  }
  openPrint(`${tournament.name || '大会'}_プール結果`, body);
}

// ── 2. 通過判定 ──────────────────────────────────────────────────
export function printAdvancement(tournament: TournamentView, stats: FencerStats[]) {
  const sorted = [...stats].sort((a, b) => {
    if (a.advanced !== b.advanced) return a.advanced ? -1 : 1;
    return a.globalRank - b.globalRank;
  });
  const advCount = stats.filter(s => s.advanced).length;

  let body = header(tournament, '通過判定') +
    `<p class="meta">通過: ${advCount}名 / 全${tournament.fencers.length}名</p>` +
    `<table><thead><tr>` +
    `<th>総合順位</th><th>プール</th><th>P内順</th><th class="tl">氏名</th><th class="tl">所属</th>` +
    `<th>勝率</th><th>指数</th><th>得点</th><th>判定</th>` +
    `</tr></thead><tbody>`;

  for (const s of sorted) {
    const f = tournament.fencers.find(x => x.id === s.fencerId);
    const name = f ? `${f.lastName}${f.firstName}` : '';
    const pool = tournament.pools.find(p => p.fencerIds.includes(s.fencerId));
    body += `<tr class="${s.advanced ? 'pass' : 'fail'}">` +
      `<td class="tc">${s.globalRank}</td>` +
      `<td class="tc">${pool ? `P${pool.index + 1}` : ''}</td>` +
      `<td class="tc">${s.poolRank}</td>` +
      `<td>${esc(name)}</td>` +
      `<td>${esc(f?.club ?? '')}</td>` +
      `<td class="tc">${s.vm.toFixed(3)}</td>` +
      `<td class="tc">${s.indicator >= 0 ? '+' : ''}${s.indicator}</td>` +
      `<td class="tc">${s.touchesScored}</td>` +
      `<td class="tc">${s.advanced ? '通過' : '除外'}</td>` +
      `</tr>`;
  }
  body += `</tbody></table>`;
  openPrint(`${tournament.name || '大会'}_通過判定`, body);
}

// ── 3. トーナメント結果 ─────────────────────────────────────────
export function printDEResults(tournament: TournamentView, stats: FencerStats[]) {
  const fname = (id: string | null) => {
    if (!id) return 'TBD';
    const f = tournament.fencers.find(x => x.id === id);
    if (!f) return id;
    const s = stats.find(x => x.fencerId === id);
    return `[${s?.globalRank ?? '?'}] ${f.lastName}${f.firstName}`;
  };

  const allMatches = tournament.deMatches;
  const maxRound = Math.max(...allMatches.filter(m => !m.isThirdPlace).map(m => m.round), 0);
  const roundLabel = (r: number) => {
    if (r === maxRound)     return '決勝';
    if (r === maxRound - 1) return '準決勝';
    if (r === maxRound - 2) return '準々決勝';
    return `Round ${r}`;
  };

  const sorted = [...allMatches].sort((a, b) => {
    if (a.isThirdPlace && !b.isThirdPlace) return 1;
    if (!a.isThirdPlace && b.isThirdPlace) return -1;
    if (a.round !== b.round) return a.round - b.round;
    return a.position - b.position;
  });

  let body = header(tournament, 'トーナメント結果') +
    `<table><thead><tr>` +
    `<th>ラウンド</th><th class="tl">選手A</th><th>得点</th><th>得点</th><th class="tl">選手B</th><th>勝者</th>` +
    `</tr></thead><tbody>`;

  for (const m of sorted) {
    if (m.isBye) continue;
    const rnd = m.isThirdPlace ? '3位決定戦' : roundLabel(m.round);
    const wonA = m.winner === 'A';
    const winName = m.winner ? fname(wonA ? m.fencerAId : m.fencerBId) : '－';
    body += `<tr>` +
      `<td class="tc">${rnd}</td>` +
      `<td class="${wonA ? 'w' : ''}">${esc(fname(m.fencerAId))}</td>` +
      `<td class="tc">${m.scoreA ?? '-'}</td>` +
      `<td class="tc">${m.scoreB ?? '-'}</td>` +
      `<td class="${!wonA && m.winner ? 'w' : ''}">${esc(fname(m.fencerBId))}</td>` +
      `<td>${esc(winName)}</td>` +
      `</tr>`;
  }
  body += `</tbody></table>`;
  openPrint(`${tournament.name || '大会'}_DE結果`, body);
}

// ── 4. 最終順位 ──────────────────────────────────────────────────
export function printFinalResults(tournament: TournamentView, stats: FencerStats[]) {
  const sorted = [...stats].sort((a, b) => a.globalRank - b.globalRank);

  let body = header(tournament, '最終順位') +
    `<table><thead><tr>` +
    `<th>順位</th><th class="tl">氏名</th><th class="tl">ふりがな</th><th class="tl">所属</th>` +
    `<th>勝率</th><th>指数</th><th>得点</th>` +
    `</tr></thead><tbody>`;

  for (const s of sorted) {
    const f = tournament.fencers.find(x => x.id === s.fencerId);
    const name = f ? `${f.lastName}${f.firstName}` : '';
    const kana = f ? `${f.lastNameKana}${f.firstNameKana}` : '';
    const cls = s.globalRank <= 3 ? `g${s.globalRank}` : '';
    body += `<tr class="${cls}">` +
      `<td class="tc">${s.globalRank}</td>` +
      `<td>${esc(name)}</td>` +
      `<td>${esc(kana)}</td>` +
      `<td>${esc(f?.club ?? '')}</td>` +
      `<td class="tc">${s.vm.toFixed(3)}</td>` +
      `<td class="tc">${s.indicator >= 0 ? '+' : ''}${s.indicator}</td>` +
      `<td class="tc">${s.touchesScored}</td>` +
      `</tr>`;
  }
  body += `</tbody></table>`;
  openPrint(`${tournament.name || '大会'}_最終順位`, body);
}
