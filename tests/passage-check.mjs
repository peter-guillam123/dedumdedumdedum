import { readFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";
import { analyse, parsePasted } from "../assets/js/passage.js";
import { show } from "./show.mjs";
const sc = createScanner(JSON.parse(readFileSync(new URL("../data/dict.json", import.meta.url))));
function fromCorpus(id, a, s, from, to) {
  const play = JSON.parse(readFileSync(new URL(`../data/plays/${id}.json`, import.meta.url)));
  const scene = play.scenes.find((x) => x.a === a && x.s === s);
  const speeches = [];
  for (const it of scene.items) {
    if (typeof it === "string") continue;
    const lines = it.l.filter(([n]) => n >= from && n <= to).map(([n, text, indent]) => ({ n, text, indent }));
    if (lines.length) speeches.push({ who: it.w, form: it.f, lines });
  }
  return speeches;
}
const [id, a, s, from, to] = process.argv.slice(2);
const res = analyse(sc, id === "paste" ? parsePasted(readFileSync(0, "utf8")) : fromCorpus(id, +a, +s, +from, +to));
res.speeches.forEach((sp) => {
  console.log(`## ${sp.who} (${sp.form}${sp.meter !== "pentameter" ? ", " + sp.meter : ""})`);
  for (const l of sp.lines) console.log(String(l.n).padStart(4), l.scan ? show(l.scan) : l.text, l.shared ? `  [shared ${l.shared.part + 1}/${l.shared.of}]` : "");
});
console.log("thoughts:", res.thoughts.length, res.thoughts.slice(0, 3).map((t) => t.text));
console.log("antitheses:", res.antitheses.map((x) => `${x.a.text}/${x.b.text}`).join(", "));
console.log("switches:", res.switches.map((x) => `${x.who}: ${x.from}->${x.to} at ${x.at.text}`).join("; "));
console.log("rhymes:", res.rhymes.map((r) => r.words.join("/")).join(", "));
console.log("sounds:", res.sounds.map((r) => r.sound + ":" + r.words.join(",")).join("; "));
console.log("summary:", JSON.stringify(res.summary));
