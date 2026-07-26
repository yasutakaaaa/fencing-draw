import { useState } from 'react';
import { useStore } from '../store/useStore';
import Footer from './Footer';

export default function PasswordRecoveryView() {
  const { completePasswordRecovery, closePasswordRecovery } = useStore();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('新しいパスワードは6文字以上です');
      return;
    }
    if (password !== confirmation) {
      setError('新しいパスワードが一致しません');
      return;
    }
    setLoading(true);
    setError('');
    const result = await completePasswordRecovery(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <section className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-sm">
          {done ? (
            <div className="text-center">
              <div className="text-4xl mb-3">✓</div>
              <h1 className="font-bold text-gray-800 text-lg mb-2">パスワードを更新しました</h1>
              <p className="text-sm text-gray-500 mb-5">新しいパスワードでログインできます。</p>
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold transition-colors"
                onClick={closePasswordRecovery}
              >
                FencingDrawを開く
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-bold text-gray-800 text-lg mb-1">新しいパスワードを設定</h1>
              <p className="text-xs text-gray-400 mb-4">6文字以上の新しいパスワードを入力してください</p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="recovery-password" className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                  <input
                    id="recovery-password"
                    type="password"
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={password}
                    onChange={event => { setPassword(event.target.value); setError(''); }}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="recovery-password-confirmation" className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード（確認）</label>
                  <input
                    id="recovery-password-confirmation"
                    type="password"
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={confirmation}
                    onChange={event => { setConfirmation(event.target.value); setError(''); }}
                    onKeyDown={event => event.key === 'Enter' && handleSubmit()}
                  />
                </div>
                {error && <p className="text-red-500 text-xs" role="alert">{error}</p>}
              </div>
              <button
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2 text-sm font-bold transition-colors"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '更新中…' : 'パスワードを更新'}
              </button>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
