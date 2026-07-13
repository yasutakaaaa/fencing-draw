import { useState, useMemo } from 'react';
import { useStore, categoryLabel } from '../store/useStore';
import type { TournamentEvent, EventStatus, Weapon, Gender, AgeCategory, TournamentFormat } from '../types';
import LoginModal from './LoginModal';

const PAGE_SIZE = 20;

const STATUS_STYLE: Record<EventStatus, string> = {
  '未':    'bg-gray-100 text-gray-500',
  '実施中': 'bg-green-100 text-green-700 font-semibold',
  '終了':   'bg-gray-100 text-gray-400',
};

// ── 大会作成モーダル ──────────────────────────────────────────────────
function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { createEvent } = useStore();
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), venue: '', status: '未' as EventStatus, pin: '' });
  const [err, setErr] = useState('');
  const handleSubmit = () => {
    if (!form.name.trim()) { setErr('大会名を入力してください'); return; }
    const id = createEvent({ ...form });
    onCreated(id);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-bold text-gray-800 text-lg mb-4">新しい大会を作成</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">大会名 *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="○○フェンシング大会" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
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
                placeholder="東京都 / Paris, France" value={form.venue}
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
          {err && <p className="text-red-500 text-xs">{err}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>キャンセル</button>
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold" onClick={handleSubmit}>作成 →</button>
        </div>
      </div>
    </div>
  );
}

// ── カテゴリ追加モーダル（大会作成直後） ─────────────────────────────
function AddFirstCategoryModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { addCategory, openTournament, setViewMode, openEvent } = useStore();
  const [weapon, setWeapon] = useState<Weapon>('フルーレ');
  const [gender, setGender] = useState<Gender>('男子');
  const [format, setFormat] = useState<TournamentFormat>('個人');
  const [ageCategory, setAgeCategory] = useState<AgeCategory>('シニア');
  const [ageCategoryCustom, setAgeCategoryCustom] = useState('');
  const handleAdd = () => {
    const id = addCategory(eventId, weapon, gender, ageCategory, ageCategoryCustom, format);
    openEvent(eventId);
    openTournament(id);
    setViewMode('admin');
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <p className="text-xs text-blue-600 font-medium mb-1">大会が作成されました ✓</p>
        <h3 className="font-bold text-gray-800 text-lg mb-4">最初のカテゴリを追加</h3>
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
            → {categoryLabel({ weapon, gender, ageCategory, ageCategoryCustom, format })}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600" onClick={onClose}>あとで追加</button>
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold" onClick={handleAdd}>追加して編集を開始</button>
        </div>
      </div>
    </div>
  );
}

