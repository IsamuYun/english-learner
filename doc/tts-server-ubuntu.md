# tts-server Ubuntu 部署

`tts-server/` 是 CosyVoice3 上面薄薄的一层 FastAPI 包装，给 Node 后端 (`server/`) 提供 `/tts`、`/voices`、`/health` 三个接口。本身只有一个 `app.py` + 几个声音参考 WAV，部署前提是 CosyVoice 已经装好了。

依赖：

```
Node server  ──fetch──▶  tts-server (:9881)  ──Python──▶  CosyVoice + 模型权重
                          ↑ 本文部署             ↑ 见 doc/cosyvoice-ubuntu.md
```

---

## 0. 前置

- 已按 `doc/cosyvoice-ubuntu.md` 装好 CosyVoice，记下：

  ```bash
  COSYVOICE_DIR=/opt/cosyvoice/CosyVoice
  COSYVOICE_MODEL_DIR=$COSYVOICE_DIR/pretrained_models/Fun-CosyVoice3-0.5B
  ```

- 服务器上有 `english-learner` 仓库源码（参考 `DEPLOY.md` 第 3 节 clone 到 `/srv/english-learner` 之类的位置）。下面用 `/srv/english-learner/tts-server` 举例。
- `ffmpeg` 已装（生成参考音频要用）。

---

## 1. 复用 CosyVoice 的 venv，加装包装层依赖

CosyVoice 已经装了 `torch` / `torchaudio` / `fastapi` / `uvicorn` / `pydantic`，但版本和 tts-server 的 `requirements.txt` 不完全一致（`fastapi==0.115.6 vs >=0.110`），通常兼容。直接复用同一个 venv 最省心：

```bash
source /opt/cosyvoice/CosyVoice/.venv/bin/activate
cd /srv/english-learner/tts-server
pip install -r requirements.txt          # fastapi / uvicorn / pydantic（如果版本已满足会跳过）
pip install edge-tts                     # make_voices.py 用，生成参考音频
```

> 如果不想污染 CosyVoice 的 venv，可以单独建一个：
>
> ```bash
> python3.10 -m venv .venv && source .venv/bin/activate
> pip install -r /opt/cosyvoice/CosyVoice/requirements.txt
> pip install -r requirements.txt edge-tts
> ```
>
> 同样能跑，但磁盘多占一份 torch + onnxruntime（~5 GB）。

---

## 2. 生成参考音频

CosyVoice3 是零样本克隆，每个发音人都需要一段参考 WAV + 对应文本。`make_voices.py` 用 Microsoft edge-tts 免费合成 2 段台湾女声：

```bash
cd /srv/english-learner/tts-server
python make_voices.py
ls voices/
# tw_female.wav  tw_female_yu.wav
```

跑完 `voices/` 下应该有 2 个 16 kHz mono 的 WAV。每个文件大概 100–200 KB。

> **想换嗓音**：编辑 `make_voices.py` 里的 `JOBS`，把对应 edge-tts 嗓音 ID 换掉（比如 `zh-TW-HsiaoChenNeural` → `zh-TW-HsiaoYuNeural`），同步改 `voices.json` 里的 `prompt_text`，再重跑 `python make_voices.py`。

---

## 3. 配置 voices.json

```bash
cp voices.json.example voices.json
```

`voices.json.example` 里已经把 2 个发音人（曉臻 / 曉雨）对齐到 `make_voices.py` 生成的 WAV 路径和文本，**默认开箱可用**。要加新声音，照着已有条目复制一份改 `id` / `label` / `prompt_audio` / `prompt_text`，并在 `server/src/routes/tts.ts` 的 `TTS_VOICES` 里登记同名 `id`（不然 Node 端会拒掉请求）。

---

## 4. 前台试跑

```bash
cd /srv/english-learner/tts-server
source /opt/cosyvoice/CosyVoice/.venv/bin/activate

export COSYVOICE_DIR=/opt/cosyvoice/CosyVoice
export COSYVOICE_MODEL_DIR=$COSYVOICE_DIR/pretrained_models/Fun-CosyVoice3-0.5B

uvicorn app:app --host 127.0.0.1 --port 9881
```

第一次启动会加载模型，30–60 秒。日志看到 `Uvicorn running on http://127.0.0.1:9881` 就 OK。

另开一个 SSH 窗口烟测：

