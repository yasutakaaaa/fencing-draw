-- ============================================================
-- FencingDraw — アカウント削除 マイグレーション（追加分）
-- migration_002 の後に、Supabase SQL Editor で実行してください
-- ============================================================

-- ── 方針 ────────────────────────────────────────────────────
-- アカウント削除 = 本人が管理（owner）する大会もすべて削除する。
--   1. tournaments (owner_id = 自分) を削除
--      → collab_keys / tournament_editors / collab_key_attempts は
--        tournament_id の ON DELETE CASCADE で自動削除
--   2. auth.users から自分を削除
--      → 他人の大会に editor として参加していた行も
--        user_id の ON DELETE CASCADE で自動削除
--      → auth 側の identities / sessions / refresh_tokens も CASCADE
-- パスワード確認はクライアント側で signInWithPassword による
-- 再認証を行ってからこの RPC を呼ぶ（サーバーに平文PWを渡さない）。

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- 1. 管理する大会を全削除（関連テーブルはFKのCASCADEで削除される）
  DELETE FROM public.tournaments WHERE owner_id = v_uid;

  -- 2. アカウント本体を削除
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- デフォルトで PUBLIC に EXECUTE が付与されるため明示的に剥がす
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ── 補足 ────────────────────────────────────────────────────
-- もし実行時に「permission denied for table users」が出る場合は、
-- プロジェクトが古く postgres ロールに auth スキーマの権限がない状態。
-- その場合は service_role キーを使う Edge Function 経由の
-- auth.admin.deleteUser() 方式に切り替える必要がある。

-- ── 完了 ────────────────────────────────────────────────────
