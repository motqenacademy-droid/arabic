"""Create an Arabic RTL reference.docx for pandoc (thesis formatting)."""
import sys
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FONT = "Traditional Arabic"
src, dst = sys.argv[1], sys.argv[2]
d = Document(src)

def set_font(style, size, bold=None, color=None):
    f = style.font
    f.name = FONT
    f.size = Pt(size)
    if bold is not None:
        f.bold = bold
    if color is not None:
        f.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts"); rpr.append(rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), FONT)
    for a in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        if rf.get(qn(a)) is not None:
            del rf.attrib[qn(a)]
    for tag in ("w:szCs",):
        e = rpr.find(qn(tag))
        if e is None:
            e = OxmlElement(tag); rpr.append(e)
        e.set(qn("w:val"), str(int(size * 2)))
    if bold:
        if rpr.find(qn("w:bCs")) is None:
            rpr.append(OxmlElement("w:bCs"))
    if rpr.find(qn("w:rtl")) is None:
        rpr.append(OxmlElement("w:rtl"))

def para_rtl(style, align=WD_ALIGN_PARAGRAPH.JUSTIFY, before=0, after=6, line=1.15, indent=None):
    pf = style.paragraph_format
    pf.alignment = align
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    if indent is not None:
        pf.first_line_indent = Cm(indent)
    ppr = style.element.get_or_add_pPr()
    if ppr.find(qn("w:bidi")) is None:
        ppr.append(OxmlElement("w:bidi"))

styles = d.styles
black = RGBColor(0, 0, 0)
for name, size, bold, align, before, after, ind in [
    ("Normal", 16, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 0, 4, None),
    ("Body Text", 16, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 0, 4, 1.0),
    ("First Paragraph", 16, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 0, 4, 1.0),
    ("Compact", 16, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 0, 2, None),
    ("Block Text", 15, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 4, 4, None),
    ("Title", 26, True, WD_ALIGN_PARAGRAPH.CENTER, 12, 12, None),
    ("Subtitle", 20, True, WD_ALIGN_PARAGRAPH.CENTER, 6, 6, None),
    ("Heading 1", 22, True, WD_ALIGN_PARAGRAPH.CENTER, 18, 12, None),
    ("Heading 2", 19, True, WD_ALIGN_PARAGRAPH.RIGHT, 14, 6, None),
    ("Heading 3", 17, True, WD_ALIGN_PARAGRAPH.RIGHT, 10, 4, None),
    ("Heading 4", 16, True, WD_ALIGN_PARAGRAPH.RIGHT, 8, 4, None),
    ("Footnote Text", 12, False, WD_ALIGN_PARAGRAPH.JUSTIFY, 0, 0, None),
]:
    sid = name.replace(" ", "")
    cand = [x for x in styles if x.element.get(qn("w:styleId")) == sid]
    if not cand:
        print("missing", name); continue
    st = cand[0]
    c = st.element.rPr.find(qn("w:color")) if st.element.rPr is not None else None
    if c is not None:
        st.element.rPr.remove(c)
    set_font(st, size, bold, black)
    para_rtl(st, align, before, after, 1.0, ind)
    if name.startswith("Heading"):
        st.font.italic = False

# footnote reference character
for x in styles:
    if x.element.get(qn("w:styleId")) in ("FootnoteReference",):
        set_font(x, 13)

# page setup: A4, margins
sec = d.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)
sec.top_margin = sec.bottom_margin = Cm(2.5)
sec.right_margin = Cm(3.0)
sec.left_margin = Cm(2.5)
# footer with centered page number
fp = sec.footer.paragraphs[0] if sec.footer.paragraphs else sec.footer.add_paragraph()
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run()
for kind, text in (("begin", None), (None, " PAGE "), ("end", None)):
    if kind:
        e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), kind); r._r.append(e)
    else:
        e = OxmlElement("w:instrText"); e.set(qn("xml:space"), "preserve"); e.text = text; r._r.append(e)
r.font.size = Pt(13)
# restart footnote numbering on each page (common in Arabic theses)
sp = sec._sectPr
fnp = OxmlElement("w:footnotePr"); nr = OxmlElement("w:numRestart"); nr.set(qn("w:val"), "eachPage"); fnp.append(nr)
refs = [c for c in sp if c.tag in (qn("w:headerReference"), qn("w:footerReference"))]
if refs:
    refs[-1].addnext(fnp)
else:
    sp.insert(0, fnp)
d.save(dst)
print("ok", dst)
