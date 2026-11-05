#!/usr/bin/env python3
"""يسجّل صوت الراوي لكل مشهد في لوحة الفيديو.
الاستعمال: python3 scripts/video/tts.py video/promo.json ar video/build/audio
يكتب <board>-<lang>-<scene>.mp3، ولا يعيد تسجيل مشهد لم يتغيّر نصّه."""
import asyncio, hashlib, json, os, sys
import edge_tts

board_path, lang, out = sys.argv[1], sys.argv[2], sys.argv[3]
board = json.load(open(board_path, encoding="utf-8"))
VOICE = {"ar": ("ar-SA-HamedNeural", "-4%"), "en": ("en-US-AndrewNeural", "+0%")}[lang]
os.makedirs(out, exist_ok=True)

async def one(scene):
    text = (scene.get("say_ar") if lang == "ar" else scene.get("say_en")) or ""
    text = text.replace("«", "").replace("»", "").replace("﴿", "").replace("﴾", "").strip()
    if not text:
        return
    base = os.path.join(out, f"{board['id']}-{lang}-{scene['id']}")
    sig = hashlib.sha1(f"{VOICE}{text}".encode()).hexdigest()
    if os.path.exists(base + ".mp3") and os.path.exists(base + ".sig") and open(base + ".sig").read() == sig:
        return
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE[0], rate=VOICE[1]).save(base + ".mp3")
            if os.path.getsize(base + ".mp3") > 1500:
                open(base + ".sig", "w").write(sig)
                print("✓", os.path.basename(base))
                return
        except Exception as e:  # noqa: BLE001
            print("retry", scene["id"], e)
        await asyncio.sleep(2 * (attempt + 1))
    raise SystemExit(f"فشل تسجيل المشهد {scene['id']}")

async def main():
    for s in board["scenes"]:
        await one(s)

asyncio.run(main())
