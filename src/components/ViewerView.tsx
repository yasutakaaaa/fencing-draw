import { useState, useEffect, useCallback } from 'react';
import { useStore, useTournament, categoryLabel } from '../store/useStore';
import { calcGlobalStats, applyAdvancement, calcPoolStats, getBoutOrder } from '../utils/ranking';
import type { Pool, Fencer, Bout } from '../types';
import LoginModal from './LoginModal';

// ── フェイユ・ド・プール ───────────────────────────────────────────────
function getCellResult(rowId: string, colId: string, bouts: Bout[]): string | null {
  const bout = bouts.find(b =>
    (b.fencerAId === rowId && b.fencerBId === colId) ||
    (b.fencerAId === colId && b.fencerBId === rowId)
  );
  if (!bout || bout.winner === null) return null;
  const isRowA = bout.fencerAId === rowId;
  const rowWon = (isRowA && bout.winner === 'A') || (!isRowA && bout.winner === 'B');
  const rowScore = isRowA ? bout.scoreA : bout.scoreB;
  return rowWon
    ? (rowScore !== null ? `V${rowScore}` : 'V')
    : (rowScore !== null ? String(rowScore) : 'D');
}

function FeuilleDePoule({ pool, fencers }: { pool: Pool; fencers: Fencer[] }) {
  const poolFencers = pool.fencerIds
    .map(id => fencers.find(f => f.id === id))
    .filter(Boolean) as Fencer[];
  const statsMap = calcPoolStats(pool, pool.fencerIds);
  const withdrawn = pool.withdrawnFencerIds ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full min-w-max">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-600 px-2 py-1.5 text-left font-normal w-6">#</th>
            <th className="border border-gray-600 px-3 py-1.5 text-left font-normal min-w-28">選手名</th>
            {poolFencers.map((_, i) => (
              <th key={i} className="border border-gray-600 w-10 text-center font-normal py-1.5">{i + 1}</th>
            ))}
            <th className="border border-gray-600 w-8 text-center font-bold py-1.5">V</th>
            <th className="border border-gray-600 w-14 text-center font-bold py-1.5">V/M</th>
            <th className="border border-gray-600 w-8 text-center font-bold py-1.5">TS</th>
            <th className="border border-gray-600 w-8 text-center font-bold py-1.5">TR</th>
            <th className="border border-gray-600 w-10 text-center font-bold py-1.5">Ind</th>
            <th className="border border-gray-600 w-8 text-center font-bold py-1.5">Pl</th>
          </tr>
        </thead>
        <tbody>
          {poolFencers.map((rowFencer, rowIdx) => {
            const stats = statsMap.get(rowFencer.id);
            const isWithdrawn = withdrawn.includes(rowFencer.id);
            return (
              <tr key={rowFencer.id} className={`even:bg-gray-50 ${isWithdrawn ? 'opacity-50' : ''}`}>
                <td className="border border-gray-200 px-2 py-1.5 text-gray-400 text-center">{rowIdx + 1}</td>
                <td className="border border-gray-200 px-3 py-1.5 font-medium text-gray-800 whitespace-nowrap">
                  <span>{rowFencer.lastName}{rowFencer.firstName}</span>
                  {rowFencer.club && (
                    <span className="text-gray-400 font-normal ml-1">({rowFencer.club})</span>
                  )}
                  {isWithdrawn && (
                    <span className="ml-1 text-xs text-red-500 font-bold">棄権</span>
                  )}
                </td>
                {poolFencers.map((colFencer, colIdx) => {
                  if (rowIdx === colIdx) {
                    return <td key={colFencer.id} className="border border-gray-200 bg-gray-800 w-10 h-7" />;
                  }
                  // 棄権選手との対戦はノーカウント表示
                  if (withdrawn.includes(colFencer.id) || isWithdrawn) {
                    return (
                      <td key={colFencer.id} className="border border-gray-200 w-10 text-center py-1.5 text-gray-300 text-xs">
                        ―
                      </td>
                    );
                  }
                  const result = getCellResult(rowFencer.id, colFencer.id, pool.bouts);
                  const isVictory = result?.startsWith('V');
                  return (
                    <td
                      key={colFencer.id}
                      className={`border border-gray-200 w-10 text-center py-1.5 ${
                        isVictory ? 'text-blue-700 font-bold' : 'text-gray-600'
                      }`}
                    >
                      {result ?? ''}
                    </td>
                  );
                })}
                <td className="border border-gray-200 text-center font-bold text-gray-700 py-1.5">
                  {isWithdrawn ? '―' : (stats?.victories ?? 0)}
                </td>
                <td className="border border-gray-200 text-center text-gray-600 py-1.5">
                  {isWithdrawn ? '―' : (stats?.vm.toFixed(3) ?? '0.000')}
                </td>
                <td className="border border-gray-200 text-center text-gray-600 py-1.5">
                  {isWithdrawn ? '―' : (stats?.touchesScored ?? 0)}
                </td>
                <td className="border border-gray-200 text-center text-gray-600 py-1.5">
                  {isWithdrawn ? '―' : (stats?.touchesReceived ?? 0)}
                </td>
                <td className={`border border-gray-200 text-center font-medium py-1.5 ${
                  isWithdrawn ? 'text-gray-300' : (stats?.indicator ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'
                }`}>
                  {isWithdrawn ? '―' : (stats ? ((stats.indicator >= 0 ? '+' : '') + stats.indicator) : '0')}
                </td>
                <td className="border border-gray-200 text-center font-bold text-blue-700 py-1.5">
                  {isWithdrawn ? '―' : (stats?.poolRank ?? '—')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 試合順序 ─────────────────────────────────────────────────────────
function BoutSchedule({ pool, fencers }: { pool: Pool; fencers: Fencer[] }) {
  const poolFencers = pool.fencerIds
    .map(id => fencers.find(f => f.id === id))
    .filter(Boolean) as Fencer[];
  const order = getBoutOrder(poolFencers.length);

  if (order.length === 0) return null;

  const getFencerName = (idx: number) => {
    const f = poolFencers[idx - 1];
    return f ? `${f.lastName}${f.firstName}` : `選手${idx}`;
  };

  const getBoutResult = (aIdx: number, bIdx: number) => {
    const fA = poolFencers[aIdx - 1];
    const fB = poolFencers[bIdx - 1];
    if (!fA || !fB) return null;
    const bout = pool.bouts.find(b =>
      (b.fencerAId === fA.id && b.fencerBId === fB.id) ||
      (b.fencerAId === fB.id && b.fencerBId === fA.id)
    );
    if (!bout || bout.winner === null) return null;
    const isAFirst = bout.fencerAId === fA.id;
    const aScore = isAFirst ? bout.scoreA : bout.scoreB;
    const bScore = isAFirst ? bout.scoreB : bout.scoreA;
    const aWon = (isAFirst && bout.winner === 'A') || (!isAFirst && bout.winner === 'B');
    return { aScore, bScore, aWon };
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-500 mb-2">試合順序（FIE推奨）</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
        {order.map(([a, b], i) => {
          const result = getBoutResult(a, b);
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${
                result ? 'bg-gray-50' : 'bg-white border border-gray-100'
              }`}
            >
              <span className="text-gray-400 w-10 shrink-0 font-mono">#{i + 1}</span>
              <span className={`font-medium ${result?.aWon ? 'text-blue-700' : 'text-gray-700'}`}>
                {a}. {getFencerName(a)}
              </span>
              {result ? (
                <span className="text-gray-500 font-bold px-1">
                  {result.aWon ? `V${result.aScore}` : result.aScore}
                  {' - '}
                  {!result.aWon ? `V${result.bScore}` : result.bScore}
                </span>
              ) : (
                <span className="text-gray-300 px-1">vs</span>
              )}
              <span className={`font-medium ${!result?.aWon && result ? 'text-blue-700' : 'text-gray-700'}`}>
                {b}. {getFencerName(b)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────
type Tab = 'entry' | 'pools' | 'advancement' | 'bracket' | 'results';
const ALL_TABS: Tab[] = ['entry', 'pools', 'advancement', 'bracket', 'results'];

function readTabFromHash(): Tab | null {
  const hash = window.location.hash;
  const qs = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const tab = new URLSearchParams(qs).get('tab') as Tab | null;
  return tab && ALL_TABS.includes(tab) ? tab : null;
}

export default function ViewerView() {
  const { setViewMode, closeTournament, closeEvent, openTournament, events, tournaments, user, lastUpdated, conflictWarning, dismissConflict } = useStore();
  const currentEventId = useStore(s => s.currentEventId);
  const tournament = useTournament();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(() => readTabFromHash() ?? 'entry');
  const [showLogin, setShowLogin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);

  if (!tournament) return null;

  const eventId = tournament.eventId ?? currentEventId ?? '';
  const event = events.find(e => e.id === eventId);
  const isOwner = !!user && (user.id === event?.ownerId || !event?.ownerId);
  const eventName = event?.name ?? tournament.name;
  const catLabel = tournament.name || categoryLabel(tournament);

  // 同一イベント内の他カテゴリ
  const siblingCategories = event
    ? event.categoryIds
        .map(id => tournaments.find(t => t.id === id))
        .filter(Boolean)
        .filter(t => t!.id !== tournament.id) as typeof tournaments
    : [];

  const handleEditClick = () => {
    if (isOwner) setViewMode('admin');
    else setShowLogin(true);
  };

  // タブ変化を URL ハッシュに同期
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateHash = useCallback((tab: Tab) => {
    const evtId = tournament.eventId ?? currentEventId ?? '';
    if (evtId) {
      window.location.hash = `/t/${evtId}/c/${tournament.id}?tab=${tab}`;
    } else {
      window.location.hash = `/t/${tournament.id}?tab=${tab}`;
    }
  }, [tournament.id, tournament.eventId, currentEventId]);

  useEffect(() => {
    updateHash(activeTab);
  }, [activeTab, updateHash]);

  // ブラウザの戻る/進むボタンで URL ハッシュが変化したときタブを同期
  useEffect(() => {
    const handler = () => {
      const tab = readTabFromHash();
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // 共有URL コピー
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('URLをコピーしてください:', window.location.href);
    }
  };

  // 最終更新時刻フォーマット
  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : null;

  // プール統計
  const hasPools = tournament.pools.length > 0;
  const allPoolsComplete = hasPools && tournament.pools.every(pool =>
    pool.bouts.every(b => b.winner !== null)
  );
  const globalStats = hasPools ? calcGlobalStats(tournament.pools, tournament.fencers) : [];
  const advancement = tournament.poolPhase?.advancement;
  const statsWithAdv = hasPools && advancement
    ? applyAdvancement(globalStats, advancement.type, advancement.value, tournament.fencers.length)
    : globalStats.map(s => ({ ...s, advanced: true }));

  const fname = (id: string | null) => {
    if (!id) return '';
    const f = tournament.fencers.find(x => x.id === id);
    return f ? `${f.lastName}${f.firstName}` : '';
  };

  // 選手検索
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

  // タブ: 通過判定・最終順位はプール戦完了後のみ表示
  const TABS = [
    { key: 'entry' as Tab,       label: 'エントリー',        visible: true },
    { key: 'pools' as Tab,       label: 'プール表',          visible: hasPools },
    { key: 'advancement' as Tab, label: '通過判定',          visible: allPoolsComplete },
    { key: 'bracket' as Tab,     label: 'トーナメント',      visible: tournament.deMatches.length > 0 || !hasPools },
    { key: 'results' as Tab,     label: '最終順位',          visible: allPoolsComplete || (!hasPools && tournament.deMatches.length > 0) },
  ].filter(t => t.visible);

  // エントリータブ: 所属でグループ化
  const groupedByClub = tournament.fencers.reduce<Record<string, Fencer[]>>((acc, f) => {
    const key = f.club || '（所属なし）';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});
  const sortedClubs = Object.keys(groupedByClub).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-slate-700 shadow print:hidden">
        <div className="max-w-6xl mx-auto px-3 py-2">
          {/* 上段: ナビ + 大会名 + アクション */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 大会に戻る */}
            <button
              className="text-slate-300 hover:text-white text-sm px-1 py-1 rounded transition-colors shrink-0"
              onClick={closeTournament}
            >
              ← 大会
            </button>

            {/* ロゴ (タップでホームへ) */}
            <button
              className="text-white font-black text-lg tracking-tight shrink-0 hover:opacity-80 transition-opacity"
              onClick={closeEvent}
              title="ホームへ"
            >
              Fencing<span className="text-slate-300">Draw</span>
            </button>

            {/* 大会名 + カテゴリ (sm以上) */}
            <div className="min-w-0 hidden sm:block ml-1">
              <span className="text-slate-200 text-xs font-medium truncate block leading-tight">{eventName}</span>
              <span className="text-slate-400 text-xs truncate block leading-tight">{catLabel}</span>
            </div>

            {/* カテゴリ切替 */}
            {siblingCategories.length > 0 && (
              <div className="relative hidden md:block">
                <button
                  className="text-xs border border-slate-500 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors"
                  onClick={() => setShowCatSelector(v => !v)}
                >
                  ▼ 他
                </button>
                {showCatSelector && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 min-w-40">
                    {siblingCategories.map(cat => (
                      <button
                        key={cat.id}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                        onClick={() => { openTournament(cat.id); setShowCatSelector(false); }}
                      >
                        {cat.name || categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 右側アクション */}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
              {/* 最終更新時刻 */}
              {lastUpdatedStr && (
                <span className="text-xs text-slate-400 hidden sm:inline whitespace-nowrap">
                  最終更新 {lastUpdatedStr}
                </span>
              )}
              {/* 共有ボタン */}
              <button
                className="text-xs px-2.5 py-1 rounded border border-slate-500 text-slate-300 hover:text-white hover:border-slate-300 transition-colors"
                onClick={handleShare}
                title="このページのURLをコピー"
              >
                {copied ? '✓ コピー済み' : '共有'}
              </button>
              {/* 印刷ボタン */}
              <button
                className="text-xs px-2.5 py-1 rounded border border-slate-500 text-slate-300 hover:text-white hover:border-slate-300 transition-colors hidden sm:inline"
                onClick={() => window.print()}
                title="印刷（プール表・トーナメント）"
              >🖨 印刷</button>
              {/* 編集ボタン */}
              <button
                className={`text-xs px-2.5 py-1 rounded border transition-colors font-medium ${
                  isOwner
                    ? 'border-blue-400 text-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                    : 'border-slate-500 text-slate-400 hover:text-slate-200'
                }`}
                onClick={handleEditClick}
                title={isOwner ? '管理モードへ切替' : 'ログインして編集'}
              >
                {isOwner ? '✎ 編集' : '🔑 編集'}
              </button>
            </div>
          </div>

          {/* 下段: 検索 + 更新時刻 (モバイル) */}
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="search"
              className="border border-slate-500 bg-slate-800 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="選手・所属で検索…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {lastUpdatedStr && (
              <span className="text-xs text-slate-400 sm:hidden whitespace-nowrap">
                更新 {lastUpdatedStr}
              </span>
            )}
          </div>
        </div>

        {/* 競合警告バナー */}
        {conflictWarning && (
          <div className="bg-amber-500 text-white text-xs px-4 py-2 flex items-center justify-between">
            <span>⚠ 他の端末でデータが更新されました。閲覧モードに戻って再読み込みすると最新になります。</span>
            <button className="ml-3 font-bold hover:opacity-80" onClick={dismissConflict}>×</button>
          </div>
        )}

        {/* タブ */}
        <div className="max-w-6xl mx-auto px-4 pb-1 flex gap-1 overflow-x-auto scrollbar-hide print:hidden">
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
              「{queryTrimmed}」({hitFencers.length}名)
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
                const withdrawn = pool?.withdrawnFencerIds ?? [];
                const isWithdrawn = withdrawn.includes(f.id);

                // プール内の個別対戦結果
                const poolBouts = pool ? pool.bouts.filter(b =>
                  (b.fencerAId === f.id || b.fencerBId === f.id) &&
                  !withdrawn.includes(b.fencerAId) && !withdrawn.includes(b.fencerBId)
                ) : [];

                return (
                  <div key={f.id} className="mb-4 last:mb-0 bg-white rounded-xl p-4 border border-yellow-100">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="font-bold text-gray-800 text-lg">{f.lastName}{f.firstName}</span>
                      {f.lastNameKana && (
                        <span className="text-gray-400 text-sm">{f.lastNameKana}{f.firstNameKana}</span>
                      )}
                      {f.club && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{f.club}</span>}
                      {isWithdrawn && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">棄権</span>}
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
                        <div className={`font-bold ${isWithdrawn ? 'text-red-500' : stat?.advanced ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isWithdrawn ? '棄権' : stat ? (stat.advanced ? '通過' : '除外') : '－'}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">勝率</div>
                        <div className="font-bold text-gray-700">{stat ? stat.vm.toFixed(3) : '－'}</div>
                      </div>
                    </div>

                    {/* プール対戦結果（個別） */}
                    {poolBouts.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1.5 font-medium">プール対戦結果</p>
                        <div className="space-y-1">
                          {poolBouts.map(b => {
                            const isA = b.fencerAId === f.id;
                            const oppId = isA ? b.fencerBId : b.fencerAId;
                            const myScore = isA ? b.scoreA : b.scoreB;
                            const opScore = isA ? b.scoreB : b.scoreA;
                            const won = b.winner === (isA ? 'A' : 'B');
                            const done = b.winner !== null;
                            return (
                              <div key={b.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${done ? (won ? 'bg-blue-50' : 'bg-red-50') : 'bg-gray-50'}`}>
                                {done ? (
                                  <span className={`font-bold w-4 ${won ? 'text-blue-600' : 'text-red-500'}`}>{won ? 'V' : 'D'}</span>
                                ) : (
                                  <span className="text-gray-300 w-4">―</span>
                                )}
                                <span className="text-gray-600 flex-1">vs {fname(oppId)}</span>
                                {done && (
                                  <span className={`font-mono font-bold ${won ? 'text-blue-600' : 'text-red-500'}`}>
                                    {myScore ?? '-'} - {opScore ?? '-'}
                                  </span>
                                )}
                                {!done && <span className="text-gray-300 text-xs">未消化</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
                                <span className={won ? 'text-blue-600 font-bold' : 'text-gray-400'}>{won ? '勝' : '負'}</span>
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

        {/* ── エントリータブ ─────────────────────────── */}
        {activeTab === 'entry' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">エントリー選手</h2>
                <p className="text-sm text-gray-500">
                  {tournament.weapon} {tournament.gender}
                  {tournament.format === '団体' && ' 団体'}
                  {' · '}{tournament.ageCategory}
                  {tournament.ageCategory === 'その他' && tournament.ageCategoryCustom ? `（${tournament.ageCategoryCustom}）` : ''}
                  {' · '}{tournament.fencers.length}名
                </p>
              </div>
              <p className="text-xs text-gray-400">{tournament.date.replace(/-/g, '/')}</p>
            </div>

            {tournament.fencers.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <p>選手がまだ登録されていません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedClubs.map(club => (
                  <div key={club} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-600 px-4 py-2 flex items-center justify-between">
                      <h3 className="text-white font-bold text-sm">{club}</h3>
                      <span className="text-slate-300 text-xs">{groupedByClub[club].length}名</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-500 text-xs bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium">氏名</th>
                            <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">ふりがな</th>
                            <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">学年</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedByClub[club].map(f => (
                            <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800">
                                {f.lastName}{f.firstName}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs hidden sm:table-cell">
                                {f.lastNameKana}{f.firstNameKana}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs hidden sm:table-cell">
                                {f.grade ?? ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── プール表タブ ─────────────────────────── */}
        {activeTab === 'pools' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-800">プール表</h2>
              {!allPoolsComplete && (
                <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                  試合進行中 — 結果は随時更新されます
                </span>
              )}
            </div>
            {!hasPools ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <p className="font-medium mb-1">プールはまだ作成されていません</p>
                <p className="text-xs">管理画面で「組み合わせを作成」してください</p>
              </div>
            ) : (
              tournament.pools.map(pool => (
                <div key={pool.id} className="pool-card bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-600 px-4 py-2 flex items-center justify-between">
                    <h3 className="text-white font-bold">プール {pool.index + 1}</h3>
                    <span className="text-slate-300 text-xs">{pool.fencerIds.length}名</span>
                  </div>
                  <div className="p-3 sm:p-4">
                    <FeuilleDePoule pool={pool} fencers={tournament.fencers} />
                    <BoutSchedule pool={pool} fencers={tournament.fencers} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 通過判定タブ（プール戦完了後のみ表示） ─ */}
        {activeTab === 'advancement' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">通過判定</h2>
            {!allPoolsComplete ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-700">
                <p className="font-medium mb-1">プール戦が進行中です</p>
                <p className="text-sm">全試合が終了すると通過判定が表示されます</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                        <th className="px-3 py-2 text-center">順位</th>
                        <th className="px-3 py-2 text-left">氏名</th>
                        <th className="px-3 py-2 text-left hidden sm:table-cell">所属</th>
                        <th className="px-3 py-2 text-center">勝率</th>
                        <th className="px-3 py-2 text-center hidden sm:table-cell">指数</th>
                        <th className="px-3 py-2 text-center hidden sm:table-cell">得点</th>
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
                              {s.withdrawn && <span className="text-xs text-red-500 ml-1">棄権</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell">{f?.club}</td>
                            <td className="px-3 py-2 text-center">{s.vm.toFixed(3)}</td>
                            <td className="px-3 py-2 text-center hidden sm:table-cell">{s.indicator >= 0 ? '+' : ''}{s.indicator}</td>
                            <td className="px-3 py-2 text-center hidden sm:table-cell">{s.touchesScored}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                s.withdrawn ? 'bg-red-100 text-red-500' :
                                s.advanced ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {s.withdrawn ? '棄権' : s.advanced ? '通過' : '除外'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── トーナメントタブ ──────────────────────── */}
        {activeTab === 'bracket' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">トーナメント</h2>
            {tournament.deMatches.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <p className="font-medium mb-1">トーナメント組み合わせはまだ作成されていません</p>
                <p className="text-xs">プール戦完了後に管理画面で作成されます</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                      <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-3 shadow-sm">
                        <span className="text-xs text-gray-400 w-20 shrink-0 font-medium">{label}</span>
                        <div className="flex-1 flex flex-wrap items-center gap-2">
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

        {/* ── 最終順位タブ ─────────────────────────── */}
        {activeTab === 'results' && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">最終順位</h2>
            {!hasPools && tournament.deMatches.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <p className="font-medium mb-1">大会がまだ完了していません</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                        <th className="px-3 py-2 text-center">順位</th>
                        <th className="px-3 py-2 text-left">氏名</th>
                        <th className="px-3 py-2 text-left hidden sm:table-cell">ふりがな</th>
                        <th className="px-3 py-2 text-left">所属</th>
                        <th className="px-3 py-2 text-center">勝率</th>
                        <th className="px-3 py-2 text-center hidden sm:table-cell">指数</th>
                        <th className="px-3 py-2 text-center hidden sm:table-cell">得点</th>
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
                              {s.withdrawn && <span className="text-xs text-red-500 ml-1">棄権</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-400 text-xs hidden sm:table-cell">
                              {f ? `${f.lastNameKana}${f.firstNameKana}` : ''}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{f?.club}</td>
                            <td className="px-3 py-2 text-center">{s.vm.toFixed(3)}</td>
                            <td className="px-3 py-2 text-center hidden sm:table-cell">
                              {s.indicator >= 0 ? '+' : ''}{s.indicator}
                            </td>
                            <td className="px-3 py-2 text-center hidden sm:table-cell">{s.touchesScored}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
