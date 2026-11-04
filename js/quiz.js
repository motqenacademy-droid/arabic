/* =========================================================
   محرّك الأسئلة: توليد الأسئلة المتنوعة وعرضها
   ========================================================= */
const U = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DIAC = /[ً-ْٰـ]/g;
  const strip = (s) => String(s).replace(DIAC, "");
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ar = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const verse = (t) => t.replace(/ \.\.\. /g, "  ");
  // نص بلا تشكيل مع خريطة المواضع إلى الأصل
  function stripped(s) {
    let out = "", map = [];
    for (let i = 0; i < s.length; i++) {
      if (/[ً-ْٰـ]/.test(s[i])) continue;
      out += s[i]; map.push(i);
    }
    map.push(s.length);
    return { out, map };
  }
  // كل مواضع النمط في النص الأصلي [{s,e}]
  function findAll(text, reSrc) {
    const { out, map } = stripped(text);
    const re = new RegExp(strip(reSrc), "g");
    const res = []; let m;
    while ((m = re.exec(out))) {
      let s = m.index, e = m.index + m[0].length;
      while (s < e && /\s/.test(out[s])) s++;
      while (e > s && /\s/.test(out[e - 1])) e--;
      if (e > s) res.push({ s: map[s], e: map[e - 1] + 1 });
      if (m[0].length === 0) re.lastIndex++;
    }
    return res;
  }
  function authorName(a) { return a.replace(/\s*(?:\(|،| إلى | لكُميل| يروي).*$/, "").trim(); }
  return { esc, strip, shuffle, pick, ar, verse, stripped, findAll, authorName };
})();

