# 测试与 CI/CD 文档

> 项目用 [Playwright](https://playwright.dev/) 跑端到端 (E2E) 测试，GitHub Actions 跑 CI。本地与 CI 共用同一份 `playwright.config.ts`。

## 1. 跑测试（本地）

第一次安装：

```bash
npm install                    # 顶层依赖（含 @playwright/test）
npm run server:install         # 后端依赖（一次即可）
npx playwright install chromium  # 下载 Chromium headless（约 100 MB）
```

常用命令：

```bash
npm run test:e2e               # 跑全部测试，行式输出
npm run test:e2e:headed        # 浏览器有头模式，肉眼看 UI
npm run test:e2e:ui            # Playwright UI Mode（断点 / 时间旅行）
npm run test:e2e:report        # 打开最近一次的 HTML 报告
```

只跑某个文件 / 某行：

```bash
npx playwright test tests/auth.spec.ts          # 单文件
npx playwright test tests/auth.spec.ts:62       # 单测试（按行号）
npx playwright test -g "logout"                 # 按标题过滤
```

跑前不需要手动启动 dev server——Playwright 的 `webServer` 配置会自动 `npm run dev`，跑完后停掉。

> 本地有 dev server 在 5173 / 3001 上运行时，请先关掉再跑测试。配置里 `reuseExistingServer: false` 强制每次都启新的，避免共享状态。

## 2. 测试目录与文件

```
tests/
├── global-setup.ts        # 跑一次：清 e2e.db、再跑 seed 灌入词表
├── fixtures.ts            # 自定义 `api` fixture，绕过 Vite 直接打 :3001
├── helpers.ts             # registerViaUi / loginViaUi / openUserMenu / uniqueUsername
├── auth.spec.ts           # 注册 / 登录 / 登出 / 路由守卫 / token 失效
└── learning.spec.ts       # 学习进度统计 + 用户隔离
```

测试默认串行（`workers: 1`、`fullyParallel: false`），原因是后端是单一 SQLite 文件，并发写会冲突。每个测试通过 `uniqueUsername()` 制造独立账号，互相不串。

## 3. 数据库隔离与 seed

```ts
// playwright.config.ts
const E2E_DB = resolve(__dirname, 'server/data/e2e.db')
webServer.env.DB_PATH = E2E_DB
```

后端的 `db.ts` 读 `process.env.DB_PATH` 决定数据库位置，所以 E2E 跑的是**独立的** `e2e.db`，与开发期的 `app.db` 互不影响。

`globalSetup` 流程：

1. 删 `server/data/e2e.db` / `e2e.db-shm` / `e2e.db-wal`
2. 调 `tsx server/src/scripts/seed.ts <项目根>/src/data/上海高考英语词汇表.md`，并以 `DB_PATH` 指向 e2e.db
3. seed 脚本 `import` 触发 db.ts 的 migration，再把词条灌进去

随后 `webServer` 启动 dev server，连同样的 e2e.db。

> ⚠️ 不要把 `reuseExistingServer` 改回 `true`。如果一台老的 dev server 还活着，它在用文件锁打开的是被删掉的 inode；新 globalSetup 写出来的 e2e.db 是另一个 inode，老 server 看不到新数据，于是 `/api/words` 永远返回 0 行——直接表现为「flashcards 页空白」。

## 4. 测试覆盖

### `auth.spec.ts`（8 个）
- 匿名访问首页正常（顶部显示「登录」按钮、hero CTA 是「登录开始练习」），但访问 `/flashcards` 等保护页时被踢到 `/login`
- 注册成功落到首页，问候语包含用户名，CTA 切换为「开始今天的练习」
- 短密码注册显示「密码至少 6 位」
- 重复用户名返回 409，UI 显示「用户名已被占用」
- 错误密码登录显示「用户名或密码错误」
- token 持久化：刷新仍登录；匿名访问保护页 → `/login` → 登录后回到原页面
- 退出登录后留在首页（匿名态），保护页才会再次跳 `/login`
- 篡改 token 后刷新自动降级为匿名（首页仍可见），保护页跳登录

### `learning.spec.ts`（3 个）
- 登录后单词卡页正常加载（不卡在加载占位上）
- 通过 API 把 word #1 标记为 seen+known，`/api/stats` 数字递增，首页 UI 同步
- 用户 A 的进度对用户 B 不可见（隔离性）

## 5. 写新测试的清单

1. 文件放 `tests/<feature>.spec.ts`。
2. 共用动作（注册、登录、打开用户菜单）抽到 `helpers.ts`，不要在每个测试里重复 UI 操作。
3. 需要直接打 API 时（绕过浏览器），import `expect, test from './fixtures'`，用 `api` fixture——它直连 `127.0.0.1:3001`，不走 Vite。
4. 新建账户用 `uniqueUsername()`，否则跨测试 / 跨重试会撞「用户名已被占用」。
5. URL 断言**不要**用形如 `/(?!login).*$/` 的负向回顾——它会被 `http://` 里的 `//` 命中导致假阳性。该用 `await expect(page).not.toHaveURL(/\/login(?:[?#].*)?$/)`。
6. 选择器优先 `getByRole / getByLabel / getByText`，少用纯 CSS / XPath；DOM 改名时基于语义的选择器更稳。
7. 涉及网络等待用 `await expect(locator).toBeVisible()`（带 timeout）或 `await page.waitForResponse(...)`，不要 `page.waitForTimeout(...)`。

## 6. 调试失败用例

- `npx playwright test --debug` —— Inspector，单步 + 选择器选择器调试
- `npx playwright test --ui` —— UI Mode，时间旅行 + watch 改动重跑
- `npx playwright show-report` —— 看上一次 HTML 报告（含截图、视频、trace）
- 失败重跑：测试默认在 CI 重试 1 次（`retries: 1`），本地 0 次。某个测试天然 flaky 时，**先修测试或代码，不要靠 retries 掩盖**。

trace / 截图 / 视频在失败时自动收集到 `test-results/`，CI 会 upload 成 artifact。

## 7. CI 流水线

工作流文件：`.github/workflows/ci.yml`

触发条件：

- `push` 到 `main`
- `pull_request` 指向 `main`
- 手动 `workflow_dispatch`

流水线步骤（单 job `build-and-test`，Ubuntu 最新版）：

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node 20** — 同时缓存根 + 服务端的 npm
3. **`npm ci`** — 根目录与 `server/`
4. **`npm run build`** — 类型检查 + Vite 打包
5. **`npm run build`（server）** — `tsc` 编译后端
6. **缓存 Playwright 浏览器** — key 基于 `package-lock.json` 哈希，命中时直接复用
7. **安装 Chromium** — 缓存命中时只装系统依赖（`install-deps`），未命中时完整 `install --with-deps`
8. **`npm run test:e2e`** — 在 CI 模式跑（`forbidOnly: true, retries: 1, workers: 1`）
9. **失败时 upload artifact** — `playwright-report/` + `test-results/`，保留 7 天

CI 默认运行**所有**测试。失败的 trace 可以下载到本地用 `npx playwright show-trace <path>` 查看完整时间线。

`concurrency` 配置：同一分支多次推送会取消前面的运行，避免排队浪费。

## 8. CD（部署）

> 当前仓库还没接部署目标。CI 只做「合并前的质量门禁」。

要加部署时建议在 `ci.yml` 的 build-and-test 之后串一个 `deploy` job：

```yaml
deploy:
  needs: build-and-test
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: npm }
    - run: npm ci && npm run build
    - run: npm --prefix server ci && npm --prefix server run build
    # 然后按目标平台推送 dist/ 与 server/dist/
```

具体目标（Vercel / Cloudflare Pages / 自建 VPS）按需要再补。

## 9. FAQ

**Q: 测试一直卡在「Timed out waiting … from config.webServer」？**
A: 前一个 dev server 没退干净。`ps aux | grep -E "vite|tsx"`，把残留进程 kill 掉。

**Q: 本地通过、CI 失败？**
A: 先看 CI artifact 里的 `test-results/<name>/error-context.md` 和 `trace.zip`。常见原因：依赖版本飘移（lockfile 没提交）、字体差异让选择器失败（用语义选择器避免）、CI 慢导致某些超时。

**Q: 想加更多浏览器（Firefox / WebKit）？**
A: `playwright.config.ts` 的 `projects` 里加；并在 CI 改 `npx playwright install --with-deps`（去掉 `chromium` 参数）。注意 CI 时长会显著拉长。

**Q: 想跑得更快？**
A: 测试串行是 SQLite 写入瓶颈。要并行的话：(1) 给每个 test 开独立 DB 文件（`worker-scoped fixture`），(2) 把 `workers > 1`、`fullyParallel: true`。改造工作量不小，目前 8 秒跑完 11 个测试，没必要。
