(function () {
  "use strict";
  const { esc, strip, ar, verse, findAll } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const eraTag = Quiz.eraTag;
  const pct = (x) => ar(Math.round(x * 100)) + "٪";
  const LAST = LEVELS.length;

  /* ===== التخزين والتقدّم ===== */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const PKEY = "dhaiqa.progress.v2";
  let P = store.get(PKEY, null) || { levels: {}, known: [], name: "" };
  P.levels = P.levels || {}; P.known = P.known || [];
  let known = new Set(P.known);
  function save() {
    P.known = [...known];
    store.set(PKEY, P);
    if (Cloud.user) Cloud.pushProgress(P);
  }
  const passed = (n) => !!(P.levels[n] && P.levels[n].passed);
  const unlocked = () => true; // المراحل كلها مفتوحة، والترتيب مقترح
  const currentLevel = () => { for (const L of LEVELS) if (!passed(L.n)) return L.n; return LAST + 1; };
  function merge(a, b) {
    const out = { levels: {}, known: [], name: a.name || b.name || "" };
    new Set([...Object.keys(a.levels || {}), ...Object.keys(b.levels || {})]).forEach((k) => {
      const x = (a.levels || {})[k] || {}, y = (b.levels || {})[k] || {};
      out.levels[k] = { passed: !!(x.passed || y.passed), best: Math.max(x.best || 0, y.best || 0), attempts: Math.max(x.attempts || 0, y.attempts || 0) };
    });
    out.known = [...new Set([...(a.known || []), ...(b.known || [])])];
    return out;
  }

  /* ===== الوضع الليلي والقائمة ===== */
  const root = document.documentElement;
  const savedTheme = store.get("theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  $(".theme-toggle").addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next); store.set("theme", next);
  });
  const nav = $(".nav"), navBtn = $(".nav-toggle");
  navBtn.addEventListener("click", () => { const o = nav.classList.toggle("open"); navBtn.setAttribute("aria-expanded", o); });
  nav.addEventListener("click", (e) => { if (e.target.tagName === "A") nav.classList.remove("open"); });

  /* ===== نافذة الاستزادة ===== */
  const modal = $("#modal");
  function openModal(title, html) {
    $("#modal-title").textContent = title; $("#modal-body").innerHTML = html;
    modal.hidden = false; $("#modal-close").focus();
  }
  function closeModal() { modal.hidden = true; }
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  function moreDictHTML(d) {
    const m = d.more || {};
    return `<div class="entry-head" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <span class="arn" style="color:var(--bad);text-decoration:line-through">${esc(d.arn)}</span><span>←</span>
        <strong style="color:var(--good);font-family:var(--serif);font-size:1.3rem">${esc(d.fus)}</strong>
        ${d.src && d.src !== "—" ? `<span class="muted" dir="ltr" style="font-style:italic">${esc(d.src)}</span>` : ""}</div>
      <p>${esc(d.note)}</p>
      ${m.rule ? `<h4>القاعدة والشرح</h4><p>${esc(m.rule)}</p>` : ""}
      <h4>المثال</h4><div class="pair"><div class="b"><span>✗</span>${esc(d.bad)}</div><div class="g"><span>✓</span>${esc(d.good)}</div></div>
      ${m.examples && m.examples.length ? `<h4>أمثلة أخرى صحيحة</h4><ul>${m.examples.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${d.shahid ? `<h4>الشاهد</h4><div class="shahid">${esc(d.shahid.text)}<small>${eraTag(d.shahid.era)} ${esc(d.shahid.ref)}
        ${Audio2.parseRef(d.shahid.ref) ? `<button class="speak quran" data-quran="${esc(d.shahid.ref)}">🔊 تلاوة الحصري</button>` : ""}</small></div>` : ""}
      ${m.tip ? `<h4>نصيحة</h4><p class="tip">${esc(m.tip)}</p>` : ""}
      ${!d.more ? `<p class="muted">لا شرح موسّعاً لهذا المدخل بعد.</p>` : ""}`;
  }
  function moreTextHTML(t) {
    const m = t.more || {};
    return `<div class="mtext">${esc(verse(t.text))}</div>
      <p class="muted" style="text-align:center">${esc(t.author)}، ${eraTag(t.era)} — ${esc(t.ref)}</p>
      <div class="card-actions" style="justify-content:center">${listenBtn(t)}</div>
      ${m.words && m.words.length ? `<h4>معاني المفردات</h4><table class="words-table">${m.words.map((w) => `<tr><td>${esc(w[0])}</td><td>${esc(w[1])}</td></tr>`).join("")}</table>` : ""}
      ${m.meaning ? `<h4>المعنى العام</h4><p>${esc(m.meaning)}</p>` : ""}
      ${m.balagha ? `<h4>البلاغة والجمال</h4><p>${esc(m.balagha)}</p>` : ""}
      ${m.context ? `<h4>المناسبة والقائل</h4><p>${esc(m.context)}</p>` : ""}
      <h4>لمسة تذوّق</h4><p>${esc(t.taste)}</p>`;
  }
  function showMore(kind, id) {
    if (kind === "dict") { const d = DICT[id]; if (d) openModal(`استزادة: ${d.arn}`, moreDictHTML(d)); }
    else { const t = TEXTS[id]; if (t) openModal(`استزادة: ${t.title}`, moreTextHTML(t)); }
  }
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-more]");
    if (m) { const [k, id] = m.dataset.more.split(":"); showMore(k, +id); return; }
    const s = e.target.closest(".speak");
    if (s) {
      if (s.classList.contains("playing")) { Audio2.stop(); return; }
      if (s.dataset.quran) Audio2.playQuran(s.dataset.quran, s);
      else if (s.dataset.id) Audio2.playText(TEXTS[+s.dataset.id], s);
    }
  });

  /* ===== مكوّنات مشتركة ===== */
  function listenBtn(t) {
    const q = t.kind === "قرآن";
    return `<button class="speak ${q ? "quran" : ""}" data-id="${t.id}" title="${q ? "تلاوة الشيخ الحصري" : "استمع"}">🔊 ${q ? "تلاوة الحصري" : "استمع"}</button>`;
  }
  function entryHTML(d) {
    const qref = d.shahid && Audio2.parseRef(d.shahid.ref);
    const sh = d.shahid ? `<div class="shahid">${esc(d.shahid.text)}<small>${eraTag(d.shahid.era)} ${esc(d.shahid.ref)}
      ${qref ? `<button class="speak quran" data-quran="${esc(d.shahid.ref)}">🔊</button>` : ""}</small></div>` : "";
    return `<article class="card entry">
      <div class="entry-meta"><span class="tag lvl">المرحلة ${ar(d.level)}</span><span class="cat">${CATS[d.cat]}</span>${known.has(d.id) ? `<span class="known-badge">✓ حفظته</span>` : ""}</div>
      <div class="entry-head"><span class="arn">${esc(d.arn)}</span><span class="arrow" aria-hidden="true">←</span><span class="fus">${esc(d.fus)}</span></div>
      ${d.src && d.src !== "—" ? `<div class="src">${esc(d.src)}</div>` : ""}
      <p class="explain">${esc(d.note)}</p>
      <div class="pair"><div class="b"><span>✗</span>${esc(d.bad)}</div><div class="g"><span>✓</span>${esc(d.good)}</div></div>
      ${sh}
      <div class="entry-foot"><button class="more-btn" data-more="dict:${d.id}">استزادة</button></div>
    </article>`;
  }
  function textHTML(t) {
    const poem = / \.\.\. /.test(t.text);
    return `<article class="card text-card">
      <header>${eraTag(t.era)}<span class="kind">${esc(t.kind)}</span></header>
      <h3>${esc(t.title)}</h3>
      <div class="body ${poem ? "poem" : ""}">${esc(verse(t.text))}</div>
      <p class="who">${esc(t.author)}، ${esc(t.ref)}</p>
      <div class="taste"><b>لمسة تذوّق: </b>${esc(t.taste)}</div>
      <div class="card-actions">${listenBtn(t)}<button class="more-btn" data-more="text:${t.id}">استزادة</button></div>
    </article>`;
  }

  /* ===== الرئيسة ===== */
  function renderHome() {
    const done = LEVELS.filter((L) => passed(L.n)).length;
    $("#home-stats").innerHTML = [
      [DICT.length, "تركيباً في المعجم"], [TEXTS.length, "نصاً مختاراً"], [Object.keys(ERAS).length, "عصور أدبية"],
      [LEVELS.length, "مراحل متدرّجة"], [Object.keys(QTYPES).length, "أنواع من الأسئلة"],
    ].map(([n, l]) => `<div class="stat"><b>${ar(n)}</b><span>${l}</span></div>`).join("");
    const cur = currentLevel();
    const p = Math.round(done / LEVELS.length * 100);
    $("#home-progress").innerHTML = `<h3>مسيرتك${Cloud.user && Cloud.profile ? `، يا ${esc(Cloud.profile.full_name || "")}` : ""}</h3>
      <div class="bar big"><span style="width:${p}%"></span></div>
      <p>اجتزت <b>${ar(done)}</b> من <b>${ar(LEVELS.length)}</b> مراحل، وحفظت <b>${ar(known.size)}</b> تركيباً.</p>
      ${cur <= LAST ? `<p>المرحلة الحالية: <b>${ar(cur)} — ${esc(LEVELS[cur - 1].title)}</b></p>
        <a class="btn primary" href="#level-${cur}">${done || known.size ? "تابع" : "ابدأ"} المرحلة ${ar(cur)}</a>`
        : `<p class="clean">أتممت الرحلة كلها. أنت ذائق!</p><a class="btn gold" href="#cert">شهادتك</a>`}
      ${!Cloud.user ? `<p class="muted small">${Cloud.enabled ? "أنشئ حساباً ليُحفظ تقدّمك ويتابعك معلّمك." : "يُحفظ تقدّمك في هذا المتصفح."}</p>` : ""}`;
    $("#home-cta").textContent = done ? "تابع رحلة التعلّم" : "ابدأ رحلة التعلّم";
    $("#home-acc").hidden = !Cloud.enabled || !!Cloud.user;
  }
  let dailyI = Math.floor(Date.now() / 86400000) % TEXTS.length;
  function renderDaily() {
    const t = TEXTS[dailyI];
    $("#daily-era").className = "tag " + t.era; $("#daily-era").textContent = ERAS[t.era];
    $("#daily-text").textContent = verse(t.text);
    $("#daily-meta").textContent = `${t.author} — ${t.ref}`;
    $("#daily-actions").innerHTML = `${listenBtn(t)}<button class="more-btn" data-more="text:${t.id}">استزادة</button>`;
  }
  $("#daily-next").addEventListener("click", () => {
    let n; do { n = Math.floor(Math.random() * TEXTS.length); } while (n === dailyI);
    dailyI = n; renderDaily();
  });
  renderDaily();
  $("#principles-list").innerHTML = PRINCIPLES.map((p) => `<li><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p></li>`).join("");

  /* ===== رحلة التعلم ===== */
  function renderPath() {
    $("#path-list").innerHTML = LEVELS.map((L) => {
      const st = P.levels[L.n] || {};
      const lock = !unlocked(L.n);
      const nDict = L.n >= 6 ? "مراجعة شاملة للمعجم" : `${ar(DICT.filter((d) => d.level === L.n).length)} تركيباً`;
      const nText = TEXTS.filter((t) => t.level === L.n).length;
      const nq = Object.values(L.q).reduce((a, b) => a + b, 0);
      const status = st.passed ? `<span class="status ok">✓ اجتزتها (${pct(st.best)})</span>`
        : st.attempts ? `<span class="status cur">أفضل نتيجة ${pct(st.best || 0)}</span>`
        : L.n === currentLevel() ? `<span class="status cur">▶ المقترحة لك الآن</span>` : `<span class="status lock">لم تبدأها</span>`;
      return `<a class="level-card card ${lock ? "locked" : ""} ${st.passed ? "done" : ""}" href="${lock ? "#path" : "#level-" + L.n}" ${lock ? 'aria-disabled="true"' : ""}>
        <div class="lvl-num">${ar(L.n)}</div>
        <div class="lvl-body"><h3>${esc(L.title)}</h3><p class="lvl-sub">${esc(L.sub)}</p>
          <p class="lvl-meta">${nDict}، ${ar(nText)} نصاً، اختبار من ${ar(nq)} سؤالاً</p>${status}</div></a>`;
    }).join("");
  }
  $("#path-list").addEventListener("click", (e) => {
    const a = e.target.closest(".level-card.locked"); if (!a) return;
    e.preventDefault(); a.classList.add("shake"); setTimeout(() => a.classList.remove("shake"), 500);
  });
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("سيُمسح تقدّمك كلّه وما حفظته من تراكيب. أتريد المتابعة؟")) return;
    P = { levels: {}, known: [], name: P.name || "" }; known = new Set(); save(); renderPath();
  });

  /* ===== صفحة المرحلة ===== */
  let levelTab = "lesson";
  function renderLevel(n, tab) {
    const L = LEVELS[n - 1], box = $("#level-view");
    if (!L) { location.hash = "#path"; return; }
    if (!unlocked(n)) {
      box.innerHTML = `<div class="card locked-msg"><h2>🔒 المرحلة ${ar(n)} مغلقة</h2>
        <p>اجتز اختبار المرحلة ${ar(n - 1)} أولاً لتنفتح هذه المرحلة.</p><a class="btn primary" href="#level-${n - 1}">إلى المرحلة ${ar(n - 1)}</a></div>`;
      return;
    }
    levelTab = tab || levelTab;
    const entries = n >= 6 ? [] : DICT.filter((d) => d.level === n);
    const texts = TEXTS.filter((t) => t.level === n);
    const st = P.levels[n] || {};
    const knownHere = entries.filter((d) => known.has(d.id)).length;
    const tabs = [["lesson", "الدرس"], ...(entries.length ? [["entries", `التراكيب (${ar(entries.length)})`]] : []),
      ["texts", `النصوص (${ar(texts.length)})`], ["test", "الاختبار"]];
    if (!tabs.some(([k]) => k === levelTab)) levelTab = "lesson";
    box.innerHTML = `<a class="back" href="#path">→ رحلة التعلّم</a>
      <div class="level-head"><div class="lvl-num big">${ar(n)}</div>
        <div><p class="eyebrow">المرحلة ${ar(n)} من ${ar(LAST)}</p><h2>${esc(L.title)}</h2><p class="section-lead">${esc(L.sub)}</p></div></div>
      <div class="level-progress">
        ${entries.length ? `<span>حفظت ${ar(knownHere)} من ${ar(entries.length)} تركيباً</span>` : ""}
        <span>${st.passed ? `✓ اجتزت الاختبار (${pct(st.best)})` : st.attempts ? `أفضل نتيجة: ${pct(st.best)}` : "لم تختبر بعد"}</span>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${k === levelTab ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
      <div id="level-tab"></div>`;
    box.querySelector(".tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".tab"); if (!b) return;
      levelTab = b.dataset.tab;
      $$(".tab", box).forEach((x) => x.classList.toggle("active", x === b));
      renderTab(L, entries, texts);
    });
    renderTab(L, entries, texts);
  }

  function renderTab(L, entries, texts) {
    const el = $("#level-tab");
    if (levelTab === "lesson") {
      const nextTab = entries.length ? "entries" : "texts";
      el.innerHTML = `<div class="lesson card">
        ${L.lesson.map((p) => `<p>${esc(p)}</p>`).join("")}
        <div class="tip"><b>واجب المرحلة:</b> ${esc(L.tip)}</div>
        ${entries.length ? `<h3>أمثلة من هذه المرحلة</h3><ul class="mini-list">${entries.slice(0, 6).map((d) =>
          `<li><span class="arn">${esc(d.arn)}</span> ← <span class="fus">${esc(d.fus)}</span></li>`).join("")}</ul>` : ""}
        <button class="btn primary" data-goto="${nextTab}">التالي: ${nextTab === "entries" ? "التراكيب" : "النصوص"} ←</button></div>`;
    } else if (levelTab === "entries") {
      el.innerHTML = `<div class="tab-tools"><button class="btn primary" id="start-cards">احفظ بالبطاقات</button>
        <span class="muted">اقرأ التراكيب، ثم احفظها بالبطاقات، ثم انتقل إلى النصوص.</span></div>
        <div class="dict-grid">${entries.map(entryHTML).join("")}</div>
        <div class="tab-foot"><button class="btn primary" data-goto="texts">التالي: النصوص ←</button></div>`;
      $("#start-cards").addEventListener("click", () => flashcards(el, entries, L));
    } else if (levelTab === "texts") {
      el.innerHTML = `<p class="muted">اقرأ كل نصٍّ بصوتٍ مسموع مرتين، واستمع إليه، وافتح «استزادة» لمعاني المفردات والبلاغة، واحفظ ما استطعت.</p>
        <div class="texts-grid">${texts.map(textHTML).join("")}</div>
        <div class="tab-foot"><button class="btn primary" data-goto="test">التالي: الاختبار ←</button></div>`;
    } else if (levelTab === "test") {
      const nq = Object.values(L.q).reduce((a, b) => a + b, 0);
      const st = P.levels[L.n] || {};
      el.innerHTML = `<div class="card test-intro"><h3>اختبار المرحلة ${ar(L.n)}</h3>
        <p>${ar(nq)} سؤالاً متنوّعاً، والنجاح بـ ${ar(Math.round(PASS_RATIO * 100))}٪ فأكثر (${ar(Math.ceil(nq * PASS_RATIO))} إجابة صحيحة).</p>
        <p class="types">${Object.keys(L.q).map((k) => `<span class="chip static">${QTYPES[k]}</span>`).join("")}</p>
        ${st.attempts ? `<p class="muted">محاولاتك: ${ar(st.attempts)}، أفضل نتيجة: ${pct(st.best)}</p>` : ""}
        <button class="btn primary" id="start-test">ابدأ الاختبار</button></div>`;
      $("#start-test").addEventListener("click", () => startTest(el, L));
    }
    el.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
      levelTab = b.dataset.goto;
      $$("#level-view .tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === levelTab));
      renderTab(L, entries, texts);
      $("#level-view .tabs").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }
  let quizContext = "practice", quizLevel = null;
  function startTest(el, L) {
    quizContext = "test"; quizLevel = L.n;
    Quiz.run(el, Quiz.forLevel(L), (s, t) => { quizContext = "practice"; finishTest(el, L, s, t); });
  }

  function finishTest(el, L, score, total) {
    const ratio = score / total, ok = ratio >= PASS_RATIO;
    const st = P.levels[L.n] || { best: 0, attempts: 0, passed: false };
    st.attempts = (st.attempts || 0) + 1;
    st.best = Math.max(st.best || 0, ratio);
    const firstPass = ok && !st.passed;
    st.passed = st.passed || ok;
    P.levels[L.n] = st; save();
    Cloud.logAttempt(L.n, score, total);
    const nextL = LEVELS[L.n];
    el.innerHTML = `<div class="card result ${ok ? "pass" : "fail"}">
      <div class="big">${ar(score)} / ${ar(total)}</div>
      <h3>${ok ? (L.n === LAST ? "أتممت الرحلة! صرتَ ذائقاً." : "أحسنت! اجتزت المرحلة.") : "لم تبلغ حدّ النجاح بعد."}</h3>
      <p>${ok ? (firstPass && nextL ? `المرحلة التالية: «${esc(nextL.title)}».` : "")
        : `تحتاج إلى ${ar(Math.ceil(total * PASS_RATIO))} إجابات صحيحة. راجع التراكيب والنصوص، ثم أعد المحاولة.`}</p>
      <div class="quiz-actions center">
        ${ok && nextL ? `<a class="btn primary" href="#level-${nextL.n}">إلى المرحلة ${ar(nextL.n)} ←</a>` : ""}
        ${ok && L.n === LAST ? `<a class="btn gold" href="#cert">استلم شهادتك</a>` : ""}
        <button class="btn" id="retry-test">أعد الاختبار</button></div></div>`;
    $("#retry-test").addEventListener("click", () => startTest(el, L));
    const lp = $(".level-progress");
    if (lp) lp.innerHTML = `<span>${st.passed ? `✓ اجتزت الاختبار (${pct(st.best)})` : `أفضل نتيجة: ${pct(st.best)}`}</span>`;
  }

  /* سجلّ الإجابات للسحابة */
  Quiz.onAnswer = (q, ok) => {
    if (!Cloud.user || !q._item) return;
    Cloud.logAnswer({
      qtype: q.type, item: q._kind === "dict" ? q._item.arn : q._item.title, item_kind: q._kind,
      ok, level: quizContext === "test" ? quizLevel : q._item.level, context: quizContext,
    });
  };

  /* بطاقات الحفظ */
  function flashcards(el, entries, L) {
    let deck = U.shuffle(entries.filter((d) => !known.has(d.id)));
    if (!deck.length) deck = U.shuffle(entries);
    let i = 0;
    function show() {
      const knownHere = entries.filter((d) => known.has(d.id)).length;
      if (i >= deck.length) {
        el.innerHTML = `<div class="card result pass"><h3>أنهيت البطاقات</h3>
          <p>حفظت ${ar(knownHere)} من ${ar(entries.length)} تركيباً في هذه المرحلة.</p>
          <div class="quiz-actions center"><button class="btn" id="fc-again">بطاقات ما لم أحفظه</button>
          <button class="btn primary" id="fc-texts">التالي: النصوص ←</button></div></div>`;
        $("#fc-again").addEventListener("click", () => flashcards(el, entries, L));
        $("#fc-texts").addEventListener("click", () => renderLevel(L.n, "texts"));
        return;
      }
      const d = deck[i];
      el.innerHTML = `<div class="fc-top"><span>البطاقة ${ar(i + 1)} من ${ar(deck.length)}</span><span>حفظت ${ar(knownHere)} من ${ar(entries.length)}</span>
        <button class="link-btn" id="fc-exit">إنهاء البطاقات ×</button></div>
        <div class="flashcard card">
          <div class="fc-front"><p class="muted">ما الفصيح بدل:</p><div class="fc-arn">${esc(d.arn)}</div><p class="q-sentence">${esc(d.bad)}</p>
            <button class="btn primary" id="fc-flip">اقلب البطاقة</button></div>
          <div class="fc-back" hidden><div class="fc-fus">${esc(d.fus)}</div><p class="q-sentence good">${esc(d.good)}</p>
            <p class="explain">${esc(d.note)}</p>${d.shahid ? `<div class="shahid">${esc(d.shahid.text)}<small>${esc(d.shahid.ref)}</small></div>` : ""}
            <p><button class="more-btn" data-more="dict:${d.id}">استزادة</button></p>
            <div class="quiz-actions center"><button class="btn" id="fc-again1">أعِدها لاحقاً</button><button class="btn primary" id="fc-know">عرفتُها ✓</button></div></div>
        </div>`;
      $("#fc-exit").addEventListener("click", () => renderLevel(L.n, "entries"));
      $("#fc-flip").addEventListener("click", () => { $(".fc-front").hidden = true; $(".fc-back").hidden = false; $("#fc-know").focus(); });
      $("#fc-know").addEventListener("click", () => { known.add(d.id); save(); i++; show(); });
      $("#fc-again1").addEventListener("click", () => { deck.push(d); i++; show(); });
    }
    show();
  }

  /* ===== الشهادة ===== */
  function renderCert() {
    const box = $("#level-view");
    if (!passed(LAST)) {
      box.innerHTML = `<div class="card locked-msg"><h2>الشهادة</h2><p>تُمنح الشهادة بعد اجتياز المراحل السبع كلها.</p>
        <a class="btn primary" href="#path">إلى رحلة التعلّم</a></div>`;
      return;
    }
    let date = "";
    try { date = new Date().toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { date = new Date().toLocaleDateString("ar-u-nu-arab"); }
    const avg = Math.round(LEVELS.reduce((a, L) => a + ((P.levels[L.n] || {}).best || 0), 0) / LEVELS.length * 100);
    const nm = (Cloud.profile && Cloud.profile.full_name) || P.name || "";
    box.innerHTML = `<div class="cert-tools no-print"><a class="back" href="#path">→ رحلة التعلّم</a>
        <input type="text" id="cert-name" placeholder="اكتب اسمك كما تحبّ أن يظهر" value="${esc(nm)}">
        <button class="btn primary" id="cert-print">اطبع الشهادة</button></div>
      <div class="certificate"><div class="cert-inner">
        <p class="cert-basmala">بسم الله الرحمن الرحيم</p>
        <h2>شهادةُ ذائق</h2>
        <p>تشهد منصة «الذائقة العربية» بأنّ</p>
        <div class="cert-name" id="cert-name-out">${esc(nm || "……………")}</div>
        <p>قد أتمّ رحلة التعلّم بمراحلها السبع، من التنبّه إلى ديوان العرب الأول،<br>
          وعرف العرنجية وردّها إلى فصيحها، وعاشر بيان العرب من الجاهلية إلى العصر العباسي،<br>بمعدّل ${ar(avg)}٪.</p>
        <p class="cert-quote">«إنّ من البيان لسحراً»</p>
        <p class="cert-date">${esc(date)}</p></div></div>`;
    $("#cert-name").addEventListener("input", (e) => { P.name = e.target.value; save(); $("#cert-name-out").textContent = P.name || "……………"; });
    $("#cert-print").addEventListener("click", () => window.print());
  }

  /* ===== المعجم ===== */
  const PAGE = 48;
  $("#dict-cat").innerHTML = `<option value="all">كل الأبواب</option>` +
    Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("") +
    LEVELS.slice(0, 5).map((L) => `<option value="L${L.n}">المرحلة ${ar(L.n)}: ${L.title}</option>`).join("");
  let dictList = [], dictShown = 0;
  function renderDict(more) {
    if (!more) {
      const q = strip($("#dict-search").value.trim()).toLowerCase(), c = $("#dict-cat").value;
      dictList = DICT.filter((d) => (c === "all" || d.cat === c || c === "L" + d.level) &&
        (!q || strip([d.arn, d.fus, d.src, d.note, d.bad, d.good].join(" ")).toLowerCase().includes(q)));
      dictShown = 0; $("#dict-list").innerHTML = "";
      $("#dict-count").textContent = `${ar(dictList.length)} من ${ar(DICT.length)}`;
      if (!dictList.length) $("#dict-list").innerHTML = `<p class="note">لا نتيجة. جرّب كلمة أخرى.</p>`;
    }
    const next = dictList.slice(dictShown, dictShown + PAGE);
    $("#dict-list").insertAdjacentHTML("beforeend", next.map(entryHTML).join(""));
    dictShown += next.length;
    $("#dict-more").hidden = dictShown >= dictList.length;
  }
  $("#dict-search").addEventListener("input", () => renderDict());
  $("#dict-cat").addEventListener("change", () => renderDict());
  $("#dict-more").addEventListener("click", () => renderDict(true));

  /* ===== المختارات ===== */
  let era = "all";
  $("#era-filters").innerHTML = `<button class="chip active" data-era="all">الكلّ</button>` +
    Object.entries(ERAS).map(([k, v]) => `<button class="chip" data-era="${k}">${v}</button>`).join("");
  const kinds = [...new Set(TEXTS.map((t) => t.kind))];
  $("#texts-kind").innerHTML = `<option value="all">كل الأنواع</option>` + kinds.map((k) => `<option>${k}</option>`).join("");
  let textList = [], textShown = 0;
  function renderTexts(more) {
    if (!more) {
      const q = strip($("#texts-search").value.trim()), k = $("#texts-kind").value;
      textList = TEXTS.filter((t) => (era === "all" || t.era === era) && (k === "all" || t.kind === k) &&
        (!q || strip([t.title, t.author, t.text, t.taste].join(" ")).includes(q)));
      textShown = 0; $("#texts-list").innerHTML = "";
      $("#texts-count").textContent = `${ar(textList.length)} من ${ar(TEXTS.length)}`;
      if (!textList.length) $("#texts-list").innerHTML = `<p class="note">لا نتيجة.</p>`;
    }
    const next = textList.slice(textShown, textShown + PAGE);
    $("#texts-list").insertAdjacentHTML("beforeend", next.map(textHTML).join(""));
    textShown += next.length;
    $("#texts-more").hidden = textShown >= textList.length;
  }
  $("#era-filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    era = b.dataset.era; $$("#era-filters .chip").forEach((c) => c.classList.toggle("active", c === b)); renderTexts();
  });
  $("#texts-search").addEventListener("input", () => renderTexts());
  $("#texts-kind").addEventListener("change", () => renderTexts());
  $("#texts-more").addEventListener("click", () => renderTexts(true));

  /* ===== التدريب الحر ===== */
  $("#pr-type").innerHTML = `<option value="mix">منوّعة</option>` + Object.entries(QTYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("#pr-level").innerHTML = `<option value="all">كل المراحل</option>` + LEVELS.map((L) => `<option value="${L.n}">${ar(L.n)}: ${L.title}</option>`).join("");
  const pr = store.get("dhaiqa.practice", { ok: 0, no: 0, streak: 0 });
  function practiceStats() { $("#pr-ok").textContent = ar(pr.ok); $("#pr-no").textContent = ar(pr.no); $("#pr-streak").textContent = ar(pr.streak); }
  function practiceNext() {
    quizContext = "practice";
    const t0 = $("#pr-type").value, lv = $("#pr-level").value;
    const type = t0 === "mix" ? U.pick(Object.keys(QTYPES)) : t0;
    const dp = lv === "all" || +lv >= 6 ? DICT : DICT.filter((d) => d.level === +lv);
    const tp = lv === "all" ? TEXTS : TEXTS.filter((t) => t.level === +lv);
    const q = Quiz.one(type, dp, tp);
    const c = $("#practice-quiz");
    c.innerHTML = `<div class="card quiz-card"><div class="q-box"></div><div class="quiz-actions"><button class="btn primary" id="pr-next" hidden>سؤال آخر</button></div></div>`;
    Quiz.render(c.querySelector(".q-box"), q, (ok) => {
      if (ok) { pr.ok++; pr.streak++; } else { pr.no++; pr.streak = 0; }
      store.set("dhaiqa.practice", pr); practiceStats();
      const n = $("#pr-next"); n.hidden = false; n.focus({ preventScroll: true });
      n.addEventListener("click", practiceNext);
    });
  }
  $("#pr-type").addEventListener("change", practiceNext);
  $("#pr-level").addEventListener("change", practiceNext);

  /* ===== المحك ===== */
  function runChecker() {
    const text = $("#checker-input").value, out = $("#checker-output");
    if (!text.trim()) { out.innerHTML = ""; return; }
    let hits = [];
    DICT.forEach((d) => findAll(text, d.re).forEach((h) => hits.push({ ...h, d })));
    hits.sort((a, b) => a.s - b.s || b.e - a.e);
    const kept = []; let lastEnd = -1;
    hits.forEach((h) => { if (h.s >= lastEnd) { kept.push(h); lastEnd = h.e; } });
    hits = kept;
    if (!hits.length) { out.innerHTML = `<p class="clean">لم يجد المِحَكّ تراكيب عرنجية شائعة. أحسنت!</p>`; return; }
    let html = "", pos = 0;
    hits.forEach((h, k) => { html += esc(text.slice(pos, h.s)) + `<mark>${esc(text.slice(h.s, h.e))}<sup>${ar(k + 1)}</sup></mark>`; pos = h.e; });
    html += esc(text.slice(pos));
    out.innerHTML = `<div class="marked">${html.replace(/\n/g, "<br>")}</div>
      <p><strong>وجد المِحَكّ ${ar(hits.length)} موضعاً:</strong></p>
      <ul class="findings">${hits.map((h, k) => `<li><span class="num">${ar(k + 1)}</span>«${esc(text.slice(h.s, h.e))}» ← الفصيح: <span class="fus">${esc(h.d.fus)}</span>
        <button class="more-btn" data-more="dict:${h.d.id}">استزادة</button><br><small>${esc(h.d.note)} — مثال: ${esc(h.d.good)}</small></li>`).join("")}</ul>`;
  }
  $("#checker-run").addEventListener("click", runChecker);
  $("#checker-clear").addEventListener("click", () => { $("#checker-input").value = ""; $("#checker-output").innerHTML = ""; $("#checker-input").focus(); });

  /* ===== الحساب ===== */
  function updateHeader() {
    const u = Cloud.user, p = Cloud.profile;
    const btn = $("#account-btn");
    btn.querySelector(".acc-name").textContent = u ? (p && p.full_name ? p.full_name.split(" ")[0] : "حسابي") : (Cloud.enabled ? "دخول" : "حسابي");
    btn.querySelector(".avatar").textContent = u && p && p.full_name ? p.full_name.trim()[0] : "ط";
    $("#nav-teacher").hidden = !(u && p && p.role === "teacher");
  }
  const setupHTML = `<ol class="setup-steps">
      <li>أنشئ مشروعاً مجانياً في <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>
      <li>افتح <b>SQL Editor</b> والصق محتوى الملف <code>supabase/schema.sql</code> من المستودع ثم اضغط <b>Run</b>.</li>
      <li>من <b>Authentication ← Sign In / Providers ← Email</b> يمكنك إيقاف «Confirm email» ليدخل الطلاب مباشرة دون رسالة تأكيد.</li>
      <li>من <b>Project Settings ← API</b> انسخ <b>Project URL</b> والمفتاح العام <b>anon / publishable</b>.</li>
      <li>ضعهما في الملف <code>js/config.js</code> وانشر الموقع.</li></ol>`;
  async function renderAccount() {
    const box = $("#account-view");
    if (!Cloud.enabled) {
      box.innerHTML = `<h2>الحسابات</h2>
        <div class="acc-grid"><div class="card"><h3>الوضع المحلي</h3>
          <p>الحسابات غير مفعّلة بعد في هذا الموقع؛ لذلك يُحفظ تقدّمك في هذا المتصفح وحده.</p>
          <p>حين يفعّلها مدير الموقع يستطيع كل طالب إنشاء حساب، ويُنقل تقدّمه المحلي إلى حسابه تلقائياً، ويتابعه معلّمه من «لوحة المعلّم».</p></div>
          <div class="card"><h3>لمدير الموقع: تفعيل الحسابات</h3>${setupHTML}</div></div>`;
      return;
    }
    if (!Cloud.ready) { box.innerHTML = `<p class="empty">جارٍ الاتصال…</p>`; return; }
    if (!Cloud.user) { renderAuthForms(box); return; }
    const p = Cloud.profile || {};
    const teacher = p.role === "teacher";
    box.innerHTML = `<h2>حسابي</h2>
      <div class="acc-grid">
        <div class="card"><h3>${esc(p.full_name || "")}</h3>
          <p class="muted">${esc(Cloud.user.email || "")} — ${teacher ? "معلّم" : "طالب"}</p>
          <form class="inline-form" id="name-form"><input type="text" id="acc-name" value="${esc(p.full_name || "")}" placeholder="الاسم الكامل" required>
            <button class="btn small-btn">حفظ الاسم</button></form>
          <p class="form-msg" id="name-msg"></p>
          ${!teacher ? `<p>اجتزت <b>${ar(LEVELS.filter((L) => passed(L.n)).length)}</b> من ${ar(LAST)} مراحل، وحفظت <b>${ar(known.size)}</b> تركيباً. يُحفظ تقدّمك في حسابك تلقائياً.</p>` : ""}
          <div class="quiz-actions">${teacher ? `<a class="btn primary" href="#teacher">لوحة المعلّم</a>` : `<a class="btn primary" href="#path">رحلة التعلّم</a>`}
            <button class="btn danger" id="sign-out">تسجيل الخروج</button></div></div>
        <div class="card"><h3>${teacher ? "فصولي" : "فصولي ومعلّميّ"}</h3><div id="acc-classes"><p class="empty">جارٍ التحميل…</p></div>
          ${teacher ? `<form class="inline-form" id="new-class"><input type="text" id="class-name" placeholder="اسم فصل جديد" required maxlength="80"><button class="btn primary small-btn">أنشئ فصلاً</button></form>`
            : `<form class="inline-form" id="join-form"><input type="text" id="join-code" placeholder="رمز الفصل من معلّمك" required maxlength="12" dir="ltr"><button class="btn primary small-btn">انضمّ</button></form>`}
          <p class="form-msg" id="class-msg"></p></div>
      </div>`;
    $("#sign-out").addEventListener("click", async () => { await Cloud.signOut(); location.hash = "#home"; });
    $("#name-form").addEventListener("submit", async (e) => {
      e.preventDefault(); const m = $("#name-msg");
      try { await Cloud.updateName($("#acc-name").value.trim()); m.className = "form-msg ok"; m.textContent = "حُفظ الاسم."; } catch (err) { m.className = "form-msg err"; m.textContent = err.message; }
    });
    const loadClasses = async () => {
      const list = await Cloud.myClasses();
      $("#acc-classes").innerHTML = list.length ? `<ul class="class-list">${list.map((c) => `<li><b>${esc(c.name)}</b>
        ${teacher ? `<span>الرمز: <span class="code">${esc(c.code)}</span></span>` : ""}
        ${!teacher ? `<button class="link-btn" data-leave="${c.id}">مغادرة</button>` : ""}</li>`).join("")}</ul>`
        : `<p class="muted">${teacher ? "لا فصول بعد. أنشئ فصلاً وأعطِ طلابك رمزه." : "لم تنضمّ إلى فصل بعد. اطلب الرمز من معلّمك."}</p>`;
      $$("[data-leave]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("مغادرة هذا الفصل؟")) return; await Cloud.leaveClass(b.dataset.leave); loadClasses();
      }));
    };
    loadClasses();
    const f = $("#new-class") || $("#join-form");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const m = $("#class-msg");
      try {
        if (teacher) { const c = await Cloud.createClass($("#class-name").value.trim()); m.className = "form-msg ok"; m.innerHTML = `أُنشئ الفصل. رمزه: <span class="code">${esc(c.code)}</span>`; $("#class-name").value = ""; }
        else { const c = await Cloud.joinClass($("#join-code").value.trim()); m.className = "form-msg ok"; m.textContent = `انضممت إلى «${c.name}».`; $("#join-code").value = ""; }
        loadClasses();
      } catch (err) { m.className = "form-msg err"; m.textContent = err.message; }
    });
  }
  function renderAuthForms(box, mode) {
    mode = mode || "in";
    box.innerHTML = `<div class="card auth-card"><h2>${mode === "in" ? "تسجيل الدخول" : "حساب جديد"}</h2>
      <div class="auth-tabs"><button class="chip ${mode === "in" ? "active" : ""}" data-mode="in">دخول</button><button class="chip ${mode === "up" ? "active" : ""}" data-mode="up">حساب جديد</button></div>
      <form class="form" id="auth-form">
        ${mode === "up" ? `<label>الاسم الكامل<input type="text" id="f-name" required maxlength="80" autocomplete="name"></label>
          <div class="role-pick"><label><input type="radio" name="role" value="student" checked> طالب</label><label><input type="radio" name="role" value="teacher"> معلّم</label></div>` : ""}
        <label>البريد الإلكتروني<input type="email" id="f-email" required autocomplete="email" dir="ltr"></label>
        <label>كلمة المرور<input type="password" id="f-pass" required minlength="6" autocomplete="${mode === "in" ? "current-password" : "new-password"}" dir="ltr"></label>
        <button class="btn primary">${mode === "in" ? "ادخل" : "أنشئ الحساب"}</button>
        <p class="form-msg" id="auth-msg"></p>
      </form>
      <p class="muted small">${mode === "up" ? "إن كان لك تقدّم محفوظ في هذا المتصفح نُقل إلى حسابك تلقائياً." : ""}</p></div>`;
    box.querySelector(".auth-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) renderAuthForms(box, b.dataset.mode); });
    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault(); const m = $("#auth-msg"); const btn = e.target.querySelector("button"); btn.disabled = true;
      m.className = "form-msg"; m.textContent = "لحظة…";
      try {
        const email = $("#f-email").value.trim(), pass = $("#f-pass").value;
        if (mode === "in") await Cloud.signIn(email, pass);
        else {
          const role = (box.querySelector("input[name=role]:checked") || {}).value || "student";
          const r = await Cloud.signUp(email, pass, $("#f-name").value.trim(), role);
          if (r.needsConfirm) { m.className = "form-msg ok"; m.textContent = "أُرسلت رسالة تأكيد إلى بريدك؛ افتحها ثم سجّل الدخول."; btn.disabled = false; return; }
        }
      } catch (err) { m.className = "form-msg err"; m.textContent = err.message; btn.disabled = false; }
    });
  }

  /* ===== لوحة المعلم ===== */
  let tClass = null, tRows = [], tSort = { k: "name", d: 1 };
  async function renderTeacher() {
    const box = $("#teacher-view");
    if (!Cloud.enabled || !Cloud.user || !Cloud.profile || Cloud.profile.role !== "teacher") {
      box.innerHTML = `<div class="card locked-msg"><h2>لوحة المعلّم</h2><p>هذه الصفحة للمعلّمين. سجّل الدخول بحساب معلّم.</p><a class="btn primary" href="#account">الحساب</a></div>`;
      return;
    }
    box.innerHTML = `<h2>لوحة المعلّم</h2><p class="empty">جارٍ التحميل…</p>`;
    const classes = await Cloud.myClasses();
    if (!classes.length) {
      box.innerHTML = `<h2>لوحة المعلّم</h2><div class="card locked-msg"><p>لا فصول بعد. أنشئ فصلاً من صفحة الحساب، وأعطِ طلابك رمزه لينضمّوا.</p><a class="btn primary" href="#account">أنشئ فصلاً</a></div>`;
      return;
    }
    if (!tClass || !classes.some((c) => c.id === tClass)) tClass = classes[0].id;
    const cls = classes.find((c) => c.id === tClass);
    box.innerHTML = `<h2>لوحة المعلّم</h2>
      <div class="dash-top"><select id="t-class">${classes.map((c) => `<option value="${c.id}" ${c.id === tClass ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <span>رمز الانضمام: <span class="code">${esc(cls.code)}</span></span>
        <button class="btn small-btn" id="t-refresh">تحديث</button><button class="btn small-btn" id="t-csv">تصدير CSV</button>
        <button class="btn small-btn danger" id="t-del">حذف الفصل</button></div>
      <div id="t-body"><p class="empty">جارٍ التحميل…</p></div>`;
    $("#t-class").addEventListener("change", (e) => { tClass = e.target.value; renderTeacher(); });
    $("#t-refresh").addEventListener("click", renderTeacher);
    $("#t-csv").addEventListener("click", exportCSV);
    $("#t-del").addEventListener("click", async () => {
      if (!confirm(`حذف فصل «${cls.name}» نهائياً؟ لن تُحذف حسابات الطلاب.`)) return;
      await Cloud.deleteClass(tClass); tClass = null; renderTeacher();
    });
    try {
      const [rows, items, qts] = await Promise.all([Cloud.overview(tClass), Cloud.itemStats(tClass), Cloud.qtypeStats(tClass)]);
      tRows = rows.map(studentRow);
      renderDash(items, qts);
    } catch (err) { $("#t-body").innerHTML = `<p class="form-msg err">${esc(err.message)}</p>`; }
  }
  function studentRow(r) {
    const lv = (r.data && r.data.levels) || {};
    const passedN = LEVELS.filter((L) => lv[L.n] && lv[L.n].passed).length;
    const bests = LEVELS.map((L) => (lv[L.n] && lv[L.n].best) || 0).filter((x) => x > 0);
    const acc = r.answers_total ? r.answers_ok / r.answers_total : null;
    const last = r.last_active ? new Date(r.last_active) : null;
    const days = last ? (Date.now() - last) / 864e5 : Infinity;
    return { id: r.student_id, name: r.full_name || "—", lv, passed: passedN, avg: bests.length ? bests.reduce((a, b) => a + b) / bests.length : 0,
      known: ((r.data && r.data.known) || []).length, answers: Number(r.answers_total), acc, attempts: Number(r.attempts_total), last, days,
      risk: days > 7 || (acc !== null && r.answers_total >= 10 && acc < 0.6) };
  }
  function renderDash(items, qts) {
    const n = tRows.length;
    const active = tRows.filter((r) => r.days <= 7).length;
    const accs = tRows.filter((r) => r.acc !== null);
    const avgAcc = accs.length ? accs.reduce((a, r) => a + r.acc, 0) / accs.length : 0;
    const avgPassed = n ? tRows.reduce((a, r) => a + r.passed, 0) / n : 0;
    const risk = tRows.filter((r) => r.risk).length;
    const dist = LEVELS.map((L) => tRows.filter((r) => Math.min(r.passed + 1, LAST) === L.n && !(r.passed === LAST)).length);
    const finished = tRows.filter((r) => r.passed === LAST).length;
    const maxD = Math.max(1, ...dist, finished);
    const bar = (label, v, max, cls, txt) => `<div class="hbar"><span class="lbl" title="${esc(label)}">${esc(label)}</span><span class="track"><span class="fill ${cls || ""}" style="width:${max ? v / max * 100 : 0}%"></span></span><span>${txt}</span></div>`;
    $("#t-body").innerHTML = `
      <div class="kpis">
        <div class="kpi"><b>${ar(n)}</b><span>طالباً في الفصل</span></div>
        <div class="kpi"><b>${ar(active)}</b><span>نشطون في ٧ أيام</span></div>
        <div class="kpi"><b>${ar(avgPassed.toFixed(1))}</b><span>متوسط المراحل المجتازة</span></div>
        <div class="kpi"><b>${pct(avgAcc)}</b><span>متوسط دقّة الإجابات</span></div>
        <div class="kpi"><b style="color:var(--bad)">${ar(risk)}</b><span>يحتاجون متابعة</span></div>
      </div>
      ${!n ? `<div class="card locked-msg"><p>لم ينضمّ أحد بعد. أعطِ طلابك الرمز أعلاه ليدخلوه في صفحة «حسابي».</p></div>` : `
      <div class="dash-grid">
        <div class="card"><h3>توزيع الطلاب على المراحل</h3>
          ${LEVELS.map((L, i) => bar(`${ar(L.n)}. ${L.title}`, dist[i], maxD, "", ar(dist[i]))).join("")}
          ${bar("أتمّوا الرحلة", finished, maxD, "okc", ar(finished))}
          <p class="legend">المرحلة التي يعمل عليها كل طالب الآن.</p></div>
        <div class="card"><h3>الدقّة حسب نوع السؤال</h3>
          ${qts.length ? qts.map((q) => { const a = q.total ? q.ok / q.total : 0; return bar(QTYPES[q.qtype] || q.qtype, a, 1, a < .6 ? "warn" : "okc", pct(a)); }).join("") : `<p class="empty">لا إجابات بعد.</p>`}
          <p class="legend">الأنواع الحمراء مهارات تحتاج تدريباً جماعياً.</p></div>
      </div>
      <div class="card dash-table-card" style="margin-bottom:18px"><h3>أكثر ما يُخطئ فيه الفصل</h3>
        ${items.length ? items.map((it) => {
          const w = it.total ? it.wrong / it.total : 0;
          const ref = it.item_kind === "dict" ? DICT.find((d) => d.arn === it.item) : TEXTS.find((t) => t.title === it.item);
          return `<div class="hbar"><span class="lbl">${ref ? `<button class="link-btn" style="margin:0" data-more="${it.item_kind}:${ref.id}">${esc(it.item)}</button>` : esc(it.item)}</span>
            <span class="track"><span class="fill warn" style="width:${w * 100}%"></span></span><span>${pct(w)}</span></div>`;
        }).join("") + `<p class="legend">نسبة الخطأ في كل تركيب أو نص (من أُجيب عنه مرتين فأكثر). اضغط الاسم لشرحه، واجعله موضوع درس.</p>`
          : `<p class="empty">لا بيانات كافية بعد.</p>`}</div>
      <div class="card dash-table-card"><h3>الطلاب</h3><div class="table-wrap"><table class="students"><thead><tr>
        <th data-k="name">الاسم</th><th data-k="passed">المراحل</th><th data-k="avg">متوسط الاختبارات</th><th data-k="acc">الدقّة</th>
        <th data-k="answers">الإجابات</th><th data-k="known">المحفوظ</th><th data-k="days">آخر نشاط</th></tr></thead><tbody id="t-rows"></tbody></table></div>
        <p class="legend">● بحاجة إلى متابعة: لم ينشط منذ أسبوع، أو دقّته دون ٦٠٪. اضغط اسم الطالب لتفاصيله. النجوم: خضراء مجتازة، ذهبية حاول فيها.</p></div>`}`;
    if (n) {
      $$("table.students th").forEach((th) => th.addEventListener("click", () => {
        const k = th.dataset.k; tSort = { k, d: tSort.k === k ? -tSort.d : (k === "name" ? 1 : -1) }; renderRows();
      }));
      renderRows();
    }
  }
  function ago(r) {
    if (!r.last) return "لم ينشط";
    const d = Math.floor(r.days);
    return d < 1 ? "اليوم" : d === 1 ? "أمس" : `قبل ${ar(d)} يوماً`;
  }
  function renderRows() {
    const k = tSort.k, d = tSort.d;
    const rows = tRows.slice().sort((a, b) => {
      const x = a[k] === null ? -1 : a[k], y = b[k] === null ? -1 : b[k];
      return (typeof x === "string" ? x.localeCompare(y, "ar") : x - y) * d;
    });
    $("#t-rows").innerHTML = rows.map((r) => `<tr class="${r.risk ? "risk" : ""}" data-sid="${r.id}">
      <td>${esc(r.name)}</td>
      <td><span class="lv-dots">${LEVELS.map((L) => `<i class="${r.lv[L.n] && r.lv[L.n].passed ? "on" : r.lv[L.n] && r.lv[L.n].attempts ? "try" : ""}" title="${ar(L.n)}"></i>`).join("")}</span> ${ar(r.passed)}</td>
      <td>${r.avg ? pct(r.avg) : "—"}</td><td>${r.acc === null ? "—" : pct(r.acc)}</td>
      <td>${ar(r.answers)}</td><td>${ar(r.known)}</td><td>${ago(r)}</td></tr>`).join("");
    $$("#t-rows tr").forEach((tr) => tr.addEventListener("click", () => studentModal(tRows.find((r) => r.id === tr.dataset.sid))));
  }
  async function studentModal(r) {
    openModal(`الطالب: ${r.name}`, `<p class="empty">جارٍ التحميل…</p>`);
    const { answers, attempts } = await Cloud.studentDetail(r.id);
    const by = {};
    answers.forEach((a) => { const k = a.item_kind + "|" + a.item; (by[k] = by[k] || { item: a.item, kind: a.item_kind, t: 0, w: 0 }); by[k].t++; if (!a.ok) by[k].w++; });
    const weak = Object.values(by).filter((x) => x.w > 0).sort((a, b) => b.w / b.t - a.w / a.t || b.w - a.w).slice(0, 10);
    const byType = {};
    answers.forEach((a) => { (byType[a.qtype] = byType[a.qtype] || { t: 0, ok: 0 }); byType[a.qtype].t++; if (a.ok) byType[a.qtype].ok++; });
    const recent = answers.slice(0, 50), recentAcc = recent.length ? recent.filter((a) => a.ok).length / recent.length : null;
    $("#modal-body").innerHTML = `
      <p>المراحل المجتازة: <b>${ar(r.passed)}</b> من ${ar(LAST)}، والدقّة في آخر ${ar(recent.length)} إجابة: <b>${recentAcc === null ? "—" : pct(recentAcc)}</b>، وآخر نشاط: ${ago(r)}.</p>
      <h4>محاولات الاختبارات</h4>
      ${attempts.length ? `<table class="words-table">${attempts.slice(0, 15).map((t) => `<tr><td>المرحلة ${ar(t.level)}</td><td>${ar(t.score)} / ${ar(t.total)} ${t.score / t.total >= PASS_RATIO ? "✓" : ""}</td><td class="muted">${new Date(t.created_at).toLocaleDateString("ar-u-nu-arab")}</td></tr>`).join("")}</table>` : `<p class="muted">لا محاولات بعد.</p>`}
      <h4>مواطن الضعف</h4>
      ${weak.length ? `<ul>${weak.map((w) => { const ref = w.kind === "dict" ? DICT.find((d) => d.arn === w.item) : TEXTS.find((t) => t.title === w.item);
        return `<li>${ref ? `<button class="link-btn" style="margin:0" data-more="${w.kind}:${ref.id}">${esc(w.item)}</button>` : esc(w.item)} — أخطأ ${ar(w.w)} من ${ar(w.t)}</li>`; }).join("")}</ul>` : `<p class="muted">لا أخطاء مسجّلة.</p>`}
      <h4>الدقّة حسب نوع السؤال</h4>
      ${Object.keys(byType).length ? Object.entries(byType).map(([k, v]) => `<div class="hbar"><span class="lbl">${QTYPES[k] || k}</span><span class="track"><span class="fill ${v.ok / v.t < .6 ? "warn" : "okc"}" style="width:${v.ok / v.t * 100}%"></span></span><span>${pct(v.ok / v.t)}</span></div>`).join("") : `<p class="muted">لا إجابات بعد.</p>`}
      <h4>اقتراح تربوي</h4>
      <p>${weak.length ? `ابدأ معه بمراجعة «${esc(weak[0].item)}»${weak[1] ? ` و«${esc(weak[1].item)}»` : ""} ببطاقات الحفظ، ثم كلّفه بخمس جمل من إنشائه يستعمل فيها البديل الفصيح.` : r.answers < 10 ? "قليل التدريب؛ شجّعه على التدريب الحرّ عشر دقائق يومياً." : "مستواه جيد؛ كلّفه بحفظ نصّ من مختارات مرحلته وإلقائه."}</p>
      <div class="quiz-actions"><button class="btn small-btn danger" id="rm-student">إخراجه من الفصل</button></div>`;
    $("#rm-student").addEventListener("click", async () => {
      if (!confirm(`إخراج ${r.name} من الفصل؟`)) return;
      await Cloud.removeStudent(tClass, r.id); closeModal(); renderTeacher();
    });
  }
  function exportCSV() {
    const head = ["الاسم", "المراحل المجتازة", ...LEVELS.map((L) => `أفضل نتيجة م${L.n}`), "الدقة", "الإجابات", "المحفوظ", "آخر نشاط"];
    const lines = [head, ...tRows.map((r) => [r.name, r.passed, ...LEVELS.map((L) => r.lv[L.n] ? Math.round((r.lv[L.n].best || 0) * 100) + "%" : ""),
      r.acc === null ? "" : Math.round(r.acc * 100) + "%", r.answers, r.known, r.last ? r.last.toISOString().slice(0, 10) : ""])];
    const csv = "﻿" + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "dhaiqa-class.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ===== التوجيه ===== */
  const ALIASES = { principles: "home", about: "home", quiz: "practice" };
  function route() {
    let h = (location.hash || "#home").slice(1);
    h = ALIASES[h] || h;
    let page = h, lv = null;
    const m = h.match(/^level-(\d+)$/);
    if (m) { page = "level"; lv = +m[1]; }
    if (h === "cert") page = "level";
    if (!$(`.page[data-page="${page}"]`)) page = "home";
    closeModal();
    $$(".page").forEach((p) => { p.hidden = p.dataset.page !== page; });
    $$(".nav a, .bottom-nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === page || (page === "level" && a.dataset.nav === "path")));
    if (page === "home") renderHome();
    if (page === "path") renderPath();
    if (page === "level") { if (h === "cert") renderCert(); else { levelTab = "lesson"; renderLevel(lv); } }
    if (page === "dict") renderDict();
    if (page === "texts") renderTexts();
    if (page === "practice" && !$("#practice-quiz").children.length) { practiceStats(); practiceNext(); }
    if (page === "account") renderAccount();
    if (page === "teacher") renderTeacher();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ===== بدء الحسابات ومزامنة التقدّم ===== */
  Cloud.onChange(async (u) => {
    if (u) {
      const remote = await Cloud.pullProgress();
      P = merge(P, remote || {}); known = new Set(P.known);
      store.set(PKEY, P); Cloud.pushProgress(P);
    }
    updateHeader();
    const cur = (location.hash || "#home").slice(1);
    if (["account", "teacher", "home"].includes(cur)) route();
  });
  updateHeader();
  route();
  Cloud.init().then(() => { updateHeader(); if ((location.hash || "").slice(1) === "account") route(); });
})();
