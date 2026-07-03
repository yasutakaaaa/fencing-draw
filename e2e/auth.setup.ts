/**
 * 認証セットアップ — テスト実行前にログインして storageState を保存する
 * 各テストはこの認証状態を使って実行（ログイン不要）
 */
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';
const TEST_EMAIL    = process.env.TEST_EMAIL    ?? '';
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? '';

setup('認証セットアップ', async ({ page }) => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    await page.context().storageState({ path: authFile });
    return;
  }

  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('サーバーに接続中'),
    { timeout: 20000 }
  );

  const loginBtn = page.locator('button').filter({ hasText: 'ログイン' }).first();
  await expect(loginBtn).toBeVisible({ timeout: 5000 });
  await loginBtn.click();

  await expect(page.locator('text=管理者ログイン')).toBeVisible({ timeout: 3000 });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button').filter({ hasText: 'ログイン' }).last().click();

  await expect(page.locator('button').filter({ hasText: 'ログアウト' })).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: authFile });
});
