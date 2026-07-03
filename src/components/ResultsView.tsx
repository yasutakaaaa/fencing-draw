import { useState } from 'react';
import { useStore, useTournament } from '../store/useStore';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { downloadAllCSV, exportFinalCSV, downloadCSV } from '../utils/csv';
import { printFinalResults } from '../utils/pdf';

export default function ResultsView() {
  const { goToPreviousPhase, exportJSON, resetTournament, saveTournamentLog } = useStore();
  const tournament = useTournament();
  const [savedLogId, setSavedLogId] = useState<string | null>(null);

  if (!tournament) return null;

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const advancement = tournament.poolPhase?.advancement;
  const statsWithAdv = advancement
    ? applyAdvancement(globalStats, advancement.type, advancement.value, tournament.fencers.length)
    : globalStats.map(s => ({ ...s, advanced: true }));

  // DE最終結果
  const deMatches = tournament.deMatches;
  const maxRound = deMatches.filter(m => !m.isThirdPlace).reduce((mx, m) => Math.max(mx, m.round), 0);

  const finalResults: Array<{ rank: number; fencerId: string; note: string }> = [];
  const finalMatch = deMatches.find(m => m.round === maxRound && !m.isThirdPlace && m.position === 0);
  if (finalMatch?.winner) {
    const winnerId = finalMatch.winner === 'A' ? finalMatch.fencerAId : finalMatch.fencerBId;
    const loserId  = finalMatch.winner === 'A' ? finalMatch.fencerBId : finalMatch.fencerAId;
    if (winnerId) finalResults.push({ rank: 1, fencerId: winnerId, note: '優勝' });
    if (loserId)  finalResults.push({ rank: 2, fencerId: loserId,  note: '準優勝' });
  }
  const thirdPlaceMatch = deMatches.find(m => m.isThirdPlace);
  if (thirdPlaceMatch?.winner) {
    const winnerId = thirdPlaceMatch.winner === 'A' ? thirdPlaceMatch.fencerAId : thirdPlaceMatch.fencerBId;
    const loserId  = thirdPlaceMatch.winner === 'A' ? thirdPlaceMatch.fencerBId : thirdPlaceMatch.fencerAId;
    if (winnerId) finalResults.push({ rank: 3, fencerId: winnerId, note: '3位' });
    if (loserId)  finalResults.push({ rank: 4, fencerId: loserId,  note: '4位' });
  } else if (maxRound >= 2) {
    const semiMatches = deMatches.filter(m => m.round === maxRound - 1 && !m.isThirdPlace);
    let rank = 3;
    for (const semi of semiMatches) {
      if (semi.winner) {
        const loserId = semi.winner === 'A' ? semi.fencerBId : semi.fencerAId;
        if (loserId) finalResults.push({ rank, fencerId: loserId, note: `${rank}位` });
        rank++;
      }
    }
  }

  const fencerName = (id: string) => {
    const f = tournament.fencers.find(f => f.id === id);
    return f ? `${f.lastName}${f.firstName}` : id;
  };
  const fencerKana = (id: string) => {
    const f = tournament.fencers.find(f => f.id === id);
    return f ? `${f.lastNameKana}${f.firstNameKana}` : '';
  };
  const fencerClub = (id: string) => tournament.fencers.find(f => f.id === id)?.club ?? '';

  const base = tournament.name || '大会';

  const handleBulkDownload = () => downloadAllCSV(tournament, statsWithAdv);
  const handleFinalCSV = () => downloadCSV(exportFinalCSV(tournament, statsWithAdv), `${base}_最終順位.csv`);
  const handleFinalPDF = () => printFinalResults(tournament, statsWithAdv);
  const handleExportJSON = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${base}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleSaveLog = () => {
    const id = saveTournamentLog();
    setSavedLogId(id);
  };

  const medalColors: Record<number, string> = {
    1: 'bg-yellow-400 text-white',
    2: 'bg-gray-400 text-white',
    3: 'bg-orange-400 text-white',
    4: 'bg-orange-300 text-white',
  };
  const rowColors: Record<number, string> = {
    1: 'bg-yellow-50 border border-yellow-200',
    2: 'bg-gray-50 border border-gray-200',
    3: 'bg-orange-50 border border-orange-100',
    4: 'bg-orange-50 border border-orange-100',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">最終順位</h2>
          <p className="text-sm text-gray-500">{tournament.name} · {tournament.weapon} · {tournament.gender}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg"
            onClick={goToPreviousPhase}
          >
            ← トーナメントに戻る
          </button>
          <button
            className="text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg"
            onClick={() => window.print()}
          >
            印刷
          </button>
        </div>
      </div>

      {/* 一括DLバナー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap shadow">
        <div className="text-white">
          <p className="font-bold text-sm">全結果を一括ダウンロード</p>
          <p className="text-blue-200 text-xs mt-0.5">
            ①プール結果 ②プール当落 ③DEスコア ④最終順位 の4ファイルをまとめてDL
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-5 py-2 rounded-lg text-sm transition-colors shadow-sm"
            onClick={handleBulkDownload}
          >
            一括DL（4CSV）
          </button>
          <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-blue-400">
            <span className="text-xs text-blue-200 pl-2 pr-1">最終順位</span>
            <button className="text-xs font-medium bg-blue-500 hover:bg-blue-400 text-white px-2 py-2 border-l border-blue-400" onClick={handleFinalCSV}>CSV</button>
            <button className="text-xs font-medium bg-blue-500 hover:bg-blue-400 text-white px-2 py-2 border-l border-blue-400" onClick={handleFinalPDF}>PDF</button>
          </div>
        </div>
      </div>

      {/* ログ保存 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-700">試合結果をログに保存</p>
          <p className="text-xs text-gray-400 mt-0.5">この大会のスナップショットを履歴として記録します</p>
        </div>
        <div className="flex gap-2 items-center">
          {savedLogId && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              保存済み ID: <code className="font-mono">{savedLogId}</code>
            </span>
          )}
          <button
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            onClick={handleSaveLog}
          >
            {savedLogId ? '再保存' : 'ログに保存'}
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            onClick={handleExportJSON}
          >
            JSONバックアップ
          </button>
        </div>
      </div>

      {/* DE表彰 */}
      {finalResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-yellow-500 px-4 py-2">
            <h3 className="text-white font-bold">トーナメント結果</h3>
          </div>
          <div className="p-4 grid gap-2">
            {finalResults.map(({ rank, fencerId, note }) => (
              <div key={fencerId} className={`flex items-center gap-4 p-3 rounded-lg ${rowColors[rank] ?? ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${medalColors[rank] ?? 'bg-gray-200 text-gray-600'}`}>
                  {rank}
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-lg">{fencerName(fencerId)}</div>
                  <div className="text-sm text-gray-500">{fencerKana(fencerId)} · {fencerClub(fencerId)}</div>
                </div>
                <div className="ml-auto">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${medalColors[rank] ?? 'bg-gray-200 text-gray-600'}`}>{note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* グローバル順位表 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-blue-600 px-4 py-2">
          <h3 className="text-white font-bold">全体順位（グローバルランキング）</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 text-xs bg-gray-50">
                <th className="text-center py-2 px-3 font-medium">順位</th>
                <th className="text-left py-2 px-3 font-medium">氏名</th>
                <th className="text-left py-2 px-2 font-medium">ふりがな</th>
                <th className="text-left py-2 px-2 font-medium">所属</th>
                <th className="text-center py-2 px-2 font-medium">勝率</th>
                <th className="text-center py-2 px-2 font-medium">指数</th>
                <th className="text-center py-2 px-2 font-medium">得点</th>
                <th className="text-center py-2 px-2 font-medium">通過</th>
              </tr>
            </thead>
            <tbody>
              {[...statsWithAdv].sort((a, b) => a.globalRank - b.globalRank).map(s => (
                <tr key={s.fencerId} className={`border-b border-gray-100 hover:bg-gray-50 ${!s.advanced ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-3 text-center font-bold text-gray-700">{s.globalRank}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{fencerName(s.fencerId)}</td>
                  <td className="py-2 px-2 text-gray-400 text-xs">{fencerKana(s.fencerId)}</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">{fencerClub(s.fencerId)}</td>
                  <td className="py-2 px-2 text-center text-gray-700">{s.vm.toFixed(3)}</td>
                  <td className={`py-2 px-2 text-center font-medium ${s.indicator >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {s.indicator >= 0 ? '+' : ''}{s.indicator}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-600">{s.touchesScored}</td>
                  <td className="py-2 px-2 text-center">
                    {s.advanced
                      ? <span className="text-blue-600 text-xs font-medium">○</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <button
          className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-4 py-2 rounded-lg transition-colors"
          onClick={() => {
            if (confirm('大会データをリセットして最初からやり直しますか？')) resetTournament();
          }}
        >
          大会をリセット
        </button>
      </div>
    </div>
  );
}
