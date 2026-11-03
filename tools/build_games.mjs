// Build data/games.json: pools of lines and passages for the Play games.
// Usage: node tools/build_games.mjs
//
// Every line comes from the corpus. We keep only lines with a clear reading,
// so the games never mark someone wrong on a line the scanner is unsure of.
//   mark:   single lines for "Mark the beat" and "Tap the heartbeat"
//           (lvl 1 regular ten-syllable lines, lvl 2 lines with a twist)
//   reline: 4-5 line verse passages for "Put the lines back"
import { readFileSync, writeFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";
import { analyse } from "../assets/js/passage.js";

const root = new URL("../", import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const sc = createScanner(read("data/dict.json"));
const library = read("data/library.json");
const plays = new Map();
const play = (id) => {
  if (!plays.has(id)) plays.set(id, read(`data/plays/${id}.json`));
  return plays.get(id);
};

function passage(id, a, s, from, to) {
  const scene = play(id).scenes.find((x) => x.a === a && x.s === s);
  const speeches = [];
  for (const it of scene.items) {
    if (typeof it === "string") continue;
    const lines = it.l.filter(([n]) => n >= from && n <= to).map(([n, text, indent]) => ({ n, text, indent: indent || 0 }));
    if (lines.length) speeches.push({ who: it.w, form: it.f, lines, start: it.l[0][0] });
  }
  return speeches;
}

const clean = (t) => !/\[|\]|--|'[A-Z]/.test(t) && !/^[a-z]/.test(t);

// ---------------------------------------------------------------- mark
const mark = [];
for (const e of library) {
  if (e.kind === "prose" || e.kind === "chant") continue;
  const sp = passage(e.play, e.a, e.s, e.from, e.to);
  const res = analyse(sc, sp, { fix: e.fix });
  res.speeches.forEach((s, si) => {
    if (s.form !== "verse" || s.meter !== "pentameter") return;
    s.lines.forEach((ln) => {
      const scan = ln.scan;
      if (!scan || ln.shared || !clean(ln.text)) return;
      const types = new Set(scan.features.map((f) => f.type));
      if (types.has("elide") || types.has("extra") || types.has("shift") || types.has("stretch")) return;
      const fixed = e.fix && e.fix[ln.n];
      let lvl = 0;
      if (scan.kind === "regular" && scan.count === 10 && scan.cost <= 1.0 && !types.has("inversion")) lvl = 1;
      else if ((scan.kind === "regular" || scan.kind === "feminine") && (scan.cost <= 1.3 || fixed) && (types.has("inversion") || scan.kind === "feminine")) lvl = 2;
      if (!lvl) return;
      const item = { t: ln.text, p: e.play, a: e.a, s: e.s, n: ln.n, who: sp[si].who, lib: e.id, lvl };
      if (fixed) item.f = fixed;
      mark.push(item);
    });
  });
}

// ---------------------------------------------------------------- reline
const reline = [];
const ends = /[.!?;:]$/;
function windows(id, a, s, speech, lib) {
  const lines = speech.lines;
  const scans = lines.map((l) => sc.scanLine(l.text));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indent) continue;
    if (i > 0 && !ends.test(lines[i - 1].text.trim())) continue; // start at a sentence
    for (const len of [5, 4]) {
      const win = lines.slice(i, i + len);
      const sw = scans.slice(i, i + len);
      if (win.length < len) continue;
      if (!ends.test(win[win.length - 1].text.trim())) continue; // end at a sentence
      const ok = sw.every((x, k) => (x.kind === "regular" || x.kind === "feminine") && x.cost <= 1.5 && clean(win[k].text) && x.count >= 10 && x.count <= 11);
      if (!ok) continue;
      out.push({ p: id, a, s, n: win[0].n, start: speech.start, who: speech.who, lib, lines: win.map((l) => l.text) });
      i += len - 1; // no overlapping passages
      break;
    }
  }
  return out;
}
for (const e of library) {
  if (e.kind === "prose" || e.kind === "chant") continue;
  for (const speech of passage(e.play, e.a, e.s, e.from, e.to)) {
    if (speech.form !== "v") continue;
    reline.push(...windows(e.play, e.a, e.s, speech, e.id).slice(0, 2));
  }
}
// more from the plays actors meet most, a few per play
const FAMOUS = ["romeo_juliet", "macbeth", "hamlet", "midsummer", "twelfth_night", "merchant", "julius_caesar", "othello", "tempest", "lear", "much_ado", "asyoulikeit", "richardiii", "henryv", "winters_tale", "measure", "richardii", "cleopatra"];
for (const id of FAMOUS) {
  let got = 0;
  for (const scn of play(id).scenes) {
    for (const it of scn.items) {
      if (typeof it === "string" || it.f !== "v" || it.l.length < 6) continue;
      const speech = { who: it.w, start: it.l[0][0], lines: it.l.map(([n, text, indent]) => ({ n, text, indent: indent || 0 })) };
      const w = windows(id, scn.a, scn.s, speech, null);
      if (w.length && !reline.some((r) => r.p === id && r.a === scn.a && r.s === scn.s && r.start === speech.start)) {
        reline.push(w[Math.floor(w.length / 2)]);
        got++;
      }
      if (got >= 4) break;
    }
    if (got >= 4) break;
  }
}

// ---------------------------------------------------------------- names
// Words the plays only ever write with a capital: names, mostly. "Verse or
// prose?" keeps these capitalised when it runs lines together, and drops the
// capital from any other word that starts a verse line mid-sentence.
const lower = new Set();
const upper = new Set();
for (const line of readFileSync(new URL("data/plays.json", root), "utf8").match(/"id":"[^"]+"/g)) {
  const id = line.slice(6, -1);
  for (const scn of play(id).scenes)
    for (const it of scn.items)
      if (typeof it !== "string")
        for (const [, t] of it.l)
          for (const w of t.match(/[A-Za-z][A-Za-z']*/g) || []) (/^[a-z]/.test(w) ? lower : upper).add(w.toLowerCase());
}
const names = [...upper].filter((w) => !lower.has(w) && w.length > 1).sort();

writeFileSync(new URL("data/games.json", root), JSON.stringify({ mark, reline, names }));
console.log(`names: ${names.length}`);
console.log(`mark: ${mark.length} (${mark.filter((m) => m.lvl === 1).length} regular, ${mark.filter((m) => m.lvl === 2).length} with a twist); reline: ${reline.length}`);
