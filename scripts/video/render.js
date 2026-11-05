#!/usr/bin/env node
/* يصوّر فيديو من «لوحة مشاهد» (storyboard) بتشغيل الموقع الحقيقي في Chromium.
   node scripts/video/render.js --board video/promo.json --lang ar --format landscape \
        [--audio video/build/audio] [--base http://localhost:8765/index.html] [--out video/out] [--only <sceneId>]
   - يسجّل كل مشهد بواجهة Chrome للبث (screencast) بدقة الجهاز الكاملة (1920×1080 أو 1080×1920).
   - إن وُجد تسجيل الراوي audio/<board>-<lang>-<scene>.mp3 ضُبط طول المشهد عليه، وإلا قُدّر من عدد الكلمات.
   - يُخرج <out>/<board>-<lang>-<format>.mp4 وصورة غلاف .jpg. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = require("playwright");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, "..", "..");
const BOARD = JSON.parse(fs.readFileSync(path.resolve(arg("board")), "utf8"));
const LANG = arg("lang", "ar"), FORMAT = arg("format", "landscape");
const BASE = arg("base", "http://localhost:8765/index.html");
const AUDIO = path.resolve(arg("audio", path.join(ROOT, "video/build/audio")));
const OUT = path.resolve(arg("out", path.join(ROOT, "video/out")));
const ONLY = arg("only", null);
const NAME = `${BOARD.id}-${LANG}-${FORMAT}`;
const WORK = path.join(ROOT, "video/build/work", NAME);
const URL_TEXT = "motqenacademy-droid.github.io/arabic";
const FPS = 30, LEAD = 0.35, TAIL = 0.75;
// إيقاع العرض: أقل من 1 أسرع (الدعائي)، و1 هادئ (التعليمي)
const PACE = parseFloat(arg("pace", BOARD.pace || "1"));
const P = (ms) => Math.round(ms * PACE);
const FMT = FORMAT === "portrait"
  ? { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, W: 1080, H: 1920, capSize: 17, capBottom: 84 }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, isMobile: false, hasTouch: false, W: 1920, H: 1080, capSize: 25, capBottom: 26 };
const ltr = LANG !== "ar";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args) => { const r = cp.spawnSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }); if (r.status) throw new Error(`${cmd} ${args.join(" ")}\n${r.stderr}`); return r.stdout.toString(); };
const probe = (f) => parseFloat(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));

const say = (s) => (LANG === "ar" ? s.say_ar : s.say_en) || "";
const capOf = (s) => (LANG === "ar" ? s.cap_ar : s.cap_en) || "";
function narrationFile(s) { const f = path.join(AUDIO, `${BOARD.id}-${LANG}-${s.id}.mp3`); return fs.existsSync(f) ? f : null; }
function narrationDur(s) {
  const f = narrationFile(s); if (f) return probe(f);
  const words = say(s).trim().split(/\s+/).filter(Boolean).length;
  return words ? words / (LANG === "ar" ? 1.55 : 2.3) : 0; // معايَرة على أصوات Hamed (+6%) وAndrew
}
/* تقسيم الشرح المكتوب إلى جمل موقوتة بنسبة طولها */
function captionPlan(s, dur) {
  if (!s.go && s.card) return []; // البطاقة تعرض نصّها بنفسها
  const fixed = capOf(s);
  if (fixed) return [{ at: LEAD, text: fixed }];
  const text = say(s).trim(); if (!text) return [];
  const parts = text.split(/(?<=[.!?؟؛])\s+/).flatMap((p) => p.length > 120 ? p.split(/(?<=[،,:])\s+/) : [p]).filter(Boolean);
  const merged = []; for (const p of parts) { const last = merged[merged.length - 1]; if (last && (last + " " + p).length < 70) merged[merged.length - 1] = last + " " + p; else merged.push(p); }
  const total = merged.reduce((a, p) => a + p.length, 0); let t = LEAD;
  return merged.map((p) => { const at = t; t += dur * (p.length / total); return { at, text: p }; });
}

