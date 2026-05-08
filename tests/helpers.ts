import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export function uniqueUsername(prefix = 'e2e'): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${stamp}_${rand}`
}

export interface RegisterOptions {
  username?: string
  password?: string
  displayName?: string
}

export async function registerViaUi(
  page: Page,
  opts: RegisterOptions = {},
): Promise<{ username: string; password: string }> {
  const username = opts.username ?? uniqueUsername()
  const password = opts.password ?? 'secret123'

  await page.goto('/login')
  await page.getByRole('button', { name: '注册一个' }).click()
  await page.getByLabel('用户名').fill(username)
  if (opts.displayName) {
    await page.getByLabel('昵称（可选）').fill(opts.displayName)
  }
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '注册并登录' }).click()
  await expect(page).not.toHaveURL(/\/login(?:[?#].*)?$/)
  return { username, password }
}

export async function loginViaUi(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('用户名').fill(username)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login(?:[?#].*)?$/)
}

export async function openUserMenu(page: Page): Promise<void> {
  // The avatar button is the last button in the header (after logo + nav links are <a>).
  await page.locator('header button').last().click()
}
