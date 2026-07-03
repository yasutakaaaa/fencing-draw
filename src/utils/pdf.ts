import type { Tournament, Pool, DEMatch, FencerStats } from '../types';

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

function openPrint(title: string, body: string) {
  const win = window.open('', '_blank', 'width=960,height=740');
  if (!win) {
    alert('ポップアップをブロックされています。ブラウザの設定で許可してください。');
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">` +
    `<title>${esc(title)}</title>${STYLE}</head><body>${body}` +
    `<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>` +
    `</body></html>`
  );
  win.document.close();
}

function header(t: TournamentView, subtitle: string) {
  return `<h1>${esc(t.name || '大会')}</h1>` +
    `<p class="meta">${esc(t.date)} · ${esc(t.weapon)} · ${esc(t.gender)} · ${subtitle}</p>`;
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
