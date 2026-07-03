-- ============================================================
-- FencingDraw — Supabase マイグレーション
-- Supabase ダッシュボード > SQL Editor に貼り付けて「Run」してください
-- ============================================================

-- ── 1. テーブル作成 ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tournaments (
  id          text        PRIMARY KEY,           -- クライアント生成ID
  owner_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text        NOT NULL DEFAULT '',
  date        date,
  status      text        NOT NULL DEFAULT '未'
                          CHECK (status IN ('未', '実施中', '終了')),
  data        jsonb       NOT NULL DEFAULT '{}', -- venue/pin/categoryIds/categories を格納
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. updated_at 自動更新トリガー ──────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_updated_at ON public.tournaments;
CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. Row Level Security ───────────────────────────────────

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- 誰でも読める（匿名ユーザーも含む）
DROP POLICY IF EXISTS "anyone_can_read" ON public.tournaments;
CREATE POLICY "anyone_can_read" ON public.tournaments
  FOR SELECT USING (true);

-- 認証済みユーザーは自分の行のみ INSERT
DROP POLICY IF EXISTS "owner_can_insert" ON public.tournaments;
CREATE POLICY "owner_can_insert" ON public.tournaments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 認証済みユーザーは自分の行のみ UPDATE
DROP POLICY IF EXISTS "owner_can_update" ON public.tournaments;
CREATE POLICY "owner_can_update" ON public.tournaments
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 認証済みユーザーは自分の行のみ DELETE
DROP POLICY IF EXISTS "owner_can_delete" ON public.tournaments;
CREATE POLICY "owner_can_delete" ON public.tournaments
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ── 4. Data API アクセスのための GRANT ─────────────────────
-- 「Automatically expose new tables」が無効な場合に必要

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;

-- ── 完了 ────────────────────────────────────────────────────
-- このSQLを実行後、Supabase ダッシュボードの
-- Table Editor > tournaments でテーブルを確認してください。
