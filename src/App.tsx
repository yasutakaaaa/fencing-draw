import { useState, useEffect } from 'react';
import { useStore, useTournament, categoryLabel } from './store/useStore';
import { supabase } from './lib/supabase';
import HomeView from './components/HomeView';
import TournamentPage from './components/TournamentPage';
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
  const {
    closeTournament, closeEvent, deleteEvent, logs, exportTournamentJSON, viewMode, setViewMode,
    events, tournaments, user, isLoading, saveStatus, initializeStore, signOut, openTournament,
    openEvent,
  } = useStore();
  const tournament = useTournament();
  const currentEventId = useStore(s => s.currentEventId);
  const currentId = useStore(s => s.currentId);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // ── Supabase Auth リスナー＋初回ロード ──────────────────────────────
  useEffect(() => {
    initializeStore();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      useStore.setState({ user: session?.user ?? null });
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        initializeStore();
      }
      if (_event === 'SIGNED_OUT') {
        useStore.setState({ currentId: null, currentEventId: null, viewMode: 'viewer' });
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL ハッシュからディープリンクを処理 ─────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const hash = window.location.hash;

    // 新形式: #/t/{eventId}/c/{catId}
    const newFmt = hash.match(/^#\/t\/([^/?]+)\/c\/([^?]+)/);
    if (newFmt) {
      const [, evtId, catId] = newFmt;
      const { events: evts, tournaments: tours, currentId: cId, currentEventId: cEvtId } = useStore.getState();
      if (cId === catId && cEvtId === evtId) return;
      if (evts.find(e => e.id === evtId) && tours.find(t => t.id === catId)) {
        openEvent(evtId);
        openTournament(catId);
      }
      return;
    }

    // イベントページ: #/t/{eventId} (IDがeventsに存在)
    const singleId = hash.match(/^#\/t\/([^/?]+)/);
    if (singleId) {
      const id = singleId[1];
      const { events: evts, tournaments: tours, currentEventId: cEvtId, currentId: cId } = useStore.getState();
      if (evts.find(e => e.id === id)) {
        if (cEvtId === id && !cId) return;
        openEvent(id);
      } else if (tours.find(t => t.id === id)) {
        // 旧形式後方互換: カテゴリIDが直接指定された
        if (cId === id) return;
        openTournament(id);
      }
    }
  }, [isLoading, openTournament, openEvent]);

  // ── 画面状態を URL ハッシュに同期 ───────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (currentId && tournament) {
      const evtId = tournament.eventId ?? currentEventId ?? '';
      const base = evtId ? `#/t/${evtId}/c/${tournament.id}` : `#/t/${tournament.id}`;
      if (!window.location.hash.startsWith(base.split('?')[0])) {
        window.location.hash = `${base}?tab=entry`;
      }
    } else if (currentEventId) {
      const expected = `#/t/${currentEventId}`;
      if (window.location.hash !== expected) {
        window.location.hash = expected;
      }
    } else {
      if (window.location.hash.startsWith('#/t/')) {
        history.pushState('', document.title, window.location.pathname + window.location.search);
      }
    }
  }, [currentId, currentEventId, tournament?.id, isLoading]);

  // ── ローディング ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-blue-600 text-4xl font-black mb-3">
            Fencing<span className="text-blue-300">Draw</span>
          </div>
          <p className="text-gray-400 text-sm animate-pulse">サーバーに接続中…</p>
        </div>
      </div>
    );
  }

  // ── ホーム画面 ──────────────────────────────────────────────────────
  if (!currentEventId && !currentId) {
    return <HomeView />;
  }

  // ── 大会ページ ─────────────────────────────────────────────────────
  if (currentEventId && !currentId) {
    return <TournamentPage />;
  }

  // ── 閲覧モード ──────────────────────────────────────────────────────
  if (viewMode === 'viewer') {
    return <ViewerView />;
  }

  // ── 管理モード：オーナーガード ──────────────────────────────────────
  if (!tournament) return <HomeView />;

  const eventId = tournament.eventId ?? '';
  const event = events.find(e => e.id === eventId);
  const isOwner = !!user && (user.id === event?.ownerId || !event?.ownerId);
  if (!isOwner) {
    setViewMode('viewer');
    return <ViewerView />;
  }

  const currentPhaseIdx = PHASE_ORDER.indexOf(tournament.appPhase as typeof PHASE_ORDER[number]);

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

  const handleDeleteEvent = async () => {
    if (!event) return;
    if (!confirm(`「${event.name}」とすべてのカテゴリを削除しますか？`)) return;
    closeEvent();
    await deleteEvent(event.id);
  };

  const eventDisplayName = event?.name ?? tournament.name;
  const catLabel = categoryLabel(tournament);

  // 同一イベント内の他カテゴリ
  const siblingCategories = event
    ? event.categoryIds
        .map(id => tournaments.find(t => t.id === id))
        .filter(Boolean)
        .filter(t => t!.id !== tournament.id) as typeof tournaments
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-3 py-2">
          {/* 上段 */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 大会に戻るボタン */}
            <button
              className="text-blue-300 hover:text-white text-sm transition-colors shrink-0 py-1"
              onClick={closeTournament}
              title="大会ページへ戻る"
            >
              ← 大会
            </button>

            {/* ロゴ (タップでホームへ) */}
            <button
              className="text-white text-lg font-black tracking-tight shrink-0 hover:opacity-80 transition-opacity"
              onClick={closeEvent}
              title="ホームへ"
            >
              Fencing<span className="text-blue-300">Draw</span>
            </button>

            {/* 大会名 + カテゴリ (sm以上) */}
            <div className="min-w-0 hidden sm:block ml-1">
              <span className="text-blue-100 text-xs font-medium truncate block leading-tight">{eventDisplayName}</span>
              <span className="text-blue-300 text-xs truncate block leading-tight">{catLabel}</span>
            </div>

            {/* カテゴリ切替 */}
            {siblingCategories.length > 0 && (
              <div className="relative hidden md:block">
                <button
                  className="text-xs border border-blue-400 text-blue-200 hover:text-white px-2 py-1 rounded transition-colors"
                  onClick={() => setShowCategorySelector(v => !v)}
                >
                  ▼ 他
                </button>
                {showCategorySelector && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 min-w-40">
                    {siblingCategories.map(cat => (
                      <button
                        key={cat.id}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                        onClick={() => { openTournament(cat.id); setShowCategorySelector(false); }}
                      >
                        {cat.name || categoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 右側アクションボタン群 */}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
              {saveStatus === 'saving' && <span className="text-xs text-blue-200 animate-pulse hidden sm:inline">保存中…</span>}
              {saveStatus === 'saved'  && <span className="text-xs text-green-300 hidden sm:inline">✓ 保存済み</span>}
              {saveStatus === 'error'  && <span className="text-xs text-red-300 hidden sm:inline">⚠ 保存失敗</span>}

              <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">編集中</span>

              {event && (
                <>
                  <button
                    className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-200 hover:text-white transition-colors hidden sm:inline"
                    onClick={() => setShowAddCategory(true)}
                  >
                    ＋ カテゴリ
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border border-red-500 text-red-300 hover:text-red-200 transition-colors hidden sm:inline"
                    onClick={handleDeleteEvent}
                  >
                    削除
                  </button>
                </>
              )}

              <button
                className="text-xs font-medium bg-white hover:bg-blue-50 text-blue-700 border border-white px-2.5 py-1 rounded-lg transition-colors"
                onClick={() => setViewMode('viewer')}
              >
                ← 閲覧
              </button>
              <button
                className="relative text-blue-200 hover:text-white text-xs cursor-pointer border border-blue-500 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors"
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
                className="text-blue-200 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors hidden sm:inline"
                onClick={handleExportJSON}
              >
                JSON
              </button>
              {user && (
                <button
                  className="text-blue-200 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors hidden sm:inline"
                  onClick={signOut}
                >
                  ログアウト
                </button>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-1.5 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {STEPS.map((step, idx) => {
                const isPast = idx < currentPhaseIdx;
                const isCurrent = idx === currentPhaseIdx;
                return (
                  <div key={step.phase} className="flex items-center">
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isCurrent ? 'bg-white text-blue-700' : isPast ? 'text-blue-200' : 'text-blue-400'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-blue-700 text-white' : isPast ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-400'}`}>
                        {idx + 1}
                      </span>
                      {step.label}
                    </div>
                    {idx < STEPS.length - 1 && <div className={`w-3 h-px mx-0.5 ${isPast ? 'bg-blue-400' : 'bg-blue-700'}`} />}
                  </div>
                );
              })}
            </div>
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
      {showAddCategory && event && (
        <AddCategoryModal
          eventId={event.id}
          onClose={() => setShowAddCategory(false)}
          onAdded={(catId) => { openTournament(catId); setShowAddCategory(false); }}
        />
      )}
    </div>
  );
}

// ── カテゴリ追加モーダル ─────────────────────────────────────────────────
function AddCategoryModal({
  eventId,
  onClose,
  onAdded,
}: {
  eventId: string;
  onClose: () => void;
  onAdded: (catId: string) => void;
}) {
  const { addCategory } = useStore();
  const [weapon, setWeapon] = useState<import('./types').Weapon>('フルーレ');
  const [gender, setGender] = useState<import('./types').Gender>('男子');
  const [format, setFormat] = useState<import('./types').TournamentFormat>('個人');
  const [ageCategory, setAgeCategory] = useState<import('./types').AgeCategory>('シニア');
  const [ageCategoryCustom, setAgeCategoryCustom] = useState('');

  const handleAdd = () => {
    const id = addCategory(eventId, weapon, gender, ageCategory, ageCategoryCustom, format);
    onAdded(id);
  };

  const previewLabel = categoryLabel({ weapon, gender, ageCategory, ageCategoryCustom, format });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-800 text-lg mb-4">カテゴリを追加</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">種目</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={weapon} onChange={e => setWeapon(e.target.value as import('./types').Weapon)}>
              <option>フルーレ</option><option>エペ</option><option>サーブル</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">性別</label>
              <div className="flex flex-wrap gap-1">
                {(['男子','女子','混合'] as import('./types').Gender[]).map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border ${gender === g ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">個人/団体</label>
              <div className="flex gap-1">
                {(['個人','団体'] as import('./types').TournamentFormat[]).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border ${format === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
            <div className="flex flex-wrap gap-1.5">
              {(['シニア','ジュニア','カデ','ベテラン','その他'] as import('./types').AgeCategory[]).map(a => (
                <button key={a} onClick={() => setAgeCategory(a)}
                  className={`px-3 py-1 text-xs rounded-full border ${ageCategory === a ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                  {a}
                </button>
              ))}
            </div>
            {ageCategory === 'その他' && (
              <input className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                placeholder="カテゴリ名" value={ageCategoryCustom}
                onChange={e => setAgeCategoryCustom(e.target.value)} />
            )}
          </div>
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
            → {previewLabel}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600" onClick={onClose}>キャンセル</button>
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold" onClick={handleAdd}>追加して開く</button>
        </div>
      </div>
    </div>
  );
}
