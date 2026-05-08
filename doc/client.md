# 客户端设计文档

> Vite + React 18 + TypeScript + Tailwind + react-router-dom v6。单页应用，与 `/api/*` 后端解耦，开发期靠 Vite proxy 转发。

## 1. 目录结构

```
src/
├── main.tsx                      # ReactDOM 根，包 AuthProvider + BrowserRouter
├── App.tsx                       # 路由：/login 公开，其它走 RequireAuth + Layout
├── index.css                     # Tailwind 入口 + 一些自定义 CSS 变量
├── components/
│   ├── Layout.tsx                # 顶部 nav + 用户菜单 + 移动端底栏
│   ├── RequireAuth.tsx           # 路由守卫
│   ├── Button.tsx / Card.tsx / Spinner.tsx / Icon.tsx / PageHeader.tsx
├── pages/
│   ├── Login.tsx                 # 登录 / 注册（切换 mode）
│   ├── Home.tsx                  # 首页：欢迎 + 进度统计 + 模块入口
│   ├── Flashcards.tsx            # 单词卡 + 朗读 + AI 造句评价
│   ├── Conversation.tsx          # 情景对话 + 录音识别
│   ├── Reading.tsx               # 阅读理解 + 自动判分
│   ├── Essay.tsx                 # 周作文 + AI 评分
│   ├── Manage.tsx                # 词条 CRUD
│   └── Settings.tsx              # AI 状态显示 + 语音偏好（自动保存）
├── lib/
│   ├── api.ts                    # fetch 封装、token、各业务 API
│   ├── auth.tsx                  # AuthProvider / useAuth context
│   ├── storage.ts                # 内存缓存 + 订阅 + hydrate / reset
│   ├── useWords.ts               # 词条列表 hook（带分页 / 搜索）
│   ├── ai.ts                     # `/api/ai/*` 客户端（heuristic 兜底）；状态缓存
│   └── speech.ts                 # Web Speech API（TTS / STT）
├── data/                         # 静态内容（阅读篇章、对话场景、作文题、词表 .md）
└── types/index.ts                # 跨模块共享类型
```

## 2. 启动与渲染入口

`main.tsx`：

```tsx
ReactDOM.createRoot(...).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

数据**不在 main.tsx 里 hydrate**——交给 `AuthProvider` 在拿到登录态后再触发 `hydrate()`。这样未登录时不会发出会被 401 的请求，控制台干净。

## 3. 路由结构

```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<Layout />}>
    <Route index element={<Home />} />            {/* 公开 */}
    <Route element={<RequireAuth />}>             {/* 需要登录 */}
      <Route path="flashcards" element={<Flashcards />} />
      <Route path="conversation" element={<Conversation />} />
      <Route path="reading" element={<Reading />} />
      <Route path="essay" element={<Essay />} />
      <Route path="manage" element={<Manage />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Route>
</Routes>
```

三层 layout-route：

- `Layout` 始终渲染（顶部 nav、用户菜单 / 登录按钮、`<Outlet />`）。
- 首页 `/` 公开，匿名用户能看到 hero、模块入口、今日推荐与本周话题等内容；进度区域换成「登录后这里会出现你的学习进度」提示。
- 其它路径包在 `RequireAuth` 里，匿名访问会 `<Navigate to="/login" state={{ from: location }} />`，登录成功后 `Login` 用 `Navigate` 跳回 `from.pathname`。
- `/login` 在 Layout 之外，自带居中卡片版式。

## 4. 网络层（`lib/api.ts`）

### 4.1 token 存储

token 走 `localStorage[english.auth.token]`。模块内有个内存变量 `authToken` 缓存，避免每次请求都读 localStorage。

```ts
export function getAuthToken(): string | null
export function setAuthToken(token: string | null): void
```

`setAuthToken(null)` 会同步清掉 localStorage。

### 4.2 请求封装

`request<T>(path, init)`：

1. 自动塞 `Content-Type: application/json` 与 `Authorization: Bearer <token>`。
2. **遇到 401** → 调 `setAuthToken(null)` 并触发所有 `onUnauthorized` 监听。
3. 非 2xx 抛 `ApiError`（带 `status`），让上层能区分 401 / 409 / 400。
4. 204 返回 `undefined as T`，其余 `await res.json()`。

`onUnauthorized(fn)` 注册全局回调，`AuthProvider` 用它在任何地方收到 401 时把用户踢回登录页。

### 4.3 业务 API 对象

| 名称 | 说明 |
|---|---|
| `wordsApi` | 词条 list/create/update/remove，附 `rawToVocab` 把后端字段映射到 `VocabWord` |
| `flashcardsApi` | SRS 进度 all/put |
| `readingApi` | 阅读结果 list/add |
| `essaysApi` | 作文 all/put |
| `settingsApi` | 用户偏好 get/put |
| `authApi` | register/login/logout/me |
| `statsApi` | `/api/stats` 单次聚合查询 |

字段命名约定：后端 snake_case 在 API 模块里转换成前端 camelCase（例如 `word_id` → `wordId`）。组件层只看到 camelCase。

## 5. 鉴权（`lib/auth.tsx`）

### 5.1 状态机

```
loading  ─┬─ 有 token：调 /api/auth/me
          │      ├─ 成功 → authenticated（之后 hydrate）
          │      └─ 失败 → anonymous（清 token）
          └─ 无 token → anonymous
```

`status: 'loading' | 'anonymous' | 'authenticated'` 是 `RequireAuth` 渲染分支的依据。loading 时显示 Spinner，anonymous 重定向，authenticated 渲染子树。

### 5.2 入口动作

```ts
login(username, password)        // POST /api/auth/login → setAuthToken → hydrate → 设置 user
register(username, password, displayName?)
logout()                         // POST /api/auth/logout（错也吃掉）→ resetCaches → anonymous
```

`finishAuth` 是登录 / 注册成功后的统一收尾：写 token、`hydrate()`、置状态。`hydrate` 是可重入的，所以多次登录切账号也安全。

### 5.3 与全局 401 联动

`useEffect(() => onUnauthorized(() => clearAuth()), …)`。任何请求拿到 401（例如 token 过期、被另一处删了 session），整个 app 立即回到 anonymous，路由守卫接管。

## 6. 客户端缓存（`lib/storage.ts`）

应用启动后业务数据存在四个**模块级变量**里：

```ts
settingsCache: AppSettings
flashcardCache: Record<string, FlashcardProgress>
readingCache: ReadingResult[]
essayCache: Record<number, EssayDraft>
```

它们只在两种情况下变：

1. `hydrate()` —— 登录成功后并发拉四个 GET 接口，覆盖缓存，`notify()` 通知所有订阅者。
2. 各 `*Store.update / add / upsert` —— 写本地缓存的同时**乐观地**调对应的 `*Api.put`。失败仅打 console.error，不回滚（个人学习应用，离线优先）。

### 6.1 订阅模式

```ts
subscribe(fn): () => void
```

组件用 `useEffect(() => subscribe(() => setTick((t) => t + 1)), [])` 订阅，缓存变化就重渲染。同时为兼容老代码会 `dispatchEvent(new StorageEvent('storage'))`，不要再写新订阅依赖这个事件。

### 6.2 `resetCaches()`

退出登录时调用，把四个缓存清回默认值并 `notify()`。**不要**只清 token 不清缓存，否则下一个用户登录前那一帧会看到上一个用户的数据。

### 6.3 `useWords`

词条列表是 server-paginated，没有进缓存。`useWords({ q, level, is_phrase, page, pageSize })` 是带 cancel 的 fetch hook，返回 `{ words, total, loading, error, refresh }`。

## 7. UI 体系

### 7.1 设计语言

- Tailwind 主题在 `tailwind.config.js` 定义了 `accent / accent-soft / accent-hover`、`ink-*`（文字灰阶）、`surface / surface-alt / line / line-soft` 等语义色，圆角 `xl / xl2 / 3xl2`、阴影 `card`、缓动 `ease-apple`。
- 所有按钮走 `<Button variant size>`，所有卡片走 `<Card padded elevated>`，图标走 `<Icon name>`（内置一组 SVG）。
- 不要直接写颜色字面量（`#0071e3` 之类），用 Tailwind 类引用主题变量。

### 7.2 Layout

`Layout.tsx` 渲染：

- 顶部 sticky 玻璃栏：logo / 桌面 nav / 用户头像下拉（昵称 / 用户名 / 退出登录）。
- 主体最大 `max-w-6xl`，每次路由切换 `key={pathname}` 触发 fade-in。
- 移动端底部固定 7 列 nav。

用户菜单展开用 `useState` 控制，`onBlur` 配合 `setTimeout(120)` 让点击菜单项的 `onMouseDown` 有机会触发。

## 8. 页面与数据流

| 页面 | 主要数据 | 说明 |
|---|---|---|
| Home | `statsApi.get()` + 本地缓存 | 服务端的 `/api/stats` 是真值；如果还没回来用本地缓存先渲染，避免闪烁。 |
| Flashcards | `useWords` + `flashcardStore` + `ai.evaluateSentence` | 用 `wordId` 作为 SRS key，所以每张卡片更新都精确到一行 DB |
| Conversation | 静态情景 + `ai.evaluateConversationTurn` + `speech.recognize` | 录音识别仅本地浏览器 API |
| Reading | 静态篇章 + `readingStore.add` + `ai.explainReading` | 提交后调 POST，服务端只保留最近 100 条 |
| Essay | `essayStore.upsert` + `ai.gradeEssay` | 草稿与反馈都按 week 落库 |
| Manage | `useWords` + `wordsApi.create / update / remove` | 后台管理界面 |
| Settings | `settingsStore.set` + `aiApi.status` | voice / rate 自动保存（select 立刻、slider 350ms 防抖）；API key 已迁到服务端，本页只显示状态。 |
| Login | `useAuth().login / register` | 唯一不在 `RequireAuth` 内的页面 |

## 9. AI 与浏览器能力

### 9.1 `lib/ai.ts`

**前端不再持有 API key**。所有 AI 评价都走自家后端代理 `/api/ai/*`，由服务端用 `server/.env` 的 `GEMINI_API_KEY` 调 Gemini。文件本身只是一层薄客户端 + 兜底。

- `getAiEnabled()` —— 模块级 Promise 缓存，命中 `/api/ai/status`（公开端点，匿名也能读）。Home / Settings 都用它切「AI 已就绪 / 暂未启用」。`clearAiStatusCache()` 留给未来的"管理员切模型后立刻刷新"用。
- 四个评价函数（`evaluateSentence` / `evaluateConversationTurn` / `explainReading` / `gradeEssay`）调对应的 `/api/ai/<topic>`，**任何**异常（503、网络错、字段缺失）都走 `heuristic*` 兜底，保证 UI 不会因 AI 故障卡死。
- 服务端缺 `GEMINI_API_KEY` → 端点回 `503`；前端按统一异常路径退化。换模型只在 `server/.env` 改 `GEMINI_MODEL`，前端无需改动。

### 9.2 `lib/speech.ts`

封装 `window.speechSynthesis` 与 `webkitSpeechRecognition`。任何浏览器不支持的特性都返回 no-op，不会抛错。声音与语速从 `settingsStore` 读取。

## 10. 添加新页面 / 新数据的清单

1. 是否需要登录？默认需要——直接放到 `App.tsx` 内层 `<Routes>`。
2. 数据来源：
   - 后端 + 用户隔离 → 在 `lib/api.ts` 加一个 `*Api`，在 `lib/storage.ts` 加缓存 + 订阅，并把首次拉取塞进 `hydrate()`。
   - 静态内容 → 放 `src/data/`，直接 import。
3. UI 用 `Card` / `Button` / `Icon`，颜色用主题类。
4. 路由切换若需要全局通知缓存变化，确保订阅 `subscribe(fn)`，不要监听 window storage。
5. 涉及 AI 的，新增函数放 `lib/ai.ts` 并配一个 `heuristic*` 退化版本。

## 11. 开发与构建

```
npm run dev              # 同时起 Vite (5173) + 后端 (3001)
npm run dev:web          # 只起前端
npm run dev:api          # 只起后端
npm run build            # tsc 类型检查 + vite 打包到 dist/
npm run preview          # 预览生产产物
```

`vite.config.ts` 只做一件关键事：`/api` 反代到 `127.0.0.1:3001`。生产部署需要在前置反代（nginx 等）保留这一规则，否则前端会找不到 API。

## 12. 已知约束

- token 存 localStorage：和 cookie 各有取舍，目前选这条避免 CSRF / SameSite 配置；XSS 时 token 会泄露。Gemini API key 不再放浏览器（已挪到 server/.env），把"可被 XSS 偷"的范围缩到"会话 token + 用户进度"。
- 全局缓存是单例，多 tab 不会互相同步。多 tab 编辑同一份 essay 草稿会出现后写覆盖——目前可接受。
- `useWords` 没有 SWR 风格的去重 / 缓存，组件挂载就发请求；高频列表页要么自己加 memo，要么把它改成订阅型缓存。
