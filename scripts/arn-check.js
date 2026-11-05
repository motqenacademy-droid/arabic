#!/usr/bin/env node
/* يفحص نصاً عربياً بأنماط معجم العرنجية (كما يفعل «المِحَكّ» في الموقع).
   الاستعمال:  node scripts/arn-check.js "النص"      أو      node scripts/arn-check.js --file ملف.txt
   يطبع كل موضع مشتبه به مع البديل الفصيح، ويخرج برمز 1 إن وُجد شيء. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="(js\/(?:data-|content\/)[^"]+)"/g)].map((m) => m[1]);
const ctx = {}; vm.createContext(ctx);
vm.runInContext(files.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n") + ";this.D=DICT;", ctx);
const i = process.argv.indexOf("--file");
const text = i > -1 ? fs.readFileSync(process.argv[i + 1], "utf8") : process.argv.slice(2).join(" ");
const strip = (s) => s.replace(/[ً-ْٰـ]/g, "");
const plain = strip(text);
let n = 0;
for (const d of ctx.D) {
  const re = new RegExp(strip(d.re), "g"); let m;
  while ((m = re.exec(plain))) {
    n++;
    console.log(`✗ «${m[0].trim()}» ← ${d.fus}   [${d.arn}]`);
    if (!m[0].length) re.lastIndex++;
  }
}
console.log(n ? `${n} موضعاً مشتبهاً.` : "✓ لا تراكيب عرنجية معروفة.");
process.exit(n ? 1 : 0);
