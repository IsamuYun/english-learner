import { test as base, type APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3001'

interface Fixtures {
  api: APIRequestContext
}

export const test = base.extend<Fixtures>({
  api: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: API_BASE })
    await use(ctx)
    await ctx.dispose()
  },
})

export { expect } from '@playwright/test'
