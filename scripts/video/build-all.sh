#!/usr/bin/env bash
# يُنتج الفيديوهات كلها: الدعائي (عربي/إنجليزي × أفقي/عمودي) والتعليمي (عربي/إنجليزي، أفقي).
# يحتاج: node + playwright، و ffmpeg، و python3 + edge-tts (للراوي؛ وإلا خرجت الفيديوهات صامتة).
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT=8765
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 1

if python3 -c "import edge_tts" 2>/dev/null; then
  for b in promo tutorial; do
    for lang in ar en; do python3 scripts/video/tts.py "video/$b.json" "$lang" video/build/audio; done
  done
else
  echo "edge-tts غير مثبّت: ستخرج الفيديوهات بلا راوٍ"
fi

R="node scripts/video/render.js --base http://localhost:$PORT/index.html --strict"
$R --board video/promo.json --lang ar --format landscape
$R --board video/promo.json --lang en --format landscape
$R --board video/promo.json --lang ar --format portrait
$R --board video/promo.json --lang en --format portrait
$R --board video/tutorial.json --lang ar --format landscape
$R --board video/tutorial.json --lang en --format landscape

# فهرس ما أُنتج (يقرؤه الموقع ليعرض المشغّلات)
python3 - <<'PY'
import json, os, subprocess
out = "video/out"; items = []
for f in sorted(os.listdir(out)):
    if f.endswith(".mp4"):
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(out, f)]))
        items.append({"file": f, "duration": round(d, 1), "size": os.path.getsize(os.path.join(out, f))})
json.dump(items, open(os.path.join(out, "index.json"), "w"), ensure_ascii=False)
print(json.dumps(items, ensure_ascii=False))
PY
