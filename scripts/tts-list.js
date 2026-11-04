#!/usr/bin/env node
/* يكتب قائمة النصوص المطلوب تسجيلها صوتياً: node scripts/tts-list.js > tts-jobs.json
   كل عنصر: { h: بصمة النص (تطابق ما في js/audio.js), text: النص مهيّأ للقراءة, voice, rate } */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="(js\/(?:data-|content\/)[^"]+)"/g)].map((m) => m[1]);
const ctx = {}; vm.createContext(ctx);
vm.runInContext(files.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n") + ";this.T=TEXTS;", ctx);
// يجب أن تطابق Audio2.hash في js/audio.js
function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0") + s.length.toString(16); }
function prep(t) {
  return t.text
    .replace(/[﴿﴾«»"]/g, "")
    .replace(/\s*\.\.\.\s*/g, "، ")      // بين الشطرين: وقفة قصيرة
    .replace(/\n+/g, ". ")              // بين الأبيات: وقفة أطول
    .replace(/…/g, "، ")
    .replace(/\s+/g, " ").trim();
}
const FEMALE = /الخنساء|ليلى الأخيلية|أمامة بنت|عائشة|هند بنت|ميسون|رابعة/;
const jobs = ctx.T.filter((t) => t.kind !== "قرآن" && !(t.audio && t.audio.url)).map((t) => ({
  h: hash(t.text),
  text: prep(t),
  voice: FEMALE.test(t.author) ? "ar-SA-ZariyahNeural" : "ar-SA-HamedNeural",
  rate: / \.\.\. /.test(t.text) ? "-12%" : "-6%",
}));
process.stdout.write(JSON.stringify(jobs));
