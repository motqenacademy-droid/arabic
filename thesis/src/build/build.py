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

def main():
    out = [open(f"{B}/front.md", encoding="utf-8").read(), PB]
    out.append(open(f"{B}/abstract_ar.md", encoding="utf-8").read() + PB if os.path.exists(f"{B}/abstract_ar.md") else "")
    out.append("# فهرس المحتويات {.unnumbered .unlisted}\n\n```{=openxml}\n<w:p><w:r><w:fldChar w:fldCharType=\"begin\"/></w:r><w:r><w:instrText xml:space=\"preserve\"> TOC \\o \"1-3\" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>(انقر بزر الفأرة الأيمن هنا ثم «تحديث الحقل» لإظهار فهرس المحتويات بأرقام الصفحات)</w:t></w:r><w:r><w:fldChar w:fldCharType=\"end\"/></w:r></w:p>\n```\n" + PB)

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
           "| م | طرف الآية | السورة | رقمها | الصفحة |", "|--|------------------------------|--------|-----|-----|"]
    for n, (key, name) in enumerate(sorted(verse_first.items(), key=lambda kv: (kv[0][0], kv[0][1])), 1):
        si, st, nums = key
        t = vtext.get((si, st), "")
        idx.append(f"| {n} | {t} | {SURAS[si]} | {nums} | {pageref(name)} |")
    idx += ["", PB, "## ثانيًا: فهرس الأحاديث النبوية والآثار\n",
            "| م | طرف الحديث أو الأثر | الراوي أو القائل | الصفحة |", "|--|------------------------------|-----------|-----|"]
    for n, v in enumerate(sorted(hadiths.values(), key=lambda v: sort_key(v[0])), 1):
        pg = pageref(v[2]) if v[2] else "—"
        idx.append(f"| {n} | «{v[0]}» | {v[1]} | {pg} |")
    text += "\n".join(idx) + "\n"

    # ---------- bibliography ----------
    entries, seen = [], set()
    for pid, _ in PARTS:
        p = f"{D}/{pid}_biblio.md"
        if not os.path.exists(p): continue
        for ln in open(p, encoding="utf-8"):
            ln = ln.strip()
            if not ln.startswith("- "): continue
            e = ln[2:].strip()
            if "القرآن الكريم" == re.sub(r"[*.]", "", e).strip(): continue
            k = re.sub(r"[^ء-يa-zA-Z0-9]", "", norm(e))
            k2 = re.sub(r"\(ت[^)]*\)", "", e)
            k2 = re.sub(r"[^ء-يa-zA-Z0-9]", "", norm(k2))[:70]
            if k in seen or k2 in seen: continue
            seen.add(k); seen.add(k2)
            entries.append(e)
    web = [e for e in entries if "http" in e]
    books = [e for e in entries if "http" not in e]
    bib = [PB, "## ثالثًا: فهرس المصادر والمراجع\n", "**القرآن الكريم.**\n", "### أولًا: الكتب والرسائل والبحوث والقوانين\n"]
    for n, e in enumerate(sorted(books, key=sort_key), 1):
        bib.append(f"{n}. {e}")
    bib += ["", "### ثانيًا: المواقع الإلكترونية\n"]
    for n, e in enumerate(sorted(web, key=sort_key), 1):
        bib.append(f"{n}. {e}")
    text += "\n".join(bib) + "\n"

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
