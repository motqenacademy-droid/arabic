"""Assemble the thesis markdown from drafts, build indexes, and produce the docx.
Run: python3 -I build.py   (from anywhere)"""
import re, os, subprocess, zipfile, shutil, unicodedata, html
from collections import OrderedDict

ROOT = "/tmp/claude-0/-home-user-arabic/e911d197-6400-5f77-acf5-0cb3dbe70b83/scratchpad"
D, B = f"{ROOT}/drafts", f"{ROOT}/build"

PB = '\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n'

SURAS = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"]
SURA_IDX = {s: i for i, s in enumerate(SURAS)}
ALIASES = {"الإنشراح": "الشرح", "الانشراح": "الشرح", "المؤمن": "غافر", "بني إسرائيل": "الإسراء", "الدهر": "الإنسان", "اللهب": "المسد", "التحريم": "التحريم"}

DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
def norm(s):
    s = DIAC.sub("", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return s

def sort_key(line):
    t = norm(re.sub(r"[*\"«»()\[\]]", "", line)).strip()
    t = re.sub(r"^(ال)", "", t)
    return t

# ---------------- parts ----------------
PARTS = [
    ("intro", "# المقدمة"),
    ("tamheed", "# التمهيد: التعريف بمصطلحات الدراسة"),
    ("ch1a", "# الفصل الأول: الأحكام الفقهية المتعلقة بالمدرسين"),
    ("ch1b", None),
    ("ch2a", "# الفصل الثاني: الأحكام الفقهية المتعلقة بعلاقة المعلم مع الطلاب"),
    ("ch2b", None),
    ("ch3a", "# الفصل الثالث: الأحكام الفقهية المتعلقة بالطلاب"),
    ("ch3b", None),
    ("ch4", "# الفصل الرابع: الأحكام الفقهية المتعلقة بعلاقة الطلاب مع قوانين المؤسسة التعليمية"),
]

def load(pid):
    s = open(f"{D}/{pid}.md", encoding="utf-8").read()
    s = s.replace("\r", "")
    # drop any top-level '# ' title the writer added
    s = re.sub(r"(?m)^# [^\n]*\n", "", s)
    return s.strip() + "\n"

bm_counter = [0]
def bm(name):
    bm_counter[0] += 1
    i = bm_counter[0]
    return f'`<w:bookmarkStart w:id="{9000+i}" w:name="{name}"/><w:bookmarkEnd w:id="{9000+i}"/>`{{=openxml}}'

verse_first = OrderedDict()   # (sura_idx, ayah_start, label) -> bookmark
VERSE_RE = re.compile(r"\[(?:سورة\s+)?([^\]:\d]{1,20}?)\s*:\s*(?:الآية\s*|الآيات\s*)?([0-9٠-٩]+(?:\s*[-–،,]\s*[0-9٠-٩]+)*)\]")
def ar2en(d): return d.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))

def mark_verses(body):
    def rep(m):
        name = m.group(1).strip()
        name = ALIASES.get(name, name)
        if name not in SURA_IDX:
            return m.group(0)
        nums = ar2en(m.group(2)).replace(" ", "")
        start = int(re.match(r"\d+", nums).group(0))
        out = f"[سورة {name}: {nums}]"
        key = (SURA_IDX[name], start, nums)
        if key not in verse_first:
            verse_first[key] = f"v{SURA_IDX[name]+1:03d}_{start:03d}_{len(verse_first)}"
            out += bm(verse_first[key])
        return out
    return VERSE_RE.sub(rep, body)

def split_body_notes(s):
    lines = s.split("\n")
    body, notes = [], []
    in_note = False
    for ln in lines:
        if re.match(r"^\[\^[^\]]+\]:", ln):
            in_note = True; notes.append(ln); continue
        if in_note and (ln.startswith("    ") or ln.strip() == ""):
            notes.append(ln); continue
        in_note = False
        body.append(ln)
    return "\n".join(body), "\n".join(notes)

