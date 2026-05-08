# 服务端设计文档

> Fastify + better-sqlite3 + Zod，单进程本地服务。所有业务数据存在一个 SQLite 文件里，无外部依赖。

## 1. 目录结构

```
server/
├── data/
│   └── app.db                    # SQLite 数据库（含 WAL）
├── src/
│   ├── index.ts                  # Fastify 入口、错误处理、路由注册
│   ├── env.ts                    # 自带 .env loader（先于其它模块加载）
│   ├── db.ts                     # 数据库连接 + 顺序迁移
│   ├── auth.ts                   # 密码哈希 / 会话查询 / onRequest 鉴权钩子
│   ├── routes/
│   │   ├── auth.ts               # 注册 / 登录 / 登出 / me
│   │   ├── words.ts              # 词条 CRUD
│   │   ├── progress.ts           # 学习进度 + 统计
│   │   └── ai.ts                 # 代理到 Google Gemini 的 AI 评价端点
│   └── scripts/
│       ├── seed.ts               # 从 .md 词表导入
│       └── enrich.ts             # 用 AI 补全 IPA / 例句
├── .env / .env.example           # 项目级配置（GEMINI_API_KEY 等）
├── package.json
└── tsconfig.json
```

启动：`npm run dev`（开发，tsx watch） / `npm run build && npm start`（生产）。
默认监听 `127.0.0.1:3001`，`PORT`、`HOST`、`DB_PATH`、`GEMINI_API_KEY`、`GEMINI_MODEL` 通过环境变量或 `.env` 覆盖（详见 §13）。

## 2. 启动流程

`src/index.ts`：

1. `import './env.js'` —— **必须最早**：从 `server/.env` 读 `GEMINI_API_KEY` 等，写入 `process.env`（已显式设置的不覆盖）。
2. `import './db.js'` — 副作用：打开 SQLite，启用 WAL 与外键，**同步**跑迁移。
3. 注册 `@fastify/cors`（`origin: true, credentials: true`）。
4. `setErrorHandler` 全局拦截 `ZodError` → `400 invalid input`，其它错误交给 Fastify 默认处理。
5. `registerAuthHook(app)` — `onRequest` 钩子，对非 public 路径校验 Bearer token，附 `req.userId / req.user`。
6. 注册 `authRoutes / wordsRoutes / progressRoutes / aiRoutes`，最后挂 `GET /api/health`。

钩子顺序很重要：错误处理器先装，鉴权钩子再装，业务路由最后注册。Fastify 的 `onRequest` 钩子只对**之后**注册的路由生效，所以 auth 路由本身也会经过钩子，但被 `PUBLIC_PREFIXES` 白名单跳过。

## 3. 数据库与迁移

### 3.1 连接

```ts
db.pragma('journal_mode = WAL')   // 并发读取友好
db.pragma('foreign_keys = ON')    // 但 user_id 关联保持松散，见下
```

### 3.2 迁移机制

`MIGRATIONS: string[]` 是一个**有序、追加**的数组，每个元素是一段 SQL（可包含多条语句）。版本号由数组下标决定，存在 `schema_version` 表里。

```ts
function migrate() {
  db.exec(MIGRATIONS[0])                 // 永远先建 schema_version
  const start = currentVersion()         // 当前已应用到第几个
  const tx = db.transaction(() => {
    for (let i = start; i < MIGRATIONS.length; i++) {
      db.exec(MIGRATIONS[i])
      db.prepare('INSERT OR REPLACE INTO schema_version(version) VALUES (?)').run(i + 1)
    }
  })
  tx()
}
```

**约束**：

- 已上线的迁移**不能修改**。要变更 schema，永远在数组末尾追加。
- 单条迁移写成幂等（`IF NOT EXISTS`，或先检查再变更），便于失败重试。
- 涉及 `INSERT … SELECT` 的数据搬迁，使用 `INSERT OR IGNORE` 防止重复执行触发主键冲突。

### 3.3 表结构

| 表 | 主键 | 用途 |
|---|---|---|
| `users` | `id` (AUTOINCREMENT) | 账号：`username`、`display_name`、`password_hash`、`password_salt`、`created_at` |
| `sessions` | `token` | 长期登录令牌，`user_id`、`expires_at`；外键级联删除 |
| `words` | `id` | 词条内容（与用户无关），`UNIQUE(word, is_phrase)` |
| `flashcard_progress` | `(user_id, word_id)` | 每个用户对每个词的 SRS 状态 |
| `reading_results` | `id` | 阅读测验结果，按 `(user_id, taken_at DESC)` 索引 |
| `essay_drafts` | `(user_id, week)` | 周作文草稿与反馈 |
| `settings` | `(user_id, key)` | 用户偏好（apiKey / voice / rate）|

**为什么用户关联表**没有声明 FK 到 `users`？因为迁移阶段会把历史数据归到 `user_id = 1`，而当时还没有任何用户行。把 user_id 当成普通整数列，应用层在写入前已经通过 `req.userId` 拿到一个真实存在的用户 id，绕开这个鸡生蛋的问题。代价是用户被删除时孤儿数据需要应用层显式清理（目前没做，因为没有删用户的接口）。

