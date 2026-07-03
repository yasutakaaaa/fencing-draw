import { useState, useEffect } from 'react';
import { useStore, useTournament, categoryLabel } from './store/useStore';
import { supabase } from './lib/supabase';
import HomeView from './components/HomeView';
import EntryManager from './components/EntryManager';
import PoolView from './components/PoolView';
import AdvancementView from './components/AdvancementView';
import BracketView from './components/BracketView';
import ResultsView from './components/ResultsView';
import HistoryView from './components/HistoryView';
import ViewerView from './components/ViewerView';
import type { AppPhase, Weapon, Gender, AgeCategory, TournamentFormat, EventStatus, TournamentEvent } from './types';

const STEPS: { phase: AppPhase; label: string }[] = [
  { phase: 'entry',       label: 'エントリー' },
  { phase: 'pool',        label: 'プール戦' },
  { phase: 'advancement', label: '通過判定' },
  { phase: 'bracket',     label: 'トーナメント' },
  { phase: 'results',     label: '最終順位' },
];

const PHASE_ORDER: AppPhase[] = ['entry', 'pool', 'advancement', 'bracket', 'results'];

// ── カテゴリ追加モーダル ──────────────────────────────────────────────
function AddCategoryModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { addCategory, openTournament } = useStore();
  const [weapon, setWeapon] = useState<Weapon>('フルーレ');
  const [gender, setGender] = useState<Gender>('男子');
  const [format, setFormat] = useState<TournamentFormat>('個人');
  const [ageCategory, setAgeCategory] = useState<AgeCategory>('シニア');
  const [ageCategoryCustom, setAgeCategoryCustom] = useState('');

  const handleAdd = () => {
    const id = addCategory(eventId, weapon, gender, ageCategory, ageCategoryCustom, format);
    openTournament(id);
    onClose();
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
              value={weapon} onChange={e => setWeapon(e.target.value as Weapon)}>
              <option>フルーレ</option><option>エペ</option><option>サーブル</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">性別</label>
              <div className="flex flex-wrap gap-1">
                {(['男子','女子','混合'] as Gender[]).map(g => (
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
                {(['個人','団体'] as TournamentFormat[]).map(f => (
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
              {(['シニア','ジュニア','カデ','ベテラン','その他'] as AgeCategory[]).map(a => (
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

// ── 大会編集モーダル ──────────────────────────────────────────────────
function EditEventModal({ event, onClose }: { event: TournamentEvent; onClose: () => void }) {
  const { updateEvent } = useStore();
  const [form, setForm] = useState({ name: event.name, date: event.date, venue: event.venue, status: event.status });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-bold text-gray-800 text-lg mb-4">大会情報を編集</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">大会名</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">開催日</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">開催地</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="東京都 etc." value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}>
              <option value="未">未</option><option value="実施中">実施中</option><option value="終了">終了</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600" onClick={onClose}>キャンセル</button>
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold"
            onClick={() => { updateEvent(event.id, form); onClose(); }}>保存</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { closeTournament, deleteEvent, logs, exportTournamentJSON, viewMode, setViewMode,
          events, user, isLoading, saveStatus, initializeStore, signOut, openTournament } = useStore();
  const tournament = useTournament();
  const [showHistory, setShowHistory] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);

  // ── Supabase Auth リスナー＋初回ロード ──────────────────────────────
  useEffect(() => {
    initializeStore();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      useStore.setState({ user: session?.user ?? null });
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        initializeStore();
      }
      if (_event === 'SIGNED_OUT') {
        useStore.setState({ currentId: null, viewMode: 'viewer' });
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── URL ハッシュからディープリンクを処理 ─────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const hash = window.location.hash;
    const match = hash.match(/^#\/t\/([^?]+)/);
    if (!match) return;
    const catId = match[1];
    const { tournaments, currentId } = useStore.getState();
    if (currentId === catId) return; // すでに開いている
    const found = tournaments.find(t => t.id === catId);
    if (found) openTournament(catId);
  }, [isLoading, openTournament]);

  // ── currentId が変化したら hash を更新 ───────────────────────────────
  useEffect(() => {
    if (!tournament || viewMode === 'admin') return;
    // タブは ViewerView 側で更新するので、ここではカテゴリIDのみ設定
    const current = window.location.hash;
    if (!current.startsWith(`#/t/${tournament.id}`)) {
      window.location.hash = `/t/${tournament.id}?tab=entry`;
    }
  }, [tournament?.id, viewMode]);

  // 一覧に戻ったときはハッシュをクリア（ローディング中は消さない）
  useEffect(() => {
    if (isLoading) return;
    if (!tournament) {
      if (window.location.hash.startsWith('#/t/')) {
        history.pushState('', document.title, window.location.pathname + window.location.search);
      }
    }
  }, [tournament, isLoading]);

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
  if (!tournament) {
    return <HomeView />;
  }

  // ── 閲覧モード ──────────────────────────────────────────────────────
  if (viewMode === 'viewer') {
    return <ViewerView />;
  }

  // ── 管理モード：オーナーガード ──────────────────────────────────────
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
    closeTournament();
    await deleteEvent(event.id);
  };

  const eventDisplayName = event?.name ?? tournament.name;
  const catLabel = categoryLabel(tournament);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3">
          {/* 上段 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button className="text-blue-300 hover:text-white text-sm transition-colors shrink-0" onClick={closeTournament}>
                ← 一覧
              </button>
              <div className="text-white text-xl font-black tracking-tight shrink-0">
                Fencing<span className="text-blue-300">Draw</span>
              </div>
              <div className="min-w-0 hidden sm:block">
                <span className="text-blue-100 text-sm font-medium truncate block">{eventDisplayName}</span>
                <span className="text-blue-300 text-xs truncate block">{catLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 保存ステータス */}
              {saveStatus === 'saving' && <span className="text-xs text-blue-200 animate-pulse">保存中…</span>}
              {saveStatus === 'saved'  && <span className="text-xs text-green-300">✓ 保存済み</span>}
              {saveStatus === 'error'  && <span className="text-xs text-red-300">⚠ 保存失敗</span>}

              <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">編集中</span>

              {/* 大会管理ボタン（管理モードでのみ表示） */}
              {event && (
                <>
                  <button
                    className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-200 hover:text-white transition-colors"
                    onClick={() => setShowAddCategory(true)}
                  >
                    ＋ カテゴリ
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-200 hover:text-white transition-colors"
                    onClick={() => setShowEditEvent(true)}
                  >
                    大会編集
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border border-red-500 text-red-300 hover:text-red-200 transition-colors"
                    onClick={handleDeleteEvent}
                  >
                    削除
                  </button>
                </>
              )}

              <button
                className="text-xs font-medium bg-white hover:bg-blue-50 text-blue-700 border border-white px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => setViewMode('viewer')}
              >
                ← 閲覧に戻る
              </button>
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
                className="text-blue-200 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors hidden sm:inline"
                onClick={handleExportJSON}
              >
                JSON
              </button>
              {user && (
                <button
                  className="text-blue-200 hover:text-white text-xs border border-blue-500 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                  onClick={signOut}
                >
                  ログアウト
                </button>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="mt-2 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max">
              {STEPS.map((step, idx) => {
                const isPast = idx < currentPhaseIdx;
                const isCurrent = idx === currentPhaseIdx;
                return (
                  <div key={step.phase} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isCurrent ? 'bg-white text-blue-700' : isPast ? 'text-blue-200' : 'text-blue-400'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-blue-700 text-white' : isPast ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-400'}`}>
                        {idx + 1}
                      </span>
                      {step.label}
                    </div>
                    {idx < STEPS.length - 1 && <div className={`w-4 h-px mx-0.5 ${isPast ? 'bg-blue-400' : 'bg-blue-700'}`} />}
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
        <AddCategoryModal eventId={event.id} onClose={() => setShowAddCategory(false)} />
      )}
      {showEditEvent && event && (
        <EditEventModal event={event} onClose={() => setShowEditEvent(false)} />
      )}
    </div>
  );
}
