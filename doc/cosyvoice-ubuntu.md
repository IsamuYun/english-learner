# CosyVoice (Fun-CosyVoice3-0.5B) Ubuntu 部署

把 FunAudioLLM 的 CosyVoice3 仓库 + 0.5B 模型权重装到一台 Ubuntu 22.04 服务器上。这是 `tts-server/` 的依赖；本身不对外提供 HTTP，由 `tts-server/app.py` 作为 Python 库加载使用。

参考关系：

```
英语学习应用 server (Node, :3001)
   │ COSYVOICE_URL=http://127.0.0.1:9881
   ▼
tts-server (FastAPI, :9881)  ◀── 本文不部署，见 tts-server-ubuntu.md
   │ from cosyvoice.cli.cosyvoice import AutoModel
   ▼
CosyVoice 仓库 + Fun-CosyVoice3-0.5B 模型权重  ◀── 本文部署
```

---

## 0. 硬件 & 系统前置

- **GPU**：NVIDIA 显卡，至少 8 GB 显存（推理峰值约 4–6 GB，加预留余量）。CPU 模式理论可跑但实际不可用，单条要几十秒。
- **CUDA**：11.8 或 12.1（CosyVoice 上游 `requirements.txt` 用 `--extra-index-url .../whl/cu121`，下面按 CUDA 12.1 走）。
- **磁盘**：模型权重 + 依赖大约占 15 GB。
- **系统**：Ubuntu 22.04 LTS（其它发行版只要 Python 3.10 + 合适的 CUDA 驱动也行）。

确认 NVIDIA 驱动 & CUDA 工具链已装：

```bash
nvidia-smi                    # 看到 GPU + 驱动版本（>= 535 即可带 CUDA 12.1）
nvcc --version 2>/dev/null    # 可选，模型推理只要驱动够新就行
```

驱动如果没装：

```bash
sudo ubuntu-drivers autoinstall   # 自动选合适版本
sudo reboot
```

---

## 1. 系统依赖

```bash
sudo apt update
sudo apt install -y \
  git build-essential pkg-config \
  python3.10 python3.10-venv python3.10-dev python3-pip \
  ffmpeg sox libsndfile1 \
  libssl-dev libffi-dev
```

> **为什么单独装 Python 3.10**：CosyVoice 上游测试在 3.10。Ubuntu 22.04 默认就是 3.10，新版本（24.04 起是 3.12）需要额外用 `deadsnakes` PPA 拉一个 3.10。

---

## 2. 拉 CosyVoice 仓库

选一个长期路径，下面以 `/opt/cosyvoice` 为例（让 `deploy` 用户拥有写权限）：

```bash
sudo mkdir -p /opt/cosyvoice
sudo chown $USER:$USER /opt/cosyvoice
cd /opt/cosyvoice

git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git
cd CosyVoice
git submodule update --init --recursive   # 确保 third_party/Matcha-TTS 拉到了
```

> `--recursive` / 子模块更新都要做：`tts-server/app.py` 会把 `CosyVoice/third_party/Matcha-TTS` 也加进 `sys.path`，子模块没拉就会 `ImportError`。

---

## 3. 创建 venv & 装上游依赖

```bash
cd /opt/cosyvoice/CosyVoice
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip wheel setuptools

# 上游 requirements.txt 内嵌了 --extra-index-url 指向 PyTorch CUDA 12.1 wheel
pip install -r requirements.txt
```

主要装的东西（仅供参考）：

- `torch==2.3.1 + torchaudio==2.3.1`（CUDA 12.1）
- `onnxruntime-gpu==1.18.0`、`tensorrt-cu12==10.13.3.9`、`deepspeed==0.15.1`
- `transformers==4.51.3`、`librosa`、`HyperPyYAML`、`hydra-core`
- `modelscope==1.20.0`（下载模型用）

### 常见报错速查

| 报错 | 处理 |
| --- | --- |
| `deepspeed` 编译失败 | 装 `python3.10-dev` 和 `build-essential`；显卡架构低于 sm_70 时设 `DS_BUILD_OPS=0 pip install deepspeed==0.15.1` 跳过算子预编译 |
| `tensorrt-cu12` 不装 | 不是必须的，可以 `pip install -r requirements.txt --no-deps` 后手动补缺；CosyVoice3 默认 PyTorch 路径不依赖 TRT |
| `onnxruntime-gpu` 找不到 CUDA | 确认 `nvidia-smi` 工作；老驱动可能要 `pip install onnxruntime` 退回 CPU 版（推理会变慢但不阻塞） |
| `pip` OOM | `pip install --no-cache-dir` |

---

## 4. 下载模型权重

CosyVoice3 没有预置发音人，每次合成都是零样本克隆。把权重下到 `pretrained_models/Fun-CosyVoice3-0.5B`：

```bash
cd /opt/cosyvoice/CosyVoice
mkdir -p pretrained_models

# modelscope 在第 3 步装过了
modelscope download \
  --model FunAudioLLM/Fun-CosyVoice3-0.5B-2512 \
  --local_dir pretrained_models/Fun-CosyVoice3-0.5B
```

大概 1.6 GB，国内服务器走 ModelScope 比 HuggingFace 稳。下完目录里应该能看到 `llm.pt` / `flow.pt` / `hift.pt` / `cosyvoice.yaml` 这些文件。

> ModelScope 没账号也能下，需要登录才能下的另算（页面会提示）。

---

## 5. 烟测

不依赖 tts-server，直接 import 验证一次：

```bash
cd /opt/cosyvoice/CosyVoice
source .venv/bin/activate

python - <<'PY'
import sys
sys.path.insert(0, "third_party/Matcha-TTS")
from cosyvoice.cli.cosyvoice import AutoModel
m = AutoModel(model_dir="pretrained_models/Fun-CosyVoice3-0.5B")
print("OK sample_rate=", m.sample_rate)
PY
```

第一次跑会编译一些 JIT 算子，30–60 秒；输出 `OK sample_rate= 24000` 就算成功。

> 报 `Kernel size can't be greater than actual input size`：这是 HiFi-GAN 在极短输入时的已知问题。**`tts-server/app.py` 在加载后会 monkey-patch 这条路径**（pad 到 4 帧），裸用 `inference_zero_shot` 时如果输入太短可能撞上；走 tts-server 不会有这个问题。

---

## 6. 长期路径 & 变量记下来

后面 tts-server 要用：

```bash
export COSYVOICE_DIR=/opt/cosyvoice/CosyVoice
export COSYVOICE_MODEL_DIR=$COSYVOICE_DIR/pretrained_models/Fun-CosyVoice3-0.5B
```

写进 `~/.bashrc` 或者后面 systemd 的 `Environment=` 里。

---

## 7. 升级 / 重装

升级 CosyVoice 代码：

```bash
cd /opt/cosyvoice/CosyVoice
git pull
git submodule update --recursive
source .venv/bin/activate
pip install -r requirements.txt   # 上游有时会动版本号
```

换模型权重（比如未来出 1.5B）：把新权重下到另一个目录，改 `COSYVOICE_MODEL_DIR` 重启 tts-server 即可，不用动代码。

---

## 8. 卸载

```bash
deactivate 2>/dev/null
rm -rf /opt/cosyvoice
```

模型缓存如果用 modelscope 下过，默认还在 `~/.cache/modelscope/`，按需清。

---

部署完这一份后，继续看 `doc/tts-server-ubuntu.md` 把 FastAPI 包装起来。
