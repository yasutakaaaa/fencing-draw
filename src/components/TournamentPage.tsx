import { useState } from 'react';
import { useStore, categoryLabel } from '../store/useStore';
import type { TournamentEvent, EventStatus, Weapon, Gender, AgeCategory, TournamentFormat } from '../types';

const STATUS_STYLE: Record<string, string> = {
  '準備中': 'bg-gray-100 text-gray-500',
  '進行中': 'bg-green-100 text-green-700 font-semibold',
  '終了':   'bg-gray-100 text-gray-400',
  '未':     'bg-gray-100 text-gray-500',
  '実施中': 'bg-green-100 text-green-700 font-semibold',
};

// ── カテゴリ追加モーダル ──────────────────────────────────────────────
function AddCategoryModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { addCategory, openTournament, setViewMode } = useStore();
  const [weapon, setWeapon] = useState<Weapon>('フルーレ');
  const [gender, setGender] = useState<Gender>('男子');
  const [format, setFormat] = useState<TournamentFormat>('個人');
  const [ageCategory, setAgeCategory] = useState<AgeCategory>('シニア');
  const [ageCategoryCustom, setAgeCategoryCustom] = useState('');

  const handleAdd = () => {
    const id = addCategory(eventId, weapon, gender, ageCategory, ageCategoryCustom, format);
    openTournament(id);
    setViewMode('admin');
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
function EditEventModal({ event, isOwner, onClose }: { event: TournamentEvent; isOwner: boolean; onClose: () => void }) {
  const { updateEvent, collabEnabledMap, setCollabSettings } = useStore();
  const [form, setForm] = useState({ name: event.name, date: event.date, venue: event.venue, status: event.status });
  const originalCollabEnabled = collabEnabledMap[event.id] ?? false;
  const [collabEnabled, setCollabEnabled] = useState(originalCollabEnabled);
  const [collabKey, setCollabKey] = useState('');
  const [collabError, setCollabError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    updateEvent(event.id, form);

    if (isOwner) {
      const keyEntered = collabKey.trim().length > 0;
      const changed = collabEnabled !== originalCollabEnabled || keyEntered;
      if (changed) {
        if (collabEnabled && !/^\d{6}$/.test(collabKey) && (keyEntered || !originalCollabEnabled)) {
          setCollabError('編集キーは6桁の数字で入力してください');
          return;
        }
        setSaving(true);
        const res = await setCollabSettings(event.id, collabEnabled, collabEnabled && keyEntered ? collabKey : undefined);
        setSaving(false);
        if (!res.ok) { setCollabError(res.error ?? 'エラーが発生しました'); return; }
      }
    }
    onClose();
  };

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

        {isOwner && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer">
              <input type="checkbox" checked={collabEnabled}
                onChange={e => { setCollabEnabled(e.target.checked); setCollabError(''); }} />
              他の人による編集を許可する
            </label>
            {collabEnabled && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  編集キー（6桁の数字）{originalCollabEnabled && <span className="text-gray-400">— 変更する場合のみ入力</span>}
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm tracking-widest"
                  inputMode="numeric" maxLength={6} placeholder="123456"
                  value={collabKey}
                  onChange={e => setCollabKey(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <p className="text-xs text-gray-400 mt-1">このキーを知っている人だけが、ログインした上でこの大会を編集できます。</p>
              </div>
            )}
            {collabError && <p className="text-xs text-red-500 mt-2">{collabError}</p>}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600" onClick={onClose}>キャンセル</button>
          <button disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            onClick={handleSave}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────
export default function TournamentPage() {
  const { events, tournaments, user, closeEvent, openTournament, deleteEvent, removeCategory, editorEventIds, redeemCollabKey } = useStore();
  const currentEventId = useStore(s => s.currentEventId);
  const event = events.find(e => e.id === currentEventId);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keyChecking, setKeyChecking] = useState(false);

  if (!event) return null;

  const isOwner = !!user && user.id === event.ownerId;
  const isEditor = editorEventIds.includes(event.id);
  const canEdit = isOwner || isEditor;
  const categories = event.categoryIds
    .map(id => tournaments.find(t => t.id === id))
    .filter(Boolean) as (typeof tournaments[0])[];

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/t/${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('URLをコピーしてください:', url);
    }
  };

  const handleRedeemKey = async () => {
    if (!/^\d{6}$/.test(keyInput)) { setKeyError('6桁の数字を入力してください'); return; }
    setKeyChecking(true);
    setKeyError('');
    const res = await redeemCollabKey(event.id, keyInput);
    setKeyChecking(false);
    if (res.ok) { setShowKeyForm(false); setKeyInput(''); }
    else setKeyError(res.error ?? 'キーが正しくありません');
  };

  const handleDeleteEvent = async () => {
    if (!confirm(`「${event.name}」とすべてのカテゴリを削除しますか？`)) return;
    closeEvent();
    await deleteEvent(event.id);
  };

  const handleDeleteCategory = (catId: string) => {
    const cat = tournaments.find(t => t.id === catId);
    const label = cat ? (cat.name || categoryLabel(cat)) : 'このカテゴリ';
    if (!confirm(`「${label}」を削除しますか？`)) return;
    removeCategory(catId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md">
        <div className="max-w-5xl mx-auto px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="text-blue-300 hover:text-white text-sm transition-colors shrink-0 py-1"
              onClick={closeEvent}
            >
              ← 一覧
            </button>
            <button
              className="text-white text-xl font-black tracking-tight shrink-0 hover:opacity-80 transition-opacity"
              onClick={closeEvent}
              title="ホームへ"
            >
              Fencing<span className="text-blue-300">Draw</span>
            </button>
            <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
              <button
                className="text-xs px-3 py-1.5 rounded border border-blue-400 text-blue-200 hover:text-white transition-colors"
                onClick={handleShare}
              >
                {copied ? '✓ コピー済み' : '共有'}
              </button>
              {canEdit && (
                <button
                  className="text-xs px-2 py-1.5 rounded border border-blue-400 text-blue-200 hover:text-white transition-colors"
                  onClick={() => setShowEditEvent(true)}
                >
                  大会編集
                </button>
              )}
              {isOwner && (
                <button
                  className="text-xs px-2 py-1.5 rounded border border-red-500 text-red-300 hover:text-red-200 transition-colors"
                  onClick={handleDeleteEvent}
                >
                  削除
                </button>
              )}
              {isEditor && !isOwner && (
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
                  編集者として参加中
                </span>
              )}
              {user && !canEdit && (
                <div className="relative">
                  <button
                    className="text-xs px-3 py-1.5 rounded border border-yellow-400 text-yellow-200 hover:text-white transition-colors"
                    onClick={() => setShowKeyForm(v => !v)}
                  >
                    🔑 編集キーを入力
                  </button>
                  {showKeyForm && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 w-60">
                      <label className="block text-xs font-medium text-gray-600 mb-1">編集キー（6桁の数字）</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm tracking-widest text-center"
                        inputMode="numeric" maxLength={6} placeholder="123456" value={keyInput}
                        autoFocus
                        onChange={e => setKeyInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => { if (e.key === 'Enter') handleRedeemKey(); }}
                      />
                      {keyError && <p className="text-xs text-red-500 mt-1">{keyError}</p>}
                      <button
                        disabled={keyChecking}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-50"
                        onClick={handleRedeemKey}
                      >
                        {keyChecking ? '確認中…' : '確認'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 大会情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500">
                {event.date && <span>{event.date.replace(/-/g, '/')}</span>}
                {event.venue && <span>{event.venue}</span>}
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded shrink-0 ${STATUS_STYLE[event.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {event.status === '実施中' ? '進行中' : event.status}
            </span>
          </div>
        </div>

        {/* カテゴリ一覧 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600">カテゴリ ({categories.length})</h2>
          {canEdit && (
            <button
              className="text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              onClick={() => setShowAddCategory(true)}
            >
              ＋ カテゴリを追加
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm mb-3">カテゴリがまだありません</p>
            {canEdit && (
              <button
                className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowAddCategory(true)}
              >
                ＋ 最初のカテゴリを追加
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(cat => {
              const label = cat.name || categoryLabel(cat);
              const statusBadge = cat.status === '進行中' ? '実施中' : cat.status;
              return (
                <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{cat.fencers.length}名エントリー</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[statusBadge] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusBadge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <button
                      className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors"
                      onClick={() => openTournament(cat.id)}
                    >
                      開く →
                    </button>
                    {canEdit && (
                      <button
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1.5 rounded-lg transition-colors"
                        onClick={() => handleDeleteCategory(cat.id)}
                        title="カテゴリを削除"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAddCategory && (
        <AddCategoryModal eventId={event.id} onClose={() => setShowAddCategory(false)} />
      )}
      {showEditEvent && (
        <EditEventModal event={event} isOwner={isOwner} onClose={() => setShowEditEvent(false)} />
      )}
    </div>
  );
}
