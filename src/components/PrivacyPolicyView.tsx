import { useStore } from '../store/useStore';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="font-bold text-gray-800 text-sm mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyView() {
  const { closePrivacy } = useStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            className="text-blue-300 hover:text-white text-sm transition-colors shrink-0"
            onClick={closePrivacy}
          >
            ← 戻る
          </button>
          <span className="text-white text-lg font-black tracking-tight shrink-0">
            Fencing<span className="text-blue-300">Draw</span>
          </span>
          <span className="text-blue-200 text-sm font-medium">プライバシーポリシー</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-6 py-6 sm:px-8">
          <h1 className="font-bold text-gray-900 text-lg mb-1">プライバシーポリシー</h1>
          <p className="text-xs text-gray-400 mb-6">制定日: 2026年7月18日</p>

          <Section title="1. 本ポリシーについて">
            <p>
              FencingDraw（以下「本サービス」）は、フェンシング大会の組み合わせ作成・結果管理・公開を行うWebサービスです。
              本ポリシーは、本サービスにおける利用者情報の取り扱いを定めるものです。
            </p>
          </Section>

          <Section title="2. 取得する情報">
            <p>本サービスは以下の情報を取得します。</p>
            <p>
              (1) アカウント情報 — 大会を作成・管理する利用者のメールアドレスおよびパスワード（パスワードは暗号化して保存され、運営者も参照できません）。<br />
              (2) 大会データ — 大会主催者が入力する大会名・開催地・選手の氏名・所属・対戦結果などの情報。<br />
              (3) 技術情報 — ログイン状態の維持のためにブラウザのローカルストレージを使用します。広告目的のCookieやトラッキングは使用しません。
            </p>
          </Section>

          <Section title="3. 大会データの公開について">
            <p>
              本サービスの性質上、大会データ（選手の氏名・所属・対戦結果を含む）は、大会ページのURLを知る誰もが閲覧できます。
              選手情報の入力にあたっては、大会主催者が選手本人（未成年の場合は保護者）への周知・同意取得の責任を負うものとします。
            </p>
          </Section>

          <Section title="4. 利用目的">
            <p>
              取得した情報は、本サービスの提供・本人確認・不正利用の防止・お問い合わせ対応の目的にのみ利用し、
              それ以外の目的には利用しません。
            </p>
          </Section>

          <Section title="5. 第三者提供・外部サービス">
            <p>
              法令に基づく場合を除き、取得した情報を第三者に提供することはありません。
              データの保管・配信には Supabase（データベース・認証）および Vercel（ホスティング）を利用しており、
              データは海外のサーバーに保管されることがあります。
            </p>
          </Section>

          <Section title="6. データの削除">
            <p>
              アカウントはマイページからいつでも削除でき、削除時には登録情報および管理するすべての大会データが完全に削除されます。
              大会データに含まれるご自身の情報の訂正・削除を希望する選手の方は、当該大会の主催者にお申し出ください。
            </p>
          </Section>

          <Section title="7. 本ポリシーの変更">
            <p>
              本ポリシーは必要に応じて改定されることがあります。重要な変更がある場合は、本サービス上でお知らせします。
            </p>
          </Section>

          <Section title="8. お問い合わせ">
            <p>
              本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、本サービスの運営者までご連絡ください。
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
