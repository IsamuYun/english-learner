import { expect, test } from './fixtures'
import { registerViaUi } from './helpers'

test.describe('learning flow', () => {
  test('flashcards page renders a word after login', async ({ page }) => {
    await registerViaUi(page)
    await page.goto('/flashcards')
    await expect(page).toHaveURL('/flashcards')
    // Wait for the word card to appear (loader removed once useWords resolves)
    await expect(page.locator('text=载入词汇中')).toHaveCount(0, { timeout: 15_000 })
    // Level filter is part of the page chrome; if present, the page mounted
    await expect(page.getByRole('button', { name: 'L2 进阶' })).toBeVisible()
  })

  test('home stats reflect a flashcard update through the API', async ({ page, api }) => {
    await registerViaUi(page)
    const token = await page.evaluate(() =>
      window.localStorage.getItem('english.auth.token'),
    )
    expect(token).toBeTruthy()
    const auth = { Authorization: `Bearer ${token}` }

    const before = await api.get('/api/stats', { headers: auth })
    expect(before.ok()).toBeTruthy()
    const beforeJson = await before.json()
    expect(beforeJson.totalWords).toBeGreaterThan(0)
    expect(beforeJson.seenWords).toBe(0)
    expect(beforeJson.knownWords).toBe(0)

    // Pick word id 1 (seed always populates from id=1 onward) and mark it seen+known
    const update = await api.put('/api/flashcards/1', {
      headers: { ...auth, 'Content-Type': 'application/json' },
      data: { seen: 1, bucket: 3 },
    })
    expect(update.ok()).toBeTruthy()

    const after = await api.get('/api/stats', { headers: auth })
    const afterJson = await after.json()
    expect(afterJson.seenWords).toBe(1)
    expect(afterJson.knownWords).toBe(1)

    // Reload the home page; UI should pick up the same numbers
    await page.goto('/')
    await expect(page.getByText('背过的单词')).toBeVisible()
    await expect(
      page
        .locator('div')
        .filter({ hasText: /^背过的单词$/ })
        .locator('..')
        .getByText('1', { exact: true }),
    ).toBeVisible()
  })

  test('progress is isolated per user', async ({ page, api }) => {
    // User A: mark a word as mastered
    const a = await registerViaUi(page)
    const tokenA = (await page.evaluate(() =>
      window.localStorage.getItem('english.auth.token'),
    )) as string
    await api.put('/api/flashcards/2', {
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      data: { seen: 1, bucket: 4 },
    })

    // Switch to a fresh user B
    await page.evaluate(() => window.localStorage.clear())
    const b = await registerViaUi(page)
    const tokenB = (await page.evaluate(() =>
      window.localStorage.getItem('english.auth.token'),
    )) as string
    expect(b.username).not.toBe(a.username)

    const res = await api.get('/api/stats', {
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    const json = await res.json()
    expect(json.seenWords).toBe(0)
    expect(json.knownWords).toBe(0)
    expect(json.masteredWords).toBe(0)
  })
})
