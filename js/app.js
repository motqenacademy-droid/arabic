(function () {
  "use strict";
  const { esc, strip, ar, verse, findAll } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const eraTag = Quiz.eraTag;

  /* ===== التخزين والتقدّم ===== */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const PKEY = "dhaiqa.progress.v2";
  let P = store.get(PKEY, null) || { levels: {}, known: [], name: "" };
  P.levels = P.levels || {}; P.known = P.known || [];
  const save = () => store.set(PKEY, P);
  const passed = (n) => !!(P.levels[n] && P.levels[n].passed);
  const unlocked = (n) => n === 1 || passed(n - 1);
  const known = new Set(P.known);
  const currentLevel = () => { for (const L of LEVELS) if (!passed(L.n)) return L.n; return 7; };

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

  /* ===== مكوّنات مشتركة ===== */
  function entryHTML(d) {
    const sh = d.shahid ? `<div class="shahid">${esc(d.shahid.text)}<small>${eraTag(d.shahid.era)} ${esc(d.shahid.ref)}</small></div>` : "";
    return `<article class="card entry">
      <div class="entry-meta"><span class="tag lvl">المرحلة ${ar(d.level)}</span><span class="cat">${CATS[d.cat]}</span>${known.has(d.id) ? `<span class="known-badge">✓ حفظته</span>` : ""}</div>
      <div class="entry-head">
        <span class="arn">${esc(d.arn)}</span><span class="arrow" aria-hidden="true">←</span><span class="fus">${esc(d.fus)}</span>
      </div>
      ${d.src && d.src !== "—" ? `<div class="src">${esc(d.src)}</div>` : ""}
      <p class="explain">${esc(d.note)}</p>
      <div class="pair"><div class="b"><span>✗</span>${esc(d.bad)}</div><div class="g"><span>✓</span>${esc(d.good)}</div></div>
      ${sh}
    </article>`;
  }
  const canSpeak = "speechSynthesis" in window;
  function textHTML(t) {
    return `<article class="card text-card">
      <header>${eraTag(t.era)}<span class="kind">${esc(t.kind)}</span>
        ${canSpeak ? `<button class="speak" data-id="${t.id}" title="استمع">🔊 استمع</button>` : ""}</header>
      <h3>${esc(t.title)}</h3>
      <div class="body">${esc(verse(t.text))}</div>
      <p class="who">${esc(t.author)}، ${esc(t.ref)}</p>
      <div class="taste"><b>لمسة تذوّق: </b>${esc(t.taste)}</div>
    </article>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".speak"); if (!b) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(TEXTS[+b.dataset.id].text.replace(/\.\.\./g, "،").replace(/[﴿﴾«»]/g, ""));
    u.lang = "ar-SA"; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("ar"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  });

  /* ===== الرئيسة ===== */
  function renderHome() {
    const done = LEVELS.filter((L) => passed(L.n)).length;
    $("#home-stats").innerHTML = [
      [DICT.length, "تركيباً في المعجم"], [TEXTS.length, "نصاً من العصور الأربعة"],
      [LEVELS.length, "مراحل متدرّجة"], [Object.keys(QTYPES).length, "أنواع من الأسئلة"],
    ].map(([n, l]) => `<div class="stat"><b>${ar(n)}</b><span>${l}</span></div>`).join("");
    const cur = currentLevel();
    const pct = Math.round(done / LEVELS.length * 100);
    $("#home-progress").innerHTML = `<h3>مسيرتك</h3>
      <div class="bar big"><span style="width:${pct}%"></span></div>
      <p>اجتزت <b>${ar(done)}</b> من <b>${ar(LEVELS.length)}</b> مراحل، وحفظت <b>${ar(known.size)}</b> تركيباً.</p>
      ${cur <= 6 ? `<p>المرحلة الحالية: <b>${ar(cur)} — ${esc(LEVELS[cur - 1].title)}</b></p>
        <a class="btn primary" href="#level-${cur}">${done || known.size ? "تابع" : "ابدأ"} المرحلة ${ar(cur)}</a>`
        : `<p class="clean">أتممت الرحلة كلها. أنت ذائق!</p><a class="btn primary" href="#cert">شهادتك</a>`}`;
    $("#home-cta").textContent = done ? "تابع رحلة التعلّم" : "ابدأ رحلة التعلّم";
  }
  const dayIndex = Math.floor(Date.now() / 86400000) % TEXTS.length;
  let dailyI = dayIndex;
  function renderDaily() {
    const t = TEXTS[dailyI];
    $("#daily-era").className = "tag " + t.era; $("#daily-era").textContent = ERAS[t.era];
    $("#daily-text").textContent = verse(t.text);
    $("#daily-meta").textContent = `${t.author} — ${t.ref}`;
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
      const nDict = L.n === 6 ? "مراجعة شاملة" : `${ar(DICT.filter((d) => d.level === L.n).length)} تركيباً`;
      const nText = TEXTS.filter((t) => t.level === L.n).length;
      const nq = Object.values(L.q).reduce((a, b) => a + b, 0);
      const status = st.passed ? `<span class="status ok">✓ اجتزتها (${ar(Math.round(st.best * 100))}٪)</span>`
        : lock ? `<span class="status lock">🔒 مغلقة</span>`
        : st.attempts ? `<span class="status cur">أفضل نتيجة ${ar(Math.round((st.best || 0) * 100))}٪</span>` : `<span class="status cur">متاحة</span>`;
      return `<a class="level-card card ${lock ? "locked" : ""} ${st.passed ? "done" : ""}" href="${lock ? "#path" : "#level-" + L.n}" ${lock ? 'aria-disabled="true"' : ""}>
        <div class="lvl-num">${ar(L.n)}</div>
        <div class="lvl-body">
          <h3>${esc(L.title)}</h3><p class="lvl-sub">${esc(L.sub)}</p>
          <p class="lvl-meta">${nDict}، ${ar(nText)} نصاً، اختبار من ${ar(nq)} سؤالاً</p>
          ${status}
        </div></a>`;
    }).join("");
  }
  $("#path-list").addEventListener("click", (e) => {
    const a = e.target.closest(".level-card.locked"); if (!a) return;
    e.preventDefault();
    a.classList.add("shake"); setTimeout(() => a.classList.remove("shake"), 500);
  });
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm("سيُمسح تقدّمك كلّه وما حفظته من تراكيب. أتريد المتابعة؟")) return;
    P = { levels: {}, known: [], name: P.name || "" }; known.clear(); save(); renderPath();
  });

  /* ===== صفحة المرحلة ===== */
  let levelTab = "lesson";
  function renderLevel(n, tab) {
    const L = LEVELS[n - 1], box = $("#level-view");
    if (!L) { location.hash = "#path"; return; }
    if (!unlocked(n)) {
      box.innerHTML = `<div class="card locked-msg"><h2>🔒 المرحلة ${ar(n)} مغلقة</h2>
        <p>اجتز اختبار المرحلة ${ar(n - 1)} أولاً لتنفتح هذه المرحلة.</p>
        <a class="btn primary" href="#level-${n - 1}">إلى المرحلة ${ar(n - 1)}</a></div>`;
      return;
    }
    levelTab = tab || levelTab;
    const entries = n === 6 ? [] : DICT.filter((d) => d.level === n);
    const texts = TEXTS.filter((t) => t.level === n);
    const st = P.levels[n] || {};
    const knownHere = entries.filter((d) => known.has(d.id)).length;
    const tabs = [["lesson", "الدرس"], ...(entries.length ? [["entries", `التراكيب (${ar(entries.length)})`]] : []),
      ["texts", `النصوص (${ar(texts.length)})`], ["test", "الاختبار"]];
    box.innerHTML = `<a class="back" href="#path">→ رحلة التعلّم</a>
      <div class="level-head">
        <div class="lvl-num big">${ar(n)}</div>
        <div><p class="eyebrow">المرحلة ${ar(n)} من ${ar(LEVELS.length)}</p><h2>${esc(L.title)}</h2><p class="section-lead">${esc(L.sub)}</p></div>
      </div>
      <div class="level-progress">
        ${entries.length ? `<span>حفظت ${ar(knownHere)} من ${ar(entries.length)} تركيباً</span>` : ""}
        <span>${st.passed ? `✓ اجتزت الاختبار (${ar(Math.round(st.best * 100))}٪)` : st.attempts ? `أفضل نتيجة: ${ar(Math.round(st.best * 100))}٪` : "لم تختبر بعد"}</span>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${k === levelTab ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
      <div id="level-tab"></div>`;
    if (!tabs.some(([k]) => k === levelTab)) levelTab = "lesson";
    $$(".tab", box).forEach((b) => b.classList.toggle("active", b.dataset.tab === levelTab));
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
        ${entries.length ? `<h3>أمثلة من هذه المرحلة</h3><ul class="mini-list">${entries.slice(0, 5).map((d) =>
          `<li><span class="arn">${esc(d.arn)}</span> ← <span class="fus">${esc(d.fus)}</span></li>`).join("")}</ul>` : ""}
        <button class="btn primary" data-goto="${nextTab}">التالي: ${nextTab === "entries" ? "التراكيب" : "النصوص"} ←</button>
      </div>`;
    } else if (levelTab === "entries") {
      el.innerHTML = `<div class="tab-tools"><button class="btn primary" id="start-cards">احفظ بالبطاقات</button>
        <span class="muted">اقرأ التراكيب، ثم احفظها بالبطاقات، ثم انتقل إلى النصوص.</span></div>
        <div class="dict-grid">${entries.map(entryHTML).join("")}</div>
        <div class="tab-foot"><button class="btn primary" data-goto="texts">التالي: النصوص ←</button></div>`;
      $("#start-cards").addEventListener("click", () => flashcards(el, entries, L));
    } else if (levelTab === "texts") {
      el.innerHTML = `<p class="muted">اقرأ كل نصٍّ بصوتٍ مسموع مرتين، وتأمّل لمسة التذوّق، واحفظ ما استطعت.</p>
        <div class="texts-grid">${texts.map(textHTML).join("")}</div>
        <div class="tab-foot"><button class="btn primary" data-goto="test">التالي: الاختبار ←</button></div>`;
    } else if (levelTab === "test") {
      const nq = Object.values(L.q).reduce((a, b) => a + b, 0);
      const types = Object.keys(L.q).map((k) => QTYPES[k]);
      const st = P.levels[L.n] || {};
      el.innerHTML = `<div class="card test-intro">
        <h3>اختبار المرحلة ${ar(L.n)}</h3>
        <p>${ar(nq)} سؤالاً متنوّعاً، والنجاح بـ ${ar(Math.round(PASS_RATIO * 100))}٪ فأكثر (${ar(Math.ceil(nq * PASS_RATIO))} إجابة صحيحة).</p>
        <p class="types">${types.map((t) => `<span class="chip static">${t}</span>`).join("")}</p>
        ${st.attempts ? `<p class="muted">محاولاتك: ${ar(st.attempts)}، أفضل نتيجة: ${ar(Math.round(st.best * 100))}٪</p>` : ""}
        <button class="btn primary" id="start-test">ابدأ الاختبار</button></div>`;
      $("#start-test").addEventListener("click", () => {
        Quiz.run(el, Quiz.forLevel(L), (score, total) => finishTest(el, L, score, total));
      });
    }
    el.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
      levelTab = b.dataset.goto;
      $$("#level-view .tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === levelTab));
      renderTab(L, entries, texts);
      $("#level-view .tabs").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function finishTest(el, L, score, total) {
    const ratio = score / total, ok = ratio >= PASS_RATIO;
    const st = P.levels[L.n] || { best: 0, attempts: 0, passed: false };
    st.attempts = (st.attempts || 0) + 1;
    st.best = Math.max(st.best || 0, ratio);
    const firstPass = ok && !st.passed;
    st.passed = st.passed || ok;
    P.levels[L.n] = st; save();
    const nextL = LEVELS[L.n];
    el.innerHTML = `<div class="card result ${ok ? "pass" : "fail"}">
      <div class="big">${ar(score)} / ${ar(total)}</div>
      <h3>${ok ? (L.n === 6 ? "أتممت الرحلة! صرتَ ذائقاً." : "أحسنت! اجتزت المرحلة.") : "لم تبلغ حدّ النجاح بعد."}</h3>
      <p>${ok ? (firstPass && nextL ? `انفتحت لك المرحلة ${ar(nextL.n)}: «${esc(nextL.title)}».` : "")
        : `تحتاج إلى ${ar(Math.ceil(total * PASS_RATIO))} إجابات صحيحة. راجع التراكيب والنصوص، ثم أعد المحاولة.`}</p>
      <div class="quiz-actions center">
        ${ok && nextL ? `<a class="btn primary" href="#level-${nextL.n}">إلى المرحلة ${ar(nextL.n)} ←</a>` : ""}
        ${ok && L.n === 6 ? `<a class="btn primary" href="#cert">استلم شهادتك</a>` : ""}
        <button class="btn" id="retry-test">أعد الاختبار</button>
      </div></div>`;
    $("#retry-test").addEventListener("click", () => Quiz.run(el, Quiz.forLevel(L), (s, t) => finishTest(el, L, s, t)));
    $(".level-progress").innerHTML = `<span>${st.passed ? `✓ اجتزت الاختبار (${ar(Math.round(st.best * 100))}٪)` : `أفضل نتيجة: ${ar(Math.round(st.best * 100))}٪`}</span>`;
  }

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
        $("#fc-texts").addEventListener("click", () => { levelTab = "texts"; renderLevel(L.n); });
        return;
      }
      const d = deck[i];
      el.innerHTML = `<div class="fc-top"><span>البطاقة ${ar(i + 1)} من ${ar(deck.length)}</span><span>حفظت ${ar(knownHere)} من ${ar(entries.length)}</span>
        <button class="link-btn" id="fc-exit">إنهاء البطاقات ×</button></div>
        <div class="flashcard card" tabindex="0">
          <div class="fc-front"><p class="muted">ما الفصيح بدل:</p><div class="fc-arn">${esc(d.arn)}</div><p class="q-sentence">${esc(d.bad)}</p>
            <button class="btn primary" id="fc-flip">اقلب البطاقة</button></div>
          <div class="fc-back" hidden><div class="fc-fus">${esc(d.fus)}</div><p class="q-sentence good">${esc(d.good)}</p>
            <p class="explain">${esc(d.note)}</p>${d.shahid ? `<div class="shahid">${esc(d.shahid.text)}<small>${esc(d.shahid.ref)}</small></div>` : ""}
            <div class="quiz-actions center"><button class="btn" id="fc-again1">أعِدها لاحقاً</button><button class="btn primary" id="fc-know">عرفتُها ✓</button></div></div>
        </div>`;
      $("#fc-exit").addEventListener("click", () => renderLevel(L.n, "entries"));
      $("#fc-flip").addEventListener("click", () => { $(".fc-front").hidden = true; $(".fc-back").hidden = false; $("#fc-know").focus(); });
      $("#fc-know").addEventListener("click", () => { known.add(d.id); P.known = [...known]; save(); i++; show(); });
      $("#fc-again1").addEventListener("click", () => { deck.push(d); i++; show(); });
    }
    show();
  }

  /* ===== الشهادة ===== */
  function renderCert() {
    const box = $("#level-view");
    if (!passed(6)) {
      box.innerHTML = `<div class="card locked-msg"><h2>الشهادة</h2><p>تُمنح الشهادة بعد اجتياز المراحل الست كلها.</p>
        <a class="btn primary" href="#path">إلى رحلة التعلّم</a></div>`;
      return;
    }
    let date = "";
    try { date = new Date().toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { date = new Date().toLocaleDateString("ar"); }
    const avg = Math.round(LEVELS.reduce((a, L) => a + (P.levels[L.n].best || 0), 0) / LEVELS.length * 100);
    box.innerHTML = `<div class="cert-tools no-print"><a class="back" href="#path">→ رحلة التعلّم</a>
        <input id="cert-name" placeholder="اكتب اسمك كما تحبّ أن يظهر" value="${esc(P.name || "")}">
        <button class="btn primary" id="cert-print">اطبع الشهادة</button></div>
      <div class="certificate">
        <div class="cert-inner">
          <p class="cert-basmala">بسم الله الرحمن الرحيم</p>
          <h2>شهادةُ ذائق</h2>
          <p>يشهد موقع «الذائقة العربية» بأنّ</p>
          <div class="cert-name" id="cert-name-out">${esc(P.name || "……………")}</div>
          <p>قد أتمّ رحلة التعلّم بمراحلها الست، من التنبّه إلى البيان والتذوّق،<br>
            وعرف العرنجية وردّها إلى فصيحها، وعاشر بيان العصر النبوي والراشدي والأموي والعباسي،<br>
            بمعدّل ${ar(avg)}٪.</p>
          <p class="cert-quote">«إنّ من البيان لسحراً»</p>
          <p class="cert-date">${esc(date)}</p>
        </div>
      </div>`;
    $("#cert-name").addEventListener("input", (e) => { P.name = e.target.value; save(); $("#cert-name-out").textContent = P.name || "……………"; });
    $("#cert-print").addEventListener("click", () => window.print());
  }

  /* ===== المعجم ===== */
  $("#dict-cat").innerHTML = `<option value="all">كل الأبواب</option>` +
    Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("") +
    LEVELS.slice(0, 5).map((L) => `<option value="L${L.n}">المرحلة ${ar(L.n)}: ${L.title}</option>`).join("");
  function renderDict() {
    const q = strip($("#dict-search").value.trim()).toLowerCase(), c = $("#dict-cat").value;
    const list = DICT.filter((d) => (c === "all" || d.cat === c || c === "L" + d.level) &&
      (!q || strip([d.arn, d.fus, d.src, d.note, d.bad, d.good].join(" ")).toLowerCase().includes(q)));
    $("#dict-list").innerHTML = list.map(entryHTML).join("") || `<p class="note">لا نتيجة. جرّب كلمة أخرى.</p>`;
    $("#dict-count").textContent = `${ar(list.length)} من ${ar(DICT.length)}`;
  }
  $("#dict-search").addEventListener("input", renderDict);
  $("#dict-cat").addEventListener("change", renderDict);

  /* ===== المختارات ===== */
  let era = "all";
  const kinds = [...new Set(TEXTS.map((t) => t.kind))];
  $("#texts-kind").innerHTML = `<option value="all">كل الأنواع</option>` + kinds.map((k) => `<option>${k}</option>`).join("");
  function renderTexts() {
    const q = strip($("#texts-search").value.trim()), k = $("#texts-kind").value;
    const list = TEXTS.filter((t) => (era === "all" || t.era === era) && (k === "all" || t.kind === k) &&
      (!q || strip([t.title, t.author, t.text, t.taste].join(" ")).includes(q)));
    $("#texts-list").innerHTML = list.map(textHTML).join("") || `<p class="note">لا نتيجة.</p>`;
    $("#texts-count").textContent = `${ar(list.length)} من ${ar(TEXTS.length)}`;
  }
  $("#era-filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    era = b.dataset.era;
    $$("#era-filters .chip").forEach((c) => c.classList.toggle("active", c === b));
    renderTexts();
  });
  $("#texts-search").addEventListener("input", renderTexts);
  $("#texts-kind").addEventListener("change", renderTexts);

  /* ===== التدريب الحر ===== */
  $("#pr-type").innerHTML = `<option value="mix">منوّعة</option>` + Object.entries(QTYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("#pr-level").innerHTML = `<option value="all">كل المراحل</option>` + LEVELS.map((L) => `<option value="${L.n}">${ar(L.n)}: ${L.title}</option>`).join("");
  const pr = store.get("dhaiqa.practice", { ok: 0, no: 0, streak: 0 });
  function practiceStats() { $("#pr-ok").textContent = ar(pr.ok); $("#pr-no").textContent = ar(pr.no); $("#pr-streak").textContent = ar(pr.streak); }
  function practiceNext() {
    const t0 = $("#pr-type").value, lv = $("#pr-level").value;
    const type = t0 === "mix" ? U.pick(Object.keys(QTYPES)) : t0;
    const dp = lv === "all" || lv === "6" ? DICT : DICT.filter((d) => d.level === +lv);
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
      <ul class="findings">${hits.map((h, k) => `<li><span class="num">${ar(k + 1)}</span>«${esc(text.slice(h.s, h.e))}» ← الفصيح: <span class="fus">${esc(h.d.fus)}</span><br><small>${esc(h.d.note)} — مثال: ${esc(h.d.good)}</small></li>`).join("")}</ul>`;
  }
  $("#checker-run").addEventListener("click", runChecker);
  $("#checker-clear").addEventListener("click", () => { $("#checker-input").value = ""; $("#checker-output").innerHTML = ""; $("#checker-input").focus(); });

  /* ===== التوجيه ===== */
  const ALIASES = { principles: "home", about: "home", quiz: "practice" };
  function route() {
    let h = (location.hash || "#home").slice(1);
    h = ALIASES[h] || h;
    let page = h, lv = null;
    const m = h.match(/^level-(\d)$/);
    if (m) { page = "level"; lv = +m[1]; }
    if (h === "cert") page = "level";
    if (!$(`.page[data-page="${page}"]`)) page = "home";
    $$(".page").forEach((p) => { p.hidden = p.dataset.page !== page; });
    $$(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === page || (page === "level" && a.dataset.nav === "path")));
    if (page === "home") renderHome();
    if (page === "path") renderPath();
    if (page === "level") { if (h === "cert") renderCert(); else { levelTab = "lesson"; renderLevel(lv); } }
    if (page === "dict") renderDict();
    if (page === "texts") renderTexts();
    if (page === "practice" && !$("#practice-quiz").children.length) { practiceStats(); practiceNext(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
