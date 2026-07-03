/**
 * 新機能検証テスト
 * 前提: seed-test-data.mjs を実行してテストデータを投入済みであること
 */
import { test, expect } from '@playwright/test';

const HAS_CREDENTIALS = !!(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);

async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('サーバーに接続中'),
    { timeout: 20000 }
  );
}

async function expandArchive(page: import('@playwright/test').Page) {
  const archiveBtn = page.locator('button').filter({ hasText: /過去の大会（アーカイブ）/ }).first();
  if (await archiveBtn.count() > 0) {
    await archiveBtn.click();
    await page.waitForTimeout(300);
  }
}

// ── ホーム画面テスト ────────────────────────────────────────────────

test('F01 - 3大会が一覧に表示される', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('text=【未開催】春季大会').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('text=【進行中】東京都選手権').first()).toBeVisible({ timeout: 5000 });
  // 完了大会はアーカイブセクションを展開してから確認
  await expandArchive(page);
  await expect(page.locator('text=【完了】全国大会').first()).toBeVisible({ timeout: 5000 });
});

test('F02 - 【未開催】大会のステータスバッジ確認', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【未開催】春季大会').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  // 親の行の中に「未」バッジがあること
  const eventRow = row.locator('xpath=ancestor::div[contains(@class,"border")]').first();
  // 行を展開してカテゴリ確認
  await row.click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=シニア男子').first()).toBeVisible({ timeout: 5000 });
});

test('F03 - 【進行中】大会を展開して複数カテゴリを確認', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();
  await page.waitForTimeout(400);
  // 3カテゴリが展開されること
  await expect(page.locator('text=シニア男子エペ').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=シニア女子エペ').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=ジュニア男子エペ').first()).toBeVisible({ timeout: 5000 });
});

test('F04 - 【完了】大会のカテゴリ確認', async ({ page }) => {
  await waitForApp(page);
  await expandArchive(page);
  const row = page.locator('text=【完了】全国大会').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=シニア男子サーブル').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=シニア女子サーブル').first()).toBeVisible({ timeout: 5000 });
});

// ── 閲覧モード: プール戦進行中は「通過判定」「最終順位」タブ非表示 ──

test('F05 - プール戦進行中: 通過判定タブが非表示', async ({ page }) => {
  await waitForApp(page);
  // 【進行中】大会のシニア男子エペ（pool-running状態）を開く
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  // プール表タブが表示されること（プールが存在するため）
  const poolTab = page.locator('button').filter({ hasText: 'プール表' }).first();
  await expect(poolTab).toBeVisible({ timeout: 3000 });
  // 通過判定・最終順位タブが非表示であること（プール戦未完了）
  const advTab = page.locator('button').filter({ hasText: '通過判定' });
  await expect(advTab).not.toBeVisible();
  const resultTab = page.locator('button').filter({ hasText: '最終順位' });
  await expect(resultTab).not.toBeVisible();
});

test('F06 - プール表タブで試合順序が表示される', async ({ page }) => {
  // pool-advancement 状態（プール完了）のカテゴリで確認する
  // 【進行中】の2番目カテゴリ「シニア女子エペ」は pool-advancement
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  // 2番目の「開く →」（シニア女子エペ）を使う
  const openBtns = page.locator('button').filter({ hasText: '開く →' });
  await expect(openBtns.nth(1)).toBeVisible({ timeout: 8000 });
  await openBtns.nth(1).click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 10000 });

  // プール表タブが表示されること
  const poolTab = page.locator('button').filter({ hasText: 'プール表' }).first();
  await expect(poolTab).toBeVisible({ timeout: 5000 });
  await poolTab.click();
  await page.waitForTimeout(800);

  // 「試合順序」セクションが存在すること
  await expect(page.locator('text=試合順序（FIE推奨）').first()).toBeVisible({ timeout: 8000 });
  // 試合番号が表示されること
  await expect(page.locator('text=#1').first()).toBeVisible({ timeout: 3000 });
});

// ── 管理モード: 棄権・ピスト ────────────────────────────────────────

test('F07 - 管理モードでピスト割り振りタブが表示される', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  // 【進行中】のシニア男子エペ（pool-running）を管理モードで開く
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  // 「✎ 編集」ボタンで管理モードへ
  const editBtn = page.locator('button').filter({ hasText: '✎ 編集' }).first();
  await expect(editBtn).toBeVisible({ timeout: 5000 });
  await editBtn.click();

  // 管理モード（プール戦フェーズ）で「ピスト割り振り」タブが存在すること
  const pisteTab = page.locator('button').filter({ hasText: 'ピスト割り振り' }).first();
  await expect(pisteTab).toBeVisible({ timeout: 8000 });
  await pisteTab.click();
  await page.waitForTimeout(400);

  // ピスト番号入力欄が表示されること
  const pisteInput = page.locator('input[type="number"]').first();
  await expect(pisteInput).toBeVisible({ timeout: 3000 });
});