// ── ページネーション ───────────────────────────────────────────────────
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
        disabled={page === 0} onClick={() => onChange(page - 1)}>‹</button>
      {Array.from({ length: total }, (_, i) => (
        <button key={i}
          className={`w-6 h-6 text-xs rounded ${page === i ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          onClick={() => onChange(i)}>{i + 1}</button>
      ))}
      <button className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
        disabled={page === total - 1} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

// ── イベント行 ────────────────────────────────────────────────────────
function EventRow({ event }: { event: TournamentEvent }) {
  const { tournaments, openEvent } = useStore();
  const catCount = event.categoryIds.length;
  const totalFencers = event.categoryIds.reduce((sum, id) => {
    const t = tournaments.find(x => x.id === id);
    return sum + (t?.fencers.length ?? 0);
  }, 0);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer select-none text-sm"
        onClick={() => openEvent(event.id)}
      >
        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[event.status]}`}>
          {event.status}
        </span>
        <span className="flex-1 font-medium text-gray-800 truncate min-w-0">{event.name}</span>
        <span className="text-gray-400 text-xs hidden sm:block shrink-0">{catCount}カテゴリ / {totalFencers}名</span>
        <span className="text-gray-400 text-xs w-32 truncate hidden md:block">{event.venue || '—'}</span>
        <span className="text-gray-400 text-xs w-24 shrink-0 text-right">{event.date.replace(/-/g, '/')}</span>
        <span className="text-gray-300 text-xs w-4">›</span>
      </div>
    </div>
  );
}

// ── メイン ────────────────────────────────────────────────────────────
type StatusFilter = 'all' | '実施中' | '未' | '終了';

export default function HomeView() {
  const { events, user, signOut, hasLocalData, migrateFromLocalStorage, saveStatus, saveErrorDetail, openMyPage } = useStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activePage, setActivePage] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const [showArchive, setShowArchive] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    // 進行中 → 未開催 → 終了 の順でソート
    const STATUS_ORDER: Record<EventStatus, number> = { '実施中': 0, '未': 1, '終了': 2 };
    const all = [...events].sort((a, b) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (so !== 0) return so;
      return b.date.localeCompare(a.date);
    });
    const byText = !q ? all : all.filter(e => e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q));
    if (statusFilter === 'all') return byText;
    return byText.filter(e => e.status === statusFilter);
  }, [events, q, statusFilter]);

  const active  = filtered.filter(e => e.status !== '終了');
  const archive = filtered.filter(e => e.status === '終了');

  const activePaged  = active.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const archivePaged = archive.slice(archivePage * PAGE_SIZE, (archivePage + 1) * PAGE_SIZE);
  const activePages  = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const archivePages = Math.max(1, Math.ceil(archive.length / PAGE_SIZE));

  const renderRows = (list: TournamentEvent[]) =>
    list.map(event => (
      <EventRow key={event.id} event={event} />
    ));

  const handleMigrate = async () => {
    setMigrating(true);
    await migrateFromLocalStorage();
    setMigrating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-white text-xl font-black tracking-tight shrink-0">
            Fencing<span className="text-blue-300">Draw</span>
          </span>
          <input
            type="search"
            className="flex-1 max-w-sm border border-blue-500 bg-blue-800 text-white placeholder-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white"
            placeholder="大会名・開催地で検索…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActivePage(0); setArchivePage(0); }}
          />
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {saveStatus === 'saving' && <span className="text-xs text-blue-200 animate-pulse hidden sm:inline">保存中…</span>}
            {saveStatus === 'saved'  && <span className="text-xs text-green-300 hidden sm:inline">✓ 保存済み</span>}
            {saveStatus === 'error'  && <span className="text-xs text-red-300 hidden sm:inline">⚠ 保存失敗</span>}
            {user ? (
              <>
                <button
                  className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-4 py-1.5 rounded-lg transition-colors shadow"
                  onClick={() => setShowCreateEvent(true)}
                >
                  + 新しい大会
                </button>
                <button
                  className="text-blue-200 hover:text-white text-xs border border-blue-500 px-2 py-1.5 rounded-lg"
                  onClick={openMyPage}
                  title={user.email}
                >
                  マイページ
                </button>
                <button
                  className="text-blue-200 hover:text-white text-xs border border-blue-500 px-2 py-1.5 rounded-lg hidden sm:inline"
                  onClick={signOut}
                >
                  ログアウト
                </button>
              </>
            ) : (
              <button
                className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-4 py-1.5 rounded-lg transition-colors shadow"
                onClick={() => setShowLogin(true)}
              >
                ログイン
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ステータスフィルタ */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {([['all','すべて'],['実施中','進行中'],['未','準備中'],['終了','終了']] as [StatusFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setStatusFilter(val); setActivePage(0); setArchivePage(0); }}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
              {val !== 'all' && (
                <span className="ml-1 opacity-70">
                  {events.filter(e => e.status === val).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 保存エラー詳細バナー */}
        {saveStatus === 'error' && saveErrorDetail && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-red-700">⚠ 保存に失敗しました</p>
            <p className="text-xs text-red-600 mt-0.5">{saveErrorDetail}</p>
          </div>
        )}

        {/* localStorage 移行バナー */}
        {user && hasLocalData && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-800">このデバイスにローカルデータが見つかりました</p>
              <p className="text-xs text-amber-600 mt-0.5">旧データをクラウドに取り込んで共有できます</p>
            </div>
            <button
              className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              onClick={handleMigrate}
              disabled={migrating}
            >
              {migrating ? '移行中…' : 'クラウドに取り込む'}
            </button>
          </div>
        )}

        {/* カラムヘッダー */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-xs font-medium text-gray-400 border-b border-gray-200">
          <span className="w-12 shrink-0">状態</span>
          <span className="flex-1">大会名</span>
          <span className="w-32 hidden sm:block">開催地</span>
          <span className="w-24 shrink-0 text-right">日付</span>
          <span className="w-4"></span>
        </div>

        {/* アクティブ大会 */}
        {active.length === 0 && !q ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center mt-2">
            <p className="text-gray-400 mb-4">大会がありません</p>
            {user ? (
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-sm"
                onClick={() => setShowCreateEvent(true)}>
                + 新しい大会を作成
              </button>
            ) : (
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-sm"
                onClick={() => setShowLogin(true)}>
                ログインして作成
              </button>
            )}
          </div>
        ) : active.length === 0 && q ? (
          <div className="text-center py-10 text-gray-400 text-sm">「{query}」に一致する大会はありません</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-2 shadow-sm">
            {renderRows(activePaged)}
            <Pagination page={activePage} total={activePages} onChange={setActivePage} />
          </div>
        )}

        {/* アーカイブ */}
        {archive.length > 0 && (
          <div className="mt-6">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-2"
              onClick={() => setShowArchive(v => !v)}
            >
              <span>{showArchive ? '▼' : '▶'}</span>
              過去の大会（アーカイブ）{archive.length}件
            </button>
            {showArchive && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm opacity-80">
                {renderRows(archivePaged)}
                <Pagination page={archivePage} total={archivePages} onChange={setArchivePage} />
              </div>
            )}
          </div>
        )}
      </main>

      {showCreateEvent && (
        <CreateEventModal onClose={() => setShowCreateEvent(false)} onCreated={id => setPendingEventId(id)} />
      )}
      {pendingEventId && (
        <AddFirstCategoryModal eventId={pendingEventId} onClose={() => setPendingEventId(null)} />
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