# ---------------- hadith index ----------------
def read_tables(pid):
    p = f"{D}/{pid}_ayat_ahadith.md"
    if not os.path.exists(p):
        return [], []
    ay, hd, sec = [], [], None
    for ln in open(p, encoding="utf-8"):
        ln = ln.strip()
        if ln.startswith("#"):
            sec = "a" if "آيات" in ln or "الآيات" in ln else "h"
            continue
        if ln.startswith("|") and not re.match(r"^\|\s*-", ln):
            cells = [c.strip() for c in ln.strip("|").split("|")]
            if len(cells) < 2 or cells[0].startswith("طرف") or cells[0] in ("الآية", "الحديث", "النص"):
                continue
            (ay if sec == "a" else hd).append(cells)
        elif ln.startswith("- ") and sec == "h":
            hd.append([ln[2:], ""])
    return ay, hd

def tokens(s):
    return [t for t in re.findall(r"[ء-ي٠-٩\w]+", norm(s))]

TARAJIM = []
TAG = re.compile(r"^\[\^([^\]]+)\]:\s*\{ترجمة:\s*([^}]+)\}\s*", re.M)
def dedupe_tarajim(text):
    defs = {m.group(1): norm(m.group(2)).strip() for m in TAG.finditer(text)}
    disp = {m.group(1): m.group(2).strip() for m in TAG.finditer(text)}
    if not defs:
        return text
    # order of first reference in the body
    seen, drop = set(), set()
    for m in re.finditer(r"\[\^([^\]]+)\](?!:)", text):
        fid = m.group(1)
        if fid in defs:
            if defs[fid] in seen:
                drop.add(fid)
            else:
                seen.add(defs[fid])
                TARAJIM.append([disp[fid], fid, None])
    for fid in drop:
        text = re.sub(r"(?m)^\[\^" + re.escape(fid) + r"\]:.*\n?", "", text)
        text = text.replace(f"[^{fid}]", "")
    text = TAG.sub(lambda m: f"[^{m.group(1)}]: ", text)
    for i, t in enumerate(TARAJIM, 1):
        name = f"t_{i:03d}"
        pos = text.find(f"[^{t[1]}]")
        if pos >= 0 and text[pos + len(t[1]) + 3:pos + len(t[1]) + 4] != ":":
            text = text[:pos] + bm(name) + text[pos:]
            t[2] = name
    print("tarajim kept", len(seen), "dropped duplicates", len(drop))
    return text

