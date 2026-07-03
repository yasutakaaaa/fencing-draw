import { useState } from 'react';
import { useStore } from '../store/useStore';

type Mode = 'signin' | 'signup';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) { setError('メールとパスワードを入力してください'); return; }
    if (password.length < 6) { setError('パスワードは6文字以上です'); return; }
    setLoading(true);
    setError('');
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (mode === 'signup') { setDone(true); return; }
    onClose();
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">✉️</div>
          <h3 className="font-bold text-gray-800 text-lg mb-2">確認メールを送信しました</h3>
          <p className="text-sm text-gray-500 mb-4">
            {email} に確認リンクを送りました。<br />
            メール内のリンクをクリックして登録を完了してください。
          </p>
          <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold" onClick={onClose}>閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-800 text-lg mb-1">
          {mode === 'signin' ? '管理者ログイン' : '新規アカウント登録'}
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {mode === 'signin' ? '大会の作成・編集にはログインが必要です' : '登録後にメール確認が必要です'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="admin@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">パスワード</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="6文字以上"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <button
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2 text-sm font-bold transition-colors"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
        </button>

        <div className="mt-3 text-center">
          {mode === 'signin' ? (
            <button className="text-xs text-blue-500 hover:underline" onClick={() => { setMode('signup'); setError(''); }}>
              アカウントを新規作成
            </button>
          ) : (
            <button className="text-xs text-blue-500 hover:underline" onClick={() => { setMode('signin'); setError(''); }}>
              すでにアカウントをお持ちの方
            </button>
          )}
        </div>

        <button
          className="mt-3 w-full border border-gray-200 text-gray-500 rounded-lg py-1.5 text-xs hover:bg-gray-50"
          onClick={onClose}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
