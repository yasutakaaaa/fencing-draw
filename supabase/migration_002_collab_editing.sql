-- ============================================================
-- FencingDraw — 共同編集機能 マイグレーション（追加分）
-- migration.sql の後に、Supabase SQL Editor で実行してください
-- ============================================================

-- ── 0. pgcrypto拡張（ハッシュ生成用） ──────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1. collab_keys: 6桁編集キー（ハッシュのみ保存） ─────────
-- tournamentsテーブルには置かない。SELECTは所有者のみ。
CREATE TABLE IF NOT EXISTS public.collab_keys (
  tournament_id text PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT false,
  key_hash      text,                 -- sha256(key || ':' || tournament_id) の16進文字列。平文は保存しない
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collab_keys ENABLE ROW LEVEL SECURITY;

-- 所有者のみ enabled フラグ等を読める（書き込みは直接許可しない。RPC経由のみ）
DROP POLICY IF EXISTS "owner_can_read_collab_keys" ON public.collab_keys;
CREATE POLICY "owner_can_read_collab_keys" ON public.collab_keys
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = collab_keys.tournament_id AND t.owner_id = auth.uid())
  );

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.collab_keys TO authenticated;
-- INSERT/UPDATE/DELETE のGRANTは一切行わない。書き込みは SECURITY DEFINER 関数 set_collab_key() のみ。

-- ── 2. tournament_editors: キー照合に成功したユーザー ───────
CREATE TABLE IF NOT EXISTS public.tournament_editors (
  tournament_id text NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_editors_user ON public.tournament_editors(user_id);

ALTER TABLE public.tournament_editors ENABLE ROW LEVEL SECURITY;

-- 本人は自分がeditorかどうかだけ読める（フロントの「編集キー入力済み」判定に使用）
DROP POLICY IF EXISTS "self_can_read_own_editor_row" ON public.tournament_editors;
CREATE POLICY "self_can_read_own_editor_row" ON public.tournament_editors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.tournament_editors TO authenticated;
-- INSERT/UPDATE/DELETE のGRANTは一切行わない。書き込みは SECURITY DEFINER 関数のみ
-- （フロントから直接 insert してキー照合をバイパスできないようにするため）。

-- ── 3. collab_key_attempts: レートリミット用の失敗回数記録 ──
-- クライアントからは一切アクセス不可。RPC内部でのみ読み書きする。
CREATE TABLE IF NOT EXISTS public.collab_key_attempts (
  tournament_id   text NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count   int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  locked_until    timestamptz,
  PRIMARY KEY (tournament_id, user_id)
);
ALTER TABLE public.collab_key_attempts ENABLE ROW LEVEL SECURITY;
-- ポリシーもGRANTも一切追加しない = authenticated/anon からは完全に不可視・操作不可。

-- ── 4. tournaments の UPDATE ポリシーを editors 対応に変更 ──
-- DELETEはオーナー限定のまま変更しない（大会まるごと削除はeditorに許可しない方針）。
DROP POLICY IF EXISTS "owner_can_update" ON public.tournaments;
CREATE POLICY "owner_or_editor_can_update" ON public.tournaments
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.tournament_editors te WHERE te.tournament_id = tournaments.id AND te.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.tournament_editors te WHERE te.tournament_id = tournaments.id AND te.user_id = auth.uid())
  );

-- ── 5. RPC: set_collab_key ── オーナーのみ、共同編集ON/OFFとキー設定 ──
CREATE OR REPLACE FUNCTION public.set_collab_key(
  p_tournament_id text,
  p_enabled boolean,
  p_key text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.tournaments WHERE id = p_tournament_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_enabled THEN
    IF p_key IS NULL OR p_key !~ '^[0-9]{6}$' THEN
      RAISE EXCEPTION 'key must be 6 digits';
    END IF;
    INSERT INTO public.collab_keys (tournament_id, enabled, key_hash, updated_at)
      VALUES (p_tournament_id, true, encode(extensions.digest(p_key || ':' || p_tournament_id, 'sha256'), 'hex'), now())
      ON CONFLICT (tournament_id) DO UPDATE
        SET enabled = true, key_hash = EXCLUDED.key_hash, updated_at = now();
  ELSE
    -- OFFにしたら editors を全削除しキーも無効化（要件5）
    INSERT INTO public.collab_keys (tournament_id, enabled, key_hash, updated_at)
      VALUES (p_tournament_id, false, NULL, now())
      ON CONFLICT (tournament_id) DO UPDATE
        SET enabled = false, key_hash = NULL, updated_at = now();
    DELETE FROM public.tournament_editors WHERE tournament_id = p_tournament_id;
    DELETE FROM public.collab_key_attempts WHERE tournament_id = p_tournament_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_collab_key(text, boolean, text) TO authenticated;

-- ── 6. RPC: redeem_collab_key ── 非オーナーがキーを照合し editors に登録 ──
CREATE OR REPLACE FUNCTION public.redeem_collab_key(
  p_tournament_id text,
  p_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_enabled boolean;
  v_hash text;
  v_attempt public.collab_key_attempts%ROWTYPE;
  v_found boolean;
  v_new_count int;
  v_new_locked_until timestamptz;
  v_max_attempts constant int := 5;
  v_lock_minutes constant int := 10;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_key IS NULL OR p_key !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_attempt FROM public.collab_key_attempts
    WHERE tournament_id = p_tournament_id AND user_id = v_uid
    FOR UPDATE;
  v_found := FOUND;

  IF v_found AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    RAISE EXCEPTION 'too many attempts, try again later';
  END IF;

  SELECT enabled, key_hash INTO v_enabled, v_hash
    FROM public.collab_keys WHERE tournament_id = p_tournament_id;

  IF v_enabled IS TRUE AND v_hash IS NOT NULL
     AND v_hash = encode(extensions.digest(p_key || ':' || p_tournament_id, 'sha256'), 'hex') THEN
    -- 成功: 失敗履歴をクリアし editors に登録
    DELETE FROM public.collab_key_attempts WHERE tournament_id = p_tournament_id AND user_id = v_uid;
    INSERT INTO public.tournament_editors (tournament_id, user_id)
      VALUES (p_tournament_id, v_uid)
      ON CONFLICT (tournament_id, user_id) DO NOTHING;
    RETURN true;
  END IF;

  -- 失敗: 試行回数を記録（ロック期間経過後はリセットして1から）
  IF v_found AND (v_attempt.locked_until IS NULL OR v_attempt.locked_until <= now()) THEN
    v_new_count := v_attempt.attempt_count + 1;
  ELSE
    v_new_count := 1;
  END IF;
  v_new_locked_until := CASE WHEN v_new_count >= v_max_attempts
    THEN now() + (v_lock_minutes || ' minutes')::interval ELSE NULL END;

  INSERT INTO public.collab_key_attempts (tournament_id, user_id, attempt_count, last_attempt_at, locked_until)
    VALUES (p_tournament_id, v_uid, v_new_count, now(), v_new_locked_until)
    ON CONFLICT (tournament_id, user_id) DO UPDATE
      SET attempt_count = v_new_count, last_attempt_at = now(), locked_until = v_new_locked_until;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_collab_key(text, text) TO authenticated;

-- ── 完了 ────────────────────────────────────────────────────
