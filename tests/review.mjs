// Print the scanner's reading of library-style refs for hand checking.
// usage: node tests/review.mjs play:a.s:from-to [...]
import { readFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";
import { analyse } from "../assets/js/passage.js";
const sc = createScanner(JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url))));
const fmt = (scan, w0 = 0, w1 = scan.words.length) => scan.words.slice(w0, w1).map((w) => w.syllables.length ? w.syllables.map((i) => scan.syllables[i].beat ? scan.syllables[i].text.toUpperCase() : scan.syllables[i].text.toLowerCase()).join("·") : w.text + "‿").join(" ");
for (const ref of process.argv.slice(2)) {
  const [play, as, range] = ref.split(":");
  const [a, s] = as.split(".").map(Number);
  const [from, to] = range.split("-").map(Number);
  const doc = JSON.parse(readFileSync(new URL(`../data/plays/${play}.json`, import.meta.url)));
  const scene = doc.scenes.find((x) => x.a === a && x.s === s);
  const speeches = [];
  for (const it of scene.items) { if (typeof it === "string") continue; const lines = it.l.filter(([n]) => n >= from && n <= to).map(([n, text, indent]) => ({ n, text, indent })); if (lines.length) speeches.push({ who: it.w, form: it.f, lines }); }
  const res = analyse(sc, speeches);
  console.log(`## ${ref}`);
  for (const sp of res.speeches) for (const l of sp.lines) {
    if (!l.scan) { console.log(`  ${l.n} P ${l.text}`); continue; }
    const k = l.shared ? `sh${l.shared.part}` : { regular: "", feminine: "f", short: "S", tetrameter: "4", alexandrine: "6", rough: "R", double: "ff" }[l.scan.kind] ?? l.scan.kind;
    console.log(`  ${l.n} ${(k + "").padEnd(3)} ${l.shared && l.shared.part === 0 ? fmt(l.shared.joined) + "  [joined]" : fmt(l.scan)}`);
  }
}
