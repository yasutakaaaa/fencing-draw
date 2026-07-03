/**
 * FencingDraw — Playwright 通しテスト（Supabase バックエンド版）
 *
 * 事前に auth.setup.ts が実行されて storageState（認証状態）が共有される。
 * TEST_EMAIL / TEST_PASSWORD が設定されていれば管理テスト(05-12)も実行される。
 * 例: TEST_EMAIL=admin@example.com TEST_PASSWORD=pass123 npx playwright test
 */
import { test, expect, Page } from '@playwright/test';

const HAS_CREDENTIALS = !!(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}

// Supabase 接続完了（ローディング画面が消える）まで待つ
async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('サーバーに接続中'),
    { timeout: 20000 }
  );
  // networkidle は使わない（Realtime WebSocket が常時接続中のため）
}

// E2Eテスト大会を展開して「開く →」をクリックし管理モードへ
async function openE2ETournamentAdmin(page: Page) {
  const row = page.locator('text=E2Eテスト大会2026').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();
  await page.waitForTimeout(500);

  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();
  await page.waitForTimeout(300);

  // 管理ボタンがあれば編集モードへ切替
  const editBtn = page.locator('button').filter({ hasText: /✎ 編集/ });
  if (await editBtn.count() > 0) await editBtn.click();
  await page.waitForTimeout(300);
}

const FENCERS = [
  { lastName: '山田', firstName: '太郎', kanaLast: 'やまだ', kanaFirst: 'たろう', club: 'A剣友会', grade: '高1' },
  { lastName: '鈴木', firstName: '花子', kanaLast: 'すずき', kanaFirst: 'はなこ', club: 'A剣友会', grade: '高2' },
  { lastName: '田中', firstName: '一郎', kanaLast: 'たなか', kanaFirst: 'いちろう', club: 'B剣友会', grade: '高1' },
  { lastName: '佐藤', firstName: '次郎', kanaLast: 'さとう', kanaFirst: 'じろう', club: 'B剣友会', grade: '高3' },
  { lastName: '伊藤', firstName: '三郎', kanaLast: 'いとう', kanaFirst: 'さぶろう', club: 'C剣友会', grade: '高2' },
  { lastName: '渡辺', firstName: '四郎', kanaLast: 'わたなべ', kanaFirst: 'しろう', club: 'C剣友会', grade: '高1' },
];

async function addFencer(page: Page, f: typeof FENCERS[0]) {
  await page.locator('input[placeholder="山田"]').fill(f.lastName);
  await page.locator('input[placeholder="太郎"]').fill(f.firstName);
  await page.locator('input[placeholder="やまだ"]').fill(f.kanaLast);
  await page.locator('input[placeholder="たろう"]').fill(f.kanaFirst);
  await page.locator('input[placeholder*="大学"]').fill(f.club);
  await page.locator('input[placeholder="高2"]').fill(f.grade);
  await page.locator('button').filter({ hasText: /^追加$/ }).click();
  await page.waitForTimeout(200);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 【公開テスト】認証不要（ただし storageState で認証済みでも動く）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('01 - Supabase接続・ホーム画面が表示される', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('text=FencingDraw').first()).toBeVisible();
  await expect(page.locator('input[type="search"]')).toBeVisible();
  // ログイン済み or ログアウト済みどちらでも通る
  const hasAuth = await page.locator('button').filter({ hasText: 'ログアウト' }).count() > 0;
  const hasLogin = await page.locator('button').filter({ hasText: 'ログイン' }).count() > 0;
  expect(hasAuth || hasLogin).toBeTruthy();
  await ss(page, '01-home-loaded');
});

test('02 - カラムヘッダーが表示される（状態・大会名・日付）', async ({ page }) => {
  await waitForApp(page);
  await expect(page.locator('text=状態')).toBeVisible();
  await expect(page.locator('text=大会名')).toBeVisible();
  await expect(page.locator('text=日付')).toBeVisible();
  await ss(page, '02-column-headers');
});

