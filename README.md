# FencingDraw

フェンシング大会の作成、プール戦、直接敗退、最終順位、結果公開を管理するWebアプリです。

- 本番: https://fencing-draw.vercel.app
- GitHub: https://github.com/yasutakaaaa/fencing-draw
- Vercel: https://vercel.com/yasutaka-fencing/fencing-draw
- Supabase: https://supabase.com/dashboard/project/hkdthcoygwqdimcblkdt

## 技術構成

- React 19 / TypeScript / Vite
- Tailwind CSS
- Zustand
- Supabase（Postgres、Auth、Realtime）
- Cloudflare Turnstile（認証・匿名編集のボット対策）
- Vercel（ホスティング、GitHub連携デプロイ）
- Vitest / Playwright

## Codexで開発を始める

このリポジトリはGitHubとVercelに接続済みです。ローカル開発に必要な値は `.env.local` に置き、Gitにはコミットしません。

```bash
npm install
npm run dev
```

初回セットアップや環境変数の更新時は、先にVercelリンクを確認してからDevelopment環境を取得します。`vercel env pull` は出力先を上書きするため、手動のローカル設定がある場合は先に退避してください。

```bash
vercel whoami
vercel env pull .env.local --environment=development --yes
```

必要な環境変数名は [.env.example](./.env.example) にあります。`VITE_` で始まる値はブラウザへ公開されるクライアント設定であり、Supabaseのservice role keyなどの秘密鍵を設定してはいけません。

## 検証

通常の変更は次の1コマンドで静的解析、単体テスト、本番ビルドを確認します。

```bash
npm run check
```

公開画面を含むブラウザテストは次の通りです。管理機能のE2Eは、専用テストアカウントを使う場合だけ `TEST_EMAIL` と `TEST_PASSWORD` をローカル環境へ設定します。

```bash
npm run e2e
```

## Supabaseマイグレーション

SQLは `supabase/` に番号順で保存します。現在の適用順は次の通りです。

1. `migration.sql`
2. `migration_002_collab_editing.sql`
3. `migration_003_account.sql`

本番DBへの適用前にSQL差分とRLSポリシーを確認し、適用後は認証・閲覧・編集・保存の一連の動作を検証してください。秘密値や実ユーザーの認証情報は、SQL・ログ・コミットへ含めません。

編集キーを使う審判・記録係はSupabaseの匿名ユーザーとして認証されます。そのため、Authenticationの `Allow anonymous sign-ins` を有効のままにし、匿名ユーザーにも適用される `authenticated` ロールのRLSを変更する際は、編集キー照合前の書き込みを許可しないことを必ず確認します。

Supabase AuthのCAPTCHA保護にはCloudflare Turnstileを使用します。公開site keyは `VITE_TURNSTILE_SITE_KEY` としてVercelに設定し、secret keyはSupabaseの Authentication > Bot and Abuse Protection にだけ保存します。

## デプロイ

`main` へのpushはVercelの本番デプロイにつながります。プレビューが必要な変更はブランチをpushしてVercel Previewで確認します。CLIで明示的にデプロイする場合は以下を使います。

```bash
vercel          # Preview
vercel --prod   # Production
```

本番デプロイ後は、`vercel inspect https://fencing-draw.vercel.app` と本番画面で状態を確認します。
