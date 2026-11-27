# مصادر الرسالة: النوازل الفقهية المتعلقة بالمؤسسات التعليمية

- `drafts/` : نصوص الفصول بصيغة Markdown (pandoc) مع ملفات الإحالات `_links` والمصادر `_biblio` والآيات والأحاديث.
- `build/` : سكربت البناء `build.py` (يجمع الأجزاء، يحذف التراجم المكررة، يبني الفهارس، ويُخرج `build/thesis.docx`)، وقالب Word `reference.docx`، والواجهة والخاتمة والملخصان.
- `tools/shamela.py` : أداة البحث في المكتبة الشاملة عبر خادمها الرسمي (mcp.shamela.ws).
- `BRIEF.md`، `REVISION.md`، `REVISION3.md` : قواعد الكتابة والتوثيق المتبعة.

## البناء على جهازك
المتطلبات: Python 3 ومكتبة python-docx، وpandoc، وLibreOffice (اختياري لمعاينة PDF).

```
cd thesis/src/build
python3 build.py            # يُخرج thesis.docx
soffice --headless --convert-to pdf thesis.docx   # اختياري
```

ملاحظة: كتب الشيخ النبهاني وزلوم (ملفات PDF) و«الدوسية الفقهية» غير محفوظة في المستودع؛ تُنزّل الأولى من موقع ناشرها، والثانية لديك.
