import { useState } from 'react';
import { useStore, useTournament } from '../store/useStore';
import { calcPoolStats, calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { exportPoolCSV, downloadCSV } from '../utils/csv';
import { printPoolResults } from '../utils/pdf';
import type { Pool, Bout } from '../types';

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

  // 点数が少ない側はVボタン押下不可（同点はOK）
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

  // 表示モード: 確定済みかつ編集中でない
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
    <div className="flex items-center gap-0.5">
      <button
        className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
          vADisabled
            ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-600'
        }`}
        onClick={() => handleVClick('A')}
        disabled={vADisabled}
        title={vADisabled ? 'スコアが低いため選択不可' : 'Aの勝ち'}
      >V</button>
      <input
        className="w-9 text-center text-sm border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={scoreA}
        onChange={e => setScoreA(e.target.value)}
        placeholder="-"
        inputMode="numeric"
      />
      <span className="text-gray-300 text-xs">-</span>
      <input
        className="w-9 text-center text-sm border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={scoreB}
        onChange={e => setScoreB(e.target.value)}
        placeholder="-"
        inputMode="numeric"
      />
      <button
        className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
          vBDisabled
            ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50'
            : 'border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-600'
        }`}
        onClick={() => handleVClick('B')}
        disabled={vBDisabled}
        title={vBDisabled ? 'スコアが低いため選択不可' : 'Bの勝ち'}
      >V</button>
      {editing && (
        <button
          className="text-gray-300 hover:text-gray-600 text-xs ml-0.5"
          onClick={() => setEditing(false)}
          title="キャンセル"
        >×</button>
      )}
    </div>
  );
}

function PoolCard({ pool, allFencers }: { pool: Pool; allFencers: import('../types').Fencer[] }) {
  const { updateBout } = useStore();
  const fencers = pool.fencerIds.map(id => allFencers.find(f => f.id === id)!).filter(Boolean);
  const statsMap = calcPoolStats(pool, pool.fencerIds);
  const ranked = [...fencers].sort((a, b) => {
    const sa = statsMap.get(a.id);
    const sb = statsMap.get(b.id);
    return (sa?.poolRank ?? 99) - (sb?.poolRank ?? 99);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-blue-600 px-4 py-2">
        <h3 className="text-white font-bold">プール {pool.index + 1}</h3>
        <p className="text-blue-200 text-xs">{pool.fencerIds.length}名</p>
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
            </tr>
          </thead>
          <tbody>
            {fencers.map((fencer, rowIdx) => {
              const stats = statsMap.get(fencer.id);
              return (
                <tr key={fencer.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 text-gray-400 text-center">{rowIdx + 1}</td>
                  <td className="py-1.5 font-medium text-gray-800 pr-2">
                    {fencer.lastName}{fencer.firstName}
                    <span className="text-gray-400 text-xs ml-1">{fencer.club}</span>
                  </td>
                  {fencers.map((opponent, colIdx) => {
                    if (rowIdx === colIdx) {
                      return <td key={opponent.id} className="bg-gray-100 py-1.5"></td>;
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

                    // 上三角: 入力・編集セル（ScoreInput内で表示/入力を管理）
                    if (rowIdx < colIdx) {
                      return (
                        <td key={opponent.id} className="py-1.5 text-center">
                          <ScoreInput
                            bout={bout}
                            onUpdate={updates => updateBout(pool.id, bout.id, updates)}
                          />
                        </td>
                      );
                    }
                    // 下三角: 読み取り専用（対称セル）
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
                  <td className="py-1.5 text-center text-gray-700">{stats?.victories ?? 0}</td>
                  <td className="py-1.5 text-center text-gray-500">{stats?.matches ?? 0}</td>
                  <td className="py-1.5 text-center text-gray-700">{stats?.vm.toFixed(3) ?? '—'}</td>
                  <td className={`py-1.5 text-center font-medium ${(stats?.indicator ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {stats ? (stats.indicator >= 0 ? '+' : '') + stats.indicator : '—'}
                  </td>
                  <td className="py-1.5 text-center text-gray-600">{stats?.touchesScored ?? 0}</td>
                  <td className="py-1.5 text-center text-gray-500">{stats?.touchesReceived ?? 0}</td>
                  <td className="py-1.5 text-center font-bold text-blue-700">{stats?.poolRank ?? '—'}</td>
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
            return (
              <div key={f.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <span className="text-xs font-bold text-blue-600">{s?.poolRank}.</span>
                <span className="text-xs font-medium text-gray-700">{f.lastName}{f.firstName}</span>
                <span className="text-xs text-gray-400">({s?.vm.toFixed(2)})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PoolView() {
  const { setAppPhase } = useStore();
  const tournament = useTournament();
  if (!tournament) return null;

  const allComplete = tournament.pools.every(pool =>
    pool.bouts.every(b => b.winner !== null)
  );

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const statsWithAdv = applyAdvancement(
    globalStats,
    tournament.poolPhase.advancement.type,
    tournament.poolPhase.advancement.value,
    tournament.fencers.length
  );
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
            onClick={() => setAppPhase('entry')}
          >
            ← エントリーに戻る
          </button>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <span className="text-xs text-gray-400 pl-2 pr-1">プール結果</span>
            <button className="text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 border-l border-gray-200" onClick={handleCSV}>CSV</button>
            <button className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 border-l border-gray-200" onClick={handlePDF}>PDF</button>
          </div>
          <button
            className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
              allComplete
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!allComplete}
            onClick={() => setAppPhase('advancement')}
          >
            通過判定を見る →
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>スコア入力：</strong>点数を入力 → 勝者の「V」をクリックして確定。
        同点プライオリティ勝ちはそのままVを押す。確定後は ✏ で再編集可能。
        点数が少ない側のVボタンは自動的に押下不可になります。
      </div>

      <div className="grid gap-6">
        {tournament.pools.map(pool => (
          <PoolCard key={pool.id} pool={pool} allFencers={tournament.fencers} />
        ))}
      </div>
    </div>
  );
}
