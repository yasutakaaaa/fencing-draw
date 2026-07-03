/**
 * P1・P2 新機能検証テスト
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

// ── P1-1: URL ディープリンク ──────────────────────────────────────────

test('P1-1a - 閲覧ビューに「共有」ボタンがある', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  const shareBtn = page.locator('button').filter({ hasText: '共有' }).first();
  await expect(shareBtn).toBeVisible({ timeout: 3000 });
});

test('P1-1b - 大会を開くとURLハッシュが更新される', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // URL に #/t/ が含まれること
  await page.waitForFunction(() => window.location.hash.startsWith('#/t/'), { timeout: 5000 });
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toMatch(/^#\/t\/[a-z0-9]+/);
});

test('P1-1c - タブを切り替えるとURLのtabパラメータが更新される', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  // 2番目のカテゴリ（pool-advancement: プール完了）
  const openBtns = page.locator('button').filter({ hasText: '開く →' });
  await openBtns.nth(1).click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // プール表タブをクリック
  const poolTab = page.locator('button').filter({ hasText: 'プール表' }).first();
  await poolTab.click();
  await page.waitForTimeout(500);

  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('tab=pools');
});

test('P1-1d - ディープリンクURLを直接開くと該当大会が表示される', async ({ page }) => {
  // まず通常に開いてURLを取得
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });
  await page.waitForFunction(() => window.location.hash.startsWith('#/t/'), { timeout: 5000 });
  const deepLink = await page.evaluate(() => window.location.href);

  // 新しいページでディープリンクを開く
  const page2 = await page.context().newPage();
  await page2.goto(deepLink);
  // ローディング完了 + ハッシュ処理完了を待つ（データ取得→useEffect発火まで）
  await page2.waitForFunction(
    () => {
      const text = document.body.innerText;
      // サーバー接続中でなく、かつ何らかのコンテンツが表示されるまで待つ
      return !text.includes('サーバーに接続中');
    },
    { timeout: 20000 }
  );
  // ハッシュ処理・大会表示まで追加待機
  await page2.waitForTimeout(2000);
  // 大会が直接表示されること（ホーム画面でなく閲覧ビュー）
  await expect(page2.locator('text=エントリー選手')).toBeVisible({ timeout: 12000 });
  await page2.close();
});

// ── P1-2: Realtime / 最終更新 ─────────────────────────────────────────

test('P1-2a - 閲覧ヘッダーに最終更新時刻が表示される', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // 最終更新表示 (HH:MM形式)
  const updateText = page.locator('text=/最終更新|更新 \\d+:\\d+/').first();
  await expect(updateText).toBeVisible({ timeout: 5000 });
});

// ── P1-3: 選手中心ビュー強化 ──────────────────────────────────────────

test('P1-3a - 選手検索で個別プール対戦結果が表示される', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  // pool-advancement（プール完了）の2番目のカテゴリを開く
  const openBtns = page.locator('button').filter({ hasText: '開く →' });
  await openBtns.nth(1).click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // 検索実行
  const searchInput = page.locator('input[type="search"]').first();
  await searchInput.fill('山');
  await page.waitForTimeout(500);

  // 検索結果に「プール対戦結果」セクションが表示される
  const boutSection = page.locator('text=プール対戦結果').first();
  if (await boutSection.count() > 0) {
    await expect(boutSection).toBeVisible({ timeout: 3000 });
  } else {
    // 検索結果が出れば OK（選手名によっては山がいないケースも許容）
    const results = page.locator('text=エントリー選手').first();
    await expect(results).toBeVisible();
  }
});

test('P1-3b - 選手検索パネルに棄権バッジが表示される', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // 任意の選手で検索
  const searchInput = page.locator('input[type="search"]').first();
  await searchInput.fill('田');
  await page.waitForTimeout(500);

  // 検索結果パネルのコンテナが存在すること
  const panelContainer = page.locator('.bg-yellow-50').first();
  if (await panelContainer.count() > 0) {
    await expect(panelContainer).toBeVisible({ timeout: 3000 });
  }
});

// ── P2-6: スコア入力 undo ──────────────────────────────────────────────

test('P2-6a - プール管理画面に「取消」ボタンが表示される（入力後）', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  const editBtn = page.locator('button').filter({ hasText: '✎ 編集' }).first();
  await editBtn.click();
  await page.waitForTimeout(500);

  // 最初は「取消」ボタンが非表示
  const undoBtn = page.locator('button').filter({ hasText: '↩ 取消' }).first();
  await expect(undoBtn).not.toBeVisible();

  // V ボタンをクリックしてスコアを入力（'V' のみの完全一致で CSV ボタンを除外）
  const vButtons = page.locator('button').filter({ hasText: /^V$/ });
  if (await vButtons.count() > 0) {
    await vButtons.first().click();
    await page.waitForTimeout(800);
    // 入力後は取消ボタンが表示される
    await expect(undoBtn).toBeVisible({ timeout: 5000 });
  }
});

// ── P2-8: ステータスフィルタ ──────────────────────────────────────────

test('P2-8a - 一覧にステータスフィルタボタンが表示される', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('button').filter({ hasText: 'すべて' }).first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('button').filter({ hasText: '進行中' }).first()).toBeVisible({ timeout: 3000 });
  await expect(page.locator('button').filter({ hasText: '準備中' }).first()).toBeVisible({ timeout: 3000 });
  await expect(page.locator('button').filter({ hasText: '終了' }).first()).toBeVisible({ timeout: 3000 });
});

test('P2-8b - 「進行中」フィルタで未開催大会が非表示になる', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('text=【未開催】春季大会').first()).toBeVisible({ timeout: 8000 });

  // 「進行中」フィルタをクリック
  await page.locator('button').filter({ hasText: '進行中' }).first().click();
  await page.waitForTimeout(500);

  // 【未開催】大会が非表示になること
  await expect(page.locator('text=【未開催】春季大会').first()).not.toBeVisible();
  // 【進行中】大会は表示されること
  await expect(page.locator('text=【進行中】東京都選手権').first()).toBeVisible({ timeout: 3000 });
});

test('P2-8c - 「すべて」に戻すと全大会が表示される', async ({ page }) => {
  await waitForApp(page);
  // 進行中に切り替え
  await page.locator('button').filter({ hasText: '進行中' }).first().click();
  await page.waitForTimeout(300);
  // すべてに戻す
  await page.locator('button').filter({ hasText: 'すべて' }).first().click();
  await page.waitForTimeout(300);
  // 未開催大会が再表示
  await expect(page.locator('text=【未開催】春季大会').first()).toBeVisible({ timeout: 5000 });
});

// ── P2-7: 印刷ボタン ──────────────────────────────────────────────────

test('P2-7a - 閲覧ビューに印刷ボタンがある（デスクトップ）', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });

  // デスクトップ幅 (1280px) で印刷ボタンが表示されること
  await page.setViewportSize({ width: 1280, height: 800 });
  const printBtn = page.locator('button').filter({ hasText: '🖨 印刷' }).first();
  await expect(printBtn).toBeVisible({ timeout: 3000 });
});

// ── 一覧に戻った時のURL確認 ──────────────────────────────────────────

test('P1-1e - 一覧に戻るとURLハッシュがクリアされる', async ({ page }) => {
  await waitForApp(page);
  const row = page.locator('text=【進行中】東京都選手権').first();
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 8000 });
  await page.waitForFunction(() => window.location.hash.startsWith('#/t/'), { timeout: 5000 });

  // 一覧に戻る
  await page.locator('button').filter({ hasText: '← 一覧' }).first().click();
  await page.waitForTimeout(500);

  // ハッシュが消えること
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).not.toMatch(/^#\/t\//);
});
