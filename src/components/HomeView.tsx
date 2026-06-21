import { useStore } from '../store/useStore';
import type { TournamentStatus } from '../types';

const STATUS_COLOR: Record<TournamentStatus, string> = {
  '準備中': 'bg-yellow-100 text-yellow-700',
  '進行中': 'bg-green-100 text-green-700',
  '終了':   'bg-gray-100 text-gray-500',
};

function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
      {status}
    </span>
  );
}

export default function HomeView() {
  const {
    tournaments, createTournament, openTournament, duplicateTournament,
    deleteTournament, setTournamentStatus,
  } = useStore();

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`「${name || '無題大会'}」を削除しますか？\nこの操作は取り消せません。`)) return;
    deleteTournament(id);
  };

  const cycleStatus = (id: string, current: TournamentStatus) => {
    const order: TournamentStatus[] = ['準備中', '進行中', '終了'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTournamentStatus(id, next);
  };

  const formatDate = (d: string) => d.replace(/-/g, '/');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-700 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-white text-2xl font-black tracking-tight">
            Fencing<span className="text-blue-300">Draw</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-4 py-2 rounded-lg transition-colors shadow"
              onClick={createTournament}
            >
              + 新規作成
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">大会一覧</h1>

        {tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="text-5xl mb-4">🤺</div>
            <p className="text-gray-500 mb-2">大会がありません</p>
            <p className="text-sm text-gray-400 mb-6">「新規作成」で最初の大会を追加してください</p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              onClick={createTournament}
            >
              + 新規大会を作成
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map(t => (
              <div
                key={t.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Status & badges */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => cycleStatus(t.id, t.status)}
                    title="クリックで状態を変更"
                  >
                    <StatusBadge status={t.status} />
                  </button>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{t.weapon}</span>
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{t.gender}</span>
                </div>

                {/* Name */}
                <h2 className="font-bold text-gray-800 text-base leading-tight mb-1">
                  {t.name || <span className="text-gray-400">（無題大会）</span>}
                </h2>

                {/* Date & info */}
                <p className="text-sm text-gray-500 mb-1">{formatDate(t.date)}</p>
                <p className="text-xs text-gray-400 mb-4">
                  {t.ageCategory}{t.ageCategory === 'その他' && t.ageCategoryCustom ? `・${t.ageCategoryCustom}` : ''} ·
                  {t.fencers.length}名 · {t.appPhase === 'entry' ? 'エントリー中' : t.appPhase === 'pool' ? 'プール戦' : t.appPhase === 'advancement' ? '通過判定' : t.appPhase === 'bracket' ? 'DE進行中' : '終了'}
                </p>

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2">
                  <button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 rounded-lg transition-colors"
                    onClick={() => openTournament(t.id)}
                  >
                    開く
                  </button>
                  <button
                    className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition-colors"
                    onClick={() => duplicateTournament(t.id)}
                    title="複製"
                  >
                    複製
                  </button>
                  <button
                    className="text-sm text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-2 rounded-lg transition-colors"
                    onClick={() => handleDelete(t.id, t.name)}
                    title="削除"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
