"""Apply tarajim_fix.json to all drafts (replace biography footnote texts) and
write drafts/tarajim_biblio.md from the listed printed sources."""
import json, re, shutil, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fix = json.load(open(f"{ROOT}/tarajim_fix.json", encoding="utf-8"))
TAG = re.compile(r"(?m)^(\[\^[^\]]+\]:)\s*\{ترجمة:\s*([^}]+)\}.*$")
os.makedirs(f"{ROOT}/rev4_backup", exist_ok=True)
n = 0
for f in ["intro","tamheed","ch1a","ch1b","ch2a","ch2b","ch3a","ch3b","ch4"]:
    p = f"{ROOT}/drafts/{f}.md"
    if not os.path.exists(f"{ROOT}/rev4_backup/{f}.md"):
        shutil.copy(p, f"{ROOT}/rev4_backup/{f}.md")
    s = open(p, encoding="utf-8").read()
    def rep(m):
        global n
        name = m.group(2).strip()
        if name in fix:
            n += 1
            e = fix[name]
            return f"{m.group(1)} {{ترجمة: {e.get('canonical_tag', name)}}} {e['text'].strip()}"
        return m.group(0)
    s = TAG.sub(rep, s)
    open(p, "w", encoding="utf-8").write(s)
srcs = []
for e in fix.values():
    for x in e.get("sources", []):
        x = re.sub(r"،?\s*ج\s*\d+\s*،\s*ص\s*[\d\-–]+\.?$", "", x.strip()).strip()
        if x and x not in srcs: srcs.append(x)
open(f"{ROOT}/drafts/tarajim_biblio.md", "w", encoding="utf-8").write("# مصادر التراجم\n\n" + "\n".join("- " + s for s in srcs) + "\n")
print("replaced", n, "footnotes; biography sources", len(srcs))