const Quiz = (() => {
  const { esc, strip, shuffle, pick, ar, verse, findAll, authorName } = U;
  const PUNCT = /[«»﴿﴾،.؟!:؛()…"]/g;

  function eraTag(era) { return `<span class="tag ${era}">${ERAS[era]}</span>`; }

  function dictExplain(d) {
    return `<div>«${esc(d.arn)}» عرنجية، والفصيح: <strong>${esc(d.fus)}</strong>. ${esc(d.note)}</div>
      <div class="model"><span>✓</span> ${esc(d.good)}</div>
      ${d.shahid ? `<blockquote>${esc(d.shahid.text)} <small>(${esc(d.shahid.ref)})</small></blockquote>` : ""}`;
  }
  function textExplain(t) {
    return `<div><strong>${esc(t.title)}</strong> — ${esc(t.author)}، ${eraTag(t.era)} <small>${esc(t.ref)}</small></div>
      <blockquote>${esc(verse(t.text))}</blockquote>
      <div class="taste-mini"><b>لمسة تذوّق:</b> ${esc(t.taste)}</div>`;
  }
  function distinct(list, key, n, exclude) {
    const seen = new Set([strip(exclude)]), out = [];
    for (const x of shuffle(list)) {
      const k = strip(key(x));
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(key(x));
      if (out.length >= n) break;
    }
    return out;
  }
  const mc = (correct, wrongs, extra = {}) => ({
    kind: "mc",
    options: shuffle([{ html: esc(correct), ok: true }, ...wrongs.map((w) => ({ html: esc(w), ok: false }))]),
    ...extra,
  });

  /* ===== المولّدات ===== */
  const G = {
    better(d) {
      return { type: "better", prompt: "أيّ العبارتين أجرى على لسان العرب؟",
        ...mc(d.good, [d.bad]), explain: dictExplain(d), big: true };
    },
    judge(d) {
      const isGood = Math.random() < 0.5;
      return { type: "judge", prompt: "اقرأ الجملة، ثم احكم عليها:",
        body: `<p class="q-sentence">${esc(isGood ? d.good : d.bad)}</p>`,
        kind: "mc", options: [{ html: "فصيحة ✓", ok: isGood }, { html: "عرنجية ✗", ok: !isGood }],
        explain: dictExplain(d) };
    },
    fus(d) {
      const same = DICT.filter((x) => x.id !== d.id && x.cat === d.cat);
      const wr = distinct(same.length >= 3 ? same : DICT.filter((x) => x.id !== d.id), (x) => x.fus, 3, d.fus);
      return { type: "fus", prompt: `ما البديل الفصيح عن «${esc(d.arn)}»؟`,
        body: `<p class="q-sentence muted">${esc(d.bad)}</p>`, ...mc(d.fus, wr), explain: dictExplain(d) };
    },
    src(d) {
      if (!d.src || d.src === "—") return G.fus(d);
      const wr = distinct(DICT.filter((x) => x.id !== d.id && x.src !== "—"), (x) => x.src, 3, d.src);
      const q = { type: "src", prompt: `من أيّ عبارة أعجمية نُقل «${esc(d.arn)}»؟`, ...mc(d.src, wr), explain: dictExplain(d) };
      q.ltr = true; return q;
    },
    spot(d) {
      const hits = findAll(d.bad, d.re);
      if (!hits.length) return G.better(d);
      const h = hits[0];
      const words = []; const re = /\S+/g; let m;
      while ((m = re.exec(d.bad))) words.push({ w: m[0], s: m.index, e: m.index + m[0].length });
      words.forEach((w) => { w.ok = w.s < h.e && w.e > h.s; });
      return { type: "spot", kind: "spot", prompt: "اضغط على كلمةٍ من موضع العرنجية في الجملة:",
        words, explain: dictExplain(d) };
    },
    shahid(d) {
      if (!d.shahid) {
        const alt = DICT.filter((x) => x.shahid && x.level <= d.level);
        d = pick(alt.length ? alt : DICT.filter((x) => x.shahid));
      }
      const wr = distinct(DICT.filter((x) => x.shahid && x.shahid.text !== d.shahid.text), (x) => x.shahid.text, 3, d.shahid.text);
      return { type: "shahid", prompt: `أيّ هذه الشواهد يصلح دليلاً على «${esc(d.fus)}» بدلاً من «${esc(d.arn)}»؟`,
        ...mc(d.shahid.text, wr), explain: dictExplain(d), serif: true };
    },
    rewrite(d) {
      return { type: "rewrite", kind: "rewrite", prompt: "أعد كتابة الجملة بالفصحى، متجنّباً التركيب الدخيل:",
        body: `<p class="q-sentence">${esc(d.bad)}</p>`, d, explain: dictExplain(d) };
    },
    era(t) {
      return { type: "era", prompt: "إلى أيّ عصر ينتمي هذا النص؟",
        body: `<blockquote class="q-text">${esc(verse(t.text))}</blockquote>`,
        kind: "mc", options: shuffle(Object.keys(ERAS).map((k) => ({ html: ERAS[k], ok: k === t.era }))),
        explain: textExplain(t) };
    },
    author(t) {
      const name = authorName(t.author);
      const pool = TEXTS.filter((x) => x.kind !== "قرآن" && x.kind !== "حديث");
      const wr = distinct(pool, (x) => authorName(x.author), 3, name);
      return { type: "author", prompt: "مَن قائل هذا النص؟",
        body: `<blockquote class="q-text">${esc(verse(t.text))}</blockquote>`,
        ...mc(name, wr), explain: textExplain(t) };
    },
    complete(t) {
      const toks = []; const re = /\S+/g; let m;
      while ((m = re.exec(t.text))) toks.push({ w: m[0], s: m.index });
      const cands = toks.map((x, i) => ({ ...x, i, clean: x.w.replace(PUNCT, "") }))
        .filter((x) => x.i > 0 && x.w !== "..." && strip(x.clean).length >= 3);
      if (!cands.length) return G.era(t);
      const c = pick(cands);
      const len = strip(c.clean).length;
      const pool = [];
      TEXTS.forEach((x) => { if (x.id !== t.id && x.kind !== "قرآن") x.text.split(/\s+/).forEach((w) => {
        const cl = w.replace(PUNCT, ""); const L = strip(cl).length;
        if (L >= 3 && Math.abs(L - len) <= 2 && w !== "...") pool.push(cl);
      }); });
      const wr = distinct(pool, (x) => x, 3, c.clean);
      const startClean = c.s + c.w.indexOf(c.clean[0]);
      const before = t.text.slice(0, startClean), after = t.text.slice(startClean + c.clean.length);
      const body = `<blockquote class="q-text">${esc(verse(before))}<span class="blank">………</span>${esc(verse(after))}</blockquote>
        <p class="q-meta">${esc(t.author)} — ${eraTag(t.era)}</p>`;
      return { type: "complete", prompt: "أكمل النصّ بالكلمة الساقطة:", body, ...mc(c.clean, wr), explain: textExplain(t), serif: true };
    },
  };
  const TEXT_TYPES = new Set(["era", "author", "complete"]);

  function textPoolFor(type, texts) {
    let p = texts.filter((t) => t.kind !== "قرآن");
    if (type === "author") p = p.filter((t) => t.kind !== "حديث");
    if (!p.length) p = TEXTS.filter((t) => t.kind !== "قرآن" && (type !== "author" || t.kind !== "حديث"));
    return p;
  }

  /* توليد سؤال واحد من نوع معيّن ومن مجموعة معيّنة */
  function one(type, dictPool, textPool, used) {
    used = used || new Set();
    if (TEXT_TYPES.has(type)) {
      const pool = textPoolFor(type, textPool);
      let t = pick(pool), tries = 0;
      while (used.has(type + t.id) && tries++ < 20) t = pick(pool);
      used.add(type + t.id);
      return G[type](t);
    }
    let pool = dictPool;
    if (type === "shahid") { const p = dictPool.filter((d) => d.shahid); if (p.length) pool = p; }
    if (type === "src") { const p = dictPool.filter((d) => d.src !== "—"); if (p.length) pool = p; }
    let d = pick(pool), tries = 0;
    while (used.has(type + d.id) && tries++ < 20) d = pick(pool);
    used.add(type + d.id);
    return G[type](d);
  }

  /* أسئلة اختبار مرحلة */
  function forLevel(L) {
    const own = L.n === 6 ? DICT : DICT.filter((d) => d.level === L.n);
    const review = DICT.filter((d) => d.level < L.n);
    const texts = TEXTS.filter((t) => t.level === L.n);
    const used = new Set(), qs = [];
    Object.entries(L.q).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        const dp = review.length && Math.random() < 0.2 ? review : own;
        qs.push(one(type, dp, texts, used));
      }
    });
    return shuffle(qs);
  }

  /* ===== العرض ===== */
  function render(box, q, onAnswered) {
    const head = `<div class="q-type">${esc(QTYPES[q.type])}</div><h3 class="q-prompt">${q.prompt}</h3>${q.body || ""}`;
    if (q.kind === "mc") {
      box.innerHTML = head + `<div class="quiz-options ${q.big ? "big" : ""} ${q.serif ? "serif" : ""} ${q.ltr ? "ltr" : ""} ${q.options.length > 2 ? "grid2" : ""}">
        ${q.options.map((o, i) => `<button class="option" data-i="${i}">${o.html}</button>`).join("")}</div>
        <div class="quiz-feedback" hidden></div>`;
      box.querySelector(".quiz-options").addEventListener("click", (e) => {
        const b = e.target.closest(".option"); if (!b || b.disabled) return;
        const ok = q.options[+b.dataset.i].ok;
        box.querySelectorAll(".option").forEach((o) => { o.disabled = true; if (q.options[+o.dataset.i].ok) o.classList.add("correct"); });
        if (!ok) b.classList.add("wrong");
        feedback(box, q, ok); onAnswered(ok);
      });
    } else if (q.kind === "spot") {
      box.innerHTML = head + `<p class="spot-line">${q.words.map((w, i) => `<button class="word" data-i="${i}">${esc(w.w)}</button>`).join(" ")}</p>
        <div class="quiz-feedback" hidden></div>`;
      box.querySelector(".spot-line").addEventListener("click", (e) => {
        const b = e.target.closest(".word"); if (!b || box.dataset.done) return;
        box.dataset.done = 1;
        const ok = q.words[+b.dataset.i].ok;
        box.querySelectorAll(".word").forEach((w) => { w.disabled = true; if (q.words[+w.dataset.i].ok) w.classList.add("target"); });
        if (!ok) b.classList.add("wrong");
        feedback(box, q, ok); onAnswered(ok);
      });
    } else if (q.kind === "rewrite") {
      box.innerHTML = head + `<textarea class="rewrite-input" rows="2" placeholder="اكتب الجملة هنا…"></textarea>
        <div class="quiz-actions"><button class="btn primary rw-check">تحقّق</button><button class="btn rw-skip">لا أعرف</button></div>
        <div class="quiz-feedback" hidden></div>`;
      const ta = box.querySelector(".rewrite-input");
      const done = (ok, msg) => {
        ta.disabled = true; box.querySelectorAll(".rw-check,.rw-skip").forEach((b) => b.remove());
        feedback(box, q, ok, msg); onAnswered(ok);
      };
      box.querySelector(".rw-check").addEventListener("click", () => {
        const v = ta.value.trim();
        if (strip(v).replace(/\s/g, "").length < 3) { ta.focus(); return; }
        if (strip(v).replace(/[\s.،]/g, "") === strip(q.d.bad).replace(/[\s.،]/g, "")) return done(false, "لم تغيّر الجملة.");
        if (findAll(v, q.d.re).length) return done(false, "ما زال التركيب الدخيل في جملتك.");
        const words = (x) => new Set(strip(x).replace(/[^\u0621-\u064A\s]/g, " ").split(/\s+/).map((w) => w.replace(/^(?:و|ف)?(?:ال)?/, "")).filter((w) => w.length >= 3));
        const ref = new Set([...words(q.d.bad), ...words(q.d.good)]);
        const shared = [...words(v)].filter((w) => ref.has(w)).length;
        if (shared < Math.min(2, ref.size)) return done(false, "جملتك بعيدة عن معنى الأصل؛ حافظ على المعنى وغيّر التركيب.");
        const other = DICT.filter((d) => findAll(v, d.re).length);
        if (other.length) return done(false, `خلت جملتك من التركيب المقصود، لكن فيها «${esc(other[0].arn)}».`);
        done(true, "خلت جملتك من التركيب الدخيل. قارنها بالنموذج:");
      });
      box.querySelector(".rw-skip").addEventListener("click", () => done(false, "هذا هو النموذج:"));
      ta.focus();
    }
  }
  function feedback(box, q, ok, msg) {
    const fb = box.querySelector(".quiz-feedback");
    fb.innerHTML = `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "أحسنت! ذائقةٌ عربية." : "لم تُصب هذه المرة."}${msg ? ` <span class="verdict-msg">${msg}</span>` : ""}</div>${q.explain}`;
    fb.hidden = false;
  }

  /* اختبار متسلسل */
  function run(container, questions, onFinish) {
    let i = 0, score = 0;
    container.innerHTML = `<div class="card quiz-card">
      <div class="quiz-top"><span class="q-progress"></span><span>النتيجة: <strong class="q-score">٠</strong></span></div>
      <div class="bar"><span></span></div>
      <div class="q-box"></div>
      <div class="quiz-actions"><button class="btn primary q-next" hidden>التالي</button></div></div>`;
    const box = container.querySelector(".q-box"), next = container.querySelector(".q-next");
    const bar = container.querySelector(".bar span");
    function show() {
      if (i >= questions.length) return onFinish(score, questions.length);
      container.querySelector(".q-progress").textContent = `السؤال ${ar(i + 1)} من ${ar(questions.length)}`;
      bar.style.width = (i / questions.length * 100) + "%";
      next.hidden = true; delete box.dataset.done;
      render(box, questions[i], (ok) => {
        if (ok) score++;
        container.querySelector(".q-score").textContent = ar(score);
        next.textContent = i + 1 >= questions.length ? "النتيجة" : "التالي";
        next.hidden = false; next.focus({ preventScroll: true });
      });
    }
    next.addEventListener("click", () => { i++; show(); box.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
    show();
  }

  return { G, one, forLevel, render, run, dictExplain, eraTag };
})();
