// "Mark the beats": tap the syllables you think take a beat, then check.
// Used by the home page, lessons, the Mark the beat game and Scan of the day.
// Every syllable is a real button, so it works by keyboard and screen reader.
import { el, announce } from "./render.js";

export function createMarker(scan, { label = "Line", onChange, wordFrom = 0, wordTo = scan.words.length } = {}) {
  const marks = new Set();
  const buttons = [];
  const box = el("div", { class: "verse markable", role: "group", "aria-label": `${label}: tap each syllable that takes a beat` });
  const line = el("div", { class: "vline", style: "padding-top:.2em" });
  scan.words.slice(wordFrom, wordTo).forEach((w, k0) => {
    const k = k0 + wordFrom;
    const prev = scan.words[k - 1];
    if (k0 > 0 && !(prev && prev.hyphen)) line.append(" ");
    if (!w.syllables.length) {
      line.append(el("span", { class: "elided" }, w.text));
      return;
    }
    const word = el("span", { class: w.syllables.length > 1 ? "w w--multi" : "w" });
    w.syllables.forEach((si, j) => {
      if (j > 0) word.append(el("span", { class: "sylsep", "aria-hidden": "true" }, "\u00b7"));
      const s = scan.syllables[si];
      const b = el("button", {
        type: "button",
        class: "mark-btn",
        "aria-pressed": "false",
        "aria-label": `${s.text}${w.syllables.length > 1 ? ` (in ${w.text})` : ""}`,
        dataset: { i: si },
        onclick: () => {
          if (box.dataset.locked) return;
          if (marks.has(si)) marks.delete(si);
          else marks.add(si);
          b.setAttribute("aria-pressed", String(marks.has(si)));
          if (onChange) onChange(marks);
        },
      }, s.text);
      buttons[si] = b;
      word.append(b);
    });
    if (w.punct) word.append(w.punct === "–" ? " –" : w.punct);
    if (w.hyphen) word.append("-");
    line.append(word);
  });
  box.append(line);

  // Compare with the scan. Light beats may be left unmarked and weighty
  // offbeats may be marked: both are fair readings of the words.
  function check() {
    box.dataset.locked = "1";
    let right = 0;
    let total = 0;
    const result = [];
    for (let si = 0; si < scan.syllables.length; si++) {
      const b = buttons[si];
      if (!b) continue;
      const s = scan.syllables[si];
      const marked = marks.has(si);
      const light = s.beat && "fFuU".includes(s.cls);
      const heavy = !s.beat && "PC".includes(s.cls);
      let ok;
      let why = null;
      if (s.beat) {
        ok = marked || light;
        if (!marked && light) why = "light";
      } else {
        ok = !marked || heavy;
        if (marked && heavy) why = "heavy";
      }
      total++;
      if (ok) right++;
      b.classList.add(ok ? "is-right" : marked ? "is-wrong" : "is-missed");
      b.setAttribute("aria-label", `${s.text}: ${s.beat ? (light ? "light beat" : "beat") : heavy ? "weighty, off the beat" : "off the beat"}. ${ok ? "Right" : marked ? "You marked it, but it's off the beat" : "You missed this beat"}.`);
      result.push({ si, ok, marked, why });
      b.disabled = true;
    }
    const msg = `${right} of ${total} syllables right.`;
    announce(msg);
    return { right, total, result, perfect: right === total };
  }

  function reveal() {
    box.dataset.locked = "1";
    for (let si = 0; si < scan.syllables.length; si++) {
      const b = buttons[si];
      if (!b) continue;
      b.setAttribute("aria-pressed", String(scan.syllables[si].beat));
      b.disabled = true;
    }
  }

  function reset() {
    delete box.dataset.locked;
    marks.clear();
    buttons.forEach((b) => {
      if (!b) return;
      b.disabled = false;
      b.classList.remove("is-right", "is-wrong", "is-missed");
      b.setAttribute("aria-pressed", "false");
    });
  }

  return { node: box, marks, check, reveal, reset, buttons };
}

// Plain sentences about a check result: what you missed, what was fair.
export function explain(r, scan) {
  const name = (si) => {
    const s = scan.syllables[si];
    const w = scan.words[s.word];
    return w.syllables.length > 1 ? `‘${s.text}’ in ‘${w.text}’` : `‘${w.text}’`;
  };
  const missed = r.result.filter((x) => !x.ok && !x.marked).map((x) => name(x.si));
  const extra = r.result.filter((x) => !x.ok && x.marked).map((x) => name(x.si));
  const light = r.result.filter((x) => x.why === "light").map((x) => name(x.si));
  const heavy = r.result.filter((x) => x.why === "heavy").map((x) => name(x.si));
  const out = [];
  const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  if (missed.length) out.push(`You missed the beat on ${list(missed)}.`);
  if (extra.length) out.push(`${capital(list(extra))} ${extra.length === 1 ? "is" : "are"} off the beat.`);
  if (light.length) out.push(`You left ${list(light)} unmarked. Fair enough: the pattern puts a beat there, but it's a light one you wouldn't lean on.`);
  if (heavy.length) out.push(`You marked ${list(heavy)}. Also fair: ${heavy.length === 1 ? "it's a weighty word" : "they're weighty words"}, even though the pattern has ${heavy.length === 1 ? "it" : "them"} off the beat.`);
  return out;
}
function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
