(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  // إزالة التشكيل والتطويل لمطابقة أدقّ
  const strip = (s) => s.replace(/[ً-ْٰـ]/g, "");

  /* ===== الوضع الليلي والقائمة ===== */
  const root = document.documentElement;
  const savedTheme = store.get("theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  $(".theme-toggle").addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("theme", next);
  });
  const nav = $(".nav"), navBtn = $(".nav-toggle");
  navBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navBtn.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", (e) => { if (e.target.tagName === "A") nav.classList.remove("open"); });

  const eraTag = (era) => `<span class="tag ${era}">${ERAS[era]}</span>`;

  /* ===== نص اليوم ===== */
  const dayIndex = Math.floor(Date.now() / 86400000) % TEXTS.length;
  let dailyI = dayIndex;
  function renderDaily() {
    const t = TEXTS[dailyI];
    $("#daily-era").className = "tag " + t.era;
    $("#daily-era").textContent = ERAS[t.era];
    $("#daily-text").textContent = t.text.replace(/ \.\.\. /g, "  ");
    $("#daily-meta").textContent = `${t.author} — ${t.ref}`;
  }
  $("#daily-next").addEventListener("click", () => {
    let n; do { n = Math.floor(Math.random() * TEXTS.length); } while (n === dailyI && TEXTS.length > 1);
    dailyI = n; renderDaily();
  });
  renderDaily();

  /* ===== الأصول ===== */
  $("#principles-list").innerHTML = PRINCIPLES.map((p) => `<li><h3>${esc(p.t)}</h3><p>${esc(p.d)}</p></li>`).join("");

  /* ===== المعجم ===== */
  function entryHTML(d) {
    const sh = d.shahid
      ? `<div class="shahid">${esc(d.shahid.text)}<small>${eraTag(d.shahid.era)} ${esc(d.shahid.ref)}</small></div>`
      : "";
    return `<article class="card entry">
      <div class="entry-head">
        <span class="arn">${esc(d.arn)}</span>
        <span class="arrow" aria-hidden="true">←</span>
        <span class="fus">${esc(d.fus)}</span>
      </div>
      <div class="src">${esc(d.src)}</div>
      <p class="explain">${esc(d.note)}</p>
      <div class="pair">
        <div class="b"><span>✗</span>${esc(d.bad)}</div>
        <div class="g"><span>✓</span>${esc(d.good)}</div>
      </div>
      ${sh}
    </article>`;
  }
  function renderDict(q) {
    const nq = strip((q || "").trim());
    const list = !nq ? DICT : DICT.filter((d) =>
      strip([d.arn, d.fus, d.src, d.note, d.bad, d.good].join(" ")).toLowerCase().includes(nq.toLowerCase()));
    $("#dict-list").innerHTML = list.map(entryHTML).join("") ||
      `<p class="note">لا نتيجة. جرّب كلمة أخرى.</p>`;
    $("#dict-count").textContent = `${toArabicDigits(list.length)} من ${toArabicDigits(DICT.length)} تركيباً`;
  }
  $("#dict-search").addEventListener("input", (e) => renderDict(e.target.value));
  renderDict("");

  /* ===== المختارات ===== */
  const canSpeak = "speechSynthesis" in window;
  function renderTexts(era) {
    const list = era === "all" ? TEXTS : TEXTS.filter((t) => t.era === era);
    $("#texts-list").innerHTML = list.map((t) => {
      const i = TEXTS.indexOf(t);
      return `<article class="card text-card">
        <header>${eraTag(t.era)}<span class="kind">${esc(t.kind)}</span>
          ${canSpeak ? `<button class="speak" data-i="${i}" title="استمع">🔊 استمع</button>` : ""}
        </header>
        <h3>${esc(t.title)}</h3>
        <div class="body">${esc(t.text.replace(/ \.\.\. /g, "  "))}</div>
        <p class="who">${esc(t.author)} · ${esc(t.ref)}</p>
        <div class="taste"><b>لمسة تذوّق: </b>${esc(t.taste)}</div>
      </article>`;
    }).join("");
  }
  $("#era-filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    document.querySelectorAll("#era-filters .chip").forEach((c) => c.classList.toggle("active", c === b));
    renderTexts(b.dataset.era);
  });
  $("#texts-list").addEventListener("click", (e) => {
    const b = e.target.closest(".speak"); if (!b) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(TEXTS[+b.dataset.i].text.replace(/\.\.\./g, "،"));
    u.lang = "ar-SA"; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("ar"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  });
  renderTexts("all");

  /* ===== الامتحان ===== */
  const QN = 10;
  let qs = [], qi = 0, score = 0;
  let best = store.get("quizBest", 0);
  function startQuiz() {
    qs = shuffle(DICT).slice(0, QN);
    qi = 0; score = 0;
    $("#quiz-best").textContent = toArabicDigits(best);
    showQ();
  }
  function showQ() {
    $("#quiz-score").textContent = toArabicDigits(score);
    $("#quiz-feedback").hidden = true;
    $("#quiz-next").hidden = true;
    if (qi >= qs.length) return finish();
    $("#quiz-progress").textContent = `السؤال ${toArabicDigits(qi + 1)} من ${toArabicDigits(qs.length)}`;
    const d = qs[qi];
    const opts = shuffle([{ t: d.good, ok: true }, { t: d.bad, ok: false }]);
    $("#quiz-options").innerHTML = opts.map((o) =>
      `<button class="option" data-ok="${o.ok}">${esc(o.t)}</button>`).join("");
  }
  $("#quiz-options").addEventListener("click", (e) => {
    const b = e.target.closest(".option"); if (!b || b.disabled) return;
    const ok = b.dataset.ok === "true";
    const d = qs[qi];
    document.querySelectorAll("#quiz-options .option").forEach((o) => {
      o.disabled = true;
      if (o.dataset.ok === "true") o.classList.add("correct");
    });
    if (!ok) b.classList.add("wrong"); else score++;
    $("#quiz-score").textContent = toArabicDigits(score);
    const fb = $("#quiz-feedback");
    fb.innerHTML = `<div class="verdict ${ok ? "ok" : "no"}">${ok ? "أحسنت! ذائقةٌ عربية." : "بل الأخرى أجرى على لسان العرب."}</div>
      <div>«${esc(d.arn)}» عرنجية، والفصيح: <strong>${esc(d.fus)}</strong>. ${esc(d.note)}</div>
      ${d.shahid ? `<blockquote>${esc(d.shahid.text)} <small>(${esc(d.shahid.ref)})</small></blockquote>` : ""}`;
    fb.hidden = false;
    const nx = $("#quiz-next");
    nx.textContent = qi + 1 >= qs.length ? "النتيجة" : "السؤال التالي";
    nx.hidden = false; nx.focus();
  });
  $("#quiz-next").addEventListener("click", () => { qi++; showQ(); });
  $("#quiz-restart").addEventListener("click", startQuiz);
  function finish() {
    if (score > best) { best = score; store.set("quizBest", best); }
    $("#quiz-best").textContent = toArabicDigits(best);
    $("#quiz-progress").textContent = "انتهى الامتحان";
    const ratio = score / qs.length;
    const word = ratio === 1 ? "لسانٌ عربيٌّ مبين!" : ratio >= .7 ? "ذائقةٌ حسنة، وبقي قليل." : ratio >= .4 ? "على الطريق؛ أكثِر من قراءة المختارات." : "عُد إلى المعجم والمختارات، ثم امتحن نفسك ثانية.";
    $("#quiz-options").innerHTML = `<div class="quiz-done"><div class="big">${toArabicDigits(score)} / ${toArabicDigits(qs.length)}</div><p>${word}</p></div>`;
  }
  startQuiz();

  /* ===== المحك ===== */
  // نُطابق على النص بعد إزالة التشكيل مع الحفاظ على مواضع الحروف الأصلية
  function buildStripped(s) {
    let out = "", map = [];
    for (let i = 0; i < s.length; i++) {
      if (/[ً-ْٰـ]/.test(s[i])) continue;
      out += s[i]; map.push(i);
    }
    map.push(s.length);
    return { out, map };
  }
  function check(text) {
    const { out, map } = buildStripped(text);
    const hits = [];
    DICT.forEach((d, di) => {
      if (!d.re) return;
      const re = new RegExp(strip(d.re), "g");
      let m;
      while ((m = re.exec(out))) {
        let s = m.index, e = m.index + m[0].length;
        // تجاهل المسافة البادئة إن وُجدت في النمط
        while (s < e && /\s/.test(out[s])) s++;
        if (e > s) hits.push({ s: map[s], e: map[e - 1] + 1, di });
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    hits.sort((a, b) => a.s - b.s || b.e - a.e);
    const kept = [];
    let lastEnd = -1;
    hits.forEach((h) => { if (h.s >= lastEnd) { kept.push(h); lastEnd = h.e; } });
    return kept;
  }
  function runChecker() {
    const text = $("#checker-input").value;
    const out = $("#checker-output");
    if (!text.trim()) { out.innerHTML = ""; return; }
    const hits = check(text);
    if (!hits.length) {
      out.innerHTML = `<p class="clean">لم يجد المِحَكّ تراكيب عرنجية شائعة. أحسنت!</p>`;
      return;
    }
    let html = "", pos = 0;
    hits.forEach((h, k) => {
      html += esc(text.slice(pos, h.s)) + `<mark>${esc(text.slice(h.s, h.e))}<sup>${toArabicDigits(k + 1)}</sup></mark>`;
      pos = h.e;
    });
    html += esc(text.slice(pos));
    const items = hits.map((h, k) => {
      const d = DICT[h.di];
      return `<li><span class="num">${toArabicDigits(k + 1)}</span>«${esc(text.slice(h.s, h.e))}» ← الفصيح: <span class="fus">${esc(d.fus)}</span><br><small>${esc(d.note)}</small></li>`;
    }).join("");
    out.innerHTML = `<div class="marked">${html.replace(/\n/g, "<br>")}</div>
      <p><strong>وجد المِحَكّ ${toArabicDigits(hits.length)} موضعاً:</strong></p><ul class="findings">${items}</ul>`;
  }
  $("#checker-run").addEventListener("click", runChecker);
  $("#checker-clear").addEventListener("click", () => { $("#checker-input").value = ""; $("#checker-output").innerHTML = ""; $("#checker-input").focus(); });
})();
