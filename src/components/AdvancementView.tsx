import { useStore } from '../store/useStore';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { exportPoolCSV, exportAdvancementCSV, downloadCSV } from '../utils/csv';
import { printPoolResults, printAdvancement } from '../utils/pdf';

export default function AdvancementView() {
  const { tournament, setAppPhase, generateBracket } = useStore();

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const statsWithAdv = applyAdvancement(
    globalStats,
    tournament.poolPhase.advancement.type,
    tournament.poolPhase.advancement.value,
    tournament.fencers.length
  );

  // 通過者→除外者の順に、それぞれ順位順
  const sorted = [...statsWithAdv].sort((a, b) => {
    if (a.advanced !== b.advanced) return a.advanced ? -1 : 1;
    return a.globalRank - b.globalRank;
  });

  const advancedCount = statsWithAdv.filter(s => s.advanced).length;

  const fencerName = (id: string) => {
    const f = tournament.fencers.find(f => f.id === id);
    return f ? `${f.lastName}${f.firstName}` : id;
  };
  const fencerClub = (id: string) => tournament.fencers.find(f => f.id === id)?.club ?? '';
  const poolName = (fencerId: string) => {
    const pool = tournament.pools.find(p => p.fencerIds.includes(fencerId));
    return pool ? `P${pool.index + 1}` : '';
  };

  const base = tournament.name || '大会';
  const handlePoolCSV  = () => downloadCSV(exportPoolCSV(tournament, statsWithAdv), `${base}_プール結果.csv`);
  const handlePoolPDF  = () => printPoolResults(tournament, statsWithAdv);
  const handleAdvCSV   = () => downloadCSV(exportAdvancementCSV(tournament, statsWithAdv), `${base}_プール当落.csv`);
  const handleAdvPDF   = () => printAdvancement(tournament, statsWithAdv);

  const dividerIdx = sorted.findIndex(s => !s.advanced);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">通過判定</h2>
          <p className="text-sm text-gray-500">
            グローバル順位 · 通過 {advancedCount}名 / 全{tournament.fencers.length}名
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg"
            onClick={() => setAppPhase('pool')}
          >
            ← プール戦に戻る
          </button>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <span className="text-xs text-gray-400 pl-2 pr-1">プール結果</span>
            <button className="text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 border-l border-gray-200" onClick={handlePoolCSV}>CSV</button>
            <button className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 border-l border-gray-200" onClick={handlePoolPDF}>PDF</button>
          </div>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <span className="text-xs text-gray-400 pl-2 pr-1">当落表</span>
            <button className="text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 border-l border-gray-200" onClick={handleAdvCSV}>CSV</button>
            <button className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 border-l border-gray-200" onClick={handleAdvPDF}>PDF</button>
          </div>
          <button
            className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg"
            onClick={generateBracket}
          >
            トーナメント表を作成 →
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-blue-600 px-4 py-2">
          <p className="text-white text-sm font-medium">
            通過条件: {tournament.poolPhase.advancement.type === 'percent'
              ? `上位${tournament.poolPhase.advancement.value}%`
              : `上位${tournament.poolPhase.advancement.value}名`} → {advancedCount}名通過
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 text-xs bg-gray-50">
                <th className="text-center py-2 px-3 font-medium w-12">総合順位</th>
                <th className="text-center py-2 px-2 font-medium w-12">プール</th>
                <th className="text-center py-2 px-2 font-medium w-10">P内順</th>
                <th className="text-left py-2 px-3 font-medium">氏名</th>
                <th className="text-left py-2 px-2 font-medium">所属</th>
                <th className="text-center py-2 px-2 font-medium w-14">勝率</th>
                <th className="text-center py-2 px-2 font-medium w-12">指数</th>
                <th className="text-center py-2 px-2 font-medium w-10">得点</th>
                <th className="text-center py-2 px-2 font-medium w-16">判定</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => (
                <>
                  {/* 通過→除外の境界線 */}
                  {idx === dividerIdx && dividerIdx > 0 && (
                    <tr key="divider">
                      <td colSpan={9} className="py-0">
                        <div className="border-t-2 border-dashed border-red-300 mx-2 my-1 relative">
                          <span className="absolute -top-2.5 left-4 bg-white px-2 text-xs text-red-400 font-medium">── 通過ライン ──</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    key={s.fencerId}
                    className={`border-b border-gray-100 ${
                      s.advanced ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50 opacity-60'
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-bold text-gray-700">{s.globalRank}</td>
                    <td className="py-2 px-2 text-center text-gray-500 text-xs">{poolName(s.fencerId)}</td>
                    <td className="py-2 px-2 text-center text-gray-500 text-xs">{s.poolRank}</td>
                    <td className="py-2 px-3 font-medium text-gray-800">{fencerName(s.fencerId)}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{fencerClub(s.fencerId)}</td>
                    <td className="py-2 px-2 text-center text-gray-700">{s.vm.toFixed(3)}</td>
                    <td className={`py-2 px-2 text-center font-medium ${s.indicator >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {s.indicator >= 0 ? '+' : ''}{s.indicator}
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600">{s.touchesScored}</td>
                    <td className="py-2 px-2 text-center">
                      {s.advanced
                        ? <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">通過</span>
                        : <span className="bg-gray-200 text-gray-400 text-xs px-2 py-0.5 rounded-full">除外</span>}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
