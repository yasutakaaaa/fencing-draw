import { useStore, useTournament } from '../store/useStore';
import { calcGlobalStats, applyAdvancement } from '../utils/ranking';
import { exportDEResultsCSV, downloadCSV } from '../utils/csv';
import { printDEResults } from '../utils/pdf';
import type { DEMatch } from '../types';
import { useState, useEffect } from 'react';

function MatchCard({
  match,
  fencerName,
  onUpdate,
  onConfirm,
  onRevert,
}: {
  match: DEMatch;
  fencerName: (id: string | null) => string;
  onUpdate: (updates: Partial<DEMatch>) => void;
  onConfirm: () => void;
  onRevert: () => void;
}) {
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? '');

  // 「修正」でnullリセット時にローカル入力欄を同期
  useEffect(() => {
    setScoreA(match.scoreA?.toString() ?? '');
    setScoreB(match.scoreB?.toString() ?? '');
  }, [match.scoreA, match.scoreB]);

  if (match.isBye) {
    const winner = match.winner === 'A' ? match.fencerAId : match.fencerBId;
    return (
      <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 min-w-44">
        <div className="text-xs text-gray-400 mb-1">BYE</div>
        <div className="text-sm font-medium text-gray-700">{fencerName(winner)}</div>
        <div className="text-xs text-blue-500 mt-1">不戦勝</div>
      </div>
    );
  }

  const saNum = scoreA === '' ? null : Number(scoreA);
  const sbNum = scoreB === '' ? null : Number(scoreB);

  // 点数が少ない側はVボタン押下不可（同点はOK）
  const vDisabled: Record<'A' | 'B', boolean> = {
    A: saNum !== null && sbNum !== null && saNum < sbNum,
    B: saNum !== null && sbNum !== null && sbNum < saNum,
  };

  // V押下 → スコア保存 + 即座に次ラウンドへ繰り上げ
  const handleWinner = (w: 'A' | 'B') => {
    if (vDisabled[w] || !match.fencerAId || !match.fencerBId) return;
    onUpdate({ scoreA: saNum, scoreB: sbNum, winner: w });
    // Zustand の set は同期的なので get() で最新状態を読んだ confirmDEMatch が正しく動く
    onConfirm();
  };

  // 確定済み表示
  if (match.winner !== null) {
    const winnerName = fencerName(match.winner === 'A' ? match.fencerAId : match.fencerBId);
    const loserName  = fencerName(match.winner === 'A' ? match.fencerBId : match.fencerAId);
    const wScore = match.winner === 'A' ? match.scoreA : match.scoreB;
    const lScore = match.winner === 'A' ? match.scoreB : match.scoreA;
    return (
      <div className="border border-blue-200 rounded-lg p-2 bg-blue-50 min-w-44">
        <div className="text-sm font-bold text-blue-700">{winnerName}</div>
        <div className="text-xs text-blue-500">
          {wScore !== null ? `V${wScore}-${lScore ?? '-'}` : '勝利'}
        </div>
        <div className="text-xs text-gray-400 line-through">{loserName}</div>
        <button
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
          onClick={onRevert}
        >
          修正
        </button>
      </div>
    );
  }

  // 入力中
  const bothReady = !!match.fencerAId && !!match.fencerBId;
  return (
    <div className="border border-gray-200 rounded-lg p-2 bg-white min-w-52">
      <div className="space-y-1.5">
        {(['A', 'B'] as const).map(side => {
          const fId    = side === 'A' ? match.fencerAId : match.fencerBId;
          const score  = side === 'A' ? scoreA : scoreB;
          const setSc  = side === 'A' ? setScoreA : setScoreB;
          const dis    = vDisabled[side];
          return (
            <div key={side} className="flex items-center gap-2">
              <button
                className={`w-6 h-6 rounded text-xs font-bold border flex-shrink-0 transition-colors ${
                  !bothReady || dis
                    ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50'
                    : 'border-gray-300 text-gray-400 hover:border-blue-400'
                }`}
                onClick={() => handleWinner(side)}
                disabled={!bothReady || dis}
                title={!bothReady ? '対戦相手が確定していません' : dis ? 'スコアが低いため選択不可' : `${side}の勝ち`}
              >V</button>
              <span className="text-xs text-gray-700 flex-1 truncate">
                {fId ? fencerName(fId) : <span className="text-gray-300">TBD</span>}
              </span>
              <input
                className="w-10 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-300"
                value={score}
                onChange={e => setSc(e.target.value)}
                placeholder="-"
                inputMode="numeric"
                disabled={!fId}
              />
            </div>
          );
        })}
      </div>
      {!bothReady && (
        <p className="mt-1.5 text-xs text-gray-300 text-center">前の試合の結果を確定してください</p>
      )}
    </div>
  );
}

