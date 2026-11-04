/* =========================================================
   تجميع البيانات: يضمّ المصفوفات الأصلية والإضافات وشروح الاستزادة
   ========================================================= */
const DICT = (() => {
  const norm = (s) => String(s).replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();
  const MD = typeof MORE_DICT !== "undefined" ? MORE_DICT : {};
  const list = [];
  const seen = new Set();
  const add = (o) => {
    const k = norm(o.arn);
    if (seen.has(k)) return;
    seen.add(k);
    o.id = list.length;
    o.re = typeof o.re === "string" ? o.re : o.re.source;
    o.more = o.more || MD[o.arn] || MD[k] || null;
    list.push(o);
  };
  DICT_RAW.forEach((r) => add({
    level: r[0], cat: r[1], arn: r[2], fus: r[3], src: r[4], note: r[5], bad: r[6], good: r[7], re: r[8],
    shahid: r[9] ? { text: r[9][0], ref: r[9][1], era: r[9][2] } : null, more: r[10] || null,
  }));
  DICT_EXTRA.forEach((o) => add({
    level: o.lv, cat: o.cat, arn: o.arn, fus: o.fus, src: o.src || "—", note: o.note, bad: o.bad, good: o.good, re: o.re,
    shahid: o.sh ? { text: o.sh[0], ref: o.sh[1], era: o.sh[2] } : null, more: o.more || null,
  }));
  return list;
})();

const TEXTS = (() => {
  const norm = (s) => String(s).replace(/[ً-ْٰـ«»﴿﴾.،\s]/g, "");
  const MT = typeof MORE_TEXT !== "undefined" ? MORE_TEXT : {};
  const list = [];
  const seen = new Set();
  const add = (o) => {
    const k = norm(o.text).slice(0, 40);
    if (seen.has(k)) return;
    seen.add(k);
    o.id = list.length;
    o.more = o.more || MT[o.title] || null;
    list.push(o);
  };
  TEXTS_RAW.forEach((r) => add({ level: r[0], era: r[1], kind: r[2], title: r[3], author: r[4], text: r[5], ref: r[6], taste: r[7], audio: r[8] || null, more: r[9] || null }));
  TEXTS_EXTRA.forEach((o) => add({ level: o.lv, era: o.era, kind: o.kind, title: o.title, author: o.author, text: o.text, ref: o.ref, taste: o.taste, audio: o.audio || null, more: o.more || null }));
  return list;
})();
