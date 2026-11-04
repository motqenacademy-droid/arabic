/* =========================================================
   الصوت: تلاوة الشيخ محمود خليل الحصري للآيات (من EveryAyah)،
   وتسجيلات مرفوعة إن وُجدت، وإلا فأجود صوت عربي في المتصفح.
   ========================================================= */
const Audio2 = (() => {
  const SURAHS = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
  const ALIAS = { "الانشراح": 94, "الدهر": 76, "بني اسرائيل": 17, "حم السجده": 41, "ياسين": 36, "المؤمن": 40, "تبارك": 67, "عم": 78, "اللهب": 111, "التوحيد": 112 };
  const norm = (s) => String(s).replace(/[ً-ْٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
  const MAP = {};
  SURAHS.forEach((n, i) => { MAP[norm(n)] = i + 1; MAP[norm(n).replace(/^ال/, "")] = i + 1; });
  Object.entries(ALIAS).forEach(([k, v]) => { MAP[norm(k)] = v; });

  /* «سورة الضحى: 9–10» ← {s:93, from:9, to:10} */
  function parseRef(ref) {
    const m = String(ref || "").match(/سورة\s+([^:：]+?)\s*[:：]\s*([\d٠-٩]+)(?:\s*[–\-—]\s*([\d٠-٩]+))?/);
    if (!m) return null;
    const d = (x) => +String(x).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c));
    const s = MAP[norm(m[1])] || MAP[norm(m[1]).replace(/^ال/, "")];
    if (!s) return null;
    const from = d(m[2]), to = m[3] ? d(m[3]) : from;
    return to >= from && to - from < 40 ? { s, from, to } : null;
  }
  const pad = (n) => String(n).padStart(3, "0");
  const ayahUrl = (s, a) => `https://everyayah.com/data/Husary_128kbps/${pad(s)}${pad(a)}.mp3`;

  /* ===== شريط التشغيل ===== */
  let bar, label, stopBtn, voiceSel;
  const player = new Audio();
  player.preload = "auto";
  let queue = [], onEnd = null;

  function ensureBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "player";
    bar.hidden = true;
    bar.innerHTML = `<span class="player-icon" aria-hidden="true">۞</span><span class="player-label"></span>
      <select class="player-voice" aria-label="صوت القراءة" hidden></select>
      <button class="player-stop" aria-label="إيقاف">■ إيقاف</button>`;
    document.body.appendChild(bar);
    label = bar.querySelector(".player-label");
    stopBtn = bar.querySelector(".player-stop");
    voiceSel = bar.querySelector(".player-voice");
    stopBtn.addEventListener("click", stop);
    voiceSel.addEventListener("change", () => { try { localStorage.setItem("dhaiqa.voice", voiceSel.value); } catch (e) {} });
  }
  function show(text, tts) {
    ensureBar(); bar.hidden = false; label.textContent = text;
    voiceSel.hidden = !tts;
    if (tts) fillVoices();
  }
  function hide() { if (bar) bar.hidden = true; }
  function stop() {
    queue = []; player.onerror = null; player.pause(); player.removeAttribute("src");
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    document.querySelectorAll(".speak.playing").forEach((b) => b.classList.remove("playing"));
    hide();
  }

  function playQueue(title) {
    if (!queue.length) { stop(); return; }
    const u = queue.shift();
    player.src = u;
    player.play().catch(() => { if (!player.onerror) fail(title); });
  }
  function fail(title) {
    show(`تعذّر تحميل التلاوة الآن${title ? ` (${title})` : ""}. تحقّق من الاتصال بالإنترنت.`, false);
    queue = [];
  }
  player.addEventListener("ended", () => playQueue(label ? label.textContent : ""));
  player.addEventListener("error", () => { if (player.getAttribute("src") && !player.onerror) fail(""); });

  function playQuran(ref, btn) {
    const r = typeof ref === "string" ? parseRef(ref) : ref;
    if (!r) return false;
    stop();
    queue = [];
    for (let a = r.from; a <= r.to; a++) queue.push(ayahUrl(r.s, a));
    show(`تلاوة الشيخ محمود خليل الحصري — سورة ${SURAHS[r.s - 1]}: ${r.from}${r.to > r.from ? "–" + r.to : ""}`, false);
    if (btn) btn.classList.add("playing");
    playQueue("");
    return true;
  }

  function playFile(url, title, btn) {
    stop(); queue = [url]; show(title, false);
    if (btn) btn.classList.add("playing");
    playQueue(title);
  }

  /* ===== القراءة الآلية بأجود صوت عربي ===== */
  function voices() { return "speechSynthesis" in window ? speechSynthesis.getVoices().filter((v) => /^ar/i.test(v.lang)) : []; }
  function score(v) {
    let s = 0; const n = v.name;
    if (/natural|neural|online|premium|enhanced/i.test(n)) s += 60;
    if (/google/i.test(n)) s += 35;
    if (/hamed|zariyah|shakir|salma|maged|tarik|laila|mariam|hoda|naayf|fatima|amina|layla/i.test(n)) s += 20;
    if (/ar-SA/i.test(v.lang)) s += 8;
    if (/ar-EG/i.test(v.lang)) s += 5;
    if (v.localService === false) s += 5;
    return s;
  }
  function bestVoice() {
    const vs = voices();
    let saved = null; try { saved = localStorage.getItem("dhaiqa.voice"); } catch (e) {}
    return vs.find((v) => v.name === saved) || vs.sort((a, b) => score(b) - score(a))[0] || null;
  }
  function fillVoices() {
    const vs = voices().sort((a, b) => score(b) - score(a));
    const cur = bestVoice();
    voiceSel.innerHTML = vs.length ? vs.map((v) => `<option value="${v.name.replace(/"/g, "&quot;")}" ${cur && v.name === cur.name ? "selected" : ""}>${v.name}</option>`).join("")
      : `<option>لا يوجد صوت عربي في متصفحك</option>`;
  }
  if ("speechSynthesis" in window) speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", () => { if (bar && !voiceSel.hidden) fillVoices(); });

  function chunks(text) {
    const clean = text.replace(/[﴿﴾«»"]/g, "").replace(/\s*\.\.\.\s*/g, "\n");
    return clean.split(/\n|(?<=[.،؛:؟!])\s+/).map((s) => s.trim()).filter(Boolean)
      .flatMap((s) => s.length > 180 ? s.match(/.{1,180}(\s|$)/g) : [s]);
  }
  function speak(text, title, btn) {
    stop();
    if (!("speechSynthesis" in window)) { show("متصفحك لا يدعم القراءة الصوتية.", false); return; }
    const v = bestVoice();
    show(v ? `قراءة آلية — ${title}` : "لا يوجد صوت عربي مثبّت في متصفحك. جرّب Chrome أو Edge.", true);
    if (btn) btn.classList.add("playing");
    const parts = chunks(text);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = v ? v.lang : "ar-SA"; if (v) u.voice = v;
      u.rate = 0.82; u.pitch = 1;
      if (i === parts.length - 1) u.onend = () => { if (btn) btn.classList.remove("playing"); hide(); };
      speechSynthesis.speak(u);
    });
  }

  /* ===== التسجيلات المولّدة عند النشر (صوت Microsoft العصبي) ===== */
  // يجب أن تطابق hash في scripts/tts-list.js
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0") + s.length.toString(16); }
  let recorded = null;
  const manifest = fetch("audio/tts/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : [])).then((a) => { recorded = new Set(a); }).catch(() => { recorded = new Set(); });
  function hasRecording(t) { return !!(recorded && recorded.has(hash(t.text))); }

  /* نقطة الدخول: نص من المختارات */
  async function playText(t, btn) {
    if (t.audio && t.audio.url) return playFile(t.audio.url, t.title, btn);
    if (t.kind === "قرآن" && playQuran(t.audio && t.audio.s ? t.audio : t.ref, btn)) return;
    if (t.kind === "قرآن") { show("لم يُعرف موضع الآية لتشغيل التلاوة.", false); return; }
    if (!recorded) { try { await Promise.race([manifest, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {} }
    if (hasRecording(t)) {
      stop(); queue = [`audio/tts/${hash(t.text)}.mp3`];
      show(`${t.title} — قراءة بصوت عربي عصبي`, false);
      if (btn) btn.classList.add("playing");
      player.onerror = () => { player.onerror = null; speak(t.text, t.title, btn); };
      playQueue("");
      return;
    }
    speak(t.text, t.title, btn);
  }
  return { parseRef, playQuran, playText, speak, stop, SURAHS, hash };
})();