async function newPage(browser, scene) {
  const ctx = await browser.newContext({ viewport: FMT.viewport, deviceScaleFactor: FMT.deviceScaleFactor, isMobile: FMT.isMobile, hasTouch: FMT.hasTouch, colorScheme: "light", locale: "ar" });
  if (scene.mock === "teacher") {
    const mock = fs.readFileSync(path.join(__dirname, "mock-cloud.js"), "utf8");
    await ctx.route("**/js/cloud.js", (r) => r.fulfill({ contentType: "application/javascript", body: mock }));
  }
  await ctx.route("**/audio/tts/index.json", (r) => r.fulfill({ contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.warn("  pageerror:", e.message));
  return { ctx, page };
}
async function prepare(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: path.join(__dirname, "overlay.js") });
  await page.evaluate(([size]) => { document.documentElement.style.setProperty("--v-cap-size", size + "px"); }, [FMT.capSize]);
}
async function visible(page, sel) {
  const loc = page.locator(sel);
  const n = await loc.count();
  for (let i = 0; i < n; i++) { const it = loc.nth(i); if (await it.isVisible()) return it; }
  throw new Error(`لا عنصر ظاهر يطابق ${sel}`);
}
async function center(page, el) {
  await el.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" }));
  await sleep(P(650));
  const b = await el.boundingBox();
  return { x: b.x + Math.min(b.width / 2, b.width - 12), y: b.y + b.height / 2 };
}
async function moveAndClick(page, el) {
  const { x, y } = await center(page, el);
  await page.evaluate(([x, y]) => __V.cursorTo(x, y), [x, y]);
  await sleep(P(780));
  await page.evaluate(([x, y]) => __V.ripple(x, y), [x, y]);
  await el.evaluate((e) => e.click());
  await sleep(P(350));
}
async function runStep(page, st) {
  const v = st.value;
  // أي فعل جديد يزيل حلقة التظليل السابقة، فلا تبقى حلقة قديمة فوق نافذة أو بعد تمرير
  if (["click", "type", "select", "scroll", "scrollTo", "answer", "more"].includes(st.op)) await page.evaluate(() => __V.clearHighlights());
  switch (st.op) {
    case "click": return moveAndClick(page, await visible(page, st.target));
    case "type": {
      const el = await visible(page, st.target);
      await moveAndClick(page, el);
      await el.fill("");
      await el.pressSequentially(v || "", { delay: Math.round((LANG === "ar" ? 55 : 40) * PACE) });
      await el.evaluate((e) => e.dispatchEvent(new Event("input", { bubbles: true })));
      return sleep(P(300));
    }
    case "select": {
      const el = await visible(page, st.target);
      const { x, y } = await center(page, el);
      await page.evaluate(([x, y]) => { __V.cursorTo(x, y); }, [x, y]); await sleep(P(700));
      await page.evaluate(([x, y]) => __V.ripple(x, y), [x, y]);
      await el.selectOption(v); return sleep(P(500));
    }
    case "scroll": await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), parseInt(v || "400", 10)); return sleep(P(1000));
    case "scrollTo": await (await visible(page, st.target)).evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" })); return sleep(P(900));
    case "highlight": {
      const el = await visible(page, st.target);
      await el.evaluate((e) => { if (getComputedStyle(e).position !== "fixed") e.scrollIntoView({ block: "center", behavior: "smooth" }); });
      await sleep(P(600)); await el.evaluate((e) => __V.highlight(e)); return sleep(P(400));
    }
    case "answer": {
      const h = await page.evaluateHandle(() => __V.answer()); const el = h.asElement();
      if (!el) throw new Error("لا سؤال ظاهر للإجابة عنه");
      await moveAndClick(page, el); return sleep(P(500));
    }
    case "more": {
      const [kind, ...rest] = String(v).split(":"); const key = rest.join(":");
      const id = await page.evaluate(([kind, key]) => {
        const n = (s) => s.replace(/[ً-ْٰـ]/g, "").trim();
        const it = kind === "dict" ? DICT.find((d) => d.arn === key) || DICT.find((d) => n(d.arn) === n(key)) : TEXTS.find((t) => t.title === key) || TEXTS.find((t) => n(t.title) === n(key));
        return it ? it.id : null;
      }, [kind, key]);
      if (id === null) throw new Error(`«more» لم يجد ${v}`);
      const btn = page.locator(`.page:not([hidden]) [data-more="${kind}:${id}"]`);
      if (await btn.count() && await btn.first().isVisible()) await moveAndClick(page, btn.first());
      else await page.evaluate(([kind, id]) => { const b = document.createElement("button"); b.dataset.more = `${kind}:${id}`; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, [kind, id]);
      await sleep(P(500));
      return page.evaluate(() => { const m = document.querySelector("#modal-body"); if (m) m.scrollTop = 0; });
    }
    case "wait": return sleep(P(st.ms || parseInt(v || "800", 10)));
    default: throw new Error("خطوة غير معروفة: " + st.op);
  }
}

