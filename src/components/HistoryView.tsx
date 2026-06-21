import { useStore } from '../store/useStore';
// HistoryView: ログ一覧モーダル（管理モード内から開く）

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryView({ onClose }: { onClose: () => void }) {
  const { logs, deleteLog, restoreFromLog } = useStore();

  const handleRestore = (id: string, name: string) => {
    if (!confirm(`「${name}」のデータを復元しますか？\n現在の編集中データは上書きされます。`)) return;
    restoreFromLog(id);
    onClose();
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`「${name}」のログを削除しますか？`)) return;
    deleteLog(id);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">試合結果ログ</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              各大会にIDを発行（将来: /tournament/:id でアクセス可能）
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {logs.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">ログがありません</p>
              <p className="text-xs mt-1">最終順位画面から「ログに保存」するとここに蓄積されます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{log.name}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{log.weapon}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{log.gender}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {log.date} · {log.fencerCount}名参加
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        保存: {formatDate(log.savedAt)}
                      </p>
                      {/* 将来のURL表示（モックアップ） */}
                      <div className="mt-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-gray-400">ID:</span>
                        <code className="text-xs text-blue-600 font-mono">{log.id}</code>
                        <span className="text-xs text-gray-300 ml-1">
                          （将来: /tournament/{log.id}）
                        </span>
                        <button
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            navigator.clipboard?.writeText(log.id).catch(() => {});
                          }}
                          title="IDをコピー"
                        >
                          コピー
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => handleRestore(log.id, log.name)}
                      >
                        復元
                      </button>
                      <button
                        className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => handleDelete(log.id, log.name)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
          ※ ログはこのブラウザのlocalStorageに保存されています。
          バックエンド連携（Supabase等）を追加することで複数端末・リアルタイム共有が可能になります。
        </div>
      </div>
    </div>
  );
}
