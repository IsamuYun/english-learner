# 部署指南

把项目从本地推到 GitHub，再部署到一台 Linux 服务器（以 Ubuntu 22.04 为例）。架构：

```
浏览器 ──HTTPS──▶ Nginx ──┬─▶ /          静态文件 (Vite build, /var/www/english-learner)
                         └─▶ /api/*     反向代理到 Fastify (127.0.0.1:3001)
                                          └── better-sqlite3 → /var/lib/english-learner/app.db
```

后端进程由 **systemd** 守护（也可改用 pm2，最后附备选）。

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
git status            # 确认 node_modules 和 *.db 没被加入
git commit -m "init: shanghai gaokao english learner"
```

在 GitHub 网页新建一个空仓库，比如 `english-learner`（**不要** 勾选 README/.gitignore，避免冲突），拿到 SSH 地址：

```bash
git remote add origin git@github.com:<your-username>/english-learner.git
git branch -M main
git push -u origin main
```

> 词汇 markdown 文件 `src/data/上海高考英语词汇表.md` 是源数据，**会跟着 git 一起上传**。
> 数据库 `server/data/app.db` **不上传**（被 .gitignore 排除），需要在服务器上重新 seed。

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

# 装前端依赖
npm install

# 装后端依赖（会编译 better-sqlite3 native 模块）
npm --prefix server install
```

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

---

## 5. 服务器：构建前后端

```bash
# 前端：vite build → dist/
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

打开浏览器访问 `http://example.com/`，应能看到首页；切到 `/manage`，列表能正常加载即代表 API 链路也通了。

---

## 8. （推荐）启用 HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

certbot 会自动改写 Nginx 配置加上 SSL，并设置自动续期。

---

## 9. 后续更新流程

每次本地有改动 → push → 服务器拉取 + 重建 + 重启：

```bash
# 本地
git add . && git commit -m "..." && git push

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

# 重启后端
sudo systemctl restart english-learner
```

可以把上面这一坨写成 `scripts/deploy.sh`，以后一行 `./scripts/deploy.sh` 即可。

---

## 10. 数据备份

数据库就是一个文件，最简单的做法是 `cron` + `cp`：

```bash
sudo crontab -e
# 每天凌晨 3 点拷一份带日期的备份，保留 14 天
0 3 * * * cp /var/lib/english-learner/app.db /var/lib/english-learner/backup-$(date +\%Y\%m\%d).db && find /var/lib/english-learner/backup-*.db -mtime +14 -delete
```

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