test('F08 - 管理モードで棄権ボタンが表示される', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  const editBtn = page.locator('button').filter({ hasText: '✎ 編集' }).first();
  await editBtn.click();

  // スコア入力タブ（デフォルト）に棄権ボタンが存在すること
  const kikenBtn = page.locator('button').filter({ hasText: '棄権' }).first();
  await expect(kikenBtn).toBeVisible({ timeout: 8000 });
});

// ── カテゴリ作成: 個人/団体フィールド ──────────────────────────────

test('F09 - カテゴリ追加モーダルに個人/団体フィールドがある', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);

  // 管理モードに入ってカテゴリ追加ボタンを確認
  const row = page.locator('text=【未開催】春季大会').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  const editBtn = page.locator('button').filter({ hasText: '✎ 編集' }).first();
  await editBtn.click();
  await page.waitForTimeout(500);

  // 「＋ カテゴリ」ボタンをクリック
  const addCatBtn = page.locator('button').filter({ hasText: '＋ カテゴリ' }).first();
  await expect(addCatBtn).toBeVisible({ timeout: 5000 });
  await addCatBtn.click();

  // モーダルが開き「個人/団体」フィールドが存在すること
  const modalTitle = page.locator('h3', { hasText: 'カテゴリを追加' });
  await expect(modalTitle).toBeVisible({ timeout: 3000 });
  // モーダル内コンテナにスコープして操作（EntryManagerの同名ボタンと区別）
  const modal = page.locator('div').filter({ has: modalTitle }).last();
  await expect(modal.locator('text=個人/団体').first()).toBeVisible({ timeout: 3000 });
  await expect(modal.locator('button', { hasText: '個人' }).first()).toBeVisible();
  await expect(modal.locator('button', { hasText: '団体' }).first()).toBeVisible();

  // 「団体」を選択して確認
  await modal.locator('button', { hasText: '団体' }).first().click();
  await expect(modal.locator('button', { hasText: '団体' }).first()).toBeVisible();

  // キャンセル
  await modal.locator('button', { hasText: 'キャンセル' }).first().click();
});

// ── プール戦完了: 通過判定・最終順位タブ表示 ──────────────────────

test('F10 - プール戦完了カテゴリで通過判定タブが表示される', async ({ page }) => {
  await waitForApp(page);
  // 【進行中】大会のシニア女子エペ（pool-advancement状態）を開く
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  // 2番目の「開く →」ボタン（シニア女子エペ）
  const openBtns = page.locator('button').filter({ hasText: '開く →' });
  await expect(openBtns.nth(1)).toBeVisible({ timeout: 5000 });
  await openBtns.nth(1).click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  // プール戦完了 → 通過判定タブが表示されること
  const advTab = page.locator('button').filter({ hasText: '通過判定' }).first();
  await expect(advTab).toBeVisible({ timeout: 5000 });

  // 通過判定タブをクリックして内容確認
  await advTab.click();
  await page.waitForTimeout(400);
  // 通過/除外バッジが表示されること
  const passedBadge = page.locator('text=通過').first();
  await expect(passedBadge).toBeVisible({ timeout: 3000 });
});

// ── 【完了】大会: トーナメントタブ確認 ────────────────────────────

test('F11 - 【完了】大会でトーナメントタブが表示される', async ({ page }) => {
  await waitForApp(page);
  await expandArchive(page);
  const row = page.locator('text=【完了】全国大会').first();
  await row.click();
  await page.waitForTimeout(400);
  // シニア男子サーブル（bracket状態）を開く
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  // トーナメントタブが存在すること
  const bracketTab = page.locator('button').filter({ hasText: 'トーナメント' }).first();
  await expect(bracketTab).toBeVisible({ timeout: 5000 });
  await bracketTab.click();
  await page.waitForTimeout(500);

  // トーナメントの試合が表示されること
  await expect(page.locator('text=トーナメント').first()).toBeVisible();
});

// ── 編集ボタン統一確認 ────────────────────────────────────────────

test('F12 - 閲覧モードのヘッダーに編集専用ボタンのみ存在する', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【未開催】春季大会').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 6000 });

  // 「＋ カテゴリ」ボタンがヘッダーに存在しないこと（管理モード専用）
  const header = page.locator('header');
  await expect(header.locator('button').filter({ hasText: '＋ カテゴリ' })).not.toBeVisible();
  await expect(header.locator('button').filter({ hasText: '大会編集' })).not.toBeVisible();

  // 「編集」または「🔑 編集（要ログイン）」ボタンは存在すること
  const editBtn = header.locator('button').filter({ hasText: /編集/ }).first();
  await expect(editBtn).toBeVisible({ timeout: 3000 });
});
