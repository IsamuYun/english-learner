# 部署指南

把项目从本地推到 GitHub，再部署到一台 Linux 服务器（以 Ubuntu 22.04 为例）。架构：

```
浏览器 ──HTTPS──▶ Nginx ──┬─▶ /          静态文件 (Vite build, /var/www/english-learner)
                         └─▶ /api/*     反向代理到 Fastify (127.0.0.1:3001)
                                          ├── better-sqlite3 → /var/lib/english-learner/app.db
                                          │     · words           （公共内容，匿名首页可读）
                                          │     · users / sessions（账号 + Bearer token）
                                          │     · per-user 进度    （flashcards / reading / essays / settings）
                                          └── Gemini Free Tier  ←  GEMINI_API_KEY (server/.env)
                                              （AI 评价代理，前端不持有 key）
```

后端进程由 **systemd** 守护（也可改用 pm2，最后附备选）。匿名访问首页可见；进入 `/flashcards`、`/conversation` 等练习页面时才需要登录，未登录会自动跳到 `/login`。AI 句子点评、口语反馈、阅读讲解、作文批改都通过后端代理调用 Google Gemini，**API key 集中在服务端 `.env`**，所有用户共享同一个 key。

> **从无鉴权旧版本升级？** 直接 pull + 重启即可。第一次启动时迁移会自动跑：旧的 `flashcard_progress` / `reading_results` / `essay_drafts` / `settings` 都会被打上 `user_id = 1`。**第一个**通过 UI 注册的账号 id 自然就是 1，会"继承"历史进度。详见第 11 节。

---

## 0. 前置假设

- 你已注册 GitHub 账号，已在远端服务器有一个用户（下面用 `deploy` 举例）能 sudo
- 服务器有公网 IP 或域名（以下用 `example.com` 举例）
- 本地终端已能 `git push` 到 GitHub（SSH key 已配置）

---

## 1. 本地：初始化 Git 并推到 GitHub

```bash
cd /Users/isamu/Projects/React/english-learner

git init
git add .
git status            # 确认 node_modules / *.db / playwright-report / test-results 都没被加入
git commit -m "init: shanghai gaokao english learner"
```

在 GitHub 网页新建一个空仓库，比如 `english-learner`（**不要** 勾选 README/.gitignore，避免冲突），拿到 SSH 地址：

```bash
git remote add origin git@github.com:<your-username>/english-learner.git
git branch -M main
git push -u origin main
```

> 词汇 markdown 文件 `src/data/上海高考英语词汇表.md` 是源数据，**会跟着 git 一起上传**。
> 数据库 `server/data/*.db`、Playwright 制品 `playwright-report/` / `test-results/` 都被 `.gitignore` 排除，需要在服务器上重新 seed。

推上去后，`.github/workflows/ci.yml` 会在每次 push / PR 自动跑构建 + Playwright 端到端测试，详见第 12 节。

---

## 2. 服务器：基础环境

SSH 到服务器：

```bash
ssh deploy@example.com
```

安装 Node.js 20（NodeSource 一行装好）+ 编译 better-sqlite3 用的 build 工具 + Nginx：

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3

# Nginx
sudo apt-get install -y nginx

# 验证
node --version    # v20.x
npm --version
```

---

## 3. 服务器：拉代码并安装依赖

```bash
sudo mkdir -p /opt/english-learner
sudo chown $USER:$USER /opt/english-learner
cd /opt/english-learner

git clone git@github.com:<your-username>/english-learner.git .
# 如果服务器没配 GitHub SSH key，可以先用 https：
# git clone https://github.com/<your-username>/english-learner.git .

# 装前端依赖（包含 @playwright/test 的话本地体积稍大，CI 跑测试不需要在服务器执行）
npm install