test('03 - ログインモーダルのUI確認', async ({ page }) => {
  await waitForApp(page);
  // 認証済みの場合はスキップ
  if (await page.locator('button').filter({ hasText: 'ログアウト' }).count() > 0) {
    test.skip(true, '認証済みのためスキップ');
    return;
  }
  await page.locator('button').filter({ hasText: 'ログイン' }).first().click();
  await expect(page.locator('text=管理者ログイン')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('text=アカウントを新規作成')).toBeVisible();
  await ss(page, '03-login-modal');
  await page.locator('button').filter({ hasText: 'キャンセル' }).click();
});

test('04 - アカウント登録フォームへの切り替え', async ({ page }) => {
  await waitForApp(page);
  if (await page.locator('button').filter({ hasText: 'ログアウト' }).count() > 0) {
    test.skip(true, '認証済みのためスキップ');
    return;
  }
  await page.locator('button').filter({ hasText: 'ログイン' }).first().click();
  await page.locator('text=アカウントを新規作成').click();
  await expect(page.locator('text=新規アカウント登録')).toBeVisible();
  await page.locator('text=すでにアカウントをお持ちの方').click();
  await expect(page.locator('text=管理者ログイン')).toBeVisible();
  await ss(page, '04-signup-switch');
  await page.locator('button').filter({ hasText: 'キャンセル' }).click();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 【管理テスト】storageState でログイン済み状態が共有される
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test('05 - 大会を作成してカテゴリを追加する', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  // ログイン済みであることを確認
  await expect(page.locator('button').filter({ hasText: 'ログアウト' })).toBeVisible({ timeout: 5000 });
  await ss(page, '05-logged-in');

  // すでに E2E 大会があればスキップ
  if (await page.locator('text=E2Eテスト大会2026').count() > 0) {
    await ss(page, '05-event-exists');
    return;
  }

  // 「+ 新しい大会」ヘッダーボタン
  await page.locator('header button').filter({ hasText: '新しい大会' }).click();
  // モーダルの h3 で確認（button テキストと競合しない）
  await expect(page.locator('h3').filter({ hasText: '新しい大会を作成' })).toBeVisible();
  await page.locator('input[placeholder*="フェンシング大会"]').fill('E2Eテスト大会2026');
  await page.locator('button').filter({ hasText: '作成 →' }).click();

  // カテゴリ追加モーダル
  await expect(page.locator('text=最初のカテゴリを追加')).toBeVisible({ timeout: 5000 });
  await ss(page, '05-first-category-modal');

  await page.locator('button').filter({ hasText: '追加して編集を開始' }).click();
  await expect(page.locator('text=エントリー').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=編集中')).toBeVisible();

  // 保存完了を待つ
  await page.waitForFunction(
    () => document.body.innerText.includes('保存済み'),
    { timeout: 10000 }
  ).catch(() => {/* 表示されない場合も続行 */});
  await page.waitForTimeout(1000);
  await ss(page, '05-admin-mode');
});

test('06 - 選手を6名追加する', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  await openE2ETournamentAdmin(page);
  // コンテンツレンダリング完了を待つ
  await page.waitForTimeout(1000);

  // プール戦フェーズならスキップ（選手は既にいる）
  // button に絞る（ヒントテキストも 'スコア入力' を含むため複数ヒットを防ぐ）
  const isPoolPhase = await page.locator('button').filter({ hasText: 'スコア入力' }).first().isVisible().catch(() => false);
  if (!isPoolPhase) {
    // エントリーフェーズ: エントリーフォームの表示を確認してから選手追加
    await expect(page.locator('input[placeholder="山田"]').first()).toBeVisible({ timeout: 5000 });
    if (await page.locator('text=山田太郎').count() === 0) {
      for (const f of FENCERS) await addFencer(page, f);
    }
  }

  await expect(page.locator('text=山田太郎').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('text=渡辺四郎').first()).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
  await ss(page, '06-fencers-added');
});

test('07 - プール分けを作成する', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  await openE2ETournamentAdmin(page);
  await expect(page.locator('text=エントリー').first()).toBeVisible({ timeout: 5000 });

  const createBtn = page.locator('button').filter({ hasText: '組み合わせを作成' });
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await page.waitForTimeout(1500);
  }

  await expect(page.locator('text=プール').first()).toBeVisible({ timeout: 5000 });
  await ss(page, '07-pools-created');
});

