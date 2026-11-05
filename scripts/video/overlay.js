/* طبقة العرض داخل الصفحة أثناء تسجيل الفيديو: الشرح المكتوب، والبطاقات، والمؤشر، والتظليل.
   تُحقن بواسطة scripts/video/render.js، ولا تُحمَّل في الموقع العادي. */
(() => {
  if (window.__V) return;
  const css = `
  #v-cap { position: fixed; left: 0; right: 0; margin: 0 auto; width: fit-content; z-index: 2147483000; pointer-events: none;
    max-width: min(90vw, 1060px); box-sizing: border-box; padding: .55em 1.1em .65em; border-radius: 14px; text-align: center;
    background: rgba(12, 31, 51, .9); color: #f6ecd2; border: 1.5px solid #d6a952; box-shadow: 0 8px 30px rgba(0,0,0,.35);
    font: 600 var(--v-cap-size, 26px)/1.7 "Noto Naskh Arabic", "Amiri", serif; opacity: 0; transition: opacity .35s; }
  #v-cap.on { opacity: 1; }
  #v-cap.ltr { direction: ltr; font-family: "Noto Naskh Arabic", system-ui, sans-serif; font-weight: 600; }
  #v-cursor { position: fixed; z-index: 2147483001; width: 26px; height: 26px; margin: -4px 0 0 -4px; pointer-events: none;
    transition: left var(--v-glide, .7s) cubic-bezier(.4,.1,.2,1), top var(--v-glide, .7s) cubic-bezier(.4,.1,.2,1), opacity .3s; opacity: 0; }
  #v-cursor svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
  .v-ripple { position: fixed; z-index: 2147483000; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
    border: 3px solid #d6a952; pointer-events: none; animation: v-rip .6s ease-out forwards; }
  @keyframes v-rip { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
  .v-hl { position: fixed; z-index: 2147482999; pointer-events: none; border-radius: 14px;
    box-shadow: 0 0 0 4px #d6a952, 0 0 0 9px rgba(214,169,82,.35), 0 0 30px 8px rgba(214,169,82,.45); animation: v-pulse 1.6s ease-in-out infinite; }
  @keyframes v-pulse { 50% { box-shadow: 0 0 0 4px #d6a952, 0 0 0 13px rgba(214,169,82,.22), 0 0 40px 12px rgba(214,169,82,.35); } }
  #v-card { position: fixed; inset: 0; z-index: 2147482998; display: grid; place-items: center; text-align: center;
    background: #0f2a44; color: #f6ecd2; overflow: hidden; }
  #v-card::before { content: ""; position: absolute; inset: -10%; background-image: var(--pattern); background-size: 110px; opacity: .16;
    animation: v-drift 18s linear infinite; }
  @keyframes v-drift { to { transform: translate(110px, 55px); } }
  #v-card .in { position: relative; padding: 0 6vw; animation: v-rise .9s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes v-rise { from { opacity: 0; transform: translateY(24px); } }
  #v-card .star { width: 13vmin; height: 13vmin; margin: 0 auto 3vmin; clip-path: var(--star); background: #d6a952; color: #0f2a44;
    display: grid; place-items: center; font: 700 7vmin/1 "Amiri", serif; animation: v-spin 1.2s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes v-spin { from { transform: rotate(-90deg) scale(.4); opacity: 0; } }
  #v-card h1 { font: 700 var(--v-title, 7.2vmin)/1.35 "Amiri", serif; margin: 0 0 1.6vmin; color: #f3d58f; }
  #v-card p { font: 400 var(--v-sub, 3.6vmin)/1.7 "Noto Naskh Arabic", "Amiri", serif; margin: 0 auto; max-width: 30em; color: #f1e6c9; }
  #v-card .band { position: absolute; inset-inline: 0; height: 7px; background: var(--band); }
  #v-card .band.t { top: 0; } #v-card .band.b { bottom: 0; }
  #v-card .url { margin-top: 3.4vmin; font: 600 2.8vmin/1 "Noto Naskh Arabic", sans-serif; color: #d6a952; direction: ltr; letter-spacing: .02em; }
  #v-card.ltr p, #v-card.ltr h1 { direction: ltr; }
  #v-mark { position: fixed; z-index: 2147482997; top: 10px; inset-inline-start: 50%; transform: translateX(-50%); pointer-events: none; display: none; }
  html.v-rec .player { display: none !important; }
  html.v-rec { scroll-behavior: smooth; }
  html.v-rec *::-webkit-scrollbar { display: none; }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add("v-rec");
  const cap = Object.assign(document.createElement("div"), { id: "v-cap" });
  const cur = Object.assign(document.createElement("div"), { id: "v-cursor" });
  cur.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.4 3.9 7.3-3 1.6-3.9-7.4L4 19z" fill="#fffcf4" stroke="#0f2a44" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  document.body.append(cap, cur);
  let hls = [];

  const V = {
    caption(text, ltr, bottom) {
      cap.classList.toggle("ltr", !!ltr);
      cap.style.bottom = (bottom || 24) + "px";
      if (!text) { cap.classList.remove("on"); return; }
      cap.textContent = text; cap.classList.add("on");
    },
    card(c, ltr, url) {
      V.uncard();
      const d = document.createElement("div"); d.id = "v-card"; if (ltr) d.className = "ltr";
      d.innerHTML = `<div class="band t"></div><div class="in"><div class="star">ض</div><h1></h1><p></p>${url ? `<div class="url"></div>` : ""}</div><div class="band b"></div>`;
      d.querySelector("h1").textContent = c.title || ""; d.querySelector("p").textContent = c.sub || "";
      if (url) d.querySelector(".url").textContent = url;
      document.body.appendChild(d);
    },
    uncard() { const d = document.getElementById("v-card"); if (d) d.remove(); },
    cursorTo(x, y) { cur.style.opacity = 1; cur.style.left = x + "px"; cur.style.top = y + "px"; },
    ripple(x, y) { const r = document.createElement("div"); r.className = "v-ripple"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); },
    highlight(el) {
      const box = document.createElement("div"); box.className = "v-hl"; document.body.appendChild(box);
      const place = () => { const r = el.getBoundingClientRect(); Object.assign(box.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" }); };
      place(); const t = setInterval(place, 60); hls.push({ box, t });
    },
    clearHighlights() { hls.forEach((h) => { clearInterval(h.t); h.box.remove(); }); hls = []; },
    // يجيب عن السؤال المعروض إجابة صحيحة (للعرض فقط)
    answer() {
      const box = document.querySelector(".page:not([hidden]) .q-box") || document.querySelector(".q-box");
      if (!box) return null;
      const strip = (s) => s.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();
      const opts = [...box.querySelectorAll(".option:not(:disabled)")];
      if (opts.length) {
        const txt = strip(box.textContent);
        const goods = new Set(DICT.map((d) => strip(d.good)));
        let pick = opts.find((o) => goods.has(strip(o.textContent)));
        if (!pick && /فصيحة أم عرنجية|احكم/.test(txt)) {
          const s = box.querySelector(".q-sentence"); const isGood = s && goods.has(strip(s.textContent));
          pick = opts.find((o) => (isGood ? /فصيحة/ : /عرنجية/).test(o.textContent));
        }
        if (!pick) {
          for (const d of DICT) {
            const arn = strip(d.arn);
            if (txt.includes(arn)) { pick = opts.find((o) => [d.fus, d.src, d.shahid && d.shahid.text].filter(Boolean).map(strip).includes(strip(o.textContent))); if (pick) break; }
          }
        }
        const q0 = box.querySelector(".q-text");
        if (!pick && q0 && q0.textContent.includes("………")) {
          const norm = (s) => strip(s).replace(/[\s .،«»﴿﴾]/g, "");
          const [a, b] = q0.textContent.split("………");
          const all = new Set(TEXTS.map((t) => norm(t.text)));
          pick = opts.find((o) => all.has(norm(a + o.textContent + b)));
        }
        if (!pick) {
          const q = box.querySelector(".q-text"); const qt = q ? strip(q.textContent).replace(/………/, "") : "";
          for (const t of TEXTS) {
            const tt = strip(t.text);
            if (qt && tt.replace(/\s/g, "").includes(qt.split("………")[0].replace(/\s/g, "").slice(0, 25))) {
              pick = opts.find((o) => ERAS[t.era] === o.textContent.trim() || strip(t.author).startsWith(strip(o.textContent)) || tt.includes(strip(o.textContent)));
              if (pick) break;
            }
          }
        }
        return pick || opts[0];
      }
      const words = [...box.querySelectorAll(".word:not(:disabled)")];
      if (words.length) {
        const line = strip(words.map((w) => w.textContent).join(" "));
        const d = DICT.find((x) => strip(x.bad) === line);
        if (d) {
          const hits = U.findAll(d.bad, d.re); const h = hits[0];
          let pos = 0;
          for (const w of words) { const s = d.bad.indexOf(w.textContent, pos); const e = s + w.textContent.length; pos = e; if (h && s < h.e && e > h.s) return w; }
        }
        return words[0];
      }
      return null;
    },
  };
  window.__V = V;
})();