# 装后端依赖（会编译 better-sqlite3 native 模块）
npm --prefix server install
```

> 服务器**不需要**执行测试，也不需要安装 Playwright 浏览器；测试只在 CI 跑。

---

## 3.5 服务器：配置 `.env`（Gemini API key 等）

`server/.env.example` 是模板。在服务器上：

```bash
cd /opt/english-learner/server
cp .env.example .env
# 在 https://aistudio.google.com/app/apikey 申请免费 key 后填入
$EDITOR .env       # GEMINI_API_KEY=AIzaSyXXXX...
```

最少只需要 `GEMINI_API_KEY` 一项；其它都有默认值（详见 `doc/server.md` §10）。

```env
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXX
# GEMINI_MODEL=gemini-2.5-flash      # 默认就行
# DB_PATH=/var/lib/english-learner/app.db   # 由 systemd 覆盖，这里不填也行
```

> **`.env` 不进 git**（`server/.gitignore` 已排除）。systemd `Environment=` 会**覆盖**文件里的同名键，生产建议把 `DB_PATH` 等基础设施变量放 systemd unit 里，把 `GEMINI_API_KEY` 这种纯密钥放 `.env`，分层清晰。
>
> 没填 key 也能跑——所有 `/api/ai/*` 会回 503，前端自动退到本地启发式反馈，应用其它功能不受影响。事后任何时候编辑 `.env` 然后 `sudo systemctl restart english-learner` 即可启用。

---

## 4. 服务器：建库 & 灌数据

把 SQLite 数据库放到 `/var/lib/english-learner/`（生产数据目录，与代码分离）：

```bash
sudo mkdir -p /var/lib/english-learner
sudo chown $USER:$USER /var/lib/english-learner

# 用 DB_PATH 环境变量指定数据库位置，跑 seed
DB_PATH=/var/lib/english-learner/app.db npm --prefix server run seed
# 应输出：parsed 688 words + 521 phrases (1209 total) / inserted 1198 ...

# (可选) 调免费字典 API 补 IPA + 例句，约 5-10 分钟
DB_PATH=/var/lib/english-learner/app.db npm --prefix server run enrich
```

seed 脚本启动时会**自动跑全部 schema 迁移**（创建 users、sessions、per-user 索引等），所以在空目录上一次执行就能拿到完整 schema + 词条。

---

## 5. 服务器：构建前后端

```bash
# 前端：tsc → vite build → dist/
npm run build

# 后端：tsc → server/dist/
npm --prefix server run build
```

把前端静态产物放到 Nginx 能读到的位置：

```bash
sudo mkdir -p /var/www/english-learner
sudo cp -r dist/* /var/www/english-learner/
```

---

## 6. 服务器：用 systemd 守护后端

新建 service 文件：

```bash
sudo tee /etc/systemd/system/english-learner.service > /dev/null <<'EOF'
[Unit]
Description=English Learner API
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/english-learner/server
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=127.0.0.1
Environment=DB_PATH=/var/lib/english-learner/app.db
# GEMINI_API_KEY 放 server/.env 即可（已被 env.ts 加载）。
# 如果你更习惯把它也写在 systemd，可以加一行：
# Environment=GEMINI_API_KEY=AIzaSy...
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

启动 + 开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now english-learner
sudo systemctl status english-learner   # 看到 active (running) 即可
curl http://127.0.0.1:3001/api/health   # 应返回 {"ok":true}
```

查看日志：

```bash
journalctl -u english-learner -f
```

> 鉴权使用基于 SQLite `sessions` 表的 Bearer token（30 天 TTL）。**不需要**额外配 secret/JWT key。token 是 32 字节随机 hex，直接存 DB。

---

## 7. 服务器：Nginx 反向代理

```bash
sudo tee /etc/nginx/sites-available/english-learner > /dev/null <<'EOF'
server {
    listen 80;
    server_name example.com;          # 改成你的域名或 _

    root /var/www/english-learner;
    index index.html;

    # 前端静态资源 + SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|woff2?|ttf|svg|png|jpg|jpeg|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/english-learner /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                       # 配置语法检查
sudo systemctl reload nginx
```

冒烟测试：

```bash
# 1. Health check 不需要鉴权
curl https://example.com/api/health
# {"ok":true}

# 2. /api/words GET 是公开的（首页要用），不带 token 也能拿数据
curl 'https://example.com/api/words?pageSize=1' | head -c 200

# 3. AI 状态（公开），确认 GEMINI_API_KEY 已生效
curl https://example.com/api/ai/status
# {"enabled":true,"model":"gemini-2.5-flash"}

# 4. 受保护接口在没有 token 时返 401
curl -i https://example.com/api/stats   # HTTP/1.1 401 Unauthenticated
```

打开浏览器访问 `http://example.com/`：

- 没登录也能看到首页（顶部有「登录」按钮，hero CTA 是「登录开始练习」）
- 点击 `/flashcards` 应跳到 `/login`，注册一个账号后回到原页面继续练习

---

## 8. （推荐）启用 HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

certbot 会自动改写 Nginx 配置加上 SSL，并设置自动续期。Token 存在浏览器 `localStorage`，**强烈建议生产环境只走 HTTPS**，否则 token 会以明文裸跑在网络上。

---

## 9. 后续更新流程

每次本地有改动 → push → 服务器拉取 + 重建 + 重启：

```bash
# 本地
git add . && git commit -m "..." && git push     # CI 会先跑测试，绿了再部署

# 服务器
cd /opt/english-learner
git pull

# 依赖如有变化
npm install
npm --prefix server install

# 重新构建
npm run build
sudo cp -r dist/* /var/www/english-learner/
npm --prefix server run build

# 重启后端（schema 迁移 + .env 都会重新加载）
sudo systemctl restart english-learner
sudo systemctl status english-learner
```

可以把上面这一坨写成 `scripts/deploy.sh`，以后一行 `./scripts/deploy.sh` 即可。

> 改了 `server/.env`（比如换 Gemini key 或模型）之后**必须** `sudo systemctl restart english-learner` —— `.env` 是启动时一次性读的。
> 升级版本不会触碰已存在的 `.env`，保留你的 key。

> 重启时 `db.ts` 会执行 `migrate()`，从 `schema_version` 表读到当前已应用的版本号，只跑新追加的迁移。所以发布**新增了表 / 列**的版本不需要任何额外步骤——重启就完成。

---

## 10. 数据备份

数据库就是一个文件，里面同时有词条内容和**所有用户的账号 / 进度 / 草稿**——务必备份。最简单的做法是 `cron` + `cp`：

```bash
sudo crontab -e
# 每天凌晨 3 点拷一份带日期的备份，保留 14 天
0 3 * * * cp /var/lib/english-learner/app.db /var/lib/english-learner/backup-$(date +\%Y\%m\%d).db && find /var/lib/english-learner/backup-*.db -mtime +14 -delete
```

> SQLite 在 WAL 模式下直接 `cp` 是安全的：`cp` 会抓到主 DB 的一致性快照（WAL 内未 checkpoint 的部分会随后续打开而重放）。要更稳妥可改用 `sqlite3 app.db ".backup backup.db"`。

恢复：停服务 → `cp backup-YYYYMMDD.db /var/lib/english-learner/app.db` → 删 `app.db-shm` / `app.db-wal` → 启服务。

---

## 11. 从无鉴权旧版本升级

适用：早先部署过的实例数据库里只有词条 + flashcard_progress（无 users 表）。

升级时**不需要导出数据**：

1. `git pull && npm install && npm --prefix server install` 同 §9。
2. `npm run build && npm --prefix server run build`、把新的 `dist/` 拷到 Nginx 目录。
3. `sudo systemctl restart english-learner` —— 启动时 `migrate()` 会做：
   - 创建 `users` 与 `sessions` 表；
   - 把旧 `flashcard_progress` 重建为 `(user_id, word_id)` 复合主键，**全部归到 `user_id = 1`**；
   - `reading_results` / `essay_drafts` / `settings` 同理增加 `user_id` 列，旧数据归到 `user_id = 1`。
4. 第一次访问时点「登录」→「注册一个」创建账号。**第一个被创建的用户 id 自然就是 1**，会无缝继承所有历史进度。后续注册的用户从空白开始。

如果你想保留多人共用同一个数据库的写法，请确保第一个注册的账号是你自己。

---

## 12. CI/CD（GitHub Actions）

仓库自带 `.github/workflows/ci.yml`：每次 `push`/`PR` 都会在 Ubuntu runner 上跑前后端构建 + Playwright 端到端测试，失败时上传 trace / 截图 / 视频作为 artifact。详见 `doc/testing.md`。

CI 目前只做"质量门禁"，不做部署。要让 main 合并后自动推到服务器，可在同一文件追加一个 deploy job（建议用 SSH key + GitHub Action `appleboy/ssh-action`）：

```yaml
deploy:
  needs: build-and-test
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: deploy
        key: ${{ secrets.DEPLOY_SSH_KEY }}
        script: |
          cd /opt/english-learner
          git pull --ff-only
          npm install
          npm --prefix server install
          npm run build
          sudo cp -r dist/* /var/www/english-learner/
          npm --prefix server run build
          sudo systemctl restart english-learner
```

需要在 GitHub 仓库 **Settings → Secrets and variables → Actions** 配置：

- `DEPLOY_HOST` —— 服务器域名 / IP
- `DEPLOY_SSH_KEY` —— 一个**只用于部署**的 SSH 私钥（在服务器 `~/.ssh/authorized_keys` 加对应公钥）

部署用户最好是非 root，并通过 sudoers 授予仅必要的命令免密（`/bin/cp -r dist/* /var/www/...`、`systemctl restart english-learner`），避免 CI 拿到大于必要的权限。

---

## 备选：用 pm2 替代 systemd

如果不想用 systemd：

```bash
sudo npm install -g pm2

cd /opt/english-learner/server
DB_PATH=/var/lib/english-learner/app.db PORT=3001 pm2 start dist/index.js --name english-learner
pm2 save
pm2 startup           # 跟着提示执行返回的那行 sudo 命令
```

操作：`pm2 logs english-learner` / `pm2 restart english-learner` / `pm2 stop english-learner`。

---

## 排错速查

| 现象 | 检查 |
|---|---|
| `502 Bad Gateway` | 后端没起：`sudo systemctl status english-learner` / `journalctl -u english-learner -f` |
| 前端能开但 `/api` 404 | Nginx `proxy_pass` 路径写错；`sudo nginx -t` 后 reload |
| `better-sqlite3` 报 `NODE_MODULE_VERSION mismatch` | 服务器和本地 Node 大版本不一致；删 `server/node_modules` 重 `npm --prefix server install` |
| seed 报 `database is locked` | 后端服务没停就跑 seed；`sudo systemctl stop english-learner` 后再 seed |
| 改了词条但前端没刷新 | 浏览器强刷（Cmd/Ctrl+Shift+R），或检查 Nginx 静态资源缓存策略 |
| 注册后立刻被踢回 `/login` | 前端时间和服务器时间差太大导致 token 看起来已过期；同步服务器 `timedatectl set-ntp true` |
| 任意 `/api/*` 都返 401 | Nginx 没透传 `Authorization` 头（本配置默认透传，但有自定义中间层时要核对） |
| 升级后老用户找不到自己的进度 | 需要"第一个注册的用户"才会继承 `user_id=1` 的历史数据；详见 §11 |
| Playwright CI 失败但本地通过 | 看 artifact 里的 `test-results/<name>/error-context.md` + `trace.zip`，多半是 lockfile 没提交或选择器对 CI 字体敏感 |
| Settings 页面 AI 显示「未配置」但 `.env` 里写了 key | 通常是没 restart：`sudo systemctl restart english-learner`；或者 `.env` 在错的目录（应在 `server/.env`，不在仓库根） |
| `/api/ai/sentence` 等返 503 | 服务端没读到 `GEMINI_API_KEY`：`sudo systemctl show english-learner -p Environment` 看是否注入；或 `cat /opt/english-learner/server/.env` 检查；前端会自动退到本地 heuristic，体验降级而非崩溃 |
