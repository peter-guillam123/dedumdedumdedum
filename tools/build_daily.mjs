// Build data/daily.json: the pool of lines for Today's line.
//
// Usage: node tools/build_daily.mjs
//
// Every line comes from a library passage (data/library.json), scanned with
// the library's hand corrections applied. Each line gets one "twist" (what's
// interesting about its rhythm) and the beat pattern we grade against, stored
// as x and / so the page doesn't shift if the scanner changes later.
// The pool is shuffled with a fixed seed so neighbouring days differ in play
// and twist. Day 1 is 3 November 2026 (UK date).
import { readFileSync, writeFileSync } from "node:fs";
import { createScanner } from "../assets/js/scan.js";
import { analyse } from "../assets/js/passage.js";
import { lineNotes } from "../assets/js/notes.js";

const root = new URL("../", import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const scanner = createScanner(read("data/dict.json"));
const library = read("data/library.json");

// What we ask about, in the order we prefer when a line has several.
const ORDER = ["backwards", "starts-on-beat", "sound-ed", "stretch", "squeeze", "midstop", "opposites", "feminine"];
const NOTE_KEY = {
  backwards: ["trochaic"], "starts-on-beat": ["inversion"], "sound-ed": ["sound-ed"], stretch: ["stretch"],
  squeeze: ["squeeze", "elide"], midstop: ["midstop"], opposites: ["opposites"], feminine: ["feminine"],
};
const REGULAR_TEXT =
  "Nothing unusual: five beats, each after a lighter syllable, de-DUM all the way through. Lines like this are the background that makes the twists stand out. When a line is this regular, let the rhythm carry you and put your effort into the meaning.";

// a small seeded random number generator (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lines whose reading scholars argue about: not fair to grade.
const SKIP = new Set(["romeo_juliet-3.2.6", "winters_tale-3.2.105"]);
// Launch day gets the most famous twist there is.
const FIRST = "richardiii-1.1.1";
// No twist should crowd out the rest.
const CAP = { "starts-on-beat": 45 };

const pool = [];
for (const e of library) {
  if (e.kind === "prose" || e.kind === "chant") continue;
  const play = read(`data/plays/${e.play}.json`);
  const scene = play.scenes.find((s) => s.a === e.a && s.s === e.s);
  const speeches = [];
  const firstOf = []; // first line of the corpus speech each passage speech belongs to
  for (const it of scene.items) {
    if (typeof it === "string") continue;
    const lines = it.l.filter(([n]) => n >= e.from && n <= e.to).map(([n, text, indent]) => ({ n, text, indent: indent || 0 }));
    if (!lines.length) continue;
    speeches.push({ who: it.w, form: it.f, lines });
    firstOf.push(it.l[0][0]);
  }
  const a = analyse(scanner, speeches, { fix: e.fix });
  a.flat.forEach(({ s, l }, i) => {
    const sp = a.speeches[s];
    const ln = sp.lines[l];
    if (sp.form !== "verse" || sp.meter !== "pentameter" || !ln.scan || ln.shared) return;
    const scan = ln.scan;
    if (scan.kind !== "regular" && scan.kind !== "feminine") return;
    const types = new Set(scan.features.map((f) => f.type));
    // keep the pool clean: skip lines whose reading is unusual in ways we don't ask about
    if (["extra", "headless", "missing", "shift", "rough"].some((t) => types.has(t))) return;
    if (scan.cost > 2.6) return;
    const present = new Set();
    if (types.has("trochaic")) present.add("backwards");
    if (scan.features.some((f) => f.type === "inversion" && f.first)) {
      // only when the first word is a strong one: "When there is" could fairly go either way
      const first = scan.syllables[0];
      const word = scan.words[first.word].word;
      if (!"PCS".includes(first.cls) && word !== "now") return;
      present.add("starts-on-beat");
    }
    if (scan.features.some((f) => f.type === "inversion" && !f.first)) return; // mid-line turns are too subtle for a daily
    if (types.has("sound-ed")) present.add("sound-ed");
    if (types.has("stretch")) present.add("stretch");
    if (types.has("squeeze") || types.has("elide")) present.add("squeeze");
    if (scan.features.some((f) => f.type === "midstop" && f.strong)) present.add("midstop");
    if (a.antitheses.some((x) => x.a.i === i && x.b.i === i)) present.add("opposites");
    if (scan.kind === "feminine" && !present.has("backwards")) present.add("feminine");
    let twist = ORDER.find((t) => present.has(t));
    if (!twist) {
      const clean = scan.kind === "regular" && scan.cost <= 0.6;
      if (!clean) return;
      twist = "regular";
    }
    let explain = REGULAR_TEXT;
    if (twist !== "regular") {
      const notes = lineNotes(a, i);
      const note = notes.find((n) => NOTE_KEY[twist].includes(n.key) && (twist !== "starts-on-beat" || n.label === "Starts on the beat"));
      if (!note) return;
      explain = note.text;
    }
    if (SKIP.has(`${e.play}-${e.a}.${e.s}.${ln.n}`)) return;
    pool.push({
      id: `${e.play}-${e.a}.${e.s}.${ln.n}`,
      text: ln.text,
      n: ln.n,
      play: e.play,
      title: play.title,
      a: e.a,
      s: e.s,
      who: sp.who,
      speech: firstOf[s],
      lib: e.id,
      twist,
      also: [...present].filter((t) => t !== twist),
      pattern: scan.syllables.map((x) => (x.beat ? "/" : "x")).join(""),
      explain,
    });
  });
}

// cap perfectly regular lines at about a quarter, dropping at random (seeded)
const r = rng(20261103);
const shuffled = (xs) => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const first = pool.find((p) => p.id === FIRST);
if (!first) throw new Error(`${FIRST} isn't in the pool`);
const rest = pool.filter((p) => p !== first);
const regular = rest.filter((p) => p.twist === "regular");
let others = rest.filter((p) => p.twist !== "regular");
for (const [twist, cap] of Object.entries(CAP)) {
  const these = shuffled(others.filter((p) => p.twist === twist)).slice(0, cap);
  others = others.filter((p) => p.twist !== twist).concat(these);
}
const maxRegular = Math.round(others.length / 3); // a quarter of the final pool
for (let i = regular.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [regular[i], regular[j]] = [regular[j], regular[i]];
}
let lines = others.concat(regular.slice(0, maxRegular));

// fixed shuffle, then spread out repeats of play and twist
for (let i = lines.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [lines[i], lines[j]] = [lines[j], lines[i]];
}
lines.unshift(first);
for (let i = 1; i < lines.length; i++) {
  const prev = lines[i - 1];
  const clash = (x) => x.play === prev.play || x.twist === prev.twist || x.lib === prev.lib;
  if (!clash(lines[i])) continue;
  const k = lines.findIndex((x, j) => j > i && !clash(x));
  if (k > 0) [lines[i], lines[k]] = [lines[k], lines[i]];
}

const mix = {};
for (const p of lines) mix[p.twist] = (mix[p.twist] || 0) + 1;
writeFileSync(new URL("data/daily.json", root), JSON.stringify({ start: "2026-11-03", lines }, null, 0));
console.log(`${lines.length} lines (from ${pool.length} candidates)`);
console.log(mix);
