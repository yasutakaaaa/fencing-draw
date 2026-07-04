import { test, expect } from '@playwright/test';

async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForFunction(() => !document.body.innerText.includes('サーバーに接続中'), { timeout: 20000 });
}

test('bracket-view: DE進行中は最終順位タブを非表示', async ({ page }) => {
  await waitForApp(page);
  // アーカイブを開く
  const archiveBtn = page.locator('button').filter({ hasText: /過去の大会/ }).first();
  if (await archiveBtn.count() > 0) { await archiveBtn.click(); await page.waitForTimeout(300); }
  // 完了大会を開く
  await page.locator('text=全国大会').first().click();
  await page.waitForTimeout(400);
  // 最初のカテゴリ (シニア男子サーブル: bracket状態)
  await page.locator('button').filter({ hasText: '開く →' }).first().click();
  await page.waitForTimeout(600);
  // トーナメントタブが表示される
  await expect(page.locator('button').filter({ hasText: 'トーナメント' }).first()).toBeVisible({ timeout: 5000 });
  // ブラケット図が表示される
  await page.locator('button').filter({ hasText: 'トーナメント' }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/bracket-incomplete-view.png', fullPage: true });
  // DE進行中 → 最終順位タブは非表示
  const resultsTab = page.locator('button').filter({ hasText: '最終順位' });
  await expect(resultsTab).not.toBeVisible();
});

test('bracket-view: pool完了のみで最終順位表示', async ({ page }) => {
  await waitForApp(page);
  const archiveBtn = page.locator('button').filter({ hasText: /過去の大会/ }).first();
  if (await archiveBtn.count() > 0) { await archiveBtn.click(); await page.waitForTimeout(300); }
  await page.locator('text=全国大会').first().click();
  await page.waitForTimeout(400);
  // 2番目のカテゴリ (シニア女子サーブル: results状態)
  await page.locator('button').filter({ hasText: '開く →' }).nth(1).click();
  await page.waitForTimeout(600);
  // 最終順位タブが表示される (pool-only完了)
  const resultsTab = page.locator('button').filter({ hasText: '最終順位' }).first();
  await expect(resultsTab).toBeVisible({ timeout: 5000 });
  await resultsTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/results-pool-final.png', fullPage: true });
  // 順位テーブルが表示される
  await expect(page.locator('text=最終順位').first()).toBeVisible();
});
