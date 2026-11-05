/* بيانات تجريبية للوحة المعلّم في الفيديو التعليمي فقط (أسماء متخيّلة). */
const Cloud = (() => {
  const user = { id: "t", email: "teacher@example.com" };
  const profile = { role: "teacher", full_name: "أ. عبد الله" };
  const ls = []; const now = Date.now(); const day = 864e5;
  const classes = location.hash.startsWith("#account") ? [] : [{ id: "c1", name: "الصف الثاني الثانوي (أ)", code: "K7Q2MX" }];
  const iso = (d) => new Date(now - d * day).toISOString();
  const lv = (arr) => Object.fromEntries(arr.map(([n, best, passed, attempts]) => [n, { best, passed, attempts }]));
  const rows = [
    { student_id: "s1", full_name: "سارة أحمد", data: { levels: lv([[1, .92, true, 1], [2, .83, true, 2], [3, .58, false, 1]]), known: Array.from({ length: 31 }, (_, i) => i) }, answers_total: 214, answers_ok: 181, attempts_total: 4, last_active: iso(.2) },
    { student_id: "s2", full_name: "خالد يوسف", data: { levels: lv([[1, .5, false, 2]]), known: [1, 2, 3] }, answers_total: 38, answers_ok: 17, attempts_total: 2, last_active: iso(11) },
    { student_id: "s3", full_name: "نورة سالم", data: { levels: lv([[1, 1, true, 1], [2, .92, true, 1], [3, .83, true, 1], [4, .75, true, 3], [5, .67, false, 1]]), known: Array.from({ length: 64 }, (_, i) => i) }, answers_total: 402, answers_ok: 351, attempts_total: 7, last_active: iso(1.4) },
    { student_id: "s4", full_name: "عبد الرحمن علي", data: {}, answers_total: 0, answers_ok: 0, attempts_total: 0, last_active: null },
    { student_id: "s5", full_name: "مريم حسن", data: { levels: lv([[1, .83, true, 1], [2, .75, true, 1]]), known: Array.from({ length: 22 }, (_, i) => i) }, answers_total: 156, answers_ok: 121, attempts_total: 3, last_active: iso(2.6) },
    { student_id: "s6", full_name: "يوسف إبراهيم", data: { levels: lv([[1, .75, true, 2], [2, .58, false, 1]]), known: Array.from({ length: 9 }, (_, i) => i) }, answers_total: 97, answers_ok: 63, attempts_total: 3, last_active: iso(4) },
  ];
  return {
    enabled: true, ready: true, user, profile,
    init: async () => { ls.forEach((f) => f(user, profile)); }, onChange: (f) => ls.push(f),
    signUp: async () => ({}), signIn: async () => {}, signOut: async () => {}, updateName: async () => {},
    pushProgress() {}, pullProgress: async () => null, logAttempt() {}, logAnswer() {}, flush() {},
    // في صفحة الحساب تبدأ القائمة فارغة ليظهر إنشاء الفصل؛ وفي لوحة المعلّم يكون الفصل موجوداً
    myClasses: async () => classes.slice(),
    createClass: async (name) => { const c = { id: "c1", name: name || "الصف الثاني الثانوي (أ)", code: "K7Q2MX" }; classes.splice(0, classes.length, c); return c; }, joinClass: async () => ({ name: "الصف الثاني الثانوي (أ)" }),
    leaveClass: async () => {}, deleteClass: async () => {}, removeStudent: async () => {},
    overview: async () => rows,
    itemStats: async () => [
      { item: "تمّ + مصدر (تمّ افتتاحُ…)", item_kind: "dict", total: 26, wrong: 17 },
      { item: "أكّدَ على", item_kind: "dict", total: 19, wrong: 11 },
      { item: "يلعب دوراً (كبيراً) في", item_kind: "dict", total: 22, wrong: 10 },
      { item: "من قِبَل (فُعل الشيء من قبل فلان)", item_kind: "dict", total: 14, wrong: 6 },
      { item: "السيف أصدق إنباءً", item_kind: "text", total: 9, wrong: 4 },
    ],
    qtypeStats: async () => [
      { qtype: "better", total: 180, ok: 158 }, { qtype: "judge", total: 90, ok: 71 }, { qtype: "fus", total: 140, ok: 109 },
      { qtype: "spot", total: 120, ok: 66 }, { qtype: "rewrite", total: 48, ok: 21 }, { qtype: "complete", total: 70, ok: 52 },
    ],
    studentDetail: async (sid) => sid === "s2" ? ({
      answers: [
        { qtype: "spot", item: "تمّ + مصدر (تمّ افتتاحُ…)", item_kind: "dict", ok: false },
        { qtype: "fus", item: "تمّ + مصدر (تمّ افتتاحُ…)", item_kind: "dict", ok: false },
        { qtype: "better", item: "أكّدَ على", item_kind: "dict", ok: false },
        { qtype: "rewrite", item: "أكّدَ على", item_kind: "dict", ok: false },
        { qtype: "better", item: "بالنسبة لـ…", item_kind: "dict", ok: true },
        { qtype: "judge", item: "سوف لن", item_kind: "dict", ok: false },
      ],
      attempts: [{ level: 1, score: 6, total: 12, created_at: iso(11) }, { level: 1, score: 5, total: 12, created_at: iso(13) }],
    }) : ({
      answers: [
        { qtype: "spot", item: "تمّ + مصدر (تمّ افتتاحُ…)", item_kind: "dict", ok: false },
        { qtype: "fus", item: "تمّ + مصدر (تمّ افتتاحُ…)", item_kind: "dict", ok: false },
        { qtype: "rewrite", item: "أكّدَ على", item_kind: "dict", ok: false },
        { qtype: "better", item: "أكّدَ على", item_kind: "dict", ok: true },
        { qtype: "fus", item: "سوف لن", item_kind: "dict", ok: true },
        { qtype: "better", item: "بالنسبة لـ…", item_kind: "dict", ok: true },
      ],
      attempts: [{ level: 3, score: 7, total: 12, created_at: iso(.3) }, { level: 2, score: 10, total: 12, created_at: iso(2) }, { level: 1, score: 11, total: 12, created_at: iso(5) }],
    }),
  };
})();