```bash
curl http://127.0.0.1:9881/health
# {"ok":true,"sample_rate":24000}

curl http://127.0.0.1:9881/voices
# {"voices":[{"id":"台湾女", ...}, ...], "sample_rate":24000}

curl -X POST http://127.0.0.1:9881/tts \
  -H 'content-type: application/json' \
  -d '{"text":"Reading widely is vital for academic success.","voice":"台湾女"}' \
  -o /tmp/test.wav

file /tmp/test.wav
# /tmp/test.wav: RIFF (little-endian) data, WAVE audio, ...
```

能播出 `/tmp/test.wav` 就通了。Ctrl-C 停掉前台 uvicorn，下一步上 systemd。

---

## 5. systemd 守护

新建 `/etc/systemd/system/tts-server.service`：

```ini
[Unit]
Description=CosyVoice3 TTS wrapper for english-learner
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/srv/english-learner/tts-server
Environment="COSYVOICE_DIR=/opt/cosyvoice/CosyVoice"
Environment="COSYVOICE_MODEL_DIR=/opt/cosyvoice/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B"
Environment="PATH=/opt/cosyvoice/CosyVoice/.venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/opt/cosyvoice/CosyVoice/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 9881
Restart=on-failure
RestartSec=5

# 模型加载耗时长，给宽松点
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
```

启动 & 开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tts-server
sudo systemctl status tts-server
journalctl -u tts-server -f             # 实时看日志
```

GPU 进程退出有时不及时释放显存，重启服务推荐：

```bash
sudo systemctl restart tts-server
nvidia-smi                              # 看显存是否被新进程拿回去
```

---

## 6. 接入 Node 后端

`server/.env` 里加一行（默认就是这个值，写出来明确一下）：

```bash
COSYVOICE_URL=http://127.0.0.1:9881
```

重启 Node 服务：

```bash
sudo systemctl restart english-learner   # 或 pm2 restart english-learner
```

前端 Settings 页面打开能看到嗓音下拉里出现 2 个选项（曉臻 / 曉雨）就说明链路通了。

---

## 7. 预生成单词缓存（可选但强烈推荐）

第一次合成一个新单词要 10 秒左右（CosyVoice 走完 LLM + flow + HiFi-GAN），之后命中缓存就是即时。把 `words` 表里所有词先合成一遍：

```bash
cd /srv/english-learner/server
npm run tts:prewarm                          # 默认嗓音「台湾女（曉臻）」，含 example_en
npm run tts:prewarm -- --voice=all           # 两个嗓音都跑
npm run tts:prewarm -- --voice=台湾女2       # 只跑曉雨
npm run tts:prewarm -- --no-examples         # 只跑单词，跳过例句
```

跑的时候 tts-server 必须在线（这个脚本通过 `COSYVOICE_URL` 走的）。中断后再跑会自动跳过已缓存的，可以放心 Ctrl-C。

缓存落在 `server/data/tts/` 下，按 sha256 分桶；行索引在 SQLite 的 `tts_cache` 表。要全清：

```bash
npm run tts:clear
```

---

## 8. 监控 & 排障

**显存**：

```bash
watch -n 2 nvidia-smi
```

进程长时间不被请求会保持模型在显存里（这是好事，热启动用）。如果想节省显存，让 GPU 给别的进程用，最简单的是定时 `systemctl stop tts-server`，需要时再起。

**日志**：

```bash
journalctl -u tts-server -n 200 --no-pager
```

**常见问题**：

| 现象 | 排查 |
| --- | --- |
| 启动报 `set COSYVOICE_DIR to the cloned CosyVoice repo path` | systemd 的 `Environment=` 没生效，`systemctl cat tts-server` 检查 |
| `voices.json not found` | 路径不对；`WorkingDirectory` 必须是 `tts-server/` 这一级 |
| 返回 503 `tts-unavailable`（Node 侧） | tts-server 没起 / 起没起来；`curl 127.0.0.1:9881/health` 复测 |
| 合成出来音色不像 | 参考 WAV 质量决定上限。换更长（5–10 秒）、更干净的人声样本到 `voices/` 重启服务 |
| `CUDA out of memory` | 当前 GPU 上有别的进程；`nvidia-smi` 找占用方；或者上小一点的 GPU 跑 CPU 模式（极慢，不推荐） |
| 第一次请求很慢，后续才正常 | 正常 —— 第一次会触发 JIT 编译和图初始化。预热可以在启动后 `curl /tts` 喂一条短文 |

---

## 9. 升级 tts-server 自己

```bash
cd /srv/english-learner
git pull
sudo systemctl restart tts-server
```

`app.py` 改动几乎都是即时生效。`voices.json` 改了同样要 restart 才能被加载（启动时一次性读）。