ORD = {"الأول": "1", "الثاني": "2", "الثالث": "3", "الرابع": "4", "الخامس": "5"}
def bib_key(e):
    m = re.search(r"\*\*(.+?)\*\*", e)
    if not m or "http" in e:
        return ("RAW", re.sub(r"[^\u0621-\u064Aa-zA-Z0-9]", "", norm(e)), ""), ""
    title = norm(m.group(1))
    title = re.split(r"[،,(:]| القسم| الجزء", title)[0]
    title = re.sub(r"[^\u0621-\u064Aa-zA-Z0-9 ]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    author = e[:m.start()] if m else ""
    author = re.sub(r"\([^)]*\)", "", author)
    author = norm(re.sub(r"[^\u0621-\u064A ]", " ", author)).split()
    author = " ".join(author[:1])
    part = ""
    pm = re.search(r"(?:ج|الجزء|القسم)\s*(\d|الأول|الثاني|الثالث|الرابع|الخامس)", e)
    if pm: part = ORD.get(pm.group(1), pm.group(1))
    # strip part words from title
    title = re.sub(r"\b(الجزء|القسم|ج)\s*\S*", "", title).strip()
    ym = re.search(r"\b(1[2-4]\d\d)\s*هـ", e[m.end():] if m else e)
    year = ym.group(1) if ym else ""
    return (author, title[:60], part), year

def dedupe_biblio(raw):
    groups = OrderedDict()
    for e in raw:
        k, y = bib_key(e)
        groups.setdefault(k, OrderedDict()).setdefault(y, []).append(e)
    out = []
    for k, byyear in groups.items():
        years = [y for y in byyear if y]
        if "" in byyear and len(years) == 1:
            byyear[years[0]] += byyear.pop("")
        for y, es in byyear.items():
            out.append(max(es, key=len))
    print("biblio raw", len(raw), "->", len(out))
    return out

def main():
    out = [open(f"{B}/front.md", encoding="utf-8").read(), PB]
    out.append(open(f"{B}/abstract_ar.md", encoding="utf-8").read() + PB if os.path.exists(f"{B}/abstract_ar.md") else "")

    hadiths = OrderedDict()
    all_body = []
    for pid, title in PARTS:
        if not os.path.exists(f"{D}/{pid}.md"):
            print("MISSING PART", pid); continue
        s = load(pid)
        body, notes = split_body_notes(s)
        body = mark_verses(body)
        _, hd = read_tables(pid)
        for cells in hd:
            t = re.sub(r"\s*\([^()]*\)\s*$", "", cells[0].strip()).strip("«»\"' ")
            k = " ".join(tokens(t)[:6])
            if len(k) < 4 or k in hadiths:
                continue
            hadiths[k] = [t, re.sub(r"\s*\([^()]*\)", "", cells[1]).strip() if len(cells) > 1 else "", None]
        if title:
            out.append(PB + title + "\n")
        out.append(body + "\n\n" + notes + "\n")
        all_body.append(body)

    # bookmark first occurrence of each hadith in the body
    text = "\n".join(out)
    text = dedupe_tarajim(text)
    hid = 0
    for k, v in hadiths.items():
        want = k.split()[:4]
        if len(want) < 2:
            continue
        # find tokens sequence in text: build regex over raw text allowing diacritics/punct between letters
        pat = r"[ً-ٰٟـ]*".join
        parts = []
        for w in want:
            letters = []
            for ch in w:
                cls = {"ا": "[اأإآٱ]", "ه": "[هة]", "ي": "[يىئ]", "و": "[وؤ]"}.get(ch, re.escape(ch))
                letters.append(cls)
            parts.append(r"[ً-ٰٟـ]*".join(letters) + r"[ً-ٰٟـ]*")
        rx = re.compile(r"(«\s*)(" + r"[\s،,.:؛]+".join(parts) + ")")
        m = rx.search(text)
        if not m:
            continue
        hid += 1
        name = f"h_{hid:03d}"
        text = text[:m.start(2)] + bm(name) + text[m.start(2):]
        v[2] = name

    # ---------- conclusion ----------
    if os.path.exists(f"{B}/conclusion.md"):
        text += PB + open(f"{B}/conclusion.md", encoding="utf-8").read() + "\n"

    # ---------- indexes ----------
    def pageref(name):
        return f'`<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGEREF {name} \\h </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>؟</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`{{=openxml}}'

    # verse texts from writer tables
    vtext = {}
    for pid, _ in PARTS:
        ay, _ = read_tables(pid)
        for cells in ay:
            if len(cells) < 2: continue
            m = re.match(r"(?:سورة\s+)?([^:]+?)\s*:\s*([0-9٠-٩]+)", ar2en(cells[1]))
            if not m: continue
            nm = ALIASES.get(m.group(1).strip(), m.group(1).strip())
            if nm in SURA_IDX:
                vtext.setdefault((SURA_IDX[nm], int(m.group(2))), cells[0])
    idx = [PB, "# الفهارس العامة\n", "## أولًا: فهرس الآيات القرآنية\n",
           "| م | طرف الآية | السورة | رقمها | الصفحة |", "|-----|----------------------|--------|------|-------|"]
    for n, (key, name) in enumerate(sorted(verse_first.items(), key=lambda kv: (kv[0][0], kv[0][1])), 1):
        si, st, nums = key
        t = vtext.get((si, st), "")
        idx.append(f"| {n} | {t} | {SURAS[si]} | {nums} | {pageref(name)} |")
    idx += ["", PB, "## ثانيًا: فهرس الأحاديث النبوية والآثار\n",
            "| م | طرف الحديث أو الأثر | الراوي أو القائل | الصفحة |", "|-----|----------------------|----------|-------|"]
    for n, v in enumerate(sorted(hadiths.values(), key=lambda v: sort_key(v[0])), 1):
        pg = pageref(v[2]) if v[2] else "—"
        idx.append(f"| {n} | «{v[0]}» | {v[1]} | {pg} |")
    idx += ["", PB, "## ثالثًا: فهرس الأعلام المترجم لهم\n",
            "| م | العَلَم | الصفحة |", "|------|------------------------|--------|"]
    for n, t in enumerate(sorted(TARAJIM, key=lambda t: sort_key(t[0])), 1):
        idx.append(f"| {n} | {t[0]} | {pageref(t[2]) if t[2] else '—'} |")
    text += "\n".join(idx) + "\n"

    # ---------- bibliography ----------
    raw = []
    for pid, _ in PARTS:
        p = f"{D}/{pid}_biblio.md"
        if not os.path.exists(p): continue
        for ln in open(p, encoding="utf-8"):
            ln = ln.strip()
            if not ln.startswith("- "): continue
            e = ln[2:].strip()
            if "القرآن الكريم" == re.sub(r"[*.]", "", e).strip(): continue
            raw.append(e)
    entries = dedupe_biblio(raw)
    web = [e for e in entries if "http" in e]
    books = [e for e in entries if "http" not in e]
    bib = [PB, "## رابعًا: فهرس المصادر والمراجع\n", "**القرآن الكريم.**\n", "### أولًا: الكتب والرسائل والبحوث والقوانين\n"]
    for n, e in enumerate(sorted(books, key=sort_key), 1):
        bib.append(f"{n}. {e}")
    bib += ["", "### ثانيًا: المواقع الإلكترونية\n"]
    for n, e in enumerate(sorted(web, key=sort_key), 1):
        bib.append(f"{n}. {e}")
    text += "\n".join(bib) + "\n"

    text += PB + "## خامسًا: فهرس الموضوعات {.unnumbered .unlisted}\n\n```{=openxml}\n<w:p><w:r><w:fldChar w:fldCharType=\"begin\"/></w:r><w:r><w:instrText xml:space=\"preserve\"> TOC \\o \"1-3\" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>(انقر بزر الفأرة الأيمن هنا ثم «تحديث الحقل» لإظهار فهرس المحتويات بأرقام الصفحات)</w:t></w:r><w:r><w:fldChar w:fldCharType=\"end\"/></w:r></w:p>\n```\n" 
    if os.path.exists(f"{B}/abstract_en.md"):
        text += PB + open(f"{B}/abstract_en.md", encoding="utf-8").read() + "\n"

    open(f"{B}/thesis.md", "w", encoding="utf-8").write(text)
    print("verses", len(verse_first), "hadiths", len(hadiths), "linked", sum(1 for v in hadiths.values() if v[2]), "biblio", len(books), "web", len(web))

    docx = f"{B}/thesis.docx"
    subprocess.run(["pandoc", f"{B}/thesis.md", "-f", "markdown+raw_attribute-auto_identifiers", "-o", docx,
                    f"--reference-doc={B}/reference.docx", "-M", "dir=rtl", "-M", "lang=ar"], check=True)
    postprocess(docx)
    print("built", docx)

def postprocess(path):
    tmp = path + ".tmp"
    zin = zipfile.ZipFile(path)
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        data = zin.read(it.filename)
        if it.filename == "word/settings.xml":
            s = data.decode()
            if "updateFields" not in s:
                s = s.replace("</w:settings>", '<w:updateFields w:val="true"/></w:settings>')
            data = s.encode()
        if it.filename == "word/document.xml":
            s = data.decode()
            # tables: right-to-left
            s = s.replace("<w:tblPr>", "<w:tblPr><w:bidiVisual/>")
            data = s.encode()
        zout.writestr(it, data)
    zout.close(); zin.close()
    shutil.move(tmp, path)

if __name__ == "__main__":
    main()
