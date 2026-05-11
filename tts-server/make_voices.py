"""Generate reference WAVs for CosyVoice3 zero-shot prompts.

Uses Microsoft edge-tts (free neural voices, no API key) and ffmpeg to write
mono 16kHz WAVs that `cosyvoice.utils.file_utils.load_wav` will accept.

Setup:

  pip install edge-tts
  # ffmpeg in PATH (brew install ffmpeg / apt install ffmpeg)

Run:

  python make_voices.py

Writes voices/{tw_female,tw_female_yu}.wav. The transcripts below match
voices.json.example exactly — if you change one, change the other.
"""

import asyncio
import subprocess
from pathlib import Path

import edge_tts

HERE = Path(__file__).parent
OUT_DIR = HERE / "voices"
OUT_DIR.mkdir(exist_ok=True)

JOBS = [
    ("tw_female", "zh-TW-HsiaoChenNeural",
     "今天天氣很好，適合出門走走。"),
    ("tw_female_yu", "zh-TW-HsiaoYuNeural",
     "下午我們一起去咖啡廳坐坐吧。"),
]


async def synth(name: str, voice: str, text: str) -> None:
    mp3 = OUT_DIR / f"{name}.mp3"
    wav = OUT_DIR / f"{name}.wav"
    print(f"[edge-tts] {name:10s} ← {voice}")
    await edge_tts.Communicate(text, voice).save(str(mp3))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3),
         "-ar", "16000", "-ac", "1", str(wav)],
        check=True,
    )
    mp3.unlink()


async def main() -> None:
    for job in JOBS:
        await synth(*job)
    print(f"\nWrote {len(JOBS)} files to {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
