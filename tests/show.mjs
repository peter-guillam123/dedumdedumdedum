// Print scans of lines given on stdin (one per line), beats in capitals.
import { readFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";
const sc = createScanner(JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url))));
export function show(line) {
  const parts = [];
  line.words.forEach((w) => {
    if (!w.syllables.length) { parts.push(w.text + "‿"); return; }
    parts.push(w.syllables.map((i) => { const s = line.syllables[i]; return s.beat ? s.text.toUpperCase() : s.text.toLowerCase(); }).join("·"));
  });
  const feats = line.features.filter(f => !["runon","endstop","question","midstop"].includes(f.type)).map((f) => f.type + (f.shown ? `(${f.shown})` : f.word !== undefined && typeof f.word === "number" ? `(${line.words[f.word].text})` : f.at !== undefined ? `@${f.at}` : "")).join(" ");
  return `${line.count} ${line.kind.padEnd(10)} ${String(line.cost).padEnd(5)} ${parts.join(" ").replace(/‿ /g, "‿")}   ${feats}`;
}
if (process.argv[1].endsWith("show.mjs")) {
  const input = readFileSync(0, "utf8").split("\n").filter(Boolean);
  for (const t of input) console.log(show(sc.scanLine(t)));
}
