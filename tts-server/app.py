"""CosyVoice3 TTS HTTP service.

Wraps Fun-CosyVoice3-0.5B (FunAudioLLM/CosyVoice). v3 has no preset SFT
speakers — every synthesis is zero-shot voice cloning, so each voice needs a
reference audio clip + its transcript. Voices are declared in `voices.json`
next to this file (copy `voices.json.example` and edit).

Setup:

  1. git clone https://github.com/FunAudioLLM/CosyVoice.git
  2. download Fun-CosyVoice3-0.5B into
     CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B
     (e.g. `modelscope download --model FunAudioLLM/Fun-CosyVoice3-0.5B-2512
     --local_dir CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B`)
  3. python -m venv .venv && source .venv/bin/activate
     pip install -r requirements.txt
     pip install -r /path/to/CosyVoice/requirements.txt
  4. drop reference WAVs under tts-server/voices/ and copy
     voices.json.example to voices.json, edit prompt_audio + prompt_text
     to match your clips
  5. export COSYVOICE_DIR=/path/to/CosyVoice
     export COSYVOICE_MODEL_DIR=$COSYVOICE_DIR/pretrained_models/Fun-CosyVoice3-0.5B
     uvicorn app:app --host 127.0.0.1 --port 9881

Then in `server/.env`:
     COSYVOICE_URL=http://127.0.0.1:9881
"""

import io
import json
import os
import sys
from pathlib import Path

COSY_DIR = os.environ.get("COSYVOICE_DIR")
if not COSY_DIR:
    raise RuntimeError("set COSYVOICE_DIR to the cloned CosyVoice repo path")
sys.path.insert(0, COSY_DIR)
sys.path.insert(0, os.path.join(COSY_DIR, "third_party", "Matcha-TTS"))

import torch  # noqa: E402
import torchaudio  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from cosyvoice.cli.cosyvoice import AutoModel  # noqa: E402

HERE = Path(__file__).parent

MODEL_DIR = os.environ.get(
    "COSYVOICE_MODEL_DIR",
    os.path.join(COSY_DIR, "pretrained_models", "Fun-CosyVoice3-0.5B"),
)
VOICES_PATH = Path(
    os.environ.get("COSYVOICE_VOICES_JSON", str(HERE / "voices.json"))
)

if not VOICES_PATH.exists():
    raise RuntimeError(
        f"{VOICES_PATH} not found — copy voices.json.example to voices.json "
        "and edit it to point at your reference clips"
    )

cosy = AutoModel(model_dir=MODEL_DIR)

# CosyVoice's HiFi-GAN f0 predictor uses CausalConv1d(kernel_size=4) and
# crashes ("Kernel size can't be greater than actual input size") when the
# mel input has fewer than 4 frames. That can happen on the finalize chunk
# of a synthesis whose total length doesn't divide evenly by the internal
# chunk size — independent of how long our input text is. Pad the input on
# the way into hift.inference; ~50ms of silence at the chunk tail is
# imperceptible.
import torch.nn.functional as F  # noqa: E402

_orig_hift_inference = cosy.model.hift.inference


def _padded_hift_inference(speech_feat, *args, **kwargs):
    if speech_feat.shape[-1] < 4:
        speech_feat = F.pad(speech_feat, (0, 4 - speech_feat.shape[-1]))
    return _orig_hift_inference(speech_feat, *args, **kwargs)


cosy.model.hift.inference = _padded_hift_inference

with open(VOICES_PATH, encoding="utf-8") as f:
    raw_voices = json.load(f)

# CosyVoice3's LLM asserts that <|endofprompt|> (token 151646) appears in
# either tts_text or prompt_text. We follow upstream example.py and prepend a
# fixed instruction header to each voice's transcript so voices.json stays
# clean (user supplies the bare transcript).
INSTRUCT_PREFIX = "You are a helpful assistant.<|endofprompt|>"

VOICES: list[dict] = []
PROMPTS: dict[str, dict] = {}
for v in raw_voices:
    audio_path = v["prompt_audio"]
    if not os.path.isabs(audio_path):
        audio_path = str((HERE / audio_path).resolve())
    if not os.path.exists(audio_path):
        raise RuntimeError(
            f"voice {v['id']}: prompt_audio not found at {audio_path}"
        )
    prompt_text = v["prompt_text"]
    if "<|endofprompt|>" not in prompt_text:
        prompt_text = INSTRUCT_PREFIX + prompt_text
    # inference_zero_shot does its own load_wav internally — pass the path,
    # not a pre-loaded tensor.
    PROMPTS[v["id"]] = {
        "audio_path": audio_path,
        "text":       prompt_text,
    }
    VOICES.append({
        "id":    v["id"],
        "label": v["label"],
        "lang":  v.get("lang", "en"),
    })


app = FastAPI()


class TTSReq(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str
    # Accepted for forward compat with the Node caller; the playback rate is
    # applied client-side on the <audio> element so the model always synthesizes
    # at speed=1, keeping the on-disk WAV cache hot.
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


@app.get("/voices")
def voices() -> dict:
    return {"voices": VOICES, "sample_rate": cosy.sample_rate}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "sample_rate": cosy.sample_rate}


@app.post("/tts")
def tts(req: TTSReq) -> Response:
    prompt = PROMPTS.get(req.voice)
    if prompt is None:
        raise HTTPException(400, f"unknown voice: {req.voice}")

    text = req.text.strip()
    if text[-1] not in ".!?。！？":
        text = text + "."

    chunks = []
    for out in cosy.inference_zero_shot(
        text,
        prompt["text"],
        prompt["audio_path"],
        stream=False,
    ):
        chunks.append(out["tts_speech"])
    if not chunks:
        raise HTTPException(500, "no audio")

    audio = chunks[0] if len(chunks) == 1 else torch.cat(chunks, dim=1)
    buf = io.BytesIO()
    torchaudio.save(buf, audio, cosy.sample_rate, format="wav")
    return Response(content=buf.getvalue(), media_type="audio/wav")
