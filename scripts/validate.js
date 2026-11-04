#!/usr/bin/env node
/* يتحقق من سلامة بيانات الموقع: node scripts/validate.js [--quiet]
   يحمّل ملفات البيانات بالترتيب نفسه الذي في index.html ويفحص:
   - صيغة كل مدخل ونصّ وحقوله المطلوبة
   - أن نمط الكشف يطابق الجملة العرنجية ولا يطابق الفصيحة
   - التكرار، والعصور، والمراحل، وصيغة الإحالة القرآنية، وصيغة الاستزادة */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1])
  .filter((s) => /data-|content\//.test(s))
  .filter((s) => { const i = process.argv.indexOf("--only"); return i < 0 || !/content\//.test(s) || /more-base/.test(s) || s === process.argv[i + 1]; });
const ctx = {};
vm.createContext(ctx);
let code = "";
for (const s of scripts) code += fs.readFileSync(path.join(root, s), "utf8") + "\n;\n";
code += "this.__out = { DICT, TEXTS, ERAS, CATS, DICT_EXTRA, TEXTS_EXTRA, DICT_RAW, TEXTS_RAW };";
try { vm.runInContext(code, ctx, { filename: "data" }); } catch (e) { console.error("خطأ في تحميل الملفات:", e.message); process.exit(1); }
const { DICT, TEXTS, ERAS, CATS, DICT_EXTRA, TEXTS_EXTRA, DICT_RAW, TEXTS_RAW } = ctx.__out;

const strip = (s) => String(s).replace(/[ً-ْٰـ]/g, "");
const errors = [], warns = [];
const KINDS = ["قرآن", "حديث", "شعر", "خطبة", "رسالة", "وصية", "قول", "نثر", "مثل", "حكمة", "رجز", "مقامة"];
const SURAH_RE = /^سورة\s+[ء-ي ]+:\s*\d+(?:\s*[–-]\s*\d+)?/;

// ===== المعجم =====
const nArn = new Map();
DICT_EXTRA.forEach((o, i) => {
  const where = `DICT_EXTRA[${i}] «${o.arn}»`;
  ["lv", "cat", "arn", "fus", "note", "bad", "good", "re"].forEach((k) => { if (o[k] === undefined || o[k] === "") errors.push(`${where}: الحقل ${k} مفقود`); });
  if (Object.prototype.toString.call(o.re) !== "[object RegExp]" && typeof o.re !== "string") errors.push(`${where}: re يجب أن يكون تعبيراً نمطياً /.../`);
  if (![1, 2, 3, 4, 5].includes(o.lv)) errors.push(`${where}: lv يجب أن يكون من ١ إلى ٥`);
  if (!CATS[o.cat]) errors.push(`${where}: cat غير معروف (${o.cat})`);
  if (o.sh && (!Array.isArray(o.sh) || o.sh.length !== 3 || !ERAS[o.sh[2]])) errors.push(`${where}: sh يجب أن يكون [نص، مرجع، عصر]`);
  const k = strip(o.arn).replace(/\s+/g, " ").trim();
  if (nArn.has(k)) errors.push(`${where}: مكرر مع ${nArn.get(k)}`); else nArn.set(k, where);
});
DICT_RAW.forEach((r) => { const k = strip(r[2]).replace(/\s+/g, " ").trim(); if (nArn.has(k)) errors.push(`${nArn.get(k)}: مكرر مع مدخل أصلي`); });
DICT.forEach((d) => {
  const re = new RegExp(strip(d.re));
  if (!re.test(strip(d.bad))) errors.push(`«${d.arn}»: النمط لا يطابق الجملة العرنجية: ${d.bad}`);
  if (re.test(strip(d.good))) errors.push(`«${d.arn}»: النمط يطابق الجملة الفصيحة: ${d.good}`);
  if (d.more) {
    if (typeof d.more.rule !== "string" || !Array.isArray(d.more.examples)) errors.push(`«${d.arn}»: more يجب أن يكون {rule, examples:[...], tip?}`);
  } else warns.push(`«${d.arn}»: بلا استزادة`);
  if (d.shahid && d.shahid.era === "nabawi" && /^سورة/.test(d.shahid.ref) && !SURAH_RE.test(d.shahid.ref)) warns.push(`«${d.arn}»: صيغة المرجع القرآني غير قياسية: ${d.shahid.ref}`);
});

// ===== المختارات =====
const seenT = new Map();
TEXTS_EXTRA.forEach((o, i) => {
  const where = `TEXTS_EXTRA[${i}] «${o.title}»`;
  ["lv", "era", "kind", "title", "author", "text", "ref", "taste"].forEach((k) => { if (!o[k]) errors.push(`${where}: الحقل ${k} مفقود`); });
  if (!ERAS[o.era]) errors.push(`${where}: era غير معروف (${o.era})`);
  if (![1, 2, 3, 4, 5, 6, 7].includes(o.lv)) errors.push(`${where}: lv يجب أن يكون من ١ إلى ٧`);
  if (o.era === "jahili" && o.lv !== 7) errors.push(`${where}: نصوص الجاهلي في المرحلة ٧`);
  if (o.lv === 7 && o.era !== "jahili") errors.push(`${where}: المرحلة ٧ للجاهلي فقط`);
  if (!KINDS.includes(o.kind)) errors.push(`${where}: kind غير معروف (${o.kind}). المسموح: ${KINDS.join("، ")}`);
  if (o.kind === "قرآن" && !SURAH_RE.test(o.ref)) errors.push(`${where}: مرجع القرآن يجب أن يكون «سورة الاسم: 12» أو «سورة الاسم: 12–15»`);
  if (/\.\.\.(?! )|(?<! )\.\.\./.test(o.text.replace(/\n/g, " "))) warns.push(`${where}: الفاصل بين الشطرين يجب أن يكون " ... "`);
  if (o.more) {
    const m = o.more;
    if (!Array.isArray(m.words) || typeof m.meaning !== "string") errors.push(`${where}: more يجب أن يكون {words:[[كلمة، معنى]], meaning, balagha?, context?}`);
    else m.words.forEach((w) => { if (!Array.isArray(w) || w.length !== 2) errors.push(`${where}: كل عنصر في words يجب أن يكون [كلمة، معنى]`); });
  }
  const k = strip(o.text).replace(/[«»﴿﴾.،\s]/g, "").slice(0, 40);
  if (seenT.has(k)) errors.push(`${where}: مكرر مع ${seenT.get(k)}`); else seenT.set(k, where);
});
TEXTS_RAW.forEach((r) => { const k = strip(r[5]).replace(/[«»﴿﴾.،\s]/g, "").slice(0, 40); if (seenT.has(k)) errors.push(`${seenT.get(k)}: مكرر مع نص أصلي`); });
TEXTS.forEach((t) => { if (!t.more) warns.push(`نص «${t.title}»: بلا استزادة`); });

// ===== الإحصاء =====
const count = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {});
console.log(`المعجم: ${DICT.length} (الأصلي ${DICT_RAW.length} + الإضافات ${DICT_EXTRA.length})`, JSON.stringify(count(DICT, (d) => d.cat)), JSON.stringify(count(DICT, (d) => d.level)));
console.log(`المختارات: ${TEXTS.length} (الأصلي ${TEXTS_RAW.length} + الإضافات ${TEXTS_EXTRA.length})`, JSON.stringify(count(TEXTS, (t) => t.era)), JSON.stringify(count(TEXTS, (t) => t.level)));
console.log(`بلا استزادة: معجم ${DICT.filter((d) => !d.more).length}، نصوص ${TEXTS.filter((t) => !t.more).length}`);
if (!process.argv.includes("--quiet")) warns.filter((w) => !/بلا استزادة/.test(w)).slice(0, 40).forEach((w) => console.log("تنبيه:", w));
if (errors.length) { console.log(`\n${errors.length} خطأ:`); errors.slice(0, 80).forEach((e) => console.log("✗", e)); process.exit(1); }
console.log("✓ لا أخطاء");