async function recordScene(browser, scene, idx, state, total) {
  const dur = narrationDur(scene);
  const target = Math.max(dur + LEAD + TAIL, scene.go ? 3 : 3.2);
  if (!scene.keep || !state.page) {
    if (state.ctx) await state.ctx.close();
    Object.assign(state, await newPage(browser, scene));
    await state.page.goto(BASE + (scene.go || "#home"), { waitUntil: "load" });
    await sleep(500);
    await prepare(state.page);
  }
  await state.page.evaluate((p) => document.documentElement.style.setProperty("--v-glide", (0.7 * p).toFixed(2) + "s"), PACE);
  const page = state.page;
  await page.evaluate(() => { __V.clearHighlights(); __V.uncard(); __V.caption(""); });
  if (!scene.go && scene.card) {
    const c = scene.card;
    await page.evaluate(([c, ltr, url]) => __V.card(c, ltr, url), [{ title: ltr ? c.en_title : c.ar_title, sub: ltr ? c.en_sub : c.ar_sub }, ltr, (idx === 0 || idx === total - 1) ? URL_TEXT : ""]);
  }
  const dir = path.join(WORK, String(idx).padStart(2, "0") + "-" + scene.id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => { frames.push({ data: f.data, t: f.metadata.timestamp }); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: FMT.W, maxHeight: FMT.H, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await page.evaluate(() => { document.body.style.outline = "0.1px solid transparent"; });
  await page.evaluate(([plan, ltr, bottom]) => { plan.forEach((p) => setTimeout(() => __V.caption(p.text, ltr, bottom), p.at * 1000)); }, [captionPlan(scene, dur), ltr, FMT.capBottom]);
  await sleep(LEAD * 1000);
  for (const st of scene.steps || []) {
    try { await runStep(page, st); await sleep(P(420)); } catch (e) { console.warn(`  ⚠ ${scene.id}: ${st.op} ${st.target || st.value || ""}: ${e.message.split("\n")[0]}`); state.warnings++; }
  }
  const left = target - (Date.now() / 1000 - t0);
  if (left > 0) await sleep(left * 1000);
  await page.evaluate(() => { document.body.style.outline = ""; });
  await sleep(120);
  const t1 = Date.now() / 1000;
  await cdp.send("Page.stopScreencast"); await cdp.detach().catch(() => {});
  // كتابة الإطارات وقائمة مُدَدها
  const fr = frames.filter((f) => f.t <= t1 + 0.05);
  if (!fr.length) throw new Error("لم يُلتقط أي إطار في المشهد " + scene.id);
  let list = "";
  fr.forEach((f, i) => {
    const file = path.join(dir, `f${String(i).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    const start = i === 0 ? t0 : Math.max(f.t, t0);
    const end = i + 1 < fr.length ? Math.max(fr[i + 1].t, t0) : t1;
    list += `file '${file}'\nduration ${Math.max(end - start, 0.001).toFixed(4)}\n`;
  });
  list += `file '${path.join(dir, `f${String(fr.length - 1).padStart(5, "0")}.jpg`)}'\n`;
  fs.writeFileSync(path.join(dir, "list.txt"), list);
  const realDur = t1 - t0;
  // ترميز المشهد مع صوت الراوي (أو صمت)
  const clip = path.join(WORK, String(idx).padStart(2, "0") + ".mp4");
  const narr = narrationFile(scene);
  const fades = [];
  if (idx === 0) fades.push("fade=t=in:st=0:d=0.5");
  if (idx === total - 1) fades.push(`fade=t=out:st=${(realDur - 0.7).toFixed(2)}:d=0.7`);
  const vf = [`scale=${FMT.W}:${FMT.H}:force_original_aspect_ratio=decrease`, `pad=${FMT.W}:${FMT.H}:(ow-iw)/2:(oh-ih)/2:color=0x0f2a44`, `fps=${FPS}`, ...fades, "format=yuv420p"].join(",");
  const audioIn = narr ? ["-itsoffset", String(LEAD), "-i", narr] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  const af = ["aresample=48000", "aformat=channel_layouts=stereo", "apad"];
  if (idx === total - 1) af.push(`afade=t=out:st=${(realDur - 0.7).toFixed(2)}:d=0.7`);
  sh("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), ...audioIn,
    "-vf", vf, "-af", af.join(","), "-map", "0:v", "-map", "1:a", "-t", realDur.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", clip]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`  ✓ ${String(idx).padStart(2, "0")} ${scene.id}  ${realDur.toFixed(1)}s  (${fr.length} إطاراً${narr ? "، بصوت" : "، صامت"})`);
  return clip;
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  console.log(`▶ ${NAME}`);
  const browser = await chromium.launch();
  const state = { warnings: 0 };
  const scenes = BOARD.scenes.filter((s) => !ONLY || s.id === ONLY);
  const clips = [];
  for (let i = 0; i < scenes.length; i++) clips.push(await recordScene(browser, scenes[i], i, state, scenes.length));
  if (state.ctx) await state.ctx.close();
  await browser.close();
  const list = path.join(WORK, "clips.txt");
  fs.writeFileSync(list, clips.map((c) => `file '${c}'`).join("\n") + "\n");
  const out = path.join(OUT, `${NAME}${ONLY ? "-" + ONLY : ""}.mp4`);
  sh("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  sh("ffmpeg", ["-y", "-v", "error", "-ss", "1.6", "-i", out, "-frames:v", "1", "-q:v", "3", out.replace(/\.mp4$/, ".jpg")]);
  console.log(`✔ ${path.relative(ROOT, out)}  ${probe(out).toFixed(1)}s  ${(fs.statSync(out).size / 1048576).toFixed(1)}MB  تحذيرات: ${state.warnings}`);
  if (state.warnings && process.argv.includes("--strict")) process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
