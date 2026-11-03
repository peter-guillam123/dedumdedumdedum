// Run the scanner over the verse in a few plays and report how it does.
// Usage: node tests/corpus-check.mjs [play ...]
import { readFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";

const dict = JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url)));
const sc = createScanner(dict);
const plays = process.argv.slice(2).length ? process.argv.slice(2) : ["hamlet", "macbeth", "romeo_juliet", "twelfth_night", "richardii", "tempest"];
const kinds = {};
let n = 0, costSum = 0;
const rough = [];
const t0 = Date.now();
for (const id of plays) {
  const play = JSON.parse(readFileSync(new URL(`../data/plays/${id}.json`, import.meta.url)));
  for (const s of play.scenes) for (const it of s.items) {
    if (typeof it === "string" || it.f !== "v") continue;
    for (const [num, text, indent] of it.l) {
      if (indent) continue;
      const line = sc.scanLine(text);
      if (line.kind === "short") continue;
      n++;
      kinds[line.kind] = (kinds[line.kind] || 0) + 1;
      costSum += line.cost;
      if (line.cost > 3) rough.push(`${id} ${s.a}.${s.s}.${num} [${line.cost}] ${text}`);
    }
  }
}
console.log(`${n} lines in ${Date.now() - t0}ms, mean cost ${(costSum / n).toFixed(2)}`);
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(k.padEnd(12), v, (100 * v / n).toFixed(1) + "%");
console.log(`cost > 3: ${rough.length} (${(100 * rough.length / n).toFixed(1)}%)`);
for (const r of rough.sort(() => Math.random() - 0.5).slice(0, 25)) console.log("  " + r);
