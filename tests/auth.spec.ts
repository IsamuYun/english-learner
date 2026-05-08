import { expect, test } from '@playwright/test'
import { loginViaUi, openUserMenu, registerViaUi, uniqueUsername } from './helpers'

test.describe('authentication', () => {
  test('anonymous visitor can see / but is redirected from protected pages', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    // Header shows the 登录 link in anonymous mode
    await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible()
    // Hero CTA points to /login
    await expect(page.getByRole('link', { name: /登录开始练习/ })).toBeVisible()
    // Anonymous progress hint is rendered
    await expect(page.getByText(/登录后这里会出现你的学习进度/)).toBeVisible()

    // A protected page bounces to /login with `from` set so we return here after login
    await page.goto('/flashcards')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  })

  test('register flow creates account and lands on home', async ({ page }) => {
    const { username } = await registerViaUi(page)
    await expect(page).toHaveURL('/')
    // Greeting uses display name (defaults to username)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`你好，${username}`)
    // Authenticated CTA replaces the anonymous one
    await expect(page.getByRole('link', { name: /开始今天的练习/ })).toBeVisible()
    // Stats card "背过的单词" is visible
    await expect(page.getByText('背过的单词')).toBeVisible()
  })

  test('register with too-short password shows inline error', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '注册一个' }).click()
    await page.getByLabel('用户名').fill(uniqueUsername())
    await page.getByLabel('密码').fill('123')
    await page.getByRole('button', { name: '注册并登录' }).click()
    await expect(page.getByText('密码至少 6 位')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('duplicate username returns 409 → "用户名已被占用"', async ({ page }) => {
    const username = uniqueUsername()
    await registerViaUi(page, { username })
    // Log out, then try registering the same name
    await openUserMenu(page)
    await page.getByRole('button', { name: '退出登录' }).click()
    // Logout leaves the user on /, anonymous. Walk over to /login manually.
    await page.goto('/login')

    await page.getByRole('button', { name: '注册一个' }).click()
    await page.getByLabel('用户名').fill(username)
    await page.getByLabel('密码').fill('secret123')
    await page.getByRole('button', { name: '注册并登录' }).click()
    await expect(page.getByText('用户名已被占用')).toBeVisible()
  })

  test('login with wrong password shows credential error', async ({ page }) => {
    const { username } = await registerViaUi(page)
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/login')
    await page.getByLabel('用户名').fill(username)
    await page.getByLabel('密码').fill('wrong-password')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.getByText('用户名或密码错误')).toBeVisible()
  })

  test('login persists across reload + restores intended destination', async ({ page }) => {
    const { username, password } = await registerViaUi(page)
    await page.reload()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`你好，${username}`)

    // Sanity: open a protected page directly, still authenticated
    await page.goto('/flashcards')
    await expect(page).toHaveURL('/flashcards')

    // Fresh visitor (no token) on a protected URL → bounce to /login,
    // then logging in returns them to the page they wanted.
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/flashcards')
    await expect(page).toHaveURL(/\/login$/)
    await loginViaUi(page, username, password)
    await expect(page).toHaveURL('/flashcards')
  })

  test('logout leaves user on home in anonymous state', async ({ page }) => {
    await registerViaUi(page)
    await openUserMenu(page)
    await page.getByRole('button', { name: '退出登录' }).click()

    // Home is public — no redirect, header swaps to the 登录 link
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible()

    const token = await page.evaluate(() => window.localStorage.getItem('english.auth.token'))
    expect(token).toBeNull()

    // Protected pages now bounce
    await page.goto('/flashcards')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('expired/invalid token degrades to anonymous, protected pages bounce', async ({ page }) => {
    await registerViaUi(page)
    await page.evaluate(() => {
      window.localStorage.setItem('english.auth.token', 'definitely-not-a-real-token')
    })
    await page.reload()

    // Bootstrap calls /api/auth/me, fails 401, drops to anonymous on /
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible()
    const token = await page.evaluate(() => window.localStorage.getItem('english.auth.token'))
    expect(token).toBeNull()

    await page.goto('/flashcards')
    await expect(page).toHaveURL(/\/login$/)
  })
})