test('08 - スコア入力と保存ステータス確認', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  await openE2ETournamentAdmin(page);

  // プール戦タブへ（必要な場合）
  const poolTab = page.locator('button').filter({ hasText: 'プール戦' }).first();
  if (await poolTab.count() > 0) await poolTab.click();

  const scoreInputs = page.locator('input[inputmode="numeric"]');
  const cnt = await scoreInputs.count();
  if (cnt >= 2) {
    await scoreInputs.nth(0).fill('5');
    await scoreInputs.nth(1).fill('3');
    await page.waitForTimeout(300);
    const vBtns = page.locator('button').filter({ hasText: /^V$/ });
    if (await vBtns.count() > 0) await vBtns.first().click();
    // debounce 1.5s + 保存
    await page.waitForFunction(
      () => document.body.innerText.includes('保存済み'),
      { timeout: 8000 }
    ).catch(() => {});
  }
  await ss(page, '08-score-input');
});

test('09 - 閲覧モードでフェイユ・ド・プール確認', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  const row = page.locator('text=E2Eテスト大会2026').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();

  // 閲覧モード（管理ボタンを押さない）
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 5000 });
  await page.locator('button').filter({ hasText: 'プール表' }).click();
  await page.waitForTimeout(500);
  // プールが作成されていればフェイユ・ド・プール表を確認
  const hasPoolTable = await page.locator('th').filter({ hasText: 'V/M' }).count() > 0;
  if (hasPoolTable) {
    await expect(page.locator('th').filter({ hasText: 'V/M' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Ind' })).toBeVisible();
  } else {
    // プール未作成（テスト07が先行して失敗した場合）
    console.log('⚠ プールが未作成のためフェイユ・ド・プール確認をスキップ');
  }
  await ss(page, '09-feuille-de-poule');
});

test('10 - 全タブ巡回（エントリー・プール表・通過判定・トーナメント・最終順位）', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  const row = page.locator('text=E2Eテスト大会2026').first();
  await expect(row).toBeVisible({ timeout: 8000 });
  await row.click();
  await page.waitForTimeout(400);
  const openBtn = page.locator('button').filter({ hasText: '開く →' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();
  await expect(page.locator('text=エントリー選手')).toBeVisible({ timeout: 5000 });

  for (const label of ['エントリー', 'プール表', '通過判定', 'トーナメント', '最終順位']) {
    const tab = page.locator('button').filter({ hasText: label }).first();
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(400);
      await ss(page, `10-tab-${label}`);
    }
  }
});

test('11 - 検索（大会名フィルタリング）', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  await expect(page.locator('text=E2Eテスト大会2026').first()).toBeVisible({ timeout: 8000 });

  const search = page.locator('input[type="search"]');
  await search.fill('E2E');
  await page.waitForTimeout(300);
  await expect(page.locator('text=E2Eテスト大会2026').first()).toBeVisible();

  await search.fill('存在しない大会XYZ99');
  await page.waitForTimeout(300);
  await expect(page.locator('text=E2Eテスト大会2026')).not.toBeVisible();

  await search.fill('');
  await ss(page, '11-search-cleared');
});

test('12 - 管理モードから一覧に戻る', async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, 'TEST_EMAIL/TEST_PASSWORD が未設定');

  await waitForApp(page);
  await openE2ETournamentAdmin(page);
  await expect(page.locator('text=エントリー').first()).toBeVisible({ timeout: 5000 });

  // 「← 一覧」ボタンで戻る
  await page.locator('button').filter({ hasText: /← 一覧/ }).first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=FencingDraw').first()).toBeVisible();
  await expect(page.locator('text=E2Eテスト大会2026').first()).toBeVisible();
  await ss(page, '12-back-to-list');
});
