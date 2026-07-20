import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import type { TournamentEvent, EventStatus } from '../types';
import Footer from './Footer';
import CaptchaWidget from './CaptchaWidget';
import { isCaptchaConfigured } from '../lib/captcha';

const STATUS_STYLE: Record<EventStatus, string> = {
  '未':    'bg-gray-100 text-gray-500',
  '実施中': 'bg-green-100 text-green-700 font-semibold',
  '終了':   'bg-gray-100 text-gray-400',
};

const STATUS_ORDER: Record<EventStatus, number> = { '実施中': 0, '未': 1, '終了': 2 };

function sortEvents(list: TournamentEvent[]): TournamentEvent[] {
  return [...list].sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    return b.date.localeCompare(a.date);
  });
}

// ── 大会行 ────────────────────────────────────────────────────────────
function EventRow({ event, onOpen }: { event: TournamentEvent; onOpen: () => void }) {
  const { tournaments } = useStore();
  const totalFencers = event.categoryIds.reduce((sum, id) => {
    const t = tournaments.find(x => x.id === id);
    return sum + (t?.fencers.length ?? 0);
  }, 0);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer select-none text-sm border-b border-gray-100 last:border-b-0"
      onClick={onOpen}
    >
      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[event.status]}`}>{event.status}</span>
      <span className="flex-1 font-medium text-gray-800 truncate min-w-0">{event.name}</span>
      <span className="text-gray-400 text-xs hidden sm:block shrink-0">{event.categoryIds.length}カテゴリ / {totalFencers}名</span>
      <span className="text-gray-400 text-xs w-24 shrink-0 text-right">{event.date.replace(/-/g, '/')}</span>
      <span className="text-gray-300 text-xs w-4">›</span>
    </div>
  );
}

// ── パスワード変更フォーム ────────────────────────────────────────────
function PasswordChangeForm() {
  const { changePassword } = useStore();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(''); setCaptchaToken(null);
    setCaptchaResetKey(value => value + 1);
  };

  const handleSubmit = async () => {
    if (!current || !next) { setError('すべての項目を入力してください'); return; }
    if (next.length < 6) { setError('新しいパスワードは6文字以上です'); return; }
    if (next !== confirm) { setError('新しいパスワードが一致しません'); return; }
    if (!captchaToken) { setError('ボット対策の確認を完了してください'); return; }
    setLoading(true);
    setError('');
    const result = await changePassword(current, next, captchaToken);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setCaptchaToken(null);
      setCaptchaResetKey(value => value + 1);
      return;
    }
    reset();
    setOpen(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          className="text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          onClick={() => { setOpen(true); setSuccess(false); }}
        >
          パスワードを変更
        </button>
        {success && <span className="text-xs text-green-600">✓ パスワードを変更しました</span>}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 max-w-sm">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">現在のパスワード</label>
        <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={current} onChange={e => { setCurrent(e.target.value); setError(''); }} autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
        <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="6文字以上" value={next} onChange={e => { setNext(e.target.value); setError(''); }} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード（確認）</label>
        <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
      </div>
      <CaptchaWidget onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-white"
          onClick={() => { reset(); setOpen(false); }} disabled={loading}>キャンセル</button>
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2 text-sm font-bold transition-colors"
          onClick={handleSubmit} disabled={loading || !captchaToken || !isCaptchaConfigured}>{loading ? '変更中…' : '変更する'}</button>
      </div>
    </div>
  );
}

// ── アカウント削除セクション ──────────────────────────────────────────
function DeleteAccountSection({ ownedEvents, onDeleted }: { ownedEvents: TournamentEvent[]; onDeleted: () => void }) {
  const { deleteAccount } = useStore();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const handleDelete = async () => {
    if (!password) return;
    if (!captchaToken) { setError('ボット対策の確認を完了してください'); return; }
    setLoading(true);
    setError('');
    const result = await deleteAccount(password, captchaToken);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setCaptchaToken(null);
      setCaptchaResetKey(value => value + 1);
      return;
    }
    onDeleted();
  };

  return (
    <section className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="font-bold text-red-600 text-sm mb-1">アカウントの削除</h2>
        <p className="text-xs text-gray-500">
          アカウントを削除すると、あなたが管理するすべての大会（エントリー・対戦結果を含む）も完全に削除されます。この操作は取り消せません。
        </p>

        {!open ? (
          <button
            className="mt-3 text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            onClick={() => setOpen(true)}
          >
            アカウントを削除する…
          </button>
        ) : (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            {ownedEvents.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-red-700 mb-1.5">
                  以下の {ownedEvents.length} 件の大会が削除されます：
                </p>
                <div className="bg-white border border-red-100 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {ownedEvents.map(e => (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700">
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                      <span className="truncate flex-1">{e.name}</span>
                      <span className="text-gray-400 shrink-0">{e.date.replace(/-/g, '/')}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-1.5">
                  残したいデータは、削除前に各大会の管理画面からJSONエクスポートしてください。
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-600">管理中の大会はありません。アカウント情報のみ削除されます。</p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">確認のためパスワードを入力</label>
              <input
                type="password"
                className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
              />
            </div>
            <CaptchaWidget onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
            {error && <p className="text-red-600 text-xs font-medium">{error}</p>}
            <div className="flex gap-2 max-w-xs">
              <button
                className="flex-1 border border-gray-300 bg-white rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => { setOpen(false); setPassword(''); setError(''); setCaptchaToken(null); setCaptchaResetKey(value => value + 1); }}
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg py-2 text-sm font-bold transition-colors"
                onClick={handleDelete}
                disabled={loading || !password || !captchaToken || !isCaptchaConfigured}
              >
                {loading ? '削除中…' : '完全に削除する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── メイン ────────────────────────────────────────────────────────────
export default function MyPageView() {
  const { user, events, closeMyPage, openEvent, signOut, editorEventIds } = useStore();
  const [deleted, setDeleted] = useState(false);

  const ownedEvents = useMemo(
    () => sortEvents(events.filter(e => !!user && e.ownerId === user.id)),
    [events, user],
  );
  const editingEvents = useMemo(
    () => sortEvents(events.filter(e => editorEventIds.includes(e.id) && (!user || e.ownerId !== user.id))),
    [events, editorEventIds, user],
  );

  // 未ログインまたは匿名セッション（かつ削除完了画面でない）なら閉じる
  useEffect(() => {
    if ((!user || user.is_anonymous) && !deleted) closeMyPage();
  }, [user, deleted, closeMyPage]);

  // ── 削除完了画面 ────────────────────────────────────────────────────
  if (deleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">👋</div>
          <h3 className="font-bold text-gray-800 text-lg mb-2">アカウントを削除しました</h3>
          <p className="text-sm text-gray-500 mb-5">
            ご利用ありがとうございました。<br />
            登録情報と管理していた大会データはすべて削除されました。
          </p>
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold transition-colors"
            onClick={closeMyPage}
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    );
  }

  if (!user || user.is_anonymous) return null;

  const handleOpenEvent = (id: string) => {
    closeMyPage();
    openEvent(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            className="text-blue-300 hover:text-white text-sm transition-colors shrink-0"
            onClick={closeMyPage}
          >
            ← ホーム
          </button>
          <span className="text-white text-lg font-black tracking-tight shrink-0">
            Fencing<span className="text-blue-300">Draw</span>
          </span>
          <span className="text-blue-200 text-sm font-medium">マイページ</span>
          <button
            className="ml-auto text-blue-200 hover:text-white text-xs border border-blue-500 px-2.5 py-1.5 rounded-lg transition-colors"
            onClick={signOut}
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ── 登録情報 ── */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="px-5 py-4">
            <h2 className="font-bold text-gray-800 text-sm mb-3">登録情報</h2>
            <dl className="space-y-2 mb-4">
              <div className="flex items-center gap-4 text-sm">
                <dt className="w-28 shrink-0 text-xs text-gray-400">メールアドレス</dt>
                <dd className="text-gray-800 break-all">{user.email}</dd>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <dt className="w-28 shrink-0 text-xs text-gray-400">登録日</dt>
                <dd className="text-gray-800">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '—'}
                </dd>
              </div>
            </dl>
            <PasswordChangeForm />
          </div>
        </section>

        {/* ── 管理する大会 ── */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-baseline gap-2">
            <h2 className="font-bold text-gray-800 text-sm">管理する大会</h2>
            <span className="text-xs text-gray-400">{ownedEvents.length}件</span>
          </div>
          {ownedEvents.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">管理中の大会はありません。ホームから「+ 新しい大会」で作成できます。</p>
          ) : (
            <div>{ownedEvents.map(e => <EventRow key={e.id} event={e} onOpen={() => handleOpenEvent(e.id)} />)}</div>
          )}
        </section>

        {/* ── 編集に参加している大会（編集キー認証済み） ── */}
        {editingEvents.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-baseline gap-2">
              <h2 className="font-bold text-gray-800 text-sm">編集に参加している大会</h2>
              <span className="text-xs text-gray-400">{editingEvents.length}件</span>
            </div>
            <div>{editingEvents.map(e => <EventRow key={e.id} event={e} onOpen={() => handleOpenEvent(e.id)} />)}</div>
          </section>
        )}

        {/* ── アカウント削除 ── */}
        <DeleteAccountSection ownedEvents={ownedEvents} onDeleted={() => setDeleted(true)} />
      </main>

      <Footer />
    </div>
  );
}
