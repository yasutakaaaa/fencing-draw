import { useState } from 'react';
import { useStore, useTournament } from './store/useStore';
import HomeView from './components/HomeView';
import EntryManager from './components/EntryManager';
import PoolView from './components/PoolView';
import AdvancementView from './components/AdvancementView';
import BracketView from './components/BracketView';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import ViewerView from './components/ViewerView';
import type { AppPhase } from './types';

const STEPS: { phase: AppPhase; label: string }[] = [
  { phase: 'entry',       label: 'エントリー' },
  { phase: 'pool',        label: 'プール戦' },
  { phase: 'advancement', label: '通過判定' },
  { phase: 'bracket',     label: 'トーナメント' },
  { phase: 'results',     label: '最終順位' },
];

const PHASE_ORDER: AppPhase[] = ['entry', 'pool', 'advancement', 'bracket', 'results'];

export default function App() {
  const { closeTournament, logs, exportTournamentJSON, viewMode, setViewMode } = useStore();
  const tournament = useTournament();
  const [showHistory, setShowHistory] = useState(false);

  // ─── ホーム画面 ───────────────────────────────────────────────
  if (!tournament) {
    return <HomeView />;
  }

  // ─── 閲覧モード ───────────────────────────────────────────────
  if (viewMode === 'viewer') {
    return <ViewerView />;
  }

  // ─── 管理モード ───────────────────────────────────────────────
  const currentPhaseIdx = PHASE_ORDER.indexOf(tournament.appPhase);

  const handleExportJSON = () => {
    const json = exportTournamentJSON(tournament.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name || '大会'}_${tournament.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              className="text-blue-300 hover:text-white text-sm transition-colors"
              onClick={closeTournament}
              title="大会一覧に戻る"
            >
              ← 一覧
            </button>
            <div className="text-white text-2xl font-black tracking-tight">
              Fencing<span className="text-blue-300">Draw</span>
            </div>
            {tournament.name && (
              <span className="text-blue-200 text-sm border border-blue-500 rounded-full px-3 py-0.5 hidden sm:inline">
                {tournament.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 管理/閲覧 切替 */}
            <div className="flex rounded-lg overflow-hidden border border-blue-500">
              <button
                className="text-xs px-3 py-1.5 font-medium bg-white text-blue-700"
              >
                管理
              </button>
              <button
                className="text-xs px-3 py-1.5 font-medium text-blue-200 hover:text-white hover:bg-blue-600 transition-colors"
                onClick={() => setViewMode('viewer')}
              >
                閲覧
              </button>
            </div>
            <button
              className="relative text-blue-200 hover:text-white text-xs cursor-pointer border border-blue-500 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
              onClick={() => setShowHistory(true)}
            >
              ログ
              {logs.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-gray-800 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {logs.length > 9 ? '9+' : logs.length}
                </span>
              )}
            </button>
            <button
              className="text-blue-200 hover:text-white text-xs cursor-pointer border border-blue-500 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
              onClick={handleExportJSON}
            >
              JSONエクスポート
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="max-w-6xl mx-auto px-4 pb-3 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max">
            {STEPS.map((step, idx) => {
              const isPast = idx < currentPhaseIdx;
              const isCurrent = idx === currentPhaseIdx;
              return (
                <div key={step.phase} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isCurrent ? 'bg-white text-blue-700' :
                    isPast    ? 'text-blue-200'          : 'text-blue-400'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent ? 'bg-blue-700 text-white' :
                      isPast    ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-400'
                    }`}>{idx + 1}</span>
                    {step.label}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`w-4 h-px mx-0.5 ${isPast ? 'bg-blue-400' : 'bg-blue-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tournament.appPhase === 'entry'       && <EntryManager />}
        {tournament.appPhase === 'pool'        && <PoolView />}
        {tournament.appPhase === 'advancement' && <AdvancementView />}
        {tournament.appPhase === 'bracket'     && <BracketView />}
        {tournament.appPhase === 'results'     && <ResultsView />}
      </main>

      {showHistory && <HistoryView onClose={() => setShowHistory(false)} />}
    </div>
  );
}
