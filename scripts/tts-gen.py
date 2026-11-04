#!/usr/bin/env python3
"""يولّد تسجيلات صوتية بصوت Microsoft العصبي العربي للنصوص التي لم تُسجَّل بعد.
الاستعمال: python3 scripts/tts-gen.py tts-jobs.json <مجلد الإخراج>
يكتب <h>.mp3 لكل نص، و index.json بقائمة البصمات المتوفرة. يتجاوز ما سُجّل من قبل."""
import asyncio, json, os, sys
import edge_tts

jobs = json.load(open(sys.argv[1], encoding="utf-8"))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
sem = asyncio.Semaphore(6)
done, failed = 0, []

async def one(j):
    global done
    path = os.path.join(out, j["h"] + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 2000:
        return
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(j["text"], j["voice"], rate=j["rate"]).save(path + ".tmp")
                if os.path.getsize(path + ".tmp") > 2000:
                    os.replace(path + ".tmp", path); done += 1; return
            except Exception as e:  # noqa: BLE001
                err = e
            await asyncio.sleep(2 * (attempt + 1))
        failed.append(j["h"])

async def main():
    await asyncio.gather(*(one(j) for j in jobs))
    want = {j["h"] for j in jobs}
    have = sorted(f[:-4] for f in os.listdir(out) if f.endswith(".mp3") and f[:-4] in want and os.path.getsize(os.path.join(out, f)) > 2000)
    for f in os.listdir(out):  # احذف تسجيلات نصوص لم تعد موجودة
        if f.endswith(".mp3") and f[:-4] not in want: os.remove(os.path.join(out, f))
    json.dump(have, open(os.path.join(out, "index.json"), "w"))
    print(f"jobs={len(jobs)} new={done} available={len(have)} failed={len(failed)}")

asyncio.run(main())