`words.id` 是稳定的稀有资源——前端用它当 flashcard 的 key、统计的分组键，所以不要随意重排或重置。

### 3.4 历史迁移摘要

- v1–v9：词条、SRS、阅读、作文、设置的初始 schema。
- v10：`users`。
- v11：`sessions` + 索引。
- v12：把 `flashcard_progress` 的主键从 `word_id` 改成 `(user_id, word_id)`，旧数据归到 `user_id=1`。
- v13：`reading_results` 加 `user_id` 列。
- v14：`essay_drafts` 主键改为 `(user_id, week)`。
- v15：`settings` 主键改为 `(user_id, key)`。

迁移 v12 / v14 / v15 用的是「建新表→搬数据→删旧表→重命名」的 SQLite 标准做法，因为 SQLite 不支持直接修改主键。

## 4. 鉴权

### 4.1 协议

无 Cookie，纯 `Authorization: Bearer <token>`。token 是 32 字节 hex 随机数，写入 `sessions.token`，TTL 30 天。

### 4.2 关键路径

- `POST /api/auth/register` —— 用户名 3–40 字符（`[A-Za-z0-9_.-]+`），密码 ≥6 位，重复用户名返 409。注册成功直接签发 token，省一次登录请求。
- `POST /api/auth/login` —— 使用单独的宽松 schema（`min(1)`），只校验非空，避免错密码触发 Zod 报 500；密码校验失败统一返 401。
- `POST /api/auth/logout` —— 从 `sessions` 删除当前 token，无 token 也返 204（幂等）。
- `GET /api/auth/me` —— 用 token 反查 `users`，前端启动时用它判断登录态。

### 4.3 密码哈希

`crypto.scryptSync(password, salt, 64)`。每个用户生成 16 字节随机盐，与 hash 都以 hex 存储。比较使用 `timingSafeEqual` 防时序攻击。`SCRYPT_KEYLEN = 64` 写死。

### 4.4 会话钩子

`registerAuthHook(app)` 装一个 `onRequest`：

```ts
const url = req.url.split('?')[0]
if (!url.startsWith('/api/')) return            // 静态资源不管
if (isPublic(req.method, url)) return           // /api/health, /api/auth/*, GET /api/words
const token = extractBearer(req.headers.authorization)
const user = lookupSession(token)
if (!user) return reply.code(401).send({ error: 'unauthenticated' })
req.userId = user.id
req.user = user
```

`isPublic(method, url)` 当前的白名单：

- `GET/POST/* /api/health`
- `GET/POST /api/auth/*`
- **`GET /api/words` 与 `GET /api/words/:id`** —— 词条是公共内容，匿名首页要展示「今日推荐」需要它；POST/PUT/DELETE 仍走鉴权（`/manage` 仍然受保护）。
- **`GET /api/ai/status`** —— 只回报 `{enabled, model}`，匿名 Home / 登录前的 Settings 都要展示这个开关。AI 调用本身（`POST /api/ai/*`）仍鉴权。

新增公共接口在这个函数里加分支。

`req.userId` 用 Fastify 的模块声明扩展进类型：

```ts
declare module 'fastify' {
  interface FastifyRequest {
    userId?: number
    user?: UserRow
  }
}
```

业务路由通过一个小辅助 `uid(req)` 拿到 number，把 `?` 抹掉——因为钩子保证了非 public 路径一定有值。

## 5. 业务路由

### 5.1 `/api/words`（words.ts）

词条是公共内容，**未按用户分**。但仍位于鉴权区，未登录拿不到。

- `GET /api/words?q=&level=&is_phrase=&page=&pageSize=` —— 列表，最大 pageSize 500。
- `GET /api/words/:id` —— 详情。
- `POST /api/words` —— 新建，重复 `(word, is_phrase)` 触发 SQLite UNIQUE，转 409。
- `PUT /api/words/:id` —— 部分字段更新。
- `DELETE /api/words/:id` —— 级联删除依赖该 id 的 `flashcard_progress`（FK ON DELETE CASCADE）。

### 5.2 `/api/flashcards`（progress.ts）

SRS 状态，桶位 0–4（Leitner-ish）。所有读写都按 `req.userId` 过滤：

```sql
SELECT * FROM flashcard_progress WHERE user_id = ?
INSERT … ON CONFLICT(user_id, word_id) DO UPDATE …
```

`PUT /api/flashcards/:wordId` 是 upsert，body 是 partial（任意字段缺省都接受），服务端把缺省字段填 0，再写回。

### 5.3 `/api/reading-results`

按用户保留最近 100 条结果。每次写入后会跑一个修剪：

```sql
DELETE FROM reading_results
WHERE user_id = ? AND id NOT IN (
  SELECT id FROM reading_results WHERE user_id = ? ORDER BY taken_at DESC LIMIT 100
)
```

### 5.4 `/api/essays/:week`

周作文草稿。`feedback` 是任意 JSON（来自前端 AI 调用结果，目前是 Gemini），存为字符串。

### 5.5 `/api/settings`

