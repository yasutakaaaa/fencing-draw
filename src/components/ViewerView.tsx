import { useState } from 'react';
import { useStore, useTournament } from '../store/useStore';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';

export default function ViewerView() {
  const { setViewMode } = useStore();
  const tournament = useTournament();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pools' | 'advancement' | 'bracket' | 'results'>('pools');

  if (!tournament) return null;

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const statsWithAdv = applyAdvancement(
    globalStats,
    tournament.poolPhase.advancement.type,
    tournament.poolPhase.advancement.value,
    tournament.fencers.length
  );

  const fname = (id: string | null) => {
    if (!id) return '';
    const f = tournament.fencers.find(x => x.id === id);
    return f ? `${f.lastName}${f.firstName}` : '';
  };

  // 検索ヒット
  const queryTrimmed = query.trim();
  const hitFencers = queryTrimmed
    ? tournament.fencers.filter(f =>
        `${f.lastName}${f.firstName}`.includes(queryTrimmed) ||
        `${f.lastNameKana}${f.firstNameKana}`.includes(queryTrimmed) ||
        f.club?.includes(queryTrimmed)
      )
    : [];

  const maxRound = tournament.deMatches.filter(m => !m.isThirdPlace).reduce((mx, m) => Math.max(mx, m.round), 0);
  const roundLabel = (r: number) => {
    if (r === maxRound)     return '決勝';
    if (r === maxRound - 1) return '準決勝';
    if (r === maxRound - 2) return '準々決勝';
    return `Round ${r}`;
  };

  const TABS = [
    { key: 'pools',       label: 'プール表' },
    { key: 'advancement', label: '通過判定' },
    { key: 'bracket',     label: 'トーナメント' },
    { key: 'results',     label: '最終順位' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-700 shadow print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-white font-black text-xl tracking-tight">
              Fencing<span className="text-slate-300">Draw</span>
            </span>
            <span className="text-slate-300 text-sm">
              {tournament.name} <span className="text-slate-500 text-xs">閲覧モード</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 氏名検索 */}
            <input
              type="search"
              className="border border-slate-500 bg-slate-800 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="選手名で検索…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {/* 管理モードへの切替は目立たない小さなボタン */}
            <button
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded transition-colors"
              onClick={() => setViewMode('admin')}
              title="管理モードへ切替"
            >
              ✎ 編集
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto print:hidden">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* 検索結果パネル */}
        {queryTrimmed && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <h2 className="font-bold text-yellow-800 mb-3">
              「{queryTrimmed}」の検索結果 ({hitFencers.length}名)
            </h2>
            {hitFencers.length === 0 ? (
              <p className="text-yellow-600 text-sm">一致する選手が見つかりません</p>
            ) : (
              hitFencers.map(f => {
                const pool = tournament.pools.find(p => p.fencerIds.includes(f.id));
                const stat = statsWithAdv.find(s => s.fencerId === f.id);
                const deMatchesForFencer = tournament.deMatches.filter(
                  m => m.fencerAId === f.id || m.fencerBId === f.id
                );
                return (
                  <div key={f.id} className="mb-4 last:mb-0 bg-white rounded-xl p-4 border border-yellow-100">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold text-gray-800 text-lg">{f.lastName}{f.firstName}</span>
                      {f.lastNameKana && (
                        <span className="text-gray-400 text-sm">{f.lastNameKana}{f.firstNameKana}</span>
                      )}
                      {f.club && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{f.club}</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">プール</div>
                        <div className="font-bold text-gray-700">{pool ? `P${pool.index + 1}` : '－'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">総合順位</div>
                        <div className="font-bold text-gray-700">{stat?.globalRank ?? '－'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">通過</div>
                        <div className={`font-bold ${stat?.advanced ? 'text-blue-600' : 'text-gray-400'}`}>
                          {stat ? (stat.advanced ? '通過' : '除外') : '－'}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">勝率</div>
                        <div className="font-bold text-gray-700">{stat ? stat.vm.toFixed(3) : '－'}</div>
                      </div>
                    </div>

                    {/* プール対戦相手 */}
                    {pool && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1 font-medium">プール {pool.index + 1} の対戦相手</p>
                        <div className="flex flex-wrap gap-1">
                          {pool.fencerIds.filter(id => id !== f.id).map(id => (
                            <span key={id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {fname(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DE試合履歴 */}
                    {deMatchesForFencer.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1 font-medium">トーナメント</p>
                        <div className="space-y-1">
                          {deMatchesForFencer.filter(m => !m.isBye).map(m => {
                            const isA = m.fencerAId === f.id;
                            const opponent = fname(isA ? m.fencerBId : m.fencerAId);
                            const myScore = isA ? m.scoreA : m.scoreB;
                            const opScore = isA ? m.scoreB : m.scoreA;
                            const won = m.winner === (isA ? 'A' : 'B');
                            const label = m.isThirdPlace ? '3位決定戦' : roundLabel(m.round);
                            return (
                              <div key={m.id} className={`text-xs flex items-center gap-2 px-2 py-1 rounded ${won ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <span className="text-gray-400 w-16 shrink-0">{label}</span>
                                <span className={won ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                                  {won ? '勝' : '負'}
                                </span>
                                <span className="text-gray-600">vs {opponent || 'TBD'}</span>
                                {m.winner && (
                                  <span className="ml-auto text-gray-500">{myScore ?? '-'} - {opScore ?? '-'}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── プール表タブ ─────────────────────────────── */}
        {activeTab === 'pools' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-800">プール戦結果</h2>
            {tournament.pools.length === 0 ? (
              <p className="text-gray-400">プールがまだ作成されていません</p>
            ) : (
              tournament.pools.map(pool => {
                const ps = statsWithAdv
                  .filter(s => pool.fencerIds.includes(s.fencerId))
                  .sort((a, b) => a.poolRank - b.poolRank);
                return (
                  <div key={pool.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-bold text-gray-700">プール {pool.index + 1}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-600">
                            <th className="px-3 py-2 text-left font-medium">順</th>
                            <th className="px-3 py-2 text-left font-medium">氏名</th>
                            <th className="px-3 py-2 text-left font-medium">所属</th>
                            <th className="px-3 py-2 text-center font-medium">勝</th>
                            <th className="px-3 py-2 text-center font-medium">試</th>
                            <th className="px-3 py-2 text-center font-medium">勝率</th>
                            <th className="px-3 py-2 text-center font-medium">指数</th>
                            <th className="px-3 py-2 text-center font-medium">得点</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ps.map(s => {
                            const f = tournament.fencers.find(x => x.id === s.fencerId);
                            return (
                              <tr key={s.fencerId} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-400 text-center">{s.poolRank}</td>
                                <td className="px-3 py-2 font-medium text-gray-800">
                                  {f ? `${f.lastName}${f.firstName}` : ''}
                                </td>
                                <td className="px-3 py-2 text-gray-500 text-xs">{f?.club}</td>
                                <td className="px-3 py-2 text-center">{s.victories}</td>
                                <td className="px-3 py-2 text-center">{s.matches}</td>
                                <td className="px-3 py-2 text-center">{s.vm.toFixed(3)}</td>
                                <td className="px-3 py-2 text-center">{s.indicator >= 0 ? '+' : ''}{s.indicator}</td>
                                <td className="px-3 py-2 text-center">{s.touchesScored}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── 通過判定タブ ─────────────────────────────── */}
        {activeTab === 'advancement' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">通過判定</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                      <th className="px-3 py-2 text-center">順位</th>
                      <th className="px-3 py-2 text-left">氏名</th>
                      <th className="px-3 py-2 text-left">所属</th>
                      <th className="px-3 py-2 text-center">勝率</th>
                      <th className="px-3 py-2 text-center">指数</th>
                      <th className="px-3 py-2 text-center">得点</th>
                      <th className="px-3 py-2 text-center">判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...statsWithAdv].sort((a, b) => a.globalRank - b.globalRank).map(s => {
                      const f = tournament.fencers.find(x => x.id === s.fencerId);
                      return (
                        <tr key={s.fencerId} className={`border-b border-gray-50 ${s.advanced ? 'bg-blue-50' : 'opacity-50'}`}>
                          <td className="px-3 py-2 text-center font-bold text-gray-700">{s.globalRank}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {f ? `${f.lastName}${f.firstName}` : ''}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{f?.club}</td>
                          <td className="px-3 py-2 text-center">{s.vm.toFixed(3)}</td>
                          <td className="px-3 py-2 text-center">{s.indicator >= 0 ? '+' : ''}{s.indicator}</td>
                          <td className="px-3 py-2 text-center">{s.touchesScored}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.advanced ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                              {s.advanced ? '通過' : '除外'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── トーナメントタブ ────────────────────────── */}
        {activeTab === 'bracket' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">トーナメント</h2>
            {tournament.deMatches.length === 0 ? (
              <p className="text-gray-400">トーナメント組み合わせはまだ作成されていません</p>
            ) : (
              <div className="space-y-3">
                {[...tournament.deMatches]
                  .filter(m => !m.isBye)
                  .sort((a, b) => {
                    if (a.isThirdPlace && !b.isThirdPlace) return 1;
                    if (!a.isThirdPlace && b.isThirdPlace) return -1;
                    if (a.round !== b.round) return a.round - b.round;
                    return a.position - b.position;
                  })
                  .map(m => {
                    const nameA = fname(m.fencerAId) || 'TBD';
                    const nameB = fname(m.fencerBId) || 'TBD';
                    const label = m.isThirdPlace ? '3位決定戦' : roundLabel(m.round);
                    return (
                      <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                        <span className="text-xs text-gray-400 w-20 shrink-0 font-medium">{label}</span>
                        <div className="flex-1 flex items-center gap-3">
                          <span className={`font-medium ${m.winner === 'A' ? 'text-blue-700' : 'text-gray-700'}`}>{nameA}</span>
                          {m.winner ? (
                            <span className="text-sm font-bold text-gray-600">
                              {m.scoreA ?? '-'} : {m.scoreB ?? '-'}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">vs</span>
                          )}
                          <span className={`font-medium ${m.winner === 'B' ? 'text-blue-700' : 'text-gray-700'}`}>{nameB}</span>
                        </div>
                        {m.winner && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                            {m.winner === 'A' ? nameA : nameB} 勝
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── 最終順位タブ ─────────────────────────────── */}
        {activeTab === 'results' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">最終順位</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                      <th className="px-3 py-2 text-center">順位</th>
                      <th className="px-3 py-2 text-left">氏名</th>
                      <th className="px-3 py-2 text-left">ふりがな</th>
                      <th className="px-3 py-2 text-left">所属</th>
                      <th className="px-3 py-2 text-center">勝率</th>
                      <th className="px-3 py-2 text-center">指数</th>
                      <th className="px-3 py-2 text-center">得点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...statsWithAdv].sort((a, b) => a.globalRank - b.globalRank).map(s => {
                      const f = tournament.fencers.find(x => x.id === s.fencerId);
                      const bg = s.globalRank === 1 ? 'bg-yellow-50' : s.globalRank === 2 ? 'bg-gray-50' : s.globalRank === 3 ? 'bg-orange-50' : '';
                      return (
                        <tr key={s.fencerId} className={`border-b border-gray-50 ${bg}`}>
                          <td className="px-3 py-2 text-center font-bold text-gray-700">{s.globalRank}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {f ? `${f.lastName}${f.firstName}` : ''}
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">
                            {f ? `${f.lastNameKana}${f.firstNameKana}` : ''}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{f?.club}</td>
                          <td className="px-3 py-2 text-center">{s.vm.toFixed(3)}</td>
                          <td className="px-3 py-2 text-center">{s.indicator >= 0 ? '+' : ''}{s.indicator}</td>
                          <td className="px-3 py-2 text-center">{s.touchesScored}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
