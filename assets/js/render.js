// Drawing lines of verse with their beats, and notes. Shared by every page.
import { LESSONS } from "./notes.js";

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export function sylClass(s, beat = s.beat) {
  const light = beat && "fFuU".includes(s.cls);
  const heavy = !beat && "PC".includes(s.cls);
  return ["syl", beat && "is-beat", light && "is-light", heavy && "is-heavy"].filter(Boolean).join(" ");
}

// Plain-words description of a scanned line, for screen readers.
export function describeLine(scan, overrides) {
  const beats = scan.syllables.filter((s, i) => (overrides && i in overrides ? overrides[i] : s.beat)).map((s) => s.text.toLowerCase());
  const n = scan.syllables.length;
  return `${n} syllable${n === 1 ? "" : "s"}. Beats on: ${beats.join(", ") || "none"}.`;
}

// opts: {overrides:{i:bool}, feet:bool, wordFrom, wordTo, onSyllable(i, ev), label}
export function renderLine(scan, opts = {}) {
  const { overrides = {}, wordFrom = 0, wordTo = scan.words.length } = opts;
  const line = el("div", { class: "vline" });
  const visual = el("span", { "aria-hidden": "true" });
  const footStarts = new Set(scan.feet.map((f) => f.from).filter((x) => x > 0));
  scan.words.slice(wordFrom, wordTo).forEach((w, k0) => {
    const k = k0 + wordFrom;
    const prev = scan.words[k - 1];
    if (k0 > 0 && !(prev && prev.hyphen)) visual.append(" ");
    if (!w.syllables.length) {
      visual.append(el("span", { class: "elided", title: w.shown ? `Say ‘${w.shown}’` : null }, w.text));
      return;
    }
    const word = el("span", { class: "w" });
    w.syllables.forEach((si) => {
      if (opts.feet && footStarts.has(si)) word.append(el("span", { class: "foot-bar" }));
      const s = scan.syllables[si];
      const beat = si in overrides ? overrides[si] : s.beat;
      word.append(el("span", { class: sylClass(s, beat), dataset: { i: si } }, s.text));
    });
    if (w.punct) word.append(w.punct === "–" ? " –" : w.punct);
    if (w.hyphen) word.append(el("span", { class: "hyph" }, "-"));
    visual.append(word);
  });
  line.append(visual);
  const text = scan.words.slice(wordFrom, wordTo).map((w) => w.text + (w.punct || "") + (w.hyphen ? "-" : " ")).join("").trim();
  line.append(el("span", { class: "visually-hidden" }, `${opts.label ? opts.label + ": " : ""}${text}. ${describeLine(scan, overrides)}`));
  return line;
}

// A line shown as plain text (prose, or verse before it's scanned).
export function renderPlain(text, opts = {}) {
  return el("div", { class: "vline vline--plain" }, opts.label ? el("span", { class: "visually-hidden" }, opts.label + ": ") : null, text.replace(/--/g, " – "));
}

const CATEGORY = {
  inversion: "rhythm", feminine: "rhythm", trochaic: "rhythm", short: "rhythm", shared: "rhythm",
  headless: "rhythm", alexandrine: "rhythm", four: "rhythm", tetra: "rhythm", rough: "rhythm",
  light: "rhythm", heavy: "rhythm", mono: "rhythm",
  squeeze: "squeeze", elide: "squeeze", "sound-ed": "squeeze", stretch: "squeeze", shift: "squeeze", extra: "squeeze",
  runon: "breath", midstop: "breath", hinge: "breath",
  opposites: "sense", repeat: "sense", rhyme: "sense", sound: "sense", prose: "sense",
  switch: "people", contrast: "people",
};
export const categoryOf = (key) => CATEGORY[key] || "sense";

export function chip(note) {
  return el("li", { class: `chip chip--${categoryOf(note.key)}` }, note.label);
}

export function renderNote(note, { short = false } = {}) {
  const box = el("div", { class: `note note--${categoryOf(note.key)}` });
  box.append(el("h4", {}, note.label));
  box.append(el("p", {}, short ? note.short : note.text));
  if (!short && note.choices && note.choices.length) {
    box.append(el("p", { class: "small", style: "margin:0" }, "You could:"));
    box.append(el("ul", {}, note.choices.map((c) => el("li", {}, c))));
  }
  if (note.lesson && LESSONS[note.lesson]) {
    const L = LESSONS[note.lesson];
    box.append(el("p", { class: "more" }, el("a", { href: `learn.html?l=${note.lesson}` }, `Lesson ${L.n}: ${L.title}`)));
  }
  return box;
}

export function renderKey() {
  return el(
    "ul",
    { class: "key", "aria-label": "What the marks mean" },
    el("li", {}, el("span", { class: "dot dot--beat", "aria-hidden": "true" }), "beat"),
    el("li", {}, el("span", { class: "dot dot--light", "aria-hidden": "true" }), "light beat: a small word on the beat"),
    el("li", {}, el("span", { class: "dot dot--heavy", "aria-hidden": "true" }), "weighty word off the beat"),
    el("li", {}, el("span", { class: "dot dot--off", "aria-hidden": "true" }), "off the beat"),
  );
}

// "de-DUM de-DUM de-DUM" for a scan
export function beatWords(scan) {
  return scan.feet
    .map((f) => {
      const out = [];
      for (let i = f.from; i < f.to; i++) out.push(scan.syllables[i].beat ? "DUM" : "de");
      return out.join("-");
    })
    .join(" ");
}

export function announce(msg) {
  let live = document.getElementById("live");
  if (!live) {
    live = el("div", { id: "live", class: "visually-hidden", "aria-live": "polite" });
    document.body.append(live);
  }
  live.textContent = "";
  setTimeout(() => (live.textContent = msg), 30);
}