KV 字典。`PUT` body 是 `Record<string, unknown>`，每个 value 序列化后单独 upsert，用 transaction 保证一致。前端的 `AppSettings`（apiKey / voice / rate）落到三个 key 上。

### 5.6 `/api/stats`

只读聚合，单次返回首页所需的全部进度信息：

```ts
{
  totalWords:      number,                     // words 表的总条数
  seenWords:       number,                     // flashcard_progress.seen > 0
  knownWords:      number,                     // bucket >= 3
  masteredWords:   number,                     // bucket = 4
  byLevel: [
    { level, total, seen, known }, …           // 按 words.level 分组（LEFT JOIN）
  ],
  essayCount:      number,
  reading:         { attempts, correct, total }
}
```

`byLevel` 用 `LEFT JOIN flashcard_progress fp ON fp.word_id = w.id AND fp.user_id = ?`——把 user_id 写进 ON 条件，是为了让没有进度的等级也能返回 `seen=0`。如果写在 WHERE 里会过滤掉这些行。

### 5.7 `/api/ai/*`（ai.ts）

代理 Google Gemini，用项目级 API key（不让浏览器接触密钥）。免费层默认模型 `gemini-2.5-flash`。

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `GET  /api/ai/status` | 公开 | `{ enabled: !!GEMINI_API_KEY, model }`，前端用来切「AI 已就绪 / 未配置」UI |
| `POST /api/ai/sentence` | 需登录 | 单词卡造句评分 |
| `POST /api/ai/conversation` | 需登录 | 口语 Turn 评分 |
| `POST /api/ai/reading` | 需登录 | 阅读题中文讲解，纯文本回 `{ explanation }` |
| `POST /api/ai/essay` | 需登录 | 周作文 4 维评分 + 优化稿 |

实现要点（在 `routes/ai.ts`）：

- 每个 POST 端点先看 `process.env.GEMINI_API_KEY`，缺失返回 `503 ai-not-configured`，让前端走 heuristic 兜底。
- Gemini 通过 `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` 调，鉴权用 `x-goog-api-key` 头。
- JSON 类输出走 `generationConfig.responseMimeType = 'application/json'`；解析仍用 `extractJson`（剥可能的 fence）防御。
- 每个端点 Zod 校验 body shape，用例失败由全局 errorHandler 转 `400 invalid input`。

## 6. 输入校验

所有 body / query / params 都过 Zod。错误行为：

- 业务错误（用户名占用、密码错）—— 返回明确的 4xx。
- Zod 解析失败 —— 全局 errorHandler 拦截转 400，body 形如：

```json
{ "error": "invalid input", "issues": [{ "path": ["password"], "message": "…" }] }
```

不要在 handler 里 `try/catch` Zod —— 让它冒泡到全局处理。

## 7. 错误与日志

Fastify logger 默认输出 JSON 结构化日志。500 会带完整 err 信息（含 stack），生产部署时不要把 logger 关掉，但要确保日志文件不外泄（含 token / 哈希时只打印长度，不打印明文）。

目前没接 metrics / tracing。若要扩展，建议在 `index.ts` 装 `onResponse` 钩子统一记录 `req.userId` + 路径 + 时延。

## 8. 添加新接口的清单

1. 决定是否需要登录：默认需要；只读元数据可以加到 `PUBLIC_PREFIXES`。
2. 决定是否按用户分：用户产生的数据 **一律**带 `user_id`，并在 schema 用 `(user_id, …)` 复合主键。
3. 写 Zod schema 校验 body / query / params。
4. 用 `req.userId`（保证非 public 路径下非空）。
5. 在 `index.ts` 注册路由。
6. 如果改了表结构，**追加**一条迁移到 `MIGRATIONS`。

## 9. 数据备份与重置

- 备份：`cp server/data/app.db /somewhere`，建议先 `db.pragma('wal_checkpoint(FULL)')` 但 Node 进程退出时会自动 checkpoint，多数情况直接 cp 也安全。
- 重置：删 `server/data/app.db*`，下次启动迁移会从 v0 重跑，`scripts/seed.ts` 可重新导入词表。

## 10. 配置文件 / 环境变量

`server/src/env.ts` 在启动最开始读 `server/.env`，把里面的 KV 写入 `process.env`（**已显式设置的不覆盖**）。这样：

- 开发：`cp server/.env.example server/.env`，填值即可。
- 生产 / CI：用 systemd `Environment=` 或 `gh-actions` secrets 覆盖文件值。

支持的键：

| 键 | 默认 | 说明 |
|---|---|---|
| `GEMINI_API_KEY` | (空) | 项目级 Gemini key；缺失时所有 `/api/ai/*` 回 503，前端走本地 heuristic |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 想换 Pro 或新模型时改这一项 |
| `DB_PATH` | `server/data/app.db` | SQLite 文件路径；E2E 用独立 `e2e.db` |
| `HOST` | `127.0.0.1` | Fastify 监听地址 |
| `PORT` | `3001` | Fastify 端口 |

`.env` **不进 git**（`server/.gitignore` 已加规则）。`.env.example` 提交，作为字段说明的"事实文档"。