export default function BracketView() {
  const { goToPreviousPhase, startNextPhase, updateDEMatch, confirmDEMatch, revertDEMatch } = useStore();
  const tournament = useTournament();
  if (!tournament) return null;
  const { deMatches, dePhase } = tournament;

  const globalStats = calcGlobalStats(tournament.pools, tournament.fencers);
  const advancement = tournament.poolPhase?.advancement;
  const statsWithAdv = advancement
    ? applyAdvancement(globalStats, advancement.type, advancement.value, tournament.fencers.length)
    : globalStats.map(s => ({ ...s, advanced: true }));

  const fencerName = (id: string | null) => {
    if (!id) return '';
    const f = tournament.fencers.find(f => f.id === id);
    if (!f) return '';
    const stat = statsWithAdv.find(s => s.fencerId === id);
    const seed = stat?.globalRank ?? '';
    return `[${seed}] ${f.lastName}${f.firstName}`;
  };

  const mainMatches = deMatches.filter(m => !m.isThirdPlace);
  const thirdPlaceMatch = deMatches.find(m => m.isThirdPlace);
  const maxRound = mainMatches.length > 0 ? Math.max(...mainMatches.map(m => m.round)) : 0;

  const roundLabel = (round: number) => {
    if (round === maxRound) return '決勝';
    if (round === maxRound - 1) return '準決勝';
    if (round === maxRound - 2) return '準々決勝';
    return `R${round}`;
  };

  const base = tournament.name || '大会';
  const handleCSV = () => downloadCSV(exportDEResultsCSV(tournament), `${base}_DEスコア.csv`);
  const handlePDF = () => printDEResults(tournament, statsWithAdv);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">トーナメント（DE）</h2>
          <p className="text-sm text-gray-500">
            {statsWithAdv.filter(s => s.advanced).length}名 ·
            ブラケットサイズ {deMatches.filter(m => !m.isThirdPlace && m.round === 1).length * 2}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg"
            onClick={goToPreviousPhase}
          >
            ← 前のフェーズに戻る
          </button>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            <span className="text-xs text-gray-400 pl-2 pr-1">DE結果</span>
            <button className="text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 border-l border-gray-200" onClick={handleCSV}>CSV</button>
            <button className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 border-l border-gray-200" onClick={handlePDF}>PDF</button>
          </div>
          <button
            className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg"
            onClick={startNextPhase}
          >
            最終順位を見る →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-8 pb-4 min-w-max">
          {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => {
            const roundMatches = mainMatches
              .filter(m => m.round === round)
              .sort((a, b) => a.position - b.position);
            return (
              <div key={round} className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-600 text-center">{roundLabel(round)}</h3>
                <div className="flex flex-col justify-around gap-4 flex-1">
                  {roundMatches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      fencerName={fencerName}
                      onUpdate={updates => updateDEMatch(match.id, updates)}
                      onConfirm={() => confirmDEMatch(match.id)}
                      onRevert={() => revertDEMatch(match.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dePhase.thirdPlace && thirdPlaceMatch && (
        <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
          <h3 className="text-sm font-bold text-orange-700 mb-3">3位決定戦</h3>
          <MatchCard
            match={thirdPlaceMatch}
            fencerName={fencerName}
            onUpdate={updates => updateDEMatch(thirdPlaceMatch.id, updates)}
            onConfirm={() => confirmDEMatch(thirdPlaceMatch.id)}
            onRevert={() => revertDEMatch(thirdPlaceMatch.id)}
          />
        </div>
      )}
    </div>
  );
}
