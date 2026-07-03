import { useState } from 'react';
import { useStore, useTournament } from '../store/useStore';
import { calcPoolStats, calcGlobalStats, applyAdvancement, getBoutOrder } from '../utils/ranking';
import { exportPoolCSV, downloadCSV } from '../utils/csv';
import { printPoolResults } from '../utils/pdf';
import type { Pool, Bout } from '../types';

type PoolViewTab = 'scores' | 'piste';

function ScoreInput({
  bout,
  onUpdate,
}: {
  bout: Bout;
  onUpdate: (updates: Partial<Bout>) => void;
}) {
  const [scoreA, setScoreA] = useState(bout.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(bout.scoreB?.toString() ?? '');
  const [editing, setEditing] = useState(false);

  const saNum = scoreA === '' ? null : Number(scoreA);
  const sbNum = scoreB === '' ? null : Number(scoreB);

  const vADisabled = saNum !== null && sbNum !== null && saNum < sbNum;
  const vBDisabled = saNum !== null && sbNum !== null && sbNum < saNum;

  const handleVClick = (w: 'A' | 'B') => {
    onUpdate({ scoreA: saNum, scoreB: sbNum, winner: w });
    setEditing(false);
  };

  const handleEdit = () => {
    setScoreA(bout.scoreA?.toString() ?? '');
    setScoreB(bout.scoreB?.toString() ?? '');
    setEditing(true);
  };

  if (bout.winner !== null && !editing) {
    const wonA = bout.winner === 'A';
    const sa = bout.scoreA !== null ? bout.scoreA : '-';
    const sb = bout.scoreB !== null ? bout.scoreB : '-';
    return (
      <div className="flex items-center gap-1 justify-center">
        <span className={`font-bold text-xs ${wonA ? 'text-blue-700' : 'text-red-500'}`}>
          {wonA ? 'V' : 'D'}{sa}-{sb}
        </span>
        <button
          className="text-gray-300 hover:text-gray-600 text-xs leading-none ml-0.5"
          onClick={handleEdit}
          title="編集"
        >✏</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors touch-manipulation ${
          vADisabled
            ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-500 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100'
        }`}
        onClick={() => handleVClick('A')}
        disabled={vADisabled}
        title={vADisabled ? 'スコアが低いため選択不可' : 'Aの勝ち'}
      >V</button>
      <input
        className="w-10 text-center text-sm border border-gray-300 rounded-lg px-1 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 touch-manipulation"
        value={scoreA}
        onChange={e => setScoreA(e.target.value)}
        placeholder="-"
        inputMode="numeric"
      />
      <span className="text-gray-300 text-xs">-</span>
      <input
        className="w-10 text-center text-sm border border-gray-300 rounded-lg px-1 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 touch-manipulation"
        value={scoreB}
        onChange={e => setScoreB(e.target.value)}
        placeholder="-"
        inputMode="numeric"
      />
      <button
        className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors touch-manipulation ${
          vBDisabled
            ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-500 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100'
        }`}
        onClick={() => handleVClick('B')}
        disabled={vBDisabled}
        title={vBDisabled ? 'スコアが低いため選択不可' : 'Bの勝ち'}
      >V</button>
      {editing && (
        <button
          className="text-gray-300 hover:text-gray-600 text-sm ml-0.5 w-7 h-7"
          onClick={() => setEditing(false)}
          title="キャンセル"
        >×</button>
      )}
    </div>
  );
}

function PoolCard({ pool, allFencers }: { pool: Pool; allFencers: import('../types').Fencer[] }) {
  const { updateBout, setFencerWithdrawn } = useStore();
  // undo スタック（最大10件）
  const [undoStack, setUndoStack] = useState<Pool[]>([]);

  const handleUpdateBout = (boutId: string, updates: Partial<Bout>) => {
    setUndoStack(prev => [pool, ...prev.slice(0, 9)]);
    updateBout(pool.id, boutId, updates);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [prev, ...rest] = undoStack;
    setUndoStack(rest);
    // 前の状態に戻す: pool の全 bouts を復元
    for (const b of prev.bouts) {
      updateBout(pool.id, b.id, { scoreA: b.scoreA, scoreB: b.scoreB, winner: b.winner });
    }
  };

  const fencers = pool.fencerIds.map(id => allFencers.find(f => f.id === id)!).filter(Boolean);
  const withdrawn = pool.withdrawnFencerIds ?? [];
  const statsMap = calcPoolStats(pool, pool.fencerIds);
  const ranked = [...fencers].sort((a, b) => {
    const sa = statsMap.get(a.id);
    const sb = statsMap.get(b.id);
    return (sa?.poolRank ?? 99) - (sb?.poolRank ?? 99);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
        <h3 className="text-white font-bold">プール {pool.index + 1}</h3>
        <div className="flex items-center gap-2">
          {undoStack.length > 0 && (
            <button
              className="text-xs text-blue-200 hover:text-white border border-blue-400 hover:border-white px-2 py-0.5 rounded transition-colors"
              onClick={handleUndo}
              title="直前の入力を取り消す"
            >↩ 取消</button>
          )}
          <p className="text-blue-200 text-xs">{pool.fencerIds.length}名</p>
        </div>
      </div>

      {/* Score grid */}
      <div className="p-4 overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th className="w-6 text-gray-400 pb-1">#</th>
              <th className="text-left text-gray-600 pb-1 min-w-20">選手</th>
              {fencers.map((_, i) => (
                <th key={i} className="w-28 text-center text-gray-500 pb-1">{i + 1}</th>
              ))}
              <th className="w-8 text-center text-gray-500 pb-1">勝</th>
              <th className="w-8 text-center text-gray-500 pb-1">試</th>
              <th className="w-14 text-center text-gray-500 pb-1">勝率</th>
              <th className="w-10 text-center text-gray-500 pb-1">指数</th>
              <th className="w-8 text-center text-gray-500 pb-1">得点</th>
              <th className="w-8 text-center text-gray-500 pb-1">失点</th>
              <th className="w-6 text-center text-gray-600 font-bold pb-1">順</th>
              <th className="w-12 text-center text-gray-500 pb-1">棄権</th>
            </tr>
          </thead>
          <tbody>
            {fencers.map((fencer, rowIdx) => {
              const stats = statsMap.get(fencer.id);
              const isWithdrawn = withdrawn.includes(fencer.id);
              return (
                <tr key={fencer.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isWithdrawn ? 'opacity-50' : ''}`}>
                  <td className="py-1.5 text-gray-400 text-center">{rowIdx + 1}</td>
                  <td className="py-1.5 font-medium text-gray-800 pr-2">
                    {fencer.lastName}{fencer.firstName}
                    <span className="text-gray-400 text-xs ml-1">{fencer.club}</span>
                    {isWithdrawn && <span className="text-xs text-red-500 ml-1 font-bold">棄権</span>}
                  </td>
                  {fencers.map((opponent, colIdx) => {
                    if (rowIdx === colIdx) {
                      return <td key={opponent.id} className="bg-gray-100 py-1.5"></td>;
                    }
                    if (isWithdrawn || withdrawn.includes(opponent.id)) {
                      return (
                        <td key={opponent.id} className="py-1.5 text-center text-gray-300 text-xs">―</td>
                      );
                    }
                    const bout = pool.bouts.find(
                      b =>
                        (b.fencerAId === fencer.id && b.fencerBId === opponent.id) ||
                        (b.fencerBId === fencer.id && b.fencerAId === opponent.id)
                    );
                    if (!bout) return <td key={opponent.id}></td>;
                    const isA = bout.fencerAId === fencer.id;
                    const myScore = isA ? bout.scoreA : bout.scoreB;
                    const oppScore = isA ? bout.scoreB : bout.scoreA;
                    const iWon = (isA && bout.winner === 'A') || (!isA && bout.winner === 'B');

                    if (rowIdx < colIdx) {
                      return (
                        <td key={opponent.id} className="py-1.5 text-center">
                          <ScoreInput
                            bout={bout}
                            onUpdate={updates => handleUpdateBout(bout.id, updates)}
                          />
                        </td>
                      );
                    }
                    if (bout.winner !== null && myScore !== null && oppScore !== null) {
                      return (
                        <td key={opponent.id} className="py-1.5 text-center">
                          <span className={`font-bold text-xs ${iWon ? 'text-blue-700' : 'text-red-500'}`}>
                            {iWon ? 'V' : 'D'}{myScore}-{oppScore}
                          </span>
                        </td>
                      );
                    }
                    return <td key={opponent.id} className="py-1.5 text-center text-gray-300">—</td>;
                  })}
                  <td className="py-1.5 text-center text-gray-700">{isWithdrawn ? '―' : (stats?.victories ?? 0)}</td>
                  <td className="py-1.5 text-center text-gray-500">{isWithdrawn ? '―' : (stats?.matches ?? 0)}</td>
                  <td className="py-1.5 text-center text-gray-700">{isWithdrawn ? '―' : (stats?.vm.toFixed(3) ?? '—')}</td>
                  <td className={`py-1.5 text-center font-medium ${isWithdrawn ? 'text-gray-300' : (stats?.indicator ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {isWithdrawn ? '―' : (stats ? (stats.indicator >= 0 ? '+' : '') + stats.indicator : '—')}
                  </td>
                  <td className="py-1.5 text-center text-gray-600">{isWithdrawn ? '―' : (stats?.touchesScored ?? 0)}</td>
                  <td className="py-1.5 text-center text-gray-500">{isWithdrawn ? '―' : (stats?.touchesReceived ?? 0)}</td>
                  <td className="py-1.5 text-center font-bold text-blue-700">{isWithdrawn ? '―' : (stats?.poolRank ?? '—')}</td>
                  <td className="py-1.5 text-center">
                    <button
                      className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                        isWithdrawn
                          ? 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200'
                          : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500'
                      }`}
                      onClick={() => setFencerWithdrawn(pool.id, fencer.id, !isWithdrawn)}
                      title={isWithdrawn ? '棄権を取消' : '棄権にする'}
                    >
                      {isWithdrawn ? '取消' : '棄権'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pool ranking */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
        <p className="text-xs font-medium text-gray-500 mb-2">プール内順位</p>
        <div className="flex flex-wrap gap-2">
          {ranked.map(f => {
            const s = statsMap.get(f.id);
            const isW = withdrawn.includes(f.id);
            return (
              <div key={f.id} className={`flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 ${isW ? 'opacity-50' : ''}`}>
                <span className="text-xs font-bold text-blue-600">{s?.poolRank}.</span>
                <span className="text-xs font-medium text-gray-700">{f.lastName}{f.firstName}</span>
                {isW && <span className="text-xs text-red-400">棄権</span>}
                {!isW && <span className="text-xs text-gray-400">({s?.vm.toFixed(2)})</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ピスト割り振り ────────────────────────────────────────────────────
function PisteAssignment({ pool, allFencers }: { pool: Pool; allFencers: import('../types').Fencer[] }) {
  const { setBoutPiste } = useStore();
  const fencers = pool.fencerIds.map(id => allFencers.find(f => f.id === id)!).filter(Boolean);
  const withdrawn = pool.withdrawnFencerIds ?? [];
  const order = getBoutOrder(fencers.length);

  const fname = (id: string) => {
    const f = fencers.find(x => x.id === id);
    return f ? `${f.lastName}${f.firstName}` : '?';
  };

  const getBoutForPair = (aIdx: number, bIdx: number) => {
    const fA = fencers[aIdx - 1];
    const fB = fencers[bIdx - 1];
    if (!fA || !fB) return undefined;
    return pool.bouts.find(b =>
      (b.fencerAId === fA.id && b.fencerBId === fB.id) ||
      (b.fencerAId === fB.id && b.fencerBId === fA.id)
    );
  };

  const activeBouts = order.map(([a, b], i) => {
    const bout = getBoutForPair(a, b);
    const fA = fencers[a - 1];
    const fB = fencers[b - 1];
    return { boutNum: i + 1, bout, fA, fB };
  }).filter(({ fA, fB }) => {
    if (!fA || !fB) return false;
    if (withdrawn.includes(fA.id) || withdrawn.includes(fB.id)) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      {activeBouts.map(({ boutNum, bout, fA, fB }) => {
        if (!bout || !fA || !fB) return null;
        return (
          <div key={bout.id} className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-400 w-8 shrink-0 font-mono">#{boutNum}</span>
            <div className="flex-1 text-sm text-gray-700">
              <span className={bout.winner === 'A' ? 'font-bold text-blue-700' : ''}>{fname(fA.id)}</span>
              <span className="text-gray-400 mx-2">vs</span>
              <span className={bout.winner === 'B' ? 'font-bold text-blue-700' : ''}>{fname(fB.id)}</span>
              {bout.winner && (
                <span className="ml-2 text-xs text-green-600">
                  ✓ {bout.scoreA}-{bout.scoreB}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-500">ピスト</span>
              <input
                type="number"
                min={1}
                max={99}
                className="w-14 text-center text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={bout.pisteNumber ?? ''}
                placeholder="—"
                onChange={e => {
                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                  setBoutPiste(pool.id, bout.id, val);
                }}
              />
            </div>
          </div>
        );
      })}
      {activeBouts.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">対象試合がありません</p>
      )}
    </div>
  );
}

export default function PoolView() {
  const { goBackToEntry, setPoolSubPhase, startNextPhase } = useStore();
  const tournament = useTournament();
  const [tab, setTab] = useState<PoolViewTab>('scores');

  if (!tournament) return null;

  const allComplete = tournament.pools.every(pool =>
    pool.bouts.every(b => b.winner !== null)
  );

  const poolPhase = tournament.poolPhase;
  const advancement = poolPhase?.advancement;

  const hasNextPhase = tournament.activePhaseIdx + 1 < tournament.phases.length;
  const isLastPoolPhase = !advancement;

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const statsWithAdv = advancement
    ? applyAdvancement(globalStats, advancement.type, advancement.value, tournament.fencers.length)
    : globalStats.map(s => ({ ...s, advanced: true }));
  const advancedCount = statsWithAdv.filter(s => s.advanced).length;

  const base = tournament.name || '大会';
  const handleCSV = () => downloadCSV(exportPoolCSV(tournament, statsWithAdv), `${base}_プール結果.csv`);
  const handlePDF = () => printPoolResults(tournament, statsWithAdv);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">プール戦</h2>
          <p className="text-sm text-gray-500">
            {tournament.pools.length}プール · 通過予定 {advancedCount}名
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg"
            onClick={goBackToEntry}
          >
            ← エントリーに戻る
          </button>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <span className="text-xs text-gray-400 pl-2 pr-1">プール結果</span>
            <button className="text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 border-l border-gray-200" onClick={handleCSV}>CSV</button>
            <button className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 border-l border-gray-200" onClick={handlePDF}>PDF</button>
          </div>
          {hasNextPhase && !isLastPoolPhase && (
            <button
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                allComplete
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!allComplete}
              onClick={() => setPoolSubPhase('advancement')}
            >
              通過判定を見る →
            </button>
          )}
          {(isLastPoolPhase || !hasNextPhase) && (
            <button
              className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                allComplete
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!allComplete}
              onClick={startNextPhase}
            >
              最終順位を確定 →
            </button>
          )}
        </div>
      </div>

      {/* サブタブ */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'scores' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('scores')}
        >
          スコア入力
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'piste' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('piste')}
        >
          ピスト割り振り
        </button>
      </div>

      {tab === 'scores' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>スコア入力：</strong>点数を入力 → 勝者の「V」をクリックして確定。
            確定後は ✏ で再編集可能。途中棄権は各行の「棄権」ボタンで記録（対戦成績ノーカウント）。
          </div>
          <div className="grid gap-6">
            {tournament.pools.map(pool => (
              <PoolCard key={pool.id} pool={pool} allFencers={tournament.fencers} />
            ))}
          </div>
        </>
      )}

      {tab === 'piste' && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <strong>ピスト割り振り：</strong>各試合に試合場番号を入力してください。
            棄権選手との試合は非表示です。
          </div>
          <div className="space-y-6">
            {tournament.pools.map(pool => (
              <div key={pool.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-blue-600 px-4 py-2">
                  <h3 className="text-white font-bold">プール {pool.index + 1}</h3>
                </div>
                <div className="p-4">
                  <PisteAssignment pool={pool} allFencers={tournament.fencers} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
